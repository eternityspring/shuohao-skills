#!/usr/bin/env node
// novel-outline — deterministic helpers for the novel-outline skill.
// Zero dependencies on purpose: the skill must work in any directory
// without an npm install. Node 18+ (stdlib only).

import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* 常量与阈值                                                           */
/* ------------------------------------------------------------------ */
/*
 * 阈值参数化：「爽点间隔 ≤ 3 集」在不同平台不是一个数。
 * outline.json 的 params.thresholds 可以逐项覆盖，不改代码。
 */

export const ADAPT_MODES = ['忠实', '抽核', '借壳'];
export const BEAT_WEIGHTS = ['major', 'minor'];

/*
 * 角色分档。一刀切的「有名字角色 ≤ 6」混淆了两件事：观众要记住谁、
 * 制作要维护多少张脸。分档把它拆开——每一档的一致性投入完全不同。
 * 无名背景人不进表、不追踪、不限量。
 *
 * 从 novel-characters 的 cast.json 喂进来时按 importance 映射：
 * protagonist/major → lead，supporting → support，minor → functional。
 */
export const CHARACTER_TIERS = ['lead', 'support', 'functional'];
export const TIER_LABELS = { lead: '主角组', support: '重要配角', functional: '功能性角色' };
/** AI 短剧的角色资产量折算——资产清单按这个自动汇总，不让模型写。 */
export const TIER_ASSET_SPEC = {
  lead: '全套角色设定图 + 逐镜一致性核对',
  support: '半身参考图，关键戏核对',
  functional: '提示词直出，松散一致即可',
};

export const DEFAULT_THRESHOLDS = {
  maxLeads: 5,          // 主角组上限（男女主 + 主反派）
  maxSupport: 10,       // 有名字的重要配角上限
  maxFunctional: 10,    // 功能性角色上限（占脸不占名，name 用称呼标签）
  maxBeatGap: 3,        // 相邻爽点最大间隔（集）
  maxProps: 8,          // 叙事道具上限。跟主角数量一个量级——收多了就不是叙事道具，
                        //   是场景陈设，那归 novel-art 的场景锚点管
  // maxPrimaryScenes 不在这里——它随集数动态，见 primarySceneCap()
};

/**
 * 主场景上限随集数走。
 *
 * 这是给 **AI 短剧**定的数，不是实景剧组的数——场景是生成的，没有搭景钱，
 * 「≤ 5」那种实景经济学在这里不成立。上限守的只剩两件事：每个主场景的
 * **跨集一致性资产**（环境参考图、光照基调），以及观众的空间认知负担。
 * 所以放得宽：观赏性直接吃场景多样性，别为省不存在的钱把戏憋在一个屋里。
 *
 *   上限 = clamp(4 + ⌈集数 / 10⌉, 5, 15)
 *
 * 锚点：6 集微型剧 5 个；60 集 10 个；110 集以上封顶 15。
 * `params.thresholds.maxPrimaryScenes` 显式给了就用给的，动态值只是缺省。
 */
export function primarySceneCap(episodes) {
  if (!Number.isInteger(episodes) || episodes < 1) return 8; // 没有集数信息给个居中值
  return Math.max(5, Math.min(15, 4 + Math.ceil(episodes / 10)));
}

/**
 * 生成难点关键词表：梗概里扫到就必须进该集的 warnings。
 * 宁可多报不可漏报——预警清单的意义就是拍摄前有人看过一眼。
 */
export const RISK_PATTERNS = {
  雨戏: /雨/,
  肢体接触: /吻|拥抱|相拥|牵手|贴身|扭打|搂/,
  人群: /人群|围观|众人|满堂|满座|集市|人山/,
  手部特写: /手部|指尖|十指|特写.{0,4}手/,
};

/** 梗概必须是叙述体——出现引号对白就是在写剧本，越界。 */
const DIALOGUE_RE = /「|」|『|』|“|”/;

/* ------------------------------------------------------------------ */
/* chunk — 按章节分卷                                                   */
/* ------------------------------------------------------------------ */
/*
 * 长篇（80 万字级）塞不进上下文，两层 map-reduce：
 * 章 → 卷（每卷 N 章出一份中间摘要）→ 全书。
 * 识别不出章节标题就退回按字数切。
 */

export const CHAPTER_RE =
  /^[ \t　]*(第[0-9零一二三四五六七八九十百千两]+[章回节卷部][^\n]*|楔子[^\n]*|序章[^\n]*|尾声[^\n]*|番外[^\n]*|Chapter\s+\d+[^\n]*)$/gm;

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

  // 章节太少：按字数切（带重叠，让卡在切口上的情节两边都看得见）
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

  // 章前的引子归进第一卷
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
/* 质量门                                                               */
/* ------------------------------------------------------------------ */
/*
 * checklist 的每一项都是代码，不是给模型读的文字——
 * 交给模型自觉的清单，输出质量全看它当天心情。
 *
 * gateReport 产出带 ✓/✗ 的结构化结果（渲染进报告的「质量门」面板），
 * validateOutline 把失败项合并进违规列表（CLI 用，exit 1）。
 */

const thText = (s) => typeof s === 'string' && s.trim();

function thresholdsOf(outline) {
  const explicit = outline?.params?.thresholds ?? {};
  const th = { ...DEFAULT_THRESHOLDS, ...explicit };
  if (explicit.maxPrimaryScenes === undefined) th.maxPrimaryScenes = primarySceneCap(outline?.params?.episodes);
  return th;
}

/** 每集的正文字段，关键词扫描和对白检查都扫这三栏。 */
const EP_TEXT_FIELDS = ['synopsis', 'hook', 'suspense'];

