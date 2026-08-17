#!/usr/bin/env node
// 自测：覆盖 novel-art.mjs 里所有确定性逻辑（场景 + 道具）。
// 不调用任何模型，不花额度，跑一次 < 1 秒。
//   node scripts/selftest.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ANCHOR_RANGE,
  DEFAULT_STYLE,
  SCENE_STYLE_PRESETS,
  SUPPORTED_STYLES,
  castNamesOf,
  gateReport,
  renderHtml,
  renderMarkdown,
  scenePreset,
  seedFromOutline,
  slug,
  PROP_SCALES,
  validateArt,
  validatePropStatesShape,
} from './novel-art.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(join(here, '..', 'examples', '渡口-art.json'), 'utf8'));
const OUTLINE = JSON.parse(
  readFileSync(join(here, '..', '..', 'novel-outline', 'examples', '渡口-outline.json'), 'utf8'),
);
const CAST = JSON.parse(
  readFileSync(join(here, '..', '..', 'novel-characters', 'examples', '渡口-cast.json'), 'utf8'),
);

let passed = 0;
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
}
function eq(actual, expected, msg) {
  assert.strictEqual(actual, expected, `${msg} — 期望 ${expected}，实际 ${actual}`);
  passed++;
}
const clone = () => JSON.parse(JSON.stringify(FIXTURE));
const gate = (d, id, names = null) => gateReport(d, names).find((g) => g.id === id);

/* ---------------- 画风预设 ---------------- */

eq(DEFAULT_STYLE, 'realistic', '默认半写实');
eq(SUPPORTED_STYLES.join(','), 'realistic,ghibli', '两档画风与 novel-characters 同名对齐');
ok(!/photorealistic/.test(SCENE_STYLE_PRESETS.realistic.negative), 'realistic 不禁 photorealistic');
ok(/photorealistic/.test(SCENE_STYLE_PRESETS.ghibli.negative), 'ghibli 必须禁 photorealistic');
ok(/people/.test(SCENE_STYLE_PRESETS.realistic.negative), 'realistic 预设自带禁人');
ok(/people/.test(SCENE_STYLE_PRESETS.ghibli.negative), 'ghibli 预设自带禁人');
ok(!/pore|skin|subsurface/i.test(SCENE_STYLE_PRESETS.realistic.surface), '环境预设不带皮肤毛孔那套——那是角色的');
eq(scenePreset('nope'), SCENE_STYLE_PRESETS.realistic, '未知风格退回默认');

/* ---------------- slug ---------------- */

eq(slug('渡船船舱'), '渡船船舱', '中文场景名保留');
eq(slug('军区总院·中医独立诊室'), '军区总院-中医独立诊室', '间隔号替换');
eq(slug('a/b:c'), 'a-b-c', '危险字符替换');

/* ---------------- seed ---------------- */

const seeded = seedFromOutline(OUTLINE);
eq(seeded.source, '渡口', 'seed 带书名');
eq(seeded.style, 'realistic', 'seed 默认画风');
eq(seeded.scenes.length, 3, 'seed 搬全部场景');
{
  const s01 = seeded.scenes.find((s) => s.id === 'S01');
  eq(s01.usage.episodes.join(','), '1,2,3,4,5,6', 'seed 算出出现集');
  eq(s01.usage.beats.join(','), '悬念钩,身份揭破,反转,收束', 'seed 算出承载爽点');
  eq(s01.summary, '', '设计字段留给模型填');
  const s03 = seeded.scenes.find((s) => s.id === 'S03');
  ok(s03.seedNote?.includes('复用方案'), 'outline 的 reusePlan 变成 seedNote 提示做变体');
  ok(!seeded.scenes.find((s) => s.id === 'S01').seedNote, '没有复用方案的场景不带 seedNote');
}
ok(seedFromOutline({}).scenes.length === 0, '空大纲不炸');

/* ---------------- castNamesOf ---------------- */

