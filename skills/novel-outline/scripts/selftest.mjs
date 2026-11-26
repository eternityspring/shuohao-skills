#!/usr/bin/env node
// 自测：覆盖 novel-outline.mjs 里所有确定性逻辑。
// 不调用任何模型，不花额度，跑一次 < 1 秒。
//   node scripts/selftest.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADAPT_MODES,
  DEFAULT_PER_VOLUME,
  DEFAULT_THRESHOLDS,
  MAX_VOLUMES,
  RISK_PATTERNS,
  STAGES,
  chunkVolumes,
  computeAssets,
  detectChapters,
  fmtEps,
  gateReport,
  primarySceneCap,
  renderHtml,
  renderMarkdown,
  slug,
  validateOutline,
} from './novel-outline.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = JSON.parse(readFileSync(join(here, '..', 'examples', '渡口-outline.json'), 'utf8'));

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
const gate = (o, id) => gateReport(o).find((g) => g.id === id);

/* ---------------- chunk ---------------- */

const book = Array.from({ length: 30 }, (_, i) => `第${i + 1}章 标题\n\n正文${'内容'.repeat(50)}`).join('\n\n');
eq(detectChapters(book).length, 30, '识别出 30 个章节标题');
ok(detectChapters('楔子 雾\n\n正文\n\n第一章 渡口\n\n正文').length === 2, '楔子也算章节标题');
ok(detectChapters('Chapter 12 The Ferry\n\ntext').length === 1, '英文 Chapter 也认');

const byChapter = chunkVolumes(book, 10);
eq(byChapter.mode, 'chapter', '有章节就按章分卷');
eq(byChapter.volumes.length, 3, '30 章 ÷ 每卷 10 章 = 3 卷');
eq(byChapter.chapters, 30, '章数报对');
eq(byChapter.truncated, false, '没超限不报截断');
ok(byChapter.volumes[0].includes('第1章') && byChapter.volumes[0].includes('第10章'), '第一卷装前 10 章');
ok(byChapter.volumes[2].includes('第30章'), '最后一卷装到尾');

const intro = '开篇引子没有章节号\n\n第一章 渡口\n\n正文\n\n第二章 雾\n\n正文';
ok(chunkVolumes(intro, 10).volumes[0].startsWith('开篇引子'), '章前引子归进第一卷');

const plain = 'X'.repeat(45_000);
const bySize = chunkVolumes(plain, 10);
eq(bySize.mode, 'size', '识别不出章节就按字数切');
ok(bySize.volumes.length >= 2, '长文本切成多块');
eq(chunkVolumes('', 10).volumes.length, 0, '空文本零卷');

const huge = Array.from({ length: MAX_VOLUMES + 5 }, (_, i) => `第${i + 1}章 x\n\n正文`).join('\n\n');
const capped = chunkVolumes(huge, 1);
eq(capped.volumes.length, MAX_VOLUMES, `超限截到 ${MAX_VOLUMES} 卷`);
eq(capped.truncated, true, '超限必须明确报 truncated');

/* ---------------- slug ---------------- */

eq(slug('渡口'), '渡口', '中文书名保留');
eq(slug('a/b:c'), 'a-b-c', '危险字符替换');

/* ---------------- 夹具本身 ---------------- */

eq(validateOutline(FIXTURE).length, 0, '自带样例通过 full 校验');
eq(validateOutline(FIXTURE, 'skeleton').length, 0, '样例通过 skeleton 校验');
eq(validateOutline(FIXTURE, 'beats').length, 0, '样例通过 beats 校验');
ok(gateReport(FIXTURE).every((g) => g.ok), '样例全部质量门通过');
eq(gateReport(FIXTURE).length, 14, '质量门共 14 项');

/* ---------------- props 叙事道具 ---------------- */

