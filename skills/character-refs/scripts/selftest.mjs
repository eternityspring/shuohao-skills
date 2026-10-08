#!/usr/bin/env node
// 自测：覆盖所有确定性逻辑。不调用任何真实模型、不花额度——
// Qwen 与 GPT Image 用本地假服务器校验请求形状，完整流程用自定义命令模板造白底图。
//   node scripts/selftest.mjs

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chunks, crc32, decode, flattenAlpha, pngInfo, readText, solidPng, withText } from './png.mjs';
import { deflateSync } from 'node:zlib';
import {
  ANCHOR, DEFAULT_LOOK, allViews, anchorUsable, assetFromIntake, buildPrompt, confirmTable, current, defaultSkin, gates,
  intakeProblems, nounOf, resolveLayers, pronouns, recordVersion, resolveRefs, staleReasons, viewsOfTier,
} from './core.mjs';
import {
  QWEN_SIZES, codexStdin, configMissing, fillTemplate, loadConfig, maskConfig, modelKind, openaiGenerate, openaiRequest,
  parseEnv, qwenEndpoint, qwenGenerate, qwenWorkflow,
} from './models.mjs';
import { renderHtml, safeName } from './character-refs.mjs';
import { BUILTIN, UI, fmt, uiFor, uiMissing, uiTemplate } from './i18n.mjs';
import { LOOKS, findLook, lookName, lookProblems, lookSnapshot } from './looks.mjs';
import { lookHash } from './core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CLI = join(here, 'character-refs.mjs');
const INTAKE = JSON.parse(readFileSync(join(here, '..', 'examples', '阿禾-intake.json'), 'utf8'));
const clone = (x) => structuredClone(x);
const REAL = lookSnapshot(findLook('写实'));
const A0 = () => assetFromIntake(INTAKE, REAL);
let passed = 0;
const ok = (c, label) => { assert.ok(c, label); passed++; };
const eq = (a, b, label) => { assert.equal(a, b, `${label} — 期望 ${b}，实际 ${a}`); passed++; };
const TMP = mkdtempSync(join(tmpdir(), 'character-refs-selftest-'));

/* ---------------- PNG ---------------- */
{
  const png = solidPng(40, 60, [255, 255, 255]);
  const info = pngInfo(png);
  ok(info.width === 40 && info.height === 60 && info.depth === 8, '读得出尺寸与位深');
  const tagged = withText(png, { 'shuohao:id': '阿禾/default/front-full/v1', 'shuohao:model': 'qwen' });
  eq(readText(tagged)['shuohao:id'], '阿禾/default/front-full/v1', 'iTXt 标识写入后读回（含中文）');
  eq(readText(tagged)['shuohao:model'], 'qwen', '多个标识都在');
  const again = withText(tagged, { 'shuohao:id': '阿禾/default/front-full/v2' });
  eq(readText(again)['shuohao:id'], '阿禾/default/front-full/v2', '同名标识替换而不是重复');
  eq(chunks(again).filter((c) => c.type === 'iTXt').length, 2, '替换后标识块数量不变');
  ok(chunks(again).every((c) => c.type === 'IEND' || again.readUInt32BE(c.end - 4) === crc32(again.subarray(c.start + 4, c.end - 4))), '每一块的 CRC 都对');
  eq(chunks(again).at(-1).type, 'IEND', 'IEND 仍在最后');
  const px = decode(tagged);
  ok(px && px.px[0] === 255 && px.px.length === 40 * 60 * 3, '打标识后像素不变、能解');
}

