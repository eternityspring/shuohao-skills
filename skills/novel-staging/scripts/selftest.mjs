#!/usr/bin/env node
// 自测：覆盖 novel-staging.mjs 里所有确定性逻辑。
// 不调用任何模型，不花额度，跑一次 < 1 秒。
//   node scripts/selftest.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ITEM_RANGE,
  MIN_APART,
  blockingLines,
  defaultFacing,
  gateReport,
  moveTo,
  nearestPlace,
  parseEps,
  placePoint,
  placePoints,
  placeSentence,
  renderHtml,
  renderMarkdown,
  sceneProblems,
  seedFromScript,
  slug,
  stagingBlocking,
  stagingCore,
  validateStaging,
} from './novel-staging.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p) => JSON.parse(readFileSync(join(here, '..', ...p), 'utf8'));
const FIXTURE = read('examples', '渡口-staging.json');
const SCRIPT = read('references', 'test-fixtures', 'upstream', '渡口-script.json');
const ART = read('references', 'test-fixtures', 'upstream', '渡口-art.json');
const OUTLINE = read('references', 'test-fixtures', 'upstream', '渡口-outline.json');

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
}
function eq(actual, expected, msg) {
  assert.deepStrictEqual(actual, expected, `${msg} — 期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
  passed++;
}
const clone = () => JSON.parse(JSON.stringify(FIXTURE));
const gate = (d, id, opts = {}) => gateReport(d, opts).find((g) => g.id === id);
const near = (a, b) => Math.abs(a - b) < 1e-9;

/* ---------------- 平面几何 ---------------- */

const TABLE = { name: '长餐桌', alt: 'long table', plan: [0.3, 0.3, 0.7, 0.6], on: false };
const CHAIR = { name: '主位太师椅', alt: 'armchair', plan: [0.45, 0.1, 0.55, 0.2], on: true };
const ROUND = { name: '红木圆桌', alt: 'round table', plan: [0.3, 0.3, 0.7, 0.7], on: false };
{
  const n = placePoint(TABLE, 'north', 0);
  ok(near(n.x, 0.3) && near(n.y, 0.26), '北侧 along 0 在桌子西北角外一点');
  const e = placePoint(TABLE, 'east', 1);
  ok(near(e.x, 0.74) && near(e.y, 0.6), '东侧 along 1 在东南角外一点（东西两侧沿南北排）');
  const s = placePoint(TABLE, 'south', 0.5);
  ok(near(s.x, 0.5) && near(s.y, 0.64), '南侧中段在南边正中外一点');
  const on = placePoint(CHAIR, 'on', 0.3);
  ok(near(on.x, 0.5) && near(on.y, 0.15), '在东西上面：放在它中间，along 不起作用');
  const r = placePoint(ROUND, 'south', 0.5);
  ok(near(r.x, 0.5) && r.y > 0.7, '圆的东西：南侧中段在圆周正下方外面');
  const edge = placePoint({ name: '贴墙柜', plan: [0, 0, 0.1, 0.1], on: false }, 'west', 0.5);
  ok(edge.x === 0, '平面外的点收回到 0–1 里面');
}
{
  const pts = placePoints([
    { id: 'A', present: true, item: '主位太师椅', side: 'on', along: 0.5 },
    { id: 'B', present: true, item: '主位太师椅', side: 'on', along: 0.5 },
    { id: 'C', present: false, item: null },
    { id: 'D', present: true, item: '不存在的东西', side: 'north', along: 0.5 },
  ], [TABLE, CHAIR]);
  ok(pts.has('A') && pts.has('B') && !pts.has('C') && !pts.has('D'), '只给在场、东西认得出来的人算点');
  ok(pts.get('A').x !== pts.get('B').x, '两个人在同一件东西上并排，不叠在一点');
}
{
  eq(nearestPlace({ x: 0.5, y: 0.15 }, [TABLE, CHAIR]), { item: '主位太师椅', side: 'on', along: 0.5 }, '松在能坐的东西里面：坐在它上面');
  const t = nearestPlace({ x: 0.75, y: 0.36 }, [TABLE, CHAIR]);
  ok(t.item === '长餐桌' && t.side === 'east' && near(t.along, 0.2), '松在桌子东边：东侧，沿南北量出 along');
  const inside = nearestPlace({ x: 0.5, y: 0.32 }, [TABLE]);
  ok(inside.item === '长餐桌' && inside.side === 'north', '松在桌面上：落到最近的那条边');
  const r = nearestPlace({ x: 0.5, y: 0.8 }, [ROUND]);
  ok(r.item === '红木圆桌' && r.side === 'south' && Math.abs(r.along - 0.5) < 0.01, '圆桌正下方：南侧中段');
  eq(nearestPlace({ x: 0.5, y: 0.5 }, []), null, '没有东西就没有落点');
}
{
  eq(defaultFacing('east', TABLE), 'west', '在东侧面朝西');
  eq(defaultFacing('north', TABLE), 'south', '在北侧面朝南');
  eq(defaultFacing('on', { plan: [0, 0.4, 0.1, 0.6] }), 'east', '在靠西墙的东西上面：面朝东（房间）');
  eq(defaultFacing('on', CHAIR), 'south', '在中间的东西上面：面朝南');
}
{
  const absent = { id: 'C01', name: '江小白', present: false, item: null, side: null, along: null, posture: null, facing: null };
  const m = moveTo(absent, { item: '长餐桌', side: 'east', along: 0.333 }, [TABLE]);
  ok(m.present && m.posture === 'stand' && m.facing === 'west' && m.along === 0.33, '从托盘拖进来：在场、站着、面朝那件东西，along 取两位');
  const sat = moveTo(m, { item: '主位太师椅', side: 'on', along: 0.5 }, [TABLE, CHAIR]);
  ok(sat.posture === 'sit' && sat.along === 0.5, '拖到能坐的东西上：坐下');
  const turned = { ...m, facing: 'north' };
  eq(moveTo(turned, { item: '长餐桌', side: 'east', along: 0.8 }, [TABLE]).facing, 'north', '同一侧挪一挪：朝向照旧');
  eq(moveTo(turned, { item: '长餐桌', side: 'west', along: 0.8 }, [TABLE]).facing, 'east', '换了一侧：转过去面朝它');
}

/* ---------------- 走位句 ---------------- */

{
  const p = { id: 'C04', name: '胡二爷', present: true, item: '第三排坐板', side: 'on', along: 0.5, posture: 'sit', facing: 'north' };
  eq(placeSentence(p, 'zh'), '胡二爷坐在第三排坐板上，面朝北', '在东西上面的说法');
  eq(placeSentence(p, 'en', undefined, 'third bench row'), '胡二爷 sits on the third bench row, facing north', '英文说法用另一种语言的名字');
  eq(placeSentence({ ...p, present: false }, 'zh'), null, '不在场的人没有句子');
  const a = { id: 'A', name: '萧海龙', present: true, item: '长餐桌', side: 'east', along: 0.1, posture: 'sit', facing: 'west' };
  const b = { id: 'B', name: '萧初然', present: true, item: '长餐桌', side: 'east', along: 0.2, posture: 'sit', facing: 'west' };
  const s = stagingBlocking({ places: [a, b], extras: 0, extrasWhere: null }, 'zh');
  ok(s.startsWith('萧海龙坐在长餐桌东侧靠北，面朝西；萧初然坐在长餐桌东侧靠北、萧海龙南侧，面朝西'), '同一侧落在同一段：说清谁挨着谁');
  ok(s.endsWith('其余座位空着，没有其他人。'), '没有群演：明说没有别人');
  ok(stagingBlocking({ places: [a], extras: 3, extrasWhere: '长桌西侧南端' }, 'zh').includes('另有 3 名群演在长桌西侧南端，只作背景'), '有群演：几个、在哪');
  eq(stagingBlocking({ places: [{ ...a, present: false, item: null }], extras: 0 }, 'zh'), null, '开场没人在场：没有走位句');
}
{
  const lines = blockingLines(FIXTURE, 'en');
  ok(lines[0].blocking.includes('earth bank at the shore'), '英文走位句用认图时写的 alt');
  eq(lines.length, FIXTURE.scenes.length, '每一场一句');
}

/* ---------------- Vietnamese live blocking ---------------- */
{
  const a = { id: 'A', name: 'An', present: true, item: 'bàn dài', side: 'east', along: 0.1, posture: 'stand', facing: 'northwest' };
  const b = { ...a, id: 'B', name: 'Bình', along: 0.2, posture: 'sit' };
  const scene = { places: [a, b], extras: 2, extrasWhere: 'cửa ra vào' };
  const original = JSON.stringify(scene);
  eq(placeSentence(a, 'vi'), 'An đứng ở phía đông của bàn dài, gần đầu phía bắc, hướng về tây bắc', 'Vietnamese posture, side and diagonal facing');
  eq(placeSentence({ ...b, side: 'on', item: 'ghế', facing: 'south' }, 'vi'), 'Bình ngồi trên ghế, hướng về nam', 'Vietnamese seated position');
  ok(stagingBlocking(scene, 'vi').includes('ngay phía nam của An'), 'Vietnamese neighbours keep spatial order');
  ok(stagingBlocking(scene, 'vi').endsWith('Có thêm 2 diễn viên quần chúng ở cửa ra vào, chỉ làm nền.'), 'Vietnamese extras include count and location');
  ok(stagingBlocking({ ...scene, extras: 0 }, 'vi').endsWith('Các chỗ còn lại đều trống, không có người khác.'), 'Vietnamese empty seats');
  eq(placeSentence({ ...a, present: false }, 'vi'), null, 'Absent people have no Vietnamese blocking sentence');
  const item = { name: 'bàn dài', plan: [0.2, 0.2, 0.7, 0.7], on: false };
  const problems = sceneProblems({ ...scene, extrasWhere: '' }, { items: [item] }, 'vi');
  ok(problems.some(p => p.gate === 'extras' && p.text === 'Có 2 diễn viên quần chúng nhưng chưa ghi vị trí'), 'Vietnamese live extras diagnostic');
  ok(problems.some(p => p.gate === 'no-overlap' && p.text.includes('An và Bình trùng vị trí')), 'Vietnamese live overlap diagnostic');
  eq(JSON.stringify(scene), original, 'Localization leaves scene data unchanged');
  const embedded = (new Function('return (' + stagingCore.toString() + ')()'))();
  eq(embedded.stagingBlocking(scene, 'vi'), stagingBlocking(scene, 'vi'), 'Embedded browser core matches the CLI in Vietnamese');
}

/* ---------------- seed ---------------- */

{
  const d = seedFromScript(SCRIPT, { art: ART, outline: OUTLINE });
  eq(d.locations.map((l) => l.sceneId), ['S02', 'S01', 'S03'], '地点按第一次出现的顺序');
  eq(d.locations[0].name, '渡口栈桥', '给了 art.json 地点带名字');
  eq(d.scenes.length, 9, '九场');
  eq(d.scenes[1].cast.map((c) => c.name), ['沈知微', '陆行远', '老周', '胡二爷'], '给了 outline.json 人物带名字');
  ok(d.scenes.every((s) => s.places.length === s.cast.length && s.places.every((p) => p.present === null)), '每个出场人物一条，在不在场留给模型定');
  eq(d.scenes[0].lighting, '浓雾清晨', '剧本的光照时段搬过来');
  eq(seedFromScript(SCRIPT).scenes[0].cast[0].name, 'C01', '没给 outline.json：先用编号');
  eq(seedFromScript(SCRIPT, { eps: parseEps('5-6') }).scenes.map((s) => s.ep), [5, 5, 6, 6], '--eps 只取这几集');
  eq([...parseEps('1,3-4')], [1, 3, 4], '集号写法：逗号和连字符');
  const fresh = seedFromScript(SCRIPT, { art: ART, outline: OUTLINE });
  ok(!gate(fresh, 'items-read').ok && !gate(fresh, 'present-set').ok && !gate(fresh, 'extras').ok, '骨架本身过不了门：认图、在不在场、群演都还没定');
}

/* ---------------- 质量门 ---------------- */

{
  const opts = { script: SCRIPT, art: ART };
  const gates = gateReport(FIXTURE, opts);
  eq(gates.length, 8, '八道门');
  ok(gates.every((g) => g.ok), '自带样例全部通过（对着样例剧本和美术）');
  eq(validateStaging(FIXTURE, opts), [], '样例没有违规');
  ok(gate(FIXTURE, 'cast-complete').detail.includes('未提供 script.json'), '没给剧本：明说没跟剧本核对');
}
{
  const d = clone();
  d.locations[0].items = [];
  ok(!gate(d, 'items-read').ok, '没认图：items-read 不过');
  const d2 = clone();
  d2.locations[2].items = d2.locations[2].items.slice(0, ITEM_RANGE[0] - 1);
  ok(!gate(d2, 'items-read').ok, `少于 ${ITEM_RANGE[0]} 件：items-read 不过`);
  const d3 = clone();
  d3.locations[0].readFrom = null;
  ok(!gate(d3, 'items-read').ok, '没写 readFrom：算没认图');
}
{
  const d = clone();
  d.locations[0].items[1].name = d.locations[0].items[0].name;
  ok(!gate(d, 'item-shape').ok, '名字重复：item-shape 不过');
  const d2 = clone();
  d2.locations[0].items[0].plan = [0.5, 0.2, 0.4, 0.3];
  ok(!gate(d2, 'item-shape').ok, 'plan 右小于左：item-shape 不过');
  const d3 = clone();
  d3.locations[0].readFrom = 'picture';
  ok(!gate(d3, 'item-shape').ok, '按图认的却没有 box：item-shape 不过');
  d3.locations[0].items.forEach((i) => { i.box = [0.1, 0.1, 0.2, 0.2]; });
  ok(gate(d3, 'item-shape').ok, '补上 box 就过');
  const d4 = clone();
  d4.locations[0].items[0].on = 'yes';
  ok(!gate(d4, 'item-shape').ok, 'on 不是布尔：item-shape 不过');
}
{
  const d = clone();
  d.scenes[0].sceneId = 'S09';
  ok(!gate(d, 'location-ref').ok, '这一场的地点没有认图结果：location-ref 不过');
  const art = JSON.parse(JSON.stringify(ART));
  art.scenes = art.scenes.filter((s) => s.id !== 'S03');
  ok(!gate(FIXTURE, 'location-ref', { art }).ok, '地点不在 art.json 里：location-ref 不过');
}
{
  const d = clone();
  d.scenes[1].places.pop();
  ok(!gate(d, 'cast-complete').ok, '少一个人：cast-complete 不过');
  const d2 = clone();
  d2.scenes[1].places.push({ ...d2.scenes[1].places[0], id: 'C09', name: '路人' });
  ok(!gate(d2, 'cast-complete').ok, '多一个出场人物表以外的人：cast-complete 不过');
  const d3 = clone();
  d3.scenes[1].places.push({ ...d3.scenes[1].places[1] });
  ok(!gate(d3, 'cast-complete').ok, '同一个人两条：cast-complete 不过');
  const script = JSON.parse(JSON.stringify(SCRIPT));
  script.episodes[0].scenes[0].characters.push('C02');
  ok(!gate(FIXTURE, 'cast-complete', { script }).ok, '出场人物跟剧本不一致：cast-complete 不过');
}
{
  const d = clone();
  d.scenes[2].places[0].present = null;
  ok(!gate(d, 'present-set').ok, '没定在不在场：present-set 不过');
  const d2 = clone();
  d2.scenes[2].places = d2.scenes[2].places.map((p) => ({ ...p, present: false, item: null, side: null, along: null }));
  ok(!gate(d2, 'present-set').ok, '开场一个人都不在：present-set 不过');
}
{
  const breakIt = (change) => {
    const d = clone();
    Object.assign(d.scenes[2].places[0], change);
    return gate(d, 'place-valid').ok;
  };
  ok(!breakIt({ item: '屏风' }), '站在认图里没有的东西旁：place-valid 不过');
  ok(!breakIt({ side: 'up' }), 'side 写错：place-valid 不过');
  ok(!breakIt({ item: '西侧舱壁', side: 'on' }), '写了在不能坐不能站的东西上：place-valid 不过');
  ok(!breakIt({ item: '西侧舱壁', side: 'east', along: 1.5 }), 'along 超出 0–1：place-valid 不过');
  ok(breakIt({ item: '西侧舱壁', side: 'east', along: 0.4, posture: 'stand', facing: 'east' }), '站在舱壁东侧：合法');
  ok(!breakIt({ posture: 'lie' }), 'posture 写错：place-valid 不过');
  ok(!breakIt({ facing: 'up' }), 'facing 写错：place-valid 不过');
  const d = clone();
  d.scenes[1].places[0].item = '第一排坐板';
  ok(!gate(d, 'place-valid').ok, '不在场的人写了 item：place-valid 不过');
}
{
  const d = clone();
  const [a, b] = d.scenes[2].places;
  Object.assign(a, { item: '西侧舱壁', side: 'east', along: 0.5, posture: 'stand', facing: 'east' });
  Object.assign(b, { item: '西侧舱壁', side: 'east', along: 0.5 + MIN_APART / 2, posture: 'stand', facing: 'east' });
  ok(!gate(d, 'no-overlap').ok, '同一侧挨得太近：no-overlap 不过');
  b.along = 0.5 + MIN_APART * 1.5;
  ok(gate(d, 'no-overlap').ok, '拉开就过');
  Object.assign(b, { item: '第一排坐板', side: 'on', along: 0.5 });
  Object.assign(a, { item: '第一排坐板', side: 'on', along: 0.5, posture: 'sit' });
  ok(gate(d, 'no-overlap').ok, '几个人坐在同一条坐板上不算叠：并排画开');
}
{
  const d = clone();
  d.scenes[0].extras = null;
  ok(!gate(d, 'extras').ok, '群演人数没写：extras 不过');
  const d2 = clone();
  d2.scenes[0].extras = 2;
  ok(!gate(d2, 'extras').ok, '有群演没写在哪：extras 不过');
  d2.scenes[0].extrasWhere = '岸端土坡西头';
  ok(gate(d2, 'extras').ok, '写了在哪就过');
  const d3 = clone();
  d3.scenes[0].extrasWhere = '岸端土坡';
  ok(!gate(d3, 'extras').ok, '没有群演却写了在哪：extras 不过');
}
{
  const d = clone();
  d.scenes[0].places[0].item = '屏风';
  const problems = validateStaging(d);
  ok(problems.length === 1 && problems[0].startsWith('第 1 集第 1 场：沈知微'), 'validate 每条带上场次和人');
  const live = sceneProblems(d.scenes[0], d.locations[0], 'en');
  ok(live[0].text.includes('is not one of the things'), '报告页面上的检查有英文说法');
}

/* ---------------- 报告 ---------------- */

{
  const md = renderMarkdown(FIXTURE);
  ok(md.startsWith('# 渡口 · 开场站位'), 'markdown 标题');
  ok(md.includes('沈知微站在岸端土坡上，面朝北；老周坐在靠岸的渡船上，面朝南'), 'markdown 带每场的走位句');
  ok(md.includes('开场不在：胡二爷'), 'markdown 写明谁开场不在');
  ok(renderMarkdown(FIXTURE, 'en').includes('Opening staging'), 'markdown 英文界面');
}
{
  const html = renderHtml(FIXTURE);
  ok(html.includes('id="staging-data"') && html.includes('function stagingCore()'), '报告带着数据和同一份算法');
  ok(html.includes('class="card scene"') && html.includes('class="room"'), '每场一张能拖的平面');
  ok(html.includes('导出 JSON') && html.includes('还原到文件里的版本'), '导出和还原按钮');
  ok(html.includes('✓ 质量门 8/8'), '页眉质量门徽章');
  const d = clone();
  d.scenes[0].places[0].name = '</script><b>x';
  const bad = renderHtml(d);
  ok(!bad.includes('</script><b>x'), '数据里的 </script 被转义，截不断脚本');
  ok(renderHtml(FIXTURE, 'en').includes('lang="en"') && renderHtml(FIXTURE, 'en').includes('Opening blocking'), '--lang en 出英文界面');
  let threw = false;
  try { renderHtml(FIXTURE, 'jp'); } catch { threw = true; }
  ok(threw, '非内置语言直接抛错（目前内置 zh / en）');
  const withPic = clone();
  withPic.locations[1].readFrom = 'picture';
  withPic.locations[1].items.forEach((i) => { i.box = [0.1, 0.2, 0.3, 0.4]; });
  const pic = renderHtml(withPic, 'zh', { S01: 'images/渡船船舱-sheet.png' });
  ok(pic.includes('src="images/渡船船舱-sheet.png"') && pic.includes('class="pbox"'), '有图就嵌图，认出来的东西在图上画框');
  ok(!renderHtml(FIXTURE).includes('class="pbox"'), '没图不画框，显示占位');
}
{
  // 页面里那份算法是 stagingCore 的源码原样嵌进去的：单独拿源码重建一份，结果必须一样
  const rebuilt = new Function(`${stagingCore.toString()}\nreturn stagingCore();`)();
  eq(rebuilt.nearestPlace({ x: 0.75, y: 0.36 }, [TABLE, CHAIR]), nearestPlace({ x: 0.75, y: 0.36 }, [TABLE, CHAIR]), '嵌进页面的算法不依赖外面的东西');
  eq(rebuilt.stagingBlocking(FIXTURE.scenes[3], 'zh'), stagingBlocking(FIXTURE.scenes[3], 'zh'), '页面上算出的走位句跟命令行一样');
}
{
  eq(slug('渡口 栈桥/东'), '渡口-栈桥-东', 'slug 去掉空白和斜杠');
  eq(slug('  '), 'scene', '空名字有兜底');
}

/* ---------------- CLI 默认交付格式 ---------------- */
{
  const cli = join(here, 'novel-staging.mjs');
  const fixture = join(here, '..', 'examples', '渡口-staging.json');
  const render = (...args) => spawnSync(process.execPath, [cli, 'render', fixture, ...args], { encoding: 'utf8' });
  const primary = render();
  ok(primary.status === 0 && /^<!doctype html>/i.test(primary.stdout), '不指定格式：默认输出 HTML 工具报告');
  const legacy = render('--html');
  ok(legacy.status === 0 && /^<!doctype html>/i.test(legacy.stdout), '显式 --html 继续输出 HTML');
  const text = render('--md');
  ok(text.status === 0 && text.stdout.startsWith('# 渡口 · 开场站位'), '显式 --md 才输出 Markdown');
  const english = render('--lang', 'en');
  ok(english.status === 0 && /<html lang="en">/.test(english.stdout), '默认 HTML 支持英文界面');
  const conflict = render('--html', '--md');
  ok(conflict.status !== 0 && conflict.stdout === '', '格式冲突时不输出混合产物');
}

console.log(`✓ ${passed} 项自测全部通过`);
