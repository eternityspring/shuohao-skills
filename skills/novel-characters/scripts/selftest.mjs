#!/usr/bin/env node
// 自测：覆盖 novel-characters.mjs 里所有确定性逻辑。
// 不调用任何模型，不花额度，跑一次 < 1 秒。
//   node scripts/selftest.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHUNK_SIZE,
  MAX_CHUNKS,
  SUPPORTED_UI_LANGS,
  chunkText,
  mergeRoster,
  renderHtml,
  renderMarkdown,
  STYLE_PRESETS,
  SUPPORTED_STYLES,
  needsUiTranslation,
  DEFAULT_LANG,
  isChinese,
  isTraditionalChinese,
  slug,
  stylePreset,
  strings,
  uiTemplate,
  validateCast,
} from './novel-characters.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const examples = join(here, '..', 'examples');
// 正规化换行：Windows 上 git 会把样例 checkout 成 CRLF，而 chunkText 内部
// 已经把 \r\n 换成 \n。不在这里对齐，断言就会拿 CRLF 原文去比对 LF 的块，
// 在 Windows 全线报错，在 macOS／Linux 却看不出来。
const SOURCE = readFileSync(join(examples, '渡口.txt'), 'utf8').replace(/\r\n/g, '\n');
const CAST = JSON.parse(readFileSync(join(examples, '渡口-cast.json'), 'utf8')).characters;

let passed = 0;
function ok(condition, label) {
  assert.ok(condition, label);
  passed += 1;
}
function eq(actual, expected, label) {
  assert.equal(actual, expected, `${label} — 期望 ${expected}，实际 ${actual}`);
  passed += 1;
}

/* ---------------- chunkText ---------------- */

eq(chunkText('').length, 0, '空文本不产生块');
eq(chunkText('   \n  ').length, 0, '纯空白不产生块');
eq(chunkText(SOURCE).length, 1, '短故事只有一块');

const long = SOURCE.repeat(40);
const chunks = chunkText(long);
ok(chunks.length > 1, '长文本会切成多块');
ok(chunks.every((c) => c.length <= CHUNK_SIZE), `没有块超过 CHUNK_SIZE(${CHUNK_SIZE})`);
ok(long.includes(chunks[0].slice(0, 200)), '块内容来自原文');
// 相邻块必须重叠，否则卡在切口上的角色会两边都漏
ok(chunks[1].includes(chunks[0].slice(-100).slice(0, 40)), '相邻块有重叠');
// 覆盖率：把所有块拼起来（去重叠后）应该盖住绝大部分原文
const covered = chunks.reduce((sum, c) => sum + c.length, 0);
ok(covered >= long.length, '所有块加起来覆盖全文（含重叠）');

const huge = SOURCE.repeat(500);
ok(chunkText(huge).length <= MAX_CHUNKS, `超长文本被 MAX_CHUNKS(${MAX_CHUNKS}) 截断而不是无限切`);

/* ---------------- mergeRoster ---------------- */

// 跨块用不同称呼发现同一个人，必须收敛成一条
const merged = mergeRoster([
  [{ name: '陆行远', aliases: ['陆'], note: '瘦，颧骨高。', quotes: ['他的脸很瘦，颧骨很高'] }],
  [{ name: '陆', aliases: [], note: '眉骨有疤。', quotes: ['右边眉骨上有一道两寸长的旧疤。', '他的脸很瘦，颧骨很高'] }],
  [{ name: '沈知微', aliases: ['姑娘'], note: '两条辫子。', quotes: [] }],
]);
eq(merged.length, 2, '别名跨块归并');
const lu = merged.find((c) => c.name === '陆行远');
ok(lu, '保留出现次数最多的规范名');
eq(lu.notes.length, 2, 'notes 累加');
ok(lu.aliases.includes('陆'), '别名被记录');
eq(lu.quotes.length, 2, 'quotes 合并且去重');

// 先看到别名、后看到本名，也要能合并
const reverse = mergeRoster([
  [{ name: '姑娘', aliases: [], note: 'a', quotes: [] }],
  [{ name: '沈知微', aliases: ['姑娘'], note: 'b', quotes: [] }],
]);
eq(reverse.length, 1, '别名先出现也能归并');
eq(reverse[0].notes.length, 2, '归并后两条 note 都在');

