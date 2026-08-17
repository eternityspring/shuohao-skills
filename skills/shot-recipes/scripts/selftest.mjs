#!/usr/bin/env node
// shot-recipes 自测：不调模型、不花额度，只验确定性逻辑。
// 原则与仓库里其他 skill 一致：lint 的每条规则都要有击穿用例——
// 证明它真的会拦，不是一个永远为真的假测试。

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APPLIES_TO,
  CAMERAS,
  CATEGORIES,
  COVER_DOMAINS,
  KINDS,
  NOT_WHEN_MARK,
  TECHNIQUE_CATEGORIES,
  RESERVED_PHRASES,
  SECTIONS,
  SIZES,
  checkRecipes,
  collectRecipeRefs,
  computeStats,
  coverageOf,
  lintCards,
  loadCards,
  missingInSkeleton,
  parseCard,
  parseScalar,
  renderHtml,
  renderMarkdown,
  sectionsOf,
  skeletonLines,
  splitSections,
  tOf,
} from './shot-recipes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CARDS_DIR = join(here, '../references/cards');
const REAL = loadCards(CARDS_DIR);
const FIXTURE = JSON.parse(readFileSync(join(here, '../examples/mini-storyboard.json'), 'utf8'));
const imageExists = (rel) => existsSync(join(CARDS_DIR, rel));

let passed = 0;
function ok(cond, label) {
  assert.ok(cond, label);
  passed += 1;
}
function eq(actual, expected, label) {
  assert.equal(actual, expected, `${label} — 期望 ${expected}，实际 ${actual}`);
  passed += 1;
}
const clone = (x) => structuredClone(x);

/* ---------------- 受限 frontmatter 解析 ---------------- */

eq(parseScalar('  hello  ').value, 'hello', '标量去空白');
eq(parseScalar("'quoted'").value, 'quoted', '单引号剥掉');
eq(parseScalar('"quoted"').value, 'quoted', '双引号剥掉');
eq(parseScalar('42').value, 42, '整数转数字');
eq(parseScalar('[a, b, c]').value.join(','), 'a,b,c', '行内数组');
eq(parseScalar('[]').value.length, 0, '空数组');
eq(parseScalar('[2, 4]').value.join(','), '2,4', '数组里的数字也转');
ok(parseScalar('[a, b').error, '数组没闭合报错');

{
  const { data, body, error } = parseCard('---\nid: demo\ntags: [a, b]\n---\n\n## 意图\n\n正文');
  eq(error, null, '合法卡片解析无错');
  eq(data.id, 'demo', 'frontmatter 标量');
  eq(data.tags.join(','), 'a,b', 'frontmatter 数组');
  ok(body.includes('## 意图'), '正文与 frontmatter 分开');
}
ok(parseCard('没有 frontmatter').error?.includes('frontmatter'), '缺 frontmatter 报错');
ok(parseCard('---\nid demo\n---\n').error?.includes('受限语法'), '不是 key: value 的行报错并点明受限语法');
ok(parseCard('---\nnested:\n  a: 1\n---\n').error, '嵌套语法被拒');

/* ---------------- splitSections ---------------- */

{
  const secs = splitSections('## 一\n\naaa\n\n## 二\n\nbbb');
  eq(secs.length, 2, '两节');
  eq(secs[0].title, '## 一', '节标题带 ##');
  eq(secs[0].text, 'aaa', '节正文不含下一节');
  eq(secs[1].text, 'bbb', '最后一节到结尾');
}
eq(splitSections('').length, 0, '空正文零节');

/* ---------------- 卡库全绿基线 ---------------- */

