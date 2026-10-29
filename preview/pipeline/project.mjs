#!/usr/bin/env node
/**
 * shuohao-skills project pipeline — dựng một dự án đầy đủ cấu trúc như mẫu 渡口.
 *
 *   node preview/pipeline/project.mjs new --name ten-du-an --script kichban.json [--from-sample]
 *   node preview/pipeline/project.mjs render projects/ten-du-an
 *   node preview/pipeline/project.mjs video  projects/ten-du-an [--narration] [--ep 1] [--assets]
 *   node preview/pipeline/project.mjs status projects/ten-du-an
 *
 * Không gọi model. Các bước cần model (viết outline/cast/art/script/storyboard, sinh ảnh)
 * do agent làm trong Kilo theo SKILL.md; script này chỉ dựng khung, render và ghép video.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from '../../scripts/studio-brain.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');
const SKILLS = join(REPO, 'skills');
const PIPELINE = join(REPO, 'preview', 'pipeline');
const SAMPLE_FROM = join(SKILLS, 'novel-script', 'examples', '渡口-script.json');

const FILES = {
  outline: 'outline.json',
  cast: 'cast.json',
  art: 'art.json',
  script: 'script.json',
  staging: 'staging.json',
  storyboard: 'storyboard.json',
};

const ui = {
  title: 'shuohao-skills project',
  steps: ['outline', 'cast', 'art', 'script', 'staging', 'storyboard', 'frames', 'packs', 'video'],
};

const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };
const log = (m) => console.log(m);
const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const writeJSON = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`); };
const exists = (p) => existsSync(p);
const sizeOf = (p) => (exists(p) ? statSync(p).size : 0);
const stemOf = (p, suffix) => basename(p, '.json').replace(new RegExp(`${suffix}$`), '');

function run(cmd, args, opts = {}) {
  // Detailed storyboards embed full production cards and JSON; their HTML exceeds Node's 1 MiB default.
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: REPO, maxBuffer: 64 * 1024 * 1024, ...opts });
  if (r.error || r.status !== 0) {
    const detail = r.error ? `${r.error.code || 'PROCESS_ERROR'}: ${r.error.message}` : (r.stderr || r.stdout || `Process exited with ${r.signal || r.status}`);
    const msg = `${cmd} ${args.join(' ')}\n${detail.slice(-2000)}`;
    if (opts.allowFail) return { ok: false, out: `${r.stdout ?? ''}`, err: msg };
    throw new Error(msg);
  }
  return { ok: true, out: `${r.stdout ?? ''}`, err: `${r.stderr ?? ''}` };
}

/** Ghi trạng thái tầng vào project.json (không tạo file nếu project không có manifest). */
function markStage(P, patch) {
  const file = join(P.root, 'project.json');
  if (!exists(file)) return;
  const manifest = readJSON(file);
  manifest.stages = { ...(manifest.stages ?? {}), ...patch };
  manifest.updatedAt = new Date().toISOString();
  writeJSON(file, manifest);
}

function projectPaths(dir) {
  const root = resolve(dir);
  return {
    root,
    json: Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, join(root, f)])),
    images: join(root, 'images'),
    frames: join(root, 'frames'),
    voice: join(root, 'voice'),
    packs: join(root, 'packs'),
    reports: join(root, 'reports'),
    scriptfile: join(root, 'script.md'),
  };
}

/* ------------------------------------------------------------------ */
/* new                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Dựng khung dự án từ một kịch bản người dùng đưa vào.
 * Kịch bản = JSON theo schema novel-script, hoặc .md/.txt (agent sẽ đọc rồi chia tập).
 */
function cmdNew(args) {
  const get = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const name = get('--name');
  const scriptArg = get('--script');
  const fromSample = args.includes('--from-sample');
  if (!name && !scriptArg && !fromSample) die('cần --name <slug> và --script <file>, hoặc --from-sample');
  const slug = String(name ?? 'du-an-moi').replace(/[^\w\u4e00-\u9fff-]+/g, '-').replace(/^-|-$/g, '') || 'du-an-moi';
  const root = join(REPO, 'projects', slug);
  if (exists(root) && !args.includes('--force')) die(`${root} đã tồn tại (dùng --force để ghi đè)`);
  if (exists(root)) rmSync(root, { recursive: true, force: true });

  const P = projectPaths(root);
  for (const d of [P.root, P.images, P.frames, P.voice, P.packs, P.reports]) mkdirSync(d, { recursive: true });

  let source = slug;
  let eps = [];
  let scriptJSON = null;
  let textFile = null;

  if (fromSample || (!scriptArg && args.includes('--from-sample'))) {
    const sample = readJSON(SAMPLE_FROM);
    scriptJSON = sample;
    source = sample.source;
  } else if (scriptArg) {
    const abs = resolve(process.cwd(), scriptArg);
    if (!exists(abs)) die(`không thấy ${abs}`);
    const raw = readFileSync(abs, 'utf8');
    if (/\.json$/i.test(abs)) {
      scriptJSON = JSON.parse(raw);
      source = scriptJSON.source ?? basename(abs, '.json');
    } else {
      writeFileSync(P.scriptfile, raw);
      textFile = abs;
      source = basename(abs).replace(/\.(md|txt)$/i, '');
      log(`  kịch bản dạng text → ${P.scriptfile} (agent chia tập theo novel-script/SKILL.md)`);
    }
  }

  if (scriptJSON) {
    if (!Array.isArray(scriptJSON.episodes)) die('script JSON thiếu episodes[]');
    const briefs = {
      source: scriptJSON.source ?? source,
      lang: scriptJSON.lang ?? 'zh',
      episodes: scriptJSON.episodes.map((e) => ({
        ep: e.ep,
        targetSeconds: e.targetSeconds,
        briefs: (e.scenes ?? []).map((sc) => ({
          sceneId: sc.sceneId, lighting: sc.lighting, characters: sc.characters, props: sc.props, flow: sc.flow ?? [],
        })),
      })),
    };
    writeJSON(join(P.root, 'briefs.json'), briefs);
    eps = scriptJSON.episodes.map((e) => e.ep);
    log(`  briefs.json: ${eps.length} tập (${eps[0] ?? '?'}–${eps[eps.length - 1] ?? '?'})`);
  }

  // kịch bản dạng text: đọc quy mô/thể loại từ chính file, không đoán
  const { episodes: textEps, minutesPerEpisode: textMinutes, genre: textGenre } = textFile ? scanScriptText(textFile) : {};
  if (textEps) eps = Array.from({ length: textEps }, (_, i) => i + 1);
  const totalEps = eps.length || textEps || 6;

  const outline = {
    source,
    lang: 'zh',
    params: { episodes: totalEps, minutesPerEpisode: textMinutes ?? 2, genre: textGenre ?? '（待定）', adaptMode: '抽核', preferences: [] },
    adaptation: { core: '', keep: [], cut: [], merge: [], risks: [], cutNote: '', mergeNote: '' },
    characters: [], scenes: [], props: [], beats: [], episodes: [],
  };
  writeJSON(P.json.outline, outline);
  log(`  outline.json: khung ${outline.params.episodes} tập`);

  const manifest = {
    slug, source, lang: 'zh', episodes: eps,
    params: { episodes: totalEps, minutesPerEpisode: textMinutes ?? 2, genre: textGenre ?? null, adaptMode: '抽核' },
    stages: {
      briefs: Boolean(scriptJSON) || exists(P.scriptfile),
      outline: 'skeleton', cast: 'none', art: 'none', script: scriptJSON ? 'seeded' : 'none',
      staging: 'none', storyboard: 'none', images: 'none', frames: 'none', packs: 'none', video: 'none',
    },
    next: ['outline', 'cast', 'art', 'script', 'staging', 'storyboard', 'images', 'frames', 'packs', 'video'],
  };
  writeJSON(join(P.root, 'project.json'), manifest);

  if (scriptJSON) writeJSON(P.json.script, scriptJSON);
  log(`✓ dựng khung ${root}`);
  nextHint(P);
}

