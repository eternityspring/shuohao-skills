#!/usr/bin/env node
// 自測：覆蓋 novel-outline.mjs 裡所有確定性邏輯。
// 不呼叫任何模型，不花額度，跑一次 < 1 秒。
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
  assert.strictEqual(actual, expected, `${msg} — 期望 ${expected}，實際 ${actual}`);
  passed++;
}
const clone = () => JSON.parse(JSON.stringify(FIXTURE));
const gate = (o, id) => gateReport(o).find((g) => g.id === id);

/* ---------------- chunk ---------------- */

const book = Array.from({ length: 30 }, (_, i) => `第${i + 1}章 標題\n\n正文${'內容'.repeat(50)}`).join('\n\n');
eq(detectChapters(book).length, 30, '辨識出 30 個章節標題');
ok(detectChapters('楔子 霧\n\n正文\n\n第一章 渡口\n\n正文').length === 2, '楔子也算章節標題');
ok(detectChapters('Chapter 12 The Ferry\n\ntext').length === 1, '英文 Chapter 也認');

const byChapter = chunkVolumes(book, 10);
eq(byChapter.mode, 'chapter', '有章節就按章分卷');
eq(byChapter.volumes.length, 3, '30 章 ÷ 每卷 10 章 = 3 卷');
eq(byChapter.chapters, 30, '章數報對');
eq(byChapter.truncated, false, '沒超限不報截斷');
ok(byChapter.volumes[0].includes('第1章') && byChapter.volumes[0].includes('第10章'), '第一卷裝前 10 章');
ok(byChapter.volumes[2].includes('第30章'), '最後一卷裝到尾');

const intro = '開篇引子沒有章節號\n\n第一章 渡口\n\n正文\n\n第二章 霧\n\n正文';
ok(chunkVolumes(intro, 10).volumes[0].startsWith('開篇引子'), '章前引子歸進第一卷');

const plain = 'X'.repeat(45_000);
const bySize = chunkVolumes(plain, 10);
eq(bySize.mode, 'size', '辨識不出章節就按字數切');
ok(bySize.volumes.length >= 2, '長文字切成多塊');
eq(chunkVolumes('', 10).volumes.length, 0, '空文字零卷');

const huge = Array.from({ length: MAX_VOLUMES + 5 }, (_, i) => `第${i + 1}章 x\n\n正文`).join('\n\n');
const capped = chunkVolumes(huge, 1);
eq(capped.volumes.length, MAX_VOLUMES, `超限截到 ${MAX_VOLUMES} 卷`);
eq(capped.truncated, true, '超限必須明確報 truncated');

/* ---------------- slug ---------------- */

eq(slug('渡口'), '渡口', '中文書名保留');
eq(slug('a/b:c'), 'a-b-c', '危險字元替換');

/* ---------------- 夾具本身 ---------------- */

eq(validateOutline(FIXTURE).length, 0, '自帶樣例透過 full 校驗');
eq(validateOutline(FIXTURE, 'skeleton').length, 0, '樣例透過 skeleton 校驗');
eq(validateOutline(FIXTURE, 'beats').length, 0, '樣例透過 beats 校驗');
ok(gateReport(FIXTURE).every((g) => g.ok), '樣例全部品質門透過');
eq(gateReport(FIXTURE).length, 13, '品質門共 13 項');
eq(STAGES.join(','), 'skeleton,beats,full', '三檔 stage');
ok(ADAPT_MODES.includes('抽核'), '改編幅度列舉');

/* ---------------- 品質門逐項擊穿 ---------------- */
// 每一道門都要證明它真的會攔——不然就是永遠為真的假測試