ok(REAL.length >= 2, '卡库至少有卡');
eq(lintCards(REAL, { cardsDir: CARDS_DIR, imageExists }).length, 0, '真实卡库 lint 零问题');
for (const c of REAL) {
  ok(!c.parseError, `${c.file} 解析无错`);
}
ok(
  REAL.every((c) => (c.must_phrases ?? []).every((p) => !RESERVED_PHRASES.some((r) => String(p).includes(r)))),
  '全库没有一条必备短语撞保留词',
);
ok(
  REAL.every((c) => (c.must_phrases ?? []).every((p) => /[ -]/.test(p) && p.length >= 6 && p === p.toLowerCase())),
  '全库必备短语满足形态规则',
);
ok(
  REAL.every((c) => (c.must_phrases_zh ?? []).length === (c.must_phrases ?? []).length),
  '全库每条必备短语都配了中文释义',
);
{
  // 中文界面出释义列，英文界面不出——短语本身两边都是英文原文
  const st = computeStats(REAL);
  ok(st.phrases.every((p) => p.zh), '短语索引每一行都带释义');
  const zh = renderHtml(REAL, { lang: 'zh', lintProblems: [], lintChecks: 16, imageExists });
  const en = renderHtml(REAL, { lang: 'en', lintProblems: [], lintChecks: 16, imageExists });
  ok(zh.includes('<th>中文释义</th>'), '中文报告的短语索引有释义列');
  // KPI 的分母曾经写死成配方卡的九个类目，两族之后读成「16 / 9」是句胡话（踩过）
  ok(!zh.includes(`${st.categories} <small>/ 9</small>`), 'KPI 类目不再拿配方卡的类目数当分母');
  ok(zh.includes(`${st.coverDone} <small>/ ${st.coverTotal}</small>`), 'KPI 带上技法覆盖率');
  eq(st.coverGap, 0, '七个域全部铺满');
  eq(st.recipes + st.techs, st.cards, '两族相加就是全库');
  ok(zh.includes('过肩取景'), '释义真的渲染进去了');
  ok(!en.includes('<td class="gl">'), '英文报告不出释义列');
  ok(en.includes('over-the-shoulder'), '英文报告照样有短语原文');
}

// --lang en 时正文必须真的换成英文那一份。show 曾经原样打整个中文文件、
// 末尾却写「英文正文来自 en/…」，是句谎话——这里守住那条不变量
{
  const EN = loadCards(CARDS_DIR, { lang: 'en' });
  eq(EN.length, REAL.length, '英文模式加载到同样数量的卡');
  ok(EN.every((c) => c.bodyLang === 'en'), '英文模式每张卡的正文都取自 en/');
  ok(EN.every((c) => !c.enMissing && !c.enParseError), '英文模式没有缺档也没有解析错');
  ok(EN.every((c) => c.body.includes(sectionsOf(c.kind, 'en')[0])), '英文模式正文是英文那一份（两族各查各的首节）');
  ok(EN.every((c, i) => c.must_phrases.join() === REAL[i].must_phrases.join()), '机器字段两种语言完全一致');
}

/* ---------------- 枚举完整性 ---------------- */

eq(Object.keys(CATEGORIES).length, 9, '九个类目');
ok(Object.values(CATEGORIES).every((v) => v.zh && v.en), '类目带中英名');
eq(SIZES.length, 5, '五个景别');
eq(CAMERAS.length, 20, 'H3 运镜词二十条');
ok(RESERVED_PHRASES.includes('push in') && RESERVED_PHRASES.includes('close-up'), '保留词覆盖运镜与景别');
eq(RESERVED_PHRASES.length, 25, '保留词共二十五条');
eq(APPLIES_TO.length, 4, '四个题材维');
eq(SECTIONS.recipe.zh.length, 6, '配方卡中文正文六节');
eq(SECTIONS.recipe.en.length, 6, '配方卡英文正文六节');
eq(SECTIONS.technique.zh.length, 6, '技法卡中文正文六节');
eq(SECTIONS.technique.en.length, 6, '技法卡英文正文六节');
eq(SECTIONS.technique.zh[1], '## 适用场景', '技法卡第二节是适用场景——手段没有「什么时候用」就是废知识');

/* ---------------- lint 逐条击穿 ---------------- */

// 骨架节要带一个含必备短语的代码块——否则触发「短语没落在骨架里」那道门
const bodyOf = (titles, filler, block) =>
  titles.map((t, i) => (i === 1 ? `${t}\n\n${filler}\n\n\`\`\`\n${block}\n\`\`\`` : `${t}\n\n${filler}`)).join('\n\n');
