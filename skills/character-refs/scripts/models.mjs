// 出图适配层：Qwen（远程 ComfyUI）、GPT（本机 codex 内置 $imagegen）、OpenAI Images API（GPT Image 2）、自定义命令模板。
// 每个适配器只做一件事：给定 {text, negative, ratio, refs[文件路径], seed}，返回 PNG 字节。
// 凭据只从环境变量或配置里指定的 .env 文件读，从不打印。

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IS_WIN = process.platform === 'win32';

/** 在本机 shell 里跑一条命令：Windows 走 cmd.exe，其余走 sh（与 fillTemplate 的引号约定配套）。 */
function runShell(cmd, opts = {}) {
  return spawnSync(cmd, { ...opts, shell: true });
}

export const SKILL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** 配置放在 skill 安装目录（install.sh 是软链，重装不会冲掉）；文件名带 .local，不进版本控制。 */
export const CONFIG_PATH = process.env.CHARACTER_REFS_CONFIG || join(SKILL_DIR, 'config.local.json');   // 环境变量只给自测用

export const DEFAULT_CONFIG = {
  anchorModel: null,          // 主图（锚点）用哪个模型：qwen / codex / openai / custom:<名字>
  deriveModel: null,          // 派生图用哪个模型；初次设置时与 anchorModel 相同，可以单独改
  confirmAnchor: null,        // 出完锚点是否停下来等人确认；初次运行时由用户决定
  models: {
    qwen: {
      envFile: null,          // 可选：从这个 .env 读 COMFY_URL / COMFY_USER / COMFY_PASS
      unet: 'qwen_image_2.1_int8_convrot.safetensors',
      clip: 'qwen3vl_8b_int8_convrot.safetensors',
      vae: 'qwen_image_2.1_vae_bf16.safetensors',
      steps: 20, cfg: 2.5, shift: 3.1,
    },
    codex: { bin: null },     // 不给就自动找本机版本最高的 codex
    openai: {                 // OpenAI Images API（GPT Image 2）；也可指向兼容 OpenAI 格式的中转
      envFile: null,          // 可选：从这个 .env 读 OPENAI_API_KEY（与 OPENAI_BASE_URL）
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-image-2',
      quality: 'high',        // 认脸敏感的编辑官方建议 high
    },
    custom: {},               // { 名字: { cmd: "mytool --prompt-file {prompt_file} --ref {refs} --out {out} --size {width}x{height}" } }
  },
};

export function loadConfig(path = CONFIG_PATH) {
  const raw = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  return {
    ...DEFAULT_CONFIG, ...raw,
    models: {
      qwen: { ...DEFAULT_CONFIG.models.qwen, ...(raw.models?.qwen ?? {}) },
      codex: { ...DEFAULT_CONFIG.models.codex, ...(raw.models?.codex ?? {}) },
      openai: { ...DEFAULT_CONFIG.models.openai, ...(raw.models?.openai ?? {}) },
      custom: { ...(raw.models?.custom ?? {}) },
    },
  };
}
export const saveConfig = (cfg, path = CONFIG_PATH) => writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n', 'utf8');

/** 初次运行要问用户的三件事，缺一件就不出图。 */
export function configMissing(cfg) {
  const m = [];
  if (!cfg.anchorModel) m.push('主图（锚点）用哪个模型');
  if (!cfg.deriveModel) m.push('派生图用哪个模型（默认与主图相同）');
  if (cfg.confirmAnchor === null || cfg.confirmAnchor === undefined) m.push('出完锚点是否停下来等人确认');
  return m;
}

export function modelKind(name) {
  if (name === 'qwen' || name === 'codex' || name === 'openai') return name;
  if (/^custom:[\w-]+$/.test(String(name))) return 'custom';
  throw new Error(`不认识的模型 ${name}（可用：qwen / codex / openai / custom:<名字>）`);
}

/* ------------------------------------------------------------------ */
/* Qwen · 远程 ComfyUI                                                   */
/* ------------------------------------------------------------------ */
// 尺寸都是 16 的倍数、约 1.6–1.8 百万像素（Qwen Image 的舒适区），比例严格等于 2:3 / 4:5 / 1:1
export const QWEN_SIZES = { '2:3': [1056, 1584], '4:5': [1152, 1440], '1:1': [1328, 1328] };

