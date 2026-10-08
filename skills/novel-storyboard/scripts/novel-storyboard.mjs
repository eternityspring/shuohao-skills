#!/usr/bin/env node
// novel-storyboard — deterministic helpers for the novel-storyboard skill (分镜).
// Zero dependencies on purpose: the skill must work in any directory
// without an npm install. Node 18+ (stdlib only).

import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* 常量                                                                */
/* ------------------------------------------------------------------ */
/*
 * AI 短剧的前提刻在骨子里，三层结构也由此而来：
 *
 *   段（segment）＝ 一次视频生成调用，上限就是模型单段时长（默认 15 秒）
 *   分镜（cut）  ＝ 段内的一次剪切，2–5 秒——短剧观众的注意力节奏
 *   分镜图       ＝ 每个分镜一张关键帧：第 1 个分镜的是主分镜图（钉在
 *                  0.00 秒），其余是子分镜图（各钉在自己的切点时刻）
 *
 * 一段的画面由这串分镜图 + 一条 H3 提示词共同控制：多图对齐指令
 * 把每张图钉在对应秒数上，[Shot k] 的切点时刻和分镜秒数逐一对账。
 * 多切一刀的成本几乎为零，所以不心疼分镜数量，只守节奏。
 */

export const DEFAULT_PARAMS = {
  maxSegmentSeconds: 15, // 视频模型单段生成上限（秒）
  minCutSeconds: 2,      // 单个分镜下限
  maxCutSeconds: 5,      // 单个分镜上限——3 秒左右是短剧的呼吸
  maxOnScreen: 3,        // 单个分镜同框人数上限，超了必须带拆解说明
  tolerance: 0.15,       // 每集总时长对剧本目标的容差
};

export function paramsOf(doc) {
  return { ...DEFAULT_PARAMS, ...(doc?.params ?? {}) };
}

/** 景别枚举：中文词必须出现在该分镜的分镜图提示词里（分镜图提示词是中文）。 */
export const SHOT_SIZES = {
  'extreme-wide': { zh: '大远景', phrase: 'extreme wide shot' },
  wide: { zh: '全景', phrase: 'wide shot' },
  medium: { zh: '中景', phrase: 'medium shot' },
  close: { zh: '特写', phrase: 'close-up' },
  'extreme-close': { zh: '大特写', phrase: 'extreme close-up' },
};

/** 运镜枚举：直接用 H3 官方词表，原样写进该分镜的 [Shot k] 段落。 */
export const CAMERA_MOVES = {
  'Static Shot': '固定',
  'Push In': '推',
  'Pull Out': '拉',
  'Zoom In': '变焦推',
  'Zoom Out': '变焦拉',
  'Pan Left': '左摇',
  'Pan Right': '右摇',
  'Truck Left': '左移',
  'Truck Right': '右移',
  'Tilt Up': '仰摇',
  'Tilt Down': '俯摇',
  'Pedestal Up': '升',
  'Pedestal Down': '降',
  'Arc Shot': '环绕',
  'Tracking Shot': '跟拍',
  'Shake Slightly': '轻微晃动',
  'Shake Strongly': '强烈晃动',
  'POV': '主观视角',
  'Roll Clockwise': '顺旋',
  'Roll Counterclockwise': '逆旋',
};

/** 稳定性枚举：跟运镜是两件事——固定机位也可以微晃。 */
export const STABILITY = { stable: '稳定', 'slight-shake': '微晃', handheld: '手持' };

/**
 * 构图量化字段（每镜必填）。纯参考图出片时没有分镜图替正文说清
 * 「多近、谁在哪、眼睛看哪」，这些信息要么写成字，要么就地消失。
 */
export const COMPOSITION_FIELDS = ['lens', 'cameraPosition', 'composition', 'eyeline', 'focus', 'stability'];

const CJK = /[㐀-鿿぀-ヿ가-힯]/;
const r1 = (n) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------ */
/* H3 提示词的确定性骨架                                                 */
/* ------------------------------------------------------------------ */
/*
 * 结构由 H3 官方规范（h3-prompt-writing skill）定死，而且对齐指令和
 * 切点时刻都能从分镜结构推导出来——所以逐字设门，一个字符都不许漂。
 */

export const H3_I2VA_LINE =
  'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.';
export const H3_FIELDS = ['integrated_multimodal_description:', 'overall_soundscape:', 'non_diegetic_music:'];

/** 骨架 token 按语言取：默认英文（官方规范口径）；'zh' 整条中文（只保留 <d>[Chinese] 和 (S1) 两个模型级 token）。 */
export const H3_TOKENS = {
  zh: {
    i2va: '目标视频在 0.00 秒处完全参照图 1（来自镜头 1）。',
    alignHead: '参考图与目标视频的对齐——',
    alignItem: (k, t) => `图 ${k}（来自镜头 ${k}）对齐目标视频 ${t} 秒处`,
    alignTail: '。',
    fields: ['整体视听描述：', '整体音景：', '非叙事配乐：'],
    shot: (k) => `[镜头 ${k}]`,
    cutMark: (k, time) => `[镜头 ${k}] 于 ${time}，`,
  },
  en: {
    i2va: H3_I2VA_LINE,
    alignHead: 'How the reference pictures align with the target video — ',
    alignItem: (k, t) => `Picture ${k} (from Shot ${k}) aligns with the ${t}-second mark of the target video`,
    alignTail: '.',
    fields: H3_FIELDS,
    shot: (k) => `[Shot ${k}]`,
    cutMark: (k, time) => `[Shot ${k}] At ${time},`,
  },
};

/** 段内切点时刻表：[0, c1, c1+c2, …]（不含结尾）。 */
export function cutStarts(cuts) {
  const starts = [];
  let t = 0;
  for (const c of cuts ?? []) {
    starts.push(r1(t));
    t += c?.seconds ?? 0;
  }
  return starts;
}