const SKELETON_BLOCK = 'medium shot, demo phrase here, 环境锚点';
const enBody = `---\nid: demo-card\n---\n\n${bodyOf(SECTIONS.recipe.en, 'body', SKELETON_BLOCK)}`;
const baseCard = () => ({
  file: 'demo-card.md',
  fileId: 'demo-card',
  id: 'demo-card',
  kind: 'recipe',
  name: '样卡',
  name_en: 'Demo card',
  one_line: '一句话',
  one_line_en: 'one line',
  category: 'dialogue',
  applies_to: ['drama'],
  energy: 2,
  seconds: [2, 4],
  cuts: [1, 2],
  sizes: ['medium'],
  cameras: ['Static Shot'],
  must_phrases: ['demo phrase here'],
  must_phrases_zh: ['样例短语'],
  tags: ['t'],
  example_frames: [],
  body: bodyOf(SECTIONS.recipe.zh, '正文', SKELETON_BLOCK),
  bodyLang: 'zh',
  parseError: null,
});
const lintOne = (mutate, extra = {}) => {
  const card = baseCard();
  mutate?.(card);
  return lintCards([card], {
    wholeLibrary: false,
    cardsDir: CARDS_DIR,
    imageExists: () => true,
    enExists: () => true,
    readEn: () => enBody,
    ...extra,
  });
};

eq(lintOne().length, 0, '合成基准卡零问题（击穿用例的对照组）');

ok(lintOne((c) => delete c.energy).some((x) => x.includes('缺字段 energy')), '缺必填字段被拦');
ok(lintOne((c) => delete c.kind).some((x) => x.includes('缺字段 kind')), '缺 kind 被拦');
ok(lintOne((c) => { c.kind = 'guideline'; }).some((x) => x.includes('recipe 或 technique')), 'kind 不在枚举里被拦');
ok(lintOne((c) => { c.covers = ['Push In']; }).some((x) => x.includes('配方卡不许写')), '配方卡写了 covers 被拦');
ok(lintOne((c) => { c.category = 'camera-move'; }).some((x) => x.includes('技法卡的类目')), '配方卡用技法卡的类目被拦');
ok(lintOne((c) => { c.id = 'other'; }).some((x) => x.includes('与文件名不一致')), 'id 与文件名不一致被拦');
ok(lintOne((c) => { c.category = 'romance'; }).some((x) => x.includes('不在 recipe 的类目表里')), '类目不在枚举里被拦');
ok(lintOne((c) => { c.applies_to = ['movie']; }).some((x) => x.includes('题材枚举')), '题材不在枚举里被拦');
ok(lintOne((c) => { c.energy = 7; }).some((x) => x.includes('1–5')), '能量越界被拦');
ok(lintOne((c) => { c.energy = 2.5; }).some((x) => x.includes('1–5')), '能量非整数被拦');
ok(lintOne((c) => { c.seconds = [5, 2]; }).some((x) => x.includes('seconds')), '秒数区间反了被拦');
ok(lintOne((c) => { c.cuts = [3]; }).some((x) => x.includes('cuts')), '格数不是区间被拦');
ok(lintOne((c) => { c.sizes = ['huge']; }).some((x) => x.includes('景别枚举')), '景别不在枚举里被拦');
ok(lintOne((c) => { c.cameras = ['推近']; }).some((x) => x.includes('运镜词表')), '运镜不在 H3 词表里被拦');
ok(lintOne((c) => { c.must_phrases = []; }).some((x) => x.includes('不能为空')), '必备短语为空被拦');
ok(lintOne((c) => { c.must_phrases = ['aa bb', 'cc dd', 'ee ff', 'gg hh']; }).some((x) => x.includes('上限 3 条')), '必备短语超过三条被拦');
ok(lintOne((c) => { c.must_phrases = ['Demo Phrase Here']; }).some((x) => x.includes('全小写')), '必备短语大写被拦');
ok(lintOne((c) => { c.must_phrases = ['ab cd']; }).some((x) => x.includes('太短')), '必备短语太短被拦');
ok(lintOne((c) => { c.must_phrases = ['handheldfeeling']; }).some((x) => x.includes('空格或连字符')), '必备短语是单个词被拦');
{
  const problems = lintOne((c) => { c.must_phrases = ['slow push in toward the face']; });
  ok(problems.some((x) => x.includes('保留词')), '必备短语撞运镜词被拦');
  ok(problems.some((x) => x.includes('push in')), '点名撞的是哪个保留词');
}
ok(lintOne((c) => { c.must_phrases = ['a wide shot of the room']; }).some((x) => x.includes('保留词')), '必备短语撞景别短语被拦');

