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
  applyMerges,
  assembleCast,
  buildGraph,
  chunkText,
  mergeCandidates,
  mergeRoster,
  renderHtml,
  renderMarkdown,
  seedFromOutline,
  TIER_TO_IMPORTANCE,
  needsUiTranslation,
  slug,
  strings,
  uiTemplate,
  validateCast,
} from './novel-characters.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const examples = join(here, '..', 'examples');
// chunkText 内部会把 \r\n 规范成 \n 再切块。这里读进来先规范一次，否则 Windows 上
// （git 默认 core.autocrlf 把 .txt 检出成 CRLF）拿原始文本当比对基准，
// 「块内容来自原文」「覆盖全文」两条会假失败——issue #8。
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
function throws(fn, re, label) {
  assert.throws(fn, re, label);
  passed += 1;
}

/* ---------------- chunkText ---------------- */

eq(chunkText('').length, 0, '空文本不产生块');
eq(chunkText('   \n  ').length, 0, '纯空白不产生块');
eq(chunkText(SOURCE).length, 1, '短故事只有一块');

const long = SOURCE.repeat(150);
const chunks = chunkText(long);
ok(chunks.length > 1, '长文本会切成多块');
ok(chunks.every((c) => c.length <= CHUNK_SIZE), `没有块超过 CHUNK_SIZE(${CHUNK_SIZE})`);
ok(long.includes(chunks[0].slice(0, 200)), '块内容来自原文');
// 相邻块必须重叠，否则卡在切口上的角色会两边都漏
ok(chunks[1].includes(chunks[0].slice(-100).slice(0, 40)), '相邻块有重叠');
// 覆盖率：把所有块拼起来（去重叠后）应该盖住绝大部分原文
const covered = chunks.reduce((sum, c) => sum + c.length, 0);
ok(covered >= long.length, '所有块加起来覆盖全文（含重叠）');

const huge = SOURCE.repeat(1500);
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

/* ---------------- mergeCandidates / applyMerges ---------------- */

// 精确匹配的盲区：两块用了不同称呼、没有共同键，机械归并留成两个人
const twoLu = mergeRoster([
  [{ name: '陆行远', aliases: [], note: '瘦，颧骨高。', quotes: ['q1'] }],
  [{ name: '陆', aliases: [], note: '眉骨有疤。', quotes: ['q2'] }],
  [{ name: '沈知微', aliases: [], note: '两条辫子。', quotes: [] }],
]);
eq(twoLu.length, 3, '没有共同键归并不了——这就是候选机制要兜的洞');
const cands = mergeCandidates(twoLu);
eq(cands.length, 1, '名字包含关系被标成候选');
ok(cands[0].reason.includes('⊂'), '候选带理由');
ok(
  [cands[0].a, cands[0].b].includes('陆行远') && [cands[0].a, cands[0].b].includes('陆'),
  '候选指向正确的两个人',
);

// 别名也参与候选
eq(
  mergeCandidates([
    { name: '老周', aliases: ['摆渡人'], notes: [], quotes: [] },
    { name: '渡口的摆渡人', aliases: [], notes: [], quotes: [] },
  ]).length,
  1,
  '别名的包含关系也算候选',
);

// 拉丁文字短侧要 3 个字符起，否则噪音太多；CJK 单字就有信息量
eq(
  mergeCandidates([
    { name: 'Al', aliases: [], notes: [], quotes: [] },
    { name: 'Alexander', aliases: [], notes: [], quotes: [] },
  ]).length,
  0,
  '拉丁两字符不算候选',
);
eq(
  mergeCandidates([
    { name: 'Ish', aliases: [], notes: [], quotes: [] },
    { name: 'ishmael', aliases: [], notes: [], quotes: [] },
  ]).length,
  1,
  '拉丁三字符起算候选，大小写不敏感',
);
eq(mergeCandidates([twoLu[0]]).length, 0, '单人不产生候选');

// 复核结果落地
const applied = applyMerges(twoLu, [{ keep: '陆行远', absorb: ['陆'] }]);
eq(applied.length, 2, '合并后少一个人');
const luMerged = applied.find((c) => c.name === '陆行远');
ok(luMerged.aliases.includes('陆'), '被吸收的名字变成别名');
eq(luMerged.notes.length, 2, '被吸收的 notes 并入');
eq(luMerged.quotes.length, 2, '被吸收的 quotes 并入');
eq(mergeCandidates(applied).length, 0, '合并后候选清空');

