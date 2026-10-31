#!/usr/bin/env node
// build-panel — 把五层产物串成一张控制台单页（index.html）。
// 零依赖：只读同级目录里的 json / 报告 html，统计后填进 assets/panel-template.html。
//
//   node build-panel.mjs [项目根] [--out index.html] [--title 剧名] [--quiet]
//
// 面板只读不写产物：json 变了、图补了，重跑一次就是最新的。

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = resolve(HERE, '..', 'assets', 'panel-template.html');
const SKIP_DIRS = new Set(['node_modules', '.git', 'images', 'work', 'dist', '.workbuddy']);

/* ---------------- 参数 ---------------- */
const argv = process.argv.slice(2);
const flag = (name, def = null) => {
  const i = argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
};
const positional = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
const ROOT = resolve(positional || process.cwd());
const OUT = resolve(ROOT, String(flag('out', 'index.html')));
const QUIET = flag('quiet', false);

/* ---------------- 扫盘 ---------------- */
function scan(dir, depth, acc) {
  if (depth > 2) return acc;
  let ents = [];
  try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of ents) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) scan(p, depth + 1, acc);
    else if (e.isFile()) acc.push(p);
  }
  return acc;
}

const all = scan(ROOT, 0, []);
const rel = (p) => relative(ROOT, p).split('\\').join('/');

function findOne(suffix, preferDir) {
  const hits = all.filter((p) => p.endsWith(suffix));
  if (!hits.length) return null;
  hits.sort((a, b) => {
    const pa = rel(a).startsWith(preferDir + '/') ? 0 : 1;
    const pb = rel(b).startsWith(preferDir + '/') ? 0 : 1;
    return pa - pb || a.length - b.length;
  });
  return hits[0];
}

const readJson = (p) => {
  if (!p) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
};

const outlinePath = findOne('-outline.json', 'outline');
const castPath = findOne('-cast.json', 'characters');
const artPath = findOne('-art.json', 'art');
const scriptPath = findOne('-script.json', 'script');
const boardPath = findOne('-storyboard.json', 'storyboard');
const manifestPath = boardPath
  ? (existsSync(join(dirname(boardPath), 'manifest.json')) ? join(dirname(boardPath), 'manifest.json') : null)
  : findOne('manifest.json', 'storyboard');

const outline = readJson(outlinePath);
const cast = readJson(castPath);
const art = readJson(artPath);
const script = readJson(scriptPath);
const board = readJson(boardPath);
const manifest = readJson(manifestPath);

/* ---------------- 找报告 ---------------- */
function findReport(jsonPath) {
  if (!jsonPath) return null;
  const dir = dirname(jsonPath);
  let ents = [];
  try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  const htmls = ents.filter((e) => e.isFile() && e.name.endsWith('.html')).map((e) => join(dir, e.name));
  return htmls.find((p) => p.endsWith('-report.html')) || htmls.find((p) => basename(p) === 'report.html') || null;
}
const outlineReport = findReport(outlinePath);
const castReport = findReport(castPath);
const artReport = findReport(artPath);
const scriptReport = findReport(scriptPath);
const boardReport = findReport(boardPath);

/* 质量门数字从报告徽标里取，没有报告就留空 */
function gates(reportPath) {
  if (!reportPath) return null;
  try {
    const h = readFileSync(reportPath, 'utf8');
    const m = h.match(/质量门\s*(\d+)\s*\/\s*(\d+)/) || h.match(/quality gate[s]?\s*(\d+)\s*\/\s*(\d+)/i);
    if (!m) return null;
    return { pass: Number(m[1]), total: Number(m[2]) };
  } catch { return null; }
}

/* ---------------- 统计 ---------------- */
const num = (n, d = 1) => Number.isFinite(n) ? Number(n.toFixed(d)) : 0;
const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

const title = flag('title', null)
  || outline?.source || board?.source || script?.source || art?.source || cast?.source
  || basename(ROOT);

const aspect = board?.aspectRatio || outline?.params?.aspectRatio || '';
const promptLang = board?.promptLang || '';

/* 集数与时长 */
const outlineEps = outline?.episodes?.length || 0;
const boardEps = board?.episodes?.length || 0;
const epCount = outlineEps || boardEps || script?.episodes?.length || 0;
const targetSeconds = sum(script?.episodes || [], (e) => e.targetSeconds);