/**
 * Project mẫu đầy đủ: copy toàn bộ dữ liệu thật của 渡口 sang project/ và chạy đủ 6 gate,
 * render báo cáo, export pack. Đây là "chạy toàn bộ dự án mẫu" không cần model.
 */
function cmdSample(args) {
  const get = (k, d = null) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const slug = get('--name', 'mau-渡口');
  const root = join(REPO, 'projects', slug);
  if (exists(root) && !args.includes('--force')) die(`${root} đã tồn tại (dùng --force để ghi đè)`);
  if (exists(root)) rmSync(root, { recursive: true, force: true });
  const P = projectPaths(root);
  for (const d of [P.root, P.images, P.frames, P.voice, P.packs, P.reports]) mkdirSync(d, { recursive: true });

  const copies = [
    ['outline', join(SKILLS, 'novel-outline', 'examples', '渡口-outline.json')],
    ['cast', join(SKILLS, 'novel-characters', 'examples', '渡口-cast.json')],
    ['art', join(SKILLS, 'novel-art', 'examples', '渡口-art.json')],
    ['script', join(SKILLS, 'novel-script', 'examples', '渡口-script.json')],
    ['staging', join(SKILLS, 'novel-staging', 'examples', '渡口-staging.json')],
    ['storyboard', join(SKILLS, 'novel-storyboard', 'examples', '渡口-storyboard.json')],
  ];
  for (const [key, src] of copies) {
    if (!exists(src)) die(`thiếu dữ liệu mẫu ${src}`);
    writeFileSync(P.json[key], readFileSync(src));
  }
  writeFileSync(join(P.root, 'book.txt'), readFileSync(join(SKILLS, 'novel-characters', 'examples', '渡口.txt')));
  const script = readJSON(P.json.script);
  writeJSON(join(P.root, 'briefs.json'), {
    source: script.source, lang: script.lang,
    episodes: script.episodes.map((e) => ({ ep: e.ep, targetSeconds: e.targetSeconds, briefs: (e.scenes ?? []).map((sc) => ({ sceneId: sc.sceneId, lighting: sc.lighting, characters: sc.characters, props: sc.props, flow: sc.flow ?? [] })) })),
  });
  writeJSON(join(P.root, 'project.json'), {
    slug, source: script.source, lang: script.lang, episodes: script.episodes.map((e) => e.ep),
    params: { episodes: script.episodes.length, minutesPerEpisode: 2, genre: '民国情感悬疑', adaptMode: '抽核' },
    stages: { briefs: 'done', outline: 'done', cast: 'done', art: 'done', script: 'done', staging: 'done', storyboard: 'done', images: 'none', frames: 'none', packs: 'none', video: 'none' },
  });
  const bookTxt = readFileSync(join(SKILLS, 'novel-characters', 'examples', '渡口.txt'));
  log(`✓ copy 6 file JSON mẫu (đặt tên theo quy ước output của từng skill) + book.txt`);

  // đặt tên theo quy ước <tên>-<stage>.json cạnh output của từng skill
  const named = [
    ['outline', `渡口-outline`, join(SKILLS, 'novel-outline', 'examples', '渡口-outline.json')],
    ['cast', `渡口-cast`, join(SKILLS, 'novel-characters', 'examples', '渡口-cast.json')],
    ['art', `渡口-art`, join(SKILLS, 'novel-art', 'examples', '渡口-art.json')],
    ['script', `渡口-script`, join(SKILLS, 'novel-script', 'examples', '渡口-script.json')],
    ['staging', `渡口-staging`, join(SKILLS, 'novel-staging', 'examples', '渡口-staging.json')],
    ['storyboard', `渡口-storyboard`, join(SKILLS, 'novel-storyboard', 'examples', '渡口-storyboard.json')],
  ];
  for (const [key, , src] of named) writeFileSync(P.json[key], readFileSync(src));
  writeFileSync(join(P.root, 'book.txt'), bookTxt);
  // chạy đủ gate của cả 6 skill, in ✓/✗
  const gates = [
    ['outline.validate', 'novel-outline', ['validate', P.json.outline]],
    ['cast.validate', 'novel-characters', ['validate', P.json.cast, join(P.root, 'book.txt')]],
    ['art.validate', 'novel-art', ['validate', P.json.art, '--cast', P.json.cast]],
    ['script.validate', 'novel-script', ['validate', P.json.script, '--outline', P.json.outline, '--art', P.json.art]],
    ['staging.validate', 'novel-staging', ['validate', P.json.staging, '--script', P.json.script, '--art', P.json.art]],
    ['storyboard.validate', 'novel-storyboard', ['validate', P.json.storyboard, '--script', P.json.script, '--outline', P.json.outline, '--cast', P.json.cast, '--art', P.json.art]],
  ];
  let fail = 0;
  for (const [name, skill, argv] of gates) {
    const r = run('node', [join(SKILLS, skill, 'scripts', `${skill}.mjs`), ...argv], { allowFail: true, cwd: P.root });
    const lines = `${r.out}\n${r.err}`.split('\n').map((x) => x.trim()).filter(Boolean);
    const bad = lines.filter((x) => /^✗|✗|缺 |违规/.test(x) && !/^✓/.test(x));
    if (r.ok) log(`✓ ${name}`);
    else { fail += 1; log(`✗ ${name}`); for (const b of bad.slice(0, 4)) log(`    ${b}`); }
  }

  const r = run('node', [join(SKILLS, 'novel-storyboard', 'scripts', 'novel-storyboard.mjs'), 'export', P.json.storyboard, '--script', P.json.script, '--out', P.packs], { allowFail: true });
  P.json = Object.fromEntries(Object.entries(FILES).map(([k, f]) => [k, join(P.root, f)]));
  if (exists(join(P.root, 'outline.md'))) void 0;
  log(`${r.ok ? '✓' : '✗'} export packs → ${P.packs.replace(`${REPO}/`, '')}${r.ok ? '' : `  ${r.err.split('\n').slice(-2).join(' ')}`}`);
  cmdRender([P.root, ...(args.includes('--lang') ? ['--lang', get('--lang')] : [])]);
  log(`\n${fail ? `${fail} gate chưa qua` : 'toàn bộ gate qua'} — dựng video: node preview/pipeline/project.mjs video projects/${slug}`);
}