// keep 用别名定位也行
const viaAlias = applyMerges(
  [
    { name: '老周', aliases: ['老伯'], notes: ['a'], quotes: [] },
    { name: '摆渡人', aliases: [], notes: ['b'], quotes: [] },
  ],
  [{ keep: '老伯', absorb: ['摆渡人'] }],
);
eq(viaAlias.length, 1, 'keep 用别名定位');
eq(viaAlias[0].name, '老周', '规范名不变');
eq(viaAlias[0].notes.length, 2, '两边 notes 都在');

// 找不到的人必须报错——静默跳过会让调用方以为合并成功了
throws(() => applyMerges(twoLu, [{ keep: '不存在', absorb: ['陆'] }]), /找不到/, 'keep 找不到要报错');
throws(() => applyMerges(twoLu, [{ keep: '陆行远', absorb: ['不存在'] }]), /找不到/, 'absorb 找不到要报错');
// 抛错前不许污染入参：部分合并成功、后面才发现找不到的人，入参也要原样
const pristine = JSON.stringify(twoLu);
throws(
  () => applyMerges(twoLu, [{ keep: '陆行远', absorb: ['陆'] }, { keep: '不存在', absorb: ['沈知微'] }]),
  /找不到/,
  '部分成功再失败也要报错',
);
eq(JSON.stringify(twoLu), pristine, '抛错后入参没有被改动');
eq(JSON.stringify(mergeRoster([[{ name: '甲', aliases: [], note: 'a', quotes: [] }]])),
  JSON.stringify(applyMerges(mergeRoster([[{ name: '甲', aliases: [], note: 'a', quotes: [] }]]), [])),
  '空 merges 是无操作');
// absorb 指向 keep 自己不算错——两个键早就是同一个人
eq(
  applyMerges([{ name: '甲', aliases: ['小甲'], notes: [], quotes: [] }], [{ keep: '甲', absorb: ['小甲'] }]).length,
  1,
  'absorb 已经是同一个人时不报错',
);

/* ---------------- seedFromOutline（大纲是角色的上游） ---------------- */

{
  // 拿真实的 outline 样例当夹具。这个函数的契约就是「吃 novel-outline 的产出」，
  // 手捏一份假 outline 测不到真实的字段形状。novel-art 与 novel-script 的自测
  // 读的是同一份文件，同仓库上游样例共享是既有做法。
  const outlinePath = join(here, '..', 'references', 'test-fixtures', 'upstream', '渡口-outline.json');
  const outline = JSON.parse(readFileSync(outlinePath, 'utf8'));
  const seeded = seedFromOutline(outline);

  ok(seeded.characters.length === outline.characters.length, 'seed 出的角色数跟大纲一致');
  ok(seeded.source === outline.source, 'source 从大纲继承');
  ok(seeded.summary === '', 'summary 留空——那是读完原文才写得出来的');

  // 分档映射：大纲拍板的轻重，这一层不推翻
  ok(TIER_TO_IMPORTANCE.lead === 'protagonist', 'lead → protagonist');
  ok(TIER_TO_IMPORTANCE.support === 'supporting', 'support → supporting');
  ok(TIER_TO_IMPORTANCE.functional === 'minor', 'functional → minor');
  for (const c of seeded.characters) {
    const src = outline.characters.find((x) => x.id === c.id);
    ok(c.importance === TIER_TO_IMPORTANCE[src.tier], `${c.name} 的分档照大纲映射`);
  }

  // 搬事实
  const first = seeded.characters[0];
  ok(first.id === outline.characters[0].id, '角色码从大纲搬过来');
  ok(first.name === outline.characters[0].name, '名字从大纲搬过来');
  ok(first.persona.arc === outline.characters[0].arc, '人物弧光大纲已经写了，直接用');
  ok(first.seedNote.includes(outline.characters[0].role), 'seedNote 带上大纲定位，供模型细分主角组');
  ok(first.seedNote.includes('C01'), 'seedNote 带上角色码');

  // 留设计
  ok(first.aliases.length === 0, '别名留空——大纲里没有，要读原文才知道');
  ok(first.oneLiner === '', '一句话留空');
  ok(first.image.prompt === '' && first.voice.prompt === '', '形象与音色提示词留空');
  ok(first.persona.appearance === '' && first.persona.evidence.length === 0, '外貌与引文留空');

  // 骨架不是成品：直接校验必然报字段缺失，这是预期行为，跟 art / script 的 seed 一致
  const problems = validateCast(seeded.characters, null);
  ok(problems.length > 0, 'seed 产出是骨架不是成品，直接 validate 会报缺字段');

  // 空大纲不炸
  ok(seedFromOutline({}).characters.length === 0, '空大纲返回空角色表，不抛异常');
  ok(seedFromOutline(null).source === '', 'null 也不炸');
  // tier 缺失或不认识时给一个安全的中间档，不是崩掉
  ok(seedFromOutline({ characters: [{ name: '张三' }] }).characters[0].importance === 'supporting',
    'tier 缺失时退到 supporting，不抛异常也不给最高档');
}

