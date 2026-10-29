#!/usr/bin/env node
/**
 * Studio server: dán kịch bản trên web → server chia phần và dựng project → agent (Kilo) viết tiếp.
 *
 *   node preview/pipeline/studio.mjs [--port 4321] [--no-open]
 *
 * Chỉ nghe 127.0.0.1. Ghi file chỉ trong projects/<slug>/, slug được lọc ký tự.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync, createReadStream } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { splitScript, buildProject, buildFromFiles } from './split.mjs';
import { readScriptFile, ALLOWED } from './upload.mjs';
import { handleAI, status as aiStatus, isGenerating } from '../../scripts/studio-ai.mjs';
import {activeEditionDir} from '../../scripts/project-edition.mjs';
import {englishStatus} from '../../scripts/english-project.mjs';
import {handleImages} from '../../scripts/studio-images.mjs';
import { viUiTemplate } from './import-manifest.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PROJECTS = join(ROOT, 'projects');
const PREVIEW = join(ROOT, 'preview');
const MAX_BODY = 2 * 1024 * 1024;

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const PORT = Number(arg('--port', '8765'));

const slugify = (name) => String(name ?? '')
  .normalize('NFC')
  .trim()
  .replace(/[\s/\\:*?"<>|·]+/g, '-')
  .replace(/[^\p{L}\p{N}_-]+/gu, '')
  .replace(/^-+|-+$/g, '')
  .replace(/^-+|-+$/g, '')
  .slice(0, 60) || 'du-an-moi';

const json = (res, code, body) => {
  const data = JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(data);
};

const readRaw = (req) => new Promise((resolvePromise, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) { reject(new Error('file quá lớn (giới hạn 2MB)')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolvePromise(Buffer.concat(chunks)));
  req.on('error', reject);
});

const readBody = (req) => new Promise((resolvePromise, reject) => {
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > MAX_BODY) { reject(new Error('kịch bản quá lớn (giới hạn 2MB)')); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const projectDir = (slug) => {
  const clean = slugify(slug);
  const dir = join(PROJECTS, clean);
  if (!dir.startsWith(PROJECTS)) throw new Error('đường dẫn không hợp lệ');
  return { slug: clean, dir };
};

function projectSummary(slug, dir) {
  const originalDir=dir;dir=activeEditionDir(dir);
  const p = (f) => join(dir, f);
  const manifest = existsSync(p('project.json')) ? JSON.parse(readFileSync(p('project.json'), 'utf8')) : null;
  const size = (f) => (existsSync(p(f)) ? statSync(p(f)).size : 0);
  const count = (d, re) => (existsSync(p(d)) ? readdirSync(p(d)).filter((x) => re.test(x)).length : 0);
  return {
    slug,
    source: manifest?.source ?? slug,
    origin: manifest?.origin ?? 'cli',
    warnings: manifest?.warnings ?? [],
    episodes: manifest?.episodes ?? [],
    params: manifest?.params ?? {},
    timing: manifest?.timing ?? null,
    stages: manifest?.stages ?? {},
    ai: aiStatus(originalDir),
    english: englishStatus(originalDir),
    edition: dir===originalDir?'source':'en',
    files: {
      outline: size('outline.json'), script: size('script.json'), cast: size('cast.json'),
      art: size('art.json'), staging: size('staging.json'), storyboard: size('storyboard.json'),
      report: size('report.html'), outlineReport: size('outline-report.html'),
      castReport: size('cast-report.html'), artReport: size('art-report.html'),
      scriptReport: size('script-report.html'), stagingReport: size('staging-report.html'),
      storyboardReport: size('storyboard-report.html'),
      split: size('split.json'), kichban: size('kichban.md') || size('script.md'),
      references:existsSync(join(originalDir,'reference-images.json'))?statSync(join(originalDir,'reference-images.json')).size:0, subtitles:size('subtitles.json'), reading: size('reading.json'), production: size('production.json'), productionReport: size('production-report.html'),
    },
    images: count('images', /-sheet\.png$/),
    frames: count('frames', /^E\d+-\d+$/),
    packs: count('packs', /^E\d+-\d+$/),
    video: existsSync(p('video')) ? readdirSync(p('video')).filter((f) => f.endsWith('.mp4')) : [],
  };
}

/** Các thao tác chạy được bằng máy, không cần model. */
const SCENARIOS = [
  {
    id: 'sample',
    label: 'Chạy toàn bộ dự án mẫu 渡口 (copy + gate + báo cáo + pack)',
    needsProject: false,
    args: () => ['preview/pipeline/project.mjs', 'sample', '--name', 'mau-dukou', '--force'],
  },
  {
    id: 'gates',
    label: 'Chạy quality gate của mọi tầng đang có',
    needsProject: true,
    args: ({ dir }) => ['preview/pipeline/project.mjs', 'gates', dir],
  },
  {
    id: 'render',
    label: 'Render báo cáo HTML + Markdown + report.html',
    needsProject: true,
    args: ({ dir }) => ['preview/pipeline/project.mjs', 'render', dir],
  },
  {
    id: 'packs',
    label: 'Export pack H3 cho từng đoạn',
    needsProject: true,
    args: ({ dir }) => ['preview/pipeline/project.mjs', 'packs', dir],
  },
  {
    id: 'video',
    label: 'Ghép video (dùng frames/ nếu có, thiếu thì card chữ)',
    needsProject: true,
    args: ({ dir }) => ['preview/pipeline/project.mjs', 'video', dir],
  },
];