const NAMES = castNamesOf(CAST);
ok(NAMES.includes('沈知微') && NAMES.includes('老周'), 'cast 名字提出来了');
ok(NAMES.includes('老伯'), '别名也提出来了');
ok(castNamesOf({ characters: [] }).length === 0, '空 cast 不炸');

/* ---------------- 夹具本身 ---------------- */

eq(validateArt(FIXTURE, NAMES).length, 0, '自带样例通过校验（含角色名检查）');
ok(gateReport(FIXTURE, NAMES).every((g) => g.ok), '样例全部质量门通过');
eq(gateReport(FIXTURE).length, 12, '质量门共 12 道（场景 7 + 道具 5，道具含状态已出图核对）');

/* ---------------- 质量门逐项击穿 ---------------- */
// 每一道门都要证明它真的会拦——不然就是永远为真的假测试

// G1 锚点 3–5
eq(ANCHOR_RANGE.join('-'), '3-5', '锚点范围 3–5');
{
  const d = clone();
  d.scenes[0].anchors = d.scenes[0].anchors.slice(0, 2);
  ok(!gate(d, 'anchors').ok, '锚点只有 2 个被拦');
  ok(gate(d, 'anchors').detail.includes('渡船船舱'), '报错点名场景');
}
{
  const d = clone();
  d.scenes[0].anchors = Array.from({ length: 6 }, (_, i) => ({ name: `锚${i}`, desc: 'x' }));
  ok(!gate(d, 'anchors').ok, '锚点 6 个也被拦——QC 核对不过来');
}

// G3 光照状态
{
  const d = clone();
  d.scenes[2].lighting = [];
  ok(!gate(d, 'lighting').ok, '没有光照状态被拦——换时段是重新生成不是重新打灯');
}

// G4 空景
{
  const d = clone();
  d.scenes[0].image.negativePrompt = 'plastic CG look, text, watermark';
  ok(!gate(d, 'no-people').ok, '反向提示词没禁人被拦——环境参考图必须空景');
}

// G5 提示词英文
{
  const d = clone();
  d.scenes[0].image.prompt = '一条老木船的客舱';
  ok(!gate(d, 'english').ok, '主提示词写中文被拦');
}
{
  const d = clone();
  d.scenes[0].lighting[0].prompt = '浓雾平光';
  ok(!gate(d, 'english').ok, '光照提示词写中文也被拦');
}

// G6 提示词不含角色名
{
  const d = clone();
  d.scenes[0].image.prompt += ' where 老周 stands';
  ok(!gate(d, 'no-names', NAMES).ok, '提示词里出现角色名被拦');
  ok(gate(d, 'no-names', NAMES).detail.includes('老周'), '报错点名是谁');
  ok(gate(d, 'no-names').ok, '没给 cast 时这道门跳过（视为通过）');
  ok(gate(d, 'no-names').detail.includes('跳过'), '跳过时明说，不装作查过');
}
{
  const d = clone();
  d.scenes[1].lighting[0].prompt += ' with 老伯 in frame';
  ok(!gate(d, 'no-names', NAMES).ok, '别名也拦（光照提示词同样查）');
}

// G7 变体引用
{
  const d = clone();
  d.scenes[2].variantOf = 'S99';
  ok(!gate(d, 'variants').ok, '指向不存在的母场景被拦');
}
{
  const d = clone();
  d.scenes[2].variantOf = 'S03';
  ok(!gate(d, 'variants').ok, '自己指自己被拦');
}
{
  const d = clone();
  delete d.scenes[2].changes;
  ok(!gate(d, 'variants').ok, '变体缺 changes 被拦——不说改了什么等于没说');
}

// G8 风格与反向词匹配
{
  const d = clone();
  d.scenes[0].image.negativePrompt += ', photorealistic, 3d render';
  ok(!gate(d, 'style-match').ok, 'realistic 禁 photorealistic 被拦——自相矛盾');
}
{
  const d = clone();
  d.style = 'ghibli';
  ok(!gate(d, 'style-match').ok, '切 ghibli 后没禁 photorealistic 被拦');
}
{
  const d = clone();
  d.scenes[0].image.sheet = 'ONE 16:9 landscape canvas, three zones, no people';
  ok(!gate(d, 'style-match').ok, 'sheet 缺渲染句被拦——画风会飘');
}