export function gateReport(outline) {
  const th = thresholdsOf(outline);
  const gates = [];
  // enKey：中文标签会随条件变化的门（目前只有 refs），英文查表要另给一个键。
  // 门 id 保持稳定不动——它是日志与下游对账的凭据。
  const add = (id, label, ok, detail = '', enKey = null) =>
    gates.push({ id, label, ok, detail, ...(enKey ? { enKey } : {}) });

  const chars = Array.isArray(outline?.characters) ? outline.characters : [];
  const scenes = Array.isArray(outline?.scenes) ? outline.scenes : [];
  const beats = Array.isArray(outline?.beats) ? outline.beats : [];
  const eps = Array.isArray(outline?.episodes) ? outline.episodes : [];
  const total = outline?.params?.episodes ?? eps.length;
  // props 是后加的字段。**没有这个字段的旧大纲要照常通过**——两道相关的门
  // 都明说跳过而不是报错，否则每一份存量 outline.json 一升级就全红。
  const hasProps = Array.isArray(outline?.props);
  const props = hasProps ? outline.props : [];

  // G1a–G1c 角色分档上限。主角组还要求至少 1 人——没有主角的剧不成立
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

  // G2 主场景上限
  const primary = scenes.filter((s) => s?.primary);
  add('scene-cap', `主场景 ≤ ${th.maxPrimaryScenes}`, scenes.length > 0 && primary.length <= th.maxPrimaryScenes, `${primary.length} 个`);

  // G2b 叙事道具上限。只收有特写、跨集、承载剧情的那几件；数量失控说明把场景
  // 陈设也收进来了。没有 props 字段的旧大纲明说跳过，不判失败。
  add(
    'prop-cap',
    `叙事道具 ≤ ${th.maxProps} 件`,
    !hasProps || props.length <= th.maxProps,
    hasProps ? `${props.length} 件` : '大纲没有 props 字段，跳过',
  );

  // 场景/角色使用统计（G3、G10 共用）。
  // 只给已登记的 id 计数——未知 id 塞进索引会让「引用不存在」那道门形同虚设。
  const sceneUse = new Map(scenes.map((s) => [s?.id, 0]));
  const charUse = new Map(chars.map((c) => [c?.id, 0]));
  const propUse = new Map(props.map((pr) => [pr?.id, 0]));
  for (const e of eps) {
    for (const id of e?.sceneIds ?? []) if (sceneUse.has(id)) sceneUse.set(id, sceneUse.get(id) + 1);
    for (const id of e?.characterIds ?? []) if (charUse.has(id)) charUse.set(id, charUse.get(id) + 1);
    for (const id of e?.propIds ?? []) if (propUse.has(id)) propUse.set(id, propUse.get(id) + 1);
  }

  // G3 一次性场景要有规避方案
  const onceNoPlan = scenes.filter((s) => sceneUse.get(s?.id) === 1 && !thText(s?.reusePlan));
  add(
    'once-scene',
    '一次性场景已标注规避方案',
    eps.length > 0 && onceNoPlan.length === 0,
    onceNoPlan.length ? `缺：${onceNoPlan.map((s) => s.name ?? s.id).join('、')}` : '',
  );

  // G4 爽点间隔 ≤ N，首尾无真空
  const beatEps = [...new Set(beats.map((b) => b?.episode).filter((n) => Number.isInteger(n)))].sort((a, b) => a - b);
  let gapOk = beatEps.length > 0 && total > 0;
  let gapDetail = '';
  if (gapOk) {
    if (beatEps[0] > th.maxBeatGap) {
      gapOk = false;
      gapDetail = `开头 ${beatEps[0] - 1} 集真空`;
    }
    for (let i = 1; i < beatEps.length && gapOk; i++) {
      if (beatEps[i] - beatEps[i - 1] > th.maxBeatGap) {
        gapOk = false;
        gapDetail = `第 ${beatEps[i - 1]}–${beatEps[i]} 集之间断档`;
      }
    }
    if (gapOk && total - beatEps[beatEps.length - 1] >= th.maxBeatGap) {
      gapOk = false;
      gapDetail = `结尾 ${total - beatEps[beatEps.length - 1]} 集真空`;
    }
  }
  add('beat-gap', `爽点间隔 ≤ ${th.maxBeatGap} 集，无真空区`, gapOk, gapDetail);

  // G5 第 1 集有钩子
  add('ep1-hook', '第 1 集有钩子', eps.length > 0 && thText(eps[0]?.hook), '');

  // G6 大爆点不能到最后一集才第一次出现
  const majors = beats.filter((b) => (b?.weight ?? 'minor') === 'major').map((b) => b.episode);
  add(
    'major-early',
    '大爆点不在最后一集才首次出现',
    majors.length > 0 && (total === 1 || Math.min(...majors) < total),
    majors.length ? `最早在第 ${Math.min(...majors)} 集` : '没有 major 爽点',
  );

  // G7 每集三栏齐全（钩子/悬念必填）
  const incomplete = eps.filter((e) => !EP_TEXT_FIELDS.every((f) => thText(e?.[f])));
  add(
    'ep-fields',
    '每集梗概三栏齐全（含【钩子】【悬念】）',
    eps.length > 0 && incomplete.length === 0,
    incomplete.length ? `缺栏：第 ${incomplete.map((e) => e.ep).join('、')} 集` : '',
  );

  // G8 三人以上同框要有拆解方案
  const crowdBad = eps.filter((e) => (e?.characterIds?.length ?? 0) >= 3 && !thText(e?.crowdPlan));
  add(
    'crowd-plan',
    '三人以上同框已标注拆解方案',
    crowdBad.length === 0,
    crowdBad.length ? `缺：第 ${crowdBad.map((e) => e.ep).join('、')} 集` : '',
  );

  // G9 生成难点进预警清单（关键词扫描，宁可多报）
  const riskBad = [];
  for (const e of eps) {
    const text = EP_TEXT_FIELDS.map((f) => e?.[f] ?? '').join(' ');
    for (const [risk, re] of Object.entries(RISK_PATTERNS)) {
      if (re.test(text) && !(e?.warnings ?? []).includes(risk)) riskBad.push(`第 ${e.ep} 集缺「${risk}」`);
    }
  }
  add('risk-flag', '生成难点已进预警清单', eps.length > 0 && riskBad.length === 0, riskBad.join('；'));

  // G10 引用完整：ID 都存在、没有失业角色、没有空转场景
  const refBad = [];
  for (const e of eps) {
    for (const id of e?.sceneIds ?? []) if (!sceneUse.has(id)) refBad.push(`第 ${e.ep} 集引用了不存在的场景 ${id}`);
    for (const id of e?.characterIds ?? []) if (!charUse.has(id)) refBad.push(`第 ${e.ep} 集引用了不存在的角色 ${id}`);
    if (hasProps) {
      for (const id of e?.propIds ?? []) if (!propUse.has(id)) refBad.push(`第 ${e.ep} 集引用了不存在的道具 ${id}`);
    }
  }
  for (const b of beats) {
    if (Number.isInteger(b?.episode) && (b.episode < 1 || b.episode > total)) {
      refBad.push(`爽点 ${b.id} 落在不存在的第 ${b.episode} 集`);
    }
  }
  for (const [id, n] of charUse) if (n === 0) refBad.push(`角色 ${id} 从未在任何一集出现`);
  for (const [id, n] of sceneUse) if (n === 0) refBad.push(`场景 ${id} 从未被用到`);
  if (hasProps) {
    for (const [id, n] of propUse) if (n === 0) refBad.push(`道具 ${id} 从未在任何一集出现`);
    // 道具关联的爽点必须真的存在——beatIds 指错等于这件道具没有戏剧理由
    const beatIds = new Set(beats.map((b) => b?.id));
    for (const pr of props) {
      for (const bid of pr?.beatIds ?? []) {
        if (!beatIds.has(bid)) refBad.push(`道具 ${pr.id} 关联了不存在的爽点 ${bid}`);
      }
    }
  }
  add(
    'refs',
    hasProps ? '场景/角色/道具引用完整，无失业角色、无空转场景、无零集道具' : '场景/角色引用完整，无失业角色、无空转场景',
    eps.length > 0 && refBad.length === 0,
    refBad.join('；'),
    hasProps ? 'refs-props' : null,
  );

  // G11 梗概是叙述体
  const dlgBad = eps.filter((e) => EP_TEXT_FIELDS.some((f) => DIALOGUE_RE.test(e?.[f] ?? '')));
  add(
    'no-dialogue',
    '梗概是叙述体，无引号对白',
    dlgBad.length === 0,
    dlgBad.length ? `第 ${dlgBad.map((e) => e.ep).join('、')} 集出现引号` : '',
  );

  return gates;
}

/* ------------------------------------------------------------------ */
/* validate                                                            */
/* ------------------------------------------------------------------ */
/*
 * 三档 stage 就是流程门：
 *   skeleton — 改编说明 + 人物 + 场景（快版拍板前）
 *   beats    — skeleton + 爽点表（写分集之前必须过这档）
 *   full     — 全部（默认）
 * 「步骤 4 完成前不允许写分集梗概」靠这个变成可执行的，而不是一句话。
 */

export const STAGES = ['skeleton', 'beats', 'full'];