{
  const clone = () => JSON.parse(JSON.stringify(FIXTURE));

  // 自带样例带 props，两道相关的门都该过
  ok(Array.isArray(FIXTURE.props) && FIXTURE.props.length > 0, '自带样例带上了叙事道具');
  ok(gate(FIXTURE, 'prop-cap').ok, '样例的道具数在上限内');
  ok(gate(FIXTURE, 'refs').ok, '样例的道具引用完整');
  ok(gate(FIXTURE, 'refs').label.includes('道具'), '有 props 时 refs 门的措辞点出道具');

  // --- 向后兼容：没有 props 字段的旧大纲必须照常通过，不是报错 ---
  // 这条是这次改动最要紧的一条断言。存量 outline.json 一份都没有 props，
  // 如果这两道门判失败，等于所有旧大纲一升级就全红。
  const old = clone(); delete old.props;
  for (const e of old.episodes) delete e.propIds;
  eq(validateOutline(old).length, 0, '旧大纲没有 props 照常通过 validate');
  ok(gate(old, 'prop-cap').ok, '旧大纲的道具上限门跳过而不是失败');
  ok(gate(old, 'prop-cap').detail.includes('跳过'), '跳过要明说，不静默');
  ok(gate(old, 'refs').ok, '旧大纲的引用门照常通过');
  ok(!gate(old, 'refs').label.includes('道具'), '没有 props 时 refs 门的措辞不提道具');
  eq(gateReport(old).length, 14, '旧大纲的门数一样是 14，跳过不等于少一道门');

  // --- 击穿：propIds 指向不存在的道具 ---
  const a = clone(); a.episodes[0].propIds = ['P09'];
  ok(!gate(a, 'refs').ok, 'propIds 指向不存在的道具被拦下');
  ok(gate(a, 'refs').detail.includes('P09'), '点名是哪个 id');

  // --- 击穿：登记了但从没在任何一集出现 ---
  const b = clone(); b.props.push({ id: 'P03', name: '油纸伞', function: '没人用它' });
  ok(!gate(b, 'refs').ok, '零集使用的道具被拦下——跟失业角色同一个判据');
  ok(gate(b, 'refs').detail.includes('P03'), '点名是哪件道具');

  // --- 击穿：beatIds 指向不存在的爽点 ---
  const c = clone(); c.props[0].beatIds = ['B99'];
  ok(!gate(c, 'refs').ok, 'beatIds 指错被拦下——指错等于这件道具没有戏剧理由');

  // --- 击穿：超过上限 ---
  const d = clone();
  for (let i = 3; i <= 10; i += 1) {
    const id = `P${String(i).padStart(2, '0')}`;
    d.props.push({ id, name: `道具${i}`, function: '凑数' });
    d.episodes[0].propIds.push(id);
  }
  ok(!gate(d, 'prop-cap').ok, '道具超过 8 件被拦下');
  ok(gate(d, 'prop-cap').detail.includes('10'), '报出实际件数');

  // --- 击穿：结构层 ---
  const e1 = clone(); delete e1.props[0].function;
  ok(validateOutline(e1).some((x) => x.includes('function')), '缺 function 被拦——填不出来的不是道具是背景');
  const e2 = clone(); e2.props[0].id = 'X01';
  ok(validateOutline(e2).some((x) => x.includes('P01 这种格式')), '道具 id 格式被拦');
  const e3 = clone(); e3.props[1].id = 'P01';
  ok(validateOutline(e3).some((x) => x.includes('重复')), '道具 id 重复被拦');
  const e4 = clone(); e4.props[0].beatIds = 'B01';
  ok(validateOutline(e4).some((x) => x.includes('beatIds')), 'beatIds 不是数组被拦');

  // --- 资产清单是算出来的，不是模型写的 ---
  const assets = computeAssets(FIXTURE);
  eq(assets.props.length, FIXTURE.props.length, '资产清单汇总了全部道具');
  const p01 = assets.props.find((x) => x.id === 'P01');
  const epsWithP01 = FIXTURE.episodes.filter((x) => (x.propIds ?? []).includes('P01')).map((x) => x.ep);
  assert.deepEqual(p01.episodes, epsWithP01, '出现集是从 episodes[].propIds 反查出来的');
  eq(p01.uses, epsWithP01.length, '次数跟出现集对得上');
  eq(computeAssets(old).props.length, 0, '旧大纲的道具清单是空数组，不是 undefined');
}

eq(STAGES.join(','), 'skeleton,beats,full', '三档 stage');
ok(ADAPT_MODES.includes('抽核'), '改编幅度枚举');

/* ---------------- 质量门逐项击穿 ---------------- */
// 每一道门都要证明它真的会拦——不然就是永远为真的假测试

// G1a–G1c 角色分档上限
{
  const o = clone();
  for (let i = 6; i <= 9; i++) {
    o.characters.push({ id: `C0${i}`, name: `主角${i}`, tier: 'lead', role: '主', arc: '有弧', from: ['原创'] });
    o.episodes[0].characterIds.push(`C0${i}`);
  }
  ok(!gate(o, 'lead-cap').ok, '6 个主角被拦（上限 5）');
  ok(gate(o, 'support-cap').ok, '配角档不受主角档超限影响');
  ok(validateOutline(o).some((x) => x.includes('主角组') && x.includes('超过上限')), 'validate 报主角组超限');
}
{
  const o = clone();
  for (let i = 6; i <= 16; i++) {
    o.characters.push({ id: `C${String(i).padStart(2, '0')}`, name: `伙计${i}`, tier: 'functional', role: '功能', from: ['原创'] });
    o.episodes[0].characterIds.push(`C${String(i).padStart(2, '0')}`);
  }
  ok(!gate(o, 'functional-cap').ok, '11 个功能性角色被拦（上限 10）');
}
{
  const o = clone();
  o.characters.forEach((c) => { if (c.tier === 'lead') c.tier = 'support'; });
  ok(!gate(o, 'lead-cap').ok, '一个主角都没有也被拦——没有主角的剧不成立');
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('没有主角组')), 'skeleton 档就报缺主角');
}