/* ---------------- assembleCast ---------------- */

const asm = assembleCast(
  [
    { name: 'A', importance: 'supporting' },
    { name: 'B', importance: 'protagonist' },
    { name: 'C', importance: 'major' },
    { name: 'D', importance: 'major' },
  ],
  { source: '书', lang: 'zh', summary: '摘要' },
);
eq(asm.source, '书', 'assemble 带书名');
eq(asm.lang, 'zh', 'assemble 带语言');
eq(asm.summary, '摘要', 'assemble 带摘要');
eq(asm.characters.map((c) => c.name).join(''), 'BCDA', '按 importance 排序，同档保持传入顺序');
ok(!('ui' in asm), '没有 ui 就不写这个键');

// 同档要按戏份序——CLI 按文件名读卡是 slug 字典序，order 就是用来纠正它的
const byFilename = [
  { name: '老周', importance: 'major' },      // 文件名序在前
  { name: '沈知微', importance: 'protagonist' },
  { name: '陆行远', importance: 'major' },     // 但戏份比老周重
];
const ordered = assembleCast(byFilename, { source: 'x', order: ['沈知微', '陆行远', '老周'] });
eq(ordered.characters.map((c) => c.name).join('→'), '沈知微→陆行远→老周', '同档按 order 的戏份顺序');
eq(
  assembleCast(byFilename, { source: 'x' }).characters.map((c) => c.name).join('→'),
  '沈知微→老周→陆行远',
  '不给 order 才退回传入顺序——这正是要修的文件名序',
);
// order 里没有的名字排同档末尾，不报错
eq(
  assembleCast(byFilename, { source: 'x', order: ['沈知微', '陆行远'] }).characters.map((c) => c.name).join('→'),
  '沈知微→陆行远→老周',
  'order 缺名字的排同档末尾',
);
ok('ui' in assembleCast([{ name: 'A' }], { source: 'x', ui: { copy: 'Copier' } }), '有 ui 翻译就带上');
eq(
  assembleCast([{ name: 'X', importance: 'sidekick' }, { name: 'B', importance: 'protagonist' }], { source: 'x' })
    .characters[0].name,
  'B',
  'importance 越界的排最后而不是崩掉',
);

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
ok(md.includes('角色设定图提示词'), 'Markdown 含设定图提示词');
ok(renderMarkdown(CAST, 'Ferry', '', 'en').includes('# Ferry — Cast'), 'Markdown 跟随语言参数');

const html = renderHtml(CAST, '渡口');
ok(html.startsWith('<!doctype html>'), 'HTML 是完整文档');
// 三栏工作台：顶栏 + 左栏角色列表 + 主区一次一个角色
eq((html.match(/class="char[ "]/g) || []).length, CAST.length, `主区有 ${CAST.length} 个角色`);
eq((html.match(/class="rost[ "]/g) || []).length, CAST.length, `左栏列出 ${CAST.length} 个角色`);
eq((html.match(/class="char on"/g) || []).length, 1, '默认只展开第一个角色');
eq((html.match(/class="rost on"/g) || []).length, 1, '左栏默认选中第一个');
// 音色提示词要紧凑不要散文——voice design 引擎吃的是参数密度，
// 散文会把参数稀释掉（生产里实测对比过 500 字散文 vs 230 字参数串，后者明显更好）
{
  ok(CAST.every((c) => c.voice.prompt.length <= 400), '样例的音色提示词都在 400 字符以内');
  const wordy = clone();
  wordy[0].voice.prompt = 'A young female voice, nineteen years old. '.repeat(12);
  ok(
    validateCast(wordy, SOURCE).some((x) => x.includes('超过 400')),
    '写成散文的音色提示词被拦',
  );
  const edge = clone();
  edge[0].voice.prompt = 'x'.repeat(400);
  ok(
    !validateCast(edge, SOURCE).some((x) => x.includes('超过 400')),
    '正好 400 字符不拦——上限是含等于',
  );
}