export function parseEnv(text) {
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

export function qwenEndpoint(qcfg, env = process.env) {
  const file = qcfg.envFile ? parseEnv(readFileSync(resolve(qcfg.envFile.replace(/^~/, homedir())), 'utf8')) : {};
  const pick = (k) => env[k] || file[k] || '';
  const url = (qcfg.url || pick('COMFY_URL')).replace(/\/+$/, '');
  if (!url) throw new Error('Qwen 没配地址：设 COMFY_URL 环境变量，或在配置里给 models.qwen.envFile / url');
  const user = pick('COMFY_USER'), pass = pick('COMFY_PASS');
  return { url, auth: user ? 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') : null };
}

/**
 * ComfyUI 工作流（API 格式）。锚点纯文生图；其余把参考图接进 TextEncodeQwenImageEditPlus
 * （最多 3 张，参考图走文本编码器条件，不是 img2img）。与实测时的工作流逐项一致。
 */
export function qwenWorkflow({ text, negative, ratio, seed }, refNames, q) {
  const [w, h] = QWEN_SIZES[ratio];
  const g = {
    unet: { class_type: 'UNETLoader', inputs: { unet_name: q.unet, weight_dtype: 'default' } },
    clip: { class_type: 'CLIPLoader', inputs: { clip_name: q.clip, type: 'qwen_image', device: 'default' } },
    vae: { class_type: 'VAELoader', inputs: { vae_name: q.vae } },
    ms: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['unet', 0], shift: q.shift, sampling: 'flow' } },
    neg: { class_type: 'CLIPTextEncode', inputs: { clip: ['clip', 0], text: negative } },
    lat: { class_type: 'EmptySD3LatentImage', inputs: { width: w, height: h, batch_size: 1 } },
    ks: { class_type: 'KSampler', inputs: { model: ['ms', 0], positive: ['pos', 0], negative: ['neg', 0], latent_image: ['lat', 0],
      seed, steps: q.steps, cfg: q.cfg, sampler_name: 'euler', scheduler: 'simple', denoise: 1.0 } },
    dec: { class_type: 'VAEDecode', inputs: { samples: ['ks', 0], vae: ['vae', 0] } },
    save: { class_type: 'SaveImage', inputs: { images: ['dec', 0], filename_prefix: 'character-refs/out' } },
  };
  if (!refNames.length) {
    g.pos = { class_type: 'CLIPTextEncode', inputs: { clip: ['clip', 0], text } };
  } else {
    const enc = { clip: ['clip', 0], vae: ['vae', 0], prompt: text };
    refNames.forEach((r, i) => {
      g[`ref${i + 1}`] = { class_type: 'LoadImage', inputs: { image: r } };
      enc[`image${i + 1}`] = [`ref${i + 1}`, 0];
    });
    g.pos = { class_type: 'TextEncodeQwenImageEditPlus', inputs: enc };
  }
  return g;
}

async function http(ep, method, path, body, { timeoutMs = 120_000, raw = false } = {}) {
  let last;
  for (let i = 0; i < 4; i++) {  // 隧道偶尔返回空响应，重试
    try {
      const headers = { ...(ep.auth ? { Authorization: ep.auth } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) };
      const r = await fetch(ep.url + path, { method, headers, body: body && !(body instanceof FormData) ? JSON.stringify(body) : body, signal: AbortSignal.timeout(timeoutMs) });
      if (!r.ok) throw new Error(`HTTP ${r.status} ${path.split('?')[0]}`);
      return raw ? Buffer.from(await r.arrayBuffer()) : await r.json();
    } catch (e) {
      last = e;
      await new Promise((ok) => setTimeout(ok, 1500));
    }
  }
  throw last;
}

export async function qwenGenerate(job, cfg) {
  const q = cfg.models.qwen;
  const ep = qwenEndpoint(q);
  const names = [];
  for (const f of job.refs) {
    const form = new FormData();
    form.append('image', new Blob([readFileSync(f)], { type: 'image/png' }), basename(f).replace(/[^\w.-]/g, '_'));
    form.append('subfolder', 'character-refs');
    form.append('type', 'input');
    form.append('overwrite', 'true');
    const up = await http(ep, 'POST', '/upload/image', form);
    names.push(up.subfolder ? `${up.subfolder}/${up.name}` : up.name);
  }
  const { prompt_id: pid } = await http(ep, 'POST', '/prompt', { prompt: qwenWorkflow(job, names, q) });
  const t0 = Date.now();
  for (;;) {
    const h = await http(ep, 'GET', `/history/${pid}`);
    if (h[pid]) {
      const st = h[pid].status ?? {};
      if (st.status_str === 'error') {
        const m = (st.messages ?? []).find((x) => x[0] === 'execution_error');
        throw new Error(`ComfyUI 执行出错：${m?.[1]?.exception_message ?? '未知错误'}`);
      }
      const img = h[pid].outputs?.save?.images?.[0];
      if (!img) throw new Error('ComfyUI 没有返回图片');
      return http(ep, 'GET', `/view?${new URLSearchParams(img)}`, null, { raw: true, timeoutMs: 300_000 });
    }
    if (Date.now() - t0 > 15 * 60_000) throw new Error('ComfyUI 等了 15 分钟还没出图');
    await new Promise((ok) => setTimeout(ok, 3000));
  }
}