/* ---------------- validate 结构检查 ---------------- */

ok(validateArt(null).length === 1, 'null 直接报');
ok(validateArt({}).some((x) => x.includes('source')), '缺书名被拦');
ok(validateArt({ source: 'x', style: '水墨' }).some((x) => x.includes('style')), '未知画风被拦');
{
  const d = clone();
  d.scenes[0].id = 'X1';
  ok(validateArt(d).some((x) => x.includes('S01 这种格式')), '场景 id 格式被拦');
}
{
  const d = clone();
  d.scenes[1].id = 'S01';
  ok(validateArt(d).some((x) => x.includes('重复')), '场景 id 重复被拦');
}
{
  const d = clone();
  d.scenes[0].summary = ' ';
  ok(validateArt(d).some((x) => x.includes('summary')), '缺设计意图被拦');
}
{
  const d = clone();
  delete d.scenes[0].primary;
  ok(validateArt(d).some((x) => x.includes('primary')), '缺主场景标记被拦');
}
{
  const d = clone();
  d.scenes[0].anchors[0] = { name: '只有名字' };
  ok(validateArt(d).some((x) => x.includes('锚点缺')), '锚点缺描述被拦');
}
{
  const d = clone();
  d.scenes[0].lighting[0] = { state: '夜戏' };
  ok(validateArt(d).some((x) => x.includes('夜戏')), '光照缺提示词被拦且点名状态');
}
{
  const d = clone();
  delete d.scenes[0].image.sheet;
  ok(validateArt(d).some((x) => x.includes('image.sheet')), '缺设定图提示词被拦');
}
{
  const d = clone();
  d.scenes[0].usage = { episodes: 'not-array', beats: [] };
  ok(validateArt(d).some((x) => x.includes('usage.episodes')), 'usage 结构错被拦');
}

/* ---------------- render markdown ---------------- */

const md = renderMarkdown(FIXTURE);
ok(md.startsWith('# 渡口 · 美术设定集'), 'MD 标题');
ok(md.includes('## 场景清单'), 'MD 有场景清单');
ok(md.includes('变体 ← S02'), 'MD 清单标出变体来源');
ok(md.includes('## S01 渡船船舱'), 'MD 每场景一节');
ok(md.includes('一致性锚点'), 'MD 有锚点');
ok(md.includes('**补丁船篷**'), 'MD 锚点带名字');
ok(!md.includes('定机位'), 'MD 不再有定机位库——AI 生产的空间锚在参考图不在文字');
ok(md.includes('光照与时段'), 'MD 有光照状态');
ok(md.includes('```text'), 'MD 提示词进代码块');

/* ---------------- render html ---------------- */

