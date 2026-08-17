#!/usr/bin/env node
// novel-art — deterministic helpers for the novel-art skill (场景 + 道具).
// Zero dependencies on purpose: the skill must work in any directory
// without an npm install. Node 18+ (stdlib only).

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* 画风预设（环境版）                                                    */
/* ------------------------------------------------------------------ */
/*
 * 与 novel-characters 的两档画风同名对齐（realistic / ghibli），
 * 但内容是环境的表面处理，不是皮肤毛孔——把角色那套带进环境是错的。
 * 换风格是整套换：render / surface / negative / tags 整块取用，不混搭。
 *
 * 最容易踩的坑与角色 skill 相同：realistic 绝不能禁 photorealistic，
 * ghibli 必须禁。validate 会拦。
 */

export const DEFAULT_STYLE = 'realistic';

export const SCENE_STYLE_PRESETS = {
  realistic: {
    label: '半写实厚涂',
    render:
      'Semi-realistic environment concept art, painterly rendering with visible brush texture, grounded architectural perspective, cinematic depth',
    surface:
      'Weathered, lived-in materials: chipped paint, water stains, patina on metal, worn wood grain, dust in corners and light shafts; fabric and paper props show creases and age; nothing looks factory-new. Atmospheric depth with haze or volumetric light where the space allows',
    // 这里绝不能禁 photorealistic——一边要真实感一边禁真实感是自相矛盾的
    negative:
      'people, human figures, characters, crowds, silhouettes of people, plastic CG look, oversaturated colours, sterile showroom cleanliness, warped perspective, melted geometry, floating objects, text, watermark, signature',
    tags: ['semi-realistic', 'environment sheet', 'painterly', 'weathered materials', 'cinematic'],
  },

  ghibli: {
    label: '吉卜力动画',
    render:
      'Hand-painted anime background art in the manner of classic Studio Ghibli films: soft watercolour-and-gouache rendering, clean readable shapes, warm naturalistic palette, gentle painterly edges',
    surface:
      'Simplified but affectionate detail: flat colour planes with soft gradations, foliage and clutter grouped into readable clumps, warm light pooling on surfaces; textures suggested with a few brush strokes rather than rendered out; no photographic micro-detail',
    // 这里反过来，必须禁写实
    negative:
      'people, human figures, characters, crowds, photorealistic, 3d render, hyperrealistic texture, harsh contrast, gritty grime, lens effects, text, watermark, signature',
    tags: ['ghibli-like', 'background art', 'watercolour', 'environment sheet', 'warm palette'],
  },
};

export const SUPPORTED_STYLES = Object.keys(SCENE_STYLE_PRESETS);
export const scenePreset = (id) => SCENE_STYLE_PRESETS[id] ?? SCENE_STYLE_PRESETS[DEFAULT_STYLE];

/* ------------------------------------------------------------------ */
/* slug                                                                */
/* ------------------------------------------------------------------ */