// 阈值可覆盖
{
  const o = clone();
  o.params.thresholds = { maxLeads: 1 };
  ok(!gate(o, 'lead-cap').ok, '阈值收紧到 1，2 个主角就超');
  eq(DEFAULT_THRESHOLDS.maxLeads, 5, '主角组默认上限 5');
  eq(DEFAULT_THRESHOLDS.maxSupport, 10, '重要配角默认上限 10');
  eq(DEFAULT_THRESHOLDS.maxFunctional, 10, '功能性角色默认上限 10');
}

// 分档的结构规则
{
  const o = clone();
  o.characters[0].tier = 'boss';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('tier')), '未知 tier 被拦');
}
{
  const o = clone();
  delete o.characters[0].arc; // 沈知微是 lead
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('arc')), '主角缺人物弧被拦');
}
{
  const o = clone();
  delete o.characters[4].arc; // 更夫是 functional，本来就没有 arc 字段
  eq(validateOutline(o, 'skeleton').length, 0, '功能性角色不要求人物弧——医生就是来缝针的');
}

// G2 主场景上限——随集数动态：clamp(4 + ⌈集数/10⌉, 5, 15)
// 这是 AI 短剧的数：场景是生成的没有搭景钱，上限守的是一致性资产和空间认知
eq(primarySceneCap(6), 5, '6 集微型剧给 5 个主场景');
eq(primarySceneCap(20), 6, '20 集给 6');
eq(primarySceneCap(30), 7, '30 集给 7');
eq(primarySceneCap(60), 10, '60 集给 10');
eq(primarySceneCap(100), 14, '100 集给 14');
eq(primarySceneCap(200), 15, '再长也封顶 15');
eq(primarySceneCap(undefined), 8, '没有集数信息给居中值 8');
{
  const o = clone(); // 夹具 6 集 → 上限 5
  for (let i = 4; i <= 9; i++) o.scenes.push({ id: `S0${i}`, name: `景${i}`, primary: true });
  o.episodes[0].sceneIds.push('S04', 'S05', 'S06', 'S07', 'S08', 'S09');
  ok(!gate(o, 'scene-cap').ok, '6 集的剧开 8 个主场景被拦');
  ok(gate(o, 'scene-cap').label.includes('≤ 5'), '门的标签显示动态算出的上限');
  o.params.episodes = 60; // 只为验证上限跟着集数走——集数变了其他门会另行报错
  ok(gate(o, 'scene-cap').ok, '同样 8 个主场景，60 集就放行');
  o.params.episodes = 6;
  o.params.thresholds = { maxPrimaryScenes: 9 };
  ok(gate(o, 'scene-cap').ok, '显式覆盖优先于动态值——放宽');
  o.params.thresholds = { maxPrimaryScenes: 3 };
  o.params.episodes = 60;
  ok(!gate(o, 'scene-cap').ok, '显式覆盖优先于动态值——收紧也一样');
}

// G3 一次性场景没有规避方案
{
  const o = clone();
  delete o.scenes[2].reusePlan; // S03 只用了一次
  ok(!gate(o, 'once-scene').ok, '一次性场景缺规避方案被拦');
  ok(gate(o, 'once-scene').detail.includes('芦苇'), '报错点名是哪个场景');
}

// G4 爽点间隔
{
  const o = clone();
  o.beats = o.beats.filter((b) => b.id !== 'B02'); // 1 → 5 之间断档
  ok(!gate(o, 'beat-gap').ok, '第 1–5 集断档被拦');
  ok(gate(o, 'beat-gap').detail.includes('断档'), '报的是断档');
}
{
  const o = clone();
  o.beats.forEach((b) => (b.episode = Math.min(b.episode + 3, 6)));
  o.beats[0].episode = 4; // 开头真空
  ok(!gate(o, 'beat-gap').ok, '开头 3 集真空被拦');
}
{
  const o = clone();
  o.beats = o.beats.filter((b) => b.episode <= 3);
  ok(!gate(o, 'beat-gap').ok, '结尾真空被拦');
  // beats 档就要拦住间隔问题，不能等写完分集才发现
  ok(validateOutline(o, 'beats').some((x) => x.includes('爽点间隔')), 'beats 档就报间隔');
}

// G5 第 1 集钩子
{
  const o = clone();
  o.episodes[0].hook = ' ';
  ok(!gate(o, 'ep1-hook').ok, '第 1 集没钩子被拦');
}