// G1a–G1c 角色分檔上限
{
  const o = clone();
  for (let i = 6; i <= 9; i++) {
    o.characters.push({ id: `C0${i}`, name: `主角${i}`, tier: 'lead', role: '主', arc: '有弧', from: ['原創'] });
    o.episodes[0].characterIds.push(`C0${i}`);
  }
  ok(!gate(o, 'lead-cap').ok, '6 個主角被攔（上限 5）');
  ok(gate(o, 'support-cap').ok, '配角檔不受主角檔超限影響');
  ok(validateOutline(o).some((x) => x.includes('主角組') && x.includes('超過上限')), 'validate 報主角組超限');
}
{
  const o = clone();
  for (let i = 6; i <= 16; i++) {
    o.characters.push({ id: `C${String(i).padStart(2, '0')}`, name: `夥計${i}`, tier: 'functional', role: '功能', from: ['原創'] });
    o.episodes[0].characterIds.push(`C${String(i).padStart(2, '0')}`);
  }
  ok(!gate(o, 'functional-cap').ok, '11 個功能性角色被攔（上限 10）');
}
{
  const o = clone();
  o.characters.forEach((c) => { if (c.tier === 'lead') c.tier = 'support'; });
  ok(!gate(o, 'lead-cap').ok, '一個主角都沒有也被攔——沒有主角的劇不成立');
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('沒有主角組')), 'skeleton 檔就報缺主角');
}

// 閾值可覆蓋
{
  const o = clone();
  o.params.thresholds = { maxLeads: 1 };
  ok(!gate(o, 'lead-cap').ok, '閾值收緊到 1，2 個主角就超');
  eq(DEFAULT_THRESHOLDS.maxLeads, 5, '主角組預設上限 5');
  eq(DEFAULT_THRESHOLDS.maxSupport, 10, '重要配角預設上限 10');
  eq(DEFAULT_THRESHOLDS.maxFunctional, 10, '功能性角色預設上限 10');
}

// 分檔的結構規則
{
  const o = clone();
  o.characters[0].tier = 'boss';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('tier')), '未知 tier 被攔');
}
{
  const o = clone();
  delete o.characters[0].arc; // 沈知微是 lead
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('arc')), '主角缺人物弧被攔');
}
{
  const o = clone();
  delete o.characters[4].arc; // 更夫是 functional，本來就沒有 arc 欄位
  eq(validateOutline(o, 'skeleton').length, 0, '功能性角色不要求人物弧——醫生就是來縫針的');
}

// G2 主場景上限——隨集數動態：clamp(4 + ⌈集數/10⌉, 5, 15)
// 這是 AI 短劇的數：場景是生成的沒有搭景錢，上限守的是一致性資產和空間認知
eq(primarySceneCap(6), 5, '6 集微型劇給 5 個主場景');
eq(primarySceneCap(20), 6, '20 集給 6');
eq(primarySceneCap(30), 7, '30 集給 7');
eq(primarySceneCap(60), 10, '60 集給 10');
eq(primarySceneCap(100), 14, '100 集給 14');
eq(primarySceneCap(200), 15, '再長也封頂 15');
eq(primarySceneCap(undefined), 8, '沒有集數資訊給居中值 8');
{
  const o = clone(); // 夾具 6 集 → 上限 5
  for (let i = 4; i <= 9; i++) o.scenes.push({ id: `S0${i}`, name: `景${i}`, primary: true });
  o.episodes[0].sceneIds.push('S04', 'S05', 'S06', 'S07', 'S08', 'S09');
  ok(!gate(o, 'scene-cap').ok, '6 集的劇開 8 個主場景被攔');
  ok(gate(o, 'scene-cap').label.includes('≤ 5'), '門的標籤顯示動態算出的上限');
  o.params.episodes = 60; // 只為驗證上限跟著集數走——集數變了其他門會另行報錯
  ok(gate(o, 'scene-cap').ok, '同樣 8 個主場景，60 集就放行');
  o.params.episodes = 6;
  o.params.thresholds = { maxPrimaryScenes: 9 };
  ok(gate(o, 'scene-cap').ok, '顯式覆蓋優先於動態值——放寬');
  o.params.thresholds = { maxPrimaryScenes: 3 };
  o.params.episodes = 60;
  ok(!gate(o, 'scene-cap').ok, '顯式覆蓋優先於動態值——收緊也一樣');
}

// G3 一次性場景沒有規避方案
{
  const o = clone();
  delete o.scenes[2].reusePlan; // S03 只用了一次
  ok(!gate(o, 'once-scene').ok, '一次性場景缺規避方案被攔');
  ok(gate(o, 'once-scene').detail.includes('蘆葦'), '報錯點名是哪個場景');
}