// 音色提示词里不许出现引号台词——模型写过「杀意藏在『规矩就是规矩』这类客套话里」，
// 台词一进去，有些 TTS 引擎会把它当成要朗读的内容（生产里踩过）
{
  for (const q of ['「规矩就是规矩」', '『规矩就是规矩』', '"rules are rules"', '“rules are rules”']) {
    const bad = clone();
    bad[0].voice.prompt += ` menace hidden inside ${q}`;
    ok(
      validateCast(bad, SOURCE).some((x) => x.includes('引号台词')),
      `音色提示词里的引号台词被拦（${q.slice(0, 2)}）`,
    );
  }
  const ok1 = clone();
  ok1[0].voice.prompt += ' Consonants land softly, vowels stay open.';
  eq(validateCast(ok1, SOURCE).length, 0, '正常的音色描述不误拦');
  const ok2 = clone();
  ok2[0].voice.prompt += ' A dry "k" sound.';
  eq(validateCast(ok2, SOURCE).length, 0, '引号里只有一两个字符不算台词');
}

// 音色只保留喂引擎的那一条：给人读的六项已经是结构化中文字段，
// 再给一段中文散文，用户会复制错——这是这次修复的根因
{
  const html = renderHtml(CAST, { source: '渡口' });
  ok(!html.includes('音色提示词（中文'), '报告里不再有中文音色提示词');
  ok(html.includes('音色提示词 · 喂 TTS 引擎用这条'), '音色提示词的标签写明用途');
  ok(html.includes('出图提示词 · 喂出图模型用这条'), '出图提示词的标签写明用途');
  const iEn = html.indexOf('出图提示词 · 喂出图模型用这条');
  const iLocal = html.indexOf('出图提示词（中文对照）');
  ok(iEn >= 0 && iLocal >= 0 && iEn < iLocal, '出图那一组机器字段排在中文对照前面');
  ok(CAST.every((c) => !('promptLocal' in (c.voice ?? {}))), '样例的 voice 里没有 promptLocal');
}

// 每人 6 个复制按钮：出图 EN/设定图/反向/中文对照 + 音色（只有喂引擎的那一条）+ 整份 JSON
// 音色刻意只留一条：给人读的六个结构化中文字段已经在上面的卡片里，
// 再放一段中文散文只会让人复制错——生产里真踩过（用户把中文对照喂进了 TTS）
// 用 class="copy 前缀匹配——整份 JSON 那个是 class="copy wide"
eq((html.match(/class="copy[ "]/g) || []).length, CAST.length * 6, '每段提示词都有复制按钮');
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

// 有 1:1 头像时缩略图铺满头像，大图仍用设定图
const withFace = clone();
withFace[0].sheetImage = 'images/x.png';
withFace[0].faceImage = 'images/x-avatar.png';
const faceHtml = renderHtml(withFace, 'x');
ok(faceHtml.includes("background-image:url('images/x-avatar.png')"), '左栏缩略图优先用头像');
ok(faceHtml.includes('class="rost-thumb face"'), '有头像时走铺满分文');
ok(faceHtml.includes('<img src="images/x.png"'), '大图仍用设定图而不是头像');

// XSS：角色数据是模型生成的，不能直接拼进 HTML
const evil = clone();
evil[0].name = '<img src=x onerror=alert(1)>';
const evilHtml = renderHtml(evil, 'x');
ok(!evilHtml.includes('<img src=x onerror'), '角色字段里的 HTML 被转义');