// G6 大爆点时机
for (const [total, firstMajor, expected] of [
  [1, 1, true],
  [1, null, false],
  [2, 2, false],
  [2, 1, true],
  [3, 2, true],
  [3, 3, false],
]) {
  const o = clone();
  o.params.episodes = total;
  o.characters = o.characters.slice(0, 1);
  o.scenes = [{ ...o.scenes[0], reusePlan: '复用船舱背景' }];
  delete o.props;
  o.episodes = o.episodes.slice(0, total).map((e) => ({
    ...e, characterIds: ['C01'], sceneIds: ['S01'], propIds: [],
  }));
  o.beats = o.beats.slice(0, total).map((b, i) => ({
    ...b, episode: i + 1, weight: i + 1 === firstMajor ? 'major' : 'minor',
  }));

  const name = `${total} 集，首个大爆点：${firstMajor ?? '无'}`;
  const gates = gateReport(o);
  const major = gates.find((g) => g.id === 'major-early');
  eq(major.ok, expected, `${name}：G6 判定`);
  eq(gates.length, 14, `${name}：质量门共 14 项`);
  const problems = expected ? [] : [`质量门未过：${major.label}（${major.detail}）`];
  const { episodes, ...beatsOnly } = o;
  for (const [stage, input] of [['beats', beatsOnly], ['full', o]]) {
    assert.deepEqual(validateOutline(input, stage), problems, `${name}：${stage} 档校验`);
    passed++;
  }

  if (total === 1) {
    ok(major.label.includes('跨集时序不适用'), `${name}：质量门说明单集例外`);
    if (!expected) eq(major.detail, '第 1 集没有 major 爽点', `${name}：诊断说明缺少大爆点`);
    for (const [lang, label, detail] of [
      ['zh', '单集至少有一个大爆点（跨集时序不适用）', '第 1 集没有 major 爽点'],
      ['en', 'Single episode has at least one major beat (cross-episode timing does not apply)', 'No major beat in episode 1'],
    ]) {
      const html = renderHtml(o, lang);
      const gateList = html.match(/<ul class="gate">([\s\S]*?)<\/ul>/)[1];
      eq((gateList.match(/<li /g) ?? []).length, 14, `${name}：${lang} HTML 有 14 项质量门`);
      const status = expected ? 'ok' : 'bad';
      const marker = expected ? '✓' : '✗';
      ok(gateList.includes(`<li class="${status}"><span class="m">${marker}</span><span>${label}${expected ? '' : `<small>${detail}</small>`}</span></li>`),
        `${name}：${lang} HTML 质量门文案与诊断`);
      if (!expected) ok(html.includes(`<span>${label} — ${detail}</span>`), `${name}：${lang} HTML 失败横幅`);
      ok(renderMarkdown(o, lang).split('\n').includes(`- ${expected ? '✅' : '❌'} ${label}${expected ? '' : ` — ${detail}`}`),
        `${name}：${lang} Markdown 质量门文案与诊断`);
    }
    if (expected) {
      o.beats[0].episode = 2;
      ok(!gate(o, 'major-early').ok, '单集项目的第 2 集不计入大爆点');
      ok(validateOutline(beatsOnly, 'beats').some((x) => x.includes('第 1 集没有 major 爽点')),
        'beats 档指出唯一一集没有大爆点');
      ok(validateOutline(o).some((x) => x.includes('落在不存在的第 2 集')),
        'full 档仍报越界引用');
    }
  }
}
{
  const o = clone();
  o.beats.forEach((b) => (b.weight = 'minor'));
  o.beats[3].weight = 'major'; // 唯一 major 在第 6 集（最后一集）
  ok(!gate(o, 'major-early').ok, 'major 只在最后一集被拦');
  ok(validateOutline(o, 'beats').some((x) => x.includes('大爆点')), 'beats 档就报大爆点');
}
{
  const o = clone();
  o.beats.forEach((b) => (b.weight = 'minor'));
  ok(!gate(o, 'major-early').ok, '一个 major 都没有也被拦');
}

// G7 三栏齐全
{
  const o = clone();
  o.episodes[3].suspense = '';
  ok(!gate(o, 'ep-fields').ok, '缺悬念栏被拦');
  ok(gate(o, 'ep-fields').detail.includes('4'), '报错点名第 4 集');
}

// G8 同框拆解
{
  const o = clone();
  delete o.episodes[0].crowdPlan; // 第 1 集 4 人同框
  ok(!gate(o, 'crowd-plan').ok, '三人以上没有拆解方案被拦');
}
{
  const o = clone();
  o.episodes[1].characterIds = ['C01', 'C04']; // 两个人不需要
  delete o.episodes[1].crowdPlan;
  ok(gate(o, 'crowd-plan').ok, '两人同框不强制拆解方案');
}

// G9 生成难点预警
{
  const o = clone();
  o.episodes[2].synopsis += '雨点砸在船篷上。';
  ok(!gate(o, 'risk-flag').ok, '梗概出现雨戏没进预警被拦');
  o.episodes[2].warnings = ['雨戏'];
  ok(gate(o, 'risk-flag').ok, '标了预警就放行');
}
ok(Object.keys(RISK_PATTERNS).length === 4, '四类生成难点');
ok(RISK_PATTERNS['肢体接触'].test('两人拥抱'), '拥抱触发肢体接触');
ok(RISK_PATTERNS['人群'].test('集市上'), '集市触发人群');