// G4 爽點間隔
{
  const o = clone();
  o.beats = o.beats.filter((b) => b.id !== 'B02'); // 1 → 5 之間斷檔
  ok(!gate(o, 'beat-gap').ok, '第 1–5 集斷檔被攔');
  ok(gate(o, 'beat-gap').detail.includes('斷檔'), '報的是斷檔');
}
{
  const o = clone();
  o.beats.forEach((b) => (b.episode = Math.min(b.episode + 3, 6)));
  o.beats[0].episode = 4; // 開頭真空
  ok(!gate(o, 'beat-gap').ok, '開頭 3 集真空被攔');
}
{
  const o = clone();
  o.beats = o.beats.filter((b) => b.episode <= 3);
  ok(!gate(o, 'beat-gap').ok, '結尾真空被攔');
  // beats 檔就要攔住間隔問題，不能等寫完分集才發現
  ok(validateOutline(o, 'beats').some((x) => x.includes('爽點間隔')), 'beats 檔就報間隔');
}

// G5 第 1 集鉤子
{
  const o = clone();
  o.episodes[0].hook = ' ';
  ok(!gate(o, 'ep1-hook').ok, '第 1 集沒鉤子被攔');
}

// G6 大爆點時機
{
  const o = clone();
  o.beats.forEach((b) => (b.weight = 'minor'));
  o.beats[3].weight = 'major'; // 唯一 major 在第 6 集（最後一集）
  ok(!gate(o, 'major-early').ok, 'major 只在最後一集被攔');
  ok(validateOutline(o, 'beats').some((x) => x.includes('大爆點')), 'beats 檔就報大爆點');
}
{
  const o = clone();
  o.beats.forEach((b) => (b.weight = 'minor'));
  ok(!gate(o, 'major-early').ok, '一個 major 都沒有也被攔');
}

// G7 三欄齊全
{
  const o = clone();
  o.episodes[3].suspense = '';
  ok(!gate(o, 'ep-fields').ok, '缺懸念欄被攔');
  ok(gate(o, 'ep-fields').detail.includes('4'), '報錯點名第 4 集');
}

// G8 同框拆解
{
  const o = clone();
  delete o.episodes[0].crowdPlan; // 第 1 集 4 人同框
  ok(!gate(o, 'crowd-plan').ok, '三人以上沒有拆解方案被攔');
}
{
  const o = clone();
  o.episodes[1].characterIds = ['C01', 'C04']; // 兩個人不需要
  delete o.episodes[1].crowdPlan;
  ok(gate(o, 'crowd-plan').ok, '兩人同框不強制拆解方案');
}

// G9 生成難點預警
{
  const o = clone();
  o.episodes[2].synopsis += '雨點砸在船篷上。';
  ok(!gate(o, 'risk-flag').ok, '梗概出現雨戲沒進預警被攔');
  o.episodes[2].warnings = ['雨戲'];
  ok(gate(o, 'risk-flag').ok, '標了預警就放行');
}
ok(Object.keys(RISK_PATTERNS).length === 4, '四類生成難點');
ok(RISK_PATTERNS['肢體接觸'].test('兩人擁抱'), '擁抱觸發肢體接觸');
ok(RISK_PATTERNS['人群'].test('集市上'), '集市觸發人群');

// G10 引用完整
{
  const o = clone();
  o.episodes[0].sceneIds.push('S99');
  ok(!gate(o, 'refs').ok, '引用不存在的場景被攔');
}
{
  const o = clone();
  o.episodes.forEach((e) => (e.characterIds = e.characterIds.filter((id) => id !== 'C04')));
  o.episodes[0].characterIds = ['C01', 'C02', 'C03'];
  ok(!gate(o, 'refs').ok, '失業角色被攔');
  ok(gate(o, 'refs').detail.includes('C04'), '報錯點名失業的是誰');
}
{
  const o = clone();
  o.episodes.forEach((e) => (e.sceneIds = e.sceneIds.filter((id) => id !== 'S03')));
  ok(!gate(o, 'refs').ok, '空轉場景被攔');
}
{
  const o = clone();
  o.beats[0].episode = 99;
  ok(!gate(o, 'refs').ok, '爽點落在不存在的集被攔');
}