/* 角色 */
const castChars = cast?.characters || [];
const outlineChars = outline?.characters || [];
const leads = castChars.filter((c) => /protagonist|lead|main/i.test(c.importance || '')).length
  || outlineChars.filter((c) => /lead|main/i.test(c.tier || '')).length;

/* 场景 / 道具 */
const artScenes = art?.scenes || [];
const artProps = art?.props || [];
const anchors = sum(artScenes, (s) => (s.anchors || []).length);
const primaryScenes = artScenes.filter((s) => s.primary).length;

/* 剧本 */
const scriptScenes = sum(script?.episodes || [], (e) => (e.scenes || []).length);
const lines = sum(script?.episodes || [], (e) => sum(e.scenes || [], (sc) => (sc.flow || []).filter((f) => f.line && String(f.line).trim()).length));

/* 分镜 */
const segsRaw = (board?.episodes || []).flatMap((e) => (e.segments || []).map((sg) => ({ ep: e.ep, sg })));
const cutList = segsRaw.flatMap(({ sg }) => sg.cuts || []);
const boardSeconds = sum(cutList, (c) => c.seconds);
const segMax = Number(board?.params?.maxSegmentSeconds) || 15;
const cutMin = cutList.length ? Math.min(...cutList.map((c) => Number(c.seconds) || 0)) : 0;
const cutMax = cutList.length ? Math.max(...cutList.map((c) => Number(c.seconds) || 0)) : 0;

/* 生成批次：同场次（sceneId）+ 同光照归一批，与报告的口径一致 */
function batchCount() {
  if (!board) return 0;
  const sceneOf = new Map();
  (script?.episodes || []).forEach((e) => {
    (e.scenes || []).forEach((sc, i) => sceneOf.set(e.ep + ':' + (i + 1), sc));
  });
  const set = new Set();
  (board.episodes || []).forEach((e) => {
    (e.segments || []).forEach((sg) => {
      const sc = sceneOf.get(e.ep + ':' + sg.sceneIndex);
      const key = sc ? `${sc.sceneId}|${sc.lighting || ''}` : `?${e.ep}:${sg.sceneIndex}`;
      set.add(key);
    });
  });
  return set.size;
}
const batches = batchCount();

/* 投产包 */
function resolveAsset(p) {
  if (!p) return { path: null, exists: false };
  const cands = [resolve(ROOT, p), manifestPath ? resolve(dirname(manifestPath), p) : null].filter(Boolean);
  const hit = cands.find((c) => existsSync(c));
  if (hit) return { path: rel(hit), exists: true };
  return { path: p.split('\\').join('/'), exists: false };
}

const segs = (manifest || []).map((m) => {
  const pics = m.pictures || [];
  const done = pics.filter((p) => existsSync(resolve(ROOT, p)) || (manifestPath && existsSync(resolve(dirname(manifestPath), p)))).length;
  const prompt = resolveAsset(m.prompt);
  return {
    id: m.segment,
    seconds: Number(m.seconds) || 0,
    cuts: Number(m.cuts) || pics.length || 0,
    done,
    prompt: prompt.exists ? prompt.path : (m.prompt || '')
  };
});

const total = segs.length ? segs.reduce((a, s) => a + s.cuts, 0) : cutList.length;
const done = segs.length ? segs.reduce((a, s) => a + Math.min(s.done, s.cuts), 0) : 0;

/* 分集汇总 */
const epAgg = new Map();
(segs.length ? segs : []).forEach((s) => {
  const ep = Number(String(s.id).slice(1, 3)) || 1;
  const a = epAgg.get(ep) || { ep, segs: 0, cuts: 0, seconds: 0, missing: 0, done: 0 };
  a.segs += 1; a.cuts += s.cuts; a.seconds += s.seconds; a.done += s.done; a.missing += Math.max(0, s.cuts - s.done);
  epAgg.set(ep, a);
});
const episodes = [...epAgg.values()].sort((a, b) => a.ep - b.ep);

/* 产物清单 */
function sizeOf(p) {
  try {
    const b = statSync(p).size;
    return b > 1024 * 1024 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
  } catch { return ''; }
}
const fileList = [
  outlinePath, castPath, artPath, scriptPath, boardPath,
  outlineReport, castReport, artReport, scriptReport, boardReport,
  manifestPath,
  findOne('-storyboard.md', 'storyboard'),
].filter(Boolean);
const files = fileList.map((p) => ({ path: rel(p), exists: existsSync(p), size: existsSync(p) ? sizeOf(p) : '' }));
files.sort((a, b) => Number(b.exists) - Number(a.exists));