export function slug(name) {
  const cleaned = String(name)
    .trim()
    .replace(/[\s/\\:*?"<>|·]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'scene';
}

/* ------------------------------------------------------------------ */
/* seed — 从 outline.json 确定性预填骨架                                 */
/* ------------------------------------------------------------------ */
/*
 * 场景清单、主场景标记、出现集、承载爽点、复用方案在 outline.json 里
 * 都是现成的——这些不该让模型重新想一遍。seed 把它们搬进骨架，
 * 模型只填设计字段（设计意图 / 锚点 / 光照 / 提示词）。
 */

export function seedFromOutline(outline) {
  const eps = Array.isArray(outline?.episodes) ? outline.episodes : [];
  const beats = Array.isArray(outline?.beats) ? outline.beats : [];

  const scenes = (outline?.scenes ?? []).map((s) => {
    const episodes = eps.filter((e) => (e?.sceneIds ?? []).includes(s.id)).map((e) => e.ep);
    const epSet = new Set(episodes);
    const carried = [...new Set(beats.filter((b) => epSet.has(b.episode)).map((b) => b.type))];
    return {
      id: s.id,
      name: s.name,
      primary: !!s.primary,
      // 模型要填的设计字段，先占位
      summary: '',
      anchors: [],
      lighting: [],
      image: { prompt: '', negativePrompt: '', sheet: '', tags: [] },
      // 从 outline 搬来的事实，不用再想
      ...(s.reusePlan ? { seedNote: `outline 的复用方案：${s.reusePlan}——考虑做成某个主场景的变体（variantOf + changes）` } : {}),
      usage: { episodes, beats: carried },
    };
  });

  return { source: outline?.source ?? '', style: DEFAULT_STYLE, scenes };
}

/* ------------------------------------------------------------------ */
/* 质量门                                                               */
/* ------------------------------------------------------------------ */
/*
 * 与另外两个 skill 同一主张：checklist 是代码，不是给模型读的文字。
 * AI 短剧环境资产的硬规则都在这——空景、锚点、光照状态、
 * 提示词语言、风格与反向词匹配、变体引用完整。
 */

const thText = (s) => typeof s === 'string' && s.trim();
/** 中日韩表意文字与假名、谚文——出图提示词里出现就说明串语言了。 */
const CJK = /[㐀-鿿぀-ヿ가-힯]/;
/** 环境参考图必须空景：反向提示词里必须把「人」禁掉。 */
const PEOPLE_BAN = /people|human|figure|character|crowd/i;

export const ANCHOR_RANGE = [3, 5];

/*
 * 道具尺度参照：AI 经常把手持道具画成家具尺寸——实拍不存在的坑。
 * scale 是中文枚举，出图提示词里必须出现对应的英文短语，validate 会对着查。
 */
export const PROP_SCALES = {
  手持级: 'handheld scale',
  桌面级: 'tabletop scale',
  家具级: 'furniture scale',
};
/** 道具参考图不许有手——拿着道具的手是最常见的污染。 */
const HANDS_BAN = /hand|finger/i;

export function gateReport(doc, castNames = null, propStateRefs = null, assetExists = null) {
  const gates = [];
  const add = (id, label, ok, detail = '') => gates.push({ id, label, ok, detail });
  const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];
  const props = Array.isArray(doc?.props) ? doc.props : [];
  const bad = {
    anchors: [], lighting: [], people: [], english: [], names: [], variant: [], style: [],
    states: [], scale: [], hands: [], whitebg: [], stateImgs: [],
  };
  const ids = new Set(scenes.map((s) => s?.id));
  const style = doc?.style ?? DEFAULT_STYLE;
  const preset = scenePreset(style);

  // 场景与道具共用的门：锚点 / 空景 / 英文 / 角色名 / 风格匹配
  for (const s of [...scenes, ...props]) {
    const label = s?.name ?? s?.id ?? '(无名)';

    // 锚点 3–5：少了认不出场景，多了 QC 核对不过来
    const anchorN = Array.isArray(s?.anchors) ? s.anchors.length : 0;
    if (anchorN < ANCHOR_RANGE[0] || anchorN > ANCHOR_RANGE[1]) bad.anchors.push(`${label}（${anchorN} 个）`);

    // 光照状态 ≥1（仅场景）：AI 换时段是重新生成，不是重新打灯
    if (scenes.includes(s) && (!Array.isArray(s?.lighting) || s.lighting.length === 0)) bad.lighting.push(label);

    // 空景：反向提示词必须禁人
    const neg = s?.image?.negativePrompt ?? '';
    if (!PEOPLE_BAN.test(neg)) bad.people.push(label);

    // 机器字段永远英文（场景的光照 + 道具的状态一起扫）
    const machine = [
      s?.image?.prompt, s?.image?.negativePrompt, s?.image?.sheet,
      ...(s?.lighting ?? []).map((l) => l?.prompt),
      ...(s?.states ?? []).map((st) => st?.prompt),
      ...(s?.image?.tags ?? []),
    ];
    if (machine.some((v) => typeof v === 'string' && CJK.test(v))) bad.english.push(label);

    // 提示词不许出现角色名（给了 cast 才查）
    if (castNames?.length) {
      const texts = [
        s?.image?.prompt, s?.image?.sheet,
        ...(s?.lighting ?? []).map((l) => l?.prompt),
        ...(s?.states ?? []).map((st) => st?.prompt),
      ];
      for (const n of castNames) {
        if (texts.some((v) => typeof v === 'string' && v.includes(n))) {
          bad.names.push(`${label} 出现「${n}」`);
          break;
        }
      }
    }

    // 变体引用完整
    if (s?.variantOf !== undefined) {
      if (!ids.has(s.variantOf) || s.variantOf === s.id) bad.variant.push(`${label} → ${s.variantOf}`);
      else if (!thText(s?.changes)) bad.variant.push(`${label} 缺 changes`);
    }

    // 风格与反向词匹配 + sheet 带渲染句
    const bansRealism = /photorealistic|3d render/i.test(neg);
    if (style === 'realistic' && bansRealism) bad.style.push(`${label} 禁了 photorealistic`);
    if (style === 'ghibli' && !bansRealism) bad.style.push(`${label} 没禁 photorealistic`);
    if (thText(s?.image?.sheet) && !s.image.sheet.includes(preset.render)) bad.style.push(`${label} 的 sheet 缺渲染句`);
  }

  // 道具专属的门
  for (const pr of props) {
    const label = pr?.name ?? pr?.id ?? '(无名)';

    // 状态 ≥1：合上/打开、藏着/摊开——每个状态都是一张要单独生成的参考
    if (!Array.isArray(pr?.states) || pr.states.length === 0) bad.states.push(label);
    // 反向对账：剧情用到的状态变体是否都落成对应 states[].state（给了 propStateRefs 才查）
    else if (propStateRefs && Array.isArray(propStateRefs[pr.id]) && propStateRefs[pr.id].length) {
      const have = new Set(pr.states.map((st) => (st?.state ?? '').trim()).filter(Boolean));
      for (const need of propStateRefs[pr.id]) {
        const k = typeof need === 'string' ? need.trim() : null;
        if (k && !have.has(k)) bad.states.push(`${label} 缺状态变体「${k}」（剧本出现但未出图）`);
      }
    }

    // 尺度参照：scale 枚举 + 提示词里必须出现对应英文短语
    const scaleEn = PROP_SCALES[pr?.scale];
    if (!scaleEn) {
      bad.scale.push(`${label}（scale 必须是 ${Object.keys(PROP_SCALES).join('/')}）`);
    } else if (![pr?.image?.prompt, pr?.image?.sheet].every((v) => typeof v === 'string' && v.includes(scaleEn))) {
      bad.scale.push(`${label}（提示词缺「${scaleEn}」）`);
    }

    // 无手：拿着道具的手是最常见的污染，反向提示词必须禁
    if (!HANDS_BAN.test(pr?.image?.negativePrompt ?? '')) bad.hands.push(label);

    // 白底：道具参考图要被贴进各种镜头，必须纯白背景可抠
    if (!/white background/i.test(pr?.image?.sheet ?? '')) bad.whitebg.push(label);

    // 状态变体「已出图」核对：states[].prompt 只证明提示词齐全，不代表图片已生成。
    // 每个状态都必须指定出图文件（states[].image）；给了 assetExists 时还要核对文件真实存在。
    // 不声明 image 或文件不存在都判失败——杜绝「提示词齐全却没图」的假通过。
    if (typeof assetExists === 'function') {
      for (const st of pr?.states ?? []) {
        const nm = st?.state ?? '?';
        if (!thText(st?.image)) {
          bad.stateImgs.push(`${label} 状态「${nm}」未声明 image（必须指定出图文件）`);
        } else if (!assetExists(st.image)) {
          bad.stateImgs.push(`${label} 状态「${nm}」声明了图片 ${st.image} 但文件不存在`);
        }
      }
    } else {
      // 没传 assetExists：无法核对文件，但仍要求每个状态声明 image 路径（至少证明有出图计划），否则视为未出图
      for (const st of pr?.states ?? []) {
        if (!thText(st?.image)) bad.stateImgs.push(`${label} 状态「${st?.state ?? '?'}」未声明 image（无 assetExists 时仍须声明出图文件）`);
      }
    }
  }

  add('anchors', `一致性锚点 ${ANCHOR_RANGE[0]}–${ANCHOR_RANGE[1]} 个`, scenes.length + props.length > 0 && bad.anchors.length === 0, bad.anchors.join('；'));
  add('lighting', '光照状态至少 1 个且落成提示词', scenes.length > 0 && bad.lighting.length === 0, bad.lighting.join('；'));
  add('no-people', '参考图无人：反向提示词禁人（场景与道具都查）', scenes.length + props.length > 0 && bad.people.length === 0, bad.people.join('；'));
  add('english', '出图提示词全部英文', scenes.length + props.length > 0 && bad.english.length === 0, bad.english.join('；'));
  add(
    'no-names',
    '提示词不含角色名',
    bad.names.length === 0,
    castNames?.length ? bad.names.join('；') : '未提供 cast.json，本门跳过（视为通过）',
  );
  add('variants', '变体引用完整（variantOf 存在且带 changes）', bad.variant.length === 0, bad.variant.join('；'));
  add('style-match', '风格与反向提示词匹配', bad.style.length === 0, bad.style.join('；'));
  add('prop-states', '道具状态至少 1 个且落成提示词', props.length === 0 || bad.states.length === 0, bad.states.join('；'));
  add('prop-scale', '道具尺度参照写进提示词', props.length === 0 || bad.scale.length === 0, bad.scale.join('；'));
  add('prop-hands', '道具参考图无手：反向提示词禁手', props.length === 0 || bad.hands.length === 0, bad.hands.join('；'));
  add('prop-white', '道具设定图纯白背景可抠', props.length === 0 || bad.whitebg.length === 0, bad.whitebg.join('；'));
  add(
    'prop-state-images',
    '道具状态变体「已出图」核对（每个状态须声明 image 且文件真实存在；提示词齐全 ≠ 已出图）',
    props.length === 0 || bad.stateImgs.length === 0,
    typeof assetExists === 'function'
      ? (bad.stateImgs.length ? bad.stateImgs.join('；') : '已逐一核对 states[].image 文件存在')
      : (bad.stateImgs.length ? bad.stateImgs.join('；') : '未提供 assetExists：仅校验每个状态是否声明了 image 路径'),
  );

  return gates;
}

/* ------------------------------------------------------------------ */
/* validate                                                            */
/* ------------------------------------------------------------------ */

export function validateArt(doc, castNames = null, propStateRefs = null, assetExists = null) {
  const problems = [];
  const p = (msg) => problems.push(msg);
  if (!doc || typeof doc !== 'object') return ['art.json 不是对象'];

  if (!thText(doc.source)) p('缺少 source（剧名/书名）');
  if (!SUPPORTED_STYLES.includes(doc.style)) p(`style 必须是 ${SUPPORTED_STYLES.join('/')}，实际是 ${JSON.stringify(doc.style)}`);

  const scenes = doc.scenes;
  if (!Array.isArray(scenes) || scenes.length === 0) {
    p('scenes 为空');
    return problems;
  }

  // 道具（可选块）：给了就逐件查结构
  for (const pr of doc.props ?? []) {
    const label = pr?.name ?? pr?.id ?? '(无名)';
    if (!/^P\d{2,}$/.test(pr?.id ?? '')) p(`[${label}] 道具 id 必须是 P01 这种格式`);
    if (!thText(pr?.name)) p(`[${pr?.id}] 道具缺 name`);
    if (!thText(pr?.summary)) p(`[${label}] 缺 summary（戏剧功能：这件道具承载什么剧情）`);
    for (const a of pr?.anchors ?? []) {
      if (!thText(a?.name) || !thText(a?.desc)) p(`[${label}] 锚点缺 name 或 desc`);
    }
    for (const st of pr?.states ?? []) {
      if (!thText(st?.state)) p(`[${label}] 状态缺 state（合上/打开……）`);
      if (!thText(st?.prompt)) p(`[${label}] 状态「${st?.state ?? '?'}」缺 prompt（英文）`);
    }
    const img = pr?.image;
    if (!img || typeof img !== 'object') {
      p(`[${label}] 缺 image`);
    } else {
      for (const f of ['prompt', 'negativePrompt', 'sheet']) {
        if (!thText(img[f])) p(`[${label}] image.${f} 缺失或为空`);
      }
      if (!Array.isArray(img.tags)) p(`[${label}] image.tags 必须是数组`);
    }
    for (const sid of pr?.relatedScenes ?? []) {
      if (!scenes.some((sc) => sc?.id === sid)) p(`[${label}] relatedScenes 里的 ${sid} 不存在`);
    }
    if (pr?.usage !== undefined) {
      if (!Array.isArray(pr.usage?.episodes)) p(`[${label}] usage.episodes 必须是数组`);
      if (!Array.isArray(pr.usage?.beats)) p(`[${label}] usage.beats 必须是数组`);
    }
  }
  {
    const seenP = new Set();
    for (const pr of doc.props ?? []) {
      if (seenP.has(pr?.id)) p(`道具 id ${pr.id} 重复`);
      seenP.add(pr?.id);
    }
  }

  const seen = new Set();
  for (const s of scenes) {
    const label = s?.name ?? s?.id ?? '(无名)';
    if (!/^S\d{2,}$/.test(s?.id ?? '')) p(`[${label}] 场景 id 必须是 S01 这种格式`);
    if (seen.has(s?.id)) p(`场景 id ${s.id} 重复`);
    seen.add(s?.id);
    if (!thText(s?.name)) p(`[${s?.id}] 缺 name`);
    if (typeof s?.primary !== 'boolean') p(`[${label}] 缺 primary（是不是主场景）`);
    if (!thText(s?.summary)) p(`[${label}] 缺 summary（设计意图：这个空间讲什么故事）`);

    for (const a of s?.anchors ?? []) {
      if (!thText(a?.name) || !thText(a?.desc)) p(`[${label}] 锚点缺 name 或 desc`);
    }
    for (const l of s?.lighting ?? []) {
      if (!thText(l?.state)) p(`[${label}] 光照状态缺 state（晨雾/夜戏/黄昏……）`);
      if (!thText(l?.prompt)) p(`[${label}] 光照「${l?.state ?? '?'}」缺 prompt（英文）`);
    }

    const img = s?.image;
    if (!img || typeof img !== 'object') {
      p(`[${label}] 缺 image`);
    } else {
      for (const f of ['prompt', 'negativePrompt', 'sheet']) {
        if (!thText(img[f])) p(`[${label}] image.${f} 缺失或为空`);
      }
      if (!Array.isArray(img.tags)) p(`[${label}] image.tags 必须是数组`);
    }

    if (s?.usage !== undefined) {
      if (!Array.isArray(s.usage?.episodes)) p(`[${label}] usage.episodes 必须是数组`);
      if (!Array.isArray(s.usage?.beats)) p(`[${label}] usage.beats 必须是数组`);
    }
  }

  // 质量门失败并入违规列表（未显式传 propStateRefs 时，从 doc.propStateRefs 取）
  const stateRefs = propStateRefs ?? (doc?.propStateRefs ?? null);
  for (const g of gateReport(doc, castNames, stateRefs, assetExists)) {
    if (!g.ok) p(`质量门未过：${g.label}${g.detail ? `（${g.detail}）` : ''}`);
  }

  return problems;
}

/** 从 cast.json 提取名字 + 别名，给「提示词不含角色名」那道门用。 */
export function castNamesOf(cast) {
  const chars = Array.isArray(cast) ? cast : (cast?.characters ?? []);
  const names = [];
  for (const c of chars) {
    if (thText(c?.name)) names.push(c.name.trim());
    for (const a of c?.aliases ?? []) if (thText(a)) names.push(a.trim());
  }
  return [...new Set(names)];
}

/* ------------------------------------------------------------------ */
/* render — 界面文案                                                    */
/* ------------------------------------------------------------------ */
/*
 * 内置 zh / en 两套，全部收在这张表里；zh 是基准，en 术语与 README.en.md 对齐。
 * 只有报告界面走这张表——质量门文案、CLI 输出、art.json 里的数据都不在此列。
 */

/* 门标签与「跳过」提示的英文映射：质量门面板是报告的一部分，出英文报告时
 * 这里做展示层翻译——gateReport 的逻辑与中文诊断文案一行不动（CLI 仍是中文）。
 * 动态阈值由门自己算，映射里只写固定语义；未命中的 id 回落到原标签。 */
const GATE_LABELS_EN = {
  'anchors': 'Consistency anchors, {0}–{1} per asset',
  'lighting': 'At least one lighting state, written out as a prompt',
  'no-people': 'No people in plates: negatives ban people (scenes and props)',
  'english': 'All image prompts in English',
  'no-names': 'Prompts carry no character names',
  'variants': 'Variant references complete (variantOf exists and carries changes)',
  'style-match': 'Style matches its negative prompt',
  'prop-states': 'At least one prop state, written out as a prompt',
  'prop-scale': 'Prop scale reference written into the prompt',
  'prop-hands': 'No hands in prop plates: negatives ban hands',
  'prop-white': 'Prop sheets on pure white background, cut-out ready',
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
  const en = GATE_LABELS_EN[g.id];
  // 阈值仍由门自己算：把中文标签里出现的数字按序填进 {0} {1}
  const nums = String(g.label).match(/\d+(?:\.\d+)?/g) ?? [];
  const label = en ? en.replace(/\{(\d)\}/g, (m, i) => nums[Number(i)] ?? m) : g.label;
  return { label, detail: GATE_SKIPS_EN[g.detail] ?? g.detail };
};

const I18N = {
  zh: {
    langCode: 'zh',
    kicker: '美术设定集',
    docTitle: (s) => `${s} · 美术设定集`,
    styleLine: (id) => `画风：${scenePreset(id).label}`,
    exportJson: '导出 JSON',
    gates: '质量门',
    gatesPass: '全部通过',
    gatesFail: (n) => `${n} 项未过`,
    gatePill: (okN, total) => `质量门 ${okN} / ${total}`,
    kpi: {
      scenes: '场景', scenesSub: (p2, v) => `主场景 ${p2}${v ? ` · 变体 ${v}` : ''}`,
      propsK: '叙事道具', propsSub: (st) => `${st} 个状态变体`,
      anchors: '一致性锚点', anchorsSub: '生成镜头的核对表（场景 + 道具）',
      lighting: '光照状态', lightingSub: '换时段 = 重新生成',
    },
    secList: '场景清单',
    secCards: '场景设定卡',
    secPropList: '道具清单',
    secPropCards: '道具设定卡',
    secGates: '质量门',
    propListCols: ['ID', '道具', '尺度', '状态', '关联场景', '出现集', '锚点'],
    statesTitle: '状态变体',
    scaleLabel: '尺度',
    relatedScenesLabel: '关联场景',
    carriedByLabel: '关联角色',
    propSheetCaption: '主视角＋底部与右侧细节条 · 纯白背景',
    listCols: ['ID', '场景', '类型', '出现集', '锚点', '光照', '变体'],
    primaryScene: '主场景', onceScene: '一次性', variantScene: '变体',
    anchorsTitle: '一致性锚点',
    anchorsHint: '每次生成都必须出现的特征——认场景靠它，QC 也靠它',
    lightingTitle: '光照与时段',
    usageTitle: '出现集',
    beatsTitle: '承载爽点',
    variantTitle: '变体来源',
    variantChanges: '改动',
    promptsTitle: '出图提示词包',
    promptMaster: '主视角 EN',
    promptNegative: '反向提示词',
    promptSheet: '设定图 EN',
    copy: '复制', copied: '已复制', copyFailed: '复制失败', copyJson: '复制整个场景 JSON',
    noImage: '尚未出图',
    noImageHint: '用下方提示词生成',
    zoomImage: '放大查看',
    closeImage: '关闭',
    sheetCaption: '主视角＋底部与右侧细节条',
    none: '—',
    listSep: '、',
    pairSep: '　',
    colon: '：',
    colophon: '设定与提示词由模型依据大纲/原文生成，质量门由脚本确定性检查。参考图一律无人——人是另一层资产；道具参考图另加无手、纯白背景。',
  },
  en: {
    langCode: 'en',
    kicker: 'Art Bible',
    docTitle: (s) => `${s} · Art Bible`,
    styleLine: (id) => `Style: ${({ realistic: 'semi-realistic painterly', ghibli: 'Ghibli-style animation' })[id] ?? id}`,
    exportJson: 'Export JSON',
    gates: 'Quality gates',
    gatesPass: 'All passed',
    gatesFail: (n) => `${n} gate${n === 1 ? '' : 's'} failed`,
    gatePill: (okN, total) => `Quality gates ${okN} / ${total}`,
    kpi: {
      scenes: 'Scenes', scenesSub: (p2, v) => `${p2} primary${v ? ` · ${v} variant${v === 1 ? '' : 's'}` : ''}`,
      propsK: 'Narrative props', propsSub: (st) => `${st} state variant${st === 1 ? '' : 's'}`,
      anchors: 'Consistency anchors', anchorsSub: 'The checklist for generated shots (scenes + props)',
      lighting: 'Lighting states', lightingSub: 'A time-of-day change is a regeneration',
    },
    secList: 'Scene list',
    secCards: 'Scene sheets',
    secPropList: 'Prop list',
    secPropCards: 'Prop sheets',
    secGates: 'Quality gates',
    propListCols: ['ID', 'Prop', 'Scale', 'States', 'Related scenes', 'Episodes', 'Anchors'],
    statesTitle: 'Prop states',
    scaleLabel: 'Scale',
    relatedScenesLabel: 'Related scenes',
    carriedByLabel: 'Carried by',
    propSheetCaption: 'Master view + bottom & right detail strips · pure white background',
    listCols: ['ID', 'Scene', 'Type', 'Episodes', 'Anchors', 'Lighting', 'Variant'],
    primaryScene: 'Primary', onceScene: 'One-off', variantScene: 'Variant',
    anchorsTitle: 'Consistency anchors',
    anchorsHint: 'Features that must appear in every generation — viewers recognize the place by them, and QC checks against them',
    lightingTitle: 'Lighting states',
    usageTitle: 'Episodes',
    beatsTitle: 'Beats',
    variantTitle: 'Variant of',
    variantChanges: 'Changes',
    promptsTitle: 'Prompt pack',
    promptMaster: 'Master view (EN)',
    promptNegative: 'Negative prompt',
    promptSheet: 'Sheet (EN)',
    copy: 'Copy', copied: 'Copied', copyFailed: 'Copy failed', copyJson: 'Copy full JSON',
    noImage: 'no image yet',
    noImageHint: 'generate with the prompts below',
    zoomImage: 'Click to zoom',
    closeImage: 'Close',
    sheetCaption: 'Master view + bottom & right detail strips',
    none: '—',
    listSep: ', ',
    pairSep: ' · ',
    colon: ': ',
    colophon: 'Designs and prompts are model-generated from the outline/source text; quality gates are checked deterministically by the script. Reference images never contain people — characters are a separate asset layer; prop plates additionally ban hands and sit on a pure white background.',
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

export function renderMarkdown(doc, lang = null) {
  const t = tOf(lang ?? doc?.lang);
  const props = doc.props ?? [];
  const out = [`# ${t.docTitle(doc.source)}`, '', `> ${t.styleLine(doc.style)}`, ''];

  out.push(`## ${t.secList}`, '', mdHead(t.listCols));
  for (const s of doc.scenes) {
    const type = s.variantOf ? `${t.variantScene} ← ${s.variantOf}` : s.primary ? t.primaryScene : t.onceScene;
    out.push(mdRow([
      s.id, s.name, type, s.usage?.episodes?.join(t.listSep) ?? t.none,
      s.anchors.length, s.lighting.map((l) => l.state).join(t.listSep),
      s.changes ?? t.none,
    ]));
  }
  out.push('');

  for (const s of doc.scenes) {
    out.push('---', '', `## ${s.id} ${s.name}`, '', s.summary, '');
    if (s.sheetImage) out.push(`![${s.name} ${t.sheetCaption}](${s.sheetImage})`, '');
    out.push(`### ${t.anchorsTitle}`, '');
    s.anchors.forEach((a, i) => out.push(`${i + 1}. **${a.name}** — ${a.desc}`));
    out.push('', `### ${t.lightingTitle}`, '');
    for (const l of s.lighting) out.push(`- **${l.state}**${t.colon}\`${l.prompt}\``);
    out.push('');
    if (s.variantOf) out.push(`> ${t.variantTitle}${t.colon}${s.variantOf}${t.pairSep}${t.variantChanges}${t.colon}${s.changes}`, '');
    out.push(`### ${t.promptsTitle}`, '');
    out.push(`**${t.promptMaster}**`, '', '```text', s.image.prompt, '```', '');
    out.push(`**${t.promptNegative}**`, '', '```text', s.image.negativePrompt, '```', '');
    out.push(`**${t.promptSheet}**`, '', '```text', s.image.sheet, '```', '');
    if (s.image.tags.length) out.push(`\`${s.image.tags.join('`, `')}\``, '');
  }

  if (props.length) {
    out.push('---', '', `## ${t.secPropList}`, '', mdHead(t.propListCols));
    for (const pr of props) {
      out.push(mdRow([
        pr.id, pr.name, pr.scale, pr.states.map((st) => st.state).join(t.listSep),
        (pr.relatedScenes ?? []).join(t.listSep) || t.none,
        pr.usage?.episodes?.join(t.listSep) ?? t.none, pr.anchors.length,
      ]));
    }
    out.push('');
    for (const pr of props) {
      out.push('---', '', `## ${pr.id} ${pr.name}`, '', pr.summary, '');
      if (pr.sheetImage) out.push(`![${pr.name} ${t.propSheetCaption}](${pr.sheetImage})`, '');
      out.push(`### ${t.anchorsTitle}`, '');
      pr.anchors.forEach((a, i) => out.push(`${i + 1}. **${a.name}** — ${a.desc}`));
      out.push('', `### ${t.statesTitle}`, '');
      for (const st of pr.states) out.push(`- **${st.state}**${t.colon}\`${st.prompt}\``);
      out.push('');
      out.push(`### ${t.promptsTitle}`, '');
      out.push(`**${t.promptMaster}**`, '', '```text', pr.image.prompt, '```', '');
      out.push(`**${t.promptNegative}**`, '', '```text', pr.image.negativePrompt, '```', '');
      out.push(`**${t.promptSheet}**`, '', '```text', pr.image.sheet, '```', '');
    }
  }

  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* render — html                                                       */
/* ------------------------------------------------------------------ */
/*
 * 与另外两份报告同一套视觉语言：冷灰印张 + 铁锈红印记，1600 宽，
 * 全部平铺可 Cmd+F，零外部依赖。设计约定见 references/report-style.md。
 */

function embedDoc(doc) {
  return JSON.stringify(doc).replace(/</g, '\\u003c');
}

export function renderHtml(doc, lang = null, propStateRefs = null, assetExists = null) {
  const code = lang ?? doc?.lang ?? 'zh';
  const t = tOf(code);
  const stateRefs = propStateRefs ?? (doc?.propStateRefs ?? null);
  const gates = gateReport(doc, null, stateRefs, assetExists);
  const failed = gates.filter((g) => !g.ok);
  const scenes = doc.scenes;
  const props = doc.props ?? [];
  const primaryN = scenes.filter((s) => s.primary).length;
  const variantN = scenes.filter((s) => s.variantOf).length;
  const anchorN = [...scenes, ...props].reduce((n, s) => n + s.anchors.length, 0);
  const lightN = scenes.reduce((n, s) => n + s.lighting.length, 0);
  const stateN = props.reduce((n, pr) => n + pr.states.length, 0);

  const table = (cols, rows) =>
    `<table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('\n')}</tbody></table>`;

  const promptRow = (label, value) =>
    !value
      ? ''
      : `<details class="pr">
  <summary><span>${esc(label)}</span><button class="copy" data-copy="${esc(value)}">${esc(t.copy)}</button></summary>
  <p>${esc(value)}</p>
</details>`;

  const listRows = scenes.map((s) => [
    esc(s.id), esc(s.name),
    esc(s.variantOf ? `${t.variantScene} ← ${s.variantOf}` : s.primary ? t.primaryScene : t.onceScene),
    esc(s.usage?.episodes?.join(t.listSep) ?? t.none),
    String(s.anchors.length),
    esc(s.lighting.map((l) => l.state).join(t.listSep)),
    esc(s.changes ?? t.none),
  ]);

  const propListRows = props.map((pr) => [
    esc(pr.id), esc(pr.name), esc(pr.scale), esc(pr.states.map((st) => st.state).join(t.listSep)),
    esc((pr.relatedScenes ?? []).join(t.listSep) || t.none),
    esc(pr.usage?.episodes?.join(t.listSep) ?? t.none), String(pr.anchors.length),
  ]);

  const propCards = props
    .map((pr) => {
      const plate = pr.sheetImage
        ? `<figure class="plate">
  <button class="zoom" data-src="${esc(pr.sheetImage)}" aria-label="${esc(t.zoomImage)}">
    <img src="${esc(pr.sheetImage)}" alt="${esc(pr.name)} ${esc(t.propSheetCaption)}" loading="lazy">
  </button>
  <figcaption>${esc(t.propSheetCaption)}</figcaption>
</figure>`
        : `<div class="plate plate-empty"><span>${esc(pr.name)} · ${esc(t.noImage)}<br><em>${esc(t.noImageHint)}</em></span></div>`;
      return `<article class="scene" id="pr-${slug(pr.id)}">
  <header class="sc-h">
    <span class="sc-id">${esc(pr.id)}</span>
    <h3>${esc(pr.name)}</h3>
    <span class="badge">${esc(pr.scale)}</span>
    ${pr.usage?.episodes?.length ? `<span class="sc-use">${esc(t.usageTitle)} ${esc(pr.usage.episodes.join(t.listSep))}${pr.usage.beats?.length ? `${esc(t.pairSep)}${esc(t.beatsTitle)} ${esc(pr.usage.beats.join(' · '))}` : ''}</span>` : ''}
  </header>
  <p class="sc-sum">${esc(pr.summary)}</p>
  ${plate}
  ${(pr.relatedScenes ?? []).length || pr.carriedBy ? `<p class="variant">${(pr.relatedScenes ?? []).length ? `${esc(t.relatedScenesLabel)}${esc(t.colon)}<b>${esc(pr.relatedScenes.join(t.listSep))}</b>` : ''}${pr.carriedBy ? `${esc(t.pairSep)}${esc(t.carriedByLabel)}${esc(t.colon)}${esc([].concat(pr.carriedBy).join(t.listSep))}` : ''}</p>` : ''}
  <section class="blk">
    <h4>${esc(t.anchorsTitle)}<small>${esc(t.anchorsHint)}</small></h4>
    <ol class="anchors">${pr.anchors.map((a) => `<li><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></li>`).join('')}</ol>
  </section>
  <section class="blk">
    <h4>${esc(t.statesTitle)}</h4>
    <div class="lights">${pr.states.map((st) => `<div class="light"><i>${esc(st.state)}</i><span class="mono">${esc(st.prompt)}</span><button class="copy mini" data-copy="${esc(st.prompt)}">${esc(t.copy)}</button></div>`).join('')}</div>
  </section>
  <div class="pgroup">
    ${promptRow(t.promptMaster, pr.image.prompt)}
    ${promptRow(t.promptSheet, pr.image.sheet)}
    ${promptRow(t.promptNegative, pr.image.negativePrompt)}
    <div class="pgroup-f"><button class="copy wide" data-copy="${esc(JSON.stringify(pr, null, 2))}">${esc(t.copyJson)}</button></div>
  </div>
</article>`;
    })
    .join('\n');

  const cards = scenes
    .map((s) => {
      const plate = s.sheetImage
        ? `<figure class="plate">
  <button class="zoom" data-src="${esc(s.sheetImage)}" aria-label="${esc(t.zoomImage)}">
    <img src="${esc(s.sheetImage)}" alt="${esc(s.name)} ${esc(t.sheetCaption)}" loading="lazy">
  </button>
  <figcaption>${esc(t.sheetCaption)}</figcaption>
</figure>`
        : `<div class="plate plate-empty"><span>${esc(s.name)} · ${esc(t.noImage)}<br><em>${esc(t.noImageHint)}</em></span></div>`;
      return `<article class="scene" id="sc-${slug(s.id)}">
  <header class="sc-h">
    <span class="sc-id">${esc(s.id)}</span>
    <h3>${esc(s.name)}</h3>
    <span class="badge${s.primary ? '' : ' once'}">${esc(s.variantOf ? t.variantScene : s.primary ? t.primaryScene : t.onceScene)}</span>
    ${s.usage?.episodes?.length ? `<span class="sc-use">${esc(t.usageTitle)} ${esc(s.usage.episodes.join(t.listSep))}${s.usage.beats?.length ? `${esc(t.pairSep)}${esc(t.beatsTitle)} ${esc(s.usage.beats.join(' · '))}` : ''}</span>` : ''}
  </header>
  <p class="sc-sum">${esc(s.summary)}</p>
  ${plate}
  ${s.variantOf ? `<p class="variant">${esc(t.variantTitle)}${esc(t.colon)}<b>${esc(s.variantOf)}</b>${esc(t.pairSep)}${esc(t.variantChanges)}${esc(t.colon)}${esc(s.changes)}</p>` : ''}
  <section class="blk">
    <h4>${esc(t.anchorsTitle)}<small>${esc(t.anchorsHint)}</small></h4>
    <ol class="anchors">${s.anchors.map((a) => `<li><b>${esc(a.name)}</b><span>${esc(a.desc)}</span></li>`).join('')}</ol>
  </section>
  <section class="blk">
    <h4>${esc(t.lightingTitle)}</h4>
    <div class="lights">${s.lighting.map((l) => `<div class="light"><i>${esc(l.state)}</i><span class="mono">${esc(l.prompt)}</span><button class="copy mini" data-copy="${esc(l.prompt)}">${esc(t.copy)}</button></div>`).join('')}</div>
  </section>
  <div class="pgroup">
    ${promptRow(t.promptMaster, s.image.prompt)}
    ${promptRow(t.promptSheet, s.image.sheet)}
    ${promptRow(t.promptNegative, s.image.negativePrompt)}
    <div class="pgroup-f"><button class="copy wide" data-copy="${esc(JSON.stringify(s, null, 2))}">${esc(t.copyJson)}</button></div>
  </div>
</article>`;
    })
    .join('\n');

  const gateList = `<ul class="gate">
  ${gates
    .map(
      (g) => `<li class="${g.ok ? 'ok' : 'bad'}"><span class="m">${g.ok ? '✓' : '✗'}</span><span>${esc(gateText(g, t.langCode).label)}${
        !g.ok && g.detail ? `<small>${esc(g.detail)}</small>` : g.id === 'no-names' && g.detail ? `<small>${esc(g.detail)}</small>` : ''
      }</span></li>`,
    )
    .join('\n  ')}
</ul>`;

  return `<!doctype html>
<html lang="${code}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.docTitle(doc.source))}</title>
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
h1,h2,h3,h4{margin:0;font-weight:400}

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

.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0 6px}
@media(max-width:900px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:11px 14px 9px}
.kpi .l{font:500 10px/1 var(--sans);letter-spacing:.18em;color:var(--ink-3)}
.kpi .v{font:400 28px/1.15 var(--serif);margin-top:5px}
.kpi .d{font-size:11px;color:var(--ink-2);margin-top:1px}
.kpi.accent{border-top:2px solid var(--seal)}
.galert{margin:14px 0 0;border:1px solid var(--seal);background:var(--seal-soft);border-radius:2px;
  padding:10px 14px;font-size:13px}
.galert b{color:var(--seal)}
.galert span{display:block;font-size:12px;color:var(--ink-2)}

section.top-sec{margin-top:34px}
.sec-h{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--rule-2);padding-bottom:8px;margin-bottom:16px}
.sec-h .no{font:500 12px/1 var(--mono);color:var(--seal)}
.sec-h h2{font:400 20px/1.2 var(--serif);letter-spacing:.05em}
.sec-h .note{margin-left:auto;font-size:12px;color:var(--ink-3)}

table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--rule);font-size:13px}
th,td{padding:8px 12px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top}
th{font:500 11px/1 var(--sans);letter-spacing:.1em;color:var(--ink-3);background:var(--side)}
tr:last-child td{border-bottom:0}
td:first-child{font-family:var(--mono);font-size:12px;color:var(--ink-2);white-space:nowrap}
.mono{font:400 11.5px/1.7 var(--mono);color:var(--ink-2);word-break:break-word}

/* 场景设定卡：一排两张（方便截图宣传），卡内纵排、设定图占满卡宽 */
.cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
@media(max-width:1100px){.cards{grid-template-columns:1fr}}
.scene{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:18px 20px}
.sc-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--rule-2);padding-bottom:10px}
.sc-id{font:500 12px/1 var(--mono);color:var(--seal)}
.sc-h h3{font:400 20px/1.2 var(--serif);letter-spacing:.04em}
.badge{font:500 10.5px/1 var(--sans);padding:2px 8px;border-radius:99px;border:1px solid var(--seal);color:var(--seal)}
.badge.once{border-color:var(--seal-2);color:var(--seal-2)}
.sc-use{margin-left:auto;font-size:12px;color:var(--ink-2)}
.sc-sum{margin:10px 0 12px;font:400 14.5px/1.9 var(--serif)}
.scene .blk{margin-top:16px}
.scene .pgroup{margin-top:16px}

.plate{margin:0;background:#fff;border:1px solid var(--rule-2);border-radius:2px;overflow:hidden}
.plate .zoom{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in}
.plate .zoom:focus-visible{outline:2px solid var(--seal);outline-offset:-2px}
.plate img{display:block;width:100%;height:auto}
/* 图片弹层 */
.lightbox{position:fixed;inset:0;z-index:50;display:none;place-items:center;
  background:#191d21e6;padding:32px;cursor:zoom-out}
.lightbox.on{display:grid}
.lightbox img{max-width:100%;max-height:100%;background:#fff;border-radius:2px;
  box-shadow:0 8px 40px #0006}
.lightbox-x{position:absolute;top:18px;right:22px;font:500 13px/1 var(--sans);color:#fff;
  background:none;border:1px solid #fff6;border-radius:3px;padding:8px 12px;cursor:pointer}
.lightbox-x:hover{border-color:#fff}
.plate figcaption{font-size:11px;letter-spacing:.08em;color:var(--ink-3);padding:6px 10px;border-top:1px solid var(--rule)}
.plate-empty{display:grid;place-items:center;min-height:180px;text-align:center;
  border:1px dashed var(--rule-2);background:var(--paper);color:var(--ink-3);font-size:13px}
.plate-empty em{font-style:normal;font-size:12px;opacity:.8}
.variant{margin:10px 0 0;font-size:12.5px;color:var(--seal);background:var(--seal-soft);padding:7px 10px;border-radius:2px}
.variant b{font-family:var(--mono);font-weight:500}

.blk{margin-bottom:16px}
.blk h4{font:500 11px/1.6 var(--sans);letter-spacing:.18em;color:var(--seal);margin-bottom:8px}
.blk h4 small{display:block;letter-spacing:0;font-weight:400;color:var(--ink-3);font-size:11px}
.anchors{margin:0;padding:0 0 0 2px;list-style:none;counter-reset:an}
/* ::before 序号也是网格项，desc 必须显式钉在第二列，否则会掉进 22px 窄列一字一行 */
.anchors li{counter-increment:an;display:grid;grid-template-columns:22px minmax(0,1fr);column-gap:8px;
  padding:6px 0;border-top:1px solid var(--rule);font-size:13px}
.anchors li:first-child{border-top:0}
.anchors li::before{content:counter(an,decimal-leading-zero);grid-column:1;grid-row:1;
  font:500 11px/1.9 var(--mono);color:var(--seal)}
.anchors b{grid-column:2;font-weight:500}
.anchors span{grid-column:2;display:block;font-size:12px;color:var(--ink-2)}
.lights{display:flex;flex-direction:column;gap:6px}
.light{display:flex;align-items:baseline;gap:10px;background:var(--paper);border:1px solid var(--rule);
  border-radius:2px;padding:7px 10px}
.light i{flex:none;font-style:normal;font:500 12px/1.6 var(--sans);color:var(--ink)}
.light .mono{flex:1;min-width:0}

.pgroup{border:1px solid var(--rule);border-radius:2px;background:var(--paper);padding:4px 12px 8px;margin-top:12px}
.pr{border-bottom:1px solid var(--rule)}
.pgroup .pr:last-of-type{border-bottom:0}
.pr summary{display:flex;align-items:center;gap:10px;padding:10px 0;cursor:pointer;list-style:none;
  font:500 12px/1 var(--sans);letter-spacing:.04em}
.pr summary::-webkit-details-marker{display:none}
.pr summary::before{content:"▸";color:var(--seal);font-size:11px;transition:transform .15s}
.pr[open] summary::before{transform:rotate(90deg)}
.pr summary span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pr p{margin:0 0 10px;padding:10px 12px;background:var(--panel);border:1px solid var(--rule);
  border-radius:2px;font:400 12px/1.75 var(--mono);white-space:pre-wrap;word-break:break-word}
.pgroup-f{padding:10px 0 4px}
.copy{flex:none;font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--panel);
  border:1px solid var(--rule-2);border-radius:2px;padding:4px 10px;cursor:pointer;transition:.15s}
.copy:hover{border-color:var(--seal);color:var(--seal)}
.copy:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
.copy[data-done]{border-color:var(--seal);color:var(--seal)}
.copy.wide{width:100%;padding:9px}
.copy.mini{padding:2px 7px;font-size:10.5px}

.gate{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 28px}
@media(max-width:900px){.gate{grid-template-columns:1fr}}
.gate li{display:flex;gap:8px;padding:5px 0;font-size:12.5px;line-height:1.55}
.gate .m{flex:none;font-weight:700}
.gate li.ok .m{color:var(--ok)}
.gate li.bad .m{color:var(--seal)}
.gate li.bad{background:var(--seal-soft);border-radius:2px;padding-left:6px}
.gate small{display:block;color:var(--ink-3)}
.gsum{margin:10px 0 0;font-size:12px;color:var(--ink-2)}
.gsum b{color:var(--seal)}

.foot{margin-top:40px;font-size:11px;color:var(--ink-3);border-top:1px solid var(--rule);padding-top:14px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media print{
  .expo,.copy{display:none!important}
  .pr p{display:block!important}
  .pr summary::before{content:""}
  .page{max-width:none;padding:0}
  section.top-sec,.scene{page-break-inside:avoid}
  body{background:#fff}
}
</style></head><body>
<div class="page">

<header class="hd">
  <h1>${esc(doc.source)}</h1>
  <span class="sub">${esc(t.kicker)} · ${esc(t.styleLine(doc.style))}</span>
  <span class="right">
    <span class="gatepill ${failed.length ? 'fail' : 'pass'}">${failed.length ? '✗' : '✓'} ${esc(t.gatePill(gates.length - failed.length, gates.length))}</span>
    <button class="expo" data-name="${esc(slug(doc.source))}-art.json">${esc(t.exportJson)}</button>
  </span>
</header>

<div class="kpis">
  <div class="kpi accent"><div class="l">${esc(t.kpi.scenes)}</div><div class="v">${scenes.length}</div><div class="d">${esc(t.kpi.scenesSub(primaryN, variantN))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.propsK)}</div><div class="v">${props.length}</div><div class="d">${esc(t.kpi.propsSub(stateN))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.anchors)}</div><div class="v">${anchorN}</div><div class="d">${esc(t.kpi.anchorsSub)}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.lighting)}</div><div class="v">${lightN}</div><div class="d">${esc(t.kpi.lightingSub)}</div></div>
</div>
${failed.length ? `<div class="galert"><b>✗ ${esc(t.gatesFail(failed.length))}</b>${failed.map((g) => `<span>${esc(gateText(g, t.langCode).label)}${g.detail ? ` — ${esc(gateText(g, t.langCode).detail)}` : ''}</span>`).join('')}</div>` : ''}

<section class="top-sec" id="sec-list">
  <div class="sec-h"><span class="no">01</span><h2>${esc(t.secList)}</h2></div>
  ${table(t.listCols, listRows)}
</section>

<section class="top-sec" id="sec-cards">
  <div class="sec-h"><span class="no">02</span><h2>${esc(t.secCards)}</h2></div>
  <div class="cards">
${cards}
  </div>
</section>

${props.length ? `<section class="top-sec" id="sec-prop-list">
  <div class="sec-h"><span class="no">03</span><h2>${esc(t.secPropList)}</h2></div>
  ${table(t.propListCols, propListRows)}
</section>

<section class="top-sec" id="sec-prop-cards">
  <div class="sec-h"><span class="no">04</span><h2>${esc(t.secPropCards)}</h2></div>
  <div class="cards">
${propCards}
  </div>
</section>` : ''}

<section class="top-sec" id="sec-gates">
  <div class="sec-h"><span class="no">${props.length ? '05' : '03'}</span><h2>${esc(t.secGates)}</h2></div>
  ${gateList}
  <p class="gsum">${failed.length ? `<b>${esc(t.gatesFail(failed.length))}</b>` : esc(t.gatesPass)}</p>
</section>

<p class="foot">${esc(t.colophon)}</p>
</div>

<div class="lightbox" role="dialog" aria-modal="true">
  <button class="lightbox-x" aria-label="${esc(t.closeImage)}">${esc(t.closeImage)}</button>
  <img alt="">
</div>

<script type="application/json" id="art-data">${embedDoc(doc)}</script>
<script>
const L = ${JSON.stringify({ copied: t.copied, failed: t.copyFailed })};

// 图片弹层：点图放大，点背景或 Esc 关闭
const lb = document.querySelector('.lightbox');
const lbImg = lb.querySelector('img');
function closeLb() { lb.classList.remove('on'); lbImg.removeAttribute('src'); }
document.addEventListener('click', (e) => {
  const z = e.target.closest('.zoom');
  if (z) { lbImg.src = z.dataset.src; lb.classList.add('on'); return; }
  if (e.target.closest('.lightbox')) closeLb();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });

// 复制按钮
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy');
  if (!btn) return;
  e.preventDefault();
  const label = btn.textContent;
  try {
    await navigator.clipboard.writeText(btn.dataset.copy);
    btn.textContent = L.copied;
    btn.dataset.done = '1';
  } catch {
    btn.textContent = L.failed;
  }
  setTimeout(() => { btn.textContent = label; delete btn.dataset.done; }, 1600);
});

// 导出：报告自己带着完整的 art.json，下载的是它原样
document.querySelector('.expo').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const url = URL.createObjectURL(
    new Blob([document.getElementById('art-data').textContent], { type: 'application/json' }),
  );
  const a = Object.assign(document.createElement('a'), { href: url, download: btn.dataset.name });
  a.click();
  // 别立刻回收——Safari 会抢在下载读完之前撤掉 blob
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const USAGE = `novel-art.mjs — novel-art skill 的确定性工具（场景 + 道具）

  seed <outline.json>                    从大纲预填 art.json 骨架（打印到 stdout，道具留空待提取）
  validate <art.json> [--cast c.json] [--prop-states states.json]
                                         校验；有违规逐条打印并 exit 1
                                         给了 cast.json 才查「提示词不含角色名」
                                         --prop-states 给独立剧本状态来源（如 P01:["合上","打开"]），
                                         用于对账「剧情用到的状态是否都出图」；不给则退回 art.json 自报
  checkup <art.json> [--cast c.json] [--prop-states states.json]
                                         只打印质量门 ✓/✗，有未过项 exit 1
  render <art.json> [--html|--md] [--lang zh|en] [--prop-states states.json]
                                         渲染报告到 stdout（默认 --md）
                                         界面语言优先级：--lang > art.json 顶层 lang 字段 > 中文
                                         renderHtml 与 CLI 同源：--prop-states 也会透传给质量门
  styles [id]                            打印画风预设的完整内容
  slug <name>                            场景名转安全文件名

render 会自动去 images/<slug>-sheet.png 找图，找到就嵌进报告。`;

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

function flag(rest, name, fallback = null) {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback;
}

/**
 * 校验 --prop-states 的结构：必须是对象，且须覆盖 art.json 里的全部现有道具
 * （防止删掉某整件道具的键来绕过反查）；值要么是「状态名字符串数组」，要么是显式
 * 的 "none" 声明（该道具确实无需状态对账）。拒绝空对象、错误字段类型、未知道具、
 * 空数组、非字符串元素、缺漏现有道具。
 * 返回干净的对象；不合法则抛错（让 CLI 以非零退出，而不是静默零问题）。
 */
const PROP_STATES_NONE = 'none';
export function validatePropStatesShape(raw, propIds) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('--prop-states 内容必须是 JSON 对象（如 {"P01":["合上","打开"], "P02":"none"}）');
  }
  const valid = new Set(propIds);
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!valid.has(k)) throw new Error(`--prop-states 的键「${k}」不是 art.json 里的现有道具 id（现有：${[...valid].join(',')}）`);
    // 显式声明该道具无需状态对账
    if (v === PROP_STATES_NONE) { out[k] = []; continue; }
    if (!Array.isArray(v)) throw new Error(`--prop-states 的「${k}」必须是状态名字符串数组，或显式 "none" 声明无需状态`);
    if (v.some((s) => typeof s !== 'string')) throw new Error(`--prop-states 的「${k}」必须是纯字符串数组（不能含数字/对象）`);
    const cleaned = v.filter((s) => s.trim());
    if (cleaned.length === 0) throw new Error(`--prop-states 的「${k}」必须是非空字符串数组，若确实无状态请显式写 "none"`);
    out[k] = cleaned;
  }
  // 必须覆盖全部现有道具：缺键即视为漏掉整件道具的反查
  const missing = [...valid].filter((id) => !(id in out));
  if (missing.length) throw new Error(`--prop-states 未覆盖全部现有道具，缺：${missing.join(', ')}（如需跳过某件请显式写 "none"）`);
  // 没有道具时（propIds 为空）不强制写契约；有道具则必须逐项覆盖（上面已查缺失）
  if (valid.size > 0 && Object.keys(out).length === 0) throw new Error('--prop-states 不能是空对象');
  return out;
}

function main(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  if (cmd === 'seed') {
    const [path] = rest;
    if (!path) throw new Error('用法：seed <outline.json>');
    console.log(JSON.stringify(seedFromOutline(readJson(path)), null, 2));
    return;
  }

  if (cmd === 'validate' || cmd === 'checkup') {
    const [path] = rest;
    if (!path) throw new Error(`用法：${cmd} <art.json> [--cast cast.json]`);
    const doc = readJson(path);
    const castPath = flag(rest, '--cast');
    const names = castPath ? castNamesOf(readJson(castPath)) : null;
    if (!castPath) console.error('⚠️ 没给 --cast，跳过「提示词不含角色名」检查');

    // 道具状态反查：优先独立来源 --prop-states <file>（剧本用到的状态，非美术文件自证），
    // 否则退回 art.json 顶层的 propStateRefs（若有）。两都没有则跳过该反查。
    const psPath = flag(rest, '--prop-states');
    let propStateRefs = null;
    const propIds = (doc.props ?? []).map((p) => p?.id).filter(Boolean);
    if (psPath) {
      const raw = readJson(psPath);
      // 结构校验：键必须对应现有道具、值必须是非空字符串数组，否则明确报错（不能静默零问题）
      propStateRefs = validatePropStatesShape(raw, propIds);
      console.error(`ℹ️ 用 --prop-states 提供的独立状态来源对账（${Object.keys(propStateRefs).length} 件道具）`);
    } else if (doc?.propStateRefs) {
      propStateRefs = doc.propStateRefs;
    }
    if (!psPath && !doc?.propStateRefs) {
      console.error('⚠️ 未给 --prop-states 且 art.json 无 propStateRefs，跳过「状态变体未出图」反查');
    }

    // 实际图片核对：states[].image 声明了路径时，基于 art.json 所在目录检查文件是否真实存在。
    // 不声明 image 则门跳过（但明确「提示词齐全 ≠ 已出图」），不阻断正常流程。
    const outDir = resolve(path, '..');
    const assetExists = (rel) => existsSync(resolve(outDir, rel));

    if (cmd === 'checkup') {
      const gates = gateReport(doc, names, propStateRefs, assetExists);
      for (const g of gates) console.log(`${g.ok ? '✓' : '✗'} ${g.label}${!g.ok && g.detail ? ` — ${g.detail}` : ''}`);
      const failedN = gates.filter((g) => !g.ok).length;
      console.log(failedN ? `\n✗ ${failedN} 项未过` : '\n✓ 全部通过');
      if (failedN) process.exit(1);
      return;
    }

    const problems = validateArt(doc, names, propStateRefs, assetExists);
    if (problems.length) {
      console.error(`✗ ${problems.length} 处违规：\n`);
      for (const x of problems) console.error('  ' + x);
      process.exit(1);
    }
    console.log(`✓ ${doc.scenes.length} 个场景${(doc.props ?? []).length ? ` + ${doc.props.length} 件道具` : ''}全部通过校验（style=${doc.style}）`);
    return;
  }

  if (cmd === 'render') {
    const [path] = rest;
    if (!path) throw new Error('用法：render <art.json> [--html|--md] [--lang zh|en] [--prop-states states.json]');
    const doc = readJson(path);
    const lang = flag(rest, '--lang');
    // 图存在才挂上去；没有就渲染成占位，不影响其余内容
    const outDir = resolve(path, '..');
    for (const item of [...doc.scenes, ...(doc.props ?? [])]) {
      const rel = `images/${slug(item.name)}-sheet.png`;
      if (existsSync(resolve(outDir, rel))) item.sheetImage = rel;
    }
    // renderHtml 与 CLI 必须用同一组质量门输入：把 --prop-states 与 assetExists 一并透传
    const psPath = flag(rest, '--prop-states');
    const propIds = (doc.props ?? []).map((p) => p?.id).filter(Boolean);
    const stateRefs = psPath
      ? validatePropStatesShape(readJson(psPath), propIds)
      : (doc.propStateRefs ? validatePropStatesShape(doc.propStateRefs, propIds) : null);
    // assetExists：以 art.json 所在目录为基，校验 states[].image 声明的文件是否真实存在（与 validate/checkup 同源）
    const assetExists = (rel) => existsSync(resolve(outDir, rel));
    process.stdout.write((rest.includes('--html') ? renderHtml(doc, lang, stateRefs, assetExists) : renderMarkdown(doc, lang)) + '\n');
    return;
  }

  if (cmd === 'styles') {
    const only = rest[0];
    if (only && !SUPPORTED_STYLES.includes(only)) {
      throw new Error(`未知风格 ${only}（可用：${SUPPORTED_STYLES.join('/')}）`);
    }
    const ids = only ? [only] : SUPPORTED_STYLES;
    console.log(JSON.stringify({
      default: DEFAULT_STYLE,
      note: '整块取用不混搭；环境预设与 novel-characters 的角色预设同名对齐但内容不同',
      presets: Object.fromEntries(ids.map((id) => [id, SCENE_STYLE_PRESETS[id]])),
    }, null, 2));
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