/** [Shot k] 的切点时刻格式：00:03.000（分:秒.毫秒）。 */
export function h3CutTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const ms = Math.round((t - Math.floor(t)) * 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * 首行对齐指令：单分镜的段用 I2VA 固定句式；多分镜的段把每张分镜图
 * 钉在自己的切点秒数上。整行由分镜结构推导，validate 逐字对账。
 */
export function h3AlignmentLine(cuts, lang = 'en') {
  const tk = H3_TOKENS[lang] ?? H3_TOKENS.zh;
  if (!cuts || cuts.length <= 1) return tk.i2va;
  const starts = cutStarts(cuts);
  const parts = cuts.map((c, i) => tk.alignItem(i + 1, starts[i].toFixed(2)));
  return `${tk.alignHead}${parts.join(lang === 'en' ? '; ' : '；')}${tk.alignTail}`;
}

/** 台词/画面文字之外的部分——H3 要求它全英文，人名也只许出现在 <d> 里。 */
export function h3Remainder(prompt) {
  return String(prompt ?? '')
    .replace(/<d>[\s\S]*?<\/d>/g, ' ')
    .replace(/"[^"\n]*"/g, ' ');
}

/** 把 h3Prompt 的描述正文按 [镜头 k] / [Shot k] 切成每个分镜自己的段落。 */
export function h3CutSlices(prompt, cutCount, lang = 'en') {
  const tk = H3_TOKENS[lang] ?? H3_TOKENS.zh;
  const h3 = String(prompt ?? '');
  const bodyStart = h3.indexOf(tk.fields[0]);
  const bodyEnd = h3.indexOf(tk.fields[1]);
  if (bodyStart < 0) return [];
  const body = h3.slice(bodyStart, bodyEnd < 0 ? undefined : bodyEnd);
  const slices = [];
  for (let k = 1; k <= cutCount; k++) {
    const a = body.indexOf(tk.shot(k));
    if (a < 0) {
      slices.push(null);
      continue;
    }
    const b = body.indexOf(tk.shot(k + 1));
    slices.push(body.slice(a, b < 0 ? undefined : b));
  }
  return slices;
}

/* ------------------------------------------------------------------ */
/* Seedance 提示词：程序按官方结构拼                                       */
/* ------------------------------------------------------------------ */
/*
 * 写法见 references/seedance-prompt.md。模型只写每一切的镜头正文（cut.shot），
 * 其余全由这里拼：参考图声明、段级走位、逐镜量化字段、台词 {}、音效 <>、
 * 配乐（）、编号约束。时间层用镜头顺序表达，不写秒数——官方说精确时间不稳定。
 * 画风层（视觉风格）不在这里：它由调用方在提交时附加。
 */

// 运镜行用完整的中文说法；词表里本来就完整的原样用
const SEEDANCE_CAMERA = { 'Static Shot': '固定镜头', 'Push In': '推镜', 'Pull Out': '拉镜' };
export const seedanceCamera = (camera) => SEEDANCE_CAMERA[camera] ?? CAMERA_MOVES[camera] ?? '';

/** 镜头正文里不许出现的东西：这些由程序按真实结构加，正文写了就会重复或错位。 */
export const SEEDANCE_FORBIDDEN = [
  [/\d+(?:\.\d+)?\s*(?:[–\-~至到]\s*\d+(?:\.\d+)?\s*)?秒|\d{1,2}:\d{2}/, '时间'],
  [/【镜头|镜头\s*\d/, '镜头编号'],
  [/@\s*\[?图片|<Picture|\[Shot|<\/?d>/i, '图片引用或 H3 标记'],
  [/[{}<>（）]/, '协议符号（台词 {} 从剧本取，音效 <> 与配乐（）由程序套）'],
];

export const SEEDANCE_NO_SUBTITLES = '保持无字幕，避免生成任何文字或字幕';
export const SEEDANCE_NO_TWINS = '视频全程禁止出现外形、着装、配饰完全一致的人物';

/**
 * 附件两条路：这一段每切都有分镜图 → 分镜路径，只挂分镜图；否则 → 参考图路径，
 * 挂场景、人物、道具的设定图，已有的分镜图接在后面并在对应镜头注明构图参考。
 * 越需要精准参考的越靠前：场景 → 人物 → 道具 → 分镜图。
 *
 * @param scene  expandScript 展开后的那一场（取台词原文）；没有剧本时台词行写 {}
 * @param names  { scene(id), char(id), prop(id) } → 显示名
 * @param image  (kind, rel) → src|null，与报告同一个定位函数，判断分镜图在不在
 * @param constraints 调用方的全局约束，逐条拼进【约束】
 * @returns {{ prompt: string, refs: {kind, label, file}[] }}
 */
export function seedancePrompt(seg, { scene = null, names = {}, image = null, constraints = [] } = {}) {
  const nm = {
    scene: names.scene ?? ((id) => id),
    char: names.char ?? ((id) => id),
    prop: names.prop ?? ((id) => id),
  };
  const cuts = seg?.cuts ?? [];
  const frames = cuts.map((_, ci) => (image ? image('frame', `${seg.id}/f${ci + 1}.png`) : null));
  const refs = [];
  if (!cuts.length || !frames.every(Boolean)) {
    const sheet = (label) => ({ kind: 'sheet', label, file: `${slug(label)}-sheet.png` });
    if (scene?.sceneId) refs.push(sheet(nm.scene(scene.sceneId)));
    for (const id of new Set(cuts.flatMap((c) => c?.characters ?? []))) if (id !== 'VO') refs.push(sheet(nm.char(id)));
    for (const id of new Set(cuts.flatMap((c) => c?.props ?? []))) refs.push(sheet(nm.prop(id)));
  }
  const frameRef = new Map();
  frames.forEach((src, ci) => {
    if (!src) return;
    refs.push({ kind: 'frame', label: `分镜图 #${ci + 1}`, file: `${seg.id}/f${ci + 1}.png` });
    frameRef.set(ci, refs.length);
  });

  const out = refs.map((r, i) => `@[图片${i + 1}] = ${r.label}`);
  if (out.length) out.push('');
  const blocking = String(seg?.blocking ?? '').trim();
  if (blocking) out.push('【人物关系与构图逻辑】', blocking, '');

  cuts.forEach((cut, ci) => {
    // 每一行只在有内容时出现；台词行例外——没有台词也写 {}，告诉模型这一镜不说话
    const line = (k, v) => {
      const text = String(v ?? '').trim();
      if (text) out.push(`${k}：${text}`);
    };
    out.push(`【镜头${ci + 1}】`);
    line('焦距', cut?.lens);
    line('机位', cut?.cameraPosition);
    line('构图', cut?.composition);
    line('运镜', seedanceCamera(cut?.camera));
    line('景别', SHOT_SIZES[cut?.size]?.zh);
    const ref = frameRef.get(ci);
    const shot = String(cut?.shot ?? '').trim();
    if (shot) out.push(`画面：${shot}${ref ? `（构图参考 @图片${ref}）` : ''}`);
    line('光影', cut?.lighting);
    const [from, to] = cut?.beats ?? [];
    const spoken = scene && Number.isInteger(from) && Number.isInteger(to)
      ? scene.beats.slice(from - 1, to).filter((b) => b.kind === 'line')
      : [];
    // 台词逐字进 {}；身份与语气由镜头正文交代，画外音按官方写法标在 {} 外面
    out.push(`台词：${spoken.length ? spoken.map((b) => `${b.speaker === 'VO' ? '以画外音说' : ''}{${b.text}}`).join(' ') : '{}'}`);
    line('视线落点', cut?.eyeline);
    line('焦点', cut?.focus);
    line('稳定性', STABILITY[cut?.stability] ?? cut?.stability);
    line('音效', cut?.sfx);
    out.push('');
  });

  const soundscape = String(seg?.soundscape ?? '').trim();
  const music = String(seg?.music ?? '').trim();
  if (soundscape) out.push(`<${soundscape}>`);
  if (music) out.push(`（${music}）`);
  if (soundscape || music) out.push('');

  // 本管线不要字幕；同段多人同框时禁双胞胎——官方已知坑，放进约束末尾
  const rules = [...constraints.map((c) => String(c).trim()).filter(Boolean)];
  if (!rules.includes(SEEDANCE_NO_SUBTITLES)) rules.push(SEEDANCE_NO_SUBTITLES);
  const crowded = cuts.some((c) => (c?.characters ?? []).filter((id) => id !== 'VO').length >= 2);
  if (crowded && !rules.includes(SEEDANCE_NO_TWINS)) rules.push(SEEDANCE_NO_TWINS);
  out.push('【约束】', ...rules.map((r, i) => `${i + 1}. ${r}`));
  return { prompt: out.join('\n'), refs };
}

/* ------------------------------------------------------------------ */
/* 剧本节拍展开                                                          */
/* ------------------------------------------------------------------ */
/*
 * 与 novel-script 相同的计秒规则，这里刻意重新实现而不是跨目录
 * import——每个 skill 必须自包含、可以单独拷走。参数从 script.json
 * 的 params 里读，两边天然一致。
 */

const SCRIPT_DEFAULTS = { charsPerSecond: 4.5, actionSeconds: 2.5 };
const lineChars = (line) => String(line ?? '').replace(/\s+/g, '').length;

/** 把 script.json 展开成分镜要认领的节拍清单：ep → scenes → beats。 */
export function expandScript(script) {
  const p = { ...SCRIPT_DEFAULTS, ...(script?.params ?? {}) };
  const eps = new Map();
  for (const ep of script?.episodes ?? []) {
    const scenes = (ep?.scenes ?? []).map((sc, i) => ({
      sceneIndex: i + 1,
      sceneId: sc.sceneId,
      lighting: sc.lighting ?? '',
      characters: sc.characters ?? [],
      props: sc.props ?? [],
      beats: (sc.flow ?? []).map((b, j) => {
        const isLine = typeof b?.line === 'string';
        return {
          n: j + 1,
          kind: isLine ? 'line' : 'action',
          seconds: r1(isLine ? lineChars(b.line) / p.charsPerSecond : p.actionSeconds),
          speaker: isLine ? b.speaker : undefined,
          delivery: isLine ? (b.delivery ?? '') : undefined,
          text: isLine ? b.line : b.action,
        };
      }),
    }));
    eps.set(ep.ep, { ep: ep.ep, targetSeconds: ep.targetSeconds, scenes });
  }
  return eps;
}

export const segSeconds = (segment) => r1((segment?.cuts ?? []).reduce((n, c) => n + (c?.seconds ?? 0), 0));

/* ------------------------------------------------------------------ */
/* 镜头配方卡库（可选挂载）                                               */
/* ------------------------------------------------------------------ */
/*
 * shot-recipes 是可选挂载的卡库：给了 --shots <卡片目录> 才有 shot-recipe
 * 这道门。两个 skill 必须各自独立、谁没有谁都能跑，所以这里刻意不
 * import shot-recipes.mjs，自己写一份受限 frontmatter 解析——与
 * expandScript 同一个先例（跨目录 import 会让 skill 拷不走）。
 *
 * 只取门要用的机器字段，正文一概不读；语法受限到只认 `key: 标量` 与
 * `key: [a, b, c]` 行内数组——受限就没有歧义，25 行足够。卡片格式的合法性
 * 由 shot-recipes 自己的 lint 负责，这边只管读得懂的部分。
 */

const RECIPE_FIELDS = new Set(['id', 'name', 'name_en', 'cuts', 'must_phrases', 'sizes', 'cameras']);
const unquote = (s) => String(s).replace(/^['"](.*)['"]$/, '$1').trim();

/** 受限 frontmatter 解析：只回机器字段，没有 id 就当不是卡片。 */
export function parseCardFields(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text ?? ''));
  if (!m) return null;
  const card = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!kv || !RECIPE_FIELDS.has(kv[1])) continue;
    const v = kv[2].trim();
    if (v.startsWith('[')) {
      const inner = v.replace(/^\[/, '').replace(/\]$/, '').trim();
      card[kv[1]] = inner
        ? inner.split(',').map(unquote).filter((x) => x !== '').map((x) => (/^-?\d+$/.test(x) ? Number(x) : x))
        : [];
    } else {
      card[kv[1]] = unquote(v);
    }
  }
  return card.id ? card : null;
}

/** 读卡片目录 → Map<id, 机器字段>。只吃顶层 .md（en/ 是正文翻译，机器字段只有一份）。 */
export function loadRecipes(dir) {
  const root = resolve(dir);
  const cards = new Map();
  if (!existsSync(root)) return cards;
  for (const f of readdirSync(root).filter((x) => x.endsWith('.md')).sort()) {
    const card = parseCardFields(readFileSync(join(root, f), 'utf8'));
    if (card) cards.set(card.id, card);
  }
  return cards;
}

/*
 * 建议景别 / 运镜**刻意不设门**，只在报告里提示偏离，理由三条：
 *   1. 配方是语汇不是法条——同一张卡在竖屏与横屏、两人与三人、有台词
 *      与无台词的情况下，景别会合理偏移（卡库那边把它们存成集合而不是
 *      序列，就是从结构上杜绝升级成硬门）
 *   2. 可选挂载的东西一旦变严就没人挂——挂了反而被拦，下次就不挂了
 *   3. 仓库已有明文判例：误拦的门比没有门更糟，门的信用比数量重要
 */
export function recipeDrift(cut, card) {
  const sizes = Array.isArray(card?.sizes) ? card.sizes : [];
  const cameras = Array.isArray(card?.cameras) ? card.cameras : [];
  return {
    sizes: sizes.length && !sizes.includes(cut?.size) ? sizes : [],
    cameras: cameras.length && !cameras.includes(cut?.camera) ? cameras : [],
  };
}

/* ------------------------------------------------------------------ */
/* 门失败累积                                                           */
/* ------------------------------------------------------------------ */
/*
 * 每次 validate / checkup 的结果本来跑完就没了，于是「模型最常违反哪条规则」
 * 只能靠印象。这里把每次运行与每条失败追加到工作目录的 .gates.jsonl，
 * stats 子命令再读回来，回答三个问题：
 *   哪道门最常响   → 那条规则模型最常无视，措辞该改
 *   哪道门从没响过 → 可能是死门，或者规则已经被模型内化了
 *   失败详情长什么样 → 反复出现却没有门的那类问题，只能靠人看这些自由文本
 *
 * 刻意做成纯函数 + CLI 负责 IO：自测不落盘也能验。
 * 写不进去就静默跳过——日志是附加价值，不能让它挡住主流程。
 */

export const GATE_LOG = '.gates.jsonl';

/** 一次运行产生的日志行（对象数组，CLI 负责序列化落盘）。 */
export function gateLogEntries(gates, { doc = '', at = '' } = {}) {
  const list = Array.isArray(gates) ? gates : [];
  if (!list.length) return [];
  const failed = list.filter((g) => !g.ok);
  const rows = [{ kind: 'run', at, doc, gates: list.length, failed: failed.length }];
  for (const g of failed) {
    rows.push({ kind: 'fail', at, doc, gate: g.id, label: g.label, detail: g.detail ?? '' });
  }
  return rows;
}

/** 汇总日志行。allGates 给全量门 id，用来找出「从没响过」的那些。 */
export function summarizeGateLog(entries, allGates = []) {
  const rows = (Array.isArray(entries) ? entries : []).filter((e) => e && typeof e === 'object');
  const runs = rows.filter((e) => e.kind === 'run');
  const fails = rows.filter((e) => e.kind === 'fail');
  const byGate = new Map();
  for (const f of fails) {
    if (!byGate.has(f.gate)) byGate.set(f.gate, { gate: f.gate, label: f.label ?? f.gate, count: 0, samples: [] });
    const rec = byGate.get(f.gate);
    rec.count += 1;
    if (rec.samples.length < 3 && f.detail) rec.samples.push(f.detail);
  }
  const ranked = [...byGate.values()].sort((a, b) => b.count - a.count || a.gate.localeCompare(b.gate));
  const silent = allGates.filter((id) => !byGate.has(id));
  return {
    runs: runs.length,
    cleanRuns: runs.filter((r) => !r.failed).length,
    fails: fails.length,
    ranked,
    silent,
  };
}

/* ------------------------------------------------------------------ */
/* stats                                                               */
/* ------------------------------------------------------------------ */

/** 报告与质量门共用的确定性统计。script 是硬前提——分镜离开剧本没有意义。 */
export function computeStats(board, script) {
  const params = paramsOf(board);
  const expanded = expandScript(script);
  const episodes = [];
  const batches = new Map(); // sceneId|lighting → 生成批次
  const dialogue = [];       // 配音对齐单：段 × 分镜 × 说话人 × 台词

  for (const ep of board?.episodes ?? []) {
    const sEp = expanded.get(ep.ep);
    let total = 0;
    let cutCount = 0;
    let withLines = 0;
    for (const seg of ep?.segments ?? []) {
      const scene = sEp?.scenes?.[seg.sceneIndex - 1];
      const secs = segSeconds(seg);
      total += secs;
      let segHasLine = false;
      (seg?.cuts ?? []).forEach((cut, ci) => {
        cutCount++;
        if (!scene) return;
        const [from, to] = cut.beats ?? [];
        for (const b of scene.beats.slice((from ?? 1) - 1, to ?? 0)) {
          if (b.kind !== 'line') continue;
          segHasLine = true;
          dialogue.push({ segment: seg.id, cut: ci + 1, ep: ep.ep, speaker: b.speaker, line: b.text, seconds: b.seconds });
        }
      });
      if (segHasLine) withLines++;
      if (scene) {
        const key = `${scene.sceneId}|${scene.lighting}`;
        if (!batches.has(key)) {
          batches.set(key, { sceneId: scene.sceneId, lighting: scene.lighting, segments: [], characters: new Set(), props: new Set() });
        }
        const batch = batches.get(key);
        batch.segments.push(seg.id);
        for (const cut of seg?.cuts ?? []) {
          for (const c of cut.characters ?? []) batch.characters.add(c);
          for (const pr of cut.props ?? []) batch.props.add(pr);
        }
      }
    }
    episodes.push({
      ep: ep.ep,
      target: sEp?.targetSeconds ?? 0,
      segments: (ep?.segments ?? []).length,
      cuts: cutCount,
      totalSeconds: r1(total),
      avgCutSeconds: cutCount ? r1(total / cutCount) : 0,
      withLines,
    });
  }

  const totals = {
    segments: episodes.reduce((n, e) => n + e.segments, 0),
    cuts: episodes.reduce((n, e) => n + e.cuts, 0),
    seconds: r1(episodes.reduce((n, e) => n + e.totalSeconds, 0)),
    targetSeconds: episodes.reduce((n, e) => n + e.target, 0),
    withLines: episodes.reduce((n, e) => n + e.withLines, 0),
    avgCutSeconds: 0,
  };
  totals.avgCutSeconds = totals.cuts ? r1(totals.seconds / totals.cuts) : 0;

  return {
    params,
    episodes,
    totals,
    dialogue,
    batches: [...batches.values()].map((b) => ({
      sceneId: b.sceneId, lighting: b.lighting, segments: b.segments,
      characters: [...b.characters], props: [...b.props],
    })),
  };
}

/* ------------------------------------------------------------------ */
/* 质量门                                                               */
/* ------------------------------------------------------------------ */

export function gateReport(board, ctx = {}) {
  const gates = [];
  const add = (id, label, ok, detail = '') => gates.push({ id, label, ok, detail });
  const params = paramsOf(board);
  const script = ctx.script ?? null;
  const expanded = script ? expandScript(script) : null;
  const eps = Array.isArray(board?.episodes) ? board.episodes : [];
  const bad = {
    coverage: [], segCap: [], cutLen: [], fit: [], duration: [], crowd: [],
    id: [], size: [], camera: [], frame: [], names: [], refs: [],
    h3s: [], h3d: [], h3e: [], recipe: [], comp: [], sd: [],
  };
  // 配方卡库是可选挂载：ctx.recipes 为空就整门跳过（不是「没有 cut 带 recipe」就跳过）
  const recipes = ctx.recipes ?? null;
  let recipeRefs = 0;
  // 提示词语言：默认英文——官方规范的口径（台词仍在 <d> 里保留原文）；'zh' 可切整条中文
  const promptLang = board?.promptLang ?? 'en';

  // 视频提示词禁人名：outline 的名字 + cast 的名字与别名。这是 H3 与 Seedance 官方规范的要求，
  // 不跟着语言变；分镜图提示词反过来直呼其名——名字指向挂上去的那张设定图
  const banned = [];
  for (const c of ctx.outline?.characters ?? []) if (c?.name) banned.push(c.name);
  for (const c of ctx.cast?.characters ?? []) {
    if (c?.name) banned.push(c.name);
    for (const a of c?.aliases ?? []) banned.push(a);
  }

  for (const ep of eps) {
    const label = `E${String(ep?.ep).padStart(2, '0')}`;
    const sEp = expanded?.get(ep?.ep);
    if (expanded && !sEp) bad.refs.push(`${label} 在剧本里不存在`);

    // 段号纪律：格式、集号一致、连号
    (ep?.segments ?? []).forEach((seg, i) => {
      const want = `${label}-${String(i + 1).padStart(2, '0')}`;
      if (seg?.id !== want) bad.id.push(`第 ${i + 1} 段应为 ${want}，实际「${seg?.id}」`);
    });

    let prevSceneIndex = 0;
    for (const seg of ep?.segments ?? []) {
      const sid = seg?.id ?? '?';
      const cuts = seg?.cuts ?? [];
      const total = segSeconds(seg);

      if (!(total > 0) || total > params.maxSegmentSeconds) {
        bad.segCap.push(`${sid} 共 ${total} 秒`);
      }

      const h3 = String(seg?.h3Prompt ?? '');
      // H3 结构：首行对齐指令逐字对账（由分镜结构按 promptLang 推导），三字段按序，切点时刻逐个对
      const tk = H3_TOKENS[promptLang] ?? H3_TOKENS.zh;
      const wantLine = h3AlignmentLine(cuts, promptLang);
      if (!h3.trimStart().startsWith(wantLine)) {
        bad.h3s.push(`${sid} 首行对齐指令和分镜结构对不上（promptLang=${promptLang}）`);
      } else {
        const idx = tk.fields.map((f) => h3.indexOf(f));
        if (idx.some((i) => i < 0) || !(idx[0] < idx[1] && idx[1] < idx[2])) {
          bad.h3s.push(`${sid} 三个核心字段缺失或顺序不对`);
        } else {
          const starts = cutStarts(cuts);
          if (h3.indexOf(tk.shot(1), idx[0]) < 0) bad.h3s.push(`${sid} 描述正文缺 ${tk.shot(1)}`);
          for (let k = 2; k <= cuts.length; k++) {
            const mark = tk.cutMark(k, h3CutTime(starts[k - 1]));
            if (h3.indexOf(mark, idx[0]) < 0) bad.h3s.push(`${sid} 缺「${mark}」——切点时刻必须等于前面分镜秒数的累计`);
          }
        }
      }
      const rest = h3Remainder(h3);
      if (promptLang === 'en') {
        if (CJK.test(rest)) bad.h3e.push(`${sid} 的 h3Prompt 设定英文却在 <d> 台词之外混入了中文`);
      } else if (!CJK.test(rest)) {
        bad.h3e.push(`${sid} 设定中文提示词（promptLang=${promptLang}），正文却写成了英文`);
      }
      for (const name of banned) {
        if (rest.includes(name)) bad.names.push(`${sid} 的 h3Prompt 在台词之外出现角色名「${name}」`);
      }

      // 段级：走位是整段的空间地基；Seedance 的音效与配乐由程序套符号，字段里不许自带
      if (!String(seg?.blocking ?? '').trim()) bad.comp.push(`${sid} 缺 blocking（人物关系与构图逻辑）`);
      if (/[<>]/.test(String(seg?.soundscape ?? ''))) bad.sd.push(`${sid} 的 soundscape 自带了 <>——程序会套`);
      if (/[（）()]/.test(String(seg?.music ?? ''))) bad.sd.push(`${sid} 的 music 自带了括号——程序会套（）`);

      const slices = h3CutSlices(h3, cuts.length, promptLang);
      const scene = sEp ? sEp.scenes[seg?.sceneIndex - 1] : null;
      if (sEp && !scene) bad.refs.push(`${sid} 的 sceneIndex ${seg?.sceneIndex} 在剧本第 ${ep.ep} 集里不存在`);
      if (scene) {
        if (seg.sceneIndex < prevSceneIndex) bad.coverage.push(`${sid} 场次顺序倒退`);
        prevSceneIndex = Math.max(prevSceneIndex, seg.sceneIndex);
      }

      cuts.forEach((cut, ci) => {
        const cid = `${sid}#${ci + 1}`;

        if (!(cut?.seconds >= params.minCutSeconds) || cut.seconds > params.maxCutSeconds) {
          bad.cutLen.push(`${cid} ${cut?.seconds ?? '?'} 秒`);
        }
        if ((cut?.characters ?? []).length > params.maxOnScreen && !String(cut?.note ?? seg?.note ?? '').trim()) {
          bad.crowd.push(`${cid} 同框 ${cut.characters.length} 人且没有拆解说明`);
        }
        if (!SHOT_SIZES[cut?.size]) {
          bad.size.push(`${cid} 景别「${cut?.size}」不在枚举里`);
        } else if (!String(cut?.frame ?? '').includes(SHOT_SIZES[cut.size].zh)) {
          bad.size.push(`${cid} 分镜图提示词缺景别词「${SHOT_SIZES[cut.size].zh}」`);
        }
        if (!CAMERA_MOVES[cut?.camera]) {
          bad.camera.push(`${cid} 运镜「${cut?.camera}」不在 H3 词表里`);
        } else {
          const slice = slices[ci];
          const term = promptLang === 'en' ? String(cut.camera).toLowerCase() : CAMERA_MOVES[cut.camera];
          if (slice == null) {
            bad.camera.push(`${cid} 在 h3Prompt 里找不到对应的 [Shot ${ci + 1}] 段落`);
          } else if (!(promptLang === 'en' ? slice.toLowerCase() : slice).includes(term)) {
            bad.camera.push(`${cid} 的 [Shot ${ci + 1}] 段落缺运镜词「${term}」`);
          }
        }
        const frame = String(cut?.frame ?? '');
        if (!frame.trim()) bad.frame.push(`${cid} 的分镜图提示词为空`);
        else if (!CJK.test(frame)) bad.frame.push(`${cid} 的分镜图提示词不是中文`);

        // 构图量化字段：每镜六项齐全，稳定性在枚举里
        const missing = COMPOSITION_FIELDS.filter((f) => !String(cut?.[f] ?? '').trim());
        if (missing.length) bad.comp.push(`${cid} 缺 ${missing.join(' / ')}`);
        else if (!STABILITY[cut.stability]) bad.comp.push(`${cid} 的 stability「${cut.stability}」不在枚举里（${Object.keys(STABILITY).join(' / ')}）`);

        // Seedance 镜头正文：中文、非空、通用身份，不写程序会加的东西
        const shot = String(cut?.shot ?? '');
        if (!shot.trim()) bad.sd.push(`${cid} 缺 shot（Seedance 镜头正文）`);
        else {
          if (!CJK.test(shot)) bad.sd.push(`${cid} 的 shot 不是中文`);
          for (const [re, what] of SEEDANCE_FORBIDDEN) {
            if (re.test(shot)) bad.sd.push(`${cid} 的 shot 写了${what}`);
          }
          for (const name of banned) {
            if (shot.includes(name)) bad.names.push(`${cid} 的 Seedance 镜头正文出现角色名「${name}」`);
          }
        }

        // 镜头配方：id 在卡库里 + 每条必备短语进了本切的 frame
        // 判定与 shot-recipes 的 checkRecipes 完全一致：两边小写化后 includes，逐条全中才算过
        if (recipes && typeof cut?.recipe === 'string' && cut.recipe) {
          recipeRefs += 1;
          const card = recipes.get(cut.recipe);
          if (!card) {
            bad.recipe.push(`${cid} 引用的配方「${cut.recipe}」不在配方库里`);
          } else {
            const lower = frame.toLowerCase();
            for (const ph of card.must_phrases ?? []) {
              if (!lower.includes(String(ph).toLowerCase())) {
                bad.recipe.push(`${cid} 的分镜图提示词缺配方「${card.name}」的必备短语「${ph}」`);
              }
            }
          }
        }

        // 引用对账 + 台词装得下 + 台词逐字进 <d>
        if (scene) {
          const cast = new Set(scene.characters);
          for (const c of cut?.characters ?? []) {
            if (!cast.has(c)) bad.refs.push(`${cid} 的 ${c} 不在剧本该场人物里`);
          }
          const propSet = new Set(scene.props);
          for (const pr of cut?.props ?? []) {
            if (!propSet.has(pr)) bad.refs.push(`${cid} 的 ${pr} 不在剧本该场道具里`);
          }
          const [from, to] = cut?.beats ?? [];
          if (Number.isInteger(from) && Number.isInteger(to) && from >= 1 && to <= scene.beats.length && from <= to) {
            let dlg = 0;
            for (const b of scene.beats.slice(from - 1, to)) {
              if (b.kind !== 'line') continue;
              dlg += b.seconds;
              const re = new RegExp(`<d>\\[[^\\]]+\\]\\s*${b.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</d>`);
              if (!re.test(h3)) bad.h3d.push(`${sid} 的 h3Prompt 缺台词「${b.text.slice(0, 12)}…」的 <d> 块`);
            }
            if (dlg > cut.seconds) bad.fit.push(`${cid} 台词 ${r1(dlg)} 秒装不进 ${cut.seconds} 秒`);
          }
        }
      });

      // 多格配方靠「连续同 id 的 run」表达（不引入新结构）：卡片 cuts 下限 ≥ 2 时，
      // 连续段的长度不得小于该下限——单独挂一格的两格配方是没兑现的配方
      if (recipes) {
        for (let i = 0; i < cuts.length; ) {
          const rid = cuts[i]?.recipe;
          if (typeof rid !== 'string' || !rid) {
            i += 1;
            continue;
          }
          let j = i;
          while (j + 1 < cuts.length && cuts[j + 1]?.recipe === rid) j += 1;
          const card = recipes.get(rid);
          const min = Array.isArray(card?.cuts) ? card.cuts[0] : 0;
          const run = j - i + 1;
          if (min >= 2 && run < min) {
            bad.recipe.push(`${sid}#${i + 1} 的配方「${card.name}」要 ${min} 格连排，这里只有 ${run} 格——多格配方靠连续同 recipe 的分镜表达`);
          }
          i = j + 1;
        }
      }
    }

    // 节拍全覆盖：每场的节拍被恰好一次、按顺序、连续认领（分镜级）
    if (sEp) {
      for (const scene of sEp.scenes) {
        const claims = [];
        for (const seg of ep?.segments ?? []) {
          if (seg?.sceneIndex !== scene.sceneIndex) continue;
          (seg?.cuts ?? []).forEach((cut, ci) => {
            const [from, to] = cut?.beats ?? [];
            if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > scene.beats.length || from > to) {
              bad.coverage.push(`${seg.id}#${ci + 1} 的节拍区间 [${from}, ${to}] 不合法（该场共 ${scene.beats.length} 拍）`);
              return;
            }
            claims.push([from, to, `${seg.id}#${ci + 1}`]);
          });
        }
        let cursor = 1;
        for (const [from, to, id] of claims) {
          if (from !== cursor) {
            bad.coverage.push(`${label} 第 ${scene.sceneIndex} 场第 ${cursor} 拍${from > cursor ? '没人认领' : `被 ${id} 重复认领`}`);
          }
          cursor = Math.max(cursor, to + 1);
        }
        if (claims.length && cursor <= scene.beats.length) {
          bad.coverage.push(`${label} 第 ${scene.sceneIndex} 场第 ${cursor}–${scene.beats.length} 拍没人认领`);
        }
        if (!claims.length && scene.beats.length) {
          bad.coverage.push(`${label} 第 ${scene.sceneIndex} 场整场没有分镜`);
        }
      }

      // 每集总时长对齐剧本目标
      if (sEp.targetSeconds > 0) {
        const total = (ep?.segments ?? []).reduce((n, s) => n + segSeconds(s), 0);
        const lo = sEp.targetSeconds * (1 - params.tolerance);
        const hi = sEp.targetSeconds * (1 + params.tolerance);
        if (total < lo) bad.duration.push(`${label} 欠 ${r1(lo - total)} 秒（${r1(total)}s / 目标 ${sEp.targetSeconds}s）`);
        if (total > hi) bad.duration.push(`${label} 超 ${r1(total - hi)} 秒（${r1(total)}s / 目标 ${sEp.targetSeconds}s）`);
      }
    }
  }

  const SKIP_SCRIPT = '未提供 script.json，本门跳过（视为通过）';
  const SKIP_NAMES = '未提供 outline/cast，本门跳过（视为通过）';
  const SKIP_SHOTS = '未挂载配方卡库（--shots <卡片目录>），本门跳过（视为通过）';
  const NO_RECIPE = '本批分镜没有引用配方';

  add('coverage', '剧本节拍被恰好一次、按顺序、连续认领（分镜级）', bad.coverage.length === 0, script ? bad.coverage.join('；') : SKIP_SCRIPT);
  add('segment-cap', `每段 0 < 总秒数 ≤ ${params.maxSegmentSeconds}（一次生成的上限）`, eps.length > 0 && bad.segCap.length === 0, bad.segCap.join('；'));
  add('cut-length', `每个分镜 ${params.minCutSeconds}–${params.maxCutSeconds} 秒——短剧的注意力节奏`, eps.length > 0 && bad.cutLen.length === 0, bad.cutLen.join('；'));
  add('dialogue-fit', '认领节拍的台词装得进分镜秒数', bad.fit.length === 0, script ? bad.fit.join('；') : SKIP_SCRIPT);
  add('ep-duration', `每集总时长在剧本目标 ±${Math.round(params.tolerance * 100)}% 内`, bad.duration.length === 0, script ? bad.duration.join('；') : SKIP_SCRIPT);
  add('crowd', `单个分镜同框 ≤ ${params.maxOnScreen} 人，超了必须带拆解说明`, bad.crowd.length === 0, bad.crowd.join('；'));
  add('segment-id', '段号 E01-01 格式、按顺序连号', bad.id.length === 0, bad.id.join('；'));
  add('size-phrase', '景别中文词写进分镜图提示词', bad.size.length === 0, bad.size.join('；'));
  add('camera-phrase', '运镜用 H3 官方词表，且出现在自己的 [Shot k] 段落里', bad.camera.length === 0, bad.camera.join('；'));
  add('h3-structure', 'H3 首行对齐指令由分镜结构推导逐字对账，切点时刻逐个对', eps.length > 0 && bad.h3s.length === 0, bad.h3s.join('；'));
  add('h3-dialogue', '认领节拍的台词逐字进 H3 提示词的 <d> 块', bad.h3d.length === 0, script ? bad.h3d.join('；') : SKIP_SCRIPT);
  add('h3-lang', `H3 提示词语言与设定一致（promptLang=${promptLang}，正文${promptLang === 'en' ? '全英文' : '中文'}、骨架 token 官方英文格式）`, bad.h3e.length === 0, bad.h3e.join('；'));
  add('frame-prompt', '分镜图提示词中文且非空', bad.frame.length === 0, bad.frame.join('；'));
  add('prompt-no-names', '视频提示词不含角色名（H3 正文与 Seedance 镜头正文；分镜图提示词直呼其名放行）', bad.names.length === 0, banned.length ? bad.names.join('；') : SKIP_NAMES);
  add('composition', '构图量化字段齐全（每段 blocking；每镜焦距／机位／构图／视线落点／焦点／稳定性）', eps.length > 0 && bad.comp.length === 0, bad.comp.join('；'));
  add('seedance-shot', 'Seedance 镜头正文中文非空，不写时间、镜头编号、图片引用和协议符号', eps.length > 0 && bad.sd.length === 0, bad.sd.join('；'));
  add('refs', '场次／人物／道具对账剧本', bad.refs.length === 0, script ? bad.refs.join('；') : SKIP_SCRIPT);
  // 可选挂载的门放最后：没给 --shots 就跳过；给了但全篇没引用配方也算通过，但要明说，不静默
  add(
    'shot-recipe',
    '引用的配方存在、必备短语进了分镜图提示词、多格配方连排够格数',
    bad.recipe.length === 0,
    recipes ? (bad.recipe.length ? bad.recipe.join('；') : recipeRefs ? '' : NO_RECIPE) : SKIP_SHOTS,
  );

  return gates;
}

