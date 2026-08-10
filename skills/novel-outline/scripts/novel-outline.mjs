#!/usr/bin/env node
// novel-outline — deterministic helpers for the novel-outline skill.
// Zero dependencies on purpose: the skill must work in any directory
// without an npm install. Node 18+ (stdlib only).

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* 常量與閾值                                                           */
/* ------------------------------------------------------------------ */
/*
 * 閾值參數化：「爽點間隔 ≤ 3 集」在不同平臺不是一個數。
 * outline.json 的 params.thresholds 可以逐項覆蓋，不改程式碼。
 */

export const ADAPT_MODES = ['忠實', '抽核', '借殼'];
export const BEAT_WEIGHTS = ['major', 'minor'];

/*
 * 角色分檔。一刀切的「有名字角色 ≤ 6」混淆了兩件事：觀眾要記住誰、
 * 製作要維護多少張臉。分檔把它拆開——每一檔的一致性投入完全不同。
 * 無名背景人不進表、不追蹤、不限量。
 *
 * 從 novel-characters 的 cast.json 提供進來時按 importance 對映：
 * protagonist/major → lead，supporting → support，minor → functional。
 */
export const CHARACTER_TIERS = ['lead', 'support', 'functional'];
export const TIER_LABELS = { lead: '主角組', support: '重要配角', functional: '功能性角色' };
/** AI 短劇的角色資產量折算——資產清單按這個自動彙總，不讓模型寫。 */
export const TIER_ASSET_SPEC = {
  lead: '全套角色設定圖 + 逐鏡一致性核對',
  support: '半身參考圖，關鍵戲核對',
  functional: '提示詞直出，鬆散一致即可',
};

export const DEFAULT_THRESHOLDS = {
  maxLeads: 5,          // 主角組上限（男女主 + 主反派）
  maxSupport: 10,       // 有名字的重要配角上限
  maxFunctional: 10,    // 功能性角色上限（佔臉不佔名，name 用稱呼標籤）
  maxBeatGap: 3,        // 相鄰爽點最大間隔（集）
  // maxPrimaryScenes 不在這裡——它隨集數動態，見 primarySceneCap()
};

/**
 * 主場景上限隨集數走。
 *
 * 這是給 **AI 短劇**定的數，不是實景劇組的數——場景是生成的，沒有搭景錢，
 * 「≤ 5」那種實景經濟學在這裡不成立。上限守的只剩兩件事：每個主場景的
 * **跨集一致性資產**（環境參考圖、光照基調），以及觀眾的空間認知負擔。
 * 所以放得寬：觀賞性直接吃場景多樣性，別為省不存在的錢把戲憋在一個屋裡。
 *
 *   上限 = clamp(4 + ⌈集數 / 10⌉, 5, 15)
 *
 * 錨點：6 集微型劇 5 個；60 集 10 個；110 集以上封頂 15。
 * `params.thresholds.maxPrimaryScenes` 顯式給了就用給的，動態值只是預設。
 */
export function primarySceneCap(episodes) {
  if (!Number.isInteger(episodes) || episodes < 1) return 8; // 沒有集數資訊給個居中值
  return Math.max(5, Math.min(15, 4 + Math.ceil(episodes / 10)));
}

/**
 * 生成難點關鍵詞表：梗概裡掃到就必須進該集的 warnings。
 * 寧可多報不可漏報——預警清單的意義就是拍攝前有人看過一眼。
 */
export const RISK_PATTERNS = {
  雨戲: /雨/,
  肢體接觸: /吻|擁抱|相擁|牽手|貼身|扭打|摟/,
  人群: /人群|圍觀|眾人|滿堂|滿座|集市|人山/,
  手部特寫: /手部|指尖|十指|特寫.{0,4}手/,
};

/** 梗概必須是敘述體——出現引號對白就是在寫劇本，越界。 */
const DIALOGUE_RE = /「|」|『|』|“|”/;

/* ------------------------------------------------------------------ */
/* chunk — 按章節分卷                                                   */
/* ------------------------------------------------------------------ */
/*
 * 長篇（80 萬字級）塞不進上下文，兩層 map-reduce：
 * 章 → 卷（每卷 N 章出一份中間摘要）→ 全書。
 * 辨識不出章節標題就退回按字數切。
 */

export const CHAPTER_RE =
  /^[ \t　]*(第[0-9零一二三四五六七八九十百千兩]+[章回節卷部][^\n]*|楔子[^\n]*|序章[^\n]*|尾聲[^\n]*|番外[^\n]*|Chapter\s+\d+[^\n]*)$/gm;

export const DEFAULT_PER_VOLUME = 15;
export const MAX_VOLUMES = 60;
export const FALLBACK_CHUNK = 20_000;
export const FALLBACK_OVERLAP = 500;

export function detectChapters(text) {
  const found = [];
  for (const m of text.matchAll(CHAPTER_RE)) {
    found.push({ title: m[1].trim(), start: m.index });
  }
  return found;
}

/**
 * @returns {{volumes: string[], chapters: number, truncated: boolean, mode: 'chapter'|'size'}}
 */
export function chunkVolumes(text, perVolume = DEFAULT_PER_VOLUME) {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return { volumes: [], chapters: 0, truncated: false, mode: 'chapter' };

  const chapters = detectChapters(clean);

  // 章節太少：按字數切（帶重疊，讓卡在切口上的情節兩邊都看得見）
  if (chapters.length < 2) {
    const volumes = [];
    let cursor = 0;
    while (cursor < clean.length && volumes.length < MAX_VOLUMES) {
      const end = Math.min(cursor + FALLBACK_CHUNK, clean.length);
      volumes.push(clean.slice(cursor, end).trim());
      if (end >= clean.length) break;
      cursor = Math.max(end - FALLBACK_OVERLAP, cursor + 1);
    }
    const truncated = volumes.length >= MAX_VOLUMES && clean.length > FALLBACK_CHUNK * MAX_VOLUMES;
    return { volumes, chapters: 0, truncated, mode: 'size' };
  }

  // 章前的引子歸進第一卷
  const starts = chapters.map((c) => c.start);
  if (starts[0] > 0) starts.unshift(0);

  const volumes = [];
  for (let i = 0; i < starts.length && volumes.length < MAX_VOLUMES; i += perVolume) {
    const from = starts[i];
    const to = i + perVolume < starts.length ? starts[i + perVolume] : clean.length;
    volumes.push(clean.slice(from, to).trim());
  }
  const covered = Math.min(starts.length, MAX_VOLUMES * perVolume);
  const truncated = covered < starts.length;
  return { volumes, chapters: chapters.length, truncated, mode: 'chapter' };
}

/* ------------------------------------------------------------------ */
/* slug                                                                */
/* ------------------------------------------------------------------ */

