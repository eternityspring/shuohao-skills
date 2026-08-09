#!/usr/bin/env node
// 自測：覆蓋 novel-characters.mjs 裡所有確定性邏輯。
// 不呼叫任何模型，不花額度，跑一次 < 1 秒。
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
// 正規化換行：Windows 上 git 會把樣例 checkout 成 CRLF，而 chunkText 內部
// 已經把 \r\n 換成 \n。不在這裡對齊，斷言就會拿 CRLF 原文去比對 LF 的塊，
// 在 Windows 全線報錯，在 macOS／Linux 卻看不出來。
const SOURCE = readFileSync(join(examples, '渡口.txt'), 'utf8').replace(/\r\n/g, '\n');
const CAST = JSON.parse(readFileSync(join(examples, '渡口-cast.json'), 'utf8')).characters;

let passed = 0;
function ok(condition, label) {
  assert.ok(condition, label);
  passed += 1;
}
function eq(actual, expected, label) {
  assert.equal(actual, expected, `${label} — 期望 ${expected}，實際 ${actual}`);
  passed += 1;
}

/* ---------------- chunkText ---------------- */

eq(chunkText('').length, 0, '空文字不產生塊');
eq(chunkText('   \n  ').length, 0, '純空白不產生塊');
eq(chunkText(SOURCE).length, 1, '短故事只有一塊');

const long = SOURCE.repeat(40);
const chunks = chunkText(long);
ok(chunks.length > 1, '長文字會切成多塊');
ok(chunks.every((c) => c.length <= CHUNK_SIZE), `沒有塊超過 CHUNK_SIZE(${CHUNK_SIZE})`);
ok(long.includes(chunks[0].slice(0, 200)), '塊內容來自原文');
// 相鄰塊必須重疊，否則卡在切口上的角色會兩邊都漏
ok(chunks[1].includes(chunks[0].slice(-100).slice(0, 40)), '相鄰塊有重疊');
// 覆蓋率：把所有塊拼起來（去重疊後）應該蓋住絕大部分原文
const covered = chunks.reduce((sum, c) => sum + c.length, 0);
ok(covered >= long.length, '所有塊加起來覆蓋全文（含重疊）');

const huge = SOURCE.repeat(500);
ok(chunkText(huge).length <= MAX_CHUNKS, `超長文字被 MAX_CHUNKS(${MAX_CHUNKS}) 截斷而不是無限切`);

/* ---------------- mergeRoster ---------------- */

// 跨塊用不同稱呼發現同一個人，必須收斂成一條
const merged = mergeRoster([
  [{ name: '陸行遠', aliases: ['陸'], note: '瘦，顴骨高。', quotes: ['他的臉很瘦，顴骨很高'] }],
  [{ name: '陸', aliases: [], note: '眉骨有疤。', quotes: ['右邊眉骨上有一道兩寸長的舊疤。', '他的臉很瘦，顴骨很高'] }],
  [{ name: '沈知微', aliases: ['姑娘'], note: '兩條辮子。', quotes: [] }],
]);
eq(merged.length, 2, '別名跨塊歸併');
const lu = merged.find((c) => c.name === '陸行遠');
ok(lu, '保留出現次數最多的規範名');
eq(lu.notes.length, 2, 'notes 累加');
ok(lu.aliases.includes('陸'), '別名被記錄');
eq(lu.quotes.length, 2, 'quotes 合併且去重');

// 先看到別名、後看到本名，也要能合併
const reverse = mergeRoster([
  [{ name: '姑娘', aliases: [], note: 'a', quotes: [] }],
  [{ name: '沈知微', aliases: ['姑娘'], note: 'b', quotes: [] }],
]);
eq(reverse.length, 1, '別名先出現也能歸併');
eq(reverse[0].notes.length, 2, '歸併後兩條 note 都在');

eq(
  mergeRoster([[{ name: 'Ishmael', aliases: [], note: 'a', quotes: [] }], [{ name: 'ishmael', aliases: [], note: 'b', quotes: [] }]]).length,
  1,
  '拉丁名大小寫不敏感',
);