/* ------------------------------------------------------------------ */
/* validate                                                            */
/* ------------------------------------------------------------------ */

export function validateStoryboard(board, ctx = {}) {
  const problems = [];
  const p = (msg) => problems.push(msg);
  if (!board || typeof board !== 'object') return ['storyboard.json 不是对象'];

  if (!String(board.source ?? '').trim()) p('缺少 source（剧名）');
  const eps = board.episodes;
  if (!Array.isArray(eps) || eps.length === 0) {
    p('episodes 为空');
    return problems;
  }
  const seen = new Set();
  for (const ep of eps) {
    const label = `第 ${ep?.ep ?? '?'} 集`;
    if (!Number.isInteger(ep?.ep) || ep.ep < 1) p(`${label}的 ep 必须是正整数`);
    if (seen.has(ep?.ep)) p(`集号 ${ep.ep} 重复`);
    seen.add(ep?.ep);
    if (!Array.isArray(ep?.segments) || ep.segments.length === 0) {
      p(`${label}没有段`);
      continue;
    }
    for (const seg of ep.segments) {
      const sid = seg?.id ?? '?';
      if (typeof seg?.id !== 'string') p(`${label}有段缺 id`);
      if (!Number.isInteger(seg?.sceneIndex) || seg.sceneIndex < 1) p(`${sid} 缺 sceneIndex（剧本里第几场）`);
      if (typeof seg?.h3Prompt !== 'string') p(`${sid} 缺 h3Prompt（H3 视频提示词，写法见 references/h3-prompt.md）`);
      if (!Array.isArray(seg?.cuts) || seg.cuts.length === 0) {
        p(`${sid} 没有分镜`);
        continue;
      }
      seg.cuts.forEach((cut, ci) => {
        const cid = `${sid}#${ci + 1}`;
        if (!Array.isArray(cut?.beats) || cut.beats.length !== 2) p(`${cid} 的 beats 必须是 [起, 止] 两个数`);
        if (typeof cut?.seconds !== 'number') p(`${cid} 缺 seconds`);
        if (!Array.isArray(cut?.characters)) p(`${cid} 缺 characters（空镜给空数组）`);
        if (typeof cut?.frame !== 'string') p(`${cid} 缺 frame（分镜图提示词，中文）`);
      });
    }
  }

  for (const g of gateReport(board, ctx)) {
    if (!g.ok) p(`质量门未过：${g.label}${g.detail ? `（${g.detail}）` : ''}`);
  }
  return problems;
}