/* ---------------- 透明背景 ---------------- */
// 手搓一张 RGBA：四周透明（像素是透明的黑，和 codex 出的一样），中间一块不透明的蓝
function rgbaPng(w, h) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = y * (w * 4 + 1) + 1 + x * 4;
    const inside = x > w / 4 && x < (w * 3) / 4 && y > h / 4 && y < (h * 3) / 4;
    raw.set(inside ? [30, 60, 160, 255] : [0, 0, 0, 0], o);
  }
  const ck = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ck('IHDR', ihdr), ck('IDAT', deflateSync(raw)), ck('IEND', Buffer.alloc(0))]);
}
{
  const t = rgbaPng(400, 600);
  ok(Object.fromEntries(gates(t, '2:3', 'full').map((x) => [x.id, x])).white.ok, '透明背景的边按白算，不误判成 0%');
  const f = flattenAlpha(t);
  ok(f.changed && pngInfo(f.buf).colorType === 2, '透明 PNG 铺白后存成不透明的 RGB');
  const d = decode(f.buf);
  ok(d.px[0] === 255 && d.px[1] === 255 && d.px[2] === 255, '透明的黑铺成纯白');
  const mid = (300 * 400 + 200) * 3;
  ok(d.px[mid] === 30 && d.px[mid + 2] === 160, '不透明的部分颜色不变');
  eq(flattenAlpha(solidPng(10, 10)).changed, false, '本来不透明的图原样返回');
  {
    const opaque = decode(rgbaPng(40, 60));
    for (let i = 3; i < opaque.px.length; i += 4) opaque.px[i] = 255;
    const raw = Buffer.alloc(60 * (40 * 4 + 1));
    for (let y = 0; y < 60; y++) opaque.px.copy(raw, y * 161 + 1, y * 160, (y + 1) * 160);
    const t = rgbaPng(40, 60);
    const idat = chunks(t).find((c) => c.type === 'IDAT');
    const ck = (d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from('IDAT'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
    const opq = Buffer.concat([t.subarray(0, idat.start), ck(deflateSync(raw)), t.subarray(idat.end)]);
    eq(flattenAlpha(opq).changed, false, '带透明度通道但全是不透明（Qwen 出的就是）：原样保留、不留注');
  }
}

/* ---------------- 检查门 ---------------- */
const g = (buf, ratio, kind) => Object.fromEntries(gates(buf, ratio, kind).map((x) => [x.id, x]));
{
  const white = solidPng(400, 600);
  ok(Object.values(g(white, '2:3', 'full')).every((x) => x.ok), '白底 2:3 全身图全过');
  const framed = solidPng(400, 600, null, (x, y) => (x < 20 ? [40, 40, 40] : [255, 255, 255]));
  ok(!g(framed, '2:3', 'full').white.ok, '左边一条深色：全身图四边不够白被拦');
  const bust = solidPng(400, 500, null, (x, y) => (y > 300 ? [20, 20, 60] : [255, 255, 255]));
  ok(g(bust, '4:5', 'face').white.ok, '大头照身体顶到下边：只查上边与两侧上半，不误拦');
  ok(!g(bust, '4:5', 'full').white.ok, '同一张图按全身图查就会被拦——大头照必须分开写');
  const det = g(solidPng(400, 400, [20, 20, 60]), '1:1', 'detail').white;
  ok(det.ok && det.detail.includes('跳过'), '细节图不查背景，且明说跳过');
  ok(!g(solidPng(400, 400), '2:3', 'full')['ratio-target'].ok, '比例不对被拦');
  ok(!g(solidPng(200, 300), '2:3', 'full').size.ok, '单边小于 300 被拦');
  ok(!g(solidPng(100, 400), '2:3', 'full')['ratio-range'].ok, '宽高比出了 0.4–2.5 被拦');
  ok(!g(Buffer.from('not a png'), '2:3', 'full').format.ok, '不是 PNG 明说无法检查');
}

/* ---------------- 一次性输入 ---------------- */
eq(intakeProblems(INTAKE).length, 0, '样例输入零问题');
const bad = (mut, word, label) => {
  const x = clone(INTAKE);
  mut(x);
  ok(intakeProblems(x).some((p) => p.includes(word)), label);
};
bad((x) => delete x.face, 'face', '缺脸型五官被拦');
bad((x) => { x.hair.en = '一条粗辫'; }, '中日韩', '英文字段混中文被拦');
bad((x) => { x.face.en += ', anime style'; }, '画风词', '角色描述里写画风被拦——画风由画风层统一加');
bad((x) => { x.face.en += ' like 阿禾'; }, '角色名', '英文里出现角色名被拦');
bad((x) => { x.identity.source = 'default'; }, '不能用默认值', '身份用默认值被拦——推不出来就问');
bad((x) => { x.identity.age = '十六'; }, 'age', '年龄不是整数被拦');
bad((x) => { x.identity.gender = 'girl'; }, 'gender', '性别只收 female / male');
bad((x) => { x.outfit.details.push({ ...x.outfit.details[0] }); }, '重复', '同一细节槽位写两次被拦');
bad((x) => { x.outfit.details.push({ slot: 'custom', id: 'pen', part: 'body', en: 'a close-up of the fountain pen', text: '钢笔' }); }, '取景词', '自定义细节写了 close-up 被拦——取景由脚本加');
bad((x) => { x.outfit.details.push({ slot: 'custom', id: 'pen', part: 'chest', en: 'the fountain pen', text: '钢笔' }); }, 'part', '部位不在列表里被拦');
bad((x) => { x.outfit.details.push({ slot: 'custom', id: 'glasses', part: 'face', en: 'his round glasses', text: '眼镜' }); }, '正脸大头照', '脸部细节被拦，并说明大头照已经看得清');
bad((x) => { x.outfit.details.push({ slot: 'custom', id: 'hair', part: 'hair', en: 'a hairpin', text: '发簪' }); }, '同名', '自定义 id 和默认槽位同名被拦');
bad((x) => { for (let i = 0; i < 5; i++) x.outfit.details.push({ slot: 'custom', id: `c${i}`, part: 'body', en: 'a patch', text: '补丁' }); }, '最多', '细节超过 8 个被拦');
bad((x) => { x.face.en += ' (inferred)'; }, '推断标记', '推断标记写进英文被拦——会被画进画面');
bad((x) => { x.outfit.top.source = 'guess'; }, 'source', 'source 只收三种');
{
  const x = clone(INTAKE);
  x.outfit.details.push({ slot: 'custom', id: 'collar-tag', part: 'neck', en: 'Zoom in to an extreme close-up of only the frayed edge of her collar.', text: '领口磨毛的边' });
  x.outfit.details.push({ slot: 'custom', id: 'fingertips', part: 'hands', en: 'her fingertips stained green from picking tea', text: '被茶汁染绿的指尖', source: 'stated' });
  eq(intakeProblems(x).length, 0, '自定义细节放行：只写部位的新写法，和老输入的整句写法');
  const a = assetFromIntake(x);
  const hp = buildPrompt(a, 'default', 'detail-fingertips');
  ok(hp.text.startsWith('Zoom in to an extreme close-up of only her hand: her fingertips stained green') && hp.text.includes('16-year-old'), '自定义「手」：脚本按部位加取景，写明年龄');
  ok(hp.negative.includes('full body') && hp.refs.join() === 'front-full', '手部细节只挂锚点，反向词禁全身');
  const mp = buildPrompt(a, 'default', 'detail-collar-tag');
  ok(mp.text.startsWith('Zoom in to an extreme close-up of only the frayed edge of her collar.') && mp.refs.join() === 'front-full,face-front', '老输入的整句原样使用；领口细节挂锚点 + 大头照');
  ok(confirmTable(x).includes('〔未实测〕') && !confirmTable(INTAKE).includes('〔未实测〕'), '确认表给自定义细节标「未实测」，默认槽位不标');
  eq(allViews(a.outfits.default)['detail-fingertips'].tested, false, '视图记下是否实测过');
}
{
  const x = clone(INTAKE);
  for (const f of [x.identity, x.face, x.hair, x.outfit.top]) { f.zh = f.text; delete f.text; }
  eq(intakeProblems(x).length, 0, '旧输入写 zh 而不是 text，照样认');
  ok(confirmTable(x).includes('十六岁采茶姑娘'), '旧输入的 zh 进确认表');
}
bad((x) => { delete x.face.text; }, 'text', '缺给人看的描述被拦');
bad((x) => { x.lang = 'Chinese'; }, '语言代码', 'lang 不是语言代码被拦');
bad((x) => { x.lang = 'fr'; }, 'ui-template fr', '非内置语言没带 ui 被拦，并指出怎么补');
{
  const x = clone(INTAKE);
  x.lang = 'fr';
  x.ui = { ...uiTemplate('fr'), fields: { ...UI.en.fields, identity: 'Identité' } };
  eq(intakeProblems(x).length, 0, '非内置语言带齐 ui 就放行');
  ok(confirmTable(x).startsWith('阿禾 · 常态 · 采茶装 · to confirm') && confirmTable(x).includes('Identité'), '确认表用自译文案');
}
{
  const x = clone(INTAKE);
  x.lang = 'en';
  delete x.skin;
  const t = confirmTable(x);
  ok(t.includes('Identity') && t.includes('(16 · female)') && t.includes('〔inferred〕') && t.includes('〔default〕'), '英文确认表：标签、身份行、来源都是英文');
  ok(t.includes(UI.en.defaultSkin.young) && t.includes(UI.en.defaultBack), '英文确认表：缺省皮肤与背面也是英文');
}
{
  const t = confirmTable(INTAKE);
  ok(t.includes('〔推断〕') && t.includes('〔默认〕'), '确认表标出推断与默认');
  ok(t.includes('背面') && t.includes('〔默认〕'), '没写背面：按发型与服装补，并标默认');
  const x = clone(INTAKE);
  delete x.skin;
  ok(confirmTable(x).includes(defaultSkin(16).zh), '没写皮肤：按年龄补');
}

/* ---------------- 界面文案 ---------------- */
for (const l of BUILTIN) eq(uiMissing(UI[l]).length, 0, `内置语言 ${l} 的文案齐全`);
assert.throws(() => uiFor('fr'), /ui-template fr/); passed++;
ok(uiFor('fr', uiTemplate('fr')).htmlLang === 'fr', '自译文案齐全即可使用');
eq(uiFor('en', { title: 'Cast refs' }).title, 'Cast refs', '内置语言可以只覆盖几项');
eq(uiFor('en', { title: 'Cast refs' }).without, UI.en.without, '没覆盖的照旧');
eq(fmt('第 {n} 档 {x}', { n: 2 }), '第 2 档 {x}', '占位符只填给了的');
ok(uiTemplate('fr')._说明.join('').includes('占位符'), '骨架带翻译说明');

/* ---------------- 画风预设 ---------------- */
for (const [name, id] of [['写实', 'realistic-photo'], ['realistic', 'realistic-photo'], ['REALISTIC', 'realistic-photo'], ['动漫', 'anime'], ['anime', 'anime'], ['動漫', 'anime'], ['アニメ', 'anime']]) {
  eq(findLook(name)?.id, id, `画风名「${name}」→ ${id}`);
}
eq(findLook('油画'), null, '没有的预设返回空');
eq(DEFAULT_LOOK.id, 'anime', '默认动漫');
eq(findLook('卡通')?.id, 'anime', '「卡通」也是动漫');
eq(assetFromIntake(INTAKE).outfits.default.look.id, 'anime', '不指定画风：建资产用动漫');
ok(LOOKS.every((l) => l.label.zh && l.label.en && l.label.ja && ['photo', 'drawn'].includes(l.medium) && lookProblems(l).length === 0), '每个预设都有中英日名字、介质，且自身合规');
ok(!('names' in lookSnapshot(findLook('anime'))), '快照不带命令行别名');
{
  const legacy = { id: 'realistic-photo', label: '写实照片（方案四）', style: REAL.style, clean: REAL.clean, neg: REAL.neg };
  eq(lookHash(legacy), lookHash(REAL), '老资产的写实快照（没有 medium）指纹不变，不会平白过期');
  eq(lookName(legacy, 'en'), '写实照片（方案四）', '老资产的字符串名字原样显示');
}
eq(lookName(REAL, 'en'), 'Realistic photo', '预设名字按语言取');
eq(lookName({ label: { zh: '水墨' } }, 'fr'), '水墨', '没有这个语言就退到别的');
ok(lookProblems({ style: 's', clean: 'grey studio', neg: 'n' }).some((x) => x.includes('white')), '自定义画风没写白底被拦');
{
  const a = assetFromIntake(INTAKE, lookSnapshot(findLook('anime')));
  const anchor = buildPrompt(a, 'default', 'front-full', a.outfits.default.look).text;
  ok(anchor.includes('anime illustration') && !anchor.includes('freckles') && !anchor.includes('A real photograph'), '动漫：写动漫画风，不写皮肤层（雀斑、毛孔会把画面往写实拽）');
  ok(!buildPrompt(a, 'default', 'detail-hair', a.outfits.default.look).text.includes('macro photo'), '动漫：细节图不写 photo');
  ok(buildPrompt(A0(), 'default', 'front-full').text.includes('freckles') && buildPrompt(A0(), 'default', 'detail-hair').text.includes('macro photo'), '写实：照旧写皮肤层与 macro photo');
}

/* ---------------- 视图、档位、提示词 ---------------- */
const A = assetFromIntake(INTAKE, REAL);   // 提示词的写法以写实为基线测；动漫的差异在画风预设一节
const O = 'default';
eq(viewsOfTier(A.outfits[O], 1).join(), 'front-full', '第一档只有锚点');
eq(viewsOfTier(A.outfits[O], 2).join(), 'face-front,side-full,back-full', '第二档：大头照、90° 侧面、背面');
eq(viewsOfTier(A.outfits[O], 3).join(), 'detail-hair,detail-neck,detail-sleeve,detail-feet', '第三档：四个默认细节');
eq(viewsOfTier(A.outfits[O], 4).join(), 'face-45', '45° 大头照在最后一档');
eq(A.outfits[O].look.style, REAL.style, '建资产时把画风层整份快照进造型');
{
  const x = assetFromIntake({ ...clone(INTAKE), outfit: { ...clone(INTAKE.outfit), details: [] } });
  eq(viewsOfTier(x.outfits[O], 3).length, 0, '没写细节就没有第三档');
}
const P = (v) => buildPrompt(A, O, v, REAL);
ok(P('front-full').text.startsWith('Full-body front view: she stands straight and faces the camera squarely'), '锚点：正面全身，代词按性别');
ok(P('front-full').text.includes(REAL.style) && P('front-full').text.includes(REAL.clean), '锚点带画风层');
eq(P('front-full').refs.length, 0, '锚点纯文生图，不挂参考');
ok(P('face-front').text.startsWith('Zoom in to an extreme close-up head-and-shoulders portrait, passport-photo framing'), '大头照第一句要求拉近——改图模型只听第一句');
ok(P('face-front').text.includes('chin sits at the vertical middle'), '大头照写可量化的取景');
ok(P('front-full').text.includes('both ears equally visible') && P('front-full').negative.includes('three-quarter view'), '锚点把「正面」写成几何，并禁 3/4 侧身——锚点侧了，派生的大头照也会侧');
ok(P('face-front').text.includes('nose is on the vertical centre line') && P('face-front').text.endsWith('sleeves and cuffs are out of frame.') && P('face-front').negative.includes('head turned to the side'), '正脸大头照同样写几何、禁侧脸');
ok(!P('face-front').text.includes('trousers') && !P('face-front').text.includes('sandals') && !P('face-45').text.includes('sandals'), '大头照不写下装和鞋——写了就拉远镜头');
ok(P('face-front').text.includes('the same hand-woven indigo cotton jacket') && P('face-front').text.includes('eyebrows, one thick black braid'), '大头照保留上装；冠词和句首大写处理干净');
ok(P('side-full').text.includes('the same loose black cotton trousers'), '全身视图保留下装');
for (const v of ['face-front', 'side-full', 'back-full']) ok(!P(v).text.includes('tea stains') && !P(v).text.includes('knot of her'), `${v} 不重复细节描述——锚点里有`);
ok(P('side-full').text.includes('face the right edge of the image') && P('side-full').text.includes('not at the camera'), '侧面：90°、面朝右、不看镜头');
ok(P('back-full').text.startsWith('Rotate the camera 180 degrees around her'), '背面：绕人物转 180°');
ok(P('face-45').text.includes('toward the left side of the image'), '45° 面朝左（与 90° 侧面相反，左右脸都有）');
ok(P('detail-hair').text.startsWith('Zoom in to an extreme close-up macro photo of only the knot'), '细节第一句只写这个部位');
ok(!P('detail-neck').text.includes('straw sandals') && !P('detail-neck').text.includes('Keep her exactly'), '细节不列整套服装——列了就画整个人');
ok(P('detail-neck').text.includes('skin of a 16-year-old'), '露皮肤的细节写明年龄，免得画老');
eq(P('detail-hair').refs.join(), 'front-full,face-front', '头发 / 领口细节挂锚点 + 大头照');
eq(P('detail-sleeve').refs.join(), 'front-full', '袖口 / 鞋只挂锚点');
ok(P('detail-sleeve').negative.includes('full body'), '细节反向词禁全身');
for (const v of Object.keys(allViews(A.outfits[O]))) {
  ok(!/[㐀-鿿]/.test(P(v).text) && !P(v).text.includes('阿禾'), `${v} 提示词全英文、不含角色名`);
}
eq(pronouns('male').p, 'his', '男性代词');
eq(nounOf(70, 'male'), 'old man', '七十岁男性叫 old man');
eq(nounOf(16, 'female'), 'young woman', '十六岁女性叫 young woman');
{
  const m = assetFromIntake({ ...clone(INTAKE), name: '老周', identity: { age: 70, gender: 'male', en: 'An elderly ferryman', zh: '老船夫', source: 'stated' } });
  ok(buildPrompt(m, O, 'back-full').text.startsWith('Rotate the camera 180 degrees around him') && buildPrompt(m, O, 'face-front').text.includes('this same old man'), '换成老年男性：代词与称呼跟着变');
}

/* ---------------- 版本、确认、过期 ---------------- */
{
  const a = assetFromIntake(INTAKE);
  const png = (w, h) => solidPng(w, h);
  const add = (view, confirmMode = 'wait') => {
    const pr = buildPrompt(a, O, view);
    const { refs } = view === ANCHOR ? { refs: [] } : resolveRefs(a, O, pr);
    const [w, h] = QWEN_SIZES[pr.ratio];
    return recordVersion(a, O, view, { buf: png(w / 8 * 3, h / 8 * 3), model: 'qwen', seed: 1, prompt: pr, refs, confirmMode }).version;
  };
  eq(anchorUsable(a, O).ok, false, '没有锚点不能派生');
  const v1 = add(ANCHOR);
  eq(v1.id, '阿禾/default/front-full/v1', '标识 = 角色/造型/视图/版本');
  eq(v1.confirmed, false, '配置要求确认时，新锚点待确认');
  ok(anchorUsable(a, O).why.includes('confirm'), '锚点没确认就不许派生，并说明怎么确认');
  v1.confirmed = true;
  ok(anchorUsable(a, O).ok, '确认后可以派生');
  ok(add(ANCHOR, 'auto').confirmed === 'auto', '配置为不确认：记成 auto，报告里照样标出');
  {
    const b = assetFromIntake(INTAKE);
    const dark = recordVersion(b, O, ANCHOR, { buf: solidPng(396, 594, [20, 20, 20]), model: 'qwen', prompt: buildPrompt(b, O, ANCHOR), confirmMode: 'auto' }).version;
    eq(dark.confirmed, false, '配置为不确认，但锚点没过门：自动确认不放行');
    eq(anchorUsable(b, O).ok, false, '没过门的锚点不能拿来派生');
  }
  current(a.outfits[O], ANCHOR).confirmed = true;
  const face = add('face-front');
  eq(face.refs[0].v, 2, '派生图记下参考的锚点版本');
  add('side-full'); add('back-full'); add('detail-hair'); add('detail-sleeve');
  eq(current(a.outfits[O], 'detail-hair').refs.map((r) => r.view).join(), 'front-full,face-front', '头发细节实际挂了两张参考');
  ok(['face-front', 'side-full', 'detail-hair', 'detail-sleeve'].every((v) => staleReasons(a, O, v).length === 0), '刚出完全部有效');
  add('face-front');   // 重出大头照
  ok(staleReasons(a, O, 'detail-hair').some((s) => s.includes('face-front')), '重出大头照 → 挂了它的细节过期');
  eq(staleReasons(a, O, 'detail-sleeve').length, 0, '重出大头照 → 只挂锚点的细节不受影响');
  eq(staleReasons(a, O, 'side-full').length, 0, '重出大头照 → 侧面不受影响');
  eq(a.outfits[O].views['face-front'].versions.length, 2, '重出不删旧版');
  add(ANCHOR);         // 重出锚点
  ok(['face-front', 'side-full', 'back-full', 'detail-sleeve'].every((v) => staleReasons(a, O, v).length), '重出锚点 → 其余全部过期');
  eq(anchorUsable(a, O).ok, false, '重出的锚点要重新确认');
  current(a.outfits[O], ANCHOR).confirmed = true;
  a.layers.hair.en += ', with a red ribbon';
  ok(staleReasons(a, O, ANCHOR).includes('文字描述改过了'), '改了文字描述 → 锚点也过期');
  a.layers.hair.en = INTAKE.hair.en;
  eq(staleReasons(a, O, ANCHOR).join('/'), '', '改回去就不过期（按指纹比，不按时间）');
  a.outfits[O].details.push({ slot: 'custom', id: 'fingertips', part: 'hands', en: 'her fingertips stained green', text: '染绿的指尖' });
  ok(['front-full', 'side-full', 'back-full', 'detail-sleeve'].every((v) => !staleReasons(a, O, v).includes('文字描述改过了')), '加一个细节：其他图不过期（细节只决定拍哪些特写）');
  a.outfits[O].details.pop();
  a.outfits[O].details.find((d) => d.slot === 'sleeve').en += ', frayed';
  ok(staleReasons(a, O, 'detail-sleeve').includes('文字描述改过了') && !staleReasons(a, O, ANCHOR).includes('文字描述改过了'), '改某条细节的文字：只有那张细节图过期');
  a.outfits[O].details.find((d) => d.slot === 'sleeve').en = INTAKE.outfit.details.find((d) => d.slot === 'sleeve').en;
  delete a.outfits[O].views['face-front'];
  const r = resolveRefs(a, O, buildPrompt(a, O, 'detail-neck'));
  ok(r.refs.length === 1 && r.notes[0].includes('只挂锚点'), '大头照不在：退回只挂锚点，不阻塞，并留注');
  a.outfits[O].look.style += ' Extra.';
  ok(staleReasons(a, O, ANCHOR).includes('画风快照变了'), '画风快照被改 → 过期');
}

/* ---------------- 模型适配（不联网） ---------------- */
{
  const q = loadConfig(join(TMP, 'none.json')).models.qwen;
  const t2i = qwenWorkflow({ text: 't', negative: 'n', ratio: '2:3', seed: 7 }, [], q);
  ok(t2i.pos.class_type === 'CLIPTextEncode' && !t2i.ref1, '锚点：纯文生图工作流');
  eq(`${t2i.lat.inputs.width}x${t2i.lat.inputs.height}`, '1056x1584', '2:3 尺寸');
  const ed = qwenWorkflow({ text: 't', negative: 'n', ratio: '1:1', seed: 7 }, ['a.png', 'b.png'], q);
  ok(ed.pos.class_type === 'TextEncodeQwenImageEditPlus' && ed.pos.inputs.image2[0] === 'ref2' && !ed.pos.inputs.image3, '派生：两张参考图接进编码器');
  for (const [r, [w, h]] of Object.entries(QWEN_SIZES)) ok(w % 16 === 0 && h % 16 === 0 && w * h >= 655360 && w * h <= 8294400, `${r} 尺寸也满足 gpt-image-2 的规则`);
  eq(parseEnv('# x\nCOMFY_URL=http://h:1/\nCOMFY_PASS="p w"\n').COMFY_PASS, 'p w', '读 .env：去引号、跳注释');
  const envf = join(TMP, '.env');
  writeFileSync(envf, 'COMFY_URL=http://example:8188/\nCOMFY_USER=u\nCOMFY_PASS=secret\n');
  const ep = qwenEndpoint({ ...q, envFile: envf }, {});
  ok(ep.url === 'http://example:8188' && ep.auth === 'Basic ' + Buffer.from('u:secret').toString('base64'), '从 .env 取地址与账号');
  assert.throws(() => qwenEndpoint(q, {}), /COMFY_URL/); passed++;
  const o = loadConfig(join(TMP, 'none.json')).models.openai;
  const gen = openaiRequest({ text: 'T', negative: 'N', ratio: '2:3', refs: [] }, o);
  ok(gen.path === '/images/generations' && gen.json.size === '1056x1584' && gen.json.model === 'gpt-image-2' && gen.json.prompt.endsWith('Avoid: N.'), 'GPT Image：锚点走 generations，反向词写成 Avoid');
  const f1 = join(TMP, 'r1.png'), f2 = join(TMP, 'r2.png');
  writeFileSync(f1, solidPng(10, 10)); writeFileSync(f2, solidPng(10, 10));
  const edit = openaiRequest({ text: 'T', negative: 'N', ratio: '4:5', refs: [f1, f2] }, o);
  ok(edit.path === '/images/edits' && edit.form.getAll('image[]').length === 2 && !edit.form.has('input_fidelity'), 'GPT Image：派生走 edits，两张参考图，gpt-image-2 不传 input_fidelity');
  ok(openaiRequest({ text: 'T', negative: 'N', ratio: '4:5', refs: [f1] }, { ...o, model: 'gpt-image-1' }).form.get('input_fidelity') === 'high', '老模型 gpt-image-1 传 input_fidelity=high');
  const s = codexStdin({ text: 'T', negative: 'N', ratio: '4:5', refs: ['a', 'b'] });
  ok(s.includes('4:5 aspect ratio') && s.includes('image 2 is a close-up of the face') && s.includes('./out.png'), 'codex：比例写进提示词、说明两张参考图');
  eq(fillTemplate("tool --p {prompt_file} --r {refs} --o {out} {missing}", { prompt_file: "/t/it's.txt", refs: ['/a b.png', '/c.png'], out: '/o.png' }),
    "tool --p '/t/it'\\''s.txt' --r '/a b.png' '/c.png' --o '/o.png' {missing}", '命令模板：全部加引号，未知占位符原样保留');
  assert.throws(() => modelKind('midjourney'), /不认识/); passed++;
  eq(modelKind('custom:mine'), 'custom', '自定义模型');
  const c = loadConfig(join(TMP, 'none.json'));
  eq(configMissing(c).length, 3, '初次运行：模型、派生模型、是否确认三件事都要问');
  eq(maskConfig({ models: { qwen: { pass: 'x' } } }).models.qwen.pass, '（已隐藏）', '展示配置时密码打码');
}

/* ---------------- 假服务器：Qwen / GPT Image ---------------- */
const serve = (handler) => new Promise((ok_) => {
  const srv = createServer(async (req, res) => {
    const body = await new Promise((r) => { const b = []; req.on('data', (d) => b.push(d)); req.on('end', () => r(Buffer.concat(b))); });
    handler(req, res, body);
  });
  srv.listen(0, '127.0.0.1', () => ok_(srv));
});
{
  const seen = { auth: null, wf: null, uploads: 0 };
  const img = solidPng(1056 / 8, 1584 / 8);
  const srv = await serve((req, res, body) => {
    seen.auth = req.headers.authorization;
    if (req.url === '/upload/image') { seen.uploads++; res.end(JSON.stringify({ name: `up${seen.uploads}.png`, subfolder: 'character-refs' })); }
    else if (req.url === '/prompt') { seen.wf = JSON.parse(body).prompt; res.end(JSON.stringify({ prompt_id: 'p1' })); }
    else if (req.url.startsWith('/history/')) res.end(JSON.stringify({ p1: { status: { status_str: 'success' }, outputs: { save: { images: [{ filename: 'o.png', subfolder: '', type: 'output' }] } } } }));
    else if (req.url.startsWith('/view')) res.end(img);
    else { res.statusCode = 404; res.end(); }
  });
  const cfg = loadConfig(join(TMP, 'none.json'));
  cfg.models.qwen.url = `http://127.0.0.1:${srv.address().port}`;
  const f = join(TMP, 'ref.png');
  writeFileSync(f, solidPng(10, 10));
  process.env.COMFY_USER = 'u'; process.env.COMFY_PASS = 'p';
  const out = await qwenGenerate({ text: 'T', negative: 'N', ratio: '2:3', refs: [f, f], seed: 3 }, cfg);
  delete process.env.COMFY_USER; delete process.env.COMFY_PASS;
  srv.close();
  ok(out.equals(img), 'Qwen：拿回服务器上的图');
  eq(seen.uploads, 2, 'Qwen：两张参考图都先上传');
  ok(seen.wf.ref2.inputs.image === 'character-refs/up2.png' && seen.wf.ks.inputs.seed === 3, 'Qwen：工作流引用上传后的文件名、带种子');
  ok(seen.auth?.startsWith('Basic '), 'Qwen：带上账号');
}
{
  const seen = {};
  const img = solidPng(20, 25);
  const srv = await serve((req, res, body) => {
    seen.path = req.url; seen.auth = req.headers.authorization; seen.body = body.toString('latin1');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: [{ b64_json: img.toString('base64') }] }));
  });
  const cfg = loadConfig(join(TMP, 'none.json'));
  cfg.models.openai.baseUrl = `http://127.0.0.1:${srv.address().port}/v1`;
  process.env.OPENAI_API_KEY = 'sk-test';
  const f = join(TMP, 'ref.png');
  const out = await openaiGenerate({ text: 'T', negative: 'N', ratio: '4:5', refs: [f, f] }, cfg);
  delete process.env.OPENAI_API_KEY;
  srv.close();
  ok(out.equals(img), 'GPT Image：解出 b64_json');
  ok(seen.path === '/v1/images/edits' && seen.auth === 'Bearer sk-test', 'GPT Image：派生走 edits、带 key');
  eq((seen.body.match(/name="image\[\]"/g) ?? []).length, 2, 'GPT Image：两张参考图作为 image[] 上传');
  ok(seen.body.includes('1152x1440'), 'GPT Image：尺寸按比例给');
}