// 中文释义与短语一一对应
ok(
  lintOne((c) => { c.must_phrases_zh = []; }).some((x) => x.includes('一一对应')),
  '释义条数对不上被拦',
);
ok(
  lintOne((c) => { c.must_phrases_zh = ['样例短语', '多出来的']; }).some((x) => x.includes('一一对应')),
  '释义比短语多也被拦',
);
ok(
  lintOne((c) => { c.must_phrases_zh = ['   ']; }).some((x) => x.includes('释义是空的')),
  '释义是空白被拦',
);
ok(
  lintOne((c) => { c.must_phrases_zh = ['demo phrase here']; }).some((x) => x.includes('没有中文')),
  '释义照抄英文被拦——那一列是给中文读者看的',
);
{
  // 同一条短语被两张卡声明，释义必须逐字相同：索引表一行一条短语，装不下两个译法
  const a = { ...baseCard(), must_phrases_zh: ['样例短语'] };
  const b = { ...baseCard(), file: 'other.md', fileId: 'other', id: 'other', must_phrases_zh: ['另一个译法'] };
  const probs = lintCards([a, b], { wholeLibrary: false, cardsDir: CARDS_DIR, imageExists: () => true, enExists: () => true, readEn: () => enBody });
  ok(probs.some((x) => x.includes('只能有一个译法')), '同一条短语在两张卡上译法不一致被拦');
}
ok(lintOne((c) => { c.body = '## 意图\n\n只有一节'; }).some((x) => x.includes('缺节')), '正文缺节被拦');
{
  const reordered = [...SECTIONS.recipe.zh];
  [reordered[1], reordered[2]] = [reordered[2], reordered[1]];
  ok(lintOne((c) => { c.body = reordered.map((t) => `${t}\n\n正文`).join('\n\n'); }).some((x) => x.includes('顺序')), '正文六节顺序不对被拦');
}
// 必备短语必须原样单行落在骨架代码块里
ok(
  lintOne((c) => { c.body = bodyOf(SECTIONS.recipe.zh, '正文', 'medium shot, 环境锚点'); })
    .some((x) => x.includes('没有原样出现在「提示词骨架」')),
  '必备短语没写进骨架代码块被拦',
);
ok(
  lintOne((c) => { c.body = bodyOf(SECTIONS.recipe.zh, '正文, demo phrase here', 'medium shot, 环境锚点'); })
    .some((x) => x.includes('没有原样出现在「提示词骨架」')),
  '短语只在骨架的散文里、没进代码块——照样被拦',
);
ok(
  lintOne((c) => { c.body = bodyOf(SECTIONS.recipe.zh, '正文', 'medium shot, demo phrase\nhere, 环境锚点'); })
    .some((x) => x.includes('没有原样出现在「提示词骨架」')),
  '短语被换行截断被拦（真实踩过：en/door-threshold）',
);
ok(
  lintOne(null, { readEn: () => `---\nid: demo-card\n---\n\n${bodyOf(SECTIONS.recipe.en, 'body', 'medium shot, nothing here')}` })
    .some((x) => x.includes('英文正文的必备短语')),
  '英文正文的骨架漏了必备短语被拦',
);
{
  const withBlock = bodyOf(SECTIONS.recipe.zh, '正文', SKELETON_BLOCK);
  eq(skeletonLines(withBlock, 'zh').length, 1, '骨架代码块只取块内的行');
  eq(skeletonLines(withBlock, 'zh')[0], SKELETON_BLOCK, '取到的就是块内原文');
  eq(skeletonLines('## 意图\n\n没有骨架节', 'zh').length, 0, '没有骨架节就取到空数组');
  eq(missingInSkeleton(withBlock, ['demo phrase here'], 'zh').length, 0, '短语在块里就不算缺');
  eq(missingInSkeleton(withBlock, ['DEMO PHRASE HERE'], 'zh').length, 0, '判定与 check 一致：两边小写化');
}

/* ---------------- 技法卡：另一族，另一套节，另一套门 ---------------- */