// G11 敘述體
{
  const o = clone();
  o.episodes[1].synopsis = '胡二爺說：「你這箱子裡是金條吧。」';
  ok(!gate(o, 'no-dialogue').ok, '梗概裡寫對白被攔');
}
{
  const o = clone();
  o.episodes[1].hook = '他說“跟我走”算不算威脅';
  ok(!gate(o, 'no-dialogue').ok, '彎引號也被攔');
}

/* ---------------- validate 結構檢查 ---------------- */

ok(validateOutline(null).length === 1, 'null 直接報');
{
  const o = clone();
  o.params.adaptMode = '魔改';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('adaptMode')), '未知改編幅度被攔');
}
{
  const o = clone();
  o.params.genre = '';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('genre')), '題材缺失被攔——它決定爽點型別');
}
{
  const o = clone();
  o.adaptation.cut = [];
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('沒砍')), '抽核卻一條沒砍被攔');
  o.params.adaptMode = '忠實';
  ok(!validateOutline(o, 'skeleton').some((x) => x.includes('沒砍')), '忠實改編允許不砍');
}
{
  const o = clone();
  o.characters[0].id = 'X1';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('C01 這種格式')), '角色 id 格式被攔');
}
{
  const o = clone();
  o.characters[1].id = 'C01';
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('重複')), '角色 id 重複被攔');
}
{
  const o = clone();
  o.characters[0].from = [];
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('改動記錄')), '缺 ← 改動記錄被攔');
}
{
  const o = clone();
  delete o.scenes[0].primary;
  ok(validateOutline(o, 'skeleton').some((x) => x.includes('primary')), '場景缺 primary 被攔');
}
{
  const o = clone();
  o.beats[0].weight = 'huge';
  ok(validateOutline(o, 'beats').some((x) => x.includes('weight')), '未知 weight 被攔');
}
{
  const o = clone();
  o.beats[0].setup = '';
  ok(validateOutline(o, 'beats').some((x) => x.includes('setup')), '爽點缺鋪墊被攔');
}
{
  const o = clone();
  o.episodes.pop();
  ok(validateOutline(o).some((x) => x.includes('說好 6 集')), '集數對不上被攔');
}
{
  const o = clone();
  o.episodes[2].ep = 9;
  ok(validateOutline(o).some((x) => x.includes('編號必須從 1 連續')), '集號斷裂被攔');
}

// stage 分檔：skeleton 不看 beats/episodes
{
  const o = clone();
  delete o.beats;
  delete o.episodes;
  eq(validateOutline(o, 'skeleton').length, 0, 'skeleton 檔不要求 beats/episodes');
  ok(validateOutline(o, 'beats').some((x) => x.includes('beats 為空')), 'beats 檔要求爽點表');
  ok(validateOutline(o, 'full').length > 0, 'full 檔要求全部');
}

/* ---------------- 資產清單 ---------------- */

const assets = computeAssets(FIXTURE);
eq(assets.scenes.length, 3, '資產清單收全部場景');
{
  const s01 = assets.scenes.find((s) => s.id === 'S01');
  eq(s01.uses, 6, 'S01 每集都用');
  eq(s01.episodes.join(','), '1,2,3,4,5,6', 'S01 出現集列表');
  const s03 = assets.scenes.find((s) => s.id === 'S03');
  eq(s03.uses, 1, 'S03 只用一次');
  ok(s03.reusePlan, '一次性場景帶著複用方案');
}
{
  const c04 = assets.characters.find((c) => c.id === 'C04');
  eq(c04.uses, 6, '胡二爺每集都在');
  const c02 = assets.characters.find((c) => c.id === 'C02');
  eq(c02.episodes.join(','), '1,2,3,4,6', '陸行遠第 5 集缺席');
}
// 角色資產量折算：按檔算出來的，不讓模型寫
{
  const plan = Object.fromEntries(assets.castPlan.map((t) => [t.tier, t]));
  eq(plan.lead.count, 2, '主角組 2 人');
  eq(plan.support.count, 2, '重要配角 2 人');
  eq(plan.functional.count, 1, '功能性角色 1 人');
  ok(plan.lead.spec.includes('設定圖'), '主角組折算成全套設定圖');
  ok(plan.functional.spec.includes('提示詞'), '功能性角色折算成提示詞直出');
  ok(plan.functional.names.includes('岸上挑燈的更夫'), '折算錶帶名單');
}
eq(assets.warnings['人群'].join(','), '2', '預警清單按型別彙總');
eq(assets.beatsByType['身份揭破'].join(','), '3', '爽點按型別彙總落點');