export function validateOutline(outline, stage = 'full') {
  const problems = [];
  const p = (msg) => problems.push(msg);
  if (!outline || typeof outline !== 'object') return ['outline 不是对象'];
  const th = thresholdsOf(outline);

  // --- params ---
  const params = outline.params;
  if (!params || typeof params !== 'object') {
    p('缺少 params（总集数/单集时长/题材/改编幅度）');
  } else {
    if (!Number.isInteger(params.episodes) || params.episodes < 1) p('params.episodes 必须是正整数');
    if (!(params.minutesPerEpisode > 0)) p('params.minutesPerEpisode 必须大于 0');
    if (!thText(params.genre)) p('params.genre 缺失——题材决定爽点类型，不能缺');
    if (!ADAPT_MODES.includes(params.adaptMode)) {
      p(`params.adaptMode 必须是 ${ADAPT_MODES.join('/')}，实际是 ${JSON.stringify(params.adaptMode)}`);
    }
  }

  // --- adaptation 改编说明 ---
  const ad = outline.adaptation;
  if (!ad || typeof ad !== 'object') {
    p('缺少 adaptation（改编说明）');
  } else {
    if (!thText(ad.core)) p('adaptation.core 缺失——一句话核心是整份大纲的锚');
    for (const key of ['keep', 'cut', 'merge', 'risks']) {
      if (!Array.isArray(ad[key])) p(`adaptation.${key} 必须是数组`);
    }
    if (Array.isArray(ad.keep) && ad.keep.length === 0) p('adaptation.keep 至少要有一条——什么都不保还改编什么');
    if (params?.adaptMode && params.adaptMode !== '忠实' && Array.isArray(ad.cut) && ad.cut.length === 0) {
      p(`adaptMode=${params.adaptMode} 却一条线都没砍，说不过去`);
    }
    for (const [key, fields] of [['keep', ['what', 'why']], ['cut', ['what', 'why']], ['merge', ['what', 'why']], ['risks', ['what', 'plan']]]) {
      for (const item of ad[key] ?? []) {
        for (const f of fields) if (!thText(item?.[f])) p(`adaptation.${key} 里有条目缺 ${f}`);
      }
    }
    // 决策补注（可选）：给了就不能是空壳
    for (const f of ['cutNote', 'mergeNote']) {
      if (ad[f] !== undefined && !thText(ad[f])) p(`adaptation.${f} 给了但是空的——要么写结论，要么删掉这个键`);
    }
  }

  // --- characters 人物表 ---
  const chars = outline.characters;
  if (!Array.isArray(chars) || chars.length === 0) {
    p('characters 为空');
  } else {
    const tierCap = { lead: th.maxLeads, support: th.maxSupport, functional: th.maxFunctional };
    for (const tier of CHARACTER_TIERS) {
      const n = chars.filter((c) => c?.tier === tier).length;
      if (n > tierCap[tier]) p(`${TIER_LABELS[tier]} ${n} 位，超过上限 ${tierCap[tier]}`);
    }
    if (!chars.some((c) => c?.tier === 'lead')) p('没有主角组（tier=lead）角色');
    const seen = new Set();
    for (const c of chars) {
      const label = c?.name ?? c?.id ?? '(无名)';
      if (!/^C\d{2,}$/.test(c?.id ?? '')) p(`[${label}] 角色 id 必须是 C01 这种格式`);
      if (seen.has(c?.id)) p(`角色 id ${c.id} 重复`);
      seen.add(c?.id);
      if (!CHARACTER_TIERS.includes(c?.tier)) {
        p(`[${label}] tier 必须是 ${CHARACTER_TIERS.join('/')}（主角组/重要配角/功能性角色）`);
      }
      for (const f of ['name', 'role']) if (!thText(c?.[f])) p(`[${label}] 缺 ${f}`);
      // 功能性角色没有弧光是正常的——医生就是来缝针的
      if (c?.tier !== 'functional' && !thText(c?.arc)) p(`[${label}] 缺 arc（主角组和重要配角必须有人物弧）`);
      if (!Array.isArray(c?.from) || c.from.length === 0 || !c.from.every(thText)) {
        p(`[${label}] 缺 from（← 改动记录：原著对应谁、合并了谁）`);
      }
    }
  }

  // --- scenes ---
  const scenes = outline.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    p('scenes 为空');
  } else {
    const primaryN = scenes.filter((s) => s?.primary).length;
    if (primaryN > th.maxPrimaryScenes) p(`主场景 ${primaryN} 个，超过上限 ${th.maxPrimaryScenes}`);
    const seen = new Set();
    for (const s of scenes) {
      const label = s?.name ?? s?.id ?? '(无名)';
      if (!/^S\d{2,}$/.test(s?.id ?? '')) p(`[${label}] 场景 id 必须是 S01 这种格式`);
      if (seen.has(s?.id)) p(`场景 id ${s.id} 重复`);
      seen.add(s?.id);
      if (!thText(s?.name)) p(`[${s?.id}] 场景缺 name`);
      if (typeof s?.primary !== 'boolean') p(`[${label}] 场景缺 primary（是不是主场景）`);
    }
  }

  // --- props 叙事道具 ---
  // 可选字段：旧大纲没有 props 照常通过。写了就按结构查。
  if (Array.isArray(outline?.props)) {
    if (outline.props.length > th.maxProps) p(`叙事道具 ${outline.props.length} 件，超过上限 ${th.maxProps}`);
    const seenP = new Set();
    for (const pr of outline.props) {
      const label = pr?.name ?? pr?.id ?? '(无名)';
      if (!/^P\d{2,}$/.test(pr?.id ?? '')) p(`[${label}] 道具 id 必须是 P01 这种格式`);
      if (seenP.has(pr?.id)) p(`道具 id ${pr.id} 重复`);
      seenP.add(pr?.id);
      if (!thText(pr?.name)) p(`[${pr?.id}] 道具缺 name`);
      // function 是这一层唯一要拍板的东西：这件物件在戏里承载什么。
      // 填不出来说明它不是叙事道具，是场景陈设——那归 novel-art 的场景锚点管。
      if (!thText(pr?.function)) p(`[${label}] 道具缺 function（它在戏里承载什么；填不出来就不该进这张表）`);
      if (pr?.beatIds !== undefined && !Array.isArray(pr.beatIds)) p(`[${label}] beatIds 必须是数组`);
    }
  }

  if (stage === 'skeleton') return problems;

  // --- beats 爽点表 ---
  const beats = outline.beats;
  if (!Array.isArray(beats) || beats.length === 0) {
    p('beats 为空——爽点表是排片的骨架');
  } else {
    const seen = new Set();
    for (const b of beats) {
      const label = b?.id ?? '(无 id)';
      if (!/^B\d{2,}$/.test(b?.id ?? '')) p(`[${label}] 爽点 id 必须是 B01 这种格式`);
      if (seen.has(b?.id)) p(`爽点 id ${b.id} 重复`);
      seen.add(b?.id);
      if (!thText(b?.type)) p(`[${label}] 缺 type（打脸/揭破/反转……）`);
      if (b?.weight !== undefined && !BEAT_WEIGHTS.includes(b.weight)) p(`[${label}] weight 只能是 ${BEAT_WEIGHTS.join('/')}`);
      if (!Number.isInteger(b?.episode) || b.episode < 1) p(`[${label}] episode 必须是正整数`);
      for (const f of ['setup', 'payoff']) if (!thText(b?.[f])) p(`[${label}] 缺 ${f}`);
    }
    // 间隔与 major 时机在 beats 档就要卡住——这两条错了，分集写完全废
    for (const g of gateReport(outline)) {
      if ((g.id === 'beat-gap' || g.id === 'major-early') && !g.ok) {
        p(`质量门未过：${g.label}${g.detail ? `（${g.detail}）` : ''}`);
      }
    }
  }

  if (stage === 'beats') return problems;

  // --- episodes 分集梗概 ---
  const eps = outline.episodes;
  if (!Array.isArray(eps) || eps.length === 0) {
    p('episodes 为空');
  } else {
    if (params?.episodes && eps.length !== params.episodes) {
      p(`分集写了 ${eps.length} 集，params.episodes 说好 ${params.episodes} 集`);
    }
    eps.forEach((e, i) => {
      if (e?.ep !== i + 1) p(`第 ${i + 1} 个条目的 ep 是 ${e?.ep}，编号必须从 1 连续`);
      if (!Array.isArray(e?.sceneIds) || e.sceneIds.length === 0) p(`第 ${e?.ep} 集缺 sceneIds`);
      if (!Array.isArray(e?.characterIds) || e.characterIds.length === 0) p(`第 ${e?.ep} 集缺 characterIds`);
      if (e?.warnings !== undefined && !Array.isArray(e.warnings)) p(`第 ${e?.ep} 集 warnings 必须是数组`);
    });
    // 其余全部质量门（beats 档已报过的两条不再重复）
    for (const g of gateReport(outline)) {
      if (g.id === 'beat-gap' || g.id === 'major-early') continue;
      if (!g.ok) p(`质量门未过：${g.label}${g.detail ? `（${g.detail}）` : ''}`);
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ */
/* 资产清单 — 算出来的，不让模型写                                        */
/* ------------------------------------------------------------------ */
/*
 * 五件套的第五件。分集既然带了场景 ID + 角色 ID，
 * 资产清单就是纯汇总——让模型手写它一定会漏。
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

  // 道具跟场景同一个套路：分集既然带了 propIds，清单就是纯汇总。
  // 没有 props 字段的旧大纲返回空数组，调用方按空处理即可。
  const props = (outline?.props ?? []).map((pr) => {
    const episodes = eps.filter((e) => (e?.propIds ?? []).includes(pr.id)).map((e) => e.ep);
    return {
      id: pr.id, name: pr.name, function: pr.function ?? '',
      uses: episodes.length, episodes, beatIds: pr.beatIds ?? [],
    };
  });

  // 角色资产量折算：每档要备多少张脸、备到什么程度
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

  return { scenes, characters, props, castPlan, warnings, beatsByType };
}

/* ------------------------------------------------------------------ */
/* render — 界面文案                                                    */
/* ------------------------------------------------------------------ */
/*
 * 内置 zh / en 两套。全部文案收在这张表里，别把字符串散进模板——
 * 再加语言就是再加一个键（novel-characters 就是这么长出来的）。
 * 只翻译界面：outline.json 里的数据（爽点类型、改编幅度、质量门 label）原样出。
 */

/* 门标签与「跳过」提示的英文映射：质量门面板是报告的一部分，出英文报告时
 * 这里做展示层翻译——gateReport 的逻辑与中文诊断文案一行不动（CLI 仍是中文）。
 * 动态阈值由门自己算，映射里只写固定语义；未命中的 id 回落到原标签。 */
const GATE_LABELS_EN = {
  'lead-cap': 'Leads {0}–{1}',
  'support-cap': 'Named supporting cast ≤ {0}',
  'functional-cap': 'Functional roles ≤ {0}',
  'scene-cap': 'Primary scenes ≤ {0}',
  'once-scene': 'One-off scenes carry a reuse plan',
  'beat-gap': 'Beat gap ≤ {0} episodes, no dead zone',
  'ep1-hook': 'Episode 1 has a hook',
  'major-early': 'Major beats do not first appear only in the final episode',
  'ep-fields': 'All three fields per episode (synopsis, hook, suspense)',
  'crowd-plan': 'Three or more on screen carries a breakdown plan',
  'risk-flag': 'Production risks flagged in the warning list',
  'prop-cap': 'Narrative props ≤ {0}',
  'refs': 'Scene / character references complete — no jobless characters, no unused scenes',
  'refs-props': 'Scene / character / prop references complete — no jobless characters, no unused scenes, no unused props',
  'no-dialogue': 'Synopses in narrative prose, no quoted dialogue',
};
const GATE_SKIPS_EN = {
    '未提供 outline.json，本门跳过（视为通过）': 'outline.json not provided — gate skipped (treated as passing)',
    '未提供 art.json，本门跳过（视为通过）': 'art.json not provided — gate skipped (treated as passing)',
    '未提供 script.json，本门跳过（视为通过）': 'script.json not provided — gate skipped (treated as passing)',
    '未提供 outline/cast，本门跳过（视为通过）': 'outline/cast not provided — gate skipped (treated as passing)',
    '未提供 cast.json，本门跳过（视为通过）': 'cast.json not provided — gate skipped (treated as passing)',
};
/** 报告里的门文案：英文界面取映射，未命中或中文界面回落原文。 */
const gateText = (g, lang) => {
  if (lang !== 'en') return { label: g.label, detail: g.detail };
  const en = GATE_LABELS_EN[g.enKey ?? g.id];
  // 阈值仍由门自己算：把中文标签里出现的数字按序填进 {0} {1}
  const nums = String(g.label).match(/\d+(?:\.\d+)?/g) ?? [];
  const label = en ? en.replace(/\{(\d)\}/g, (m, i) => nums[Number(i)] ?? m) : g.label;
  return { label, detail: GATE_SKIPS_EN[g.detail] ?? g.detail };
};

const I18N = {
  zh: {
    langCode: 'zh',
    htmlLang: 'zh',
    kicker: '短剧改编大纲',
    docTitle: (s) => `${s} · 短剧改编大纲`,
    paramsLine: (p) =>
      `${p.episodes} 集 × ${p.minutesPerEpisode} 分钟 · ${p.genre} · ${p.adaptMode}改编`,
    exportJson: '导出 JSON',
    gates: '质量门',
    gatesPass: '全部通过',
    gatesFail: (n) => `${n} 项未过`,
    gatePill: (okN, total) => `质量门 ${okN} / ${total}`,
    sections: {
      decisions: '关键决策', rhythm: '爽点节奏', episodes: '分集梗概',
      episodesOverview: '分集概览', matrix: '每集调度矩阵',
      sceneOverview: '场景概览', plan: '资产量折算', gates: '质量门',
      adaptation: '改编说明', characters: '人物表', beats: '爽点表', assets: '资产清单',
    },
    dec: {
      cut: '砍了哪条线', merge: '合了哪些人', majors: '大爆点落在第几集',
      castSlots: (n, l, s, f) => `${n} 个角色位（主角组 ${l} · 重要配角 ${s} · 功能性 ${f}）`,
      leads: '主角组', noCut: '未砍线（忠实改编）', noMajor: '没有 major 爽点',
      first: '首个', final: '终局',
    },
    secNotes: {
      decisions: '拍板过的三件事，落进纸面',
      rhythm: (gap) => `间隔 ≤ ${gap} 集 · 无真空区`,
      episodes: '核心交付 · 每集三栏齐全',
      matrix: '一列 = 这一集要谁、在哪拍',
      sceneOverview: '右上 = 出现集',
      plan: '按档自动折算 · 不让模型写',
      adaptation: '为什么这么改 · 附原文依据',
    },
    kpi: {
      episodes: '总集数', perEp: (m) => `× ${m} 分钟`, runtime: (m) => `正片约 ${m} 分钟`,
      beats: '爽点', beatsSub: (major, gap) => `${major} 大爆点${gap ? ` · 最大间隔 ${gap} 集` : ''}`,
      cast: '角色', castSub: (l, s, f) => `主角 ${l} · 配角 ${s} · 功能 ${f}`,
      scenes: '主场景', scenesOnce: (n) => (n ? `一次性场景 ${n}，需复用方案` : '无一次性场景'),
      risks: '生成难点', risksNone: '预警清单为空',
      mode: '改编幅度', modeSub: (cut, merge) => `砍 ${cut} 线 · 合 ${merge} 组`,
    },
    legendMajor: '大爆点', legendMinor: '常规爽点',
    gapNote: (n) => `— ${n} 集空档 —`,
    tabTimeline: '时间轴', tabTable: '明细表',
    showAllEps: (n) => `展开全部 ${n} 集`,
    assetsAuto: '（由分集数据自动汇总）',
    core: '一句话核心',
    keep: '保留', cut: '砍掉', merge: '合并', risks: '风险与对策',
    what: '内容', why: '理由', plan: '对策', evidence: '原文依据',
    charCols: ['ID', '角色', '层级', '定位', '人物弧', '← 改动记录'],
    tier: TIER_LABELS,
    tierSpec: TIER_ASSET_SPEC,
    castPlanTitle: '角色资产量折算',
    castPlanCols: ['层级', '人数', '角色', '资产量'],
    planSceneRow: '场景环境',
    planSceneSpec: '主场景各一套环境参考 + 光照基调',
    planSceneReuse: (names) => `（+${names.join('、')}复用）`,
    planPropRow: '叙事道具',
    planPropSpec: '每件一套白底设定图 + 状态变体，跨集要长一样',
    planRiskRow: '生成难点',
    planRiskSpec: '拍摄前逐条过预警清单',
    beatCols: ['ID', '类型', '量级', '集', '铺垫', '兑现'],
    weight: { major: '大爆点', minor: '常规' },
    rhythm: '爽点节奏',
    rhythmLegend: '■ 大爆点　□ 常规　· 无爽点',
    matrixHead: '角色 / 场景 / 道具',
    matrixTier: '层级',
    matrixTotal: '合计',
    matrixScenes: '场　景',
    matrixProps: '道　具',
    onceScene: '一次性',
    primaryScene: '主场景',
    reusePlanLabel: '复用方案',
    beatsCarried: '承载爽点',
    castSeen: '出场角色',
    crowdOk: '同框拆解 ✓',
    epTitle: (n) => `第 ${n} 集`,
    epHook: '钩子',
    epSuspense: '悬念',
    epScenes: '场景',
    epCast: '人物',
    epCrowd: '同框拆解',
    epWarnings: '预警',
    epsParen: (list) => `（第 ${list.join('、')} 集）`,
    epsCount: (n) => `${n} 集`,
    sceneCols: ['ID', '场景', '主场景', '出现集', '次数', '复用方案'],
    propCols: ['ID', '道具', '承载什么', '出现集', '次数', '关联爽点'],
    castCols: ['ID', '角色', '定位', '出现集', '次数'],
    warnCols: ['难点', '涉及集'],
    beatTypeCols: ['爽点类型', '落点（集）'],
    yes: '是', no: '否',
    none: '—',
    sep: '、', semi: '；', colon: '：', pairSep: '　', tipSep: '｜',
    brk: (s) => `【${s}】`,
    mdSec: (n, title) => `${'一二三四五六七八九'[n - 1]}、${title}`,
    colophon: '大纲由模型依据原文生成，质量门由脚本确定性检查。',
  },
  en: {
    langCode: 'en',
    htmlLang: 'en',
    kicker: 'Short-drama adaptation outline',
    docTitle: (s) => `${s} · Short-Drama Adaptation Outline`,
    paramsLine: (p) =>
      `${p.episodes} eps × ${p.minutesPerEpisode} min · ${p.genre} · ${p.adaptMode} adaptation`,
    exportJson: 'Export JSON',
    gates: 'Quality gates',
    gatesPass: 'All passed',
    gatesFail: (n) => `${n} failed`,
    gatePill: (okN, total) => `Gates ${okN} / ${total}`,
    sections: {
      decisions: 'Key decisions', rhythm: 'Beat rhythm', episodes: 'Per-episode synopses',
      episodesOverview: 'Episode overview', matrix: 'Dispatch matrix',
      sceneOverview: 'Scene overview', plan: 'Asset conversion', gates: 'Quality gates',
      adaptation: 'Adaptation notes', characters: 'Cast table', beats: 'Beat table', assets: 'Asset list',
    },
    dec: {
      cut: 'Which lines were cut', merge: 'Who got merged', majors: 'Where the major beats land',
      castSlots: (n, l, s, f) => `${n} cast slots (leads ${l} · supporting ${s} · functional ${f})`,
      leads: 'Leads', noCut: 'No lines cut (faithful adaptation)', noMajor: 'No major beats',
      first: 'First', final: 'Final',
    },
    secNotes: {
      decisions: 'The three sign-off items, on paper',
      rhythm: (gap) => `gap ≤ ${gap} eps · no dead zones`,
      episodes: 'Core deliverable · three fields per episode',
      matrix: 'One column = who and where for that episode',
      sceneOverview: 'Top right = episodes present',
      plan: 'Converted per tier · never hand-written',
      adaptation: 'Why these changes · with source evidence',
    },
    kpi: {
      episodes: 'Episodes', perEp: (m) => `× ${m} min`, runtime: (m) => `about ${m} min of footage`,
      beats: 'Beats', beatsSub: (major, gap) => `${major} major${gap ? ` · max gap ${gap} eps` : ''}`,
      cast: 'Cast', castSub: (l, s, f) => `leads ${l} · support ${s} · functional ${f}`,
      scenes: 'Primary scenes', scenesOnce: (n) => (n ? `${n} one-off, reuse plan required` : 'No one-off scenes'),
      risks: 'Production risks', risksNone: 'Warning list empty',
      mode: 'Adaptation mode', modeSub: (cut, merge) => `${cut} line(s) cut · ${merge} merge(s)`,
    },
    legendMajor: 'Major beat', legendMinor: 'Minor beat',
    gapNote: (n) => `— ${n}-ep gap —`,
    tabTimeline: 'Timeline', tabTable: 'Table',
    showAllEps: (n) => `Show all ${n} episodes`,
    assetsAuto: ' (auto-aggregated from episode data)',
    core: 'One-line core',
    keep: 'Keep', cut: 'Cut', merge: 'Merge', risks: 'Risks & plans',
    what: 'What', why: 'Why', plan: 'Plan', evidence: 'Evidence',
    charCols: ['ID', 'Name', 'Tier', 'Role', 'Arc', '← Change record'],
    tier: { lead: 'Lead', support: 'Named supporting', functional: 'Functional' },
    tierSpec: {
      lead: 'Full model sheets + per-shot consistency checks',
      support: 'Bust reference, checks on key scenes',
      functional: 'Prompt-only, loose consistency is fine',
    },
    castPlanTitle: 'Cast asset conversion',
    castPlanCols: ['Tier', 'Count', 'Cast', 'Asset workload'],
    planSceneRow: 'Scene environments',
    planSceneSpec: 'One environment reference set + lighting key per primary scene',
    planSceneReuse: (names) => ` (+ ${names.join(', ')} via reuse)`,
    planPropRow: 'Narrative props',
    planPropSpec: 'One white-plate sheet plus state variants each; must stay identical across episodes',
    planRiskRow: 'Production risks',
    planRiskSpec: 'Walk the warning list before generation',
    beatCols: ['ID', 'Type', 'Weight', 'Ep', 'Setup', 'Payoff'],
    weight: { major: 'Major', minor: 'Minor' },
    rhythm: 'Beat rhythm',
    rhythmLegend: '■ major　□ minor　· none',
    matrixHead: 'Character / Scene / Prop',
    matrixTier: 'Tier',
    matrixTotal: 'Total',
    matrixScenes: 'Scenes',
    matrixProps: 'Props',
    onceScene: 'One-off',
    primaryScene: 'Primary',
    reusePlanLabel: 'Reuse plan',
    beatsCarried: 'Beats carried',
    castSeen: 'Cast seen',
    crowdOk: 'Crowd plan ✓',
    epTitle: (n) => `Episode ${n}`,
    epHook: 'Hook',
    epSuspense: 'Suspense',
    epScenes: 'Scenes',
    epCast: 'Cast',
    epCrowd: 'Crowd plan',
    epWarnings: 'Warnings',
    epsParen: (list) => ` (ep ${list.join(', ')})`,
    epsCount: (n) => `${n} eps`,
    sceneCols: ['ID', 'Scene', 'Primary', 'Episodes', 'Uses', 'Reuse plan'],
    propCols: ['ID', 'Prop', 'What it carries', 'Episodes', 'Uses', 'Beats'],
    castCols: ['ID', 'Name', 'Role', 'Episodes', 'Uses'],
    warnCols: ['Risk', 'Episodes'],
    beatTypeCols: ['Beat type', 'Episodes'],
    yes: 'Yes', no: 'No',
    none: '—',
    sep: ', ', semi: '; ', colon: ': ', pairSep: ' · ', tipSep: ' | ',
    brk: (s) => `[${s}]`,
    mdSec: (n, title) => `${n}. ${title}`,
    colophon: 'Outline generated by the model from the source text; quality gates checked deterministically by script.',
  },
};

const tOf = (lang) => {
  if (lang && !I18N[lang]) throw new Error('报告界面语言目前内置 zh / en');
  return I18N[lang ?? 'zh'];
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

/** 人物表按档排：主角组在前，功能性角色垫底。 */
const byTier = (characters) =>
  [...characters].sort((a, b) => CHARACTER_TIERS.indexOf(a.tier) - CHARACTER_TIERS.indexOf(b.tier));

export function renderMarkdown(outline, lang) {
  const { source, params, adaptation: ad, characters, beats, episodes } = outline;
  const t = tOf(lang ?? outline?.lang);
  const assets = computeAssets(outline);
  const gates = gateReport(outline);
  const out = [];

  out.push(`# ${t.docTitle(source)}`, '', `> ${t.paramsLine(params)}`, '');

  // 质量门放最前面——先看有没有病，再看内容
  out.push(`## ${t.gates}`, '');
  for (const g of gates) out.push(`- ${g.ok ? '✅' : '❌'} ${gateText(g, t.langCode).label}${!g.ok && g.detail ? ` — ${gateText(g, t.langCode).detail}` : ''}`);
  out.push('');

  out.push(`## ${t.mdSec(1, t.sections.adaptation)}`, '', `**${t.core}**${t.pairSep}${ad.core}`, '');
  const adTable = (title, rows, fields, labels) => {
    if (!rows?.length) return;
    out.push(`### ${title}`, '', mdHead(labels));
    for (const r of rows) out.push(mdRow(fields.map((f) => r[f] ?? '')));
    out.push('');
  };
  adTable(t.keep, ad.keep, ['what', 'why', 'evidence'], [t.what, t.why, t.evidence]);
  adTable(t.cut, ad.cut, ['what', 'why'], [t.what, t.why]);
  adTable(t.merge, ad.merge, ['what', 'why'], [t.what, t.why]);
  adTable(t.risks, ad.risks, ['what', 'plan'], [t.what, t.plan]);

  out.push(`## ${t.mdSec(2, t.sections.characters)}`, '', mdHead(t.charCols));
  for (const c of byTier(characters)) {
    out.push(mdRow([c.id, c.name, t.tier[c.tier] ?? c.tier, c.role, c.arc ?? '—', c.from.join(t.semi)]));
  }
  out.push('');

  out.push(`## ${t.mdSec(3, t.sections.beats)}`, '', mdHead(t.beatCols));
  for (const b of beats) {
    out.push(mdRow([b.id, b.type, t.weight[b.weight ?? 'minor'], b.episode, b.setup, b.payoff]));
  }
  out.push('');

  out.push(`## ${t.mdSec(4, t.sections.episodes)}`, '');
  for (const e of episodes) {
    out.push(`### ${t.epTitle(e.ep)}`, '', e.synopsis, '');
    out.push(`- **${t.brk(t.epHook)}** ${e.hook}`);
    out.push(`- **${t.brk(t.epSuspense)}** ${e.suspense}`);
    out.push(`- ${t.epScenes}${t.colon}${e.sceneIds.join(t.sep)}${t.pairSep}${t.epCast}${t.colon}${e.characterIds.join(t.sep)}`);
    if (e.crowdPlan) out.push(`- ${t.epCrowd}${t.colon}${e.crowdPlan}`);
    if (e.warnings?.length) out.push(`- ⚠️ ${t.epWarnings}${t.colon}${e.warnings.join(t.sep)}`);
    out.push('');
  }

  out.push(`## ${t.mdSec(5, t.sections.assets)}${t.assetsAuto}`, '');
  out.push(mdHead(t.sceneCols));
  for (const s of assets.scenes) {
    out.push(mdRow([s.id, s.name, s.primary ? t.yes : t.no, s.episodes.join(t.sep), s.uses, s.reusePlan ?? '—']));
  }
  // 道具表：没有 props 的旧大纲不出这张表，不留一张空表占位
  if (assets.props.length) {
    out.push('', mdHead(t.propCols));
    for (const pr of assets.props) {
      out.push(mdRow([pr.id, pr.name, pr.function, pr.episodes.join(t.sep), pr.uses, pr.beatIds.join(t.sep) || '—']));
    }
  }
  out.push('', mdHead(t.castCols));
  for (const c of assets.characters) out.push(mdRow([c.id, c.name, c.role, c.episodes.join(t.sep), c.uses]));
  out.push('');
  out.push(`### ${t.castPlanTitle}`, '', mdHead(t.castPlanCols));
  for (const t2 of assets.castPlan) {
    out.push(mdRow([t.tier[t2.tier] ?? t2.label, t2.count, t2.names.join(t.sep) || '—', t.tierSpec[t2.tier] ?? t2.spec]));
  }
  out.push('');
  if (Object.keys(assets.warnings).length) {
    out.push(mdHead(t.warnCols));
    for (const [w, epsIn] of Object.entries(assets.warnings)) out.push(mdRow([w, epsIn.join(t.sep)]));
    out.push('');
  }
  out.push(mdHead(t.beatTypeCols));
  for (const [type, epsIn] of Object.entries(assets.beatsByType)) out.push(mdRow([type, epsIn.join(t.sep)]));
  out.push('');

  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* render — html                                                       */
/* ------------------------------------------------------------------ */
/*
 * 业内评审用的单页报告：1600 宽，全部平铺可 Cmd+F。设计约定见
 * references/report-style.md。区块顺序按「先交付后存档」排：
 *   KPI 带 → 爽点节奏（时间轴）→ 分集梗概 → 调度矩阵 + 场景概览
 *   → 资产量折算 → 人物表 → 改编说明 → 质量门
 * 所有图形都是内联 SVG/CSS —— 不引任何库，报告离线双击能开。
 * 配色跑过 dataviz 验证器：大爆点 #8a3324 / 常规 #c56a4e，六项全过。
 */

/** 报告里内嵌的数据就是 outline.json 原样——编辑完能直接喂回 render。 */
function embedOutline(outline) {
  return JSON.stringify(outline).replace(/</g, '\\u003c');
}

/** SVG 坐标保留一位小数，别把浮点尾巴写进产物。 */
const r1 = (n) => Math.round(n * 10) / 10;

/** 截断到 n 个字，超出加省略号。按码点数，中英混排不劈字。 */
const snip = (s, n) => {
  const a = [...String(s ?? '')];
  return a.length > n ? `${a.slice(0, n).join('')}…` : String(s ?? '');
};

/**
 * 出现集列表 → 幽灵编号：连续区间合写（1,2,3 → 1–3），
 * 离散且不超过 4 个用间隔点（1 · 6），再多只报数量。
 */
export function fmtEps(eps, t = I18N.zh) {
  if (!eps?.length) return '—';
  const a = [...eps].sort((x, y) => x - y);
  if (a.length === 1) return String(a[0]);
  const consecutive = a.every((v, i) => i === 0 || v === a[i - 1] + 1);
  if (consecutive) return `${a[0]}–${a[a.length - 1]}`;
  if (a.length <= 4) return a.join(' · ');
  return t.epsCount(a.length);
}

/* ---------- 爽点节奏：剧情时间轴 ---------- */
/*
 * 一条地平线贯穿全剧，爽点是轴上的节点，标签上下交替防撞。
 * 60 集以上按每行 20 集折行，同一条轴的延续。
 * 空档直接标在轴上；超过 maxBeatGap 的空档标成铁锈红——违规在图上自己喊。
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
  const tickParts = []; // 刻度最后画——自带底衬，压在节点竖线上仍可读；反过来会被竖线盖住

  // 每行一条轴线 + 集刻度
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

  // 空档标注：同一行内、间距够宽才画；超阈值的标成铁锈红
  const beatEps = [...new Set(beats.map((b) => b.episode))].sort((a, b) => a - b);
  for (let i = 1; i < beatEps.length; i++) {
    const [e1, e2] = [beatEps[i - 1], beatEps[i]];
    const gap = e2 - e1 - 1;
    if (gap < 1 || rowOf(e1) !== rowOf(e2) || (e2 - e1) * colW < 120) continue;
    const bad = e2 - e1 > th.maxBeatGap;
    const mx = r1((Number(x(e1)) + Number(x(e2))) / 2);
    parts.push(`<text class="gapnote${bad ? ' bad' : ''}" x="${mx}" y="${axisY(e1) - 12}" text-anchor="middle">${esc(t.gapNote(gap))}</text>`);
  }

  // 节点：标签上下交替；同一集多个爽点时后来的翻到对面
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
    parts.push(`<circle class="bdot${major ? ' major' : ''}" cx="${cx}" cy="${cy}" r="${r}"><title>${esc(`${b.id} ${b.type}${t.tipSep}${b.setup} → ${b.payoff}`)}</title></circle>`);
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

export function renderHtml(outline, lang) {
  const { source, params, adaptation: ad, characters, beats, episodes } = outline;
  const t = tOf(lang ?? outline?.lang);
  const assets = computeAssets(outline);
  const gates = gateReport(outline);
  const failed = gates.filter((g) => !g.ok);
  const total = params.episodes;
  const beatsOf = (ep) => beats.filter((b) => b.episode === ep);

  // ---- KPI 带 ----
  const beatEps = [...new Set(beats.map((b) => b.episode))].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 1; i < beatEps.length; i++) maxGap = Math.max(maxGap, beatEps[i] - beatEps[i - 1]);
  const tierN = Object.fromEntries(assets.castPlan.map((p) => [p.tier, p.count]));
  const primaryScenes = assets.scenes.filter((s) => s.primary);
  const onceScenes = assets.scenes.filter((s) => s.uses === 1);
  const riskTotal = Object.values(assets.warnings).reduce((n, e) => n + e.length, 0);
  const riskSub = Object.entries(assets.warnings)
    .map(([w, e]) => `${w} ×${e.length}${t.epsParen(e)}`)
    .join(' · ');
  const majors = beats.filter((b) => (b.weight ?? 'minor') === 'major').length;

  const kpis = `<div class="kpis">
  <div class="kpi accent"><div class="l">${esc(t.kpi.episodes)}</div><div class="v">${total} <small>${esc(t.kpi.perEp(params.minutesPerEpisode))}</small></div><div class="d">${esc(t.kpi.runtime(total * params.minutesPerEpisode))}</div></div>
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
  <header><b>${esc(t.epTitle(e.ep))}</b>${bs.map((b) => `<i class="bt${(b.weight ?? 'minor') === 'major' ? ' major' : ''}">${esc(b.type)}</i>`).join('')}</header>
  <p class="syn">${esc(e.synopsis)}</p>
  <div class="hk"><b>${esc(t.epHook)}</b><span>${esc(e.hook)}</span></div>
  <div class="hk"><b>${esc(t.epSuspense)}</b><span>${esc(e.suspense)}</span></div>
  <div class="meta">${e.sceneIds.map((id) => `<i>${esc(id)}</i>`).join('')}${e.characterIds.map((id) => `<i>${esc(id)}</i>`).join('')}${(e.warnings ?? []).map((w) => `<i class="warn">${esc(w)}</i>`).join('')}${e.crowdPlan ? `<i class="warn" title="${esc(e.crowdPlan)}">${esc(t.crowdOk)}</i>` : ''}</div>
</article>`;
    })
    .join('\n');

  // ---- 每集调度矩阵 ----
  // 格宽随集数收：整行铺开的前提下尽量占满 1600 宽
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
    // 道具段：没有 props 的旧大纲整段不出，不留一个空标题
    ...(assets.props.length
      ? [
        `<tr class="div"><td colspan="${total + 3}">${esc(t.matrixProps)}</td></tr>`,
        ...assets.props.map((pr) =>
          mxRow(pr.name, pr.beatIds.join(t.sep) || t.none, pr.episodes, ' pp', String(pr.uses)),
        ),
      ]
      : []),
  ].join('\n');
  const onceNotes = assets.scenes
    .filter((s) => s.uses === 1 && s.reusePlan)
    .map((s) => `⚠ ${esc(s.name)} · ${esc(t.reusePlanLabel + t.colon)}${esc(s.reusePlan)}`)
    .join('<br>');
  const epHead = Array.from({ length: total }, (_, i) => `<th class="ep-h">${i + 1}</th>`).join('');
  const matrix = `<div class="matrix" style="--cw:${cw}px">
  <table>
    <tr><th>${esc(t.matrixHead)}</th><th>${esc(t.matrixTier)}</th>${epHead}<th>${esc(t.matrixTotal)}</th></tr>
    ${matrixRows}
  </table>
  ${onceNotes ? `<p class="mnote">${onceNotes}</p>` : ''}
</div>`;

  // ---- 场景概览卡 ----
  const scards = assets.scenes
    .map((s) => {
      const set = new Set(s.episodes);
      const strip = Array.from({ length: total }, (_, i) => `<i class="${set.has(i + 1) ? `on${s.primary ? '' : ' lt'}` : ''}"></i>`).join('');
      // 承载爽点按类型去重计数——「小打脸 ×5」比重复列五遍可读
      const carried = beats.filter((b) => set.has(b.episode));
      const carriedByType = {};
      for (const b of carried) carriedByType[b.type] = (carriedByType[b.type] ?? 0) + 1;
      const carriedText = Object.entries(carriedByType)
        .map(([ty, cnt]) => (cnt > 1 ? `${ty} ×${cnt}` : ty))
        .join(' · ');
      const castIn = [...new Set(episodes.filter((e) => (e.sceneIds ?? []).includes(s.id)).flatMap((e) => e.characterIds ?? []))];
      return `<article class="scard">
  <span class="snum">${esc(fmtEps(s.episodes, t))}</span>
  <h3><span class="id">${esc(s.id)}</span>${esc(s.name)}<span class="badge${s.primary ? '' : ' once'}">${esc(s.primary ? t.primaryScene : t.onceScene)}</span></h3>
  <div class="strip">${strip}</div>
  <div class="srow"><b>${esc(t.beatsCarried)}</b><span>${carried.length ? esc(carriedText) : esc(t.none)}</span></div>
  ${s.reusePlan
    ? `<div class="srow"><b>${esc(t.reusePlanLabel)}</b><span class="reuse">${esc(s.reusePlan)}</span></div>`
    : `<div class="srow"><b>${esc(t.castSeen)}</b>${castIn.map((id) => `<i>${esc(id)}</i>`).join('')}</div>`}
</article>`;
    })
    .join('\n');

  // ---- 资产量折算（含场景环境与生成难点，全部算出来）----
  const onceNames = onceScenes.map((s) => s.name);
  const planRows = [
    ...assets.castPlan.map((p) => [esc(t.tier[p.tier] ?? p.label), String(p.count), esc(p.names.join(t.sep) || t.none), esc(t.tierSpec[p.tier] ?? p.spec)]),
    [
      esc(t.planSceneRow),
      `${primaryScenes.length}${onceScenes.length ? `+${onceScenes.length}` : ''}`,
      esc(primaryScenes.map((s) => s.name).join(t.sep) + (onceNames.length ? t.planSceneReuse(onceNames) : '')),
      esc(t.planSceneSpec),
    ],
    // 道具行：没有 props 的旧大纲不出这一行
    ...(assets.props.length
      ? [[
        esc(t.planPropRow),
        String(assets.props.length),
        esc(assets.props.map((pr) => pr.name).join(t.sep)),
        esc(t.planPropSpec),
      ]]
      : []),
    [esc(t.planRiskRow), String(riskTotal), esc(riskTotal ? riskSub : t.none), esc(t.planRiskSpec)],
  ];

  // ---- 关键决策：拍板三件事，砍线/合人来自改编说明，大爆点与角色位算出来 ----
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
    <p class="dhead">${esc(t.dec.leads + t.colon + leadNames.join(t.sep))}</p>
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

  // ---- 质量门 ----
  const gateList = `<ul class="gate">
  ${gates
    .map(
      (g) => `<li class="${g.ok ? 'ok' : 'bad'}"><span class="m">${g.ok ? '✓' : '✗'}</span><span>${esc(gateText(g, t.langCode).label)}${
        !g.ok && g.detail ? `<small>${esc(g.detail)}</small>` : ''
      }</span></li>`,
    )
    .join('\n  ')}
</ul>`;

  return `<!doctype html>
<html lang="${t.htmlLang}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.docTitle(source))}</title>
<style>
:root{
  --paper:#eceded; --panel:#f5f6f5; --side:#e4e6e3; --ink:#191d21; --ink-2:#5b636a; --ink-3:#8c9298;
  --rule:#d2d5d0; --rule-2:#c2c6bf; --seal:#8a3324; --seal-2:#c56a4e; --seal-3:#e0a98c; --seal-soft:#8a332412; --ok:#3d6b4f;
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

/* beat-rhythm chart/table tabs */
.tabs{display:flex;width:max-content;margin-bottom:12px;border:1px solid var(--rule-2);
  border-radius:2px;overflow:hidden}
.tab{font:500 12px/1 var(--sans);letter-spacing:.06em;padding:7px 16px;background:var(--panel);
  border:0;cursor:pointer;color:var(--ink-2);transition:.15s}
.tab + .tab{border-left:1px solid var(--rule-2)}
.tab.on{background:var(--seal);color:#fff}
.tab:focus-visible{outline:2px solid var(--seal);outline-offset:-2px}
.tabpane{display:none}
.tabpane.on{display:block}

/* episode overview: first three cards, fade-out + expand */
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

/* key decisions: the three sign-off items */
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

/* beat-rhythm timeline */
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

/* beat detail table + generic tables */
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--rule);font-size:13px}
th,td{padding:8px 12px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top}
th{font:500 11px/1 var(--sans);letter-spacing:.1em;color:var(--ink-3);background:var(--side)}
tr:last-child td{border-bottom:0}
td:first-child{font-family:var(--mono);font-size:12px;color:var(--ink-2);white-space:nowrap}
q{quotes:"「" "」";font-family:var(--serif);border-left:2px solid var(--seal);padding-left:8px;display:inline-block}

/* episode cards */
.eps{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:13px}
.ep{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:14px 16px 12px;position:relative}
.ep .num{position:absolute;top:10px;right:14px;font:400 30px/1 var(--serif);color:var(--rule-2)}
.ep header{display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-right:44px;flex-wrap:wrap}
.ep header b{font:500 15px var(--serif);letter-spacing:.04em}
.bt{font-style:normal;font-size:11px;padding:2px 8px;border:1px solid var(--seal);border-radius:99px;color:var(--seal)}
.bt.major{background:var(--seal);color:#fff}
.ep .syn{margin:0 0 8px;font-size:13px;line-height:1.75}
.hk{display:grid;grid-template-columns:max-content minmax(0,1fr);gap:8px;font-size:12.5px;padding:6px 0;border-top:1px solid var(--rule)}
.hk b{font:500 11px/1.8 var(--sans);letter-spacing:.14em;color:var(--seal);white-space:nowrap}
:root[lang="en"] .hk b,html[lang="en"] .hk b{letter-spacing:.06em}
.ep .meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
.ep .meta i{font-style:normal;font:400 10.5px/1.5 var(--mono);border:1px solid var(--rule-2);
  border-radius:2px;padding:0 5px;background:var(--paper);color:var(--ink-2)}
.ep .meta .warn{border-color:var(--seal);color:var(--seal);background:var(--seal-soft)}

/* dispatch matrix */
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
.matrix td.mc.on.pp{background:var(--seal-3);border-color:var(--seal-3)}
.matrix td.n{padding-left:10px;font-family:var(--mono);font-size:11px;color:var(--ink-2);white-space:nowrap}
.matrix tr.div td{padding:8px 0 3px;font:500 10px/1 var(--sans);letter-spacing:.18em;color:var(--ink-3)}
.matrix .mnote{font-size:11px;color:var(--ink-3);margin:10px 0 0}

/* scene overview cards: full-width multi-column grid */
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

/* asset conversion */
.plan{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:16px 18px}
.plan table{background:none;border:0}
.plan th{background:none;padding-left:0}
.plan td{padding-left:0;border-top:1px solid var(--rule);border-bottom:0}
.plan tr:first-child td{border-top:0}
.plan td:first-child{font-family:var(--serif);font-size:13px;color:var(--ink)}

/* adaptation notes */
.core{font:400 17px/1.9 var(--serif);margin:0 0 6px}
h3.sub{font:500 12px/1 var(--sans);letter-spacing:.18em;color:var(--seal);margin:20px 0 8px}

/* quality gates */
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
/* print: expand everything — both tab panes, all episode cards */
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
${failed.length ? `<div class="galert"><b>✗ ${esc(t.gatesFail(failed.length))}</b>${failed.map((g) => `<span>${esc(gateText(g, t.langCode).label)}${g.detail ? ` — ${esc(gateText(g, t.langCode).detail)}` : ''}</span>`).join('')}</div>` : ''}

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
  ${htable(t.charCols, byTier(characters).map((c) => [esc(c.id), esc(c.name), esc(t.tier[c.tier] ?? c.tier), esc(c.role), esc(c.arc ?? t.none), esc(c.from.join(t.semi))]))}
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
// beat rhythm: chart / table toggle
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b === btn));
    document.querySelectorAll('.tabpane').forEach((p) => p.classList.toggle('on', p.id === btn.dataset.pane));
  });
});