// 出現的塊數越多排越前 —— 這是戲份權重的唯一依據
const ranked = mergeRoster([
  [{ name: '甲', aliases: [], note: '1', quotes: [] }, { name: '乙', aliases: [], note: '1', quotes: [] }],
  [{ name: '乙', aliases: [], note: '2', quotes: [] }],
  [{ name: '乙', aliases: [], note: '3', quotes: [] }],
]);
eq(ranked[0].name, '乙', '按出現塊數降序排列');

// 髒資料不能讓整個流程崩掉
eq(mergeRoster([[]]).length, 0, '空批次不報錯');
eq(mergeRoster([[{ name: '甲' }]]).length, 1, '缺 aliases/notes/quotes 欄位也能處理');
eq(mergeRoster([[{ note: '沒名字' }]]).length, 0, '沒有 name 的條目被丟棄');

/* ---------------- slug ---------------- */

eq(slug('胡二爺'), '胡二爺', '中文名原樣保留');
eq(slug('a/b:c*d'), 'a-b-c-d', '路徑危險字元被替換');
eq(slug('  x  '), 'x', '兩端空白被去掉');
eq(slug(''), 'character', '空名有兜底');

/* ---------------- validateCast ---------------- */

eq(validateCast(CAST, SOURCE).length, 0, '自帶樣例通過全部校驗');
ok(validateCast([], SOURCE).length > 0, '空 cast 報錯');

const clone = () => JSON.parse(JSON.stringify(CAST));
const hits = (cast, keyword) => validateCast(cast, SOURCE).filter((p) => p.includes(keyword)).length;

// 這四類是模型真實犯過的錯，每一類都必須抓住
let bad = clone();
bad[0].persona.evidence[0] = 'She was nineteen years old.';
ok(hits(bad, '逐字片段') > 0, '抓住意譯的引文');

bad = clone();
bad[0].image.prompt = `${bad[0].name}, ${bad[0].image.prompt}`;
ok(hits(bad, '人名') > 0, '抓住生圖提示詞裡的人名');

bad = clone();
bad[0].image.promptLocal = `${bad[0].aliases[0]}的設定圖`;
ok(hits(bad, '人名') > 0, '抓住本地語言生圖提示詞裡的別名');

bad = clone();
bad[0].image.sheet = `${bad[0].name}, a model sheet`;
ok(hits(bad, '人名') > 0, '抓住設定圖提示詞裡的人名');

bad = clone();
bad[0].voice.timbre = 'warm husky alto';
ok(hits(bad, '應為中文') > 0, '抓住該中文卻寫成英文的欄位');

bad = clone();
bad[0].image.sheet = '中文設定圖描述';
ok(hits(bad, '必須英文') > 0, '抓住該英文卻含中文的欄位');

bad = clone();
bad[0].importance = 'sidekick';
ok(hits(bad, 'importance') > 0, '抓住 importance 列舉越界');

bad = clone();
delete bad[0].image.sheet;
ok(hits(bad, 'image.sheet') > 0, '抓住缺失的設定圖提示詞');

bad = clone();
delete bad[0].persona;
ok(hits(bad, 'persona') > 0, '抓住缺失的 persona');

// 沒有原文時應該跳過逐字校驗而不是全判失敗
eq(validateCast(CAST, null).length, 0, '不給原文時跳過引文校驗');

/* ---------------- render ---------------- */

const md = renderMarkdown(CAST, '渡口');
ok(md.includes('# 渡口 — 角色表'), 'Markdown 有標題');
for (const c of CAST) ok(md.includes(`## ${c.name}`), `Markdown 包含 ${c.name}`);
// 預設語言是 zh-TW，所以不傳 lang 時介面文案該是正體
ok(md.includes('角色設定圖提示詞'), 'Markdown 預設用正體介面文案');
ok(
  renderMarkdown(CAST, '渡口', '', 'zh').includes('角色设定图提示词'),
  'Markdown 顯式指定 zh 時用簡體介面文案',
);
ok(renderMarkdown(CAST, 'Ferry', '', 'en').includes('# Ferry — Cast'), 'Markdown 跟隨語言引數');