eq(
  mergeRoster([[{ name: 'Ishmael', aliases: [], note: 'a', quotes: [] }], [{ name: 'ishmael', aliases: [], note: 'b', quotes: [] }]]).length,
  1,
  '拉丁名大小写不敏感',
);

// 出现的块数越多排越前 —— 这是戏份权重的唯一依据
const ranked = mergeRoster([
  [{ name: '甲', aliases: [], note: '1', quotes: [] }, { name: '乙', aliases: [], note: '1', quotes: [] }],
  [{ name: '乙', aliases: [], note: '2', quotes: [] }],
  [{ name: '乙', aliases: [], note: '3', quotes: [] }],
]);
eq(ranked[0].name, '乙', '按出现块数降序排列');

// 脏数据不能让整个流程崩掉
eq(mergeRoster([[]]).length, 0, '空批次不报错');
eq(mergeRoster([[{ name: '甲' }]]).length, 1, '缺 aliases/notes/quotes 字段也能处理');
eq(mergeRoster([[{ note: '没名字' }]]).length, 0, '没有 name 的条目被丢弃');

/* ---------------- slug ---------------- */

eq(slug('胡二爷'), '胡二爷', '中文名原样保留');
eq(slug('a/b:c*d'), 'a-b-c-d', '路径危险字符被替换');
eq(slug('  x  '), 'x', '两端空白被去掉');
eq(slug(''), 'character', '空名有兜底');

/* ---------------- validateCast ---------------- */

eq(validateCast(CAST, SOURCE).length, 0, '自带样例通过全部校验');
ok(validateCast([], SOURCE).length > 0, '空 cast 报错');

const clone = () => JSON.parse(JSON.stringify(CAST));
const hits = (cast, keyword) => validateCast(cast, SOURCE).filter((p) => p.includes(keyword)).length;

// 这四类是模型真实犯过的错，每一类都必须抓住
let bad = clone();
bad[0].persona.evidence[0] = 'She was nineteen years old.';
ok(hits(bad, '逐字片段') > 0, '抓住意译的引文');

bad = clone();
bad[0].image.prompt = `${bad[0].name}, ${bad[0].image.prompt}`;
ok(hits(bad, '人名') > 0, '抓住出图提示词里的人名');

bad = clone();
bad[0].image.promptLocal = `${bad[0].aliases[0]}的设定图`;
ok(hits(bad, '人名') > 0, '抓住本地语言出图提示词里的别名');

bad = clone();
bad[0].image.sheet = `${bad[0].name}, a model sheet`;
ok(hits(bad, '人名') > 0, '抓住设定图提示词里的人名');

bad = clone();
bad[0].voice.timbre = 'warm husky alto';
ok(hits(bad, '应为中文') > 0, '抓住该中文却写成英文的字段');

bad = clone();
bad[0].image.sheet = '中文设定图描述';
ok(hits(bad, '必须英文') > 0, '抓住该英文却含中文的字段');

bad = clone();
bad[0].importance = 'sidekick';
ok(hits(bad, 'importance') > 0, '抓住 importance 枚举越界');

bad = clone();
delete bad[0].image.sheet;
ok(hits(bad, 'image.sheet') > 0, '抓住缺失的设定图提示词');

bad = clone();
delete bad[0].persona;
ok(hits(bad, 'persona') > 0, '抓住缺失的 persona');

// 没有原文时应该跳过逐字校验而不是全判失败
eq(validateCast(CAST, null).length, 0, '不给原文时跳过引文校验');

/* ---------------- render ---------------- */