/* ---------------- render markdown ---------------- */

const md = renderMarkdown(FIXTURE);
ok(md.startsWith('# 渡口 · 短劇改編大綱'), 'MD 標題');
ok(md.includes('6 集 × 2 分鐘'), 'MD 帶參數行');
for (const sec of ['一、改編說明', '二、人物表', '三、爽點表', '四、分集梗概', '五、資產清單']) {
  ok(md.includes(sec), `MD 有${sec}`);
}
ok(md.includes('（由分集資料自動彙總）'), 'MD 標明資產清單是算出來的');
ok(md.includes('【鉤子】'), 'MD 鉤子欄');
ok(md.includes('【懸念】'), 'MD 懸念欄');
ok(md.includes('✅'), 'MD 帶品質門結果');
ok(md.includes('合併：岸邊問路的路人甲乙'), 'MD 人物錶帶 ← 改動記錄');
ok(md.includes('主角組'), 'MD 人物錶帶層級');
ok(md.includes('角色資產量折算'), 'MD 資產清單帶按檔折算');
// 人物表按檔排序：主角組在前
ok(md.indexOf('| C01 |') < md.indexOf('| C05 |'), '主角排在功能性角色前面');

/* ---------------- render html ---------------- */

const html = renderHtml(FIXTURE);
ok(html.startsWith('<!doctype html>'), 'HTML 完整檔案');
ok(!/<script\s+src=/.test(html), '不引外部程式');
ok(!/<link\s/.test(html), '不引外部樣式');
ok(!/@import|url\(https?:/.test(html), 'CSS 不拉外部資源');
// 反向驗證：檢測正則本身要抓得到東西
ok(/<script\s+src=/.test('<script src="x.js">'), '外部程式檢測正則有效');

eq((html.match(/class="ep" /g) || []).length, 6, '6 張分集卡');

// KPI 帶：六張統計卡
eq((html.match(/class="kpi[ "]/g) || []).length, 6, 'KPI 帶 6 張卡');
ok(html.includes('總集數') && html.includes('生成難點'), 'KPI 卡有標籤');
ok(html.includes('主角 2 · 配角 2 · 功能 1'), '角色卡按檔報數');

// 關鍵決策：拍板三件事落進紙面
ok(html.includes('關鍵決策'), '有關鍵決策區塊');
ok(html.includes('砍了哪條線') && html.includes('合了哪些人') && html.includes('大爆點落在第幾集'), '決策三欄齊全');
ok(html.includes('5 個角色位（主角組 2 · 重要配角 2 · 功能性 1）'), '角色位統計是算出來的');
ok(html.includes('主角組：沈知微、陸行遠'), '主角組名單是算出來的');
ok(html.includes('這意味著：全劇困在渡口一夜之內'), 'cutNote 結論句渲染出來');
ok(/<i>ep3<\/i>/.test(html) && /<i>ep5<\/i>/.test(html), '大爆點列表帶集號');
ok(html.includes('首個') && html.includes('終局'), '首末大爆點有標記');