/* ---------------- 层 ---------------- */
const layerSpec = [
  {
    key: 'outline', no: '01', name: '大纲', en: 'OUTLINE', dir: 'outline',
    json: outlinePath, report: outlineReport, ok: !!outline,
    stats: outline ? [
      ['集数', epCount + ' 集' + (targetSeconds ? ' / ' + targetSeconds + ' 秒' : '')],
      ['角色', String(outlineChars.length || castChars.length || '—')],
      ['场景', String((outline.scenes || []).length || artScenes.length || '—')],
      ['爽点', String((outline.beats || []).length || '—')],
      ['道具', String((outline.props || []).length || artProps.length || '—')],
    ] : [],
    note: outline ? `${epCount} 集 · ${outlineChars.length} 角色 · ${(outline.scenes || []).length} 场景` : '未找到大纲'
  },
  {
    key: 'cast', no: '02', name: '角色', en: 'CAST', dir: 'characters',
    json: castPath, report: castReport, ok: !!cast,
    stats: cast ? [
      ['角色卡', castChars.length + ' 张'],
      ['主演', leads ? leads + ' 人' : '—'],
      ['出图', '英文提示词 + 设定图版面'],
      ['配音', 'TTS 音色提示词'],
    ] : [],
    note: cast ? `${castChars.length} 张卡 · 出图与配音提示词` : '未找到角色卡'
  },
  {
    key: 'art', no: '03', name: '美术', en: 'ART', dir: 'art',
    json: artPath, report: artReport, ok: !!art,
    stats: art ? [
      ['场景', artScenes.length + (primaryScenes ? `（${primaryScenes} 主景）` : '')],
      ['道具', String(artProps.length)],
      ['锚点', anchors ? `${anchors} 条` : '—'],
      ['光线', '每景独立布光'],
    ] : [],
    note: art ? `${artScenes.length} 场景 · ${artProps.length} 道具 · ${anchors} 锚点` : '未找到场景设定'
  },
  {
    key: 'script', no: '04', name: '剧本', en: 'SCRIPT', dir: 'script',
    json: scriptPath, report: scriptReport, ok: !!script,
    stats: script ? [
      ['场次', String(scriptScenes)],
      ['台词', lines + ' 句'],
      ['目标时长', targetSeconds ? targetSeconds + ' 秒' : '—'],
      ['钩子', (script.episodes || []).every((e) => e.hook) ? '每集冷开场' : '部分未写'],
    ] : [],
    note: script ? `${scriptScenes} 场 · ${lines} 句 · ${targetSeconds || '—'} 秒` : '未找到剧本'
  },
  {
    key: 'board', no: '05', name: '分镜', en: 'STORYBOARD', dir: 'storyboard',
    json: boardPath, report: boardReport, ok: !!board,
    stats: board ? [
      ['段', `${segsRaw.length}（≤${segMax} 秒）`],
      ['切', String(cutList.length)],
      ['秒', `${num(boardSeconds)}`],
      ['批次', String(batches)],
    ] : [],
    note: board ? `${segsRaw.length} 段 · ${cutList.length} 切 · ${num(boardSeconds)} 秒` : '未找到分镜'
  },
];

const layers = layerSpec.map((l) => {
  const g = gates(l.report);
  return {
    key: l.key, no: l.no, name: l.name, en: l.en, ok: l.ok,
    file: l.json ? basename(l.json) : null,
    json: l.json ? rel(l.json) : null,
    href: l.report ? rel(l.report) : null,
    note: l.note,
    stats: l.stats,
    gate: g ? `${g.pass}/${g.total}` : (l.ok ? '已生成' : '缺'),
    tone: g ? (g.pass === g.total ? '' : 'wait') : (l.ok ? 'mute' : 'mute'),
  };
});

/* ---------------- 提示条 ---------------- */
const warnings = [];
layerSpec.filter((l) => !l.ok).forEach((l) => warnings.push(`缺「${l.name}」：${l.dir}/*.json 还没生成，这一层暂时是空的。`));
if (outlineEps && boardEps && boardEps < outlineEps) {
  warnings.push(`分镜只覆盖前 ${boardEps} 集，大纲共 ${outlineEps} 集——剩下的 ${outlineEps - boardEps} 集还没切。`);
}
if (total && done < total) warnings.push(`还有 ${total - done} 张分镜图未出，投产包暂时不能直接下单。`);