const md = renderMarkdown(CAST, '渡口');
ok(md.includes('# 渡口 — 角色表'), 'Markdown 有标题');
for (const c of CAST) ok(md.includes(`## ${c.name}`), `Markdown 包含 ${c.name}`);
// 默认语言是 zh-TW，所以不传 lang 时界面文案该是正体
ok(md.includes('角色設定圖提示詞'), 'Markdown 默认用正体界面文案');
ok(
  renderMarkdown(CAST, '渡口', '', 'zh').includes('角色设定图提示词'),
  'Markdown 显式指定 zh 时用简体界面文案',
);
ok(renderMarkdown(CAST, 'Ferry', '', 'en').includes('# Ferry — Cast'), 'Markdown 跟随语言参数');

const html = renderHtml(CAST, '渡口');
ok(html.startsWith('<!doctype html>'), 'HTML 是完整文档');
// 三栏工作台：顶栏 + 左栏角色列表 + 主区一次一个角色
eq((html.match(/class="char[ "]/g) || []).length, CAST.length, `主区有 ${CAST.length} 个角色`);
eq((html.match(/class="rost[ "]/g) || []).length, CAST.length, `左栏列出 ${CAST.length} 个角色`);
eq((html.match(/class="char on"/g) || []).length, 1, '默认只展开第一个角色');
eq((html.match(/class="rost on"/g) || []).length, 1, '左栏默认选中第一个');
// 每人 7 个复制按钮：出图 本地/EN/设定图/反向 + 音色 本地/EN + 整份 JSON
// 用 class="copy 前缀匹配——整份 JSON 那个是 class="copy wide"
eq((html.match(/class="copy[ "]/g) || []).length, CAST.length * 7, '每段提示词都有复制按钮');
eq((html.match(/class="copy wide"/g) || []).length, CAST.length, '每个角色有整份 JSON 按钮');
ok(html.includes('id="q"'), '顶栏有搜索框');
// 搜索靠 data-hay，里面必须包含名字、别名、身份、特质——标签上是这么写的
for (const c of CAST) {
  const m = html.match(new RegExp(`data-hay="([^"]*)"[^>]*>[\\s\\S]{0,400}?${c.name}`));
  ok(html.includes(`data-hay=`), 'roster 带搜索索引');
}
const hay = [...html.matchAll(/data-hay="([^"]*)"/g)].map((m) => m[1]).join(' ');
for (const c of CAST) {
  ok(hay.includes(c.name), `搜索索引含 ${c.name}`);
  if (c.persona.identity) ok(hay.includes(c.persona.identity.slice(0, 6)), `搜索索引含 ${c.name} 的身份`);
  for (const tr of c.persona.personality) ok(hay.includes(tr), `搜索索引含特质「${tr}」`);
}
ok(html.includes('<blockquote>'), '原文依据用 blockquote');
// 四种写法都要认：半角/全角 × 推断/inferred
for (const marker of ['（推断）', '(inferred)', '（inferred）', '(推断)']) {
  const t = clone();
  t[0].persona.appearance = '身形单薄' + marker + '。';
  ok(renderHtml(t, 'x').includes('class="inf"'), `推断标记 ${marker} 被高亮`);
}
ok(html.includes('prefers-reduced-motion'), '尊重减少动效');
ok(html.includes('@media print'), '可打印');
// 自包含：不能有任何外部请求
ok(!/<script\s+src=/.test(html), 'HTML 不引用外部脚本');
ok(!/<link\s/.test(html), 'HTML 不引用外部样式');
// 反向验证：上面两条正则本身要真的能抓到东西，否则是永远为真的假测试
ok(/<script\s+src=/.test('<script src="x.js">'), '外部脚本检测正则有效');
ok(/<link\s/.test('<link rel="stylesheet">'), '外部样式检测正则有效');
ok(!/@import|url\(https?:/.test(html), 'CSS 不拉外部资源');

// 没有三视图时要有占位而不是空白
ok(renderHtml(CAST, 'x').includes('plate-empty'), '缺图时显示占位');
const withShot = clone();
withShot[0].sheetImage = 'images/x.png';
const shotHtml = renderHtml(withShot, 'x');
ok(shotHtml.includes('<img src="images/x.png"'), '主区嵌入设定图');
ok(shotHtml.includes("background-image:url('images/x.png')"), '左栏缩略图用同一张图的切片');

// XSS：角色数据是模型生成的，不能直接拼进 HTML
const evil = clone();
evil[0].name = '<img src=x onerror=alert(1)>';
const evilHtml = renderHtml(evil, 'x');
ok(!evilHtml.includes('<img src=x onerror'), '角色字段里的 HTML 被转义');

// 故事摘要
const DOC = JSON.parse(readFileSync(join(examples, '渡口-cast.json'), 'utf8'));
ok(DOC.summary && DOC.summary.trim(), '样例带故事摘要');
ok(renderHtml(CAST, '渡口', DOC.summary).includes('class="synopsis"'), 'HTML 顶部渲染摘要');
ok(!renderHtml(CAST, '渡口', '').includes('class="synopsis"'), '没有摘要时不留空壳');
ok(renderMarkdown(CAST, '渡口', DOC.summary).includes('## 故事摘要'), 'Markdown 也带摘要');
ok(renderHtml(CAST, '渡口', '<b>x</b>').includes('&lt;b&gt;'), '摘要里的 HTML 被转义');

// 布局骨架
const css = renderHtml(CAST, 'x');
ok(/\.shell\{[^}]*grid-template-columns:var\(--side-w\)/.test(css), '左栏 + 主区两栏骨架');
ok(/\.upper\{[^}]*grid-template-columns:minmax\(0,1fr\) 340px/.test(css), '主区内是内容 + 信息卡两栏');
ok(/\.prompts\{[^}]*grid-template-columns:1fr 1fr/.test(css), '提示词分左右两组');
ok(css.includes('.char{display:none}'), '默认只显示选中的角色');
ok(/\.main\{[^}]*max-width:1500px/.test(css), '主区最大宽度 1500px');
// 缩略图用精灵图裁设定图左栏——设定图 16:9、左栏约 34%，放大 1/0.34≈294% 左上对齐
ok(/\.rost-thumb\{[^}]*background-size:294% auto/.test(css), '缩略图按 294% 裁左栏');
ok(/\.rost-thumb\{[^}]*no-repeat left top/.test(css), '缩略图左上对齐');
ok(!/\.rost-thumb img/.test(css), '缩略图不再用 img 拉伸');
// 屏幕上一次一个，打印时必须全展开，否则打出来只有一个角色
ok(/@media print\{[\s\S]*\.char\{display:block!important/.test(css), '打印时展开全部角色');
ok(/@media print\{[\s\S]*\.pr p\{display:block!important/.test(css), '打印时展开全部提示词');

/* ---------------- 多语言 ---------------- */

const zh = renderHtml(CAST, '渡口', DOC.summary, 'zh');
const en = renderHtml(CAST, 'Ferry', 'A misty river crossing.', 'en');

ok(zh.includes('lang="zh"'), 'zh 报告的 html lang 正确');
ok(en.includes('lang="en"'), 'en 报告的 html lang 正确');
ok(zh.includes('故事摘要') && !zh.includes('>Synopsis<'), 'zh 界面用中文');
ok(en.includes('Synopsis') && !en.includes('故事摘要'), 'en 界面用英文');
ok(en.includes('>Voice<'), 'en 的声音卡标题翻译了');
ok(en.includes('Search characters'), 'en 的搜索框占位翻译了');
ok(en.includes('Cast · by prominence'), 'en 的角色列表标题翻译了');
ok(/Appearance|Temperament/.test(en), 'en 的画像小节标题翻译了');
ok(en.includes('>Lead<'), 'en 的 importance 标签翻译了');
ok(en.includes('>Copy<'), 'en 的复制按钮翻译了');
// 未知语言码退回英文骨架，而不是崩掉或露出中文
const fr = renderHtml(CAST, 'Bac', '', 'fr');
ok(fr.includes('lang="fr"'), '未知语言码仍写进 html lang');
ok(fr.includes('Synopsis') || !fr.includes('故事摘要'), '未知语言码用英文界面骨架');
eq(strings('zh').synopsis, '故事摘要', 'strings(zh)');
eq(strings('nope').synopsis, strings('en').synopsis, 'strings 未知码退回 en');
for (const l of ['zh-TW', 'zh', 'en', 'ja']) ok(SUPPORTED_UI_LANGS.includes(l), `内置 ${l} 界面`);

// 台湾正体内置
const tw = renderHtml(CAST, '渡口', DOC.summary, 'zh-TW');
ok(tw.includes('lang="zh-TW"'), 'zh-TW 报告的 html lang 正确');
ok(tw.includes('角色設定集') && !tw.includes('角色设定集'), 'zh-TW 界面用正体字');
ok(tw.includes('搜尋角色'), 'zh-TW 用「搜尋」而不是「搜索」');
ok(tw.includes('負向提示詞'), 'zh-TW 用「負向提示詞」而不是「反向提示词」');
ok(tw.includes('尚未生圖') || tw.includes('生圖提示詞'), 'zh-TW 用「生圖」而不是「出图」');
ok(tw.includes('依戲份排序'), 'zh-TW 用「依戲份排序」');
// 字体要跟着换，Songti SC 那串在台湾机器上多半没装
ok(tw.includes('Songti TC') && !tw.includes('Songti SC'), 'zh-TW 挑 TC 字体');
ok(zh.includes('Songti SC') && !zh.includes('Songti TC'), 'zh 仍挑 SC 字体');
ok(en.includes('Songti SC'), '非中文沿用原字体栈');
// 地区变体都算正体，但只有 zh-TW 有内置文案
ok(isTraditionalChinese('zh-HK') && isTraditionalChinese('zh-Hant'), 'zh-HK／zh-Hant 算正体');
ok(!isTraditionalChinese('zh') && !isTraditionalChinese('ja'), 'zh／ja 不算正体');
ok(isChinese('zh-TW') && isChinese('zh') && !isChinese('ja'), 'isChinese 认地区变体');
eq(DEFAULT_LANG, 'zh-TW', '默认语言是台湾正体');
eq(strings('zh-TW').synopsis, '故事摘要', 'strings(zh-TW)');
// zh 的各地区变体走同一条中文校验，不该因为语言码带地区就报错
eq(validateCast(CAST, SOURCE, 'zh-TW').length, 0, 'zh-TW 校验通过');

// 日语内置
const ja = renderHtml(CAST, '渡し場', 'あらすじの本文', 'ja');
ok(ja.includes('lang="ja"'), 'ja 报告的 html lang 正确');
ok(ja.includes('あらすじ') && ja.includes('>主役<'), 'ja 界面用日文');
ok(ja.includes('登場人物 · 出番順'), 'ja 的角色列表标题翻译了');
ok(ja.includes('検索'), 'ja 的搜索框占位翻译了');

// 任意语言：ui 覆盖机制
ok(needsUiTranslation('fr'), 'fr 需要 ui 翻译');
ok(!needsUiTranslation('ja'), 'ja 内置，不需要 ui 翻译');
const frUi = { synopsis: 'Résumé', groups: { voice: 'Voix' }, copy: 'Copier' };
const frHtml = renderHtml(CAST, 'Bac', 'Un matin de brume.', 'fr', frUi);
ok(frHtml.includes('Résumé'), 'ui 覆盖生效');
ok(frHtml.includes('Voix'), 'ui 嵌套键覆盖生效');
ok(frHtml.includes('>Copier<'), 'ui 覆盖按钮文案');
eq(strings('fr', frUi).groups.persona, 'Profile', '没覆盖的键退回英文兜底');
eq(strings('fr', frUi).persona.gender, 'Gender', '没覆盖的嵌套键也兜底');
// 脏 ui 不能把渲染带崩
for (const junk of [null, 'x', 42, [], { groups: 'not-an-object' }, { docTitle: 'nope' }]) {
  ok(renderHtml(CAST, 'x', '', 'fr', junk).startsWith('<!doctype html>'), `脏 ui ${JSON.stringify(junk)} 不崩`);
}
// 模板要能覆盖所有可翻译的键
const tpl = uiTemplate();
for (const k of ['kicker', 'synopsis', 'groups', 'persona', 'image', 'voice', 'importance', 'copy']) {
  ok(k in tpl, `ui-template 含 ${k}`);
}
ok(!('docTitle' in tpl), 'ui-template 不含函数模板');

// 校验的语言规则跟着 lang 走
const enCast = clone();
for (const c of enCast) {
  c.voice.timbre = 'warm husky alto';
  c.voice.pitch = 'low';
  c.voice.pace = 'slow and deliberate';
  c.voice.accent = 'neutral';
  c.voice.emotion = 'weary';
  c.voice.referenceHint = 'like a night-shift radio host';
}
ok(
  validateCast(enCast, SOURCE, 'en').filter((p) => p.includes('应为')).length === 0,
  'lang=en 时英文 voice 字段合法',
);
ok(
  validateCast(enCast, SOURCE, 'zh').filter((p) => p.includes('应为中文')).length > 0,
  'lang=zh 时英文 voice 字段违规',
);
ok(
  validateCast(CAST, SOURCE, 'en').filter((p) => p.includes('应为英文')).length > 0,
  'lang=en 时中文 voice 字段违规',
);
// 机器字段不受 lang 影响，永远必须英文
const cjkMachine = clone();
cjkMachine[0].image.prompt = '中文出图提示词';
for (const l of ['zh', 'en', 'fr']) {
  ok(
    validateCast(cjkMachine, SOURCE, l).filter((p) => p.includes('必须英文')).length > 0,
    `lang=${l} 时 image.prompt 仍必须英文`,
  );
}

/* ---------------- 角色设定图（左半身像 + 右三视图，一张） ---------------- */

ok(CAST.every((c) => c.image.sheet && c.image.sheet.trim()), '样例每个角色都有设定图提示词');
// 左右分栏和比例必须写死在提示词里，否则模型会自由发挥
ok(CAST.every((c) => /LEFT ZONE/.test(c.image.sheet)), '提示词划出左栏');

ok(CAST.every((c) => /about 34% of the canvas width/.test(c.image.sheet)), '左栏比例写死 34%');
// 16:9 和三区版面
ok(CAST.every((c) => /16:9/.test(c.image.sheet)), '画布写死 16:9');
ok(CAST.every((c) => /RIGHT-TOP ZONE/.test(c.image.sheet)), '右上是三视图区');
ok(CAST.every((c) => /RIGHT-BOTTOM ZONE/.test(c.image.sheet)), '右下是细节区');
ok(CAST.every((c) => /thin hairline rules/.test(c.image.sheet)), '三区之间有细线分隔');
// 比例是这个版面最容易崩的地方——为了塞下细节而压扁人物
ok(CAST.every((c) => /PROPORTIONS ARE CRITICAL/.test(c.image.sheet)), '强调比例');
ok(
  CAST.every((c) => /no stretching, squashing or foreshortening/.test(c.image.sheet)),
  '禁止拉伸压扁人物',
);
ok(
  CAST.every((c) => /the detail studies give way, not the figures/.test(c.image.sheet)),
  '空间不够时让细节让位，不动人物',
);
ok(
  CAST.every((c) => /continue them in a narrow vertical column down the right-hand edge/.test(c.image.sheet)),
  '细节放不下可延伸到右侧',
);

/* ---------------- 画风预设 ---------------- */

for (const id of ['realistic', 'ghibli', 'photoreal']) {
  ok(SUPPORTED_STYLES.includes(id), `内置 ${id} 预设`);
}
eq(stylePreset('nope').render, STYLE_PRESETS.realistic.render, '未知风格退回默认');
// 每个预设都要五块齐全，缺一块就会跟另一个预设混搭出四不像
for (const [id, p] of Object.entries(STYLE_PRESETS)) {
  for (const k of ['render', 'surface', 'lighting', 'negative', 'tags']) {
    ok(p[k] && p[k].length, `${id} 预设有 ${k}`);
  }
  // 内置几套界面文案，标签就得给几套，否则那个语言的报告会露出别的语言
  for (const l of SUPPORTED_UI_LANGS) ok(p.label[l], `${id} 预设有 ${l} 标签`);
}
// 这是整件事最容易搞反的地方：两个预设的反向提示词几乎相反
ok(!/photorealistic|3d render/i.test(STYLE_PRESETS.realistic.negative), 'realistic 不禁写实');
ok(/photorealistic/i.test(STYLE_PRESETS.ghibli.negative), 'ghibli 必须禁写实');
// 写实的表面细节在吉卜力里是反效果，两边不能是同一段
ok(/visible pores/i.test(STYLE_PRESETS.realistic.surface), 'realistic 要毛孔');
ok(/no pores/i.test(STYLE_PRESETS.ghibli.surface), 'ghibli 明确不要毛孔');
ok(STYLE_PRESETS.realistic.surface !== STYLE_PRESETS.ghibli.surface, '两个预设的表面处理不同');

// photoreal 跟 realistic 站同一边（都要真实感），但禁的东西相反：
// realistic 仍是画出来的，photoreal 恰恰要禁「画出来的」
ok(!/photorealistic|3d render/i.test(STYLE_PRESETS.photoreal.negative), 'photoreal 不禁写实');
ok(
  /illustration/i.test(STYLE_PRESETS.photoreal.negative) &&
    /painting/i.test(STYLE_PRESETS.photoreal.negative) &&
    /anime/i.test(STYLE_PRESETS.photoreal.negative),
  'photoreal 必须禁 illustration／painting／anime',
);
ok(!/illustration/i.test(STYLE_PRESETS.realistic.negative), 'realistic 不禁 illustration——它本来就是画');
ok(/visible pores/i.test(STYLE_PRESETS.photoreal.surface), 'photoreal 要毛孔');
ok(
  STYLE_PRESETS.photoreal.render !== STYLE_PRESETS.realistic.render &&
    STYLE_PRESETS.photoreal.surface !== STYLE_PRESETS.realistic.surface,
  'photoreal 与 realistic 是两套，不是同一套',
);
// 版面规则不随风格变：三个预设都得分区打光
for (const id of SUPPORTED_STYLES) {
  const p = STYLE_PRESETS[id];
  const zoned = /LEFT ZONE/.test(p.lighting) && /RIGHT ZONE/.test(p.lighting);
  const flat = /whole sheet/.test(p.lighting);
  ok(zoned || flat, `${id} 的打光要么分区要么明确全图平光`);
}

// 校验器要能抓住风格与反向提示词搞反
const wrongStyle = clone();
ok(
  validateCast(wrongStyle, SOURCE, 'zh', 'ghibli').some((x) => x.includes('必须禁 photorealistic')),
  '样例是 realistic，按 ghibli 校验会报错',
);
const ghibliish = clone();
for (const c of ghibliish) c.image.negativePrompt = STYLE_PRESETS.ghibli.negative;
ok(
  validateCast(ghibliish, SOURCE, 'zh', 'realistic').some((x) => x.includes('自相矛盾')),
  'realistic 却禁 photorealistic 会报错',
);
eq(validateCast(CAST, SOURCE, 'zh', 'realistic').length, 0, '样例按 realistic 校验通过');

// photoreal：负向提示词漏了「画出来的」那几个词要报错，否则模型交插画
const photorealCast = clone();
for (const c of photorealCast) {
  c.image.negativePrompt = STYLE_PRESETS.photoreal.negative;
  c.image.sheet = `${STYLE_PRESETS.photoreal.render}. ${c.image.sheet}`;
}
eq(validateCast(photorealCast, SOURCE, 'zh-TW', 'photoreal').length, 0, 'photoreal 角色卡校验通过');
ok(
  validateCast(clone(), SOURCE, 'zh', 'photoreal').some((x) => x.includes('必须禁 illustration')),
  '样例的负向提示词没禁 illustration，按 photoreal 校验会报错',
);
// photoreal 的 sheet 里必须带自己的渲染句，否则画风会飘回插画
const photorealNoRender = clone();
for (const c of photorealNoRender) c.image.negativePrompt = STYLE_PRESETS.photoreal.negative;
ok(
  validateCast(photorealNoRender, SOURCE, 'zh', 'photoreal').some((x) => x.includes('没有 style=photoreal')),
  'photoreal 的 sheet 缺渲染句会报错',
);

/* ---------------- 真实感 ---------------- */

// 一边要真实感一边在反向提示词里禁真实感，是自相矛盾的
ok(
  CAST.every((c) => !/photorealistic|3d render/i.test(c.image.negativePrompt)),
  'negativePrompt 不再禁 photorealistic / 3d render',
);
ok(
  CAST.every((c) => /plastic or waxy skin|poreless doll face/i.test(c.image.negativePrompt)),
  'negativePrompt 改禁「假」而不是禁「真」',
);
// 「扁平矢量卡通」跟写实拧巴，会导致同一批角色画风飘
ok(
  CAST.every((c) => !/flat vector cartoon/i.test(c.image.sheet + c.image.prompt)),
  '不再用扁平矢量卡通',
);
ok(
  CAST.every((c) => /Semi-realistic character illustration, painterly rendering/.test(c.image.sheet)),
  '画风统一到半写实厚涂',
);
// 真实感来自不完美
for (const [k, label] of [
  [/visible pores/i, '可见毛孔'],
  [/wet specular highlight/i, '眼睛湿润高光'],
  [/asymmetric/i, '左右不对称'],
  [/flyaway hair strands/i, '碎发破轮廓'],
  [/visible weave/i, '布料织纹'],
  [/self-shadow/i, '褶皱自阴影'],
]) {
  ok(CAST.every((c) => k.test(c.image.sheet)), `设定图提示词含${label}`);
}
// 分区光照：左栏要体积，右侧要平光——合并成一句全局光照就废了
ok(
  CAST.every((c) => /LIGHTING IN THE LEFT ZONE ONLY/.test(c.image.sheet)),
  '左栏单独打方向光',
);
ok(
  CAST.every((c) => /LIGHTING IN THE RIGHT ZONES: flat even orthographic/.test(c.image.sheet)),
  '右侧保持平光正交',
);
ok(
  CAST.every((c) => /ambient occlusion/i.test(c.image.sheet)),
  '左栏有环境遮蔽',
);
ok(CAST.every((c) => /bust portrait/i.test(c.image.sheet)), '左栏是半身像');
// 模型默认会把肩膀裁掉、底边做成圆角渐隐，必须显式禁掉
ok(
  CAST.every((c) => /BOTH SHOULDERS ARE FULLY VISIBLE/.test(c.image.sheet)),
  '左栏要求肩膀完整',
);
ok(
  CAST.every((c) => /do not fade, vignette or round off the bottom edge/.test(c.image.sheet)),
  '左栏禁止底边圆角渐隐',
);
ok(CAST.every((c) => /three FULL-BODY views/i.test(c.image.sheet)), '右上是三视图');
// 两栏的脸必须画成同一个人，否则一张图里出现两个长相
ok(
  CAST.every((c) => /must match the bust portrait/i.test(c.image.sheet)),
  '三视图的脸要求与半身像一致',
);
// 「留空脸」是上一版的做法，已废弃——提示词里不该再出现
ok(
  CAST.every((c) => !/left completely blank|NO eyes|NO facial features/i.test(c.image.sheet)),
  '提示词里没有残留的留空脸要求',
);

const withSheet = clone();
withSheet[0].sheetImage = 'images/x-sheet.png';
const sheetHtml = renderHtml(withSheet, 'x');
ok(sheetHtml.includes('images/x-sheet.png'), '设定图被嵌入');
eq((sheetHtml.match(/class="plate zoom"/g) || []).length, 1, '一个角色只有一个印张');
// 点图弹层 + 右下角一键复制图片
ok(sheetHtml.includes('class="lightbox"'), '有图片弹层');
ok(/data-src="images\/x-sheet\.png"/.test(sheetHtml), '弹层拿到图片地址');
ok(/class="copy-img" data-img="images\/x-sheet\.png"/.test(sheetHtml), '图上有复制按钮');
ok(sheetHtml.includes('ClipboardItem'), '复制的是图片本身而不是路径');
ok(/blob\.type !== 'image\/png'/.test(sheetHtml), '非 PNG 先转码——Safari 只认 image/png');

console.log(`✓ ${passed} 项自测全部通过`);