// 技法卡的骨架块在第三节（提示词怎么写），不是第二节——第二节是适用场景
const techBody = (titles, filler, block, notWhen) =>
  titles
    .map((t, i) => {
      if (i === 1) return `${t}\n\n${filler}\n\n${notWhen}：一条`;
      if (i === 2) return `${t}\n\n${filler}\n\n\`\`\`\n${block}\n\`\`\``;
      return `${t}\n\n${filler}`;
    })
    .join('\n\n');
const techEn = `---\nid: demo-tech\n---\n\n${techBody(SECTIONS.technique.en, 'body', SKELETON_BLOCK, `**${NOT_WHEN_MARK.en}**`)}`;
const baseTech = () => ({
  ...baseCard(),
  file: 'demo-tech.md',
  fileId: 'demo-tech',
  id: 'demo-tech',
  kind: 'technique',
  category: 'camera-move',
  covers: ['Push In'],
  body: techBody(SECTIONS.technique.zh, '正文', SKELETON_BLOCK, `**${NOT_WHEN_MARK.zh}**`),
});
const lintTech = (mutate, extra = {}) => {
  const card = baseTech();
  mutate?.(card);
  return lintCards([card], {
    wholeLibrary: false,
    cardsDir: CARDS_DIR,
    imageExists: () => true,
    enExists: () => true,
    readEn: () => techEn,
    ...extra,
  });
};

eq(lintTech().length, 0, '合成技法卡零问题（技法击穿用例的对照组）');
ok(lintTech((c) => { c.category = 'dialogue'; }).some((x) => x.includes('配方卡的类目')), '技法卡用配方卡的类目被拦');
ok(lintTech((c) => { c.covers = []; }).some((x) => x.includes('必须写 covers')), '技法卡缺 covers 被拦');
ok(lintTech((c) => { c.covers = ['Fly Around']; }).some((x) => x.includes('不在类目「camera-move」的域里')), 'covers 项不在域里被拦');
ok(lintTech((c) => { c.covers = ['low-angle']; }).some((x) => x.includes('不在类目')), 'covers 串了类目的域被拦');
ok(
  lintTech((c) => { c.body = techBody(SECTIONS.technique.zh, '正文', SKELETON_BLOCK, '**什么时候用**'); })
    .some((x) => x.includes('什么时候别用')),
  '技法卡不写「什么时候别用」被拦——只写什么时候用，读卡的人一定会滥用',
);
ok(
  lintTech(null, { readEn: () => `---\nid: demo-tech\n---\n\n${techBody(SECTIONS.technique.en, 'body', SKELETON_BLOCK, '**When to use it**')}` })
    .some((x) => x.includes(NOT_WHEN_MARK.en)),
  '英文正文不写 When not to use it 被拦',
);
ok(
  lintTech((c) => { c.body = techBody(SECTIONS.recipe.zh, '正文', SKELETON_BLOCK, `**${NOT_WHEN_MARK.zh}**`); })
    .some((x) => x.includes('正文缺节')),
  '技法卡套用配方卡的六节被拦',
);
{
  // 骨架节的位置两族不同：配方卡在第二节，技法卡在第三节
  const tech = baseTech();
  eq(skeletonLines(tech.body, 'zh', 'technique').length, 1, '技法卡的骨架块取自第三节');
  eq(skeletonLines(tech.body, 'zh', 'recipe').length, 0, '按配方卡去第二节找，技法卡取不到——两族不能混用');
}
{
  // 完整性门：域缺项就点名，缺几项说几项
  const probs = lintCards([baseTech()], { cardsDir: CARDS_DIR, imageExists: () => true, enExists: () => true, readEn: () => techEn });
  ok(probs.some((x) => x.includes('camera-move') && x.includes('域没铺满')), '域没铺满被拦');
  ok(probs.some((x) => x.includes('Static Shot')), '缺哪一项就点名哪一项');
  ok(!probs.some((x) => x.includes('域没铺满') && x.includes('Push In')), '已经被 covers 的那一项不再算缺');
  ok(
    lintCards([baseTech()], { wholeLibrary: false, cardsDir: CARDS_DIR, imageExists: () => true, enExists: () => true, readEn: () => techEn })
      .every((x) => !x.includes('域没铺满')),
    'wholeLibrary:false 时整库完整性门不参与——合成卡不该被整库门拦',
  );
}
{
  const cov = coverageOf([baseTech()]);
  eq(cov.length, Object.keys(COVER_DOMAINS).length, '覆盖表七个类目一个不少');
  const cm = cov.find((r) => r.category === 'camera-move');
  eq(cm.items.length, CAMERAS.length, '运镜域逐项列出二十条');
  eq(cm.items.find((i) => i.item === 'Push In').ids.join(), 'demo-tech', '覆盖表点名是谁讲的');
  eq(cm.gap, CAMERAS.length - 1, '缺口数就是没人讲的那些');
}