/* ---------------- 设定资产 ---------------- */
const imgRoot = join(ROOT, 'images');
const imgFiles = existsSync(imgRoot) ? scan(imgRoot, 0, []) : [];
const sheetOf = (name) => {
  if (!name) return null;
  const want = `${name}-sheet.png`;
  return imgFiles.find((p) => basename(p) === want) || null;
};
/* 角色优先用 1:1 头像（<name>-avatar.png），没有才退回设定图 */
const faceOf = (name) => {
  if (!name) return null;
  const want = `${name}-avatar.png`;
  return imgFiles.find((p) => basename(p) === want) || null;
};

const assetChars = (cast?.characters || outline?.characters || []).map((c, i) => {
  const p = faceOf(c.name) || sheetOf(c.name);
  return { id: c.id || `C${String(i + 1).padStart(2, '0')}`, name: c.name, file: p ? rel(p) : null };
});

const assetArts = [
  ...(art?.scenes || []).map((s) => ({ id: s.id, name: s.name, kind: '场景' })),
  ...(art?.props || []).map((p) => ({ id: p.id, name: p.name, kind: '道具' })),
].map((x) => {
  const p = sheetOf(x.name);
  return { ...x, file: p ? rel(p) : null };
});

if (assetChars.length || assetArts.length) {
  const missingSheets = [...assetChars, ...assetArts].filter((a) => !a.file).map((a) => a.name);
  if (missingSheets.length) {
    warnings.push(`设定图还缺 ${missingSheets.length} 张（${missingSheets.slice(0, 3).join('、')}${missingSheets.length > 3 ? ' 等' : ''}），分镜图的一致性会打折扣。`);
  }
}

/* ---------------- 组装 ---------------- */
const data = {
  title,
  subtitle: `${basename(ROOT)} · 生成于 ${new Date().toISOString().slice(0, 10)}`,
  tags: [
    epCount ? `${epCount} 集` : null,
    aspect || null,
    promptLang ? (promptLang === 'zh' ? '中文提示词' : '英文提示词') : null,
    boardSeconds ? `${num(boardSeconds)}s` : null,
  ].filter(Boolean),
  facts: [
    [String(epCount || '—'), 'EPISODES'],
    [String(segsRaw.length || '—'), 'SEGMENTS'],
    [String(cutList.length || '—'), 'CUTS'],
    [boardSeconds ? String(num(boardSeconds)) : '—', 'SECONDS'],
  ],
  overviewNote: warnings.length ? `${warnings.length} 条待办` : '全链路就绪',
  heroTitle: '从一份剧本到一条可下单的流水线',
  heroLead: [
    boardSeconds ? `${epCount} 集、${segsRaw.length} 段、${cutList.length} 个分镜，合计 ${num(boardSeconds)} 秒。` : '',
    '五层串成一条链，上一层的产出就是下一层的输入；质量门由脚本把关，不是拍脑袋。'
  ].filter(Boolean).join(''),
  warnings,
  layers,
  segs,
  total,
  done,
  episodes,
  files,
  assets: { characters: assetChars, art: assetArts },
  outlineHref: outlineReport ? rel(outlineReport) : (outlinePath ? rel(outlinePath) : '#'),
  boardHref: boardReport ? rel(boardReport) : (boardPath ? rel(boardPath) : '#'),
  manifestHref: manifestPath ? rel(manifestPath) : '#',
};

/* ---------------- 渲染 ---------------- */
if (!existsSync(TEMPLATE)) {
  console.error('找不到模板：' + TEMPLATE);
  process.exit(1);
}
const tpl = readFileSync(TEMPLATE, 'utf8');
const json = JSON.stringify(data).replace(/<\//g, '<\\/');
const html = tpl
  .replace(/\/\*__PANEL_DATA__\*\//, json)
  .replace(/__PANEL_TITLE__/g, title.replace(/[<>&]/g, ' '));

writeFileSync(OUT, html);

if (!QUIET) {
  const miss = data.layers.filter((l) => !l.ok).map((l) => l.name);
  console.log(`面板已生成：${rel(OUT) || OUT}`);
  console.log(`  ${epCount} 集 · ${segsRaw.length} 段 · ${cutList.length} 切 · ${boardSeconds ? num(boardSeconds) : 0} 秒 · 批次 ${batches}`);
  console.log(`  分镜图 ${done}/${total}` + (miss.length ? ` · 缺层：${miss.join('、')}` : ''));
  warnings.forEach((w) => console.log('  · ' + w));
}