// 故事摘要
const DOC = JSON.parse(readFileSync(join(examples, '渡口-cast.json'), 'utf8'));
ok(DOC.summary && DOC.summary.trim(), '样例带故事摘要');
ok(renderHtml(CAST, '渡口', DOC.summary).includes('class="synopsis'), 'HTML 顶部渲染摘要');
ok(!renderHtml(CAST, '渡口', '').includes('class="synopsis'), '没有摘要时不留空壳');
ok(renderMarkdown(CAST, '渡口', DOC.summary).includes('## 故事摘要'), 'Markdown 也带摘要');
ok(renderHtml(CAST, '渡口', '<b>x</b>').includes('&lt;b&gt;'), '摘要里的 HTML 被转义');
// 摘要默认三行 + 渐隐，点一下展开
const synHtml = renderHtml(CAST, '渡口', DOC.summary);
ok(synHtml.includes('class="synopsis syn-clamp"'), '摘要默认是折叠态');
ok(/\.syn-clamp p\{[^}]*-webkit-line-clamp:3/.test(synHtml), '摘要最多三行');
ok(/\.syn-clamp p\{[^}]*mask-image:linear-gradient/.test(synHtml), '折起来的摘要底部渐隐');
ok(synHtml.includes('class="syn-more"'), '有展开入口');
ok(/syn\.classList\.remove\('syn-clamp'\)/.test(synHtml), '点一下展开全部');
ok(/scrollHeight <= body\.clientHeight/.test(synHtml), '摘要短到不用折叠就不显示展开入口');

/* ---------------- 导出 JSON ---------------- */

// 导出的形状就是 cast.json，编辑完要能直接喂回 render
const expHtml = renderHtml(CAST, '渡口', DOC.summary, 'zh', null);
ok(expHtml.includes('class="expo"'), '顶栏有导出按钮');
ok(expHtml.includes('<script type="application/json" id="cast-data">'), '数据内嵌在报告里');
ok(expHtml.includes('data-name="渡口-cast.json"'), '下载文件名跟着书名走');

const embedded = expHtml.match(/<script type="application\/json" id="cast-data">([\s\S]*?)<\/script>/)[1];
const round = JSON.parse(embedded.replace(/\\u003c/g, '<'));
eq(round.source, '渡口', '导出带书名');
eq(round.lang, 'zh', '导出带语言');
eq(round.summary, DOC.summary, '导出带故事摘要');
eq(round.characters.length, CAST.length, '导出带全部角色');
eq(JSON.stringify(round.characters), JSON.stringify(CAST), '角色卡原样导出，没有丢字段');
eq(validateCast(round.characters, SOURCE, 'zh').length, 0, '导出的数据能直接喂回 validate 并通过');

// ⚠️ 正文里一个 </script 就能把数据块提前截断
const xss = clone();
xss[0].persona.appearance = '他说</script><script>alert(1)</script>';
const xssHtml = renderHtml(xss, 'x', '');
const xssData = xssHtml.match(/<script type="application\/json" id="cast-data">([\s\S]*?)<\/script>/)[1];
ok(!xssData.includes('</script'), '数据块里的 </script 被转义，截不断');
ok(JSON.parse(xssData.replace(/\\u003c/g, '<')).characters[0].persona.appearance.includes('</script>'), '转义了但内容没丢');