ok(lintOne(null, { enExists: () => false }).some((x) => x.includes('缺英文正文')), '缺英文正文被拦');
ok(lintOne(null, { readEn: () => '---\nid: wrong-id\n---\n' }).some((x) => x.includes('id')), '英文正文 id 对不上被拦');
ok(
  lintOne(null, { readEn: () => `---\nid: demo-card\n---\n\n## Intent\n\nonly one` }).some((x) => x.includes('英文正文缺节')),
  '英文正文缺节被拦',
);
ok(
  lintOne((c) => { c.example_frames = ['ghost.png']; }, { imageExists: () => false }).some((x) => x.includes('不存在')),
  '声明了不存在的示例帧被拦',
);
ok(lintOne((c) => { c.parseError = '坏了'; }).some((x) => x.includes('坏了')), '解析失败直接报出来');
{
  const a = baseCard();
  const b = { ...baseCard(), file: 'other.md', fileId: 'other' };
  b.id = 'demo-card';
  const problems = lintCards([a, b], { cardsDir: CARDS_DIR, imageExists: () => true, enExists: () => true, readEn: () => enBody });
  ok(problems.some((x) => x.includes('重复')), 'id 重复被拦');
}

/* ---------------- check（外部分镜 JSON） ---------------- */

{
  const refs = collectRecipeRefs(FIXTURE);
  eq(refs.length, 5, '夹具里五处配方引用');
  ok(refs.every((r) => r.path && r.recipe && r.frame), '每处引用都带路径、配方、提示词');
  eq(refs[0].path, 'scenes[0].cuts[0]', 'JSON 路径当定位符');
  ok(refs.some((r) => r.recipe === 'no-such-recipe'), '不存在的配方也会被收集（留给 check 报错）');
}
{
  const res = checkRecipes(collectRecipeRefs(FIXTURE), REAL);
  eq(res.total, 5, '总引用数');
  eq(res.skipped, 1, '中文提示词被跳过一处');
  ok(res.problems.some((x) => x.includes('blurred foreground shoulder')), '缺必备短语被点名到短语原文');
  ok(res.problems.some((x) => x.includes('scenes[1].cuts[0]')), '违规点名到 JSON 路径');
  ok(res.problems.some((x) => x.includes('no-such-recipe')), '不存在的配方被点名');
  eq(res.problems.length, 2, '合规的那两格不产生违规');
  ok(res.usage.get('ots-shot-reverse') >= 3, '使用次数统计');
  ok(Array.isArray(res.unused), '给出从没被使用的卡');
}
{
  // 中文提示词不误报：跳过而不是判它缺短语
  const zhOnly = { cuts: [{ recipe: 'ots-shot-reverse', frame: '中景过肩，前景是听者的肩膀' }] };
  const res = checkRecipes(collectRecipeRefs(zhOnly), REAL);
  eq(res.problems.length, 0, '中文提示词不误报违规');
  eq(res.skipped, 1, '中文提示词计入跳过');
}
eq(collectRecipeRefs({ cuts: [{ recipe: 'x' }] }).length, 0, '只有 recipe 没有 frame 的对象不算引用');
eq(collectRecipeRefs(null).length, 0, 'null 不崩');

/* ---------------- stats ---------------- */

{
  const st = computeStats(REAL);
  eq(st.cards, REAL.length, '卡片数');
  ok(st.categories >= 2, '类目数');
  ok(st.phrases.length >= 2, '去重短语索引非空');
  ok(st.phrases.every((p) => p.ids.length >= 1), '每条短语记得住是谁声明的');
  ok(st.cutAvg > 0, '平均格数');
  eq(st.withFrames + st.withoutFrames, REAL.length, '配图与未配图之和等于总数');
}