// episode overview: first three by default, one click expands for good
const epsMore = document.querySelector('.epsmore');
if (epsMore) {
  epsMore.addEventListener('click', () => {
    document.querySelector('.epswrap').classList.remove('clip');
    epsMore.remove();
  });
}

// Export through the active locale when available; standalone reports retain the source JSON.
document.querySelector('.expo').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (window.shuohaoLanguage?.downloadJson) {
    window.shuohaoLanguage.downloadJson(JSON.parse(document.getElementById('outline-data').textContent), btn.dataset.name);
    return;
  }
  const url = URL.createObjectURL(
    new Blob([document.getElementById('outline-data').textContent], { type: 'application/json' }),
  );
  const a = Object.assign(document.createElement('a'), { href: url, download: btn.dataset.name });
  a.click();
  // don't revoke immediately — Safari may kill the blob before the download finishes reading
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const USAGE = `novel-outline.mjs — novel-outline skill 的确定性工具

  chunk <book.txt> <workdir>          按章节分卷（识别不出章节就按字数切），写 vol-NN.txt
  validate <outline.json> [--stage s] 校验；有违规逐条打印并 exit 1
                                      stage: skeleton / beats / full（默认 full）
  checkup <outline.json>              体检模式：只打印质量门 ✓/✗，有未过项 exit 1
  render <outline.json> [--html|--md] 渲染大纲报告到 stdout（默认 --md）
         [--lang zh|en]               报告界面语言：--lang 优先，其次 outline.json 的
                                      lang 字段，默认 zh；数据内容不翻译
  assets <outline.json>               打印自动汇总的资产清单 JSON
  slug <name>                         书名转安全文件名

chunk 选项：
  --per-volume <n>   每卷章数，默认 ${DEFAULT_PER_VOLUME}`;

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
    if (truncated) console.error(`⚠️ 超过 ${MAX_VOLUMES} 卷上限，尾部未收进来`);
    return;
  }

  if (cmd === 'validate') {
    const [path] = rest;
    if (!path) throw new Error('用法：validate <outline.json> [--stage skeleton|beats|full]');
    const stage = flag(rest, '--stage', 'full');
    if (!STAGES.includes(stage)) throw new Error(`--stage 只能是 ${STAGES.join('/')}`);
    const problems = validateOutline(readJson(path), stage);
    if (problems.length) {
      console.error(`✗ ${problems.length} 处违规（stage=${stage}）：\n`);
      for (const x of problems) console.error('  ' + x);
      process.exit(1);
    }
    console.log(`✓ 通过校验（stage=${stage}）`);
    return;
  }

  if (cmd === 'checkup') {
    const [path] = rest;
    if (!path) throw new Error('用法：checkup <outline.json>');
    const gates = gateReport(readJson(path));
    for (const g of gates) console.log(`${g.ok ? '✓' : '✗'} ${g.label}${!g.ok && g.detail ? ` — ${g.detail}` : ''}`);
    const failed = gates.filter((g) => !g.ok).length;
    console.log(failed ? `\n✗ ${failed} 项未过` : '\n✓ 全部通过');
    if (failed) process.exit(1);
    return;
  }

  if (cmd === 'render') {
    const [path] = rest;
    if (!path) throw new Error('用法：render <outline.json> [--html|--md] [--lang zh|en]');
    const outline = readJson(path);
    // 语言优先级：--lang > outline.json 顶层 lang 字段 > zh（render 函数内解析）
    const lang = flag(rest, '--lang', null);
    process.stdout.write((rest.includes('--html') ? renderHtml(outline, lang) : renderMarkdown(outline, lang)) + '\n');
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

// 软链安装时 argv[1] 是链接路径，两边都取 realpath 才能比得上
function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMainModule()) {
  // `render ... | head` 这类管道提前关闭时安静退出，别甩 EPIPE 堆栈
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