/* ------------------------------------------------------------------ */
/* GPT · 本机 codex 内置 $imagegen                                        */
/* ------------------------------------------------------------------ */
// 不需要 API key，吃 ChatGPT 订阅额度（实测约二十多张触顶，几小时后恢复）。
// 尺寸不能作为参数传，只能写进提示词——所以比例门对它是必需的（实测它会照提示词出严格的 2:3 / 4:5）。

export function findCodex(explicit = null) {
  if (explicit) return explicit;
  const home = homedir();
  const which = runShell(IS_WIN ? 'where codex' : 'command -v codex', { encoding: 'utf8' }).stdout.trim();
  const cands = [which, `${home}/.npm-global/bin/codex`, `${home}/.local/bin/codex`, '/opt/homebrew/bin/codex', '/usr/local/bin/codex'];
  let best = null, bestN = -1;
  for (const c of new Set(cands.filter(Boolean))) {
    if (!existsSync(c)) continue;
    const v = spawnSync(c, ['--version'], { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } }).stdout?.match(/(\d+)\.(\d+)\.(\d+)/);
    if (!v) continue;
    const n = +v[1] * 1e6 + +v[2] * 1e3 + +v[3];
    if (n > bestN) { bestN = n; best = c; }  // 机器上可能装了多个，旧版会直接报 requires a newer version
  }
  if (!best) throw new Error('找不到 codex——装一下 npm i -g @openai/codex，或在配置里写 models.codex.bin');
  return best;
}

export function codexStdin(job) {
  const ratioLine = { '2:3': 'Portrait orientation, 2:3 aspect ratio.', '4:5': 'Portrait orientation, 4:5 aspect ratio.', '1:1': 'Square 1:1 aspect ratio.' }[job.ratio];
  const note = job.refs.length > 1
    ? 'The attached images are references: image 1 is the full outfit, image 2 is a close-up of the face; they are the same person.'
    : job.refs.length ? 'The attached image is the reference image.' : '';
  return ['Use $imagegen to generate exactly one image with the built-in image_gen tool, then copy the final PNG to ./out.png in the current ' +
    'working directory. Reply with only the file path — no base64, no markdown image preview.', note,
  `${job.text} ${ratioLine} Avoid: ${job.negative}.`].filter(Boolean).join('\n\n');
}