// G10 引用完整
{
  const o = clone();
  o.episodes[0].sceneIds.push('S99');
  ok(!gate(o, 'refs').ok, '引用不存在的场景被拦');
}
{
  const o = clone();
  o.episodes.forEach((e) => (e.characterIds = e.characterIds.filter((id) => id !== 'C04')));
  o.episodes[0].characterIds = ['C01', 'C02', 'C03'];
  ok(!gate(o, 'refs').ok, '失业角色被拦');
  ok(gate(o, 'refs').detail.includes('C04'), '报错点名失业的是谁');
}
{
  const o = clone();
  o.episodes.forEach((e) => (e.sceneIds = e.sceneIds.filter((id) => id !== 'S03')));
  ok(!gate(o, 'refs').ok, '空转场景被拦');
}
{
  const o = clone();
  o.beats[0].episode = 99;
  ok(!gate(o, 'refs').ok, '爽点落在不存在的集被拦');
}

// G11 叙述体
{
  const o = clone();
  o.episodes[1].synopsis = '胡二爷说：「你这箱子里是金条吧。」';
  ok(!gate(o, 'no-dialogue').ok, '梗概里写对白被拦');
}
{
  const o = clone();
  o.episodes[1].hook = '他说“跟我走”算不算威胁';
  ok(!gate(o, 'no-dialogue').ok, '弯引号也被拦');
}

/* ---------------- validate 结构检查 ---------------- */

ok(validateOutline(null).length === 1, 'null 直接报');
{
  const o = clone();
  o.params.adaptMode = '魔改';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('adaptMode')), '未知改编幅度被拦');
}
{
  const o = clone();
  o.params.genre = '';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('genre')), '题材缺失被拦——它决定爽点类型');
}
{
  const o = clone();
  o.adaptation.cut = [];
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('没砍')), '抽核却一条没砍被拦');
  o.params.adaptMode = '忠实';
  ok(!validateOutline(o, 'skeleton').some((x) => x.includes('没砍')), '忠实改编允许不砍');
}
{
  const o = clone();
  o.characters[0].id = 'X1';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('C01 这种格式')), '角色 id 格式被拦');
}
{
  const o = clone();
  o.characters[1].id = 'C01';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('重复')), '角色 id 重复被拦');
}
{
  const o = clone();
  o.characters[0].from = [];
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('改动记录')), '缺 ← 改动记录被拦');
}
{
  const o = clone();
  delete o.scenes[0].primary;
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('primary')), '场景缺 primary 被拦');
}
{
  const o = clone();
  o.beats[0].weight = 'huge';
  ok(validateOutline(o, 'beats').some((x) => x.includes('weight')), '未知 weight 被拦');
}
{
  const o = clone();
  o.beats[0].setup = '';
  ok(validateOutline(o, 'beats').some((x) => x.includes('setup')), '爽点缺铺垫被拦');
}
{
  const o = clone();
  o.episodes.pop();
  ok(validateOutline(o).some((x) => x.includes('说好 6 集')), '集数对不上被拦');
}
{
  const o = clone();
  o.episodes[2].ep = 9;
  ok(validateOutline(o).some((x) => x.includes('编号必须从 1 连续')), '集号断裂被拦');
}

// stage 分档：skeleton 不看 beats/episodes
{
  const o = clone();
  delete o.beats;
  delete o.episodes;
  eq(validateOutline(o, 'skeleton').length, 0, 'skeleton 档不要求 beats/episodes');
  ok(validateOutline(o, 'beats').some((x) => x.includes('beats 为空')), 'beats 档要求爽点表');
  ok(validateOutline(o, 'full').length > 0, 'full 档要求全部');
}

/* ---------------- 资产清单 ---------------- */

const assets = computeAssets(FIXTURE);
eq(assets.scenes.length, 3, '资产清单收全部场景');
{
  const s01 = assets.scenes.find((s) => s.id === 'S01');
  eq(s01.uses, 6, 'S01 每集都用');
  eq(s01.episodes.join(','), '1,2,3,4,5,6', 'S01 出现集列表');
  const s03 = assets.scenes.find((s) => s.id === 'S03');
  eq(s03.uses, 1, 'S03 只用一次');
  ok(s03.reusePlan, '一次性场景带着复用方案');
}
{
  const c04 = assets.characters.find((c) => c.id === 'C04');
  eq(c04.uses, 6, '胡二爷每集都在');
  const c02 = assets.characters.find((c) => c.id === 'C02');
  eq(c02.episodes.join(','), '1,2,3,4,6', '陆行远第 5 集缺席');
}
// 角色资产量折算：按档算出来的，不让模型写
{
  const plan = Object.fromEntries(assets.castPlan.map((t) => [t.tier, t]));
  eq(plan.lead.count, 2, '主角组 2 人');
  eq(plan.support.count, 2, '重要配角 2 人');
  eq(plan.functional.count, 1, '功能性角色 1 人');
  ok(plan.lead.spec.includes('设定图'), '主角组折算成全套设定图');
  ok(plan.functional.spec.includes('提示词'), '功能性角色折算成提示词直出');
  ok(plan.functional.names.includes('岸上挑灯的更夫'), '折算表带名单');
}
eq(assets.warnings['人群'].join(','), '2', '预警清单按类型汇总');
eq(assets.beatsByType['身份揭破'].join(','), '3', '爽点按类型汇总落点');

/* ---------------- render markdown ---------------- */