const html = renderHtml(FIXTURE);
ok(html.startsWith('<!doctype html>'), 'HTML 完整文档');
ok(!/<script\s+src=/.test(html), '不引外部脚本');
ok(!/<link\s/.test(html), '不引外部样式');
ok(!/@import|url\(https?:/.test(html), 'CSS 不拉外部资源');
ok(/<script\s+src=/.test('<script src="x.js">'), '外部脚本检测正则有效');

eq((html.match(/class="kpi[ "]/g) || []).length, 4, 'KPI 带 4 张卡（场景/道具/锚点/光照）');
ok(html.includes('主场景 2 · 变体 1'), 'KPI 场景卡带分类');
ok(html.includes('叙事道具'), 'KPI 有叙事道具卡');
eq((html.match(/class="scene" /g) || []).length, 5, '5 张设定卡（3 场景 + 2 道具）');
ok(html.includes('>场景清单<') && html.includes('>场景设定卡<') && html.includes('>道具清单<') && html.includes('>道具设定卡<') && html.includes('>质量门<'), '五个区块都在');
ok(html.indexOf('>场景设定卡<') < html.indexOf('>道具清单<') && html.indexOf('>道具设定卡<') < html.indexOf('>质量门<'), '道具在场景后、质量门前');
ok(html.indexOf('>场景清单<') < html.indexOf('>场景设定卡<'), '清单在卡片前');
eq((html.match(/class="anchors"/g) || []).length, 5, '每张卡有锚点列表（3 场景 + 2 道具）');
ok(html.includes('变体来源：<b>S02</b>'), '变体卡标母场景');
ok(html.includes('plate-empty'), '没出图时有占位');
ok(html.includes('class="cards"'), '设定卡一排两张的网格');
ok(/\.cards\{[^}]*grid-template-columns:1fr 1fr/.test(html), '两列布局');
// 点图弹层
ok(html.includes('class="lightbox"'), '有图片弹层');
ok(/closeLb\(\)/.test(html), '弹层能关闭');
ok(/e\.key === 'Escape'/.test(html), 'Esc 关闭弹层');
{
  const d = clone();
  d.scenes[0].sheetImage = 'images/x-sheet.png';
  const withImg = renderHtml(d);
  ok(withImg.includes('class="zoom" data-src="images/x-sheet.png"'), '出图后图片可点，弹层拿到地址');
  ok(withImg.includes('cursor:zoom-in'), '鼠标提示可放大');
}
eq((html.match(/<li class="ok">/g) || []).length, 12, '12 道质量门全 ✓');
ok(html.includes('gatepill pass'), '页眉徽章通过态');
ok(html.includes('未提供 cast.json'), '报告如实标注角色名检查被跳过');

// 质量门失败也要渲染
{
  const d = clone();
  d.scenes[0].anchors = [];
  const bad = renderHtml(d);
  ok(bad.includes('gatepill fail'), '失败时页眉徽章变红');
  ok(bad.includes('class="galert"'), '失败时弹病灶横幅');
  ok(bad.includes('<li class="bad">'), '未过的门标 ✗');
}

// 导出：内嵌的就是 art.json 原样
ok(html.includes('<script type="application/json" id="art-data">'), '数据内嵌');
ok(html.includes('data-name="渡口-art.json"'), '下载文件名跟书名（art.json）');
{
  const embedded = html.match(/<script type="application\/json" id="art-data">([\s\S]*?)<\/script>/)[1];
  const round = JSON.parse(embedded.replace(/\\u003c/g, '<'));
  eq(JSON.stringify(round), JSON.stringify(FIXTURE), '导出数据与 art.json 逐字节一致');
  eq(validateArt(round, NAMES).length, 0, '导出数据能直接喂回 validate');
}
ok(html.includes('revokeObjectURL(url), 10000'), 'blob 延后回收——Safari 抢跑会存出空文件');

// XSS：数据是模型生成的，一律转义
{
  const d = clone();
  d.scenes[0].name = '<img src=x onerror=alert(1)>';
  d.scenes[0].anchors[0].desc = '<b>粗体</b>';
  const evil = renderHtml(d);
  ok(!evil.includes('<img src=x'), '场景名里的 HTML 被转义');
  ok(!evil.includes('<b>粗体</b>'), '锚点描述里的 HTML 被转义');
}
// </script 会截断内嵌数据块
{
  const d = clone();
  d.scenes[0].summary = '他说</script><script>alert(1)</script>了吗';
  const x = renderHtml(d).match(/id="art-data">([\s\S]*?)<\/script>/)[1];
  ok(!x.includes('</script'), '数据块里的 </script 被转义');
  eq(JSON.parse(x.replace(/\\u003c/g, '<')).scenes[0].summary, d.scenes[0].summary, '转义了但内容没丢');
}

