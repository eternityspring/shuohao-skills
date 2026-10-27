#!/usr/bin/env node
/**
 * E2E bằng Chrome headless (không cần npm): mở studio, dán kịch bản, bấm "Đọc & chia phần",
 * kiểm tra kết quả đọc, rồi bấm "Tạo dự án" và kiểm tra file sinh ra.
 *
 *   node preview/pipeline/selftest.mjs [--keep]
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitScript, buildProject } from './split.mjs';
import { readScriptFile, scriptJsonToText } from './upload.mjs';
import { bookFromScript } from './book.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PORT = 4399;
const BASE = `http://127.0.0.1:${PORT}`;
let failures = 0;
const check = (label, ok, detail = '') => {
  if (ok) console.log(`✓ ${label}`);
  else { failures += 1; console.log(`✗ ${label}${detail ? `  ${detail}` : ''}`); }
};

/* ---------- 1. parser ---------- */
const rich = `# Sương trên cầu

> Thể loại: trinh thám. 3 tập × 90 giây.

## Nhân vật
- C01 阿明 (A Minh) — nam 28 tuổi, cảnh sát
- C02 老李 (Lý lão) — nam 55 tuổi, chủ quán

## Tập 1 — Cầu sương
Bối cảnh: S01 (quán ăn đêm), S02 (cây cầu)

1. Trời mưa, A Minh bước vào quán.
2. A Minh: Cho tôi một bát mì.
3. Lý lão: Khuya thế này, cậu là cảnh sát à?

## Tập 2 — Người thứ ba
Bối cảnh: S02 (cây cầu)

1. A Minh đứng giữa cầu.
2. Lý lão: Tối qua có người nhảy cầu.

## Tập 3 — Sương tan
Bối cảnh: S01 (quán ăn đêm)

1. Sáng, A Minh quay lại quán.
2. Lý lão cúi đầu, không trả lời.
`;
const s1 = splitScript(rich);
check('đọc tên phim', s1.meta.title === 'Sương trên cầu', s1.meta.title);
check('đọc thể loại', s1.meta.genre === 'trinh thám', s1.meta.genre);
check('đọc 3 tập', s1.episodes.length === 3, String(s1.episodes.length));
check('đọc 90 giây/tập', s1.meta.secondsPerEpisode === 90);
check('đọc 2 nhân vật + tên trong ngoặc', s1.characters.length === 2 && s1.characters[0].paren === 'A Minh');
check('đọc tên cảnh', s1.scenes.map((x) => x.name).join('|') === 'quán ăn đêm|cây cầu', s1.scenes.map((x) => x.name).join('|'));
check('tách thoại và hành động', s1.stats.lines === 3 && s1.stats.actions >= 4, JSON.stringify(s1.stats));
check('không có người nói lạ', s1.unknownSpeakers.length === 0, s1.unknownSpeakers.join(','));

const plain = `## Tập 1\n\n1. Ngoài cửa: một người đàn ông ướt sũng.\n2. A Minh: Tôi đang tìm một người.\n`;
const s2 = splitScript(plain);
check('không nhầm "Ngoài cửa:" thành người nói', s2.episodes[0].beats[0].kind === 'action', s2.episodes[0].beats[0].kind);
check('tên không dấu chưa khai báo thì coi là hành động', s2.episodes[0].beats[1].kind === 'action');
const s3 = splitScript(`- C01 阿明 (A Minh) — cảnh sát\n\n## Tập 1\n\n1. A Minh: Tôi đang tìm một người.\n`);
check('tên không dấu đã khai báo thì nhận là người nói', s3.episodes[0].beats[0].kind === 'line' && s3.episodes[0].beats[0].speaker === 'A Minh');

const noHead = `1. Một cô gái mở cửa.\n2. Cô gái: Ai đó?\n`;
check('không có tiêu đề tập vẫn tách được', splitScript(noHead).episodes.length >= 1);