const md = renderMarkdown(FIXTURE);
ok(md.startsWith('# 渡口 · 短剧改编大纲'), 'MD 标题');
ok(md.includes('6 集 × 2 分钟'), 'MD 带参数行');
for (const sec of ['一、改编说明', '二、人物表', '三、爽点表', '四、分集梗概', '五、资产清单']) {
  ok(md.includes(sec), `MD 有${sec}`);
}
ok(md.includes('（由分集数据自动汇总）'), 'MD 标明资产清单是算出来的');
ok(md.includes('【钩子】'), 'MD 钩子栏');
ok(md.includes('【悬念】'), 'MD 悬念栏');
ok(md.includes('✅'), 'MD 带质量门结果');
ok(md.includes('合并：岸边问路的路人甲乙'), 'MD 人物表带 ← 改动记录');
ok(md.includes('主角组'), 'MD 人物表带层级');
ok(md.includes('角色资产量折算'), 'MD 资产清单带按档折算');
// 人物表按档排序：主角组在前
ok(md.indexOf('| C01 |') < md.indexOf('| C05 |'), '主角排在功能性角色前面');

/* ---------------- render html ---------------- */

const html = renderHtml(FIXTURE);
ok(html.startsWith('<!doctype html>'), 'HTML 完整文档');
ok(!/<script\s+src=/.test(html), '不引外部脚本');
ok(!/<link\s/.test(html), '不引外部样式');
ok(!/@import|url\(https?:/.test(html), 'CSS 不拉外部资源');
// 反向验证：检测正则本身要抓得到东西
ok(/<script\s+src=/.test('<script src="x.js">'), '外部脚本检测正则有效');

eq((html.match(/class="ep" /g) || []).length, 6, '6 张分集卡');

// KPI 带：六张统计卡
eq((html.match(/class="kpi[ "]/g) || []).length, 6, 'KPI 带 6 张卡');
ok(html.includes('总集数') && html.includes('生成难点'), 'KPI 卡有标签');
ok(html.includes('主角 2 · 配角 2 · 功能 1'), '角色卡按档报数');

// 关键决策：拍板三件事落进纸面
ok(html.includes('关键决策'), '有关键决策区块');
ok(html.includes('砍了哪条线') && html.includes('合了哪些人') && html.includes('大爆点落在第几集'), '决策三栏齐全');
ok(html.includes('5 个角色位（主角组 2 · 重要配角 2 · 功能性 1）'), '角色位统计是算出来的');
ok(html.includes('主角组：沈知微、陆行远'), '主角组名单是算出来的');
ok(html.includes('这意味着：全剧困在渡口一夜之内'), 'cutNote 结论句渲染出来');
ok(/<i>ep3<\/i>/.test(html) && /<i>ep5<\/i>/.test(html), '大爆点列表带集号');
ok(html.includes('首个') && html.includes('终局'), '首末大爆点有标记');