ok(html.includes('@media print'), '可打印');
ok(html.includes('prefers-reduced-motion'), '尊重减少动效');
ok(/@media print\{[\s\S]*\.pr p\{display:block!important/.test(html), '打印时提示词全展开');
ok(html.includes('参考图一律无人'), '页脚写明无人原则（道具另加无手白底）');

/* ---------------- 道具（叙事道具层）---------------- */

eq(Object.keys(PROP_SCALES).join(','), '手持级,桌面级,家具级', '尺度三档');
eq(FIXTURE.props.length, 2, '样例带两件叙事道具');

// 道具四道门逐项击穿
{
  const d = clone();
  d.props[0].states = [];
  ok(!gate(d, 'prop-states').ok, '道具没有状态被拦——合上和打开是两张参考');
}
{
  const d = clone();
  d.props[0].scale = '巨型';
  ok(!gate(d, 'prop-scale').ok, '未知尺度被拦');
}
{
  const d = clone();
  d.props[0].image.prompt = d.props[0].image.prompt.replace('handheld scale', 'nice size');
  ok(!gate(d, 'prop-scale').ok, '提示词缺尺度短语被拦——AI 会把手持道具画成家具');
  ok(gate(d, 'prop-scale').detail.includes('handheld scale'), '报错点名缺哪个短语');
}
{
  const d = clone();
  d.props[1].image.negativePrompt = 'people, plastic CG look, text';
  ok(!gate(d, 'prop-hands').ok, '反向提示词没禁手被拦——拿着道具的手是最常见污染');
}
{
  const d = clone();
  d.props[0].image.sheet = d.props[0].image.sheet.replace(/pure white background/gi, 'soft grey backdrop');
  ok(!gate(d, 'prop-white').ok, '设定图不是白底被拦——道具图要能抠');
}
// 共用门也覆盖道具
{
  const d = clone();
  d.props[0].anchors = d.props[0].anchors.slice(0, 1);
  ok(!gate(d, 'anchors').ok, '道具锚点不足也被锚点门拦');
}
{
  const d = clone();
  d.props[0].states[0].prompt = '合上的皮箱';
  ok(!gate(d, 'english').ok, '道具状态提示词写中文被英文门拦');
}
{
  const d = clone();
  d.props[0].image.prompt += ' carried by 沈知微';
  ok(!gate(d, 'no-names', NAMES).ok, '道具提示词出现角色名被拦');
}
// 道具状态变体反向对账：剧情用到的状态必须都出图
{
  const d = clone();
  // P01 现有状态是合上/打开；剧情还用到「藏着」却没出图
  const refs = { P01: ['合上', '打开', '藏着'] };
  ok(!gateReport(d, NAMES, refs).find((g) => g.id === 'prop-states').ok, '剧情用到但没出图的状态被拦');
  ok(gateReport(d, NAMES, refs).find((g) => g.id === 'prop-states').detail.includes('藏着'), '报错点名缺哪个状态');
  // 状态都覆盖了则放行
  const okRefs = { P01: ['合上', '打开'] };
  ok(gateReport(d, NAMES, okRefs).find((g) => g.id === 'prop-states').ok, '剧情用到的状态都出图则放行');
  // 没传 propStateRefs 时不报（保持旧行为）
  ok(gate(d, 'prop-states').ok, '未给 propStateRefs 时状态门只看 ≥1，不误报');
}
// 报告与 CLI 必须用同一组质量门输入：renderHtml 须透传 propStateRefs，否则 HTML 误报全过
{
  const d = clone();
  const refs = { P01: ['合上', '打开', '藏着'] };
  const badHtml = renderHtml(d, 'zh', refs);
  ok(badHtml.includes('gatepill fail') || badHtml.includes('class="galert"'), 'renderHtml 透传 propStateRefs 后，状态缺失能反映在报告里（不再误报全过）');
  ok(!renderHtml(d, 'zh').includes('gatepill fail'), '不传 propStateRefs 时维持旧行为（不误报）');
}
// 状态「已出图」核对：states[].image 声明的文件不存在时应报错（提示词齐全 ≠ 已出图）
{
  const d = clone();
  d.props[0].states[0].image = 'images/P01-合上.png';
  const missing = gateReport(d, NAMES, null, (p) => p !== 'images/P01-合上.png');
  ok(!missing.find((g) => g.id === 'prop-state-images').ok, '声明了图片但文件不存在被拦');
  const present = gateReport(d, NAMES, null, () => true);
  ok(present.find((g) => g.id === 'prop-state-images').ok, '图片确实存在时放行');
  // 不传 assetExists：无法核对文件，但已声明 image 即视为通过（仅校验声明）
  ok(gateReport(d, NAMES).find((g) => g.id === 'prop-state-images').ok, '未传 assetExists 但已声明 image 时仍视为通过（声明即计划）');
  // 不传 assetExists 且未声明 image：明确失败（不再静默放行）
  const noDecl = clone();
  for (const st of noDecl.props[0].states) delete st.image;
  ok(!gateReport(noDecl, NAMES).find((g) => g.id === 'prop-state-images').ok, '未声明 image 且无 assetExists 时门失败（不再假通过）');
}
// 道具没有光照门的义务
{
  const d = clone();
  ok(gate(d, 'lighting').ok, '道具不查光照——那是场景的门');
}
// 结构检查
{
  const d = clone();
  d.props[0].id = 'X1';
  ok(validateArt(d).some((x) => x.includes('P01 这种格式')), '道具 id 格式被拦');
}
{
  const d = clone();
  d.props[1].id = 'P01';
  ok(validateArt(d).some((x) => x.includes('道具 id P01 重复')), '道具 id 重复被拦');
}
{
  const d = clone();
  d.props[0].relatedScenes = ['S99'];
  ok(validateArt(d).some((x) => x.includes('S99 不存在')), '道具关联不存在的场景被拦');
}
{
  const d = clone();
  d.props[0].states[0] = { state: '合上' };
  ok(validateArt(d).some((x) => x.includes('合上')), '状态缺提示词被拦且点名');
}
// 无道具的文档：道具门放行、报告不渲染道具区块
{
  const d = clone();
  delete d.props;
  eq(validateArt(d, NAMES).length, 0, '没有道具块也合法——道具是可选层');
  ok(gateReport(d).filter((g) => g.id.startsWith('prop-')).every((g) => g.ok), '无道具时四道道具门放行');
  ok(!renderHtml(d).includes('>道具清单<'), '无道具时报告不渲染道具区块');
}
// 渲染
{
  ok(md.includes('## 道具清单'), 'MD 有道具清单');
  ok(md.includes('## P01 旧皮箱'), 'MD 每件道具一节');
  ok(md.includes('状态变体'), 'MD 有状态变体');
  ok(html.includes('>P01<') || html.includes('P01'), 'HTML 道具卡有 ID');
  ok(html.includes('手持级'), 'HTML 道具卡带尺度徽章');
  ok(html.includes('关联场景：<b>S01</b>'), 'HTML 道具卡带关联场景');
}

/* ---------------- render 英文界面（--lang en）---------------- */

{
  const en = renderHtml(FIXTURE, 'en');
  ok(en.includes('lang="en"'), '英文报告 <html lang="en">');
  ok(en.includes('Export JSON'), '英文报告有 Export JSON');
  ok(en.includes('>Scene list<'), '英文报告有 Scene list');
  ok(en.includes('>Quality gates<'), '英文报告有 Quality gates 区块');
  ok(en.includes('Consistency anchors'), '英文报告有 Consistency anchors');
  ok(!en.includes('导出 JSON'), '英文报告不含「导出 JSON」');
  ok(!en.includes('场景清单'), '英文报告不含「场景清单」');
  ok(!en.includes('质量门'), '英文报告不含「质量门」（门的中文 label 属于质量门层，不在界面表里）');
  ok(html.includes('lang="zh"'), '默认报告仍是 <html lang="zh">');
  ok(renderMarkdown(FIXTURE, 'en').includes('## Scene list'), 'MD 英文界面有 Scene list');
}
{
  const d = clone();
  d.lang = 'en';
  ok(renderHtml(d).includes('lang="en"'), 'art.json 顶层 lang 字段生效');
  ok(renderHtml(d, 'zh').includes('lang="zh"'), '--lang 优先于 lang 字段');
}
{
  let threw = false;
  try { renderHtml(FIXTURE, 'jp'); } catch { threw = true; }
  ok(threw, '非内置语言直接抛错（目前内置 zh / en）');
}

// 质量门面板是报告的一部分：英文界面下门标签也要翻译（阈值由门自己算，原样保留）
{
  const gateEn = renderHtml(FIXTURE, 'en');
  ok(gateEn.includes('Consistency anchors, 3–5'), 'EN 报告的质量门标签翻译且阈值原样保留');
  ok(!gateEn.includes('一致性锚点 3–5 个'), 'EN 报告不再出现中文门标签');
}

/* ---------------- validatePropStatesShape 结构校验（第三轮 P1-5 / 第四轮覆盖）---------------- */
// --prop-states 是独立来源，必须先过结构校验再进对账。
{
  const PIDS = ['P01', 'P02'];
  const mustThrow = (raw, label) => {
    let threw = false;
    try { validatePropStatesShape(raw, PIDS); } catch { threw = true; }
    ok(threw, label);
  };
  mustThrow('not-object', '非对象（字符串）被拦');
  mustThrow([], '数组而非对象被拦');
  mustThrow({}, '空对象被拦');
  mustThrow({ P99: ['打开'] }, '未知道具 id（P99）被拦');
  mustThrow({ P01: '打开' }, '值不是数组被拦');
  mustThrow({ P01: ['打开', 2] }, '数组含非字符串被拦');
  // 缺漏现有道具：删掉 P02 整项即可绕过反查——必须被拦（第四轮修复）
  mustThrow({ P01: ['合上', '打开'] }, '缺漏现有道具 P02 被拦（防删整项绕过）');
  // 显式 "none" 可合法豁免某件道具的状态对账
  const withNone = validatePropStatesShape({ P01: ['合上', '打开'], P02: 'none' }, PIDS);
  eq(withNone.P02.length, 0, 'P02 显式 "none" 视为无需状态');
  // 合法形状放行并原样返回
  const okShape = validatePropStatesShape({ P01: ['合上', '打开'], P02: ['正面'] }, PIDS);
  eq(okShape.P01.join('|'), '合上|打开', '合法 prop-states 原样通过');
}

/* ---------------- prop-state-images 门：状态必须声明 image 且文件存在（第四轮 P1）---------------- */
// 之前只要 states[].image 不填就静默放行（假通过）。现在每个状态都必须声明 image；
// 给了 assetExists 还要核对文件真实存在。
{
  const base = clone();
  // 去掉所有状态的 image 声明（模拟还没出图）
  for (const pr of base.props) for (const st of pr.states) delete st.image;
  // 不传 assetExists：仍要求每个状态声明 image 路径
  ok(gateReport(base, NAMES).find((g) => g.id === 'prop-state-images').ok === false,
    '未声明 state.image 时 prop-state-images 门失败（无 assetExists 也查声明）');
  // 传一个「所有文件都不存在」的检查函数：声明了但文件不存在也要失败
  const never = () => false;
  const declared = clone();
  for (const pr of declared.props) for (const st of pr.states) st.image = `images/${pr.id}-${st.state}.png`;
  ok(gateReport(declared, NAMES, null, never).find((g) => g.id === 'prop-state-images').ok === false,
    '声明了 image 但文件不存在时 prop-state-images 门失败');
  // 声明且文件存在：通过
  const always = () => true;
  ok(gateReport(declared, NAMES, null, always).find((g) => g.id === 'prop-state-images').ok === true,
    '声明 image 且文件存在时 prop-state-images 门通过');
}
console.log(`✓ ${passed} 项自测全部通过`);