/** Đọc quy mô từ kịch bản chữ: "6 tập × 120 giây", "Tập 1 —", thể loại ở dòng "Thể loại:". */
export function scanScriptText(file) {
  const raw = readFileSync(file, 'utf8');
  const eps = new Set();
  for (const m of raw.matchAll(/(?:^|\n)\s*#{0,3}\s*(?:Tập|Episode|Ep\.?)\s*(\d{1,3})/gi)) eps.add(Number(m[1]));
  const declared = raw.match(/(\d{1,3})\s*(?:tập|episodes?)/i);
  const seconds = raw.match(/(\d{1,3})\s*(?:giây|seconds?|s)\b/i);
  const minutes = raw.match(/(\d{1,3})\s*(?:phút|minutes?)\s*\/?\s*(?:tập|episode)/i);
  const genre = raw.match(/Thể loại\s*[:：]\s*([^\n]+)/i);
  const episodes = Math.max(eps.size, declared ? Number(declared[1]) : 0) || null;
  const minutesPerEpisode = minutes ? Number(minutes[1]) : seconds ? Math.round((Number(seconds[1]) / 60) * 10) / 10 : null;
  return { episodes, minutesPerEpisode, genre: genre ? genre[1].trim() : null, episodeNumbers: [...eps].sort((a, b) => a - b) };
}

/** Dựng script.json từ SCENES trong file text (mỗi dòng đánh số = một beat). */
function cmdFromText(args) {
  const dir = args[0];
  if (!dir) die('cần đường dẫn project');
  const P = projectPaths(dir);
  if (!exists(P.scriptfile)) die(`${P.scriptfile} không có — project này không tạo từ kịch bản chữ`);
  const raw = readFileSync(P.scriptfile, 'utf8');
  const { minutesPerEpisode } = scanScriptText(P.scriptfile);
  const target = Math.round((minutesPerEpisode ?? 2) * 60);

  const chars = [];
  for (const m of raw.matchAll(/^\s*-\s*([CPS]\d{2})\s+(\S+)/gm)) if (!chars.find((c) => c.id === m[1])) chars.push({ id: m[1], name: m[2] });
  const nameOf = (id) => chars.find((c) => c.id === id)?.name ?? id;
  const sceneIds = [...new Set([...raw.matchAll(/\bS\d{2}\b/g)].map((m) => m[0]))].sort();

  const episodes = [];
  const blocks = raw.split(/^##\s*Tập\s*/m).slice(1);
  for (const block of blocks) {
    const epNo = Number(block.match(/^(\d+)/)?.[1]);
    if (!epNo) continue;
    const body = block.replace(/^[^\n]*\n/, '');
    const ctx = body.match(/^Bối cảnh\s*[:：]\s*([^\n]+)/im)?.[1] ?? '';
    const sceneList = (ctx.match(/\bS\d{2}\b/g) ?? [sceneIds[0] ?? 'S01']);
    const lighting = ctx.split(/[,，(（]/).slice(1).join(',').replace(/[)）]/g, '').trim() || 'đêm mưa';
    const lines = [...body.matchAll(/^\s*(\d+)\.\s*(.+)$/gm)];
    const sceneMap = new Map(sceneList.map((sid) => [sid, []]));
    for (const [, , text] of lines) {
      const spoken = text.match(/^([CPS]\d{2})\s*[:：]\s*[“"']?(.+?)[”"']?$/);
      if (spoken) sceneMap.get(sceneList[0]).push({ speaker: spoken[1], line: spoken[2].trim(), delivery: '' });
      else sceneMap.get(sceneList[0]).push({ action: text.trim() });
    }
    const scenes = [...sceneMap.entries()].map(([sceneId, flow]) => ({
      sceneId, lighting,
      characters: [...new Set(flow.flatMap((f) => (f.speaker ? [f.speaker] : [])))],
      props: [],
      flow,
    })).filter((sc) => sc.flow.length);
    const hook = raw.match(new RegExp(`B\\d+\\s*\\S+\\s*\\([^)]*tập\\s*${epNo}\\)\\s*[:：]\\s*([^\\n]+)`, 'i'))?.[1]?.trim() ?? '';
    episodes.push({
      ep: epNo, targetSeconds: target, hook, cliff: '', beatsClaimed: [], hookBeat: [1, 1], scenes,
    });
    void nameOf;
  }
  if (!episodes.length) die('không tìm thấy mục "## Tập N" nào trong kịch bản');
  const total = episodes.reduce((a, e) => a + e.scenes.reduce((x, sc) => x + sc.flow.filter((f) => f.line).length * 8 + sc.flow.filter((f) => f.action).length * 2.5, 0), 0);
  const doc = { source: basename(P.root), lang: 'zh', episodes };
  writeJSON(P.json.script, doc);
  mkdirSync(P.root, { recursive: true });
  writeJSON(join(P.root, 'briefs.json'), {
    source: doc.source, lang: doc.lang,
    episodes: episodes.map((e) => ({ ep: e.ep, targetSeconds: e.targetSeconds, briefs: e.scenes.map((sc) => ({ sceneId: sc.sceneId, lighting: sc.lighting, characters: sc.characters, props: sc.props, flow: sc.flow })) })),
  });
  const manifestPath = join(P.root, 'project.json');
  const manifest = exists(manifestPath) ? readJSON(manifestPath) : { slug: basename(P.root) };
  manifest.episodes = episodes.map((e) => e.ep);
  manifest.params = { ...(manifest.params ?? {}), episodes: episodes.length };
  manifest.stages = { ...(manifest.stages ?? {}), briefs: 'done', script: 'seeded' };
  writeJSON(manifestPath, manifest);
  for (const e of episodes) log(`  tập ${e.ep}: ${e.scenes.length} cảnh, ${e.scenes.reduce((a, sc) => a + sc.flow.length, 0)} beat, est ${Math.round(e.scenes.reduce((a, sc) => a + sc.flow.filter((f) => f.line).length * 8 + sc.flow.filter((f) => f.action).length * 2.5, 0))}s / ${e.targetSeconds}s`);
  log(`✓ script.json (draft) từ ${basename(P.scriptfile)} — chạy validate để xem còn thiếu gì, est tổng ${Math.round(total)}s`);
}

function nextHint(P) {
  const m = exists(join(P.root, 'project.json')) ? readJSON(join(P.root, 'project.json')) : null;
  if (!m) return;
  const todo = Object.entries(m.stages).filter(([, v]) => v === 'none' || v === 'skeleton' || v === 'seeded').map(([k]) => k);
  if (todo.length) {
    log('\nbước tiếp theo');
    for (const k of todo) log(`  - ${k}`);
    log('\nchạy trong Kilo: mở project ' + P.root + ' và làm lần lượt theo .kilo/command/run-sample-project.md');
  }
}

/* ------------------------------------------------------------------ */
/* status                                                              */
/* ------------------------------------------------------------------ */

/** Tổng hợp đầu vào cho agent: briefs + trạng thái + tên file thật trong project. */
function cmdBrief(args) {
  const dir = args[0];
  if (!dir) die('cần đường dẫn project');
  const P = projectPaths(dir);
  if (!exists(P.root)) die(`không thấy ${P.root}`);
  const manifest = exists(join(P.root, 'project.json')) ? readJSON(join(P.root, 'project.json')) : {};
  const briefs = exists(join(P.root, 'briefs.json')) ? readJSON(join(P.root, 'briefs.json')) : null;
  const split = exists(join(P.root, 'split.json')) ? readJSON(join(P.root, 'split.json')) : null;
  const present = Object.entries(FILES).filter(([, f]) => exists(join(P.root, f))).map(([k]) => k);
  const userFacing = exists(P.scriptfile) ? readFileSync(P.scriptfile, 'utf8').slice(0, 20000) : null;
  const out = {
    project: P.root.replace(`${REPO}/`, ''),
    source: manifest.source ?? briefs?.source ?? null,
    params: manifest.params ?? null,
    episodes: manifest.episodes ?? briefs?.episodes?.map((e) => e.ep) ?? [],
    have: present,
    missing: Object.keys(FILES).filter((k) => !present.includes(k)),
    userScript: userFacing,
    split: split ? { meta: split.meta, stats: split.stats, characters: split.characters, scenes: split.scenes, beats: split.beats, unknownSpeakers: split.unknownSpeakers, episodes: split.episodes?.map((e) => ({ ep: e.ep, title: e.title, sceneIds: e.sceneIds, lighting: e.lighting, beats: e.beats })) } : null,
    briefs,
    gates: `node preview/pipeline/project.mjs sample --name ${basename(P.root)} --force  (chỉ dùng cho mẫu; project thật chạy validate từng skill)`,
    layout: {
      json: '<stage>.json', reports: '<stage>-report.html', markdown: '<stage>.md',
      images: 'images/<slug>-sheet.png (cast + art)',
      frames: 'frames/<段号>/f<切序>.png (storyboard)',
      voice: 'voice/<段号>-<số cắt>.wav (giọng đọc cho video --narration)',
      packs: 'packs/<段号>/prompt.md (export H3/Seedance)',
      video: 'video/<tên>-full.mp4',
    },
  };
  console.log(JSON.stringify(out, null, 2));
}

function cmdStatus(args) {
  const dir = args[0];
  if (!dir) die('cần đường dẫn project');
  const P = projectPaths(dir);
  if (!exists(P.root)) die(`không thấy ${P.root}`);
  const rows = [];
  const add = (name, path, extra = '') => rows.push([name, exists(path) ? `${Math.max(1, Math.round(sizeOf(path) / 1024))}KB` : '—', extra]);
  for (const [k, f] of Object.entries(FILES)) add(k, P.json[k]);
  add('briefs', join(P.root, 'briefs.json'));
  add('script.md', P.scriptfile);
  const count = (d, re) => (exists(d) ? readdirSync(d).filter((x) => re.test(x)).length : 0);
  add('images', P.images, `${count(P.images, /-sheet\.png$/)} sheet`);
  add('frames', P.frames, `${count(P.frames, /^E\d+-\d+$|^f\d+\.png$/)} mục`);
  add('packs', P.packs, `${count(P.packs, /^E\d+-\d+$|manifest\.json$/)} mục`);
  add('video', join(P.root, 'video'), exists(join(P.root, 'video')) ? readdirSync(join(P.root, 'video')).join(' ') : '');
  const w = Math.max(...rows.map((r) => r[0].length));
  for (const [a, b, c] of rows) console.log(`${a.padEnd(w)}  ${b.padEnd(8)} ${c}`);
}

/* ------------------------------------------------------------------ */
/* render                                                              */
/* ------------------------------------------------------------------ */

function cmdRender(args) {
  const dir = args[0];
  if (!dir) die('cần đường dẫn project');
  const P = projectPaths(dir);
  if (!exists(P.root)) die(`không thấy ${P.root}`);
  const lang = (args.indexOf('--lang') >= 0 ? args[args.indexOf('--lang') + 1] : 'zh');
  mkdirSync(P.reports, { recursive: true });
  const outs = [];
  const sh = (skill, argv, file) => {
    const r = run('node', [join(SKILLS, skill, 'scripts', `${skill}.mjs`), ...argv], { allowFail: true });
    // A failed process can return truncated HTML. Preserve any previously complete report.
    if (r.ok) writeFileSync(file, r.out);
    outs.push([file, r.ok, r.ok ? r.err.trim() : `RENDER FAIL: ${r.err.split('\n').slice(1, 4).join(' | ')}`]);
  };

  if (exists(P.json.outline)) sh('novel-outline', ['render', P.json.outline, '--html', '--lang', lang], join(P.root, 'outline-report.html'));
  if (exists(P.json.cast) && exists(join(P.root, 'book.txt'))) {
    run('node', [join(SKILLS, 'novel-characters', 'scripts', 'novel-characters.mjs'), 'validate', P.json.cast, join(P.root, 'book.txt')], { allowFail: true });
  }
  if (exists(P.json.cast)) {
    sh('novel-characters', ['render', P.json.cast, '--html', '--lang', lang, '--images', P.images], join(P.root, 'cast-report.html'));
    sh('novel-characters', ['render', P.json.cast, '--md', '--lang', lang, '--images', P.images], join(P.root, 'cast.md'));
  }
  if (exists(P.json.art)) {
    sh('novel-art', ['render', P.json.art, '--html', '--lang', lang, '--images', P.images], join(P.root, 'art-report.html'));
    sh('novel-art', ['render', P.json.art, '--md', '--lang', lang], join(P.root, 'art.md'));
  }
  if (exists(P.json.script)) {
    const argv = ['render', P.json.script, '--html', '--lang', lang];
    if (exists(P.json.outline)) argv.push('--outline', P.json.outline);
    if (exists(P.json.art)) argv.push('--art', P.json.art);
    if (exists(P.json.cast)) argv.push('--cast', P.json.cast);
    sh('novel-script', argv, join(P.root, 'script-report.html'));
    sh('novel-script', ['render', P.json.script, '--md', '--lang', lang], join(P.root, 'script.md'));
  }
  if (exists(P.json.staging)) {
    const argv = ['render', P.json.staging, '--html', '--lang', lang];
    if (exists(P.json.script)) argv.push('--script', P.json.script);
    if (exists(P.json.art)) argv.push('--art', P.json.art);
    sh('novel-staging', argv, join(P.root, 'staging-report.html'));
    sh('novel-staging', ['render', P.json.staging, '--md', '--lang', lang], join(P.root, 'staging.md'));
  }
  if (exists(P.json.storyboard) && exists(P.json.script)) {
    const argv = ['render', P.json.storyboard, '--script', P.json.script, '--html', '--lang', lang, '--frames', P.frames, '--images', P.images];
    if (exists(P.json.outline)) argv.push('--outline', P.json.outline);
    if (exists(P.json.art)) argv.push('--art', P.json.art);
    sh('novel-storyboard', argv, join(P.root, 'storyboard-report.html'));
    sh('novel-storyboard', ['render', P.json.storyboard, '--script', P.json.script, '--md', '--lang', lang], join(P.root, 'storyboard.md'));
  }

  const ok = outs.filter((o) => o[1]);
  if (ok.length) {
    const merged = join(P.root, 'report.html');
    const fromArgs = [];
    if (exists(P.json.outline)) fromArgs.push('--outline', P.json.outline);
    if (exists(P.json.cast)) fromArgs.push('--cast', P.json.cast);
    if (exists(P.json.art)) fromArgs.push('--art', P.json.art);
    if (exists(P.json.script)) fromArgs.push('--script', P.json.script);
    if (exists(P.json.storyboard) && exists(P.json.script)) fromArgs.push('--storyboard', P.json.storyboard);
    const r = run('node', [join(REPO, 'scripts', 'report.mjs'), ...fromArgs, '--out', merged, '--lang', lang], { allowFail: true });
    if (r.ok) outs.push([merged, true, 'gộp 5 báo cáo']);
    else outs.push([merged, false, r.err.split('\n').slice(-2).join(' | ')]);
  }
  if(buildDossier(P.root)) outs.push([join(P.root,'production-report.html'),true,'production dossier']);
  for (const [f, good, note] of outs) console.log(`${good ? '✓' : '✗'} ${f.replace(`${P.root}/`, '')}${note ? `  ${note}` : ''}`);
  if (outs.some(([,good]) => !good)) process.exitCode = 1;
  else if (outs.some(([f,good]) => good && f === join(P.root, 'report.html'))) markStage(P, { report: 'done' });
}

/* ------------------------------------------------------------------ */
/* video                                                               */
/* ------------------------------------------------------------------ */

function findFfmpeg() {
  const r = spawnSync('sh', ['-c', 'command -v ffmpeg'], { encoding: 'utf8' });
  const bin = (r.stdout ?? '').trim();
  if (!bin) die('không có ffmpeg trong PATH (cần ffmpeg + libx264 + aac)');
  return bin;
}

/**
 * Ghép video. Nếu có frames/<段>/f*.png thì mỗi cut dùng ảnh thật (zoompan theo seconds),
 * thiếu ảnh thì rơi về card chữ. Lời thoại lấy từ script.json theo beats[] của cut,
 * nên chỉ những câu nằm trong storyboard mới được đọc.
 */
/** Chạy quality gate của mọi tầng đang có; in ✓/✗ + lỗi đầu tiên. Không đổi nội dung. */
function cmdGates(args) {
  const dir = args[0];
  if (!dir) die('cần đường dẫn project');
  const P = projectPaths(dir);
  if (!exists(P.root)) die(`không thấy ${P.root}`);
  const mk = (skill) => join(SKILLS, skill, 'scripts', `${skill}.mjs`);
  const steps = [];
  if (exists(P.json.outline)) steps.push(['outline', 'novel-outline', ['validate', P.json.outline]]);
  if (exists(P.json.cast)) {
    // nguồn đối chiếu evidence: book.txt (tiểu thuyết) hoặc kịch bản gốc người dùng dán vào
    const source = [join(P.root, 'book.txt'), P.scriptfile].find((f) => exists(f));
    if (source) steps.push(['cast', 'novel-characters', ['validate', P.json.cast, source]]);
    else steps.push(['cast', 'novel-characters', ['validate', P.json.cast, P.json.script]]);
  }
  if (exists(P.json.art)) steps.push(['art', 'novel-art', ['validate', P.json.art, ...(exists(P.json.cast) ? ['--cast', P.json.cast] : [])]]);
  if (exists(P.json.script)) steps.push(['script', 'novel-script', ['validate', P.json.script, ...(exists(P.json.outline) ? ['--outline', P.json.outline] : []), ...(exists(P.json.art) ? ['--art', P.json.art] : [])]]);
  if (exists(P.json.staging)) steps.push(['staging', 'novel-staging', ['validate', P.json.staging, ...(exists(P.json.script) ? ['--script', P.json.script] : []), ...(exists(P.json.art) ? ['--art', P.json.art] : [])]]);
  if (exists(P.json.storyboard) && exists(P.json.script)) steps.push(['storyboard', 'novel-storyboard', ['validate', P.json.storyboard, '--script', P.json.script, ...(exists(P.json.outline) ? ['--outline', P.json.outline] : []), ...(exists(P.json.cast) ? ['--cast', P.json.cast] : []), ...(exists(P.json.art) ? ['--art', P.json.art] : [])]]);
  if (!steps.length) die('project chưa có JSON nào để kiểm');
  let fail = 0;
  const gateResults = {};
  for (const [name, skill, argv] of steps) {
    const r = run('node', [mk(skill), ...argv], { allowFail: true, cwd: P.root });
    if (r.ok) { console.log(`✓ ${name}  ${r.out.trim().split('\n').pop() ?? ''}`); gateResults[name] = 'passed'; continue; }
    fail += 1;
    gateResults[name] = 'failed';
    console.log(`✗ ${name}`);
    for (const line of `${r.out}\n${r.err}`.split('\n').map((x) => x.trim()).filter((x) => /^✗|✗|违规|缺 /.test(x) && !/^✓/.test(x)).slice(0, 5)) console.log(`    ${line}`);
  }
  const manifestPath = join(P.root, 'project.json');
  if (exists(manifestPath)) {
    const manifest = readJSON(manifestPath);
    manifest.stages = { ...(manifest.stages ?? {}), gates: fail ? 'failed' : 'passed' };
    manifest.gates = gateResults;
    manifest.lastGateRun = new Date().toISOString();
    writeJSON(manifestPath, manifest);
  }
  if (fail) process.exitCode = 1;
}

/** Export pack H3 cho toàn bộ storyboard (dùng frames/ nếu có). */
function cmdPacks(args) {
  const dir = args[0];
  if (!dir) die('cần đường dẫn project');
  const P = projectPaths(dir);
  if (!exists(P.json.storyboard)) die('chưa có storyboard.json');
  const argv = ['export', P.json.storyboard, '--script', P.json.script, '--out', P.packs, '--protocol', args.includes('--seedance') ? 'seedance' : 'h3'];
  if (exists(P.frames)) argv.push('--frames', P.frames);
  if (exists(P.images)) argv.push('--images', P.images);
  if (exists(P.json.outline)) argv.push('--outline', P.json.outline);
  if (exists(P.json.art)) argv.push('--art', P.json.art);
  if (exists(join(P.root, 'constraints.txt'))) argv.push('--constraints', join(P.root, 'constraints.txt'));
  const r = run('node', [join(SKILLS, 'novel-storyboard', 'scripts', 'novel-storyboard.mjs'), ...argv], { allowFail: true, cwd: P.root });
  console.log(r.ok ? `✓ ${r.out.trim()}` : `✗ ${r.err.split('\n').slice(-3).join(' ')}`);
  if (r.ok) markStage(P, { packs: 'done' });
  if (!r.ok) process.exitCode = 1;
}

function cmdVideo(args) {
  const dir = args[0];
  if (!dir) die('cần đường dẫn project');
  const P = projectPaths(dir);
  if (!exists(P.json.storyboard)) die(`chưa có ${P.json.storyboard}`);
  const ff = findFfmpeg();
  const narr = args.includes('--narration');
  const useAssets = args.includes('--assets') || exists(P.frames);
  const epArg = args.indexOf('--ep') >= 0 ? String(args[args.indexOf('--ep') + 1]) : null;
  const sb = readJSON(P.json.storyboard);
  const script = exists(P.json.script) ? readJSON(P.json.script) : { episodes: [] };

  const lang = (sb.lang ?? script.lang ?? 'zh');
  const fontCands = [
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/PingFang.ttc',
  ];
  const font = fontCands.find(exists) ?? die('không thấy font có glyph CJK (cài fonts-noto-cjk)');
  const ffprobe = spawnSync('sh', ['-c', 'command -v ffprobe'], { encoding: 'utf8' }).stdout?.trim();

  const linesByEp = new Map();
  for (const ep of script.episodes ?? []) {
    const byBeat = new Map();
    let beat = 0;
    for (const sc of ep.scenes ?? []) for (const f of sc.flow ?? []) {
      beat += 1;
      if (f.line) byBeat.set(beat, { speaker: f.speaker, line: f.line, delivery: f.delivery });
    }
    linesByEp.set(ep.ep, byBeat);
  }

  const work = join(P.root, '.video-work');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  mkdirSync(join(P.root, 'video'), { recursive: true });

  const W = 1280, H = (sb.aspectRatio === '9:16' ? 2276 : 720);
  const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019').replace(/%/g, '\\%').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
  const clips = [];
  const stats = { cuts: 0, withFrame: 0, withLine: 0 };

  for (const epBlock of sb.episodes ?? []) {
    if (epArg && String(epBlock.ep) !== epArg) continue;
    for (const seg of epBlock.segments ?? []) {
      const ep = Number(String(seg.id).match(/E(\d+)-/)?.[1] ?? epBlock.ep ?? 1);
      const byBeat = linesByEp.get(ep) ?? new Map();
      const segDir = join(P.frames, seg.id);
      const fps = 25;
      const dur = seg.cuts.reduce((a, c) => a + c.seconds, 0);
      const base = join(work, `${seg.id}.mp4`);
      const out = join(work, `${seg.id}-a.mp4`);

      const hasAssets = useAssets && exists(segDir) && readdirSync(segDir).some((f) => /^f\d+\.png$/.test(f));
      const argsV = ['-y', '-loglevel', 'error'];
      const parts = [];
      const inputs = [];

      seg.cuts.forEach((c, i) => {
        const sec = Number(c.seconds) || 3;
        const img = hasAssets ? join(segDir, `f${i + 1}.png`) : null;
        const line = (c.beats ?? []).map((b) => byBeat.get(b)).find(Boolean) ?? null;
        stats.cuts += 1;
        if (img && exists(img)) stats.withFrame += 1;
        if (line) stats.withLine += 1;
        if (img && exists(img)) {
          inputs.push('-loop', '1', '-framerate', String(fps), '-t', String(sec), '-i', img);
          const k = inputs.filter((x) => x === '-i').length - 1;
          const frames = Math.max(2, Math.round(sec * fps));
          const zoom = c.size === 'extreme-wide' || c.size === 'wide' ? '1.12' : c.size === 'close-up' || c.size === 'extreme-close-up' ? '1.20' : '1.08';
          const sub = [
            line ? `drawtext=fontfile=${font}:text='${esc(line.line.slice(0, 22))}':fontcolor=white:fontsize=34:box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=h-text_h-110` : null,
            line && line.line.length > 22 ? `drawtext=fontfile=${font}:text='${esc(line.line.slice(22, 44))}':fontcolor=white:fontsize=34:box=1:boxcolor=black@0.55:boxborderw=14:x=(w-text_w)/2:y=h-text_h-60` : null,
            `drawtext=fontfile=${font}:text='${seg.id} · ${i + 1}/${seg.cuts.length}':fontcolor=white@0.75:fontsize=22:box=1:boxcolor=black@0.5:boxborderw=8:x=32:y=32`,
          ].filter(Boolean).join(',');
          parts.push(`[${k}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},zoompan=z='min(1+0.0015*on,${zoom})':d=${frames}:s=${W}x${H}:fps=${fps},trim=duration=${sec},setpts=PTS-STARTPTS,${sub}[v${i}]`);
        } else {
          inputs.push('-f', 'lavfi', '-t', String(sec), '-i', `color=c=black:s=${W}x${H}:r=25`);
          const k = inputs.filter((x) => x === '-i').length - 1;
          const card = [
            `drawbox=x=40:y=40:w=${W - 80}:h=${H - 80}:color=0x121212@1:t=fill`,
            `drawbox=x=56:y=56:w=${W - 112}:h=${H - 112}:color=0x8a1c1c@1:t=4`,
            `drawtext=fontfile=${font}:text='${esc(`${seg.id} · ${i + 1}/${seg.cuts.length} · ${sec}s · ${c.camera ?? ''}`)}':fontcolor=0xd8d0c0:fontsize=26:x=90:y=110`,
            `drawtext=fontfile=${font}:text='${esc(String(c.frame ?? '').slice(0, 24))}':fontcolor=white:fontsize=34:x=90:y=250`,
            `drawtext=fontfile=${font}:text='${esc(String(c.frame ?? '').slice(24, 48))}':fontcolor=white:fontsize=34:x=90:y=300`,
            `drawtext=fontfile=${font}:text='${esc(String(c.frame ?? '').slice(48, 72))}':fontcolor=white:fontsize=34:x=90:y=350`,
            `drawtext=fontfile=${font}:text='${esc(`${c.size ?? ''} / ${c.lens ?? ''}`)}':fontcolor=0x9fd0ff:fontsize=24:x=90:y=420`,
            ...(line ? [`drawtext=fontfile=${font}:text='${esc(line.line.slice(0, 22))}':fontcolor=0xffe08a:fontsize=40:x=90:y=${H - 170}`, `drawtext=fontfile=${font}:text='${esc(line.line.slice(22, 44))}':fontcolor=0xffe08a:fontsize=40:x=90:y=${H - 120}`, `drawtext=fontfile=${font}:text='${esc(`（${line.speaker ?? ''}  ${line.delivery ?? ''}）`)}':fontcolor=0xb0b0b0:fontsize=22:x=90:y=${H - 70}`] : []),
          ].join(',');
          parts.push(`[${k}:v]${card}[v${i}]`);
        }
      });

      const labels = seg.cuts.map((_, i) => `[v${i}]`).join('');
      argsV.push(...inputs, '-filter_complex', `${parts.join(';')};${labels}concat=n=${seg.cuts.length}:v=1:a=0[vc];[vc]setsar=1[v]`, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '25', base);
      run(ff, argsV);

      // âm thanh: giọng đọc do TTS bên ngoài đổ vào voice/<seg>-<n>.wav; thiếu thì để im lặng
      const aArgs = ['-y', '-loglevel', 'error'];
      const af = [];
      let ai = 0;
      const aLabels = [];
      seg.cuts.forEach((c, i) => {
        const sec = Number(c.seconds) || 3;
        const wav = join(P.voice, `${seg.id}-${i + 1}.wav`);
        if (narr && exists(wav) && sizeOf(wav) > 1000) {
          aArgs.push('-i', wav);
          af.push(`[${ai + 1}:a]atrim=0:${sec},asetpts=PTS-STARTPTS,apad=whole_dur=${sec},loudnorm=I=-18:TP=-2[a${i}]`);
          ai += 1;
        } else {
          af.push(`anullsrc=r=44100:cl=stereo,atrim=0:${sec},apad=whole_dur=${sec}[a${i}]`);
        }
        aLabels.push(`[a${i}]`);
      });
      aArgs.push('-i', base, '-filter_complex', `${af.join(';')};${aLabels.join('')}concat=n=${seg.cuts.length}:v=0:a=1[a]`, '-map', `${ai}:v`, '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', out);
      run(ff, aArgs);
      clips.push(out);
    }
  }

  if (!clips.length) die('storyboard không có segment nào (hoặc --ep không khớp)');
  const list = join(work, 'list.txt');
  writeFileSync(list, clips.map((c) => `file '${c.replace(/'/g, `'\\''`)}'`).join('\n'));
  const name = `${sb.source ?? 'project'}-${epArg ? `E${epArg.padStart(2, '0')}` : 'full'}${narr ? '-tts' : ''}.mp4`.replace(/\s+/g, '_');
  const final = join(P.root, 'video', name);
  run(ff, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', final]);

  log(`✓ ${final.replace(`${REPO}/`, '')}`);
  markStage(P, { video: 'done' });
  log(`  ${clips.length} segment · ${stats.cuts} cut · ${stats.withFrame} có ảnh thật · ${stats.withLine} có lời thoại`);
  if (stats.withFrame < stats.cuts) log(`  ${stats.cuts - stats.withFrame} cut vẫn là placeholder — chạy bước frames rồi dựng lại để thay bằng ảnh thật`);
}

/** ffmpeg flite chỉ có tiếng Anh; dùng được khi kịch bản là tiếng Anh và không có TTS ngoài. */
function findTts() {
  for (const c of ['espeak-ng', 'espeak']) {
    const r = spawnSync('sh', ['-c', `command -v ${c}`], { encoding: 'utf8' });
    if ((r.stdout ?? '').trim()) return (r.stdout ?? '').trim();
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || cmd === '-h' || cmd === '--help') {
  console.log(`shuohao-skills project pipeline

  new    --name <slug> --script <file> [--force]   dựng khung từ kịch bản (json/md/txt)
  sample --name <slug> [--force] [--lang zh|en]   chạy toàn bộ dự án mẫu 渡口 (copy + gate + render + export)
  new    --name <slug> --from-sample              dựng khung rỗng từ mẫu 渡口
  render <project> [--lang zh|en]                 render 5 báo cáo + report.html
  video  <project> [--narration] [--ep N] [--assets]  ghép video (có frames/ thì dùng ảnh thật)
  gates  <project>                                chạy quality gate mọi tầng đang có
  packs  <project> [--seedance]                    export pack H3/Seedance cho từng đoạn
  status <project>                                xem tiến độ từng file
  brief  <project>                                in JSON đầu vào cho agent (briefs + thiếu gì)
  from-text <project>                             dựng script.json (draft) từ script.md đã đánh số beat

không gọi model; bước viết nội dung/sinh ảnh do agent làm theo SKILL.md.`);
} else if (cmd === 'new') cmdNew(rest);
else if (cmd === 'sample') cmdSample(rest);
else if (cmd === 'render') cmdRender(rest);
else if (cmd === 'video') cmdVideo(rest);
else if (cmd === 'gates') cmdGates(rest);
else if (cmd === 'packs') cmdPacks(rest);
else if (cmd === 'status') cmdStatus(rest);
else if (cmd === 'brief') cmdBrief(rest);
else if (cmd === 'from-text') cmdFromText(rest);
else die(`lệnh không rõ: ${cmd}`);
void ui; void PIPELINE;