export function slug(name) {
  const cleaned = String(name)
    .trim()
    .replace(/[\s/\\:*?"<>|]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'outline';
}

/* ------------------------------------------------------------------ */
/* 品質門                                                               */
/* ------------------------------------------------------------------ */
/*
 * checklist 的每一項都是程式碼，不是給模型讀的文字——
 * 交給模型自覺的清單，輸出品質全看它當天心情。
 *
 * gateReport 產出帶 ✓/✗ 的結構化結果（渲染進報告的「品質門」面板），
 * validateOutline 把失敗項合併進違規列表（CLI 用，exit 1）。
 */

const thText = (s) => typeof s === 'string' && s.trim();

function thresholdsOf(outline) {
  const explicit = outline?.params?.thresholds ?? {};
  const th = { ...DEFAULT_THRESHOLDS, ...explicit };
  if (explicit.maxPrimaryScenes === undefined) th.maxPrimaryScenes = primarySceneCap(outline?.params?.episodes);
  return th;
}

/** 每集的正文欄位，關鍵詞掃描和對白檢查都掃這三欄。 */
const EP_TEXT_FIELDS = ['synopsis', 'hook', 'suspense'];

export function gateReport(outline) {
  const th = thresholdsOf(outline);
  const gates = [];
  const add = (id, label, ok, detail = '') => gates.push({ id, label, ok, detail });

  const chars = Array.isArray(outline?.characters) ? outline.characters : [];
  const scenes = Array.isArray(outline?.scenes) ? outline.scenes : [];
  const beats = Array.isArray(outline?.beats) ? outline.beats : [];
  const eps = Array.isArray(outline?.episodes) ? outline.episodes : [];
  const total = outline?.params?.episodes ?? eps.length;

  // G1a–G1c 角色分檔上限。主角組還要求至少 1 人——沒有主角的劇不成立
  const tierCap = { lead: th.maxLeads, support: th.maxSupport, functional: th.maxFunctional };
  for (const tier of CHARACTER_TIERS) {
    const n = chars.filter((c) => c?.tier === tier).length;
    const needMin = tier === 'lead';
    add(
      `${tier}-cap`,
      `${TIER_LABELS[tier]} ${needMin ? `1–${tierCap[tier]}` : `≤ ${tierCap[tier]}`} 人`,
      (needMin ? n >= 1 : true) && n <= tierCap[tier],
      `${n} 位`,
    );
  }

  // G2 主場景上限
  const primary = scenes.filter((s) => s?.primary);
  add('scene-cap', `主場景 ≤ ${th.maxPrimaryScenes}`, scenes.length > 0 && primary.length <= th.maxPrimaryScenes, `${primary.length} 個`);

  // 場景/角色使用統計（G3、G10 共用）。
  // 只給已登記的 id 計數——未知 id 塞進索引會讓「引用不存在」那道門形同虛設。
  const sceneUse = new Map(scenes.map((s) => [s?.id, 0]));
  const charUse = new Map(chars.map((c) => [c?.id, 0]));
  for (const e of eps) {
    for (const id of e?.sceneIds ?? []) if (sceneUse.has(id)) sceneUse.set(id, sceneUse.get(id) + 1);
    for (const id of e?.characterIds ?? []) if (charUse.has(id)) charUse.set(id, charUse.get(id) + 1);
  }

  // G3 一次性場景要有規避方案
  const onceNoPlan = scenes.filter((s) => sceneUse.get(s?.id) === 1 && !thText(s?.reusePlan));
  add(
    'once-scene',
    '一次性場景已標註規避方案',
    eps.length > 0 && onceNoPlan.length === 0,
    onceNoPlan.length ? `缺：${onceNoPlan.map((s) => s.name ?? s.id).join('、')}` : '',
  );

  // G4 爽點間隔 ≤ N，首尾無真空
  const beatEps = [...new Set(beats.map((b) => b?.episode).filter((n) => Number.isInteger(n)))].sort((a, b) => a - b);
  let gapOk = beatEps.length > 0 && total > 0;
  let gapDetail = '';
  if (gapOk) {
    if (beatEps[0] > th.maxBeatGap) {
      gapOk = false;
      gapDetail = `開頭 ${beatEps[0] - 1} 集真空`;
    }
    for (let i = 1; i < beatEps.length && gapOk; i++) {
      if (beatEps[i] - beatEps[i - 1] > th.maxBeatGap) {
        gapOk = false;
        gapDetail = `第 ${beatEps[i - 1]}–${beatEps[i]} 集之間斷檔`;
      }
    }
    if (gapOk && total - beatEps[beatEps.length - 1] >= th.maxBeatGap) {
      gapOk = false;
      gapDetail = `結尾 ${total - beatEps[beatEps.length - 1]} 集真空`;
    }
  }
  add('beat-gap', `爽點間隔 ≤ ${th.maxBeatGap} 集，無真空區`, gapOk, gapDetail);

  // G5 第 1 集有鉤子
  add('ep1-hook', '第 1 集有鉤子', eps.length > 0 && thText(eps[0]?.hook), '');

  // G6 大爆點不能到最後一集才第一次出現
  const majors = beats.filter((b) => (b?.weight ?? 'minor') === 'major').map((b) => b.episode);
  add(
    'major-early',
    '大爆點不在最後一集才首次出現',
    majors.length > 0 && Math.min(...majors) < total,
    majors.length ? `最早在第 ${Math.min(...majors)} 集` : '沒有 major 爽點',
  );

  // G7 每集三欄齊全（鉤子/懸念必填）
  const incomplete = eps.filter((e) => !EP_TEXT_FIELDS.every((f) => thText(e?.[f])));
  add(
    'ep-fields',
    '每集梗概三欄齊全（含【鉤子】【懸念】）',
    eps.length > 0 && incomplete.length === 0,
    incomplete.length ? `缺欄：第 ${incomplete.map((e) => e.ep).join('、')} 集` : '',
  );

  // G8 三人以上同框要有拆解方案
  const crowdBad = eps.filter((e) => (e?.characterIds?.length ?? 0) >= 3 && !thText(e?.crowdPlan));
  add(
    'crowd-plan',
    '三人以上同框已標註拆解方案',
    crowdBad.length === 0,
    crowdBad.length ? `缺：第 ${crowdBad.map((e) => e.ep).join('、')} 集` : '',
  );

  // G9 生成難點進預警清單（關鍵詞掃描，寧可多報）
  const riskBad = [];
  for (const e of eps) {
    const text = EP_TEXT_FIELDS.map((f) => e?.[f] ?? '').join(' ');
    for (const [risk, re] of Object.entries(RISK_PATTERNS)) {
      if (re.test(text) && !(e?.warnings ?? []).includes(risk)) riskBad.push(`第 ${e.ep} 集缺「${risk}」`);
    }
  }
  add('risk-flag', '生成難點已進預警清單', eps.length > 0 && riskBad.length === 0, riskBad.join('；'));

  // G10 引用完整：ID 都存在、沒有失業角色、沒有空轉場景
  const refBad = [];
  for (const e of eps) {
    for (const id of e?.sceneIds ?? []) if (!sceneUse.has(id)) refBad.push(`第 ${e.ep} 集引用了不存在的場景 ${id}`);
    for (const id of e?.characterIds ?? []) if (!charUse.has(id)) refBad.push(`第 ${e.ep} 集引用了不存在的角色 ${id}`);
  }
  for (const b of beats) {
    if (Number.isInteger(b?.episode) && (b.episode < 1 || b.episode > total)) {
      refBad.push(`爽點 ${b.id} 落在不存在的第 ${b.episode} 集`);
    }
  }
  for (const [id, n] of charUse) if (n === 0) refBad.push(`角色 ${id} 從未在任何一集出現`);
  for (const [id, n] of sceneUse) if (n === 0) refBad.push(`場景 ${id} 從未被用到`);
  add('refs', '場景/角色引用完整，無失業角色、無空轉場景', eps.length > 0 && refBad.length === 0, refBad.join('；'));

  // G11 梗概是敘述體
  const dlgBad = eps.filter((e) => EP_TEXT_FIELDS.some((f) => DIALOGUE_RE.test(e?.[f] ?? '')));
  add(
    'no-dialogue',
    '梗概是敘述體，無引號對白',
    dlgBad.length === 0,
    dlgBad.length ? `第 ${dlgBad.map((e) => e.ep).join('、')} 集出現引號` : '',
  );

  return gates;
}

/* ------------------------------------------------------------------ */
/* validate                                                            */
/* ------------------------------------------------------------------ */
/*
 * 三檔 stage 就是流程門：
 *   skeleton — 改編說明 + 人物 + 場景（快版拍板前）
 *   beats    — skeleton + 爽點表（寫分集之前必須過這檔）
 *   full     — 全部（預設）
 * 「步驟 4 完成前不允許寫分集梗概」靠這個變成可執行的，而不是一句話。
 */

export const STAGES = ['skeleton', 'beats', 'full'];

export function validateOutline(outline, stage = 'full') {
  const problems = [];
  const p = (msg) => problems.push(msg);
  if (!outline || typeof outline !== 'object') return ['outline 不是物件'];
  const th = thresholdsOf(outline);

  // --- params ---
  const params = outline.params;
  if (!params || typeof params !== 'object') {
    p('缺少 params（總集數/單集時長/題材/改編幅度）');
  } else {
    if (!Number.isInteger(params.episodes) || params.episodes < 1) p('params.episodes 必須是正整數');
    if (!(params.minutesPerEpisode > 0)) p('params.minutesPerEpisode 必須大於 0');
    if (!thText(params.genre)) p('params.genre 缺失——題材決定爽點型別，不能缺');
    if (!ADAPT_MODES.includes(params.adaptMode)) {
      p(`params.adaptMode 必須是 ${ADAPT_MODES.join('/')}，實際是 ${JSON.stringify(params.adaptMode)}`);
    }
  }

  // --- adaptation 改編說明 ---
  const ad = outline.adaptation;
  if (!ad || typeof ad !== 'object') {
    p('缺少 adaptation（改編說明）');
  } else {
    if (!thText(ad.core)) p('adaptation.core 缺失——一句話核心是整份大綱的錨');
    for (const key of ['keep', 'cut', 'merge', 'risks']) {
      if (!Array.isArray(ad[key])) p(`adaptation.${key} 必須是陣列`);
    }
    if (Array.isArray(ad.keep) && ad.keep.length === 0) p('adaptation.keep 至少要有一條——什麼都不保還改編什麼');
    if (params?.adaptMode && params.adaptMode !== '忠實' && Array.isArray(ad.cut) && ad.cut.length === 0) {
      p(`adaptMode=${params.adaptMode} 卻一條線都沒砍，說不過去`);
    }
    for (const [key, fields] of [['keep', ['what', 'why']], ['cut', ['what', 'why']], ['merge', ['what', 'why']], ['risks', ['what', 'plan']]]) {
      for (const item of ad[key] ?? []) {
        for (const f of fields) if (!thText(item?.[f])) p(`adaptation.${key} 裡有條目缺 ${f}`);
      }
    }
    // 決策補註（可選）：給了就不能是空殼
    for (const f of ['cutNote', 'mergeNote']) {
      if (ad[f] !== undefined && !thText(ad[f])) p(`adaptation.${f} 給了但是空的——要麼寫結論，要麼刪掉這個鍵`);
    }
  }

  // --- characters 人物表 ---
  const chars = outline.characters;
  if (!Array.isArray(chars) || chars.length === 0) {
    p('characters 為空');
  } else {
    const tierCap = { lead: th.maxLeads, support: th.maxSupport, functional: th.maxFunctional };
    for (const tier of CHARACTER_TIERS) {
      const n = chars.filter((c) => c?.tier === tier).length;
      if (n > tierCap[tier]) p(`${TIER_LABELS[tier]} ${n} 位，超過上限 ${tierCap[tier]}`);
    }
    if (!chars.some((c) => c?.tier === 'lead')) p('沒有主角組（tier=lead）角色');
    const seen = new Set();
    for (const c of chars) {
      const label = c?.name ?? c?.id ?? '(無名)';
      if (!/^C\d{2,}$/.test(c?.id ?? '')) p(`[${label}] 角色 id 必須是 C01 這種格式`);
      if (seen.has(c?.id)) p(`角色 id ${c.id} 重複`);
      seen.add(c?.id);
      if (!CHARACTER_TIERS.includes(c?.tier)) {
        p(`[${label}] tier 必須是 ${CHARACTER_TIERS.join('/')}（主角組/重要配角/功能性角色）`);
      }
      for (const f of ['name', 'role']) if (!thText(c?.[f])) p(`[${label}] 缺 ${f}`);
      // 功能性角色沒有弧光是正常的——醫生就是來縫針的
      if (c?.tier !== 'functional' && !thText(c?.arc)) p(`[${label}] 缺 arc（主角組和重要配角必須有人物弧）`);
      if (!Array.isArray(c?.from) || c.from.length === 0 || !c.from.every(thText)) {
        p(`[${label}] 缺 from（← 改動記錄：原著對應誰、合併了誰）`);
      }
    }
  }

  // --- scenes ---
  const scenes = outline.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    p('scenes 為空');
  } else {
    const primaryN = scenes.filter((s) => s?.primary).length;
    if (primaryN > th.maxPrimaryScenes) p(`主場景 ${primaryN} 個，超過上限 ${th.maxPrimaryScenes}`);
    const seen = new Set();
    for (const s of scenes) {
      const label = s?.name ?? s?.id ?? '(無名)';
      if (!/^S\d{2,}$/.test(s?.id ?? '')) p(`[${label}] 場景 id 必須是 S01 這種格式`);
      if (seen.has(s?.id)) p(`場景 id ${s.id} 重複`);
      seen.add(s?.id);
      if (!thText(s?.name)) p(`[${s?.id}] 場景缺 name`);
      if (typeof s?.primary !== 'boolean') p(`[${label}] 場景缺 primary（是不是主場景）`);
    }
  }

  if (stage === 'skeleton') return problems;

  // --- beats 爽點表 ---
  const beats = outline.beats;
  if (!Array.isArray(beats) || beats.length === 0) {
    p('beats 為空——爽點表是排片的骨架');
  } else {
    const seen = new Set();
    for (const b of beats) {
      const label = b?.id ?? '(無 id)';
      if (!/^B\d{2,}$/.test(b?.id ?? '')) p(`[${label}] 爽點 id 必須是 B01 這種格式`);
      if (seen.has(b?.id)) p(`爽點 id ${b.id} 重複`);
      seen.add(b?.id);
      if (!thText(b?.type)) p(`[${label}] 缺 type（打臉/揭破/反轉……）`);
      if (b?.weight !== undefined && !BEAT_WEIGHTS.includes(b.weight)) p(`[${label}] weight 只能是 ${BEAT_WEIGHTS.join('/')}`);
      if (!Number.isInteger(b?.episode) || b.episode < 1) p(`[${label}] episode 必須是正整數`);
      for (const f of ['setup', 'payoff']) if (!thText(b?.[f])) p(`[${label}] 缺 ${f}`);
    }
    // 間隔與 major 時機在 beats 檔就要卡住——這兩條錯了，分集寫完全廢
    for (const g of gateReport(outline)) {
      if ((g.id === 'beat-gap' || g.id === 'major-early') && !g.ok) {
        p(`品質門未過：${g.label}${g.detail ? `（${g.detail}）` : ''}`);
      }
    }
  }

  if (stage === 'beats') return problems;

  // --- episodes 分集梗概 ---
  const eps = outline.episodes;
  if (!Array.isArray(eps) || eps.length === 0) {
    p('episodes 為空');
  } else {
    if (params?.episodes && eps.length !== params.episodes) {
      p(`分集寫了 ${eps.length} 集，params.episodes 說好 ${params.episodes} 集`);
    }
    eps.forEach((e, i) => {
      if (e?.ep !== i + 1) p(`第 ${i + 1} 個條目的 ep 是 ${e?.ep}，編號必須從 1 連續`);
      if (!Array.isArray(e?.sceneIds) || e.sceneIds.length === 0) p(`第 ${e?.ep} 集缺 sceneIds`);
      if (!Array.isArray(e?.characterIds) || e.characterIds.length === 0) p(`第 ${e?.ep} 集缺 characterIds`);
      if (e?.warnings !== undefined && !Array.isArray(e.warnings)) p(`第 ${e?.ep} 集 warnings 必須是陣列`);
    });
    // 其餘全部品質門（beats 檔已報過的兩條不再重複）
    for (const g of gateReport(outline)) {
      if (g.id === 'beat-gap' || g.id === 'major-early') continue;
      if (!g.ok) p(`品質門未過：${g.label}${g.detail ? `（${g.detail}）` : ''}`);
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ */
/* 資產清單 — 算出來的，不讓模型寫                                        */
/* ------------------------------------------------------------------ */
/*
 * 五件套的第五件。分集既然帶了場景 ID + 角色 ID，
 * 資產清單就是純彙總——讓模型手寫它一定會漏。
 */

export function computeAssets(outline) {
  const eps = Array.isArray(outline?.episodes) ? outline.episodes : [];

  const scenes = (outline?.scenes ?? []).map((s) => {
    const episodes = eps.filter((e) => (e?.sceneIds ?? []).includes(s.id)).map((e) => e.ep);
    return { id: s.id, name: s.name, primary: !!s.primary, uses: episodes.length, episodes, reusePlan: s.reusePlan ?? null };
  });

  const characters = (outline?.characters ?? []).map((c) => {
    const episodes = eps.filter((e) => (e?.characterIds ?? []).includes(c.id)).map((e) => e.ep);
    return { id: c.id, name: c.name, role: c.role, tier: c.tier, uses: episodes.length, episodes };
  });

  // 角色資產量折算：每檔要備多少張臉、備到什麼程度
  const castPlan = CHARACTER_TIERS.map((tier) => {
    const members = (outline?.characters ?? []).filter((c) => c?.tier === tier);
    return { tier, label: TIER_LABELS[tier], count: members.length, names: members.map((c) => c.name), spec: TIER_ASSET_SPEC[tier] };
  });

  const warnings = {};
  for (const e of eps) {
    for (const w of e?.warnings ?? []) {
      (warnings[w] ??= []).push(e.ep);
    }
  }

  const beatsByType = {};
  for (const b of outline?.beats ?? []) {
    (beatsByType[b.type] ??= []).push(b.episode);
  }

  return { scenes, characters, castPlan, warnings, beatsByType };
}

/* ------------------------------------------------------------------ */
/* render — 介面文案                                                    */
/* ------------------------------------------------------------------ */
/*
 * v1 只有中文。全部文案收在這張表裡，別把字串散進模板——
 * 以後要加語言，加一個鍵就行（novel-characters 就是這麼長出來的）。
 */

const T = {
  kicker: '短劇改編大綱',
  docTitle: (s) => `${s} · 短劇改編大綱`,
  paramsLine: (p) =>
    `${p.episodes} 集 × ${p.minutesPerEpisode} 分鐘 · ${p.genre} · ${p.adaptMode}改編`,
  exportJson: '匯出 JSON',
  gates: '品質門',
  gatesPass: '全部透過',
  gatesFail: (n) => `${n} 項未過`,
  gatePill: (okN, total) => `品質門 ${okN} / ${total}`,
  sections: {
    decisions: '關鍵決策', rhythm: '爽點節奏', episodes: '分集梗概',
    episodesOverview: '分集概覽', matrix: '每集排程矩陣',
    sceneOverview: '場景概覽', plan: '資產量折算', gates: '品質門',
    adaptation: '改編說明', characters: '人物表', beats: '爽點表', assets: '資產清單',
  },
  dec: {
    cut: '砍了哪條線', merge: '合了哪些人', majors: '大爆點落在第幾集',
    castSlots: (n, l, s, f) => `${n} 個角色位（主角組 ${l} · 重要配角 ${s} · 功能性 ${f}）`,
    leads: '主角組', noCut: '未砍線（忠實改編）', noMajor: '沒有 major 爽點',
    first: '首個', final: '終局',
  },
  secNotes: {
    decisions: '拍板過的三件事，落進紙面',
    rhythm: (gap) => `間隔 ≤ ${gap} 集 · 無真空區`,
    episodes: '核心交付 · 每集三欄齊全',
    matrix: '一列 = 這一集要誰、在哪拍',
    sceneOverview: '右上 = 出現集',
    plan: '按檔自動折算 · 不讓模型寫',
    adaptation: '為什麼這麼改 · 附原文依據',
  },
  kpi: {
    episodes: '總集數', runtime: (m) => `正片約 ${m} 分鐘`,
    beats: '爽點', beatsSub: (major, gap) => `${major} 大爆點${gap ? ` · 最大間隔 ${gap} 集` : ''}`,
    cast: '角色', castSub: (l, s, f) => `主角 ${l} · 配角 ${s} · 功能 ${f}`,
    scenes: '主場景', scenesOnce: (n) => (n ? `一次性場景 ${n}，需複用方案` : '無一次性場景'),
    risks: '生成難點', risksNone: '預警清單為空',
    mode: '改編幅度', modeSub: (cut, merge) => `砍 ${cut} 線 · 合 ${merge} 組`,
  },
  legendMajor: '大爆點', legendMinor: '常規爽點',
  gapNote: (n) => `— ${n} 集空檔 —`,
  tabTimeline: '時間軸', tabTable: '明細表',
  showAllEps: (n) => `展開全部 ${n} 集`,
  assetsAuto: '（由分集資料自動彙總）',
  core: '一句話核心',
  keep: '保留', cut: '砍掉', merge: '合併', risks: '風險與對策',
  what: '內容', why: '理由', plan: '對策', evidence: '原文依據',
  charCols: ['ID', '角色', '層級', '定位', '人物弧', '← 改動記錄'],
  tier: TIER_LABELS,
  castPlanTitle: '角色資產量折算',
  castPlanCols: ['層級', '人數', '角色', '資產量'],
  planSceneRow: '場景環境',
  planSceneSpec: '主場景各一套環境參考 + 光照基調',
  planRiskRow: '生成難點',
  planRiskSpec: '拍攝前逐條過預警清單',
  beatCols: ['ID', '型別', '量級', '集', '鋪墊', '兌現'],
  weight: { major: '大爆點', minor: '常規' },
  rhythm: '爽點節奏',
  rhythmLegend: '■ 大爆點　□ 常規　· 無爽點',
  matrixHead: '角色 / 場景',
  matrixTier: '層級',
  matrixTotal: '合計',
  matrixScenes: '場　景',
  onceScene: '一次性',
  primaryScene: '主場景',
  reusePlanLabel: '複用方案',
  beatsCarried: '承載爽點',
  castSeen: '出場角色',
  crowdOk: '同框拆解 ✓',
  epHook: '鉤子',
  epSuspense: '懸念',
  epScenes: '場景',
  epCast: '人物',
  epCrowd: '同框拆解',
  epWarnings: '預警',
  sceneCols: ['ID', '場景', '主場景', '出現集', '次數', '複用方案'],
  castCols: ['ID', '角色', '定位', '出現集', '次數'],
  warnCols: ['難點', '涉及集'],
  beatTypeCols: ['爽點型別', '落點（集）'],
  yes: '是', no: '否',
  none: '—',
  colophon: '大綱由模型依據原文生成，品質門由程式確定性檢查。',
};

/* ------------------------------------------------------------------ */
/* render — markdown                                                   */
/* ------------------------------------------------------------------ */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const mdRow = (cells) => `| ${cells.map((c) => String(c ?? '').replace(/\|/g, '\\|')).join(' | ')} |`;
const mdHead = (cols) => [mdRow(cols), mdRow(cols.map(() => '---'))].join('\n');

/** 人物表按檔排：主角組在前，功能性角色墊底。 */
const byTier = (characters) =>
  [...characters].sort((a, b) => CHARACTER_TIERS.indexOf(a.tier) - CHARACTER_TIERS.indexOf(b.tier));

export function renderMarkdown(outline) {
  const { source, params, adaptation: ad, characters, beats, episodes } = outline;
  const assets = computeAssets(outline);
  const gates = gateReport(outline);
  const out = [];

  out.push(`# ${T.docTitle(source)}`, '', `> ${T.paramsLine(params)}`, '');

  // 品質門放最前面——先看有沒有病，再看內容
  out.push(`## ${T.gates}`, '');
  for (const g of gates) out.push(`- ${g.ok ? '✅' : '❌'} ${g.label}${!g.ok && g.detail ? ` — ${g.detail}` : ''}`);
  out.push('');

  out.push(`## 一、${T.sections.adaptation}`, '', `**${T.core}**　${ad.core}`, '');
  const adTable = (title, rows, fields, labels) => {
    if (!rows?.length) return;
    out.push(`### ${title}`, '', mdHead(labels));
    for (const r of rows) out.push(mdRow(fields.map((f) => r[f] ?? '')));
    out.push('');
  };
  adTable(T.keep, ad.keep, ['what', 'why', 'evidence'], [T.what, T.why, T.evidence]);
  adTable(T.cut, ad.cut, ['what', 'why'], [T.what, T.why]);
  adTable(T.merge, ad.merge, ['what', 'why'], [T.what, T.why]);
  adTable(T.risks, ad.risks, ['what', 'plan'], [T.what, T.plan]);

  out.push(`## 二、${T.sections.characters}`, '', mdHead(T.charCols));
  for (const c of byTier(characters)) {
    out.push(mdRow([c.id, c.name, T.tier[c.tier] ?? c.tier, c.role, c.arc ?? '—', c.from.join('；')]));
  }
  out.push('');

  out.push(`## 三、${T.sections.beats}`, '', mdHead(T.beatCols));
  for (const b of beats) {
    out.push(mdRow([b.id, b.type, T.weight[b.weight ?? 'minor'], b.episode, b.setup, b.payoff]));
  }
  out.push('');

  out.push(`## 四、${T.sections.episodes}`, '');
  for (const e of episodes) {
    out.push(`### 第 ${e.ep} 集`, '', e.synopsis, '');
    out.push(`- **【${T.epHook}】** ${e.hook}`);
    out.push(`- **【${T.epSuspense}】** ${e.suspense}`);
    out.push(`- ${T.epScenes}：${e.sceneIds.join('、')}　${T.epCast}：${e.characterIds.join('、')}`);
    if (e.crowdPlan) out.push(`- ${T.epCrowd}：${e.crowdPlan}`);
    if (e.warnings?.length) out.push(`- ⚠️ ${T.epWarnings}：${e.warnings.join('、')}`);
    out.push('');
  }

  out.push(`## 五、${T.sections.assets}${T.assetsAuto}`, '');
  out.push(mdHead(T.sceneCols));
  for (const s of assets.scenes) {
    out.push(mdRow([s.id, s.name, s.primary ? T.yes : T.no, s.episodes.join('、'), s.uses, s.reusePlan ?? '—']));
  }
  out.push('', mdHead(T.castCols));
  for (const c of assets.characters) out.push(mdRow([c.id, c.name, c.role, c.episodes.join('、'), c.uses]));
  out.push('');
  out.push(`### ${T.castPlanTitle}`, '', mdHead(T.castPlanCols));
  for (const t2 of assets.castPlan) out.push(mdRow([t2.label, t2.count, t2.names.join('、') || '—', t2.spec]));
  out.push('');
  if (Object.keys(assets.warnings).length) {
    out.push(mdHead(T.warnCols));
    for (const [w, epsIn] of Object.entries(assets.warnings)) out.push(mdRow([w, epsIn.join('、')]));
    out.push('');
  }
  out.push(mdHead(T.beatTypeCols));
  for (const [type, epsIn] of Object.entries(assets.beatsByType)) out.push(mdRow([type, epsIn.join('、')]));
  out.push('');

  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* render — html                                                       */
/* ------------------------------------------------------------------ */
/*
 * 業內評審用的單頁報告：1600 寬，全部平鋪可 Cmd+F。設計約定見
 * references/report-style.md。區塊順序按「先交付後存檔」排：
 *   KPI 帶 → 爽點節奏（時間軸）→ 分集梗概 → 排程矩陣 + 場景概覽
 *   → 資產量折算 → 人物表 → 改編說明 → 品質門
 * 所有圖形都是內聯 SVG/CSS —— 不引任何庫，報告離線雙擊能開。
 * 配色跑過 dataviz 驗證器：大爆點 #8a3324 / 常規 #c56a4e，六項全過。
 */

/** 報告裡內嵌的資料就是 outline.json 原樣——編輯完能直接重新匯入 render。 */
function embedOutline(outline) {
  return JSON.stringify(outline).replace(/</g, '\\u003c');
}

/** SVG 座標保留一位小數，別把浮點尾巴寫進產物。 */
const r1 = (n) => Math.round(n * 10) / 10;

/** 截斷到 n 個字，超出加省略號。按碼點數，中英混排不劈字。 */
const snip = (s, n) => {
  const a = [...String(s ?? '')];
  return a.length > n ? `${a.slice(0, n).join('')}…` : String(s ?? '');
};

/**
 * 出現集列表 → 幽靈編號：連續區間合寫（1,2,3 → 1–3），
 * 離散且不超過 4 個用間隔點（1 · 6），再多隻報數量。
 */
export function fmtEps(eps) {
  if (!eps?.length) return '—';
  const a = [...eps].sort((x, y) => x - y);
  if (a.length === 1) return String(a[0]);
  const consecutive = a.every((v, i) => i === 0 || v === a[i - 1] + 1);
  if (consecutive) return `${a[0]}–${a[a.length - 1]}`;
  if (a.length <= 4) return a.join(' · ');
  return `${a.length} 集`;
}

/* ---------- 爽點節奏：劇情時間軸 ---------- */
/*
 * 一條地平線貫穿全劇，爽點是軸上的節點，標籤上下交替防撞。
 * 60 集以上按每行 20 集折行，同一條軸的延續。
 * 空檔直接標在軸上；超過 maxBeatGap 的空檔標成鐵鏽紅——違規在圖上自己喊。
 */

const RH = { W: 1520, PADX: 30, ROWH: 176, AXIS: 92, PER_ROW: 20 };

function renderRhythm(outline, t) {
  const total = outline.params.episodes;
  const beats = [...outline.beats].sort((a, b) => a.episode - b.episode);
  const th = { ...DEFAULT_THRESHOLDS, ...(outline.params?.thresholds ?? {}) };
  const cols = Math.min(total, RH.PER_ROW);
  const colW = (RH.W - 2 * RH.PADX) / cols;
  const rows = Math.ceil(total / cols);
  const rowOf = (ep) => Math.floor((ep - 1) / cols);
  const x = (ep) => r1(RH.PADX + (((ep - 1) % cols) + 0.5) * colW);
  const axisY = (ep) => rowOf(ep) * RH.ROWH + RH.AXIS;
  const parts = [];
  const tickParts = []; // 刻度最後畫——自帶底襯，壓在節點豎線上仍可讀；反過來會被豎線蓋住

  // 每行一條軸線 + 集刻度
  for (let r = 0; r < rows; r++) {
    const epsInRow = Math.min(total - r * cols, cols);
    const y = r * RH.ROWH + RH.AXIS;
    parts.push(`<line class="axis" x1="${RH.PADX}" y1="${y}" x2="${r1(RH.PADX + epsInRow * colW)}" y2="${y}"/>`);
    const step = colW >= 30 ? 1 : 5;
    for (let i = 1; i <= epsInRow; i++) {
      const ep = r * cols + i;
      if (step > 1 && ep % step !== 0 && i !== 1 && i !== epsInRow) continue;
      parts.push(`<line class="axis" x1="${x(ep)}" y1="${y - 4}" x2="${x(ep)}" y2="${y + 4}"/>`);
      tickParts.push(`<text class="tick" x="${x(ep)}" y="${y + 20}" text-anchor="middle">${ep}</text>`);
    }
  }

  // 空檔標註：同一行內、間距夠寬才畫；超閾值的標成鐵鏽紅
  const beatEps = [...new Set(beats.map((b) => b.episode))].sort((a, b) => a - b);
  for (let i = 1; i < beatEps.length; i++) {
    const [e1, e2] = [beatEps[i - 1], beatEps[i]];
    const gap = e2 - e1 - 1;
    if (gap < 1 || rowOf(e1) !== rowOf(e2) || (e2 - e1) * colW < 120) continue;
    const bad = e2 - e1 > th.maxBeatGap;
    const mx = r1((Number(x(e1)) + Number(x(e2))) / 2);
    parts.push(`<text class="gapnote${bad ? ' bad' : ''}" x="${mx}" y="${axisY(e1) - 12}" text-anchor="middle">${esc(t.gapNote(gap))}</text>`);
  }

  // 節點：標籤上下交替；同一集多個爽點時後來的翻到對面
  const sideUsed = new Map(); // `${ep}:up` / `${ep}:down`
  beats.forEach((b, i) => {
    let side = i % 2 === 0 ? 'up' : 'down';
    if (sideUsed.has(`${b.episode}:${side}`)) side = side === 'up' ? 'down' : 'up';
    sideUsed.set(`${b.episode}:${side}`, true);
    const major = (b.weight ?? 'minor') === 'major';
    const cx = x(b.episode);
    const ay = axisY(b.episode);
    const r = major ? 9 : 6;
    const dy = major ? 44 : 36;
    const cy = side === 'up' ? ay - dy : ay + dy;
    const labelY = side === 'up' ? ay - dy - 22 : ay + dy + 22;
    const subY = side === 'up' ? labelY - 14 : labelY + 14;
    parts.push(`<line class="stem${major ? ' major' : ''}" x1="${cx}" y1="${ay}" x2="${cx}" y2="${side === 'up' ? cy + r : cy - r}"/>`);
    parts.push(`<circle class="bdot${major ? ' major' : ''}" cx="${cx}" cy="${cy}" r="${r}"><title>${esc(`${b.id} ${b.type}｜${b.setup} → ${b.payoff}`)}</title></circle>`);
    parts.push(`<text class="blabel" x="${cx}" y="${labelY}" text-anchor="middle">${esc(snip(b.type, 6))}</text>`);
    parts.push(`<text class="bsub" x="${cx}" y="${subY}" text-anchor="middle">${esc(snip(b.setup, 14))}</text>`);
  });

  return `<div class="chart rhythm">
  <div class="legend">
    <i><span class="dotk major"></span>${esc(t.legendMajor)}</i>
    <i><span class="dotk"></span>${esc(t.legendMinor)}</i>
  </div>
  <svg viewBox="0 0 ${RH.W} ${rows * RH.ROWH}" role="img" aria-label="${esc(t.sections.rhythm)}">
    ${parts.join('\n    ')}
    ${tickParts.join('\n    ')}
  </svg>
</div>`;
}

/* ---------- 通用小件 ---------- */

const secHead = (no, title, note) =>
  `<div class="sec-h"><span class="no">${no}</span><h2>${esc(title)}</h2>${note ? `<span class="note">${esc(note)}</span>` : ''}</div>`;

const htable = (cols, rows) =>
  `<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}</tbody></table>`;

export function renderHtml(outline) {
  const { source, params, adaptation: ad, characters, beats, episodes } = outline;
  const t = T;
  const assets = computeAssets(outline);
  const gates = gateReport(outline);
  const failed = gates.filter((g) => !g.ok);
  const total = params.episodes;
  const beatsOf = (ep) => beats.filter((b) => b.episode === ep);

  // ---- KPI 帶 ----
  const beatEps = [...new Set(beats.map((b) => b.episode))].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < beatEps.length; i++) maxGap = Math.max(maxGap, beatEps[i] - beatEps[i - 1]);
  const tierN = Object.fromEntries(assets.castPlan.map((p) => [p.tier, p.count]));
  const primaryScenes = assets.scenes.filter((s) => s.primary);
  const onceScenes = assets.scenes.filter((s) => s.uses === 1);
  const riskTotal = Object.values(assets.warnings).reduce((n, e) => n + e.length, 0);
  const riskSub = Object.entries(assets.warnings)
    .map(([w, e]) => `${w} ×${e.length}（第 ${e.join('、')} 集）`)
    .join(' · ');
  const majors = beats.filter((b) => (b.weight ?? 'minor') === 'major').length;

  const kpis = `<div class="kpis">
  <div class="kpi accent"><div class="l">${esc(t.kpi.episodes)}</div><div class="v">${total} <small>× ${esc(String(params.minutesPerEpisode))} 分鐘</small></div><div class="d">${esc(t.kpi.runtime(total * params.minutesPerEpisode))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.beats)}</div><div class="v">${beats.length}</div><div class="d">${esc(t.kpi.beatsSub(majors, maxGap))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.cast)}</div><div class="v">${characters.length}</div><div class="d">${esc(t.kpi.castSub(tierN.lead ?? 0, tierN.support ?? 0, tierN.functional ?? 0))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.scenes)}</div><div class="v">${primaryScenes.length}${assets.scenes.length > primaryScenes.length ? ` <small>+${assets.scenes.length - primaryScenes.length}</small>` : ''}</div><div class="d">${esc(t.kpi.scenesOnce(onceScenes.length))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.risks)}</div><div class="v">${riskTotal}</div><div class="d">${esc(riskTotal ? snip(riskSub, 24) : t.kpi.risksNone)}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.mode)}</div><div class="v mode">${esc(params.adaptMode)}</div><div class="d">${esc(t.kpi.modeSub(ad.cut.length, ad.merge.length))}</div></div>
</div>`;

  // ---- 分集卡 ----
  const epCards = episodes
    .map((e) => {
      const bs = beatsOf(e.ep);
      return `<article class="ep" id="ep-${e.ep}">
  <span class="num">${e.ep}</span>
  <header><b>第 ${e.ep} 集</b>${bs.map((b) => `<i class="bt${(b.weight ?? 'minor') === 'major' ? ' major' : ''}">${esc(b.type)}</i>`).join('')}</header>
  <p class="syn">${esc(e.synopsis)}</p>
  <div class="hk"><b>${esc(t.epHook)}</b><span>${esc(e.hook)}</span></div>
  <div class="hk"><b>${esc(t.epSuspense)}</b><span>${esc(e.suspense)}</span></div>
  <div class="meta">${e.sceneIds.map((id) => `<i>${esc(id)}</i>`).join('')}${e.characterIds.map((id) => `<i>${esc(id)}</i>`).join('')}${(e.warnings ?? []).map((w) => `<i class="warn">${esc(w)}</i>`).join('')}${e.crowdPlan ? `<i class="warn" title="${esc(e.crowdPlan)}">${esc(t.crowdOk)}</i>` : ''}</div>
</article>`;
    })
    .join('\n');

  // ---- 每集排程矩陣 ----
  // 格寬隨集數收：整行鋪開的前提下儘量佔滿 1600 寬
  const cw = total <= 20 ? 26 : total <= 40 ? 20 : total <= 60 ? 16 : 12;
  const mxRow = (name, tierLabel, epsIn, cls, tail) => {
    const set = new Set(epsIn);
    const cells = Array.from({ length: total }, (_, i) => `<td class="mc${set.has(i + 1) ? ` on${cls}` : ''}"></td>`).join('');
    return `<tr><td class="name">${esc(name)}</td><td class="tier">${esc(tierLabel)}</td>${cells}<td class="n">${tail}</td></tr>`;
  };
  const matrixRows = [
    ...byTier(assets.characters).map((c) => mxRow(c.name, t.tier[c.tier] ?? c.tier, c.episodes, '', String(c.uses))),
    `<tr class="div"><td colspan="${total + 3}">${esc(t.matrixScenes)}</td></tr>`,
    ...assets.scenes.map((s) =>
      mxRow(s.name, s.primary ? t.primaryScene : t.onceScene, s.episodes, ' sc', s.uses === 1 ? `${s.uses} ⚠` : String(s.uses)),
    ),
  ].join('\n');
  const onceNotes = assets.scenes
    .filter((s) => s.uses === 1 && s.reusePlan)
    .map((s) => `⚠ ${esc(s.name)} · ${esc(t.reusePlanLabel)}：${esc(s.reusePlan)}`)
    .join('<br>');
  const epHead = Array.from({ length: total }, (_, i) => `<th class="ep-h">${i + 1}</th>`).join('');
  const matrix = `<div class="matrix" style="--cw:${cw}px">
  <table>
    <tr><th>${esc(t.matrixHead)}</th><th>${esc(t.matrixTier)}</th>${epHead}<th>${esc(t.matrixTotal)}</th></tr>
    ${matrixRows}
  </table>
  ${onceNotes ? `<p class="mnote">${onceNotes}</p>` : ''}
</div>`;

  // ---- 場景概覽卡 ----
  const scards = assets.scenes
    .map((s) => {
      const set = new Set(s.episodes);
      const strip = Array.from({ length: total }, (_, i) => `<i class="${set.has(i + 1) ? `on${s.primary ? '' : ' lt'}` : ''}"></i>`).join('');
      // 承載爽點按型別去重計數——「小打臉 ×5」比重複列五遍可讀
      const carried = beats.filter((b) => set.has(b.episode));
      const carriedByType = {};
      for (const b of carried) carriedByType[b.type] = (carriedByType[b.type] ?? 0) + 1;
      const carriedText = Object.entries(carriedByType)
        .map(([ty, cnt]) => (cnt > 1 ? `${ty} ×${cnt}` : ty))
        .join(' · ');
      const castIn = [...new Set(episodes.filter((e) => (e.sceneIds ?? []).includes(s.id)).flatMap((e) => e.characterIds ?? []))];
      return `<article class="scard">
  <span class="snum">${esc(fmtEps(s.episodes))}</span>
  <h3><span class="id">${esc(s.id)}</span>${esc(s.name)}<span class="badge${s.primary ? '' : ' once'}">${esc(s.primary ? t.primaryScene : t.onceScene)}</span></h3>
  <div class="strip">${strip}</div>
  <div class="srow"><b>${esc(t.beatsCarried)}</b><span>${carried.length ? esc(carriedText) : esc(t.none)}</span></div>
  ${s.reusePlan
    ? `<div class="srow"><b>${esc(t.reusePlanLabel)}</b><span class="reuse">${esc(s.reusePlan)}</span></div>`
    : `<div class="srow"><b>${esc(t.castSeen)}</b>${castIn.map((id) => `<i>${esc(id)}</i>`).join('')}</div>`}
</article>`;
    })
    .join('\n');

  // ---- 資產量折算（含場景環境與生成難點，全部算出來）----
  const onceNames = onceScenes.map((s) => s.name);
  const planRows = [
    ...assets.castPlan.map((p) => [esc(p.label), String(p.count), esc(p.names.join('、') || t.none), esc(p.spec)]),
    [
      esc(t.planSceneRow),
      `${primaryScenes.length}${onceScenes.length ? `+${onceScenes.length}` : ''}`,
      esc(primaryScenes.map((s) => s.name).join('、') + (onceNames.length ? `（+${onceNames.join('、')}複用）` : '')),
      esc(t.planSceneSpec),
    ],
    [esc(t.planRiskRow), String(riskTotal), esc(riskTotal ? riskSub : t.none), esc(t.planRiskSpec)],
  ];

  // ---- 關鍵決策：拍板三件事，砍線/合人來自改編說明，大爆點與角色位算出來 ----
  const majorBeats = beats.filter((b) => (b.weight ?? 'minor') === 'major').sort((a, b) => a.episode - b.episode);
  const leadNames = characters.filter((c) => c.tier === 'lead').map((c) => c.name);
  const decisions = `<div class="dec3">
  <div class="dcol">
    <h3 class="sub">${esc(t.dec.cut)}</h3>
    ${ad.cut.length
      ? `<ul class="dlist">${ad.cut.map((r) => `<li><b>${esc(r.what)}</b><small>${esc(r.why)}</small></li>`).join('')}</ul>`
      : `<p class="dnote">${esc(t.dec.noCut)}</p>`}
    ${ad.cutNote ? `<p class="dnote seal">${esc(ad.cutNote)}</p>` : ''}
  </div>
  <div class="dcol">
    <h3 class="sub">${esc(t.dec.merge)}</h3>
    <p class="dhead">${esc(t.dec.castSlots(characters.length, tierN.lead ?? 0, tierN.support ?? 0, tierN.functional ?? 0))}</p>
    <p class="dhead">${esc(t.dec.leads)}：${esc(leadNames.join('、'))}</p>
    ${ad.merge.length ? `<ul class="dlist">${ad.merge.map((r) => `<li><b>${esc(r.what)}</b><small>${esc(r.why)}</small></li>`).join('')}</ul>` : ''}
    ${ad.mergeNote ? `<p class="dnote seal">${esc(ad.mergeNote)}</p>` : ''}
  </div>
  <div class="dcol">
    <h3 class="sub">${esc(t.dec.majors)}</h3>
    ${majorBeats.length
      ? `<ul class="dmaj">${majorBeats
          .map((b, i) => `<li><i>ep${b.episode}</i><span><b>${esc(b.type)}</b> ${esc(snip(b.payoff, 20))}</span>${
            i === 0 ? `<em>${esc(t.dec.first)}</em>` : i === majorBeats.length - 1 ? `<em>${esc(t.dec.final)}</em>` : ''
          }</li>`)
          .join('')}</ul>`
      : `<p class="dnote">${esc(t.dec.noMajor)}</p>`}
  </div>
</div>`;

  // ---- 品質門 ----
  const gateList = `<ul class="gate">
  ${gates
    .map(
      (g) => `<li class="${g.ok ? 'ok' : 'bad'}"><span class="m">${g.ok ? '✓' : '✗'}</span><span>${esc(g.label)}${
        !g.ok && g.detail ? `<small>${esc(g.detail)}</small>` : ''
      }</span></li>`,
    )
    .join('\n  ')}
</ul>`;

  return `<!doctype html>
<html lang="zh"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.docTitle(source))}</title>
<style>
:root{
  --paper:#eceded; --panel:#f5f6f5; --side:#e4e6e3; --ink:#191d21; --ink-2:#5b636a; --ink-3:#8c9298;
  --rule:#d2d5d0; --rule-2:#c2c6bf; --seal:#8a3324; --seal-2:#c56a4e; --seal-soft:#8a332412; --ok:#3d6b4f;
  --serif:"Songti SC","STSong","Source Han Serif SC","Noto Serif CJK SC",Georgia,serif;
  --sans:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.7 var(--sans);-webkit-font-smoothing:antialiased}
.page{max-width:1600px;margin:0 auto;padding:24px 32px 90px}
h1,h2,h3{margin:0;font-weight:400}

.hd{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:12px}
.hd h1{font:400 28px/1.1 var(--serif);letter-spacing:.06em}
.hd .sub{font-size:13px;color:var(--ink-2)}
.hd .right{margin-left:auto;display:flex;align-items:center;gap:10px}
.gatepill{display:inline-flex;align-items:center;gap:6px;font:500 12px/1 var(--sans);border-radius:99px;padding:6px 12px}
.gatepill.pass{color:var(--ok);border:1px solid var(--ok)}
.gatepill.fail{color:var(--seal);border:1px solid var(--seal);background:var(--seal-soft)}
.expo{font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--panel);
  border:1px solid var(--rule-2);border-radius:2px;padding:7px 11px;cursor:pointer;transition:.15s}
.expo:hover{border-color:var(--seal);color:var(--seal)}
.expo:focus-visible{outline:2px solid var(--seal);outline-offset:2px}

.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:18px 0 6px}
@media(max-width:980px){.kpis{grid-template-columns:repeat(3,1fr)}}
@media(max-width:560px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:11px 14px 9px}
.kpi .l{font:500 10px/1 var(--sans);letter-spacing:.18em;color:var(--ink-3)}
.kpi .v{font:400 28px/1.15 var(--serif);margin-top:5px}
.kpi .v small{font:400 14px var(--serif);color:var(--ink-2)}
.kpi .v.mode{font-size:21px;padding-top:5px}
.kpi .d{font-size:11px;color:var(--ink-2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kpi.accent{border-top:2px solid var(--seal)}

.galert{margin:14px 0 0;border:1px solid var(--seal);background:var(--seal-soft);border-radius:2px;
  padding:10px 14px;font-size:13px}
.galert b{color:var(--seal)}
.galert span{display:block;font-size:12px;color:var(--ink-2)}

section{margin-top:34px}
.sec-h{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--rule-2);padding-bottom:8px;margin-bottom:16px}
.sec-h .no{font:500 12px/1 var(--mono);color:var(--seal)}
.sec-h h2{font:400 20px/1.2 var(--serif);letter-spacing:.05em}
.sec-h .note{margin-left:auto;font-size:12px;color:var(--ink-3)}

/* 爽點節奏的圖/表 tab */
.tabs{display:flex;width:max-content;margin-bottom:12px;border:1px solid var(--rule-2);
  border-radius:2px;overflow:hidden}
.tab{font:500 12px/1 var(--sans);letter-spacing:.06em;padding:7px 16px;background:var(--panel);
  border:0;cursor:pointer;color:var(--ink-2);transition:.15s}
.tab + .tab{border-left:1px solid var(--rule-2)}
.tab.on{background:var(--seal);color:#fff}
.tab:focus-visible{outline:2px solid var(--seal);outline-offset:-2px}
.tabpane{display:none}
.tabpane.on{display:block}

/* 分集概覽：預設前三張卡，底部漸隱 + 展開 */
.epswrap{position:relative}
.eps{position:relative}
.epswrap.clip .eps .ep:nth-child(n+4){display:none}
.epswrap.clip .eps::after{content:'';position:absolute;left:0;right:0;bottom:0;height:90px;
  background:linear-gradient(180deg,transparent,var(--paper));pointer-events:none}
.epsmore{display:block;margin:10px auto 0;font:500 12px/1 var(--sans);letter-spacing:.06em;
  color:var(--ink-2);background:var(--panel);border:1px solid var(--rule-2);border-radius:2px;
  padding:8px 18px;cursor:pointer;transition:.15s}
.epsmore:hover{border-color:var(--seal);color:var(--seal)}
.epsmore:focus-visible{outline:2px solid var(--seal);outline-offset:2px}

/* 關鍵決策：拍板三件事 */
.dec3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;align-items:start}
@media(max-width:1080px){.dec3{grid-template-columns:1fr}}
.dcol{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:4px 18px 14px}
.dhead{margin:8px 0 0;font-size:12.5px;color:var(--ink-2)}
.dlist{list-style:none;margin:8px 0 0;padding:0}
.dlist li{padding:7px 0;border-top:1px solid var(--rule)}
.dlist li:first-child{border-top:0}
.dlist b{display:block;font:400 13.5px/1.6 var(--serif)}
.dlist small{display:block;font-size:11.5px;color:var(--ink-2);line-height:1.6}
.dnote{margin:10px 0 0;font-size:12px;color:var(--ink-2);line-height:1.7}
.dnote.seal{color:var(--seal);background:var(--seal-soft);padding:7px 10px;border-radius:2px}
.dmaj{list-style:none;margin:8px 0 0;padding:0}
.dmaj li{display:flex;gap:9px;align-items:baseline;padding:5.5px 0;border-top:1px solid var(--rule);font-size:12.5px}
.dmaj li:first-child{border-top:0}
.dmaj i{flex:none;font:500 11px/1 var(--mono);color:var(--seal);font-style:normal;min-width:38px}
.dmaj b{font:400 12.5px var(--serif)}
.dmaj span{min-width:0}
.dmaj em{flex:none;margin-left:auto;font:500 10px/1 var(--sans);letter-spacing:.1em;font-style:normal;
  color:var(--seal);border:1px solid var(--seal);border-radius:99px;padding:2px 7px}

/* 爽點節奏時間軸 */
.chart{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:16px 20px 10px}
.chart .legend{display:flex;gap:18px;font-size:12px;color:var(--ink-2);margin-bottom:2px}
.chart .legend i{font-style:normal;display:inline-flex;align-items:center;gap:6px}
.dotk{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--seal-2)}
.dotk.major{width:12px;height:12px;background:var(--seal)}
.rhythm svg{display:block;width:100%;height:auto}
.rhythm .axis{stroke:var(--rule-2);stroke-width:1.5}
.rhythm .tick{font:400 10.5px var(--mono);fill:var(--ink-3);paint-order:stroke;stroke:var(--panel);stroke-width:3px}
.rhythm .stem{stroke:var(--seal-2);stroke-width:1.5}
.rhythm .stem.major{stroke:var(--seal)}
.rhythm .bdot{fill:var(--seal-2);stroke:var(--panel);stroke-width:2}
.rhythm .bdot.major{fill:var(--seal)}
.rhythm .blabel{font:500 12px var(--sans);fill:var(--ink)}
.rhythm .bsub{font:400 10.5px var(--sans);fill:var(--ink-2)}
.rhythm .gapnote{font:400 10.5px var(--sans);fill:var(--ink-3)}
.rhythm .gapnote.bad{fill:var(--seal);font-weight:500}

/* 爽點明細表 + 通用表格 */
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--rule);font-size:13px}
th,td{padding:8px 12px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top}
th{font:500 11px/1 var(--sans);letter-spacing:.1em;color:var(--ink-3);background:var(--side)}
tr:last-child td{border-bottom:0}
td:first-child{font-family:var(--mono);font-size:12px;color:var(--ink-2);white-space:nowrap}
q{quotes:"「" "」";font-family:var(--serif);border-left:2px solid var(--seal);padding-left:8px;display:inline-block}

/* 分集卡 */
.eps{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:13px}
.ep{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:14px 16px 12px;position:relative}
.ep .num{position:absolute;top:10px;right:14px;font:400 30px/1 var(--serif);color:var(--rule-2)}
.ep header{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-right:44px;flex-wrap:wrap}
.ep header b{font:500 15px var(--serif);letter-spacing:.04em}
.bt{font-style:normal;font-size:11px;padding:2px 8px;border:1px solid var(--seal);border-radius:99px;color:var(--seal)}
.bt.major{background:var(--seal);color:#fff}
.ep .syn{margin:0 0 8px;font-size:13px;line-height:1.75}
.hk{display:grid;grid-template-columns:46px 1fr;gap:8px;font-size:12.5px;padding:6px 0;border-top:1px solid var(--rule)}
.hk b{font:500 11px/1.8 var(--sans);letter-spacing:.14em;color:var(--seal)}
.ep .meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.ep .meta i{font-style:normal;font:400 10.5px/1.5 var(--mono);border:1px solid var(--rule-2);
  border-radius:2px;padding:0 5px;background:var(--paper);color:var(--ink-2)}
.ep .meta .warn{border-color:var(--seal);color:var(--seal);background:var(--seal-soft)}

/* 每集排程矩陣 */
.matrix{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:16px 18px;overflow-x:auto}
.matrix table{border-collapse:separate;border-spacing:3px;font-size:12px;background:none;border:0;width:auto}
.matrix th,.matrix td{border:0;padding:0}
.matrix th{font:500 10px/1 var(--sans);letter-spacing:.1em;color:var(--ink-3);background:none;
  text-align:left;padding:0 8px 5px 0;white-space:nowrap}
.matrix th.ep-h{text-align:center;padding:0 0 5px;font-family:var(--mono)}
.matrix td.name{padding-right:10px;white-space:nowrap;font-family:var(--serif);font-size:13px}
.matrix td.tier{padding-right:10px;color:var(--ink-3);font-size:11px;white-space:nowrap}
.matrix td.mc{width:var(--cw,26px);min-width:var(--cw,26px);height:22px;border-radius:2px;
  background:var(--paper);border:1px solid var(--rule)}
.matrix td.mc.on{background:var(--seal);border-color:var(--seal)}
.matrix td.mc.on.sc{background:var(--seal-2);border-color:var(--seal-2)}
.matrix td.n{padding-left:10px;font-family:var(--mono);font-size:11px;color:var(--ink-2);white-space:nowrap}
.matrix tr.div td{padding:8px 0 3px;font:500 10px/1 var(--sans);letter-spacing:.18em;color:var(--ink-3)}
.matrix .mnote{font-size:11px;color:var(--ink-3);margin:10px 0 0}

/* 場景概覽卡：整行多列網格——場景多的時候塞半欄怎麼排都難看 */
.scenes{display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:13px;align-items:start}
.scard{position:relative;background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:14px 16px}
.snum{position:absolute;top:10px;right:16px;font:400 26px/1 var(--serif);color:var(--rule-2);letter-spacing:.04em}
.scard h3{font:400 16px/1.3 var(--serif);letter-spacing:.03em;display:flex;align-items:center;gap:8px;
  padding-right:90px;flex-wrap:wrap}
.scard h3 .id{font:400 10.5px var(--mono);color:var(--ink-3)}
.badge{font:500 10.5px/1 var(--sans);padding:2px 8px;border-radius:99px;border:1px solid var(--seal);color:var(--seal)}
.badge.once{border-color:var(--seal-2);color:var(--seal-2)}
.strip{display:flex;flex-wrap:wrap;gap:3px;margin:7px 0 6px}
.strip i{width:16px;height:10px;border-radius:2px;background:var(--paper);border:1px solid var(--rule)}
.strip i.on{background:var(--seal);border-color:var(--seal)}
.strip i.on.lt{background:var(--seal-2);border-color:var(--seal-2)}
.srow{font-size:11.5px;color:var(--ink-2);display:flex;gap:6px;flex-wrap:wrap;align-items:baseline;margin-top:3px}
.srow b{font:500 10px/1.8 var(--sans);letter-spacing:.12em;color:var(--ink-3);flex:none}
.srow i{font-style:normal;font:400 10.5px/1.5 var(--mono);border:1px solid var(--rule-2);
  border-radius:2px;padding:0 5px;background:var(--paper)}
.srow .reuse{color:var(--seal)}

/* 資產量折算 */
.plan{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:16px 18px}
.plan table{background:none;border:0}
.plan th{background:none;padding-left:0}
.plan td{padding-left:0;border-top:1px solid var(--rule);border-bottom:0}
.plan tr:first-child td{border-top:0}
.plan td:first-child{font-family:var(--serif);font-size:13px;color:var(--ink)}

/* 改編說明 */
.core{font:400 17px/1.9 var(--serif);margin:0 0 6px}
h3.sub{font:500 12px/1 var(--sans);letter-spacing:.18em;color:var(--seal);margin:20px 0 8px}

/* 品質門 */
.gate{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 28px}
@media(max-width:900px){.gate{grid-template-columns:1fr}}
.gate li{display:flex;gap:8px;padding:5px 0;font-size:12.5px;line-height:1.55}
.gate .m{flex:none;font-weight:700}
.gate .ok .m,.gate li.ok .m{color:var(--ok)}
.gate li.bad .m{color:var(--seal)}
.gate li.bad{background:var(--seal-soft);border-radius:2px;padding-left:6px}
.gate small{display:block;color:var(--ink-3)}
.gsum{margin:10px 0 0;font-size:12px;color:var(--ink-2)}
.gsum b{color:var(--seal)}

.foot{margin-top:40px;font-size:11px;color:var(--ink-3);border-top:1px solid var(--rule);padding-top:14px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
/* 螢幕上收，紙上全展開：tab 兩個面板都輸出、分集全部展開 */
@media print{
  .expo,.tabs,.epsmore{display:none!important}
  .tabpane{display:block!important;margin-bottom:14px}
  .epswrap.clip .eps .ep{display:block!important}
  .epswrap.clip .eps::after{display:none}
  .page{max-width:none;padding:0}
  section,.ep,.scard{page-break-inside:avoid}
  body{background:#fff}
}
</style></head><body>
<div class="page">

<header class="hd">
  <h1>${esc(source)}</h1>
  <span class="sub">${esc(t.kicker)} · ${esc(t.paramsLine(params))}</span>
  <span class="right">
    <span class="gatepill ${failed.length ? 'fail' : 'pass'}">${failed.length ? '✗' : '✓'} ${esc(t.gatePill(gates.length - failed.length, gates.length))}</span>
    <button class="expo" data-name="${esc(slug(source))}-outline.json">${esc(t.exportJson)}</button>
  </span>
</header>

${kpis}
${failed.length ? `<div class="galert"><b>✗ ${esc(t.gatesFail(failed.length))}</b>${failed.map((g) => `<span>${esc(g.label)}${g.detail ? ` — ${esc(g.detail)}` : ''}</span>`).join('')}</div>` : ''}

<section id="sec-rhythm">
  ${secHead('01', t.sections.rhythm, undefined)}
  <div class="tabs" role="tablist">
    <button class="tab on" data-pane="pane-timeline">${esc(t.tabTimeline)}</button>
    <button class="tab" data-pane="pane-table">${esc(t.tabTable)}</button>
  </div>
  <div class="tabpane on" id="pane-timeline">${renderRhythm(outline, t)}</div>
  <div class="tabpane" id="pane-table">
  ${htable(t.beatCols, beats.map((b) => [esc(b.id), esc(b.type), esc(t.weight[b.weight ?? 'minor']), String(b.episode), esc(b.setup), esc(b.payoff)]))}
  </div>
</section>

<section id="sec-episodes">
  ${secHead('02', t.sections.episodesOverview, t.secNotes.episodes)}
  <div class="epswrap${episodes.length > 3 ? ' clip' : ''}">
    <div class="eps">
${epCards}
    </div>
    ${episodes.length > 3 ? `<button class="epsmore">▾ ${esc(t.showAllEps(episodes.length))}</button>` : ''}
  </div>
</section>

<section id="sec-scenes">
  ${secHead('03', t.sections.sceneOverview, t.secNotes.sceneOverview)}
  <div class="scenes">
${scards}
  </div>
</section>

<section id="sec-decisions">
  ${secHead('04', t.sections.decisions, t.secNotes.decisions)}
  ${decisions}
</section>

<section id="sec-matrix">
  ${secHead('05', t.sections.matrix, t.secNotes.matrix)}
  ${matrix}
</section>

<section id="sec-plan">
  ${secHead('06', t.sections.plan, t.secNotes.plan)}
  <div class="plan">
  ${htable(t.castPlanCols, planRows)}
  </div>
</section>

<section id="sec-characters">
  ${secHead('07', t.sections.characters, undefined)}
  ${htable(t.charCols, byTier(characters).map((c) => [esc(c.id), esc(c.name), esc(t.tier[c.tier] ?? c.tier), esc(c.role), esc(c.arc ?? t.none), esc(c.from.join('；'))]))}
</section>

<section id="sec-adaptation">
  ${secHead('08', t.sections.adaptation, t.secNotes.adaptation)}
  <p class="core">${esc(ad.core)}</p>
  ${ad.keep?.length ? `<h3 class="sub">${esc(t.keep)}</h3>${htable([t.what, t.why, t.evidence], ad.keep.map((r) => [esc(r.what), esc(r.why), r.evidence ? `<q>${esc(r.evidence)}</q>` : esc(t.none)]))}` : ''}
  ${ad.cut?.length ? `<h3 class="sub">${esc(t.cut)}</h3>${htable([t.what, t.why], ad.cut.map((r) => [esc(r.what), esc(r.why)]))}` : ''}
  ${ad.merge?.length ? `<h3 class="sub">${esc(t.merge)}</h3>${htable([t.what, t.why], ad.merge.map((r) => [esc(r.what), esc(r.why)]))}` : ''}
  ${ad.risks?.length ? `<h3 class="sub">${esc(t.risks)}</h3>${htable([t.what, t.plan], ad.risks.map((r) => [esc(r.what), esc(r.plan)]))}` : ''}
</section>

<section id="sec-gates">
  ${secHead('09', t.sections.gates, undefined)}
  ${gateList}
  <p class="gsum">${failed.length ? `<b>${esc(t.gatesFail(failed.length))}</b>` : esc(t.gatesPass)}</p>
</section>

<p class="foot">${esc(t.colophon)}</p>
</div>

<script type="application/json" id="outline-data">${embedOutline(outline)}</script>
<script>
// 爽點節奏：圖 / 表切換
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.tabpane').forEach((p) => p.classList.toggle('on', p.id === btn.dataset.pane));
  });
});

// 分集概覽：預設前三集，點一下全展開（不再收起）
const epsMore = document.querySelector('.epsmore');
if (epsMore) {
  epsMore.addEventListener('click', () => {
    document.querySelector('.epswrap').classList.remove('clip');
    epsMore.remove();
  });
}

// 匯出：報告自己帶著完整的 outline.json，下載的是它原樣
document.querySelector('.expo').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const url = URL.createObjectURL(
    new Blob([document.getElementById('outline-data').textContent], { type: 'application/json' }),
  );
  const a = Object.assign(document.createElement('a'), { href: url, download: btn.dataset.name });
  a.click();
  // 別立刻回收——Safari 會搶在下載讀完之前撤掉 blob
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const USAGE = `novel-outline.mjs — novel-outline skill 的確定性工具

  chunk <book.txt> <workdir>          按章節分卷（辨識不出章節就按字數切），寫 vol-NN.txt
  validate <outline.json> [--stage s] 校驗；有違規逐條輸出並 exit 1
                                      stage: skeleton / beats / full（預設 full）
  checkup <outline.json>              體檢模式：只輸出品質門 ✓/✗，有未過項 exit 1
  render <outline.json> [--html|--md] 渲染大綱報告到 stdout（預設 --md）
  assets <outline.json>               輸出自動彙總的資產清單 JSON
  slug <name>                         書名轉安全檔名

chunk 選項：
  --per-volume <n>   每卷章數，預設 ${DEFAULT_PER_VOLUME}`;

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function flag(rest, name, fallback = null) {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback;
}

function main(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  if (cmd === 'chunk') {
    const [book, workdir] = rest;
    if (!book || !workdir) throw new Error('用法：chunk <book.txt> <workdir>');
    const perVolume = Number(flag(rest, '--per-volume', DEFAULT_PER_VOLUME));
    const text = readFileSync(resolve(book), 'utf8');
    const { volumes, chapters, truncated, mode } = chunkVolumes(text, perVolume);
    mkdirSync(resolve(workdir), { recursive: true });
    volumes.forEach((v, i) => {
      writeFileSync(join(resolve(workdir), `vol-${String(i).padStart(2, '0')}.txt`), v, 'utf8');
    });
    console.log(
      JSON.stringify({ volumes: volumes.length, chapters, chars: text.length, mode, workdir: resolve(workdir), truncated }, null, 2),
    );
    if (truncated) console.error(`⚠️ 超過 ${MAX_VOLUMES} 捲上限，尾部未收進來`);
    return;
  }

  if (cmd === 'validate') {
    const [path] = rest;
    if (!path) throw new Error('用法：validate <outline.json> [--stage skeleton|beats|full]');
    const stage = flag(rest, '--stage', 'full');
    if (!STAGES.includes(stage)) throw new Error(`--stage 只能是 ${STAGES.join('/')}`);
    const problems = validateOutline(readJson(path), stage);
    if (problems.length) {
      console.error(`✗ ${problems.length} 處違規（stage=${stage}）：\n`);
      for (const x of problems) console.error('  ' + x);
      process.exit(1);
    }
    console.log(`✓ 透過校驗（stage=${stage}）`);
    return;
  }

  if (cmd === 'checkup') {
    const [path] = rest;
    if (!path) throw new Error('用法：checkup <outline.json>');
    const gates = gateReport(readJson(path));
    for (const g of gates) console.log(`${g.ok ? '✓' : '✗'} ${g.label}${!g.ok && g.detail ? ` — ${g.detail}` : ''}`);
    const failed = gates.filter((g) => !g.ok).length;
    console.log(failed ? `\n✗ ${failed} 項未過` : '\n✓ 全部透過');
    if (failed) process.exit(1);
    return;
  }

  if (cmd === 'render') {
    const [path] = rest;
    if (!path) throw new Error('用法：render <outline.json> [--html|--md]');
    const outline = readJson(path);
    process.stdout.write((rest.includes('--html') ? renderHtml(outline) : renderMarkdown(outline)) + '\n');
    return;
  }

  if (cmd === 'assets') {
    const [path] = rest;
    if (!path) throw new Error('用法：assets <outline.json>');
    console.log(JSON.stringify(computeAssets(readJson(path)), null, 2));
    return;
  }

  if (cmd === 'slug') {
    if (!rest[0]) throw new Error('用法：slug <name>');
    console.log(slug(rest[0]));
    return;
  }

  throw new Error(`未知命令 ${cmd}\n\n${USAGE}`);
}

// 軟鏈安裝時 argv[1] 是連結路徑，兩邊都取 realpath 才能比得上
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  // `render ... | head` 這類管道提前關閉時安靜退出，別甩 EPIPE 堆疊
  process.stdout.on('error', (e) => {
    if (e.code === 'EPIPE') process.exit(0);
    throw e;
  });
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