/* ---------- 1b. tải file ---------- */
{
  const txt = readScriptFile('kichban.txt', Buffer.from(rich, 'utf8'));
  check('upload .txt giữ nguyên văn', txt.text.trim() === rich.trim() && txt.kind === 'txt');
  let threw = null;
  try { readScriptFile('x.pdf', Buffer.from('%PDF-1.4')); } catch (e) { threw = e.message; }
  check('upload từ chối .pdf', Boolean(threw), threw ?? 'không ném lỗi');
  try { readScriptFile('x.json', Buffer.from('{"a":')); } catch (e) { threw = e.message; }
  check('upload báo JSON hỏng', /JSON không hợp lệ/.test(threw ?? ''), threw ?? '');
  const wrapped = readScriptFile('k.json', Buffer.from(JSON.stringify({ title: 'Bến cũ', script: rich })));
  check('upload .json có trường "script"', wrapped.text.includes('Sương trên cầu') && wrapped.kind === 'text', wrapped.kind);
  const u16 = readScriptFile('u.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(rich, 'utf16le')]));
  check('upload UTF-16 (Notepad Windows)', u16.text.includes('Sương trên cầu'));
  const kinds = {
    outline: 'projects/dem-cuoi-tiem-giat/outline.json', cast: 'projects/dem-cuoi-tiem-giat/cast.json',
    art: 'projects/dem-cuoi-tiem-giat/art.json', staging: 'projects/dem-cuoi-tiem-giat/staging.json',
    storyboard: 'projects/dem-cuoi-tiem-giat/storyboard.json', script: 'projects/dem-cuoi-tiem-giat/script.json',
  };
  for (const [want, rel] of Object.entries(kinds)) {
    const got = readScriptFile('x.json', readFileSync(join(ROOT, rel))).kind;
    check(`nhận đúng loại ${want}.json`, got === want, got);
  }
  const sj = JSON.parse(readFileSync(join(ROOT, 'projects', 'dem-cuoi-tiem-giat', 'script.json'), 'utf8'));
  const conv = scriptJsonToText(sj);
  check('script.json → văn bản có tập và lời thoại', conv.includes('## Tập 1') && /\d+\.\s+C\d+:/.test(conv));
  const round = readScriptFile('script.json', Buffer.from(JSON.stringify(sj)));
  check('upload script.json đầy đủ', round.kind === 'script' && round.meta.episodes === 6, round.kind);
}

/* ---------- 1c. production manifest (schema 1.0) ---------- */
{
  const manifest = JSON.parse(readFileSync(join(ROOT, 'preview', 'pipeline', 'fixtures', 'manifest-sample.json'), 'utf8'));
  const parsed = readScriptFile('production_manifest.json', Buffer.from(JSON.stringify(manifest)));
  check('nhận production manifest', parsed.kind === 'manifest' && parsed.layers?.outline && parsed.layers?.script, parsed.kind);
  check('manifest → số cảnh = số tập', parsed.layers.outline.episodes.length === manifest.script.scenes.length, String(parsed.layers.outline.episodes.length));
  check('manifest → target của outline và script khớp nhau',
    JSON.stringify(parsed.layers.outline.episodes.map((e) => e.targetSeconds)) === JSON.stringify(parsed.layers.script.episodes.map((e) => e.targetSeconds)));
  const allLines = parsed.layers.script.episodes.flatMap((e) => e.scenes[0].flow.filter((f) => f.line).map((f) => f.line));
  check(`mọi câu thoại ≤ 35 ký tự`, allLines.every((l) => l.length <= 35), String(Math.max(...allLines.map((l) => l.length))));
  const art = parsed.layers.art;
  check('art: id cảnh là S01…, không trùng', art.scenes.every((s) => /^S\d{2}$/.test(s.id)) && new Set(art.scenes.map((s) => s.id)).size === art.scenes.length);
  check('art: usage.episodes là mảng', art.props.every((p) => Array.isArray(p.usage?.episodes)));
  check('prompt ảnh không chứa id nhân vật', art.scenes.every((s) => !/(^|\W)(AN|MAI|MINH)(\W|$)/.test(s.image.prompt)));
}

/* ---------- 2. buildProject ---------- */
const tmp = join(ROOT, 'projects', '__selftest__');
rmSync(tmp, { recursive: true, force: true });
const built = buildProject(s1, { slug: '__selftest__', targetDir: tmp });
check('sinh outline.json', existsSync(join(tmp, 'outline.json')));
check('sinh script.json', existsSync(join(tmp, 'script.json')));
check('sinh project.json + split.json', existsSync(join(tmp, 'project.json')) && existsSync(join(tmp, 'split.json')));
check('script.json có 3 tập', built.script.episodes.length === 3);
check('speaker đã đổi sang id', built.script.episodes[0].scenes[0].flow.some((b) => b.speaker === 'C01'));
check('targetSeconds = 90', built.script.episodes.every((e) => e.targetSeconds === 90));
check('book.txt có dòng thoại theo tên', bookFromScript(rich).includes('A Minh: Cho tôi một bát mì.'));
if (!process.argv.includes('--keep')) rmSync(tmp, { recursive: true, force: true });

/* ---------- 3. API + UI trong Chrome headless ---------- */
/** Mở Chrome với CDP, chạy `job(ev, wait)` trong trang studio. */
async function cdp([hasChrome], job) {
  const port = 9231;
  const chrome = spawn(hasChrome, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${port}`, '--remote-allow-origins=*', 'about:blank'], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 1200));
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    });
    await new Promise((r) => ws.addEventListener('open', r));
    const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: `${BASE}/#/projects` });
    await wait(1600);
    const out = await job(ev, wait);
    ws.close();
    return out;
  } finally {
    chrome.kill();
  }
}
const send_wait = async (ev, wait, expr) => { await ev(expr); await wait(400); };
const hasChrome = spawnSync('sh', ['-c', 'command -v google-chrome || command -v chromium || command -v chromium-browser'], { encoding: 'utf8' }).stdout?.trim();
if (!hasChrome) {
  console.log('… bỏ qua phần UI: không có Chrome/Chromium');
} else {
  const server = spawn(process.execPath, [join(HERE, 'studio.mjs'), '--port', String(PORT), '--no-open'], { cwd: ROOT, stdio: 'ignore' });
  // đợi server thật sự nhận kết nối (đừng đoán bằng sleep)
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/api/projects`); if (r.ok) break; } catch { /* chưa lên */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  try {
    const res = await fetch(`${BASE}/api/preview`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: rich }) });
    const body = await res.json();
    check('POST /api/preview trả 3 tập', res.ok && body.split.episodes.length === 3);
    check('gợi ý slug từ tên phim', body.suggestedSlug === 'Sương-trên-cầu', body.suggestedSlug);

    const bad = await fetch(`${BASE}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: '' }) });
    check('kịch bản rỗng bị từ chối 400', bad.status === 400);

    const created = await fetch(`${BASE}/api/projects`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ script: rich, slug: '__ui-selftest__' }) });
    check('POST /api/projects tạo dự án', created.status === 201, String(created.status));
    const dir = join(ROOT, 'projects', '__ui-selftest__');
    check('có kichban.md + book.txt', existsSync(join(dir, 'kichban.md')) && existsSync(join(dir, 'book.txt')));
    check('origin = web-paste', JSON.parse(readFileSync(join(dir, 'project.json'), 'utf8')).origin === 'web-paste');

    const trav = await fetch(`${BASE}/project/dem-cuoi-tiem-giat/..%2F..%2Fpackage.json`);
    check('chặn path traversal', trav.status === 404, String(trav.status));

    const dump = spawnSync(hasChrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--virtual-time-budget=6000', '--dump-dom', `${BASE}/#/projects`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const html = dump.stdout ?? '';
    check('trang studio render', html.includes('class="crumbs"') && html.includes('Studio dự án'), html.slice(0, 120));
    check('danh sách dự án tải từ API', /class="pcard|id="cards"/.test(html));
    check('trang có điều hướng (breadcrumb + tab + hash router)', html.includes('id="crumbs"') && html.includes('class="tab'));
    const served = await (await fetch(`${BASE}/`)).text();
    check('studio nhúng thanh ngôn ngữ', served.includes('src="/language.js"') && served.includes('language.css'), 'không thấy language.js trong HTML server trả');

    // tải file qua UI: input file thật → filebar → tạo dự án
    const up = await cdp([hasChrome], async (ev, wait) => {
      const out = {};
      await ev(`location.hash = '#/new'; true`);
      await wait(700);
      await ev(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(rich)}],'kichban.txt',{type:'text/plain'}));const inp=document.getElementById('file');inp.files=dt.files;inp.dispatchEvent(new Event('change'));return true})()`);
      await wait(1200);
      out.filebar = await ev(`document.getElementById('filelist')?.textContent.replace(/\\s+/g,' ').trim() || ''`);
      out.kpis = await ev(`[document.getElementById('k-eps')?.textContent, document.getElementById('k-lines')?.textContent].join('/')`);
      out.enabled = await ev(`!document.getElementById('create')?.disabled`);
      return out;
    });
    check('tải .txt lên hiện danh sách file', /kichban\.txt/.test(up.filebar) && /3 tập/.test(up.filebar), up.filebar);
    check('tải file xong là đọc được cấu trúc', up.kpis === '3/3', up.kpis);
    check('tải file xong bấm tạo được', up.enabled === true);

    // ghép nhiều file tầng thành project
    const asm = await (async () => {
      const files = ['outline.json', 'cast.json', 'art.json', 'script.json', 'staging.json', 'storyboard.json'].map((n) => ({
        name: n, content: readFileSync(join(ROOT, 'projects', 'dem-cuoi-tiem-giat', n), 'utf8'),
      }));
      const r = await fetch(`${BASE}/api/assemble`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files, slug: '__asm-selftest__' }) });
      return { status: r.status, body: await r.json() };
    })();
    check('ghép 6 file tầng thành dự án', asm.status === 201 && asm.body.wrote?.length === 6, JSON.stringify(asm.body).slice(0, 160));
    const asmManifest = JSON.parse(readFileSync(join(ROOT, 'projects', '__asm-selftest__', 'project.json'), 'utf8'));
    check('project ghép có đủ 6 tầng done', ['outline', 'cast', 'art', 'script', 'staging', 'storyboard'].every((k) => asmManifest.stages[k] === 'done'));
    rmSync(join(ROOT, 'projects', '__asm-selftest__'), { recursive: true, force: true });

    // điều hướng trong app: đi qua các trang bằng hash, không mở tab mới
    const nav = await cdp([hasChrome], async (ev, wait) => {
      const out = {};
      await send_wait(ev, wait, `location.hash = '#/projects'; true`);
      out.projectsTitle = await ev(`document.querySelector('#app h2')?.textContent`);
      await ev(`document.querySelector('.pcard').click(); true`);
      await wait(700);
      out.openedHash = await ev(`location.hash`);
      out.tabs = await ev(`document.querySelectorAll('.tab').length`);
      out.breadcrumbs = await ev(`document.getElementById('crumbs').textContent.replace(/\s+/g,' ').trim()`);
      await ev(`document.querySelector('.tab[data-nav$="/script"]').click(); true`);
      await wait(800);
      out.stageHash = await ev(`location.hash`);
      out.stageTitle = await ev(`document.querySelector('#app h2')?.textContent`);
      // nút trong trang tầng, không phải link báo cáo ở trang tổng quan
      await ev(`document.getElementById('open-rep').click(); true`);
      await wait(300);
      out.reportHashEarly = await ev(`location.hash`);
      await wait(800);
      out.reportHash = await ev(`location.hash`);
      out.iframe = await ev(`document.getElementById('frame')?.getAttribute('src') || ''`);
      out.openBlank = await ev(`[...document.querySelectorAll('a[target=_blank]')].length`);
      await ev(`document.getElementById('back').click(); true`);
      await wait(600);
      out.backHash = await ev(`location.hash`);
      await ev(`location.hash = '#/new'; true`);
      await wait(500);
      out.newTitle = await ev(`document.querySelector('#app h2')?.textContent`);
      return out;
    });
    check('trang chủ liệt kê dự án', nav.projectsTitle === 'Dự án', nav.projectsTitle);
    check('bấm thẻ dự án mở trang dự án', /^#\/project\//.test(nav.openedHash), nav.openedHash);
    check('trang dự án có 8 tab', nav.tabs === 8, String(nav.tabs));
    check('báo cáo tĩnh cùng cổng', /^#\/report\//.test(nav.reportHash));
    check('không còn cổng thứ hai mặc định', !/4321/.test(String(process.env.KILO_STUDIO_PORT ?? '8765')));
    check('breadcrumb đủ 3 cấp', nav.breadcrumbs.split('/').length === 3, nav.breadcrumbs);
    check('tab chuyển tầng bằng hash', nav.stageHash.endsWith('/script'), nav.stageHash);
    check('báo cáo mở trong app (iframe)', nav.reportHash.startsWith('#/report/') && nav.iframe.includes('report'), `${nav.reportHashEarly} | ${nav.reportHash} | ${nav.iframe}`);
    check('hash tầng mở trực tiếp được', /^#\/project\/[^/]+\/art$/.test('#/project/mau-dukou/art') && nav.stageHash.endsWith('/script'));
    check('không còn link mở tab mới', nav.openBlank === 0, String(nav.openBlank));
    check('nút quay lại về dự án', /^#\/project\//.test(nav.backHash), nav.backHash);
    check('trang dự án mới có tiêu đề', nav.newTitle === 'Dự án mới từ kịch bản', nav.newTitle);
    const state_list = await (async () => ({ value: (await (await fetch(`${BASE}/api/projects`)).json()).projects }))();
    check('API dự án trả lời', Array.isArray(state_list.value));
    rmSync(dir, { recursive: true, force: true });
  } finally {
    server.kill();
    rmSync(join(ROOT, 'projects', '__ui-selftest__'), { recursive: true, force: true });
    rmSync(join(ROOT, 'projects', 'du-an-moi'), { recursive: true, force: true });
  }
}

console.log(failures ? `\n✗ ${failures} kiểm tra chưa đạt` : '\n✓ pipeline selftest hoàn tất');
process.exitCode = failures ? 1 : 0;