function runScenario(id, slug) {
  if (id === 'build') return buildPreview();
  const sc = SCENARIOS.find((s) => s.id === id);
  if (!sc) throw new Error('thao tác không tồn tại');
  const target = sc.needsProject ? projectDir(slug) : null;
  if (target && !existsSync(target.dir)) throw new Error('project chưa tồn tại');
  if (target && isGenerating(target.dir)) throw new Error('AI đang biên soạn. Dừng AI trước khi chạy thao tác này.');
  const out = spawnSync(process.execPath, sc.args(target ? {...target,dir:activeEditionDir(target.dir)} : {}), { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  return { ok: out.status === 0, code: out.status, output: `${out.stdout ?? ''}${out.stderr ?? ''}`.trim().slice(-8000) };
}

/** Studio HTML + thanh chọn ngôn ngữ dùng chung (language.js / translations.json) như các báo cáo. */
function renderStudioHtml() {
  let html = readFileSync(join(HERE, 'studio.html'), 'utf8');
  if (html.includes('src="/language.js"')) return html;
  html = html.replace(/<html\b([^>]*)>/i, (_m, attrs) => `<html${attrs.replace(/\s+lang="[^"]*"/i, '')} lang="vi" class="sh-locale-loading">`);
  html = html.replace('</head>', '<link rel="stylesheet" href="/language.css"><script src="/json-export.js" defer></script><script src="/language.js" defer></script><noscript><style>.sh-locale-loading body>*{visibility:visible!important}</style></noscript></head>');
  return html;
}

/** Dựng lại các báo cáo tĩnh của dự án mẫu vào preview/ (cùng nội dung scripts/build-preview.mjs). */
function buildPreview() {
  const r = spawnSync(process.execPath, [join(ROOT, 'scripts', 'build-preview.mjs')], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
  return { ok: r.status === 0, code: r.status, output: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().slice(-4000) };
}

/* ---------------- routes ---------------- */

async function handle(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  if (await handleImages(req,res,{url,readBody,json,projectDir,isGenerating})) return;
  if (await handleAI(req,res,{url,readBody,json,projectDir,slugify,splitScript})) return;

  if (path === '/' || path === '/index.html' || path === '/studio.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(renderStudioHtml());
    return;
  }

  if (path === '/api/projects' && req.method === 'GET') {
    if (!existsSync(PROJECTS)) mkdirSync(PROJECTS, { recursive: true });
    const list = readdirSync(PROJECTS)
      .filter((n) => existsSync(join(PROJECTS, n, 'project.json')))
      .map((n) => projectSummary(n, join(PROJECTS, n)))
      .sort((a, b) => String(b.slug).localeCompare(String(a.slug)));
    json(res, 200, { projects: list });
    return;
  }

  /* Ghép nhiều file đã tải lên thành một dự án (mỗi file một tầng) */
  if (path === '/api/assemble' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}');
    const files = Array.isArray(body.files) ? body.files : [];
    const picked = {};
    const rejected = [];
    for (const f of files) {
      try {
        const parsed = readScriptFile(f.name, Buffer.from(String(f.content ?? ''), 'utf8'));
        const kind = parsed.kind;
        if (kind === 'manifest') {
          const layers = parsed.layers;
          // cast tiếng Việt cần bảng dịch UI, nếu không validate sẽ chặn
          if (layers.cast.lang === 'vi' && !layers.cast.ui) {
            const r = spawnSync(process.execPath, [join(ROOT, 'skills', 'novel-characters', 'scripts', 'novel-characters.mjs'), 'ui-template', 'vi'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
            if (r.status === 0) {
              try { layers.cast.ui = viUiTemplate(JSON.parse(r.stdout)); } catch { /* để trống, validate sẽ nhắc */ }
            }
          }
          for (const [k, doc] of [['outline', layers.outline], ['cast', layers.cast], ['art', layers.art], ['script', layers.script]]) {
            picked[k] = { name: `${f.name} → ${k}.json`, doc, text: null };
          }
          // storyboard KHÔNG tự sinh: shot list của manifest dài 4–11s/shot, cần agent chia lại theo H3
          rejected.push(...(parsed.warnings ?? []).map((w) => `${f.name}: ${w}`));
          continue;
        }
        if (['outline', 'cast', 'art', 'staging', 'storyboard', 'script'].includes(kind)) {
          // cùng loại thì file sau ghi đè, nhưng báo lại
          if (picked[kind]) rejected.push(`${f.name}: trùng tầng ${kind} với ${picked[kind].name}, dùng file này`);
          picked[kind] = { name: f.name, doc: parsed.doc, text: parsed.text };
        } else {
          rejected.push(`${f.name}: ${kind === 'text' || kind === 'txt' || kind === 'md' ? 'là văn bản, không phải tầng dự án' : 'không nhận ra tầng'}`);
        }
      } catch (e) {
        rejected.push(`${f.name}: ${e.message}`);
      }
    }
    if (!Object.keys(picked).length) { json(res, 400, { error: 'không file nào là tầng dự án (outline/script/cast/art/staging/storyboard)', skipped: rejected }); return; }
    const slug = slugify(body.slug || picked.outline?.doc?.source || picked.script?.doc?.source || 'du-an-tai-len');
    const { dir } = projectDir(slug);
    if (existsSync(dir) && !body.overwrite && !String(body.slug ?? '').startsWith('__')) { json(res, 409, { error: `project "${slug}" đã tồn tại`, slug }); return; }
    if (existsSync(dir) && isGenerating(dir)) { json(res,409,{error:'AI đang biên soạn dự án này.'}); return; }
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const out = buildFromFiles(picked, { slug, targetDir: dir });
    spawnSync(process.execPath, [join(HERE, 'book.mjs'), dir], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
    json(res, 201, { slug, dir: dir.replace(`${ROOT}/`, ''), wrote: out.wrote, missing: Object.keys({ outline: 1, cast: 1, art: 1, script: 1, staging: 1, storyboard: 1 }).filter((k) => !out.wrote.includes(k)), skipped: rejected, warnings: out.manifest.warnings });
    return;
  }

  if (path === '/api/upload' && req.method === 'POST') {
    const name = url.searchParams.get('name') ?? req.headers['x-filename'] ?? 'kichban.txt';
    try {
      const buffer = await readRaw(req);
      const parsed = readScriptFile(name, buffer);
      if (parsed.kind === 'manifest') {
        json(res, 200, {
          file: { name, bytes: buffer.length, kind: 'manifest' },
          text: null,
          layer: 'manifest',
          layers: parsed.layers,
          split: { episodes: parsed.layers.outline.episodes.map((e) => e.ep), stats: { episodes: parsed.layers.outline.episodes.length, lines: parsed.layers.script.episodes.reduce((a, e) => a + e.scenes[0].flow.filter((f) => f.line).length, 0), actions: parsed.layers.script.episodes.reduce((a, e) => a + e.scenes[0].flow.filter((f) => f.action).length, 0), characters: parsed.layers.cast.characters.length, props: parsed.layers.art.props.length, scenes: parsed.layers.art.scenes.length, beats: 0, estimateSeconds: Math.round(parsed.layers.script.episodes.reduce((a, e) => a + e.targetSeconds, 0)) }, meta: { title: parsed.meta.title, genre: parsed.layers.outline.params.genre, logline: parsed.layers.outline.adaptation.core }, characters: parsed.layers.cast.characters.map((c) => ({ id: c.name, name: c.name })), scenes: parsed.layers.art.scenes.map((s) => ({ id: s.id, name: s.name })), beats: [], episodes: parsed.layers.outline.episodes.map((e) => ({ ep: e.ep, title: e.hook, sceneIds: e.sceneIds, lighting: '', beats: [], estimateSeconds: e.targetSeconds })), unknownSpeakers: [] },
          warnings: parsed.warnings,
          suggestedSlug: slugify(parsed.meta.title ?? name),
          accepted: ALLOWED,
        });
        return;
      }
      if (!parsed.text) {
        // file là một tầng dự án (cast/art/staging/storyboard) — báo để UI xếp vào bộ nhiều file
        json(res, 200, { file: { name, bytes: buffer.length, kind: parsed.kind }, text: null, layer: parsed.kind, split: { episodes: [], stats: { episodes: 0, lines: 0, actions: 0, characters: (parsed.doc?.characters ?? []).length, props: (parsed.doc?.props ?? []).length, scenes: (parsed.doc?.scenes ?? []).length, beats: 0, estimateSeconds: 0 }, meta: { title: parsed.doc?.source ?? name }, characters: [], scenes: [], beats: [], episodes: [], unknownSpeakers: [] }, warnings: [`file là tầng "${parsed.kind}" — thêm cùng các file khác rồi bấm “Tạo từ bộ file”`], suggestedSlug: slugify(parsed.doc?.source ?? name), accepted: ALLOWED });
        return;
      }
      const split = splitScript(parsed.text);
      const warnings = [...parsed.warnings];
      if (!split.episodes.length) warnings.push('không tìm thấy tập nào — cần tiêu đề "## Tập N" hoặc danh sách đánh số');
      if (split.unknownSpeakers.length) warnings.push(`người nói chưa khai báo: ${split.unknownSpeakers.join(', ')}`);
      json(res, 200, {
        file: { name, bytes: buffer.length, kind: parsed.kind },
        text: parsed.text,
        split,
        warnings,
        suggestedSlug: slugify(split.meta.title || parsed.meta?.title || name.replace(/\.[^.]+$/, '')),
        accepted: ALLOWED,
      });
    } catch (e) {
      json(res, 400, { error: String(e?.message ?? e), accepted: ALLOWED });
    }
    return;
  }

  if (path === '/api/preview' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}');
    const split = splitScript(body.script ?? '');
    const warnings = [];
    if (!split.episodes.length) warnings.push('không tìm thấy tập nào — cần ít nhất một tiêu đề "## Tập N" hoặc danh sách đánh số');
    if (!split.meta.genre) warnings.push('chưa thấy thể loại — agent sẽ hỏi');
    if (!split.characters.length) warnings.push('chưa thấy danh sách nhân vật (C01 …) — sẽ lấy từ tên người nói');
    if (split.unknownSpeakers.length) warnings.push(`người nói chưa khai báo: ${split.unknownSpeakers.join(', ')}`);
    json(res, 200, { split, warnings, suggestedSlug: slugify(split.meta.title) });
    return;
  }

  if (path === '/api/projects' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}');
    const split = splitScript(body.script ?? '');
    if (!String(body.script ?? '').trim()) { json(res, 400, { error: 'chưa dán kịch bản' }); return; }
    if (!split.episodes.length) { json(res, 400, { error: 'kịch bản chưa chia được tập nào' }); return; }
    const slug = slugify(body.slug || split.meta.title);
    const { dir } = projectDir(slug);
    if (existsSync(dir) && !body.overwrite && !String(body.slug ?? '').startsWith('__')) {
      json(res, 409, { error: `project "${slug}" đã tồn tại`, slug });
      return;
    }
    if (existsSync(dir) && isGenerating(dir)) { json(res,409,{error:'AI đang biên soạn dự án này.'}); return; }
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'kichban.md'), String(body.script));
    buildProject(split, { slug, targetDir: dir });
    spawnSync(process.execPath, [join(HERE, 'book.mjs'), dir], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } });
    json(res, 201, { slug, dir: dir.replace(`${ROOT}/`, ''), split: split.stats, warnings: projectSummary(slug, dir).warnings });
    return;
  }

  if (path === '/api/scenarios' && req.method === 'GET') {
    json(res, 200, { scenarios: [...SCENARIOS.map(({ id, label, needsProject }) => ({ id, label, needsProject })), { id: 'build', label: 'Dựng lại báo cáo tĩnh của dự án mẫu (preview/)', needsProject: false }] });
    return;
  }

  if (path === '/api/run' && req.method === 'POST') {
    const body = JSON.parse(await readBody(req) || '{}');
    json(res, 200, runScenario(body.scenario, body.slug));
    return;
  }

  if (path.startsWith('/project/') && req.method === 'GET') {
    const [, , slugPart, ...restParts] = path.split('/');
    const { slug, dir } = projectDir(decodeURIComponent(slugPart ?? ''));
    const rel = restParts.map(decodeURIComponent);
    if (!existsSync(dir)) { json(res, 404, { error: 'không thấy project' }); return; }
    // chỉ phục vụ file nằm trong project, chặn '..'
    const edition=activeEditionDir(dir);
    const candidate=resolve(edition,...rel);
    const target=existsSync(candidate)?candidate:resolve(dir,...rel);
    if (!target.startsWith(resolve(dir) + '/') || !existsSync(target) || statSync(target).isDirectory()) {
      json(res, 404, { error: 'không thấy file' });
      return;
    }
    const ext = target === dir ? '' : target.slice(target.lastIndexOf('.') + 1).toLowerCase();
    const types = { html: 'text/html; charset=utf-8', json: 'application/json; charset=utf-8', md: 'text/plain; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4', wav: 'audio/wav', srt:'application/x-subrip; charset=utf-8', txt: 'text/plain; charset=utf-8' };
    const head = { 'Content-Type': types[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store' };
    if (types[ext] === 'video/mp4' || types[ext] === 'audio/wav') {
      const total = statSync(target).size;
      const range = req.headers.range;
      if (range) {
        const m2 = /bytes=(\d*)-(\d*)/.exec(range);
        const start = Number(m2?.[1] || 0);
        const end = m2?.[2] ? Number(m2[2]) : total - 1;
        res.writeHead(206, { ...head, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${total}`, 'Content-Length': end - start + 1 });
        createReadStream(target, { start, end }).pipe(res);
        return;
      }
      res.writeHead(200, { ...head, 'Accept-Ranges': 'bytes', 'Content-Length': total });
      createReadStream(target).pipe(res);
      return;
    }
    res.writeHead(200, head);
    if (ext === 'html') {
      // Older CLI reports may lack shared export/localization support. Add it when serving them.
      let html = readFileSync(target, 'utf8');
      if (!html.includes('src="/json-export.js"')) html = html.replace('</head>', '<script src="/json-export.js" defer></script></head>');
      if (!html.includes('src="/language.js"')) html = html.replace('</head>', '<link rel="stylesheet" href="/language.css"><script src="/language.js" defer></script></head>');
      res.end(html);
    } else res.end(readFileSync(target));
    return;
  }

  // mọi URL còn lại: phục vụ file tĩnh trong preview/ (index.html, report.html, staging.html, …)
  if (req.method === 'GET' && !path.startsWith('/api/') && !path.startsWith('/project/')) {
    const rel = decodeURIComponent(path).replace(/^\/+/, '') || 'index.html';
    const target = resolve(PREVIEW, rel);
    if (!target.startsWith(resolve(PREVIEW) + '/') || !existsSync(target) || statSync(target).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`không có ${path}\n`);
      return;
    }
    const ext = target.slice(target.lastIndexOf('.') + 1).toLowerCase();
    const types = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8', md: 'text/plain; charset=utf-8', png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', mp4: 'video/mp4', wav: 'audio/wav', txt: 'text/plain; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[ext] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(target));
    return;
  }

  const m = path.match(/^\/api\/projects\/([^/]+)(?:\/(file|split))?$/);
  if (m && req.method === 'GET') {
    const { slug, dir } = projectDir(decodeURIComponent(m[1]));
    if (!existsSync(dir)) { json(res, 404, { error: 'không thấy project' }); return; }
    if (m[2] === 'file') {
      const file = url.searchParams.get('name') ?? '';
      if (!/^[\w\u4e00-\u9fff.-]+\.(json|md)$/.test(file)) { json(res, 400, { error: 'tên file không hợp lệ' }); return; }
      const target = join(file==='reference-images.json'?dir:activeEditionDir(dir), file);
      if (!existsSync(target)) { json(res, 404, { error: 'không thấy file' }); return; }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(readFileSync(target));
      return;
    }
    json(res, 200, projectSummary(slug, dir));
    return;
  }
  if (m && req.method === 'DELETE') {
    const { slug, dir } = projectDir(decodeURIComponent(m[1]));
    if (!existsSync(dir)) { json(res, 404, { error: 'không thấy project' }); return; }
    if (isGenerating(dir)) { json(res,409,{error:'Dừng biên soạn AI trước khi xóa dự án.'}); return; }
    rmSync(dir, { recursive: true, force: true });
    json(res, 200, { ok: true, slug });
    return;
  }

  json(res, 404, { error: `không có ${path}` });
}

const server = createServer((req, res) => {
  handle(req, res).catch((e) => {
    try { json(res, 500, { error: String(e?.message ?? e) }); } catch { res.destroy(); }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/?lang=vi`;
  console.log(`studio:   ${url}`);
  console.log(`preview:  http://127.0.0.1:${PORT}/report.html  (báo cáo mẫu tĩnh, cùng cổng)`);
  console.log(`projects: ${PROJECTS}`);
  if (!process.argv.includes('--no-open')) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try { spawn(opener, [url], { stdio: 'ignore', detached: true }).unref(); } catch { /* mở tay */ }
  }
  void basename;
});