export function codexGenerate(job, cfg) {
  const bin = findCodex(cfg.models.codex.bin);
  const dir = mkdtempSync(join(tmpdir(), 'character-refs-'));
  try {
    const args = ['exec', '--skip-git-repo-check', '--sandbox', 'workspace-write', ...job.refs.flatMap((f) => ['-i', resolve(f)]), '-'];
    // 父进程的 NODE_OPTIONS 会被 codex 继承，指向已删除的预加载文件时它会在启动阶段崩
    const r = spawnSync(bin, args, { cwd: dir, input: codexStdin(job), encoding: 'utf8', timeout: 15 * 60_000, env: { ...process.env, NODE_OPTIONS: '' }, maxBuffer: 64 * 2 ** 20 });
    const out = join(dir, 'out.png');
    if (existsSync(out)) return readFileSync(out);
    const log = `${r.stdout ?? ''}\n${r.stderr ?? ''}`;
    if (/usage limit|usage_limit_reached/i.test(log)) throw new Error('codex 出图额度用完了（ChatGPT 订阅额度），过几小时再试或换模型');
    if (/401|Unauthorized/.test(log)) throw new Error('codex 登录失效，运行 codex logout && codex login 重新登录');
    throw new Error(`codex 没有产出图片（退出码 ${r.status}）`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ */
/* GPT Image · OpenAI Images API                                         */
/* ------------------------------------------------------------------ */
// 锚点走 /images/generations，派生图走 /images/edits（参考图用 image[] 逐张附上，gpt-image 最多 16 张）。
// 接口没有反向提示词，写成 Avoid: 附在正文后。gpt-image-2 对输入图恒为高保真，不传 input_fidelity；
// 老的 gpt-image-1 / 1.5 才传 input_fidelity=high。尺寸与 Qwen 同一套：都是 16 的倍数、比例严格。

export function openaiEndpoint(ocfg, env = process.env) {
  const file = ocfg.envFile ? parseEnv(readFileSync(resolve(ocfg.envFile.replace(/^~/, homedir())), 'utf8')) : {};
  const key = env.OPENAI_API_KEY || file.OPENAI_API_KEY || '';
  if (!key) throw new Error('GPT Image 没有 API key：设 OPENAI_API_KEY 环境变量，或在配置里给 models.openai.envFile');
  const base = (env.OPENAI_BASE_URL || file.OPENAI_BASE_URL || ocfg.baseUrl).replace(/\/+$/, '');
  return { base, key };
}

export function openaiRequest(job, ocfg) {
  const [w, h] = QWEN_SIZES[job.ratio];
  const prompt = `${job.text} Avoid: ${job.negative}.`;
  const common = { model: ocfg.model, prompt, size: `${w}x${h}`, quality: ocfg.quality, n: 1 };
  if (!job.refs.length) return { path: '/images/generations', json: { ...common, output_format: 'png' } };
  const form = new FormData();
  for (const [k, v] of Object.entries(common)) form.append(k, String(v));
  if (ocfg.model !== 'gpt-image-2') form.append('input_fidelity', 'high');
  for (const f of job.refs) form.append('image[]', new Blob([readFileSync(f)], { type: 'image/png' }), basename(f).replace(/[^\w.-]/g, '_'));
  return { path: '/images/edits', form };
}

export async function openaiGenerate(job, cfg) {
  const ep = openaiEndpoint(cfg.models.openai);
  const req = openaiRequest(job, cfg.models.openai);
  const r = await fetch(ep.base + req.path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ep.key}`, ...(req.json ? { 'Content-Type': 'application/json' } : {}) },
    body: req.json ? JSON.stringify(req.json) : req.form,
    signal: AbortSignal.timeout(10 * 60_000),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GPT Image 接口返回 ${r.status}：${body?.error?.message ?? '未知错误'}`);
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error('GPT Image 接口没有返回图片（data[0].b64_json）');
  return Buffer.from(b64, 'base64');
}

/* ------------------------------------------------------------------ */
/* 自定义命令模板                                                        */
/* ------------------------------------------------------------------ */
const shq = IS_WIN
  ? (s) => `"${String(s).replace(/"/g, '""')}"`
  : (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** 占位符：{prompt_file} {negative_file} {prompt} {negative} {refs} {ref1} {ref2} {ref3} {out} {width} {height} {ratio} {seed}，全部已加引号。 */
export function fillTemplate(cmd, vars) {
  return cmd.replace(/\{(\w+)\}/g, (m, k) => (k === 'refs' ? vars.refs.map(shq).join(' ') : k in vars ? shq(vars[k]) : m));
}

export function customGenerate(job, cfg, name) {
  const spec = cfg.models.custom[name];
  if (!spec?.cmd) throw new Error(`配置里没有自定义模型 ${name}（models.custom.${name}.cmd）`);
  const dir = mkdtempSync(join(tmpdir(), 'character-refs-'));
  try {
    const [width, height] = QWEN_SIZES[job.ratio];
    const vars = { prompt_file: join(dir, 'prompt.txt'), negative_file: join(dir, 'negative.txt'), prompt: job.text, negative: job.negative,
      refs: job.refs.map((f) => resolve(f)), ref1: job.refs[0] ?? '', ref2: job.refs[1] ?? '', ref3: job.refs[2] ?? '',
      out: join(dir, 'out.png'), width, height, ratio: job.ratio, seed: job.seed ?? '' };
    writeFileSync(vars.prompt_file, job.text);
    writeFileSync(vars.negative_file, job.negative);
    const r = runShell(fillTemplate(spec.cmd, vars), { encoding: 'utf8', timeout: 20 * 60_000 });
    if (!existsSync(vars.out)) throw new Error(`自定义模型 ${name} 没有写出 {out}（退出码 ${r.status}）：${(r.stderr ?? '').trim().slice(0, 300)}`);
    return readFileSync(vars.out);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function generate(model, job, cfg) {
  const kind = modelKind(model);
  if (kind === 'qwen') return qwenGenerate(job, cfg);
  if (kind === 'codex') return codexGenerate(job, cfg);
  if (kind === 'openai') return openaiGenerate(job, cfg);
  return customGenerate(job, cfg, model.slice('custom:'.length));
}

/** 展示用：密码与令牌打码。 */
export function maskConfig(cfg) {
  const c = JSON.parse(JSON.stringify(cfg));
  if (c.models?.qwen?.pass) c.models.qwen.pass = '（已隐藏）';
  return c;
}