const html = renderHtml(CAST, '渡口');
ok(html.startsWith('<!doctype html>'), 'HTML 是完整文件');
// 三欄工作台：頂欄 + 左欄角色列表 + 主區一次一個角色
eq((html.match(/class="char[ "]/g) || []).length, CAST.length, `主區有 ${CAST.length} 個角色`);
eq((html.match(/class="rost[ "]/g) || []).length, CAST.length, `左欄列出 ${CAST.length} 個角色`);
eq((html.match(/class="char on"/g) || []).length, 1, '預設只展開第一個角色');
eq((html.match(/class="rost on"/g) || []).length, 1, '左欄預設選中第一個');
// 每人 7 個複製按鈕：生圖 本地/EN/設定圖/反向 + 音色 本地/EN + 整份 JSON
// 用 class="copy 字首匹配——整份 JSON 那個是 class="copy wide"
eq((html.match(/class="copy[ "]/g) || []).length, CAST.length * 7, '每段提示詞都有複製按鈕');
eq((html.match(/class="copy wide"/g) || []).length, CAST.length, '每個角色有整份 JSON 按鈕');
ok(html.includes('id="q"'), '頂欄有搜尋框');
// 搜尋靠 data-hay，裡面必須包含名字、別名、身份、特質——標籤上是這麼寫的
for (const c of CAST) {
  const m = html.match(new RegExp(`data-hay="([^"]*)"[^>]*>[\\s\\S]{0,400}?${c.name}`));
  ok(html.includes(`data-hay=`), 'roster 帶搜尋索引');
}
const hay = [...html.matchAll(/data-hay="([^"]*)"/g)].map((m) => m[1]).join(' ');
for (const c of CAST) {
  ok(hay.includes(c.name), `搜尋索引含 ${c.name}`);
  if (c.persona.identity) ok(hay.includes(c.persona.identity.slice(0, 6)), `搜尋索引含 ${c.name} 的身份`);
  for (const tr of c.persona.personality) ok(hay.includes(tr), `搜尋索引含特質「${tr}」`);
}
ok(html.includes('<blockquote>'), '原文依據用 blockquote');
// 四種寫法都要認：半形/全形 × 推斷/inferred
for (const marker of ['（推斷）', '(inferred)', '（inferred）', '(推斷)']) {
  const t = clone();
  t[0].persona.appearance = '身形單薄' + marker + '。';
  ok(renderHtml(t, 'x').includes('class="inf"'), `推斷標記 ${marker} 被高亮`);
}
ok(html.includes('prefers-reduced-motion'), '尊重減少動效');
ok(html.includes('@media print'), '可列印');
// 自包含：不能有任何外部請求
ok(!/<script\s+src=/.test(html), 'HTML 不引用外部腳本');
ok(!/<link\s/.test(html), 'HTML 不引用外部樣式');
// 反向驗證：上面兩條正則本身要真的能抓到東西，否則是永遠為真的假測試
ok(/<script\s+src=/.test('<script src="x.js">'), '外部腳本檢測正則有效');
ok(/<link\s/.test('<link rel="stylesheet">'), '外部樣式檢測正則有效');
ok(!/@import|url\(https?:/.test(html), 'CSS 不拉外部資源');

// 沒有三視圖時要有佔位而不是空白
ok(renderHtml(CAST, 'x').includes('plate-empty'), '缺圖時顯示佔位');
const withShot = clone();
withShot[0].sheetImage = 'images/x.png';
const shotHtml = renderHtml(withShot, 'x');
ok(shotHtml.includes('<img src="images/x.png"'), '主區嵌入設定圖');
ok(shotHtml.includes("background-image:url('images/x.png')"), '左欄縮圖用同一張圖的切片');

// XSS：角色資料是模型生成的，不能直接拼進 HTML
const evil = clone();
evil[0].name = '<img src=x onerror=alert(1)>';
const evilHtml = renderHtml(evil, 'x');
ok(!evilHtml.includes('<img src=x onerror'), '角色欄位裡的 HTML 被轉義');

// 故事摘要
const DOC = JSON.parse(readFileSync(join(examples, '渡口-cast.json'), 'utf8'));
ok(DOC.summary && DOC.summary.trim(), '樣例帶故事摘要');
ok(renderHtml(CAST, '渡口', DOC.summary).includes('class="synopsis"'), 'HTML 頂部渲染摘要');
ok(!renderHtml(CAST, '渡口', '').includes('class="synopsis"'), '沒有摘要時不留空殼');
ok(renderMarkdown(CAST, '渡口', DOC.summary).includes('## 故事摘要'), 'Markdown 也帶摘要');
ok(renderHtml(CAST, '渡口', '<b>x</b>').includes('&lt;b&gt;'), '摘要裡的 HTML 被轉義');

// 佈局骨架
const css = renderHtml(CAST, 'x');
ok(/\.shell\{[^}]*grid-template-columns:var\(--side-w\)/.test(css), '左欄 + 主區兩欄骨架');
ok(/\.upper\{[^}]*grid-template-columns:minmax\(0,1fr\) 340px/.test(css), '主區內是內容 + 資訊卡兩欄');
ok(/\.prompts\{[^}]*grid-template-columns:1fr 1fr/.test(css), '提示詞分左右兩組');
ok(css.includes('.char{display:none}'), '預設只顯示選中的角色');
ok(/\.main\{[^}]*max-width:1500px/.test(css), '主區最大寬度 1500px');
// 縮圖用精靈圖裁設定圖左欄——設定圖 16:9、左欄約 34%，放大 1/0.34≈294% 左上對齊
ok(/\.rost-thumb\{[^}]*background-size:294% auto/.test(css), '縮圖按 294% 裁左欄');
ok(/\.rost-thumb\{[^}]*no-repeat left top/.test(css), '縮圖左上對齊');
ok(!/\.rost-thumb img/.test(css), '縮圖不再用 img 拉伸');
// 螢幕上一次一個，列印時必須全展開，否則打出來只有一個角色
ok(/@media print\{[\s\S]*\.char\{display:block!important/.test(css), '列印時展開全部角色');
ok(/@media print\{[\s\S]*\.pr p\{display:block!important/.test(css), '列印時展開全部提示詞');

/* ---------------- 多語言 ---------------- */

const zh = renderHtml(CAST, '渡口', DOC.summary, 'zh');
const en = renderHtml(CAST, 'Ferry', 'A misty river crossing.', 'en');

ok(zh.includes('lang="zh"'), 'zh 報告的 html lang 正確');
ok(en.includes('lang="en"'), 'en 報告的 html lang 正確');
ok(zh.includes('故事摘要') && !zh.includes('>Synopsis<'), 'zh 介面用中文');
ok(en.includes('Synopsis') && !en.includes('故事摘要'), 'en 介面用英文');
ok(en.includes('>Voice<'), 'en 的聲音卡標題翻譯了');
ok(en.includes('Search characters'), 'en 的搜尋框佔位翻譯了');
ok(en.includes('Cast · by prominence'), 'en 的角色列表標題翻譯了');
ok(/Appearance|Temperament/.test(en), 'en 的畫像小節標題翻譯了');
ok(en.includes('>Lead<'), 'en 的 importance 標籤翻譯了');
ok(en.includes('>Copy<'), 'en 的複製按鈕翻譯了');
// 未知語言碼退回英文骨架，而不是崩掉或露出中文
const fr = renderHtml(CAST, 'Bac', '', 'fr');
ok(fr.includes('lang="fr"'), '未知語言碼仍寫進 html lang');
ok(fr.includes('Synopsis') || !fr.includes('故事摘要'), '未知語言碼用英文介面骨架');
eq(strings('zh').synopsis, '故事摘要', 'strings(zh)');
eq(strings('nope').synopsis, strings('en').synopsis, 'strings 未知碼退回 en');
for (const l of ['zh-TW', 'zh', 'en', 'ja']) ok(SUPPORTED_UI_LANGS.includes(l), `內建 ${l} 介面`);

// 台灣正體內建
const tw = renderHtml(CAST, '渡口', DOC.summary, 'zh-TW');
ok(tw.includes('lang="zh-TW"'), 'zh-TW 報告的 html lang 正確');
ok(tw.includes('角色設定集') && !tw.includes('角色设定集'), 'zh-TW 介面用正體字');
ok(tw.includes('搜尋角色'), 'zh-TW 介面用搜尋，不是簡體那套的搜索');
ok(tw.includes('負向提示詞'), 'zh-TW 介面用負向提示詞，不是簡體那套的反向提示词');
ok(tw.includes('尚未生圖') || tw.includes('生圖提示詞'), 'zh-TW 介面用生圖，不是簡體那套的出图');
ok(tw.includes('依戲份排序'), 'zh-TW 用「依戲份排序」');
// 字型要跟著換，Songti SC 那串在台灣機器上多半沒裝
ok(tw.includes('Songti TC') && !tw.includes('Songti SC'), 'zh-TW 挑 TC 字型');
ok(zh.includes('Songti SC') && !zh.includes('Songti TC'), 'zh 仍挑 SC 字型');
ok(en.includes('Songti SC'), '非中文沿用原字型棧');
// 地區變體都算正體，但只有 zh-TW 有內建文案
ok(isTraditionalChinese('zh-HK') && isTraditionalChinese('zh-Hant'), 'zh-HK／zh-Hant 算正體');
ok(!isTraditionalChinese('zh') && !isTraditionalChinese('ja'), 'zh／ja 不算正體');
ok(isChinese('zh-TW') && isChinese('zh') && !isChinese('ja'), 'isChinese 認地區變體');
eq(DEFAULT_LANG, 'zh-TW', '預設語言是台灣正體');
eq(strings('zh-TW').synopsis, '故事摘要', 'strings(zh-TW)');
// zh 的各地區變體走同一條中文校驗，不該因為語言碼帶地區就報錯
eq(validateCast(CAST, SOURCE, 'zh-TW').length, 0, 'zh-TW 校驗通過');

// 日語內建
const ja = renderHtml(CAST, '渡し場', 'あらすじの本文', 'ja');
ok(ja.includes('lang="ja"'), 'ja 報告的 html lang 正確');
ok(ja.includes('あらすじ') && ja.includes('>主役<'), 'ja 介面用日文');
ok(ja.includes('登場人物 · 出番順'), 'ja 的角色列表標題翻譯了');
ok(ja.includes('検索'), 'ja 的搜尋框佔位翻譯了');

// 任意語言：ui 覆蓋機制
ok(needsUiTranslation('fr'), 'fr 需要 ui 翻譯');
ok(!needsUiTranslation('ja'), 'ja 內建，不需要 ui 翻譯');
const frUi = { synopsis: 'Résumé', groups: { voice: 'Voix' }, copy: 'Copier' };
const frHtml = renderHtml(CAST, 'Bac', 'Un matin de brume.', 'fr', frUi);
ok(frHtml.includes('Résumé'), 'ui 覆蓋生效');
ok(frHtml.includes('Voix'), 'ui 巢狀鍵覆蓋生效');
ok(frHtml.includes('>Copier<'), 'ui 覆蓋按鈕文案');
eq(strings('fr', frUi).groups.persona, 'Profile', '沒覆蓋的鍵退回英文兜底');
eq(strings('fr', frUi).persona.gender, 'Gender', '沒覆蓋的巢狀鍵也兜底');
// 髒 ui 不能把渲染帶崩
for (const junk of [null, 'x', 42, [], { groups: 'not-an-object' }, { docTitle: 'nope' }]) {
  ok(renderHtml(CAST, 'x', '', 'fr', junk).startsWith('<!doctype html>'), `髒 ui ${JSON.stringify(junk)} 不崩`);
}
// 模板要能覆蓋所有可翻譯的鍵
const tpl = uiTemplate();
for (const k of ['kicker', 'synopsis', 'groups', 'persona', 'image', 'voice', 'importance', 'copy']) {
  ok(k in tpl, `ui-template 含 ${k}`);
}
ok(!('docTitle' in tpl), 'ui-template 不含函式模板');

// 校驗的語言規則跟著 lang 走
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
  validateCast(enCast, SOURCE, 'en').filter((p) => p.includes('應為')).length === 0,
  'lang=en 時英文 voice 欄位合法',
);
ok(
  validateCast(enCast, SOURCE, 'zh').filter((p) => p.includes('應為中文')).length > 0,
  'lang=zh 時英文 voice 欄位違規',
);
ok(
  validateCast(CAST, SOURCE, 'en').filter((p) => p.includes('應為英文')).length > 0,
  'lang=en 時中文 voice 欄位違規',
);
// 機器欄位不受 lang 影響，永遠必須英文
const cjkMachine = clone();
cjkMachine[0].image.prompt = '中文生圖提示詞';
for (const l of ['zh', 'en', 'fr']) {
  ok(
    validateCast(cjkMachine, SOURCE, l).filter((p) => p.includes('必須英文')).length > 0,
    `lang=${l} 時 image.prompt 仍必須英文`,
  );
}

/* ---------------- 角色設定圖（左半身像 + 右三視圖，一張） ---------------- */

ok(CAST.every((c) => c.image.sheet && c.image.sheet.trim()), '樣例每個角色都有設定圖提示詞');
// 左右分欄和比例必須寫死在提示詞裡，否則模型會自由發揮
ok(CAST.every((c) => /LEFT ZONE/.test(c.image.sheet)), '提示詞劃出左欄');

ok(CAST.every((c) => /about 34% of the canvas width/.test(c.image.sheet)), '左欄比例寫死 34%');
// 16:9 和三區版面
ok(CAST.every((c) => /16:9/.test(c.image.sheet)), '畫布寫死 16:9');
ok(CAST.every((c) => /RIGHT-TOP ZONE/.test(c.image.sheet)), '右上是三視圖區');
ok(CAST.every((c) => /RIGHT-BOTTOM ZONE/.test(c.image.sheet)), '右下是細節區');
ok(CAST.every((c) => /thin hairline rules/.test(c.image.sheet)), '三區之間有細線分隔');
// 比例是這個版面最容易崩的地方——為了塞下細節而壓扁人物
ok(CAST.every((c) => /PROPORTIONS ARE CRITICAL/.test(c.image.sheet)), '強調比例');
ok(
  CAST.every((c) => /no stretching, squashing or foreshortening/.test(c.image.sheet)),
  '禁止拉伸壓扁人物',
);
ok(
  CAST.every((c) => /the detail studies give way, not the figures/.test(c.image.sheet)),
  '空間不夠時讓細節讓位，不動人物',
);
ok(
  CAST.every((c) => /continue them in a narrow vertical column down the right-hand edge/.test(c.image.sheet)),
  '細節放不下可延伸到右側',
);

/* ---------------- 畫風預設 ---------------- */

for (const id of ['realistic', 'ghibli', 'photoreal']) {
  ok(SUPPORTED_STYLES.includes(id), `內建 ${id} 預設`);
}
eq(stylePreset('nope').render, STYLE_PRESETS.realistic.render, '未知風格退回預設');
// 每個預設都要五塊齊全，缺一塊就會跟另一個預設混搭出四不像
for (const [id, p] of Object.entries(STYLE_PRESETS)) {
  for (const k of ['render', 'surface', 'lighting', 'negative', 'tags']) {
    ok(p[k] && p[k].length, `${id} 預設有 ${k}`);
  }
  // 內建幾套介面文案，標籤就得給幾套，否則那個語言的報告會露出別的語言
  for (const l of SUPPORTED_UI_LANGS) ok(p.label[l], `${id} 預設有 ${l} 標籤`);
}
// 這是整件事最容易搞反的地方：兩個預設的負向提示詞幾乎相反
ok(!/photorealistic|3d render/i.test(STYLE_PRESETS.realistic.negative), 'realistic 不禁寫實');
ok(/photorealistic/i.test(STYLE_PRESETS.ghibli.negative), 'ghibli 必須禁寫實');
// 寫實的表面細節在吉卜力裡是反效果，兩邊不能是同一段
ok(/visible pores/i.test(STYLE_PRESETS.realistic.surface), 'realistic 要毛孔');
ok(/no pores/i.test(STYLE_PRESETS.ghibli.surface), 'ghibli 明確不要毛孔');
ok(STYLE_PRESETS.realistic.surface !== STYLE_PRESETS.ghibli.surface, '兩個預設的表面處理不同');

// photoreal 跟 realistic 站同一邊（都要真實感），但禁的東西相反：
// realistic 仍是畫出來的，photoreal 恰恰要禁「畫出來的」
ok(!/photorealistic|3d render/i.test(STYLE_PRESETS.photoreal.negative), 'photoreal 不禁寫實');
ok(
  /illustration/i.test(STYLE_PRESETS.photoreal.negative) &&
    /painting/i.test(STYLE_PRESETS.photoreal.negative) &&
    /anime/i.test(STYLE_PRESETS.photoreal.negative),
  'photoreal 必須禁 illustration／painting／anime',
);
ok(!/illustration/i.test(STYLE_PRESETS.realistic.negative), 'realistic 不禁 illustration——它本來就是畫');
ok(/visible pores/i.test(STYLE_PRESETS.photoreal.surface), 'photoreal 要毛孔');
ok(
  STYLE_PRESETS.photoreal.render !== STYLE_PRESETS.realistic.render &&
    STYLE_PRESETS.photoreal.surface !== STYLE_PRESETS.realistic.surface,
  'photoreal 與 realistic 是兩套，不是同一套',
);
// 版面規則不隨風格變：三個預設都得分區打光
for (const id of SUPPORTED_STYLES) {
  const p = STYLE_PRESETS[id];
  const zoned = /LEFT ZONE/.test(p.lighting) && /RIGHT ZONE/.test(p.lighting);
  const flat = /whole sheet/.test(p.lighting);
  ok(zoned || flat, `${id} 的打光要麼分區要麼明確全圖平光`);
}

// 校驗器要能抓住風格與負向提示詞搞反
const wrongStyle = clone();
ok(
  validateCast(wrongStyle, SOURCE, 'zh', 'ghibli').some((x) => x.includes('必須禁 photorealistic')),
  '樣例是 realistic，按 ghibli 校驗會報錯',
);
const ghibliish = clone();
for (const c of ghibliish) c.image.negativePrompt = STYLE_PRESETS.ghibli.negative;
ok(
  validateCast(ghibliish, SOURCE, 'zh', 'realistic').some((x) => x.includes('自相矛盾')),
  'realistic 卻禁 photorealistic 會報錯',
);
eq(validateCast(CAST, SOURCE, 'zh', 'realistic').length, 0, '樣例按 realistic 校驗通過');

// photoreal：負向提示詞漏了「畫出來的」那幾個詞要報錯，否則模型交插畫
const photorealCast = clone();
for (const c of photorealCast) {
  c.image.negativePrompt = STYLE_PRESETS.photoreal.negative;
  c.image.sheet = `${STYLE_PRESETS.photoreal.render}. ${c.image.sheet}`;
}
eq(validateCast(photorealCast, SOURCE, 'zh-TW', 'photoreal').length, 0, 'photoreal 角色卡校驗通過');
ok(
  validateCast(clone(), SOURCE, 'zh', 'photoreal').some((x) => x.includes('必須禁 illustration')),
  '樣例的負向提示詞沒禁 illustration，按 photoreal 校驗會報錯',
);
// photoreal 的 sheet 裡必須帶自己的渲染句，否則畫風會飄回插畫
const photorealNoRender = clone();
for (const c of photorealNoRender) c.image.negativePrompt = STYLE_PRESETS.photoreal.negative;
ok(
  validateCast(photorealNoRender, SOURCE, 'zh', 'photoreal').some((x) => x.includes('沒有 style=photoreal')),
  'photoreal 的 sheet 缺渲染句會報錯',
);

/* ---------------- 真實感 ---------------- */

// 一邊要真實感一邊在負向提示詞裡禁真實感，是自相矛盾的
ok(
  CAST.every((c) => !/photorealistic|3d render/i.test(c.image.negativePrompt)),
  'negativePrompt 不再禁 photorealistic / 3d render',
);
ok(
  CAST.every((c) => /plastic or waxy skin|poreless doll face/i.test(c.image.negativePrompt)),
  'negativePrompt 改禁「假」而不是禁「真」',
);
// 「扁平向量卡通」跟寫實擰巴，會導致同一批角色畫風飄
ok(
  CAST.every((c) => !/flat vector cartoon/i.test(c.image.sheet + c.image.prompt)),
  '不再用扁平向量卡通',
);
ok(
  CAST.every((c) => /Semi-realistic character illustration, painterly rendering/.test(c.image.sheet)),
  '畫風統一到半寫實厚塗',
);
// 真實感來自不完美
for (const [k, label] of [
  [/visible pores/i, '可見毛孔'],
  [/wet specular highlight/i, '眼睛濕潤高光'],
  [/asymmetric/i, '左右不對稱'],
  [/flyaway hair strands/i, '碎髮破輪廓'],
  [/visible weave/i, '布料織紋'],
  [/self-shadow/i, '褶皺自陰影'],
]) {
  ok(CAST.every((c) => k.test(c.image.sheet)), `設定圖提示詞含${label}`);
}
// 分區光照：左欄要體積，右側要平光——合併成一句全域性光照就廢了
ok(
  CAST.every((c) => /LIGHTING IN THE LEFT ZONE ONLY/.test(c.image.sheet)),
  '左欄單獨打方向光',
);
ok(
  CAST.every((c) => /LIGHTING IN THE RIGHT ZONES: flat even orthographic/.test(c.image.sheet)),
  '右側保持平光正交',
);
ok(
  CAST.every((c) => /ambient occlusion/i.test(c.image.sheet)),
  '左欄有環境遮蔽',
);
ok(CAST.every((c) => /bust portrait/i.test(c.image.sheet)), '左欄是半身像');
// 模型預設會把肩膀裁掉、底邊做成圓角漸隱，必須顯式禁掉
ok(
  CAST.every((c) => /BOTH SHOULDERS ARE FULLY VISIBLE/.test(c.image.sheet)),
  '左欄要求肩膀完整',
);
ok(
  CAST.every((c) => /do not fade, vignette or round off the bottom edge/.test(c.image.sheet)),
  '左欄禁止底邊圓角漸隱',
);
ok(CAST.every((c) => /three FULL-BODY views/i.test(c.image.sheet)), '右上是三視圖');
// 兩欄的臉必須畫成同一個人，否則一張圖裡出現兩個長相
ok(
  CAST.every((c) => /must match the bust portrait/i.test(c.image.sheet)),
  '三視圖的臉要求與半身像一致',
);
// 「留空臉」是上一版的做法，已廢棄——提示詞裡不該再出現
ok(
  CAST.every((c) => !/left completely blank|NO eyes|NO facial features/i.test(c.image.sheet)),
  '提示詞裡沒有殘留的留空臉要求',
);

const withSheet = clone();
withSheet[0].sheetImage = 'images/x-sheet.png';
const sheetHtml = renderHtml(withSheet, 'x');
ok(sheetHtml.includes('images/x-sheet.png'), '設定圖被嵌入');
eq((sheetHtml.match(/class="plate zoom"/g) || []).length, 1, '一個角色只有一個印張');
// 點圖彈層 + 右下角一鍵複製圖片
ok(sheetHtml.includes('class="lightbox"'), '有圖片彈層');
ok(/data-src="images\/x-sheet\.png"/.test(sheetHtml), '彈層拿到圖片地址');
ok(/class="copy-img" data-img="images\/x-sheet\.png"/.test(sheetHtml), '圖上有複製按鈕');
ok(sheetHtml.includes('ClipboardItem'), '複製的是圖片本身而不是路徑');
ok(/blob\.type !== 'image\/png'/.test(sheetHtml), '非 PNG 先轉碼——Safari 只認 image/png');

console.log(`✓ ${passed} 項自測全部通過`);