// 爽点节奏：时间轴（不是格子条也不是柱状图）
eq((html.match(/class="bdot/g) || []).length, 4, '时间轴 4 个爽点节点');
eq((html.match(/class="bdot major"/g) || []).length, 2, '2 个大爆点实心节点');
eq((html.match(/class="tick"/g) || []).length, 6, '6 个集刻度');
ok(html.includes('class="gapnote"'), '空档标在轴上');
ok(html.includes('1 集空档'), '空档标注带集数');
// 空档超阈值要变铁锈红
{
  const o = clone();
  o.params.episodes = 9;
  o.beats.find((b) => b.id === 'B04').episode = 9;
  o.episodes.push(
    { ep: 7, synopsis: '过渡。', hook: 'x', suspense: 'y', sceneIds: ['S01'], characterIds: ['C01'] },
    { ep: 8, synopsis: '过渡。', hook: 'x', suspense: 'y', sceneIds: ['S01'], characterIds: ['C01'] },
    { ep: 9, synopsis: '收束。', hook: 'x', suspense: 'y', sceneIds: ['S01'], characterIds: ['C01'] },
  );
  o.episodes[5].synopsis = '雾还没散。';
  ok(renderHtml(o).includes('class="gapnote bad"'), '超阈值空档标成铁锈红');
}
// 长剧折行：60 集两行以上的轴
{
  const o = clone();
  o.params.episodes = 40;
  ok(/viewBox="0 0 1520 352"/.test(renderHtml(o)), '40 集折成两行轴（每行 20 集）');
}

// 爽点节奏：图 / 表 tab，默认时间轴
eq((html.match(/class="tab[ "]/g) || []).length, 2, '两个 tab');
ok(html.includes('class="tab on" data-pane="pane-timeline"'), '默认选中时间轴');
ok(html.includes('class="tabpane on" id="pane-timeline"'), '时间轴面板默认显示');
ok(html.includes('class="tabpane" id="pane-table"'), '明细表面板默认隐藏');
ok(html.includes("p.id === btn.dataset.pane"), 'tab 切换脚本在');
ok(/@media print\{[\s\S]*\.tabpane\{display:block!important/.test(html), '打印时两个面板都出');

// 分集概览：默认前三集 + 渐隐 + 展开
ok(html.includes('>分集概览<'), '区块改名分集概览');
ok(html.includes('class="epswrap clip"'), '超过 3 集默认收起');
ok(html.includes('.epswrap.clip .eps .ep:nth-child(n+4){display:none}'), '收起态只显示前三张卡');
ok(html.includes('class="epsmore"'), '有展开按钮');
ok(html.includes('▾ 展开全部 6 集'), '按钮标明总集数');
ok(/linear-gradient\(180deg,transparent,var\(--paper\)\)/.test(html), '收起态底部渐隐');
ok(/epsMore\.remove\(\)/.test(html), '点一下展开且按钮消失');
ok(/@media print\{[\s\S]*\.epswrap\.clip \.eps \.ep\{display:block!important/.test(html), '打印时分集全展开');
{
  const o = clone();
  o.params.episodes = 3;
  o.episodes = o.episodes.slice(0, 3);
  o.beats = o.beats.filter((b) => b.episode <= 3);
  const short = renderHtml(o);
  ok(!short.includes('class="epswrap clip"'), '3 集以内不收起');
  ok(!short.includes('class="epsmore"'), '3 集以内没有展开按钮');
}

// 每集调度矩阵：角色 + 场景 + 道具同一张网格
ok(html.includes('每集调度矩阵'), '有调度矩阵');
eq((html.match(/class="mc[ "]/g) || []).length, (5 + 3 + 2) * 6, '矩阵格数 =（角色+场景+道具）× 集数');
ok(html.includes('场　景'), '矩阵里有场景分带');
ok(html.includes('道　具'), '矩阵里有道具分带');
eq((html.match(/class="mc on pp"/g) || []).length, 7, '道具亮格数 = 各道具出现集之和');
ok(html.includes('1 ⚠'), '一次性场景在合计列带警示');
{
  // 旧大纲（无 props）整段不出，不留一个空标题
  const oldDoc = JSON.parse(JSON.stringify(FIXTURE));
  delete oldDoc.props;
  for (const e of oldDoc.episodes) delete e.propIds;
  const oldHtml = renderHtml(oldDoc);
  ok(!oldHtml.includes('道　具'), '旧大纲的矩阵不出道具分带');
  ok(!oldHtml.includes('叙事道具</td>'), '旧大纲的资产量折算不出道具行');
  eq((oldHtml.match(/class="mc[ "]/g) || []).length, (5 + 3) * 6, '旧大纲的矩阵格数不含道具');
}

// 场景概览卡
eq((html.match(/class="scard"/g) || []).length, 3, '每个场景一张卡');
ok(html.includes('>1–6<'), '连续出现集合写成区间');
ok(html.includes('>1 · 6<'), '离散出现集用间隔点');
ok(html.includes('承载爽点'), '场景卡带承载爽点');
ok(html.includes('出场角色'), '主场景卡带出场角色');
eq(fmtEps([1, 2, 3]), '1–3', 'fmtEps 连续区间');
eq(fmtEps([1, 6]), '1 · 6', 'fmtEps 离散间隔点');
eq(fmtEps([5]), '5', 'fmtEps 单集');
eq(fmtEps([]), '—', 'fmtEps 空');
eq(fmtEps([1, 3, 5, 7, 9]), '5 集', 'fmtEps 太散只报数量');

// 资产量折算：场景环境和生成难点也折进去
ok(html.includes('场景环境'), '折算表带场景环境行');
ok(html.includes('人群 ×1（第 2 集）'), '折算表带生成难点明细');

// 区块顺序：节奏 → 分集概览 → 场景概览 → 决策 → 调度矩阵 → 折算 → 人物 → 改编说明 → 质量门
{
  const order = ['>爽点节奏<', '>分集概览<', '>场景概览<', '>关键决策<', '>每集调度矩阵<', '>资产量折算<', '>人物表<', '>改编说明<', '>质量门<'];
  const idx = order.map((s) => html.indexOf(s));
  ok(idx.every((v) => v >= 0) && idx.every((v, i) => i === 0 || v > idx[i - 1]), '区块顺序正确');
}

ok((html.match(/class="gate"/g) || []).length === 1, '质量门清单');
eq((html.match(/<li class="ok">/g) || []).length, 14, '14 项质量门全 ✓');
ok(html.includes('全部通过'), '通过时有总结行');
ok(html.includes('gatepill pass'), '页眉徽章是通过态');

// 质量门失败也要渲染出来——体检模式靠这个给诊断
{
  const o = clone();
  o.episodes[0].hook = '';
  const bad = renderHtml(o);
  ok(bad.includes('<li class="bad">'), '未过的门标 ✗');
  // 抹掉第 1 集钩子会连坐两道门：ep1-hook + 三栏齐全
  ok(bad.includes('2 项未过'), '总结行报未过数');
  ok(bad.includes('gatepill fail'), '页眉徽章变失败态');
  ok(bad.includes('class="galert"'), 'KPI 带下面弹出病灶横幅');
}

// 导出：内嵌的就是 outline.json 原样
ok(html.includes('<script type="application/json" id="outline-data">'), '数据内嵌');
ok(html.includes('data-name="渡口-outline.json"'), '下载文件名跟书名');
{
  const embedded = html.match(/<script type="application\/json" id="outline-data">([\s\S]*?)<\/script>/)[1];
  const round = JSON.parse(embedded.replace(/\\u003c/g, '<'));
  eq(JSON.stringify(round), JSON.stringify(FIXTURE), '导出数据与 outline.json 逐字节一致');
  eq(validateOutline(round).length, 0, '导出数据能直接喂回 validate');
}
ok(html.includes('revokeObjectURL(url), 10000'), 'blob 延后回收——Safari 抢跑会存出空文件');

// XSS：大纲是模型生成的，一律转义
{
  const o = clone();
  o.episodes[0].synopsis = '<img src=x onerror=alert(1)>';
  o.characters[0].name = '<b>沈</b>';
  const evil = renderHtml(o);
  ok(!evil.includes('<img src=x'), '梗概里的 HTML 被转义');
  ok(!evil.includes('<b>沈</b>'), '人名里的 HTML 被转义');
}
// </script 会截断内嵌数据块
{
  const o = clone();
  o.adaptation.core = '他说</script><script>alert(1)</script>了吗';
  const x = renderHtml(o).match(/id="outline-data">([\s\S]*?)<\/script>/)[1];
  ok(!x.includes('</script'), '数据块里的 </script 被转义');
  eq(JSON.parse(x.replace(/\\u003c/g, '<')).adaptation.core, o.adaptation.core, '转义了但内容没丢');
}

ok(html.includes('@media print'), '可打印');
ok(html.includes('prefers-reduced-motion'), '尊重减少动效');
ok(html.includes('原文依据'), '改编说明的证据列渲染出来');
ok(html.includes('雾一厚，连自己的手都看不清。'), '逐字证据进了报告');

/* ---------------- render 英文界面 ---------------- */
// 只翻译界面：数据（爽点类型、改编幅度、书名）和质量门 label 原样出

ok(html.includes('<html lang="zh">'), '默认中文界面，lang="zh"');

const enHtml = renderHtml(FIXTURE, 'en');
ok(enHtml.includes('<html lang="en">'), '英文界面 lang="en"');
ok(enHtml.includes('Export JSON'), 'EN 报告有 Export JSON 按钮');
ok(enHtml.includes('Key decisions'), 'EN 报告有 Key decisions 区块');
ok(enHtml.includes('Dispatch matrix'), 'EN 报告有 Dispatch matrix 区块');
ok(enHtml.includes('Beat rhythm') && enHtml.includes('Scene overview'), 'EN 报告有 Beat rhythm 和 Scene overview');
ok(enHtml.includes('Asset conversion') && enHtml.includes('Quality gates'), 'EN 报告有 Asset conversion 和 Quality gates');
ok(!enHtml.includes('导出 JSON'), 'EN 报告不含中文导出按钮');
ok(!enHtml.includes('关键决策'), 'EN 报告不含中文关键决策标题');
ok(!enHtml.includes('每集调度矩阵') && !enHtml.includes('资产量折算'), 'EN 报告不含中文区块标题');
ok(enHtml.includes('悬念钩'), 'EN 报告里爽点类型是数据，保持原样');
ok(enHtml.includes('Leads 1–5'), 'EN 报告的质量门标签翻译且阈值原样保留');
ok(!enHtml.includes('主角组 1–5 人'), 'EN 报告不再出现中文门标签');
ok(enHtml.includes('Episode 1'), 'EN 分集卡标题');

// outline.json 顶层 lang 字段生效，显式 --lang 优先
{
  const o = clone();
  o.lang = 'en';
  ok(renderHtml(o).includes('<html lang="en">'), 'outline.lang=en 时默认出英文界面');
  ok(renderHtml(o, 'zh').includes('<html lang="zh">'), '显式 lang 参数优先于 outline.lang');
}

const enMd = renderMarkdown(FIXTURE, 'en');
ok(enMd.startsWith('# 渡口 · Short-Drama Adaptation Outline'), 'EN MD 标题');
ok(enMd.includes('1. Adaptation notes') && enMd.includes('5. Asset list'), 'EN MD 章节标题');
// 质量门 label（含【钩子】字样）是数据不翻译，只查界面上的栏目标签
ok(enMd.includes('**[Hook]**') && !enMd.includes('**【钩子】**'), 'EN MD 钩子栏用英文方括号');

// 非法语言直接抛错，不静默回退
{
  let threw = '';
  try {
    renderHtml(FIXTURE, 'fr');
  } catch (e) {
    threw = e.message;
  }
  ok(threw.includes('zh / en'), '非法语言抛错——界面只内置 zh / en');
}

eq(DEFAULT_PER_VOLUME, 15, '默认每卷 15 章');

console.log(`✓ ${passed} 项自测全部通过`);