/* ---------------- render ---------------- */

const md = renderMarkdown(REAL);
ok(md.startsWith('# 镜头配方卡库'), 'md 标题');
ok(md.includes('## 对话'), 'md 按类目分组');
ok(md.includes('ots-shot-reverse'), 'md 带卡片 id');
ok(md.includes('必备短语') || md.includes('over-the-shoulder'), 'md 带必备短语');
ok(renderMarkdown(REAL, { lang: 'en' }).startsWith('# Shot recipe library'), 'md 英文标题');
ok(renderMarkdown(REAL, { lang: 'en' }).includes('## Dialogue'), 'md 英文类目名');

const html = renderHtml(REAL, { lintProblems: [], lintChecks: 14, imageExists });
ok(html.includes('<!doctype html>'), 'html 完整文档');
ok(!/src="http|href="http|@import|url\(http/.test(html), '零外部资源');
ok(html.includes('lang="zh"'), '默认中文');
ok(html.includes('类目 × 能量矩阵'), '01 矩阵');
ok(html.includes('配方卡墙'), '02 配方卡墙');
ok(html.includes('技法覆盖表'), '03 技法覆盖表');
ok(html.includes('技法卡墙'), '04 技法卡墙');
ok(html.includes('必备短语索引'), '05 短语索引');
ok(html.includes('卡库自检'), '06 自检');
ok(html.includes('cvi gap') || html.includes('cvi ok'), '覆盖表逐项渲染，缺口有专门样式');
ok(html.includes('id="card-ots-shot-reverse'), '卡片有锚点可跳转');
ok(html.includes('chip phrase copy'), '短语 chip 可点击复制');
ok(html.includes('示例帧未生成'), '没有示例帧就显示占位，不装有');
ok(html.includes('id="cards-data"'), '导出数据内嵌');
ok(html.includes('mx empty'), '矩阵空格子有专门的样式——语汇缺口要看得见');
ok(html.includes('<details>'), '正文六节折叠');
ok(!html.includes('sec-coverage'), '没给 check 时不出覆盖对照');
{
  const en = renderHtml(REAL, { lang: 'en', lintProblems: [], lintChecks: 14, imageExists });
  ok(en.includes('lang="en"'), '英文报告 html lang');
  ok(en.includes('Recipe cards') && en.includes('Must-have phrase index'), '英文区块标题');
  ok(en.includes('Technique coverage') && en.includes('Technique cards'), '英文技法区块标题');
  ok(!en.includes('配方卡墙') && !en.includes('必备短语索引') && !en.includes('技法覆盖表'), '英文报告不残留中文界面标签');
  ok(en.includes('Library checks'), '英文徽章');
}
{
  const check = checkRecipes(collectRecipeRefs(FIXTURE), REAL);
  const withCheck = renderHtml(REAL, { lintProblems: [], lintChecks: 14, check, imageExists });
  ok(withCheck.includes('sec-coverage'), '给了 check 才出覆盖对照');
  ok(withCheck.includes('一次都没有被使用'), '覆盖对照点名没被使用的卡——不装繁荣');
}
{
  const failed = renderHtml(REAL, { lintProblems: ['demo.md：坏了'], lintChecks: 14, imageExists });
  ok(failed.includes('gatepill fail'), '有问题时徽章翻红');
  ok(failed.includes('坏了'), '问题逐条列出');
}
{
  // XSS：卡片数据全部过 esc
  const evil = clone(REAL).slice(0, 1);
  evil[0].name = '<script>alert(1)</script>';
  evil[0].one_line = '<img src=x onerror=alert(1)>';
  const h = renderHtml(evil, { lintProblems: [], lintChecks: 14, imageExists });
  ok(!h.includes('<script>alert(1)</script>'), '卡名被转义');
  ok(!h.includes('<img src=x'), '一句话被转义');
  ok(h.includes('\\u003c'), '内嵌 JSON 的 < 转成 \\u003c，防 </script 截断');
}
ok(tOf('zh').langCode === 'zh' && tOf('en').langCode === 'en', 'tOf 取到两套文案');
assert.throws(() => tOf('fr'), /zh \/ en/);
passed += 1;

console.log(`✓ ${passed} 项自测全部通过`);