// 没有 ui 就不写这个键，免得导出里多一个空字段
ok(!('ui' in JSON.parse(renderHtml(CAST, 'x', '').match(/id="cast-data">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<'))), '没有 ui 翻译就不写这个键');
ok('ui' in JSON.parse(renderHtml(CAST, 'x', '', 'fr', { copy: 'Copier' }).match(/id="cast-data">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, '<')), '有 ui 翻译就带上');

/* ---------------- 关系图谱 ---------------- */

// 别名要能连上（老周被叫「老伯」），同一对人只连一条边，指向没画像的人算 dangling
const G = buildGraph([
  { name: 'A', aliases: [], persona: { relationships: [{ name: 'B的绰号', relation: 'r1' }] } },
  { name: 'B', aliases: ['B的绰号'], persona: { relationships: [{ name: 'A', relation: 'r2' }] } },
  { name: 'C', aliases: [], persona: { relationships: [{ name: '没这个人', relation: 'r3' }] } },
]);
eq(G.edges.length, 1, '同一对人只连一条边');
eq(G.edges[0].notes.length, 2, '两个方向的说法都留着');
eq(G.dangling, 1, '指向没做画像的角色算 dangling');
eq(
  buildGraph([{ name: 'A', aliases: [], persona: { relationships: [{ name: 'A', relation: 'x' }] } }]).edges.length,
  0,
  '不给自己连边',
);
ok(buildGraph([{ name: 'A', aliases: [], persona: {} }]).edges.length === 0, '没有 relationships 也不炸');

const graphHtml = renderHtml(CAST, '渡口');
ok(graphHtml.includes('class="graph'), '有关系图谱视图');
ok(graphHtml.includes('class="gtoggle"'), '左栏有图谱入口');
// 顶栏的搜索图标也是 svg，所以要卡到 .graph-canvas 里面那张，否则测了个寂寞
const canvas = graphHtml.match(/<div class="graph-canvas">\s*<svg viewBox="0 0 (\d+) (\d+)"/);
ok(canvas, '图谱是内联 SVG，不引库');
eq(canvas[1], canvas[2], '画布是正方形');
ok(Number(canvas[1]) >= 480, '画布够大，名字放得下');
eq((graphHtml.match(/class="gnode[ "]/g) || []).length, CAST.length, `图谱有 ${CAST.length} 个节点`);
const CAST_EDGES = buildGraph(CAST).edges;
ok(CAST_EDGES.length > 0, '样例里能连出关系');
eq((graphHtml.match(/class="gedge"/g) || []).length, CAST_EDGES.length, '弦数和边数一致');
eq((graphHtml.match(/class="grow"/g) || []).length, CAST_EDGES.length, '关系表和边数一致');
ok(CAST_EDGES.every((e) => e.a <= e.b), '边的端点排过序，方向不影响去重');
// 节点点了要能跳到对应角色，靠的是和 .rost 同一套 data-target
for (const c of CAST) ok(graphHtml.includes(`data-node="${c.name}" data-target="p-${slug(c.name)}"`), `${c.name} 的节点能跳转`);
ok(graphHtml.includes('.main.gmode .char{display:none}'), '图谱和角色详情互斥');
// 弦上的关系文字
eq((graphHtml.match(/class="glabel"/g) || []).length, CAST_EDGES.length, '每条弦上都有关系文字');
ok(graphHtml.includes('class="glabtoggle'), '关系文字有总开关');
ok(/class="graph labels"/.test(graphHtml), `${CAST_EDGES.length} 条边，默认把关系文字标出来`);
ok(/<text class="glabel"[^>]*>[^<]+<title>/.test(graphHtml), '短标签在弦上，全文进 title');
ok(graphHtml.includes('.glabel{display:none'), '关掉时关系文字不画');
ok(graphHtml.includes('.glabel.hot{display:block'), '关掉了，悬停那条也要显示');
ok(/\.glabel\{[^}]*pointer-events:none/.test(graphHtml), '关系文字不挡节点的鼠标');
ok(/\.glabel\{[^}]*paint-order:stroke/.test(graphHtml), '关系文字有底衬，压在弦上也读得清');
// 长关系要截断，否则一条弦上糊一整句
const longRel = clone();
longRel[0].persona.relationships = [{ name: longRel[1].name, relation: '一二三四五六七八九十甲乙丙丁戊己庚辛' }];
// 对手方也清空，否则这条边上会有两种说法，标签取的是更短的那条
longRel[1].persona.relationships = [];
const longHtml = renderHtml(longRel, 'x');
ok(longHtml.includes('一二三四五六…'), '超过 6 字截断');
ok(longHtml.includes('<title>一二三四五六七八九十甲乙丙丁戊己庚辛') || longHtml.includes('丙丁戊己庚辛</title>'), '截断了但全文还在 title 里');
// 边多了默认收起来
const many = Array.from({ length: 8 }, (_, i) => {
  const c = clone()[0];
  c.name = `角色${i}`;
  c.aliases = [];
  c.persona = { ...c.persona, relationships: Array.from({ length: 8 }, (_, j) => ({ name: `角色${j}`, relation: 'r' })) };
  return c;
});
ok(!/class="graph labels"/.test(renderHtml(many, 'x')), '边多了默认不标关系文字');
ok(/@media print\{[\s\S]*\.graph\{display:block!important/.test(graphHtml), '打印时图谱也出');
// 主角节点要看得出来
eq((graphHtml.match(/class="gnode lead"/g) || []).length, CAST.filter((c) => c.importance === 'protagonist').length, '主角节点单独标出');

// 布局骨架
const css = renderHtml(CAST, 'x');
ok(/\.shell\{[^}]*grid-template-columns:var\(--side-w\)/.test(css), '左栏 + 主区两栏骨架');
ok(/\.upper\{[^}]*grid-template-columns:minmax\(0,1fr\) 500px/.test(css), '主区内是内容 + 信息卡两栏');
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
for (const l of ['zh', 'en', 'ja']) ok(SUPPORTED_UI_LANGS.includes(l), `内置 ${l} 界面`);

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

// 同批角色的提示词不许雷同——模型套同一个模板，两个年龄性别接近的角色会出成同一个人（issue #9）
eq(validateCast(CAST, SOURCE, 'zh').length, 0, '样例四个角色的提示词差异够大，不误拦');
{
  const dup = clone();
  dup[1].image.prompt = dup[0].image.prompt;
  ok(
    validateCast(dup, SOURCE, 'zh').some((x) => x.includes('出图提示词雷同')),
    '两个角色的出图提示词完全相同会报错',
  );
}
{
  // 只改年龄与衣服颜色 —— 这正是实际踩到的形态：个体描述太短，剩下全是样板
  const near = clone();
  near[1].image.prompt = near[0].image.prompt
    .replace(/nineteen-year-old/g, 'twenty-two-year-old')
    .replace(/navy-blue/g, 'dark green');
  ok(
    validateCast(near, SOURCE, 'zh').some((x) => x.includes('出图提示词雷同')),
    '只改几个词的出图提示词照样被拦',
  );
}
{
  const dupVoice = clone();
  dupVoice[1].voice.prompt = dupVoice[0].voice.prompt;
  ok(
    validateCast(dupVoice, SOURCE, 'zh').some((x) => x.includes('音色提示词雷同')),
    '两个角色的音色提示词相同也会报错',
  );
}
{
  // image.sheet 刻意不查：三分区排版规范是大段固定文本，真实角色之间本来就 63% 重合
  const dupSheet = clone();
  dupSheet[1].image.sheet = dupSheet[0].image.sheet;
  ok(
    !validateCast(dupSheet, SOURCE, 'zh').some((x) => x.includes('雷同')),
    'image.sheet 相同不报错——它的固定排版文本占比太高，设门必然误拦',
  );
}
{
  // 极短提示词不参与判定，否则空字段之间会互相假命中
  const tiny = clone();
  tiny[0].image.prompt = 'a man';
  tiny[1].image.prompt = 'a man';
  ok(
    !validateCast(tiny, SOURCE, 'zh').some((x) => x.includes('出图提示词雷同')),
    '词数太少的提示词不参与雷同判定',
  );
}

/* ---------------- 真实感 ---------------- */

// 一边要真实感一边在反向提示词里禁真实感，是自相矛盾的
ok(
  CAST.every((c) => !/photorealistic|3d render|\banime\b/i.test(c.image.negativePrompt)),
  'negativePrompt 不禁画风词——出图时选的可能正是它',
);
ok(
  CAST.every((c) => /plastic or waxy skin|poreless doll face/i.test(c.image.negativePrompt)),
  'negativePrompt 改禁「假」而不是禁「真」',
);
// 画风是出图那一刻才定的，写进提示词就会跟当时选的风格打架
for (const k of [
  /flat vector cartoon/i,
  /semi-?realistic/i,
  /painterly/i,
  /\bphotoreal/i,
  /\banime style/i,
]) {
  ok(
    CAST.every((c) => !k.test(`${c.image.sheet} ${c.image.prompt} ${c.image.tags.join(' ')}`)),
    `提示词里不写画风：${k.source}`,
  );
}
// 设定图是全剧通用的参照，钉在某个场合上就只覆盖了部分戏。形制已经排在句首，
// 场合标签跟在后面不增加画面信息，只增加一个「只在这个场合这样穿」的承诺。
for (const k of [/便装/, /常服/, /朝服/, /公服/, /吉服/, /燕居/, /casual wear/i, /court dress/i]) {
  ok(
    CAST.every((c) => !k.test(`${c.image.sheet} ${c.image.prompt} ${c.image.promptLocal ?? ''}`)),
    `提示词里不写场合标签：${k.source}`,
  );
}
// 「架空」说的是这个设定跟真实历史什么关系，画面里没有对应物；
// 跟 `(inferred)` 一样，是关于设定的话，不是设定本身。
for (const k of [/架空/, /虚构/, /某朝/, /\bfictional\b/i, /alternate history/i]) {
  ok(
    CAST.every((c) => !k.test(`${c.image.sheet} ${c.image.prompt} ${c.image.promptLocal ?? ''}`)),
    `提示词里不写设定的元信息：${k.source}`,
  );
}
// 提示词写的是这个人独有的东西——换任何画风都成立
for (const [k, label] of [
  [/asymmetric/i, '左右不对称'],
  [/flyaway hair strands/i, '碎发破轮廓'],
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