// 爽點節奏：時間軸（不是格子條也不是柱狀圖）
eq((html.match(/class="bdot/g) || []).length, 4, '時間軸 4 個爽點節點');
eq((html.match(/class="bdot major"/g) || []).length, 2, '2 個大爆點實心節點');
eq((html.match(/class="tick"/g) || []).length, 6, '6 個集刻度');
ok(html.includes('class="gapnote"'), '空檔標在軸上');
ok(html.includes('1 集空檔'), '空檔標註帶集數');
// 空檔超閾值要變鐵鏽紅
{
  const o = clone();
  o.params.episodes = 9;
  o.beats.find((b) => b.id === 'B04').episode = 9;
  o.episodes.push(
    { ep: 7, synopsis: '過渡。', hook: 'x', suspense: 'y', sceneIds: ['S01'], characterIds: ['C01'] },
    { ep: 8, synopsis: '過渡。', hook: 'x', suspense: 'y', sceneIds: ['S01'], characterIds: ['C01'] },
    { ep: 9, synopsis: '收束。', hook: 'x', suspense: 'y', sceneIds: ['S01'], characterIds: ['C01'] },
  );
  o.episodes[5].synopsis = '霧還沒散。';
  ok(renderHtml(o).includes('class="gapnote bad"'), '超閾值空檔標成鐵鏽紅');
}
// 長劇折行：60 集兩行以上的軸
{
  const o = clone();
  o.params.episodes = 40;
  ok(/viewBox="0 0 1520 352"/.test(renderHtml(o)), '40 集折成兩行軸（每行 20 集）');
}

// 爽點節奏：圖 / 表 tab，預設時間軸
eq((html.match(/class="tab[ "]/g) || []).length, 2, '兩個 tab');
ok(html.includes('class="tab on" data-pane="pane-timeline"'), '預設選中時間軸');
ok(html.includes('class="tabpane on" id="pane-timeline"'), '時間軸面板預設顯示');
ok(html.includes('class="tabpane" id="pane-table"'), '明細表面板預設隱藏');
ok(html.includes("p.id === btn.dataset.pane"), 'tab 切換程式在');
ok(/@media print\{[\s\S]*\.tabpane\{display:block!important/.test(html), '輸出時兩個面板都出');

// 分集概覽：預設前三集 + 漸隱 + 展開
ok(html.includes('>分集概覽<'), '區塊改名分集概覽');
ok(html.includes('class="epswrap clip"'), '超過 3 集預設收起');
ok(html.includes('.epswrap.clip .eps .ep:nth-child(n+4){display:none}'), '收起態只顯示前三張卡');
ok(html.includes('class="epsmore"'), '有展開按鈕');
ok(html.includes('▾ 展開全部 6 集'), '按鈕標明總集數');
ok(/linear-gradient\(180deg,transparent,var\(--paper\)\)/.test(html), '收起態底部漸隱');
ok(/epsMore\.remove\(\)/.test(html), '點一下展開且按鈕消失');
ok(/@media print\{[\s\S]*\.epswrap\.clip \.eps \.ep\{display:block!important/.test(html), '輸出時分集全展開');
{
  const o = clone();
  o.params.episodes = 3;
  o.episodes = o.episodes.slice(0, 3);
  o.beats = o.beats.filter((b) => b.episode <= 3);
  const short = renderHtml(o);
  ok(!short.includes('class="epswrap clip"'), '3 集以內不收起');
  ok(!short.includes('class="epsmore"'), '3 集以內沒有展開按鈕');
}

// 每集排程矩陣：角色 + 場景同一張網格
ok(html.includes('每集排程矩陣'), '有排程矩陣');
eq((html.match(/class="mc[ "]/g) || []).length, (5 + 3) * 6, '矩陣格數 =（角色+場景）× 集數');
ok(html.includes('場　景'), '矩陣裡有場景分帶');
ok(html.includes('1 ⚠'), '一次性場景在合計列帶警示');

// 場景概覽卡
eq((html.match(/class="scard"/g) || []).length, 3, '每個場景一張卡');
ok(html.includes('>1–6<'), '連續出現集合寫成區間');
ok(html.includes('>1 · 6<'), '離散出現集用間隔點');
ok(html.includes('承載爽點'), '場景卡帶承載爽點');
ok(html.includes('出場角色'), '主場景卡帶出場角色');
eq(fmtEps([1, 2, 3]), '1–3', 'fmtEps 連續區間');
eq(fmtEps([1, 6]), '1 · 6', 'fmtEps 離散間隔點');
eq(fmtEps([5]), '5', 'fmtEps 單集');
eq(fmtEps([]), '—', 'fmtEps 空');
eq(fmtEps([1, 3, 5, 7, 9]), '5 集', 'fmtEps 太散只報數量');

// 資產量折算：場景環境和生成難點也摺進去
ok(html.includes('場景環境'), '折算錶帶場景環境行');
ok(html.includes('人群 ×1（第 2 集）'), '折算錶帶生成難點明細');

// 區塊順序：節奏 → 分集概覽 → 場景概覽 → 決策 → 排程矩陣 → 折算 → 人物 → 改編說明 → 品質門
{
  const order = ['>爽點節奏<', '>分集概覽<', '>場景概覽<', '>關鍵決策<', '>每集排程矩陣<', '>資產量折算<', '>人物表<', '>改編說明<', '>品質門<'];
  const idx = order.map((s) => html.indexOf(s));
  ok(idx.every((v) => v >= 0) && idx.every((v, i) => i === 0 || v > idx[i - 1]), '區塊順序正確');
}

ok((html.match(/class="gate"/g) || []).length === 1, '品質門清單');
eq((html.match(/<li class="ok">/g) || []).length, 13, '13 項品質門全 ✓');
ok(html.includes('全部透過'), '透過時有總結行');
ok(html.includes('gatepill pass'), '頁首徽章是透過態');

// 品質門失敗也要渲染出來——體檢模式靠這個給診斷
{
  const o = clone();
  o.episodes[0].hook = '';
  const bad = renderHtml(o);
  ok(bad.includes('<li class="bad">'), '未過的門標 ✗');
  // 抹掉第 1 集鉤子會連坐兩道門：ep1-hook + 三欄齊全
  ok(bad.includes('2 項未過'), '總結行報未過數');
  ok(bad.includes('gatepill fail'), '頁首徽章變失敗態');
  ok(bad.includes('class="galert"'), 'KPI 帶下面彈出病灶橫幅');
}

// 匯出：內嵌的就是 outline.json 原樣
ok(html.includes('<script type="application/json" id="outline-data">'), '資料內嵌');
ok(html.includes('data-name="渡口-outline.json"'), '下載檔名跟書名');
{
  const embedded = html.match(/<script type="application\/json" id="outline-data">([\s\S]*?)<\/script>/)[1];
  const round = JSON.parse(embedded.replace(/\\u003c/g, '<'));
  eq(JSON.stringify(round), JSON.stringify(FIXTURE), '匯出資料與 outline.json 逐位元組一致');
  eq(validateOutline(round).length, 0, '匯出資料能直接重新匯入 validate');
}
ok(html.includes('revokeObjectURL(url), 10000'), 'blob 延後回收——Safari 搶跑會存出空檔案');

// XSS：大綱是模型生成的，一律轉義
{
  const o = clone();
  o.episodes[0].synopsis = '<img src=x onerror=alert(1)>';
  o.characters[0].name = '<b>沈</b>';
  const evil = renderHtml(o);
  ok(!evil.includes('<img src=x'), '梗概裡的 HTML 被轉義');
  ok(!evil.includes('<b>沈</b>'), '人名裡的 HTML 被轉義');
}
// </script 會截斷內嵌資料塊
{
  const o = clone();
  o.adaptation.core = '他說</script><script>alert(1)</script>了嗎';
  const x = renderHtml(o).match(/id="outline-data">([\s\S]*?)<\/script>/)[1];
  ok(!x.includes('</script'), '資料塊裡的 </script 被轉義');
  eq(JSON.parse(x.replace(/\\u003c/g, '<')).adaptation.core, o.adaptation.core, '轉義了但內容沒丟');
}

ok(html.includes('@media print'), '可輸出');
ok(html.includes('prefers-reduced-motion'), '尊重減少動效');
ok(html.includes('原文依據'), '改編說明的證據列渲染出來');
ok(html.includes('霧一厚，連自己的手都看不清。'), '逐字證據進了報告');

eq(DEFAULT_PER_VOLUME, 15, '預設每卷 15 章');

console.log(`✓ ${passed} 項自測全部透過`);