/* ------------------------------------------------------------------ */
/* seed — 从 script.json 确定性预填                                      */
/* ------------------------------------------------------------------ */

export function seedFromScript(script, epRange = null) {
  const expanded = expandScript(script);
  const inRange = (n) => !epRange || (n >= epRange[0] && n <= epRange[1]);
  const episodes = [];
  for (const [epNo, sEp] of expanded) {
    if (!inRange(epNo)) continue;
    episodes.push({
      ep: epNo,
      segments: [],
      seedScenes: sEp.scenes.map((sc) => ({
        sceneIndex: sc.sceneIndex,
        sceneId: sc.sceneId,
        lighting: sc.lighting,
        characters: sc.characters,
        props: sc.props,
        beats: sc.beats.map((b) => ({
          n: b.n,
          kind: b.kind,
          seconds: b.seconds,
          ...(b.speaker ? { speaker: b.speaker } : {}),
          text: b.text,
        })),
      })),
    });
  }
  return { source: script?.source ?? '', episodes };
}

/* ------------------------------------------------------------------ */
/* export — 投产包（H3 / Seedance 二选一）                                */
/* ------------------------------------------------------------------ */
/*
 * 固定投产结构：每段一个文件夹，提示词就躺在图旁边，整个文件夹就是一次生成。
 *
 * - H3：E01-01/f1.png … fN.png + prompt.md（h3Prompt 原样），根部 manifest.json
 *   按 Picture 序列出该段要挂的分镜图、秒数、缺图标注
 * - Seedance：E01-01/seedance.md（程序拼的提示词）+ 附件，根部 seedance-manifest.json
 *   按 @图片 编号列出每个附件——分镜图就是包里的 f<k>.png，设定图拷成 ref-<n>.png
 *
 * 纯函数返回文件清单与要拷的设定图，落盘在 CLI 层——可测性。
 *
 * @param opts.protocol     'h3'（默认）| 'seedance'
 * @param opts.imageExists  包内相对路径 → 是否已有（分镜图）
 * @param opts.sheetExists  设定图文件名 → 是否找得到（Seedance 参考图路径用）
 * @param opts.names        { scene, char, prop } → 显示名；opts.constraints 全局约束
 */
export function exportPack(
  board,
  script,
  { imageExists = () => false, sheetExists = () => false, dir = '.', protocol = 'h3', names = {}, constraints = [] } = {},
) {
  const prefix = dir === '.' ? '' : `${dir}/`;
  const expanded = expandScript(script);
  const files = [];
  const manifest = [];
  const copies = [];
  let missingTotal = 0;
  for (const ep of board?.episodes ?? []) {
    for (const seg of ep?.segments ?? []) {
      if (protocol === 'seedance') {
        const scene = expanded.get(ep.ep)?.scenes?.[seg.sceneIndex - 1] ?? null;
        const image = (kind, rel) => (kind === 'frame' && imageExists(`${prefix}${rel}`) ? rel : null);
        const { prompt, refs } = seedancePrompt(seg, { scene, names, image, constraints });
        const attachments = refs.map((r, i) => {
          const path = r.kind === 'frame' ? `${prefix}${r.file}` : `${prefix}${seg.id}/ref-${i + 1}.png`;
          const present = r.kind === 'frame' ? imageExists(path) : sheetExists(r.file);
          if (r.kind === 'sheet' && present) copies.push({ file: r.file, to: path });
          return { ref: `@图片${i + 1}`, label: r.label, kind: r.kind, path, source: r.file, present };
        });
        const missing = attachments.filter((a) => !a.present).map((a) => a.path);
        missingTotal += missing.length;
        const head = attachments.length
          ? attachments.map((a) => `- ${a.ref} = ${a.label} → ${a.path.slice(prefix.length + seg.id.length + 1)}${a.present ? '' : '（缺）'}`).join('\n')
          : '- （无附件）';
        const md = `# ${seg.id} · Seedance 提示词\n\n附件按 @图片 编号依次上传：\n\n${head}\n\n视觉风格（画风层）在提交时附加，本文不含。总时长由接口参数控制，正文不写秒数。\n\n---\n\n${prompt}\n`;
        files.push({ path: `${prefix}${seg.id}/seedance.md`, content: md });
        manifest.push({ segment: seg.id, seconds: segSeconds(seg), cuts: (seg.cuts ?? []).length, prompt: `${prefix}${seg.id}/seedance.md`, attachments, missing });
        continue;
      }
      // prompt.md 头部先说清哪个文件是首帧、每张图钉在第几秒——
      // 分隔线以下是 h3Prompt 原样，整段复制就能用
      const starts = cutStarts(seg.cuts);
      const mapping = (seg.cuts ?? [])
        .map((_, i) => `- Picture ${i + 1} = f${i + 1}.png${i === 0 ? '（**首帧**，钉 0.00 秒）' : `（钉 ${starts[i].toFixed(2)} 秒）`}`)
        .join('\n');
      const promptMd = `# ${seg.id} · H3 提示词\n\n首帧 = **f1.png**。图片按 Picture 序号挂载：\n\n${mapping}\n\n---\n\n${seg.h3Prompt ?? ''}\n`;
      files.push({ path: `${prefix}${seg.id}/prompt.md`, content: promptMd });
      const pictures = (seg.cuts ?? []).map((_, i) => `${prefix}${seg.id}/f${i + 1}.png`);
      const missing = pictures.filter((rel) => !imageExists(rel));
      missingTotal += missing.length;
      manifest.push({
        segment: seg.id,
        seconds: segSeconds(seg),
        cuts: (seg.cuts ?? []).length,
        cutStarts: cutStarts(seg.cuts),
        prompt: `${prefix}${seg.id}/prompt.md`,
        pictures,
        missing,
      });
    }
  }
  const manifestName = protocol === 'seedance' ? 'seedance-manifest.json' : 'manifest.json';
  files.push({ path: `${prefix}${manifestName}`, content: JSON.stringify(manifest, null, 2) + '\n' });
  return { files, manifest, missingTotal, copies };
}

/* ------------------------------------------------------------------ */
/* slug                                                                */
/* ------------------------------------------------------------------ */