/* ---------------- 完整流程（自定义命令模板造白底图） ---------------- */
{
  const mk = join(TMP, 'mk.mjs').replace(/\\/g, '/');   // Windows: sh 里反斜杠是转义符，路径统一用正斜杠
  writeFileSync(mk, `import { writeFileSync } from 'node:fs';\nimport { solidPng } from ${JSON.stringify(pathToFileURL(join(here, 'png.mjs')).href)};\n` +
    `const [w, h, out] = process.argv.slice(2); writeFileSync(out, solidPng(Math.round(w / 3), Math.round(h / 3)));\n`);
  const env = { ...process.env, CHARACTER_REFS_CONFIG: join(TMP, 'config.json') };
  const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: 'utf8', env });
  const cfgRun = run('config', '--model', 'custom:white', '--confirm-anchor', 'yes', '--custom', `white=node ${mk} {width} {height} {out}`);
  ok(cfgRun.stdout.includes('配置完整'), 'config：一条命令设完模型与确认方式');
  const cfg = JSON.parse(readFileSync(join(TMP, 'config.json'), 'utf8'));
  ok(cfg.anchorModel === 'custom:white' && cfg.deriveModel === 'custom:white', '主图与派生图默认同一个模型');
  const newRun = run('new', join(here, '..', 'examples', '阿禾-intake.json'), '--out', TMP);
  const assetPath = join(TMP, safeName('阿禾'), 'asset.json');
  ok(newRun.status === 0 && existsSync(assetPath), 'new：建出 asset.json');
  ok(run('gen', assetPath, '--tier', '2').stderr.includes('还没有锚点'), '没有锚点不能出第二档');
  const g1 = run('gen', assetPath, '--tier', '1');
  ok(g1.status === 0 && g1.stdout.includes('锚点待确认'), '出锚点后提示确认');
  ok(run('gen', assetPath, '--tier', '2').stderr.includes('confirm'), '锚点没确认，第二档被拒');
  ok(run('confirm', assetPath).status === 0, 'confirm 通过');
  ok(run('gen', assetPath, '--tier', '2', '--reason', 'E01 有特写').status === 0, '第二档出齐');
  ok(run('gen', assetPath, '--tier', '3').status === 0, '第三档出齐');
  const ck1 = run('check', assetPath);
  ok(ck1.status === 0, '全部有效时 check 通过\n' + ck1.stdout + ck1.stderr);
  ok(run('gen', assetPath, 'face-front', '--model', 'custom:white').status === 0, '单独重出一张（可指定模型）');
  const ck2 = run('check', assetPath);
  ok(ck2.status === 1 && ck2.stdout.includes('已过期') && ck2.stdout.includes('face-front'), '重出大头照后 check 标出过期的细节');
  const asset = JSON.parse(readFileSync(assetPath, 'utf8'));
  const cur = current(asset.outfits.default, 'face-front');
  eq(cur.id, '阿禾/default/face-front/v2', '重出的是 v2');
  eq(readText(readFileSync(join(dirname(assetPath), cur.file)))['shuohao:id'], '阿禾/default/face-front/v2', '图片文件里写着标识');
  ok(existsSync(join(dirname(assetPath), 'default/face-front.v1.png')), '旧版文件还在');
  eq(asset.outfits.default.upgrades.at(-1).tier, 3, '升档记录留下');
  const out = join(TMP, 'report.html');
  ok(run('render', assetPath, '--out', out).status === 0, 'render 写出报告');
  const html = readFileSync(out, 'utf8');
  ok(html.includes("setL(s||'without')") && html.includes('无细节图'), '报告默认不显示细节图，可切换');
  ok(html.includes('src="阿禾/default/front-full.v1.png"'), '图片路径相对报告位置');
  ok(html.includes('class="img stale"'), '过期的图在报告里标红框');
  ok(html.includes('<p class="legend">') && html.includes('红框 = 已过期'), '有过期的图时显示图例，说明红框是什么');
  ok(/class="img stale"[^>]*title="已过期：参考图 face-front 已换成 v2"/.test(html), '鼠标移到红框图上能看到过期原因');
  ok(html.includes('角色描述（确认表）') && html.includes('推断'), '报告里带确认表与来源');
  ok(!/<link\s|<script\s+src=/.test(html), '报告零外部依赖');
  {
    const a = assetFromIntake(INTAKE);
    const png = solidPng(10, 10);
    for (const v of [ANCHOR, 'face-front', 'face-45']) recordVersion(a, 'default', v, { buf: png, model: 'qwen', prompt: buildPrompt(a, 'default', v), refs: [] });
    const h = renderHtml([{ asset: a, assetDir: TMP }], TMP);
    ok(/<details class="views">(?:(?!<\/details>)[\s\S])*<div class="extra">/.test(h), '45° 大头照收在「全部视图」里，展开才显示');
  }
  ok(html.includes('<html lang="zh-CN">') && !html.includes('Without details'), '中文资产默认出中文报告');
  const outEn = join(TMP, 'report-en.html');
  ok(run('render', assetPath, '--lang', 'en', '--out', outEn).status === 0, 'render --lang en');
  const en = readFileSync(outEn, 'utf8');
  ok(en.includes('<html lang="en">') && en.includes('Without details') && en.includes('Front headshot') && en.includes('All views'), '英文报告：界面全换');
  ok(en.includes('reference face-front is now v2') && en.includes('Stale'), '英文报告：过期原因也翻译');
  ok(en.includes('Character description (confirmation table)') && en.includes('inferred') && en.includes('Style: Anime'), '英文报告：确认表标签、来源、画风名（默认动漫）');
  ok(!/无细节图|全部视图|已过期|角色描述|未生成|锚点已确认/.test(en), '英文报告里没有残留的中文界面文案');
  ok(en.includes('十六岁采茶姑娘'), '数据内容保持原文（角色描述是中文写的就还是中文）');
  const uiFile = join(TMP, 'ui-fr.json');
  writeFileSync(uiFile, JSON.stringify({ ...uiTemplate('fr'), title: 'Références de personnage' }));
  ok(run('render', assetPath, '--lang', 'fr', '--out', outEn).status !== 0, '非内置语言没给 ui：render 报错，不出半中半英的报告');
  ok(run('render', assetPath, '--lang', 'fr', '--ui', uiFile, '--out', outEn).status === 0 && readFileSync(outEn, 'utf8').includes('Références de personnage'), 'render --ui 传自译文案');
  ok(JSON.parse(run('ui-template', 'fr').stdout).htmlLang === 'fr', 'ui-template 打印骨架');
  {
    const d = join(TMP, 'def');
    run('new', join(here, '..', 'examples', '阿禾-intake.json'), '--out', d);
    const ap = join(d, safeName('阿禾'), 'asset.json');
    const g1 = run('gen', ap);
    ok(g1.status === 0 && g1.stdout.includes('front-full/v1') && !g1.stdout.includes('face-front') && g1.stdout.includes('确认后再运行'), '默认 gen：锚点要确认时，只出锚点并提示接着怎么做');
    run('confirm', ap);
    const g2 = run('gen', ap);
    ok(['face-front', 'side-full', 'back-full'].every((v) => g2.stdout.includes(`${v}/v1`)) && !g2.stdout.includes('detail-'), '确认后再 gen：补齐第二档，不碰细节图');
    ok(run('gen', ap).stdout.includes('已经齐了'), '第二档齐了再 gen：不重出，提示细节图怎么出');
    const d2 = join(TMP, 'def2');
    run('new', join(here, '..', 'examples', '阿禾-intake.json'), '--out', d2);
    const g3 = run('gen', join(d2, safeName('阿禾'), 'asset.json'), '--no-confirm');
    ok(['front-full', 'face-front', 'side-full', 'back-full'].every((v) => g3.stdout.includes(`${v}/v1`)), '--no-confirm：一条命令出齐第二档');
  }
  const lk = run('looks').stdout;
  ok(lk.includes('写实照片') && lk.includes('Anime') && lk.includes('* 动漫') && lk.includes('卡通'), 'looks 列出预设，标出默认（动漫）');
  const lookFile = join(TMP, 'my-look.json');
  const tpl = JSON.parse(run('look-template', '动漫').stdout);
  ok(tpl.medium === 'drawn' && tpl.id === 'custom', 'look-template 以预设为底打印可改的骨架');
  writeFileSync(lookFile, JSON.stringify({ ...tpl, style: tpl.style + ' Muted colors.' }));
  const out2 = join(TMP, 'b');
  ok(run('new', join(here, '..', 'examples', '阿禾-intake.json'), '--out', out2, '--look', '动漫').status === 0, 'new --look 动漫');
  eq(JSON.parse(readFileSync(join(out2, safeName('阿禾'), 'asset.json'), 'utf8')).outfits.default.look.id, 'anime', '资产里是动漫快照');
  ok(run('new', join(here, '..', 'examples', '阿禾-intake.json'), '--out', join(TMP, 'c'), '--look', lookFile).status === 0, 'new --look 自定义文件');
  ok(run('new', join(here, '..', 'examples', '阿禾-intake.json'), '--out', join(TMP, 'd'), '--look', '油画').stderr.includes('可用预设'), '没有的画风名：报错并列出可用预设');
  const rs = run('restyle', assetPath, '--look', '写实');
  ok(rs.status === 0 && rs.stdout.includes('动漫 → 写实照片'), 'restyle 换画风');
  const ck3 = run('check', assetPath);
  ok(ck3.status === 1 && ck3.stdout.includes('正面全身（锚点）') && ck3.stdout.includes('画风快照变了'), '换画风后连锚点一起过期');
  ok(run('render', assetPath, '--lang', 'en', '--out', outEn).status === 0 && readFileSync(outEn, 'utf8').includes('Style: Realistic photo'), '报告里的画风名随语言');
  const legacy = assetFromIntake(INTAKE);
  delete legacy.lang;
  ok(renderHtml([{ asset: legacy, assetDir: TMP }], TMP).includes('<html lang="zh-CN">'), '旧资产没有 lang：按中文出');
  const enAsset = assetFromIntake({ ...clone(INTAKE), lang: 'en' });
  eq(enAsset.lang, 'en', '资产记下语言');
  ok(renderHtml([{ asset: enAsset, assetDir: TMP }], TMP).includes('No anchor yet'), '资产 lang 为 en：不传 --lang 也出英文');
  const one = renderHtml([{ asset: assetFromIntake(INTAKE), assetDir: TMP }], TMP);
  ok(!one.includes('<p class="legend">'), '没有过期的图就不显示图例');
  ok(one.includes('还没有锚点') && one.includes('第 0 档'), '一张图都没有时也能渲染');
}

rmSync(TMP, { recursive: true, force: true });
console.log(`✓ ${passed} 项自测全部通过`);