export function slug(name) {
  const cleaned = String(name)
    .trim()
    .replace(/[\s/\\:*?"<>|·]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'storyboard';
}

/* ------------------------------------------------------------------ */
/* render — 界面文案                                                    */
/* ------------------------------------------------------------------ */

/*
 * 界面文案表：内置 zh / en 两套。语言优先级 --lang > JSON 顶层 lang 字段 > 'zh'，
 * 经 ctx.lang 传给渲染器。只管报告界面标签——与 promptLang（H3 提示词语言）
 * 互相独立：界面切英文不改提示词，提示词切中文不改界面。
 * 数据（H3 提示词、画面摘要、台词、质量门 detail）不在此表，原样透传。
 */
/* 门标签与「跳过」提示的英文映射：质量门面板是报告的一部分，出英文报告时
 * 这里做展示层翻译——gateReport 的逻辑与中文诊断文案一行不动（CLI 仍是中文）。
 * 动态阈值由门自己算，映射里只写固定语义；未命中的 id 回落到原标签。 */
const GATE_LABELS_EN = {
  'coverage': 'Every script beat claimed exactly once, in order, contiguous (cut level)',
  'segment-cap': 'Each segment 0 < total ≤ {1}s (the single-generation cap)',
  'cut-length': 'Every cut {0}–{1}s — the short-drama attention rhythm',
  'dialogue-fit': 'Dialogue of the claimed beats fits within the cut duration',
  'ep-duration': 'Episode total within ±{0}% of the script\'s target',
  'crowd': 'At most {0} characters on screen per cut; more requires a breakdown note',
  'segment-id': 'Segment IDs in E01-01 format, sequential',
  'size-phrase': 'Chinese shot-size word present in the frame prompt',
  'camera-phrase': 'Camera move from the official H3 vocabulary, inside its own [Shot k] passage',
  'h3-structure': 'H3 alignment line derived from the cut structure, audited verbatim; cut times match',
  'h3-dialogue': 'Claimed dialogue appears verbatim inside the H3 <d> blocks',
  'h3-lang': 'Prompt language matches the promptLang setting',
  'frame-prompt': 'Frame prompts are Chinese and non-empty',
  'prompt-no-names': 'Video prompts carry no character names (H3 body and Seedance shot text; frame prompts name characters on purpose)',
  'composition': 'Composition fields complete (blocking per segment; lens / camera position / composition / eyeline / focus / stability per cut)',
  'seedance-shot': 'Seedance shot text is Chinese and non-empty, with no timings, shot numbers, image references or protocol symbols',
  'refs': 'Scenes / characters / props audited against the script',
  'shot-recipe': 'Referenced recipes exist, their must-phrases are in the frame prompt, multi-cut recipes run long enough',
};
const GATE_SKIPS_EN = {
    '未提供 outline.json，本门跳过（视为通过）': 'outline.json not provided — gate skipped (treated as passing)',
    '未提供 art.json，本门跳过（视为通过）': 'art.json not provided — gate skipped (treated as passing)',
    '未提供 script.json，本门跳过（视为通过）': 'script.json not provided — gate skipped (treated as passing)',
    '未提供 outline/cast，本门跳过（视为通过）': 'outline/cast not provided — gate skipped (treated as passing)',
    '未提供 cast.json，本门跳过（视为通过）': 'cast.json not provided — gate skipped (treated as passing)',
    '未挂载配方卡库（--shots <卡片目录>），本门跳过（视为通过）': 'no recipe card library mounted (--shots <cards dir>) — gate skipped (treated as passing)',
    '本批分镜没有引用配方': 'no cut in this batch references a recipe',
};
/** 报告里的门文案：英文界面取映射，未命中或中文界面回落原文。 */
const gateText = (g, lang) => {
  if (lang !== 'en') return { label: g.label, detail: g.detail };
  const en = GATE_LABELS_EN[g.id];
  // 阈值仍由门自己算：把中文标签里出现的数字按序填进 {0} {1}
  const nums = String(g.label).match(/\d+(?:\.\d+)?/g) ?? [];
  const label = en ? en.replace(/\{(\d)\}/g, (m, i) => nums[Number(i)] ?? m) : g.label;
  return { label, detail: GATE_SKIPS_EN[g.detail] ?? g.detail };
};

const I18N = {
  zh: {
    langCode: 'zh',
    kicker: '分镜',
    docTitle: (s, a, b) => `${s} · 分镜${a === b ? `（第 ${a} 集）` : `（第 ${a}–${b} 集）`}`,
    epRange: (a, b) => (a === b ? `第 ${a} 集` : `第 ${a}–${b} 集`),
    exportJson: '导出 JSON',
    gatesPass: '全部通过',
    gatesFail: (n) => `${n} 项未过`,
    gatePill: (okN, total) => `质量门 ${okN} / ${total}`,
    kpi: {
      segments: '生成段', segmentsSub: (cap) => `一段一次调用，上限 ${cap} 秒`,
      cuts: '分镜', cutsSub: (avg) => `平均 ${avg} 秒一切`,
      time: '预估总时长', timeSub: (t) => `目标 ${t}`,
      batches: '生成批次', batchesSub: '同场景同光照共用环境参考图',
      lines: '台词段', linesSub: '其余是纯画面段',
    },
    secRhythm: '分镜节奏带',
    secSegments: '分集分镜表',
    secBatches: '生成批次单',
    secDialogue: '配音对齐单',
    secGates: '质量门',
    rhythmNote: '粗分隔 = 生成段边界 · 段宽 = 分镜时长占比 · 颜色越深景别越近',
    segmentsNote: '一段 = 一次生成：主分镜图钉 0.00 秒，子分镜图钉各自切点',
    batchesNote: '自动汇总 · 同批段共用同一张环境参考图',
    dialogueNote: '自动汇总 · TTS 音频对到哪一段的第几切',
    epHead: (nSeg, nCut, total, target) => `${nSeg} 段 ${nCut} 切 · 共 ${total} 秒 / 目标 ${target} 秒`,
    segHead: (total, n) => `${total} 秒 · ${n} 个分镜`,
    secBadge: (secs, n) => `${secs}s · ${n} 切`,
    rhythmVal: (nSeg, nCut, secs) => `${nSeg} 段 ${nCut} 切 · ${secs}s`,
    beatsLabel: (s, from, to) => `第 ${s} 场 ${from === to ? `第 ${from} 拍` : `第 ${from}–${to} 拍`}`,
    masterLabel: '主分镜图',
    subLabel: (i) => `子分镜 ${i}`,
    frameMissing: (i) => `#${i} 未生成`,
    framePrompt: '分镜图提示词',
    h3Prompt: 'H3 提示词',
    h3Section: 'H3 视频提示词',
    seedancePrompt: 'Seedance 提示词',
    seedanceSection: 'Seedance 视频提示词',
    blockingLabel: '走位',
    compLine: (c) => [c.lens, c.cameraPosition, c.composition, c.eyeline && `视线 ${c.eyeline}`, c.focus && `焦点 ${c.focus}`, STABILITY[c.stability] ?? c.stability].filter(Boolean).join(' · '),
    showSegs: '▾ 展开全部段',
    hideSegs: '▴ 收起',
    copy: '复制', copied: '已复制', copyFailed: '复制失败',
    dialogueCols: ['段 · 切', '说话人', '台词', '台词秒数'],
    cutCols: ['切', '起点', '秒', '景别', '运镜', '配方', '画面', '人物'],
    batchCols: ['场景', '光照', '段', '需要的角色', '道具'],
    atSec: (t) => `${t.toFixed(2)}s 起`,
    batchLabel: (num) => `批次 ${num}`,
    batchNeed: (chars, props) => `需要：${chars.length ? chars.join('、') + ' 的角色设定图' : '无角色（空镜）'}${props.length ? ' · ' + props.join('、') : ''}`,
    voiceOver: '画外音',
    listSep: '、',
    sizeName: (size) => SHOT_SIZES[size]?.zh ?? size,
    cameraLabel: (camera) => `${camera}（${CAMERA_MOVES[camera] ?? '?'}）`,
    recipeNone: '—',
    recipeName: (card, id) => card?.name ?? id,
    recipeDrift: (sizes, cameras) =>
      `配方建议${[sizes.length ? `景别 ${sizes.join(' / ')}` : '', cameras.length ? `运镜 ${cameras.join(' / ')}` : ''].filter(Boolean).join(' · ')}——只提示不设门`,
    recipeHint: (n) => `ℹ️ ${n} 处分镜的景别／运镜偏离了配方建议——配方是语汇不是法条，只提示不设门（报告的「配方」列有 ≠ 标记）`,
    speakerLine: (name, text) => `${name}：「${text}」`,
    withLighting: (name, lighting) => (lighting ? `${name}（${lighting}）` : name),
    fmtMin: (sec) => `${Math.floor(sec / 60)} 分 ${Math.round(sec % 60)} 秒`,
    unitSeg: '段',
    unitCut: '切',
    colophon: '分镜由模型依据剧本切分：段 = 一次生成（≤15 秒），分镜 = 段内 2–5 秒的剪切，每个分镜一张关键帧图。对齐指令、切点时刻、台词、提示词纪律全部由脚本确定性对账。分镜图出图走 codex，环境与角色设定图当参考图。',
  },
  en: {
    langCode: 'en',
    kicker: 'Storyboard',
    docTitle: (s, a, b) => `${s} · Storyboard (${a === b ? `Episode ${a}` : `Episodes ${a}–${b}`})`,
    epRange: (a, b) => (a === b ? `Episode ${a}` : `Episodes ${a}–${b}`),
    exportJson: 'Export JSON',
    gatesPass: 'All passed',
    gatesFail: (n) => `${n} failed`,
    gatePill: (okN, total) => `Quality gates ${okN} / ${total}`,
    kpi: {
      segments: 'Segments', segmentsSub: (cap) => `one generation call each, capped at ${cap}s`,
      cuts: 'Cuts', cutsSub: (avg) => `${avg}s per cut on average`,
      time: 'Estimated total', timeSub: (t) => `target ${t}`,
      batches: 'Generation batches', batchesSub: 'same scene + lighting share one environment reference',
      lines: 'Dialogue segments', linesSub: 'the rest are picture-only',
    },
    secRhythm: 'Cut rhythm strip',
    secSegments: 'Segment cards',
    secBatches: 'Generation batches',
    secDialogue: 'Audio alignment',
    secGates: 'Quality gates',
    rhythmNote: 'thick separators = segment boundaries · slice width = cut duration share · darker = closer shot size',
    segmentsNote: 'one segment = one generation: the master frame pins 0.00s, sub-frames pin their own cut marks',
    batchesNote: 'auto-computed · segments in a batch share one environment reference image',
    dialogueNote: 'auto-computed · which segment and cut each TTS clip lands on',
    epHead: (nSeg, nCut, total, target) => `${nSeg} segments ${nCut} cuts · ${total}s total / ${target}s target`,
    segHead: (total, n) => `${total}s · ${n} cuts`,
    secBadge: (secs, n) => `${secs}s · ${n} cuts`,
    rhythmVal: (nSeg, nCut, secs) => `${nSeg} seg ${nCut} cuts · ${secs}s`,
    beatsLabel: (s, from, to) => `Scene ${s} · ${from === to ? `beat ${from}` : `beats ${from}–${to}`}`,
    masterLabel: 'master frame',
    subLabel: (i) => `sub-frame ${i}`,
    frameMissing: (i) => `#${i} not generated`,
    framePrompt: 'Frame prompt',
    h3Prompt: 'H3 prompt',
    h3Section: 'H3 video prompt',
    seedancePrompt: 'Seedance prompt',
    seedanceSection: 'Seedance video prompt',
    blockingLabel: 'Blocking',
    compLine: (c) => [c.lens, c.cameraPosition, c.composition, c.eyeline && `eyeline ${c.eyeline}`, c.focus && `focus ${c.focus}`, ({ stable: 'stable', 'slight-shake': 'slight shake', handheld: 'handheld' })[c.stability] ?? c.stability].filter(Boolean).join(' · '),
    showSegs: '▾ Show all segments',
    hideSegs: '▴ Collapse',
    copy: 'Copy', copied: 'Copied', copyFailed: 'Copy failed',
    dialogueCols: ['Segment · cut', 'Speaker', 'Line', 'Seconds'],
    cutCols: ['Cut', 'Start', 'Sec', 'Size', 'Camera', 'Recipe', 'Picture', 'Characters'],
    batchCols: ['Scene', 'Lighting', 'Segments', 'Characters needed', 'Props'],
    atSec: (t) => `from ${t.toFixed(2)}s`,
    batchLabel: (num) => `Batch ${num}`,
    batchNeed: (chars, props) => `Needs: ${chars.length ? `character sheets for ${chars.join(', ')}` : 'no characters (empty shot)'}${props.length ? ' · ' + props.join(', ') : ''}`,
    voiceOver: 'Voice-over',
    listSep: ', ',
    sizeName: (size) => SHOT_SIZES[size]?.phrase ?? size,
    cameraLabel: (camera) => camera,
    recipeNone: '—',
    recipeName: (card, id) => card?.name_en ?? card?.name ?? id,
    recipeDrift: (sizes, cameras) =>
      `Recipe suggests ${[sizes.length ? `size ${sizes.join(' / ')}` : '', cameras.length ? `camera ${cameras.join(' / ')}` : ''].filter(Boolean).join(' · ')} — advisory, not gated`,
    recipeHint: (n) => `ℹ️ ${n} cut(s) deviate from their recipe's suggested size / camera — a recipe is vocabulary, not law: advisory only (see the ≠ marks in the Recipe column)`,
    speakerLine: (name, text) => `${name}: “${text}”`,
    withLighting: (name, lighting) => (lighting ? `${name} (${lighting})` : name),
    fmtMin: (sec) => `${Math.floor(sec / 60)} min ${Math.round(sec % 60)} s`,
    unitSeg: 'seg',
    unitCut: 'cuts',
    colophon: 'Cut by the model from the script: a segment = one generation call (≤15s), a cut = a 2–5s edit inside it, one keyframe per cut. Alignment lines, cut marks, dialogue and prompt discipline are all audited deterministically by the script. Frames are generated through codex with the scene and character sheets as references.',
  },
};

const tOf = (lang) => {
  if (lang && !I18N[lang]) throw new Error('报告界面语言目前内置 zh / en');
  return I18N[lang ?? 'zh'];
};

/* ------------------------------------------------------------------ */
/* render 公共                                                          */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function namer(ctx = {}, t = I18N.zh) {
  const charName = new Map((ctx.outline?.characters ?? []).map((c) => [c.id, c.name]));
  const sceneName = new Map((ctx.art?.scenes ?? []).map((s) => [s.id, s.name]));
  const propName = new Map((ctx.art?.props ?? []).map((p) => [p.id, p.name]));
  return {
    char: (id) => (id === 'VO' ? t.voiceOver : charName.get(id) ?? id),
    scene: (id) => sceneName.get(id) ?? id,
    prop: (id) => propName.get(id) ?? id,
  };
}

/**
 * cut 的「配方」列：卡名 + 偏离建议景别／运镜时的 ≠ 标记。
 * 偏离只提示不设门——配方是语汇不是法条（理由见 recipeDrift 上方注释）。
 */
function cutRecipe(cut, recipes, t) {
  const id = typeof cut?.recipe === 'string' ? cut.recipe : '';
  if (!id) return null;
  const card = recipes?.get(id) ?? null;
  const off = recipeDrift(cut, card);
  return {
    name: t.recipeName(card, id),
    drift: off.sizes.length || off.cameras.length ? t.recipeDrift(off.sizes, off.cameras) : '',
  };
}

/** 分镜认领的节拍 → 画面摘要（动作原文 + 台词行），模型不重写。 */
function cutBeats(cut, scene) {
  if (!scene) return [];
  const [from, to] = cut.beats ?? [];
  return scene.beats.slice((from ?? 1) - 1, to ?? 0);
}

/* ------------------------------------------------------------------ */
/* render — markdown                                                   */
/* ------------------------------------------------------------------ */

const mdRow = (cells) => `| ${cells.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`;
const mdHead = (cols) => [mdRow(cols), mdRow(cols.map(() => '---'))].join('\n');

export function renderMarkdown(board, ctx = {}) {
  const t = tOf(ctx.lang ?? board?.lang);
  const n = namer(ctx, t);
  const expanded = expandScript(ctx.script);
  const stats = computeStats(board, ctx.script);
  const eps = board.episodes;
  const out = [`# ${t.docTitle(board.source, eps[0]?.ep, eps[eps.length - 1]?.ep)}`, ''];

  for (const [i, ep] of eps.entries()) {
    const st = stats.episodes[i];
    const sEp = expanded.get(ep.ep);
    out.push(`## E${String(ep.ep).padStart(2, '0')}`, '', `> ${t.epHead(st.segments, st.cuts, st.totalSeconds, st.target)}`, '');
    for (const seg of ep.segments) {
      const scene = sEp?.scenes?.[seg.sceneIndex - 1];
      out.push(`### ${seg.id} · ${scene ? t.withLighting(n.scene(scene.sceneId), scene.lighting) : '?'} · ${t.segHead(segSeconds(seg), seg.cuts.length)}`, '');
      if (seg.blocking) out.push(`> ${t.blockingLabel}：${seg.blocking}`, '');
      out.push(mdHead(t.cutCols));
      const starts = cutStarts(seg.cuts);
      seg.cuts.forEach((cut, ci) => {
        const summary = cutBeats(cut, scene)
          .map((b) => (b.kind === 'line' ? t.speakerLine(n.char(b.speaker), b.text) : b.text))
          .join(' ');
        // md 没有 title 属性，偏离的建议值直接写在格子里
        const rc = cutRecipe(cut, ctx.recipes, t);
        out.push(mdRow([
          `#${ci + 1}`, `${starts[ci].toFixed(2)}s`, cut.seconds,
          t.sizeName(cut.size), t.cameraLabel(cut.camera),
          rc ? `${rc.name}${rc.drift ? ` ≠（${rc.drift}）` : ''}` : t.recipeNone,
          summary, (cut.characters ?? []).map(n.char).join(t.listSep),
        ]));
      });
      const sd = seedancePrompt(seg, { scene, names: n, image: ctx.image ?? null, constraints: ctx.constraints ?? [] });
      out.push('', `**${t.h3Section}**`, '', '```text', seg.h3Prompt ?? '', '```', '');
      out.push(`**${t.seedanceSection}**`, '', '```text', sd.prompt, '```', '');
    }
  }

  out.push(`## ${t.secBatches}`, '', mdHead(t.batchCols));
  for (const b of stats.batches) {
    out.push(mdRow([`${b.sceneId} ${n.scene(b.sceneId)}`, b.lighting, b.segments.join(t.listSep), b.characters.map(n.char).join(t.listSep), b.props.map(n.prop).join(t.listSep)]));
  }
  out.push('', `## ${t.secDialogue}`, '', mdHead(t.dialogueCols));
  for (const d of stats.dialogue) out.push(mdRow([`${d.segment}#${d.cut}`, n.char(d.speaker), d.line, d.seconds]));
  out.push('');
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* render — html                                                       */
/* ------------------------------------------------------------------ */
/*
 * 与另外四份报告同一套视觉语言。设计约定见 references/report-style.md。
 * 图片是用户在下游出好的素材，位置由 CLI 注入的 ctx.image(kind, rel) 决定：
 * kind 是 'frame'（<段号>/f<切序>.png）或 'sheet'（<场景 slug>-sheet.png），
 * 返回 src 或 null。有就内嵌显示 + 点击放大，没有就显示占位——不猜、不骗。
 */

function embedDoc(doc) {
  return JSON.stringify(doc).replace(/</g, '\\u003c');
}

/*
 * 分镜图位的画幅。图在下游出，画幅也由下游按这部剧定（竖屏 9:16 / 横屏 16:9，见
 * references/frame.md）；图位要是写死 16:9，竖图就被 object-fit:cover 裁成一条横带——
 * 看报告的人会以为构图出了问题。认的顺序与下游应用一致：
 *   1. 顶层 `_meta.orientation`——下游应用在切镜那一刻明写的，最权威；
 *   2. 每切 frame 末尾的画幅标签（下游贴的 `…, 9:16`），数多的那个——老分镜没记 _meta 也认得出；
 *   3. 都认不出就是 16:9，这个 skill 的原生画幅。
 * 只管分镜图：批次卡里的场景设定图（`.bimg`）一律按 16:9 出，不跟剧的画幅走。
 */
const ORIENTATION_TAG = {
  portrait: '9:16', vertical: '9:16', v: '9:16', 竖: '9:16', 竖屏: '9:16', '9:16': '9:16',
  landscape: '16:9', horizontal: '16:9', h: '16:9', 横: '16:9', 横屏: '16:9', '16:9': '16:9',
};

function boardAspect(board) {
  const declared = ORIENTATION_TAG[String(board?._meta?.orientation ?? '').trim().toLowerCase()];
  if (declared) return declared;
  let portrait = 0;
  let landscape = 0;
  for (const ep of board?.episodes ?? []) {
    for (const seg of ep.segments ?? []) {
      for (const cut of seg.cuts ?? []) {
        const f = String(cut.frame ?? '');
        if (/(^|[\s,])9:16\s*$/.test(f)) portrait++;
        else if (/(^|[\s,])16:9\s*$/.test(f)) landscape++;
      }
    }
  }
  return portrait > landscape ? '9:16' : '16:9';
}

// 竖屏才追加；横屏一个字节都不多，报告与改动前逐字节一致。主图收窄居中——
// 整卡宽的 9:16 一张就有一屏多高，子分镜条四格竖缩略图照旧铺满
const PORTRAIT_FRAME_CSS = `
/* 竖屏 9:16：分镜图位跟着画幅改竖（场景设定图 .bimg 仍是 16:9） */
.frame,.subf{aspect-ratio:9/16}
img.frame{width:min(100%,300px);margin:0 auto}`;

export function renderHtml(board, ctx = {}) {
  const lang = ctx.lang ?? board?.lang ?? 'zh';
  const t = tOf(lang);
  const n = namer(ctx, t);
  const expanded = expandScript(ctx.script);
  const stats = computeStats(board, ctx.script);
  const gates = gateReport(board, ctx);
  const failed = gates.filter((g) => !g.ok);
  const eps = board.episodes;
  const params = stats.params;
  const fmtMin = t.fmtMin;
  // 分镜图位跟着这部剧的画幅走（见 boardAspect）；横屏不插任何东西
  const frameAspectCss = boardAspect(board) === '9:16' ? PORTRAIT_FRAME_CSS : '';

  const SIZE_ALPHA = { 'extreme-wide': 0.25, wide: 0.4, medium: 0.58, close: 0.78, 'extreme-close': 1 };

  // ---- 01 分镜节奏带：段是粗分隔的组，组内每个分镜一段色块 ----
  const rhythmRows = eps
    .map((ep, i) => {
      const st = stats.episodes[i];
      const groups = ep.segments
        .map((seg) => {
          const segs = seg.cuts
            .map((cut, ci) => {
              const w = st.totalSeconds ? (cut.seconds / st.totalSeconds) * 100 : 0;
              const alpha = SIZE_ALPHA[cut.size] ?? 0.5;
              return `<a class="seg" href="#seg-${esc(seg.id)}" style="width:${r1(w)}%;background:rgba(138,51,36,${alpha})" title="${esc(`${seg.id}#${ci + 1} · ${cut.seconds}s · ${t.sizeName(cut.size)} · ${cut.camera}`)}"></a>`;
            })
            .join('');
          const gw = st.totalSeconds ? (segSeconds(seg) / st.totalSeconds) * 100 : 0;
          return `<span class="rseg" style="width:${r1(gw)}%">${segs}</span>`;
        })
        .join('');
      return `<div class="rrow"><span class="rep">E${String(ep.ep).padStart(2, '0')}</span><div class="rtrack">${groups}</div><span class="rval">${esc(t.rhythmVal(st.segments, st.cuts, st.totalSeconds))}</span></div>`;
    })
    .join('\n');
  const rhythmLegend = Object.keys(SHOT_SIZES)
    .map((k) => `<i><span class="sw" style="background:rgba(138,51,36,${SIZE_ALPHA[k]})"></span>${esc(t.sizeName(k))}</i>`)
    .join('');

  // ---- 02 分集分镜表：段卡（主分镜图 + 子分镜条 + 分镜行） ----
  const epBlocks = eps
    .map((ep, i) => {
      const st = stats.episodes[i];
      const sEp = expanded.get(ep.ep);
      const cards = ep.segments
        .map((seg) => {
          const scene = sEp?.scenes?.[seg.sceneIndex - 1];
          const starts = cutStarts(seg.cuts);
          const frame = (ci) => (ctx.image ? ctx.image('frame', `${seg.id}/f${ci + 1}.png`) : null);
          const has = (ci) => frame(ci) != null;

          // 主分镜图区：图出全的段保留原 master+subs 层级；有缺图的段每切一格——
          // 有图的格显示原图，无图的格显示整宽提示词卡 + 复制按钮（混合情况按格判断）
          const hasAll = seg.cuts.every((_, ci) => has(ci));
          let master, subs;
          if (hasAll) {
            master = `<img class="frame" src="${esc(frame(0))}" alt="${esc(`${seg.id}#1`)}" loading="lazy">`;
            subs = seg.cuts.length > 1
              ? `<div class="subs">${seg.cuts
                  .slice(1)
                  .map((cut, ci) => `<img class="subf" src="${esc(frame(ci + 1))}" alt="${esc(`${seg.id}#${ci + 2}`)}" loading="lazy">`)
                  .join('')}</div>`
              : '';
          } else {
            master = `<div class="fquad">${seg.cuts
              .map((cut, ci) => {
                const label = ci === 0 ? t.masterLabel : t.subLabel(ci + 1);
                const body = has(ci)
                  ? `<img class="frame" src="${esc(frame(ci))}" alt="${esc(`${seg.id}#${ci + 1}`)}" loading="lazy">`
                  : `<div class="frame ph fcell"><div class="fcell-h"><b>${esc(`${label} · ${t.frameMissing(ci + 1)}`)}</b><button class="copy mini" data-copy="${esc(cut.frame ?? '')}">${esc(t.copy)}</button></div><span class="fprompt">${esc(cut.frame ?? '')}</span></div>`;
                return body;
              })
              .join('\n')}</div>`;
            subs = '';
          }

          const cutRows = seg.cuts
            .map((cut, ci) => {
              const beats = cutBeats(cut, scene);
              const summary = beats
                .map((b) =>
                  b.kind === 'line'
                    ? `<p class="sline"><b>${esc(n.char(b.speaker))}</b>${esc(b.text)}</p>`
                    : `<p class="sact">${esc(b.text)}</p>`,
                )
                .join('');
              // 「配方」列：偏离建议景别／运镜的加 ≠ 上标，建议值写进 title——提示而已，不是门
              const rc = cutRecipe(cut, ctx.recipes, t);
              return `<li class="cut">
  <div class="cut-h">
    <b>#${ci + 1}</b>
    <span class="cut-t">${esc(t.atSec(starts[ci]))} · ${cut.seconds}s</span>
    <span class="cut-sc">${esc(t.sizeName(cut.size))} · ${esc(cut.camera)}</span>
    ${rc ? `<span class="cut-rc">${esc(rc.name)}${rc.drift ? `<sup title="${esc(rc.drift)}">≠</sup>` : ''}</span>` : ''}
    ${(cut.characters ?? []).map((id) => `<span class="chip">${esc(n.char(id))}</span>`).join('')}
    ${(cut.props ?? []).map((id) => `<span class="chip prop">${esc(n.prop(id))}</span>`).join('')}
    <button class="copy mini" data-copy="${esc(cut.frame ?? '')}">${esc(t.framePrompt)}</button>
  </div>
  ${t.compLine(cut) ? `<p class="scomp">${esc(t.compLine(cut))}</p>` : ''}
  ${summary}
</li>`;
            })
            .join('\n');

          return `<article class="segcard" id="seg-${esc(seg.id)}">
  <header class="seg-h">
    <b>${esc(seg.id)}</b>
    <span class="sec-badge">${esc(t.secBadge(segSeconds(seg), seg.cuts.length))}</span>
    <span class="chip">${esc(scene ? `${scene.sceneId} ${n.scene(scene.sceneId)}` : '?')}</span>
    ${scene?.lighting ? `<span class="chip lite">${esc(scene.lighting)}</span>` : ''}
    <span class="beatsref">${esc(t.beatsLabel(seg.sceneIndex, seg.cuts[0]?.beats?.[0], seg.cuts[seg.cuts.length - 1]?.beats?.[1]))}</span>
  </header>
  ${master}
  ${subs}
  ${seg.blocking ? `<p class="seg-block"><b>${esc(t.blockingLabel)}</b>${esc(seg.blocking)}</p>` : ''}
  <div class="duo">
    <ol class="cuts">
${cutRows}
    </ol>
    <div class="ppanel">
      <div class="pp-h">
        <span class="ptabs"><button class="ptab on" data-i="0">${esc(t.h3Prompt)}</button><button class="ptab" data-i="1">${esc(t.seedancePrompt)}</button></span>
        <button class="copy" data-copy="${esc(seg.h3Prompt ?? '')}">${esc(t.copy)}</button>
      </div>
      <pre class="pp on">${esc(seg.h3Prompt ?? '')}</pre>
      <pre class="pp">${esc(seedancePrompt(seg, { scene, names: n, image: ctx.image ?? null, constraints: ctx.constraints ?? [] }).prompt)}</pre>
    </div>
  </div>
  ${seg.note ? `<p class="seg-note">${esc(seg.note)}</p>` : ''}
</article>`;
        })
        .join('\n');
      return `<section class="ep" id="ep-${ep.ep}">
  <header class="ep-h">
    <span class="ep-n">E${String(ep.ep).padStart(2, '0')}</span>
    <span class="ep-est">${esc(t.epHead(st.segments, st.cuts, st.totalSeconds, st.target))}</span>
  </header>
  <div class="shots clip">
    <div class="seggrid">
${cards}
    </div>
  </div>
  <button class="shmore">${esc(t.showSegs)}</button>
</section>`;
    })
    .join('\n');

  // ---- 03 生成批次单 ----
  const batchCards = stats.batches
    .map((b, i) => {
      const sheet = ctx.image ? ctx.image('sheet', `${slug(n.scene(b.sceneId))}-sheet.png`) : null;
      const hasSheet = sheet != null;
      return `<article class="batch">
  ${hasSheet ? `<img class="bimg" src="${esc(sheet)}" alt="${esc(n.scene(b.sceneId))}" loading="lazy">` : ''}
  <header class="batch-h"><b>${esc(t.batchLabel(String(i + 1).padStart(2, '0')))}</b><span class="chip">${esc(`${b.sceneId} ${n.scene(b.sceneId)}`)}</span>${b.lighting ? `<span class="chip lite">${esc(b.lighting)}</span>` : ''}</header>
  <div class="batch-shots">${b.segments.map((s) => `<a class="chip mono" href="#seg-${esc(s)}">${esc(s)}</a>`).join('')}</div>
  <p class="batch-need">${esc(t.batchNeed(b.characters.map(n.char), b.props.map(n.prop)))}</p>
</article>`;
    })
    .join('\n');

  // ---- 04 配音对齐单 ----
  const dlgRows = stats.dialogue
    .map((d) => `<tr><td><a href="#seg-${esc(d.segment)}">${esc(d.segment)}</a> #${d.cut}</td><td>${esc(n.char(d.speaker))}</td><td class="serif">${esc(d.line)}</td><td>${d.seconds}</td></tr>`)
    .join('\n');

  const gateList = `<ul class="gate">
  ${gates
    .map(
      // 通过的门只有跳过说明与「没有引用配方」这类备注带 detail——都要显示出来，不静默
      (g) => `<li class="${g.ok ? 'ok' : 'bad'}"><span class="m">${g.ok ? '✓' : '✗'}</span><span>${esc(gateText(g, t.langCode).label)}${
        g.detail ? `<small>${esc(gateText(g, t.langCode).detail)}</small>` : ''
      }</span></li>`,
    )
    .join('\n  ')}
</ul>`;

  return `<!doctype html>
<html lang="${esc(lang)}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.docTitle(board.source, eps[0]?.ep, eps[eps.length - 1]?.ep))}</title>
<style>
:root{
  --paper:#eceded; --panel:#f5f6f5; --side:#e4e6e3; --ink:#191d21; --ink-2:#5b636a; --ink-3:#8c9298;
  --rule:#d2d5d0; --rule-2:#c2c6bf; --seal:#8a3324; --seal-2:#c56a4e; --seal-soft:#8a332412; --ok:#3d6b4f;
  --serif:"Songti SC","STSong","Source Han Serif SC","Noto Serif CJK SC",Georgia,serif;
  --sans:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.7 var(--sans);-webkit-font-smoothing:antialiased}
.page{max-width:1600px;margin:0 auto;padding:24px 32px 90px}
h1,h2,h3{margin:0;font-weight:400}

.hd{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:12px}
.hd h1{font:400 28px/1.1 var(--serif);letter-spacing:.06em}
.hd .sub{font-size:13px;color:var(--ink-2)}
.hd .right{margin-left:auto;display:flex;align-items:center;gap:10px}
.gatepill{display:inline-flex;align-items:center;gap:6px;font:500 12px/1 var(--sans);border-radius:99px;padding:6px 12px}
.gatepill.pass{color:var(--ok);border:1px solid var(--ok)}
.gatepill.fail{color:var(--seal);border:1px solid var(--seal);background:var(--seal-soft)}
.expo{font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--panel);
  border:1px solid var(--rule-2);border-radius:2px;padding:7px 11px;cursor:pointer;transition:.15s}
.expo:hover{border-color:var(--seal);color:var(--seal)}
.expo:focus-visible{outline:2px solid var(--seal);outline-offset:2px}

.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:18px 0 6px}
@media(max-width:980px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:11px 14px 9px}
.kpi .l{font:500 10px/1 var(--sans);letter-spacing:.18em;color:var(--ink-3)}
.kpi .v{font:400 28px/1.15 var(--serif);margin-top:5px}
.kpi .v small{font:400 14px var(--serif);color:var(--ink-2)}
.kpi .d{font-size:11px;color:var(--ink-2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kpi.accent{border-top:2px solid var(--seal)}
.galert{margin:14px 0 0;border:1px solid var(--seal);background:var(--seal-soft);border-radius:2px;
  padding:10px 14px;font-size:13px}
.galert b{color:var(--seal)}
.galert span{display:block;font-size:12px;color:var(--ink-2)}

section.top-sec{margin-top:34px}
.sec-h{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--rule-2);padding-bottom:8px;margin-bottom:16px}
.sec-h .no{font:500 12px/1 var(--mono);color:var(--seal)}
.sec-h h2{font:400 20px/1.2 var(--serif);letter-spacing:.05em}
.sec-h .note{margin-left:auto;font-size:12px;color:var(--ink-3)}

/* 01 cut rhythm strip */
.rhythm{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:16px 20px 10px}
.rrow{display:grid;grid-template-columns:44px minmax(0,1fr) 150px;gap:12px;align-items:center;padding:5px 0}
.rep{font:500 12px/1 var(--mono);color:var(--ink-2)}
.rtrack{display:flex;height:22px;border:1px solid var(--rule);border-radius:2px;overflow:hidden;background:var(--paper)}
.rseg{display:flex;border-right:2px solid var(--ink-2)}
.rseg:last-child{border-right:0}
.seg{display:block;border-right:1px solid var(--panel)}
.rseg .seg:last-child{border-right:0}
.seg:hover{outline:2px solid var(--ink);outline-offset:-2px}
.rval{font:500 12px/1.5 var(--sans);color:var(--ink-2)}
.legend{display:flex;gap:16px;font-size:12px;color:var(--ink-2);margin:8px 0 2px;flex-wrap:wrap}
.legend i{font-style:normal;display:inline-flex;align-items:center;gap:6px}
.sw{display:inline-block;width:10px;height:10px;border-radius:2px}

/* 02 segment cards */
.ep{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:18px 22px;margin-bottom:16px}
.ep-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--rule-2);padding-bottom:10px;margin-bottom:14px}
.ep-n{font:400 22px/1 var(--serif);letter-spacing:.04em;color:var(--seal)}
.ep-est{font-size:12.5px;color:var(--ink-2)}
.shots{position:relative}
.shots.clip{max-height:760px;overflow:hidden}
.shots.clip::after{content:'';position:absolute;left:0;right:0;bottom:0;height:80px;
  background:linear-gradient(180deg,transparent,var(--panel));pointer-events:none}
.shmore{display:block;width:100%;margin-top:8px;font:500 11.5px/1 var(--sans);letter-spacing:.06em;
  color:var(--ink-2);background:var(--paper);border:1px solid var(--rule-2);border-radius:2px;
  padding:7px 0;cursor:pointer;transition:.15s}
.shmore:hover{border-color:var(--seal);color:var(--seal)}
.shmore:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
.seggrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
@media(max-width:1100px){.seggrid{grid-template-columns:minmax(0,1fr)}}
.segcard{background:var(--paper);border:1px solid var(--rule);border-radius:2px;padding:12px 14px;display:flex;flex-direction:column;gap:8px}
.seg-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.seg-h b{font:500 14px/1 var(--mono);color:var(--seal)}
.sec-badge{font:500 11px/1 var(--mono);border:1px solid var(--seal);color:var(--seal);border-radius:99px;padding:2px 8px}
.beatsref{margin-left:auto;font-size:10.5px;color:var(--ink-3)}
.frame{width:100%;aspect-ratio:16/9;object-fit:cover;border:1px solid var(--rule-2);border-radius:2px;
  cursor:zoom-in;display:block;background:var(--side)}
.frame.ph{display:flex;flex-direction:column;gap:6px;padding:10px 12px;cursor:default;overflow:hidden}
.frame.ph b{font:500 10px/1 var(--sans);letter-spacing:.14em;color:var(--ink-3)}
.frame.ph span{font:400 10.5px/1.55 var(--mono);color:var(--ink-2);overflow:hidden;display:-webkit-box;
  -webkit-line-clamp:5;-webkit-box-orient:vertical}
.subs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.fquad{display:grid;grid-template-columns:1fr;gap:10px;margin:10px 0}
.fquad .frame.ph{aspect-ratio:auto}
.fquad .fcell{margin:0;min-height:0}
.fcell-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px}
.fcell-h .copy.mini{margin:0;flex:none}
.frame.ph .fprompt{font:400 10.5px/1.4 var(--mono);color:var(--ink-2);white-space:pre-wrap;word-break:break-word;display:block;
  -webkit-line-clamp:none;-webkit-box-orient:vertical;overflow:visible}
.subf{width:100%;aspect-ratio:16/9;object-fit:cover;border:1px solid var(--rule-2);border-radius:2px;
  cursor:zoom-in;display:block;background:var(--side)}
.subf.ph{display:flex;align-items:center;justify-content:center;cursor:default;
  font:500 10px/1 var(--sans);color:var(--ink-3);letter-spacing:.08em}
.duo{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start;border-top:1px solid var(--rule);padding-top:4px}
@media(max-width:900px){.duo{grid-template-columns:minmax(0,1fr)}}
.ppanel{border:1px solid var(--rule);border-radius:2px;background:var(--panel);margin-top:7px}
.pp-h{display:flex;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--rule)}
.pp{display:none;margin:0;padding:9px 12px;font:400 12px/1.8 var(--sans);color:var(--ink);
  white-space:pre-wrap;word-break:break-word;max-height:400px;overflow-y:auto;
  scrollbar-width:thin;scrollbar-color:var(--rule-2) transparent}
.pp.on{display:block}
.pp::-webkit-scrollbar{width:6px}
.pp::-webkit-scrollbar-thumb{background:var(--rule-2);border-radius:3px}
.cuts{margin:0;padding:0;list-style:none}
.cut{padding:7px 0;border-bottom:1px solid var(--rule)}
.cut:first-child{padding-top:11px}
.cut:last-child{border-bottom:0}
.cut-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.cut-h b{font:500 12px/1 var(--mono);color:var(--seal)}
.cut-t{font:500 10.5px/1.6 var(--mono);color:var(--ink-3)}
.cut-sc{font-size:11.5px;color:var(--ink-2)}
.cut-rc{font:400 10.5px/1.6 var(--mono);border:1px dashed var(--rule-2);border-radius:2px;padding:0 6px;color:var(--ink-2)}
.cut-rc sup{color:var(--seal-2);font-weight:700;cursor:help;margin-left:2px}
.cut-h .copy{margin-left:auto;opacity:0;transition:.15s}
.cut:hover .copy{opacity:1}
.cut p{margin:3px 0 0;font-size:12px;line-height:1.6}
.sact{color:var(--ink-2)}
.sline{font-family:var(--serif)}
.sline b{font-weight:500;margin-right:6px;color:var(--seal)}
.chip{font:400 10.5px/1.6 var(--mono);border:1px solid var(--rule-2);border-radius:2px;
  padding:0 6px;background:var(--panel);color:var(--ink-2);text-decoration:none}
.chip.lite{border-color:var(--seal-2);color:var(--seal-2)}
.chip.prop{border-color:var(--seal);color:var(--seal)}
.chip.mono{font-family:var(--mono)}
a.chip:hover{border-color:var(--seal);color:var(--seal)}
.prompts{display:flex;gap:6px}
.seg-note{margin:0;font-size:11px;color:var(--ink-3)}
.seg-block{margin:0;font-size:11.5px;line-height:1.7;color:var(--ink-2)}
.seg-block b{font:500 10.5px/1 var(--sans);letter-spacing:.08em;color:var(--seal);margin-right:8px}
.cut p.scomp{font:400 10.5px/1.6 var(--sans);color:var(--ink-3)}
.ptabs{display:flex;gap:2px;margin-right:auto}
.ptab{font:500 11px/1 var(--sans);letter-spacing:.08em;color:var(--ink-3);background:none;border:0;
  border-bottom:1.5px solid transparent;padding:4px 6px;cursor:pointer}
.ptab.on{color:var(--ink);border-bottom-color:var(--seal)}
.ptab:focus-visible{outline:2px solid var(--seal);outline-offset:2px}${frameAspectCss}

/* 03 generation batches */
.batches{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
@media(max-width:1100px){.batches{grid-template-columns:minmax(0,1fr)}}
.batch{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:14px 18px}
.bimg{width:100%;aspect-ratio:16/9;object-fit:cover;border:1px solid var(--rule-2);border-radius:2px;
  cursor:zoom-in;display:block;margin-bottom:10px}
.batch-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.batch-h b{font:500 13px var(--serif);letter-spacing:.06em}
.batch-shots{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.batch-need{margin:8px 0 0;font-size:12px;color:var(--ink-2)}

/* 04 audio alignment */
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--rule);font-size:13px}
th,td{padding:8px 12px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top}
th{font:500 11px/1 var(--sans);letter-spacing:.1em;color:var(--ink-3);background:var(--side)}
tr:last-child td{border-bottom:0}
td:first-child{font-family:var(--mono);font-size:12px;white-space:nowrap}
td a{color:var(--seal);text-decoration:none}
td.serif{font-family:var(--serif)}

.copy{flex:none;font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--panel);
  border:1px solid var(--rule-2);border-radius:2px;padding:5px 10px;cursor:pointer;transition:.15s}
.copy:hover{border-color:var(--seal);color:var(--seal)}
.copy:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
.copy[data-done]{border-color:var(--seal);color:var(--seal)}
.copy.mini{padding:3px 7px;font-size:10px}
.copy.h3{border-color:var(--seal-2);color:var(--seal-2);width:100%}
.copy.h3:hover,.copy.h3[data-done]{border-color:var(--seal);color:var(--seal)}

.gate{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 28px}
@media(max-width:900px){.gate{grid-template-columns:1fr}}
.gate li{display:flex;gap:8px;padding:5px 0;font-size:12.5px;line-height:1.55}
.gate .m{flex:none;font-weight:700}
.gate li.ok .m{color:var(--ok)}
.gate li.bad .m{color:var(--seal)}
.gate li.bad{background:var(--seal-soft);border-radius:2px;padding-left:6px}
.gate small{display:block;color:var(--ink-3)}
.gsum{margin:10px 0 0;font-size:12px;color:var(--ink-2)}
.gsum b{color:var(--seal)}

.lightbox{position:fixed;inset:0;background:rgba(20,22,24,.88);display:none;align-items:center;
  justify-content:center;z-index:9;cursor:zoom-out;padding:32px}
.lightbox.on{display:flex}
.lightbox img{max-width:96%;max-height:96%;border:1px solid #555;border-radius:2px}

.foot{margin-top:40px;font-size:11px;color:var(--ink-3);border-top:1px solid var(--rule);padding-top:14px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media print{
  .expo,.copy,.shmore{display:none!important}
  .pp{max-height:none;overflow:visible}
  .duo{grid-template-columns:minmax(0,1fr)}
  .shots.clip{max-height:none}
  .shots.clip::after{display:none}
  .seggrid,.batches{grid-template-columns:minmax(0,1fr)}
  .page{max-width:none;padding:0}
  section.top-sec,.segcard,.batch{page-break-inside:avoid}
  body{background:#fff}
}
</style></head><body>
<div class="page">

<header class="hd">
  <h1>${esc(board.source)}</h1>
  <span class="sub">${esc(t.kicker)} · ${esc(t.epRange(eps[0]?.ep, eps[eps.length - 1]?.ep))}</span>
  <span class="right">
    <span class="gatepill ${failed.length ? 'fail' : 'pass'}">${failed.length ? '✗' : '✓'} ${esc(t.gatePill(gates.length - failed.length, gates.length))}</span>
    <button class="expo" data-name="${esc(slug(board.source))}-storyboard.json">${esc(t.exportJson)}</button>
  </span>
</header>

<div class="kpis">
  <div class="kpi accent"><div class="l">${esc(t.kpi.segments)}</div><div class="v">${stats.totals.segments} <small>${esc(t.unitSeg)}</small></div><div class="d">${esc(t.kpi.segmentsSub(params.maxSegmentSeconds))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.cuts)}</div><div class="v">${stats.totals.cuts} <small>${esc(t.unitCut)}</small></div><div class="d">${esc(t.kpi.cutsSub(stats.totals.avgCutSeconds))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.time)}</div><div class="v">${esc(fmtMin(stats.totals.seconds))}</div><div class="d">${esc(t.kpi.timeSub(fmtMin(stats.totals.targetSeconds)))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.batches)}</div><div class="v">${stats.batches.length}</div><div class="d">${esc(t.kpi.batchesSub)}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.lines)}</div><div class="v">${stats.totals.withLines} <small>${esc(t.unitSeg)}</small></div><div class="d">${esc(t.kpi.linesSub)}</div></div>
</div>
${failed.length ? `<div class="galert"><b>✗ ${esc(t.gatesFail(failed.length))}</b>${failed.map((g) => `<span>${esc(gateText(g, t.langCode).label)}${g.detail ? ` — ${esc(gateText(g, t.langCode).detail)}` : ''}</span>`).join('')}</div>` : ''}

<section class="top-sec" id="sec-rhythm">
  <div class="sec-h"><span class="no">01</span><h2>${esc(t.secRhythm)}</h2><span class="note">${esc(t.rhythmNote)}</span></div>
  <div class="rhythm">
    <div class="legend">${rhythmLegend}</div>
${rhythmRows}
  </div>
</section>

<section class="top-sec" id="sec-segments">
  <div class="sec-h"><span class="no">02</span><h2>${esc(t.secSegments)}</h2><span class="note">${esc(t.segmentsNote)}</span></div>
${epBlocks}
</section>

<section class="top-sec" id="sec-batches">
  <div class="sec-h"><span class="no">03</span><h2>${esc(t.secBatches)}</h2><span class="note">${esc(t.batchesNote)}</span></div>
  <div class="batches">
${batchCards}
  </div>
</section>

<section class="top-sec" id="sec-dialogue">
  <div class="sec-h"><span class="no">04</span><h2>${esc(t.secDialogue)}</h2><span class="note">${esc(t.dialogueNote)}</span></div>
  <table><thead><tr>${t.dialogueCols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
  <tbody>
${dlgRows}
  </tbody></table>
</section>

<section class="top-sec" id="sec-gates">
  <div class="sec-h"><span class="no">05</span><h2>${esc(t.secGates)}</h2></div>
  ${gateList}
  <p class="gsum">${failed.length ? `<b>${esc(t.gatesFail(failed.length))}</b>` : esc(t.gatesPass)}</p>
</section>

<p class="foot">${esc(t.colophon)}</p>
</div>

<div class="lightbox" id="lightbox"><img alt=""></div>

<script type="application/json" id="storyboard-data">${embedDoc(board)}</script>
<script>
const L = ${JSON.stringify({ copied: t.copied, failed: t.copyFailed, show: t.showSegs, hide: t.hideSegs })};

// 分集分镜表：段卡区默认最多 760px。不超高的集直接放开；超高的集点开/收起
document.querySelectorAll('.shmore').forEach((btn) => {
  const zone = btn.previousElementSibling;
  if (zone.scrollHeight <= 780) {
    zone.classList.remove('clip');
    btn.remove();
    return;
  }
  btn.addEventListener('click', () => {
    const clipped = zone.classList.toggle('clip');
    btn.textContent = clipped ? L.show : L.hide;
    if (clipped) zone.closest('.ep').scrollIntoView({ block: 'nearest' });
  });
});

// 点图放大（主分镜图 / 子分镜图 / 批次场景图）
const lb = document.getElementById('lightbox');
document.addEventListener('click', (e) => {
  const img = e.target.closest('img.frame, img.subf, img.bimg');
  if (img) {
    lb.querySelector('img').src = img.src;
    lb.classList.add('on');
    return;
  }
  if (e.target.closest('#lightbox')) lb.classList.remove('on');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') lb.classList.remove('on');
});

// 提示词面板：H3 / Seedance 页签，复制键复制当前激活的那一份
document.addEventListener('click', (e) => {
  const tab = e.target.closest('.ptab');
  if (!tab) return;
  const panel = tab.closest('.ppanel');
  const i = Number(tab.dataset.i);
  panel.querySelectorAll('.ptab').forEach((b, k) => b.classList.toggle('on', k === i));
  panel.querySelectorAll('.pp').forEach((pre, k) => pre.classList.toggle('on', k === i));
  panel.querySelector('.pp-h .copy').dataset.copy = panel.querySelectorAll('.pp')[i].textContent;
});

// 复制提示词
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy');
  if (!btn) return;
  e.preventDefault();
  const label = btn.textContent;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    btn.textContent = L.copied;
    btn.dataset.done = '1';
  } catch {
    btn.textContent = L.failed;
  }
  setTimeout(() => { btn.textContent = label; delete btn.dataset.done; }, 1600);
});

// 导出：报告自己带着完整的 storyboard.json，下载的是它原样
document.querySelector('.expo').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const url = URL.createObjectURL(
    new Blob([document.getElementById('storyboard-data').textContent], { type: 'application/json' }),
  );
  const a = Object.assign(document.createElement('a'), { href: url, download: btn.dataset.name });
  a.click();
  // 别立刻回收——Safari 会抢在下载读完之前撤掉 blob
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const USAGE = `novel-storyboard.mjs — novel-storyboard skill 的确定性工具（分镜）

  seed <script.json> [--eps 1-3]              从剧本预填节拍工作底稿（打印到 stdout）
  validate <sb.json> --script <script.json>   校验；有违规逐条打印并 exit 1
           [--outline] [--cast] [--art]       outline/cast 查提示词人名；art 只管显示名字
           [--shots <卡片目录>]                挂载镜头配方卡库，开 shot-recipe 门（不给就跳过）
  checkup <sb.json> --script <script.json>    只打印质量门 ✓/✗，有未过项 exit 1
          [--shots <卡片目录>]
  render <sb.json> --script <script.json>     渲染报告到 stdout（默认 --md）
         [--html|--md] [--outline] [--art]
         [--frames <dir>]                     分镜图目录，找 <dir>/<段号>/f<切序>.png（默认当前目录）
         [--images <dir>]                     场景设定图目录，找 <dir>/<场景 slug>-sheet.png（默认 ./images）
                                              两个目录都可以是任意路径；报告里的图片路径按「报告写在当前目录」计算
         [--lang zh|en]                       报告界面语言（默认 zh；未指定时读取 JSON 顶层 lang 字段）
         [--shots <卡片目录>]                  报告的「配方」列显示卡名并标注建议景别／运镜的偏离
         [--constraints <file>]               Seedance 全局约束，一行一条（程序补上无字幕、多人禁双胞胎）
  export <sb.json> --script <script.json>     导出投产包，每段一个文件夹
         [--protocol h3|seedance]             h3（默认）：<段号>/prompt.md + f1..fN.png，根部 manifest.json
                                              seedance：<段号>/seedance.md + 附件，根部 seedance-manifest.json
         [--out .]                            输出目录
         [--frames <dir>]                     从这里把 <段号>/f<切序>.png 拷进投产包；不给就只认包里现成的图
         [--images <dir>]                     Seedance 参考图路径的设定图目录（默认 ./images），找到就拷进包
         [--outline] [--art] [--constraints]  名字与全局约束，同 render
  stats                                       读当前目录的 .gates.jsonl，汇总哪道门最常响、
                                              哪道门从没响过（validate/checkup 会自动累积）
  slug <name>                                 剧名转安全文件名

validate 与 checkup 每次都会把门的结果追加到当前目录的 .gates.jsonl。
积累几十次之后跑 stats，就知道模型最常违反哪条规则——那条规则的措辞该改。
不想记就加 --no-log；写不进去会静默跳过，不影响校验本身。`;

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function flag(rest, name, fallback = null) {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback;
}

/*
 * --shots 只接受卡片目录，不接受导出的 shots.json：中间产物必然会漂，
 * 卡片 .md 才是唯一来源。目录里读不到卡片就直接报错——挂了却没生效
 * 比没挂更坏。
 */
function loadShots(dir) {
  if (/\.json$/i.test(dir)) {
    throw new Error('--shots 只接受卡片目录（shot-recipes/references/cards），不接受导出的 shots.json——中间产物必然会漂');
  }
  const cards = loadRecipes(dir);
  if (!cards.size) throw new Error(`--shots ${dir} 里没读到卡片（.md）——请指向 shot-recipes/references/cards`);
  return cards;
}

function loadCtx(rest) {
  const get = (name) => {
    const path = flag(rest, name);
    return path ? readJson(path) : null;
  };
  const shots = flag(rest, '--shots');
  // Seedance 的全局约束：一行一条，行首编号可有可无（程序会重新编号）
  const cons = flag(rest, '--constraints');
  const constraints = cons
    ? readFileSync(resolve(cons), 'utf8').split('\n').map((l) => l.trim().replace(/^\d+\s*[.、)）]\s*/, '')).filter(Boolean)
    : [];
  return {
    script: get('--script'), outline: get('--outline'), cast: get('--cast'), art: get('--art'),
    recipes: shots ? loadShots(shots) : null,
    constraints,
  };
}

function main(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  if (cmd === 'seed') {
    const [path] = rest;
    if (!path) throw new Error('用法：seed <script.json> [--eps 1-3]');
    const range = flag(rest, '--eps');
    let epRange = null;
    if (range) {
      const m = String(range).match(/^(\d+)-(\d+)$/) ?? String(range).match(/^(\d+)$/);
      if (!m) throw new Error('--eps 形如 3 或 1-6');
      epRange = m[2] ? [Number(m[1]), Number(m[2])] : [Number(m[1]), Number(m[1])];
    }
    console.log(JSON.stringify(seedFromScript(readJson(path), epRange), null, 2));
    return;
  }

  if (cmd === 'validate' || cmd === 'checkup') {
    const [path] = rest;
    if (!path) throw new Error(`用法：${cmd} <storyboard.json> --script <script.json> [--outline] [--cast]`);
    const board = readJson(path);
    const ctx = loadCtx(rest);
    if (!ctx.script) throw new Error('分镜离开剧本没有意义——必须给 --script <script.json>');
    if (!ctx.outline && !ctx.cast) console.error('⚠️ 没给 --outline / --cast，跳过提示词人名检查');

    // 门的结果追加到 .gates.jsonl——validate 与 checkup 都记，
    // 这样「跑过多少次」这个分母才是全的
    const logGates = (gates) => {
      if (rest.includes('--no-log')) return;
      try {
        const rows = gateLogEntries(gates, { doc: basename(path), at: new Date().toISOString() });
        if (rows.length) appendFileSync(GATE_LOG, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
      } catch { /* 写不进去就算了，日志不能挡住主流程 */ }
    };

    if (cmd === 'checkup') {
      const gates = gateReport(board, ctx);
      logGates(gates);
      for (const g of gates) console.log(`${g.ok ? '✓' : '✗'} ${g.label}${g.detail ? ` — ${g.detail}` : ''}`);
      const failedN = gates.filter((g) => !g.ok).length;
      console.log(failedN ? `\n✗ ${failedN} 项未过` : '\n✓ 全部通过');
      // 建议景别／运镜的偏离只在这里提示，不进门——配方是语汇不是法条，
      // 而且可选挂载的东西一旦变严就没人挂了
      if (ctx.recipes) {
        const drifted = [];
        for (const ep of board?.episodes ?? []) {
          for (const seg of ep?.segments ?? []) {
            (seg?.cuts ?? []).forEach((cut, ci) => {
              const card = typeof cut?.recipe === 'string' ? ctx.recipes.get(cut.recipe) : null;
              if (!card) return;
              const d = recipeDrift(cut, card);
              if (d.sizes.length || d.cameras.length) {
                drifted.push(`  ${seg.id}#${ci + 1}「${card.name}」${I18N.zh.recipeDrift(d.sizes, d.cameras)}`);
              }
            });
          }
        }
        if (drifted.length) console.error(`\n${I18N.zh.recipeHint(drifted.length)}\n${drifted.join('\n')}`);
      }
      if (failedN) process.exit(1);
      return;
    }

    logGates(gateReport(board, ctx));
    const problems = validateStoryboard(board, ctx);
    if (problems.length) {
      console.error(`✗ ${problems.length} 处违规：\n`);
      for (const x of problems) console.error('  ' + x);
      process.exit(1);
    }
    const st = computeStats(board, ctx.script);
    console.log(`✓ ${st.episodes.length} 集 / ${st.totals.segments} 段 / ${st.totals.cuts} 个分镜全部通过校验（共 ${st.totals.seconds}s / 目标 ${st.totals.targetSeconds}s / ${st.batches.length} 个生成批次）`);
    return;
  }

  if (cmd === 'render') {
    const [path] = rest;
    if (!path) throw new Error('用法：render <storyboard.json> --script <script.json> [--html|--md] [--lang zh|en] [--outline] [--art]');
    const board = readJson(path);
    const ctx = loadCtx(rest);
    if (!ctx.script) throw new Error('分镜离开剧本没有意义——必须给 --script <script.json>');
    // 界面语言：--lang > JSON 顶层 lang 字段 > 'zh'（后两级在渲染器里兜底）
    const langFlag = flag(rest, '--lang');
    if (langFlag) ctx.lang = langFlag;
    // 图放哪由用户定；src 写成相对当前目录的路径（报告默认就写在这里）
    const framesDir = resolve(flag(rest, '--frames', '.'));
    const sheetsDir = resolve(flag(rest, '--images', 'images'));
    ctx.image = (kind, rel) => {
      const abs = join(kind === 'sheet' ? sheetsDir : framesDir, rel);
      return existsSync(abs) ? relative(process.cwd(), abs).split(sep).join('/') : null;
    };
    process.stdout.write((rest.includes('--html') ? renderHtml(board, ctx) : renderMarkdown(board, ctx)) + '\n');
    return;
  }

  if (cmd === 'export') {
    const [path] = rest;
    if (!path) throw new Error('用法：export <storyboard.json> --script <script.json> [--protocol h3|seedance] [--out h3] [--frames <dir>] [--images <dir>]');
    const board = readJson(path);
    const ctx = loadCtx(rest);
    if (!ctx.script) throw new Error('分镜离开剧本没有意义——必须给 --script <script.json>');
    const dir = flag(rest, '--out', '.');
    const protocol = flag(rest, '--protocol', 'h3');
    if (!['h3', 'seedance'].includes(protocol)) throw new Error(`--protocol 只能是 h3 或 seedance，实际是 ${protocol}`);
    // 分镜图在哪由用户指定：给了 --frames 就把找得到的拷进包里，不要求用户先手动放进去
    const framesFlag = flag(rest, '--frames');
    let copied = 0;
    if (framesFlag) {
      const from = resolve(framesFlag);
      for (const ep of board?.episodes ?? []) {
        for (const seg of ep?.segments ?? []) {
          (seg.cuts ?? []).forEach((_, i) => {
            const src = join(from, seg.id, `f${i + 1}.png`);
            const dst = resolve(dir, seg.id, `f${i + 1}.png`);
            if (!existsSync(src) || src === dst) return;
            mkdirSync(resolve(dst, '..'), { recursive: true });
            copyFileSync(src, dst);
            copied += 1;
          });
        }
      }
    }
    // Seedance 参考图路径要挂设定图：从 --images 指定的目录找，找到就拷进包里
    const sheetsDir = resolve(flag(rest, '--images', 'images'));
    const pack = exportPack(board, ctx.script, {
      imageExists: (rel) => existsSync(resolve(rel)),
      sheetExists: (file) => existsSync(join(sheetsDir, file)),
      dir,
      protocol,
      names: namer(ctx),
      constraints: ctx.constraints,
    });
    for (const f of pack.files) {
      mkdirSync(resolve(f.path, '..'), { recursive: true });
      writeFileSync(resolve(f.path), f.content, 'utf8');
    }
    for (const c of pack.copies) copyFileSync(join(sheetsDir, c.file), resolve(c.to));
    const segN = pack.manifest.length;
    if (protocol === 'seedance') {
      console.log(`✓ ${segN} 段 Seedance 投产包 → ${resolve(dir)}/（每段一个文件夹：seedance.md + 附件；根部 seedance-manifest.json）`);
      if (pack.copies.length) console.log(`  从 ${sheetsDir} 拷入 ${pack.copies.length} 张设定图`);
      if (framesFlag) console.log(`  从 ${resolve(framesFlag)} 拷入 ${copied} 张分镜图`);
      if (pack.missingTotal) console.log(`⚠️ 缺 ${pack.missingTotal} 个附件，已在 seedance-manifest.json 的 missing 里标注——提交前先补齐`);
      console.log('  视觉风格（画风层）不在包里，提交时附加');
      return;
    }
    console.log(`✓ ${segN} 段投产包 → ${resolve(dir)}/（每段一个文件夹：分镜图 + prompt.md；根部 manifest.json）`);
    if (framesFlag) console.log(`  从 ${resolve(framesFlag)} 拷入 ${copied} 张分镜图`);
    if (pack.missingTotal) console.log(`⚠️ 缺 ${pack.missingTotal} 张分镜图，已在 manifest 的 missing 里标注——喂 H3 前先补齐`);
    return;
  }

  if (cmd === 'stats') {
    let entries = [];
    try {
      entries = readFileSync(GATE_LOG, 'utf8').split('\n').filter(Boolean).map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
    } catch {
      console.log(`还没有 ${GATE_LOG}——先在这个目录里跑几次 validate 或 checkup，门的失败会累积到这里。`);
      return;
    }
    const allGates = gateReport({ episodes: [] }, {}).map((g) => g.id);
    const s = summarizeGateLog(entries, allGates);
    console.log(`跑过 ${s.runs} 次，其中 ${s.cleanRuns} 次全过 · 累计 ${s.fails} 条失败\n`);
    if (s.ranked.length) {
      console.log('最常响的门（那条规则模型最常无视，措辞该改）：');
      for (const r of s.ranked) {
        console.log(`  ${String(r.count).padStart(3)} 次  ${r.gate.padEnd(16)} ${r.label}`);
        for (const x of r.samples) console.log(`         ${x.length > 90 ? x.slice(0, 90) + '…' : x}`);
      }
      console.log();
    }
    if (s.silent.length) {
      console.log(`从没响过的门（${s.silent.length} / ${allGates.length}）——可能是死门，也可能规则已经被模型内化：`);
      console.log('  ' + s.silent.join(' / '));
    }
    return;
  }

  if (cmd === 'slug') {
    if (!rest[0]) throw new Error('用法：slug <name>');
    console.log(slug(rest[0]));
    return;
  }

  throw new Error(`未知命令 ${cmd}\n\n${USAGE}`);
}

// 软链安装时 argv[1] 是链接路径，两边都取 realpath 才能比得上
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  // `render ... | head` 这类管道提前关闭时安静退出，别甩 EPIPE 堆栈
  process.stdout.on('error', (e) => {
    if (e.code === 'EPIPE') process.exit(0);
    throw e;
  });
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
