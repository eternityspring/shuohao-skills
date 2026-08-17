#!/usr/bin/env node
// novel-characters — deterministic helpers for the novel-characters skill.
// Zero dependencies on purpose: the skill must work in any directory
// without an npm install. Node 18+ (stdlib only).

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* chunk                                                               */
/* ------------------------------------------------------------------ */

// 块大小的权衡：块越大，单块阅读越重；块越小，块数越多，跨块归并
// （全管线语义最难的一步）的接缝就越多。现在的模型读 4 万字符毫无压力，
// 所以往大取——接缝少三倍，漏归并的机会也少三倍。
// 上限 24 块，扣掉 23 段重叠净覆盖约 93 万字符。
export const CHUNK_SIZE = 40_000;
export const CHUNK_OVERLAP = 1_200;
export const MAX_CHUNKS = 24;

/**
 * Split source text on paragraph boundaries into overlapping chunks.
 * Overlap keeps a character introduced at a chunk seam visible to both sides.
 */
export function chunkText(text) {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_SIZE) return [clean];

  const chunks = [];
  let cursor = 0;

  while (cursor < clean.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(cursor + CHUNK_SIZE, clean.length);

    if (end < clean.length) {
      // Prefer a paragraph break, then a sentence end, inside the last 20%.
      const windowStart = cursor + Math.floor(CHUNK_SIZE * 0.8);
      const window = clean.slice(windowStart, end);
      const para = window.lastIndexOf('\n\n');
      const sentence = Math.max(
        window.lastIndexOf('。'),
        window.lastIndexOf('！'),
        window.lastIndexOf('？'),
        window.lastIndexOf('. '),
      );
      const offset = para >= 0 ? para : sentence;
      if (offset >= 0) end = windowStart + offset + 1;
    }

    chunks.push(clean.slice(cursor, end).trim());
    if (end >= clean.length) break;
    cursor = Math.max(end - CHUNK_OVERLAP, cursor + 1);
  }

  return chunks;
}

/* ------------------------------------------------------------------ */
/* merge                                                               */
/* ------------------------------------------------------------------ */

/**
 * Merge per-chunk rosters into one cast, keyed by name AND alias so that
 * 陆行远 / 陆 / 姑娘 collapse onto the same person regardless of which
 * chunk saw which form first.
 */
export function mergeRoster(batches) {
  const byKey = new Map();
  const keyOf = (s) => String(s).trim().toLowerCase();

  for (const batch of batches) {
    for (const entry of batch ?? []) {
      if (!entry?.name) continue;
      const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
      const candidates = [entry.name, ...aliases].map(keyOf).filter(Boolean);
      const existingKey = candidates.find((c) => byKey.has(c));
      const target = existingKey
        ? byKey.get(existingKey)
        : { name: String(entry.name).trim(), aliases: [], notes: [], quotes: [] };

      for (const alias of [entry.name, ...aliases]) {
        const trimmed = String(alias).trim();
        if (trimmed && trimmed !== target.name && !target.aliases.includes(trimmed)) {
          target.aliases.push(trimmed);
        }
      }
      if (entry.note && String(entry.note).trim()) target.notes.push(String(entry.note).trim());
      for (const quote of entry.quotes ?? []) {
        const trimmed = String(quote).trim();
        if (trimmed && !target.quotes.includes(trimmed)) target.quotes.push(trimmed);
      }

      for (const c of candidates) byKey.set(c, target);
    }
  }

  // Collapse the alias-keyed index back to one entry per character.
  const unique = new Map();
  for (const value of byKey.values()) unique.set(keyOf(value.name), value);
  // More chunks mentioning a character == more screen time.
  return [...unique.values()].sort((a, b) => b.notes.length - a.notes.length);
}

/**
 * 疑似同人候选。跨块身份消解是语义问题，确定性代码只能做廉价的那一半：
 * 名字包含（「陆」⊂「陆行远」）是很强的合并信号，精确匹配却收敛不了它——
 * 除非某块恰好把「陆」列成了「陆行远」的别名。「陆先生」和「行远」是不是
 * 同一个人则连包含都测不出，所以候选只是嫌疑名单，判断留给模型，
 * 复核结果写成 merges.json 再用 --apply 确定性落地。
 */
export function mergeCandidates(cast) {
  const keysOf = (c) => [c.name, ...(c.aliases ?? [])].map((s) => String(s).trim()).filter(Boolean);
  const candidates = [];
  for (let i = 0; i < cast.length; i++) {
    for (let j = i + 1; j < cast.length; j++) {
      let reason = null;
      for (const a of keysOf(cast[i])) {
        for (const b of keysOf(cast[j])) {
          const [short, long] = a.length <= b.length ? [a, b] : [b, a];
          if (short.toLowerCase() === long.toLowerCase()) continue; // 相等的键 mergeRoster 已经收敛了
          // 拉丁文字短侧至少 3 个字符，否则「Al」⊂「Alex」这类噪音太多；CJK 单字就有信息量
          const min = CJK.test(short) ? 1 : 3;
          if (short.length >= min && long.toLowerCase().includes(short.toLowerCase())) {
            reason = `「${short}」⊂「${long}」`;
            break;
          }
        }
        if (reason) break;
      }
      if (reason) candidates.push({ a: cast[i].name, b: cast[j].name, reason });
    }
  }
  return candidates;
}

/**
 * 把模型复核后的合并决定落地。merges: [{ keep, absorb: [...] }]，
 * keep / absorb 用 name 或任一 alias 定位都行。找不到就整体报错——
 * 静默跳过会让调用方以为合并成功了。
 * 不改动传入的 cast：全程在副本上操作，抛错后入参照常可用。
 */
export function applyMerges(cast, merges) {
  cast = cast.map((c) => ({ ...c, aliases: [...c.aliases], notes: [...c.notes], quotes: [...c.quotes] }));
  const keyOf = (s) => String(s).trim().toLowerCase();
  const index = new Map();
  for (const c of cast) for (const k of [c.name, ...c.aliases]) index.set(keyOf(k), c);

  const removed = new Set();
  const problems = [];
  for (const m of merges ?? []) {
    const target = index.get(keyOf(m?.keep ?? ''));
    if (!target) {
      problems.push(`keep「${m?.keep}」在归并结果里找不到`);
      continue;
    }
    for (const name of m?.absorb ?? []) {
      const victim = index.get(keyOf(name));
      if (!victim) {
        problems.push(`absorb「${name}」在归并结果里找不到`);
        continue;
      }
      if (victim === target) continue; // 本来就是同一个人，不算错
      for (const alias of [victim.name, ...victim.aliases]) {
        if (alias !== target.name && !target.aliases.includes(alias)) target.aliases.push(alias);
      }
      target.notes.push(...victim.notes);
      for (const q of victim.quotes) if (!target.quotes.includes(q)) target.quotes.push(q);
      for (const k of [victim.name, ...victim.aliases]) index.set(keyOf(k), target);
      removed.add(victim);
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));
  return cast.filter((c) => !removed.has(c)).sort((a, b) => b.notes.length - a.notes.length);
}

/* ------------------------------------------------------------------ */
/* slug                                                                */
/* ------------------------------------------------------------------ */

/** Filesystem-safe stem for a character name, CJK preserved. */
export function slug(name) {
  const cleaned = String(name)
    .trim()
    .replace(/[\s/\\:*?"<>|]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'character';
}

/* ------------------------------------------------------------------ */
/* i18n                                                                */
/* ------------------------------------------------------------------ */
/*
 * 报告语言。默认 zh。
 * 内置 zh / en 两套界面文案；给了其他语言码就用 en 的界面骨架，
 * 但角色内容仍按那个语言生成——界面词没翻译总比整篇乱掉强。
 */

export const DEFAULT_LANG = 'zh';

/* ------------------------------------------------------------------ */
/* 画风预设                                                             */
/* ------------------------------------------------------------------ */
/*
 * 换风格是整套换，不是只换一句「画风」。
 *
 * 最容易踩的坑：两个预设的 negativePrompt 几乎是相反的。写实那套刚把
 * photorealistic 从反向词里删掉，吉卜力恰恰要禁它。毛孔、皮下散射、
 * 顺表情肌的皱纹在写实里是加分项，在吉卜力里是反效果。
 *
 * 所以每个预设自带五块：render / surface / lighting / negative / tags，
 * 生成角色卡时整块取用，不要混搭。
 */

export const DEFAULT_STYLE = 'realistic';

export const STYLE_PRESETS = {
  realistic: {
    label: { zh: '半写实厚涂', en: 'Semi-realistic painterly', ja: '半写実・厚塗り' },
    render:
      'Semi-realistic character illustration, painterly rendering with soft blended edges and visible brush texture, anatomically grounded',
    surface:
      'Skin with visible pores and uneven tone, faint capillaries at the nostrils and ear rims, subtle subsurface scattering; eyes with a wet specular highlight, moist lower lid, visible iris fibres and a limbal ring; eyelids and eyebrows slightly asymmetric — no two sides identical; individual flyaway hair strands breaking the silhouette. Fabric with a visible weave, wear and shine at elbows, cuffs and knees, cloth falling with real weight and self-shadowing in the folds',
    // 设定表要平光才好抠图，写实要方向光才有体积——分区解决
    lighting:
      'LIGHTING IN THE LEFT ZONE ONLY: a soft directional key light from the upper left with gentle falloff, subtle ambient occlusion under the chin, in the eye sockets and where the collar meets the neck, giving the head real volume. LIGHTING IN THE RIGHT ZONES: flat even orthographic lighting with no directional key and no cast shadows, so the figures stay measurable and cleanly cut out',
    // 注意：这里绝不能禁 photorealistic
    negative:
      'plastic or waxy skin, over-smoothed airbrushed complexion, poreless doll face, perfectly symmetrical face, dead flat eyes without specular highlight, helmet-like hair with no loose strands, flat untextured fabric with no weave or wear, stiff mannequin posing, extra fingers, malformed hands, text, watermark, signature, busy or patterned background, harsh cast shadows on the backdrop',
    tags: ['semi-realistic', 'painterly', 'character sheet', 'subsurface skin', 'directional key light'],
  },

  ghibli: {
    label: { zh: '吉卜力动画', en: 'Ghibli-like animation', ja: 'ジブリ風アニメ' },
    render:
      'Hand-painted anime cel illustration in the manner of classic Studio Ghibli feature animation: clean confident ink linework of even weight, simple flat cel shading with a single soft shadow tone, gentle rounded forms, warm naturalistic palette, watercolour-like softness',
    // 写实那套的表面细节在这里全是反效果，整块换掉
    surface:
      'Skin as clean flat tone with one soft shadow shape and a warm blush at the cheeks and nose — no pores, no skin texture, no subsurface detail; large clear expressive eyes with a simple round highlight and flat iris colour; hair drawn as grouped strands and clumps with clean silhouettes rather than individual hairs; clothing in simple flat colour with a few decisive fold lines, no fabric weave and no micro-texture',
    // 平光就是这个风格本身的一部分，不需要分区
    lighting:
      'Even, gentle daylight across the whole sheet with a single soft shadow tone; no dramatic key light, no ambient occlusion, no cast shadows — the flat lighting is part of the style and keeps the figures cleanly cut out',
    // 这里反过来，必须禁写实
    negative:
      'photorealistic, 3d render, hyperrealistic skin texture, visible pores, subsurface scattering, harsh contrast, heavy painterly rendering, muddy or desaturated colours, gritty texture overlay, extra fingers, malformed hands, text, watermark, signature, busy or patterned background',
    tags: ['ghibli-like', 'cel shading', 'hand-painted', 'character sheet', 'flat daylight'],
  },
};

export const SUPPORTED_STYLES = Object.keys(STYLE_PRESETS);
export const stylePreset = (id) => STYLE_PRESETS[id] ?? STYLE_PRESETS[DEFAULT_STYLE];

const STRINGS = {
  zh: {
    kicker: '角色设定集',
    titleTail: ' · 角色',
    docTitle: (s) => `${s} · 角色设定集`,
    counts: (n, shots) => `${n} 位角色${shots ? ` · ${shots} 张设定图` : ''} · 按戏份排序`,
    synopsis: '故事摘要',
    indexLabel: '角色索引',
    aka: '又称',
    groups: { persona: '画像', image: '形象', voice: '声音' },
    persona: {
      gender: '性别', ageRange: '年龄', identity: '身份',
      appearance: '外貌', temperament: '性情', motivation: '动机',
      arc: '人物弧光', relationships: '关系', evidence: '原文依据',
    },
    image: {
      style: '画风',
      prompt: '出图提示词 EN', promptLocal: '出图提示词',
      negative: '反向提示词', sheet: '角色设定图提示词 EN',
    },
    voice: {
      timbre: '音色', pitch: '音高', pace: '语速', accent: '口音',
      emotion: '情绪', referenceHint: '类比',
      prompt: '音色提示词 EN', promptLocal: '音色提示词',
    },
    importance: { protagonist: '主角', major: '主要角色', supporting: '配角', minor: '龙套' },
    graphTitle: '关系图谱',
    graphHint: '悬停看关系，点击进角色',
    graphCounts: (n, e) => `${n} 位角色 · ${e} 组关系`,
    exportJson: '导出 JSON',
    graphLabels: '关系文字',
    graphEmpty: '这批角色之间没有互相指认的关系',
    graphDangling: (n) => `另有 ${n} 条关系指向没做画像的角色，图里不画`,
    relationsAll: '全部关系',
    copy: '复制', copied: '已复制', copyFailed: '复制失败', copyJson: '复制整份角色 JSON',
    sheetCaption: '左：半身像　右：全身三视图',
    noImage: '尚未出图',
    noImageHint: '用下方提示词生成',
    colophonA: '画像与提示词由模型依据原文生成，',
    colophonB: '标记处为原文未明说、为可用性补全的内容。',
    mdTitle: (s) => `# ${s} — 角色表`,
    mdCast: (n, names) => `共 ${n} 位角色：${names}`,
    mdSynopsis: '## 故事摘要',
    searchPlaceholder: '搜索角色、特质、身份',
    rosterTitle: '角色 · 按戏份排序',
    footnote: '标注（推断）的条目为原文未明写、依据文本推演。',
    noMatch: '没有匹配的角色',
    voiceTag: 'VOICE',
    expandAll: '全部展开',
    zoomImage: '放大查看',
    copyImage: '复制图片',
    closeImage: '关闭',
  },
  en: {
    kicker: 'CHARACTER BIBLE',
    titleTail: ' · Cast',
    docTitle: (s) => `${s} · Character Bible`,
    counts: (n, shots) =>
      `${n} character${n === 1 ? '' : 's'}${shots ? ` · ${shots} sheet${shots === 1 ? '' : 's'}` : ''} · ordered by prominence`,
    synopsis: 'Synopsis',
    indexLabel: 'Cast index',
    aka: 'a.k.a.',
    groups: { persona: 'Profile', image: 'Design', voice: 'Voice' },
    persona: {
      gender: 'Gender', ageRange: 'Age', identity: 'Standing',
      appearance: 'Appearance', temperament: 'Temperament', motivation: 'Motivation',
      arc: 'Arc', relationships: 'Relationships', evidence: 'From the text',
    },
    image: {
      style: 'Style',
      prompt: 'Image prompt', promptLocal: 'Image prompt (local)',
      negative: 'Negative prompt', sheet: 'Model sheet prompt',
    },
    voice: {
      timbre: 'Timbre', pitch: 'Pitch', pace: 'Pace', accent: 'Accent',
      emotion: 'Emotion', referenceHint: 'Sounds like',
      prompt: 'Voice prompt', promptLocal: 'Voice prompt (local)',
    },
    importance: { protagonist: 'Lead', major: 'Major', supporting: 'Supporting', minor: 'Minor' },
    graphTitle: 'Relationship map',
    graphHint: 'Hover to trace, click to open',
    graphCounts: (n, e) => `${n} character${n === 1 ? '' : 's'} · ${e} link${e === 1 ? '' : 's'}`,
    exportJson: 'Export JSON',
    graphLabels: 'Link labels',
    graphEmpty: 'No one in this cast names anyone else',
    graphDangling: (n) => `${n} more link${n === 1 ? '' : 's'} point to characters without a profile and are not drawn`,
    relationsAll: 'All links',
    copy: 'Copy', copied: 'Copied', copyFailed: 'Failed', copyJson: 'Copy full JSON',
    sheetCaption: 'Left: bust　Right: full-body turnaround',
    noImage: 'Not generated yet',
    noImageHint: 'use the prompts below',
    colophonA: 'Profiles and prompts are model-generated from the source text; ',
    colophonB: 'marks what the text does not state and was filled in for usability.',
    mdTitle: (s) => `# ${s} — Cast`,
    mdCast: (n, names) => `${n} characters: ${names}`,
    mdSynopsis: '## Synopsis',
    searchPlaceholder: 'Search characters, traits, roles',
    rosterTitle: 'Cast · by prominence',
    footnote: 'Anything marked (inferred) is not stated in the text and was reasoned from it.',
    noMatch: 'No matching character',
    voiceTag: 'VOICE',
    expandAll: 'Expand all',
    zoomImage: 'View larger',
    copyImage: 'Copy image',
    closeImage: 'Close',
  },
  ja: {
    kicker: 'キャラクター設定集',
    titleTail: ' · 登場人物',
    docTitle: (s) => `${s} · キャラクター設定集`,
    counts: (n, shots) => `${n}人${shots ? ` · 設定画 ${shots}枚` : ''} · 出番順`,
    synopsis: 'あらすじ',
    indexLabel: '登場人物一覧',
    aka: '別名',
    groups: { persona: '人物像', image: 'ビジュアル', voice: '声' },
    persona: {
      gender: '性別', ageRange: '年齢', identity: '立場',
      appearance: '外見', temperament: '性格', motivation: '動機',
      arc: '人物の変化', relationships: '関係', evidence: '原文の根拠',
    },
    image: {
      style: '画風',
      prompt: '画像プロンプト EN', promptLocal: '画像プロンプト',
      negative: 'ネガティブプロンプト', sheet: 'キャラ設定画プロンプト EN',
    },
    voice: {
      timbre: '声質', pitch: '音域', pace: '話速', accent: '訛り',
      emotion: '感情', referenceHint: 'たとえるなら',
      prompt: '音声プロンプト EN', promptLocal: '音声プロンプト',
    },
    importance: { protagonist: '主役', major: '主要人物', supporting: '脇役', minor: '端役' },
    graphTitle: '相関図',
    graphHint: 'ホバーで関係、クリックで詳細',
    graphCounts: (n, e) => `${n}人 · ${e}組の関係`,
    exportJson: 'JSON を書き出す',
    graphLabels: '関係ラベル',
    graphEmpty: 'この登場人物どうしを結ぶ関係はありません',
    graphDangling: (n) => `他に${n}件、設定を作っていない人物への関係があります（図には出ません）`,
    relationsAll: '関係一覧',
    copy: 'コピー', copied: 'コピー済み', copyFailed: '失敗', copyJson: 'JSON をコピー',
    sheetCaption: '左：バストアップ　右：三面図',
    noImage: '未生成',
    noImageHint: '下のプロンプトで生成',
    colophonA: '人物像とプロンプトは原文をもとにモデルが生成したものです。',
    colophonB: 'の箇所は原文に明記がなく、実用のために補ったものです。',
    mdTitle: (s) => `# ${s} — 登場人物`,
    mdCast: (n, names) => `全${n}人：${names}`,
    mdSynopsis: '## あらすじ',
    searchPlaceholder: 'キャラクター・特徴・立場を検索',
    rosterTitle: '登場人物 · 出番順',
    footnote: '（推断）の箇所は原文に明記がなく、本文から推し量ったものです。',
    noMatch: '該当するキャラクターがいません',
    voiceTag: 'VOICE',
    expandAll: 'すべて展開',
    zoomImage: '拡大表示',
    copyImage: '画像をコピー',
    closeImage: '閉じる',
  },
};

/**
 * 取界面文案。
 *
 * 两层：内置表覆盖常用语言；其他语言由 skill 在生成时翻译一份塞进
 * cast.json 的 `ui`，这里合并进来。这样支持的语言不受内置表限制。
 *
 * @param lang      语言码
 * @param overrides cast.json 的 `ui`，可以只覆盖一部分键
 */
export function strings(lang = DEFAULT_LANG, overrides = null) {
  const base = STRINGS[lang] ?? STRINGS.en;
  if (!overrides || typeof overrides !== 'object') return base;

  // 只合两层——STRINGS 的嵌套就两层深，够用且不会被脏数据带偏。
  const merged = { ...base };
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof base[k] === 'function') continue; // 函数模板不接受覆盖
    if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object') {
      merged[k] = { ...base[k], ...v };
    } else if (typeof v === 'string') {
      merged[k] = v;
    }
  }
  return merged;
}

export const SUPPORTED_UI_LANGS = Object.keys(STRINGS);

/** 需要 skill 补一份 `ui` 翻译的语言（内置表里没有的）。 */
export const needsUiTranslation = (lang) => !SUPPORTED_UI_LANGS.includes(lang);

/** `ui` 里可覆盖的键——供 ui-template 子命令生成骨架。 */
export function uiTemplate() {
  const en = STRINGS.en;
  const out = {};
  for (const [k, v] of Object.entries(en)) {
    if (typeof v === 'function') continue;
    out[k] = v && typeof v === 'object' ? { ...v } : v;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* validate                                                            */
/* ------------------------------------------------------------------ */

const IMPORTANCE = ['protagonist', 'major', 'supporting', 'minor'];
/** 中日韩表意文字与假名、谚文——图像/TTS 提示词里出现就说明串语言了。 */
const CJK = /[㐀-鿿぀-ヿ가-힯]/;
/** 假名单独一条：用来把日文和中文区分开。 */
const KANA = /[぀-ヿ]/;

const PERSONA_STRINGS = ['gender', 'ageRange', 'identity', 'appearance', 'temperament', 'motivation', 'arc'];
/** 机器输入，永远英文——图像和 TTS 引擎都吃英文最稳，跟报告语言无关。 */
const MACHINE_FIELDS = { image: ['prompt', 'negativePrompt', 'sheet'], voice: ['prompt'] };
/** 给人读的，跟随报告语言。 */
const HUMAN_VOICE_FIELDS = ['timbre', 'pitch', 'pace', 'accent', 'emotion', 'referenceHint'];

const normalise = (s) => String(s).replace(/\s+/g, '');

/**
 * @param characters 角色卡数组
 * @param sourceText 原文；null 则跳过逐字引文校验
 * @param lang       报告语言，决定人类可读字段该是什么语言
 */
export function validateCast(characters, sourceText, lang = DEFAULT_LANG, style = DEFAULT_STYLE, referencedIds = null) {
  const problems = [];
  const flatSource = sourceText === null ? null : normalise(sourceText);
  const at = (name, msg) => problems.push(`[${name}] ${msg}`);

  if (!Array.isArray(characters) || characters.length === 0) {
    return ['cast 为空或不是数组'];
  }

  // --- 角色 id 契约：必填、格式 C<两位数字>、不可重复 ---
  // 下游（script/storyboard/outline）用角色码引用，cast 必须有稳定唯一 id 才能对账，
  // 否则「被引用但缺失」门和下游引用都会断链。DJ-demo 已补全 C01–C05。
  const idRe = /^C\d{2}$/;
  const seenIds = new Set();
  for (const c of characters) {
    const name = c?.name ?? '(无名)';
    const id = typeof c?.id === 'string' ? c.id.trim() : '';
    if (!id) {
      problems.push(`[${name}] 缺少 id（角色码必填，格式如 C01，下游用它对账）`);
      continue;
    }
    if (!idRe.test(id)) problems.push(`[${name}] id「${id}」格式应为 C 加两位数字（如 C01）`);
    if (seenIds.has(id)) problems.push(`[${name}] id「${id}」重复，角色码必须唯一`);
    seenIds.add(id);
  }

  // --- 同剧角色画风必须一致 ---
  // 这是整批图"像不像同一部片"的底线。每个角色的 image.style 给人读的画风
  // 一句话，模型在第二趟出卡时可能按各自服装/年龄自由发挥（藏青/冷灰/大地色
  // 各写一套），导致同框时像四个画师画的。预设只约束大类别（realistic/ghibli），
  // 管不到剧内统一，所以用确定性检查兜底：归一化后多于一种值就报错，并点名
  // 哪些角色用了不同画风。单角色（或未写 image.style 的角色）不触发。
  const styleByChar = [];
  for (const c of characters) {
    const name = c?.name ?? '(无名)';
    const style = c?.image?.style;
    if (typeof style === 'string' && style.trim()) styleByChar.push([name, normalise(style)]);
  }
  if (styleByChar.length > 1) {
    const seen = new Map();
    for (const [name, norm] of styleByChar) {
      if (!seen.has(norm)) seen.set(norm, []);
      seen.get(norm).push(name);
    }
    if (seen.size > 1) {
      const groups = [...seen.values()].map((names) => names.join('、')).join('  vs  ');
      problems.push(`同剧角色画风不一致（image.style 必须统一）：${groups}`);
    }
  }

  // --- 同批角色的提示词不许雷同 ---
  /*
   * profile-pass.md 早就写着「同一批角色之间要能区分开，别把长相和声线做成一个样」，
   * 但没有门。模型第二趟出卡时容易套同一个模板：个体描述写得短，剩下全是真实感样板
   * 与固定的构图光照尾巴——两个年龄性别接近的角色出来就是同一个人（issue #9）。
   *
   * 判定：按词集合算 Jaccard 相似度，超阈值就点名那一对。
   * 阈值取 0.75，是量出来的不是拍的——自带样例四个角色两两最高 39%，
   * 而「只改年龄与衣服颜色」的雷同用例是 98%，中间余量极大。
   *
   * image.sheet 刻意不查：三分区排版规范是大段固定文本，真实角色之间本来就有 63%
   * 重合，设门必然误拦——误拦的门比没有门更糟。
   */
  const promptSim = (a, b) => {
    const words = (s) => new Set(String(s ?? '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2));
    const A = words(a); const B = words(b);
    if (A.size < 8 || B.size < 8) return 0;
    const inter = [...A].filter((w) => B.has(w)).length;
    return inter / new Set([...A, ...B]).size;
  };
  const SIM_MAX = 0.75;
  for (const [field, label] of [['prompt', '出图提示词'], ['voice', '音色提示词']]) {
    const get = (c) => (field === 'prompt' ? c?.image?.prompt : c?.voice?.prompt);
    for (let i = 0; i < characters.length; i += 1) {
      for (let j = i + 1; j < characters.length; j += 1) {
        const sim = promptSim(get(characters[i]), get(characters[j]));
        if (sim >= SIM_MAX) {
          const pct = Math.round(sim * 100);
          problems.push(
            `${characters[i]?.name ?? '(无名)'} 与 ${characters[j]?.name ?? '(无名)'} 的${label}雷同 ${pct}%`
            + `（上限 ${Math.round(SIM_MAX * 100)}%）——同一批角色要能区分开，别套同一个模板`,
          );
        }
      }
    }
  }

  for (const c of characters) {
    const name = c?.name ?? '(无名)';

    // --- 结构 ---
    if (typeof c?.name !== 'string' || !c.name.trim()) at(name, '缺少 name');
    if (!Array.isArray(c?.aliases)) at(name, 'aliases 必须是数组');
    if (!IMPORTANCE.includes(c?.importance)) {
      at(name, `importance 必须是 ${IMPORTANCE.join('/')}，实际是 ${JSON.stringify(c?.importance)}`);
    }
    if (typeof c?.oneLiner !== 'string' || !c.oneLiner.trim()) at(name, '缺少 oneLiner');

    const persona = c?.persona;
    if (!persona || typeof persona !== 'object') {
      at(name, '缺少 persona');
    } else {
      for (const f of PERSONA_STRINGS) {
        if (typeof persona[f] !== 'string' || !persona[f].trim()) at(name, `persona.${f} 缺失或为空`);
      }
      if (!Array.isArray(persona.personality)) at(name, 'persona.personality 必须是数组');
      if (!Array.isArray(persona.relationships)) at(name, 'persona.relationships 必须是数组');
      if (!Array.isArray(persona.evidence)) at(name, 'persona.evidence 必须是数组');
    }

    const image = c?.image;
    if (!image || typeof image !== 'object') {
      at(name, '缺少 image');
    } else {
      for (const f of ['style', 'prompt', 'negativePrompt']) {
        if (typeof image[f] !== 'string' || !image[f].trim()) at(name, `image.${f} 缺失或为空`);
      }
      if (typeof image.sheet !== 'string' || !image.sheet.trim()) {
        at(name, 'image.sheet 缺失或为空（角色设定图提示词）');
      }
      if (!Array.isArray(image.tags)) at(name, 'image.tags 必须是数组');
    }

    const voice = c?.voice;
    if (!voice || typeof voice !== 'object') {
      at(name, '缺少 voice');
    } else {
      for (const f of [...HUMAN_VOICE_FIELDS, 'prompt']) {
        if (typeof voice[f] !== 'string' || !voice[f].trim()) at(name, `voice.${f} 缺失或为空`);
      }
    }

    // --- 引文必须逐字 ---
    if (flatSource && Array.isArray(persona?.evidence)) {
      for (const quote of persona.evidence) {
        if (typeof quote !== 'string') {
          at(name, 'persona.evidence 里有非字符串');
        } else if (!flatSource.includes(normalise(quote))) {
          at(name, `引文不是原文逐字片段：${quote}`);
        }
      }
    }

    // --- 出图提示词不许出现人名 ---
    if (image) {
      const names = [c?.name, ...(Array.isArray(c?.aliases) ? c.aliases : [])].filter(
        (n) => typeof n === 'string' && n.trim(),
      );
      for (const field of ['prompt', 'promptLocal', 'sheet']) {
        const value = image[field];
        if (typeof value !== 'string') continue;
        for (const n of names) {
          if (value.includes(n)) at(name, `image.${field} 里出现了人名「${n}」`);
        }
      }
    }

    // --- 语言分工 ---
    // 机器字段永远英文；人类字段跟随报告语言。
    // 只有 zh / en 能可靠自动判别，其他语言不猜、跳过。
    for (const [group, fields] of Object.entries(MACHINE_FIELDS)) {
      const obj = c?.[group];
      if (!obj) continue;
      for (const f of fields) {
        if (typeof obj[f] === 'string' && CJK.test(obj[f])) {
          at(name, `${group}.${f} 是喂给模型的，必须英文，但含中日韩字符`);
        }
      }
    }
    if (Array.isArray(image?.tags)) {
      for (const t of image.tags) {
        if (typeof t === 'string' && CJK.test(t)) at(name, `image.tags 必须英文，但「${t}」含中日韩字符`);
      }
    }
    // --- 风格与提示词必须匹配 ---
    // 两个预设的反向提示词几乎是相反的，搞反了整批图都毁。
    if (image && SUPPORTED_STYLES.includes(style)) {
      const neg = typeof image.negativePrompt === 'string' ? image.negativePrompt : '';
      const bansRealism = /photorealistic|3d render/i.test(neg);
      if (style === 'realistic' && bansRealism) {
        at(name, 'style=realistic 却在 negativePrompt 里禁 photorealistic／3d render——自相矛盾');
      }
      if (style === 'ghibli' && !bansRealism) {
        at(name, 'style=ghibli 的 negativePrompt 必须禁 photorealistic／3d render');
      }
      const preset = stylePreset(style);
      if (typeof image.sheet === 'string' && !image.sheet.includes(preset.render)) {
        at(name, `image.sheet 里没有 style=${style} 的渲染句，画风会飘`);
      }
    }

    // 只有这三种能可靠自动判别，其他语言不猜、跳过——误报比漏报更烦人。
    if (voice) {
      for (const f of HUMAN_VOICE_FIELDS) {
        const v = voice[f];
        if (typeof v !== 'string' || !v.trim()) continue;
        if (lang === 'en' && CJK.test(v)) at(name, `voice.${f} 应为英文，但含中日韩字符`);
        if (lang === 'zh' && !CJK.test(v)) at(name, `voice.${f} 应为中文，实际是「${v}」`);
        if (lang === 'zh' && KANA.test(v)) at(name, `voice.${f} 应为中文，但含日文假名`);
        if (lang === 'ja' && !KANA.test(v) && !CJK.test(v)) {
          at(name, `voice.${f} 应为日文，实际是「${v}」`);
        }
      }
    }
  }

  // --- 被下游引用但 cast 缺失 ---
  // script/storyboard/outline 引用了某角色 ID，但 cast.json 里没有对应条目：
  // 之前全程静默通过，导致被引用的角色从未建卡。给了 referencedIds 才查。
  if (Array.isArray(referencedIds) && referencedIds.length) {
    const known = new Set();
    for (const c of characters) {
      if (typeof c?.id === 'string' && c.id.trim()) known.add(c.id.trim());
      if (typeof c?.name === 'string' && c.name.trim()) known.add(c.name.trim());
      for (const a of c?.aliases ?? []) if (typeof a === 'string' && a.trim()) known.add(a.trim());
    }
    for (const id of referencedIds) {
      const key = typeof id === 'string' ? id.trim() : null;
      if (key && !known.has(key)) problems.push(`角色「${key}」被下游（script/storyboard/outline）引用，但 cast 中不存在`);
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ */
/* assemble                                                            */
/* ------------------------------------------------------------------ */

/**
 * 把第二趟的角色卡合成 cast.json 的顶层结构。纯机械活——之前留给模型
 * 手拼，手拼会丢字段、写错顶层键。
 *
 * 排序：importance 分档，同档按 order（merge 输出的名字顺序，即戏份
 * 顺序）。不给 order 就保持传入顺序——CLI 按文件名读卡，那是 slug
 * 字典序不是戏份序，所以报告要「按戏份排序」就必须给 order。
 */
export function assembleCast(cards, { source, lang = DEFAULT_LANG, style = DEFAULT_STYLE, summary = '', ui = null, order = null, idMap = null } = {}) {
  const rank = (c) => {
    const i = IMPORTANCE.indexOf(c?.importance);
    return i < 0 ? IMPORTANCE.length : i; // 越界的排最后，让 validate 去报，这里不崩
  };
  const orderIndex = new Map((order ?? []).map((name, i) => [String(name).trim().toLowerCase(), i]));
  // 不在 order 里的排到同档末尾（保持传入顺序），不报错——卡是从 merge 结果生成的，正常对得上
  const byOrder = (c) => orderIndex.get(String(c?.name ?? '').trim().toLowerCase()) ?? orderIndex.size;
  const characters = cards
    .map((card, i) => [card, i])
    .sort((a, b) => rank(a[0]) - rank(b[0]) || byOrder(a[0]) - byOrder(b[0]) || a[1] - b[1])
    // 角色 id 是下游引用的稳定契约，必须从明确映射继承，不能靠数组顺序临时编号：
    // card 自带 id 则保留，否则按 name/alias 查 idMap，查不到则抛出明确错误让调用方补映射
    .map(([card]) => {
      if (card?.id && String(card.id).trim()) return card;
      const key = String(card?.name ?? '').trim().toLowerCase();
      const aliasKeys = (card?.aliases ?? []).map((a) => String(a).trim().toLowerCase());
      const found = idMap
        ? (idMap[key] ?? aliasKeys.map((a) => idMap[a]).find(Boolean))
        : null;
      if (!found) {
        throw new Error(
          `角色「${card?.name ?? '?'}」没有 id，且 --id-map 里找不到对应条目。` +
            '角色 id 是下游（script/storyboard/outline）引用的稳定契约，必须从明确的 id-map 继承，不能按顺序临时编号。' +
            '在 outline 角色表里取 id，或传 --id-map {name: "C01"}。',
        );
      }
      return { ...card, id: found };
    });
  const cast = { source, lang, style };
  if (ui) cast.ui = ui;
  cast.summary = summary;
  cast.characters = characters;
  return cast;
}

/* ------------------------------------------------------------------ */
/* id-map 解析（CLI --id-map 与单测共用）                              */
/* ------------------------------------------------------------------ */

/**
 * 把 --id-map 的输入解析成小写 name/alias -> id 的映射。支持三种格式：
 *   1) outline 对象 {characters:[{id,name,aliases}]}（真实 outline.json 直接可用）
 *   2) 角色表数组 [{id:"C01", name:"沈知微"}]
 *   3) 简单映射 {name:"C01"}
 * 解析不出任何映射则抛错。
 */
export function parseIdMap(raw) {
  const rows = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.characters)
      ? raw.characters
      : null;
  let idMap = null;
  if (rows) {
    idMap = {};
    for (const r of rows) {
      if (r?.id && r?.name) {
        idMap[String(r.name).trim().toLowerCase()] = r.id;
        for (const a of r.aliases ?? []) idMap[String(a).trim().toLowerCase()] = r.id;
      }
    }
  } else if (raw && typeof raw === 'object') {
    idMap = {};
    for (const [k, v] of Object.entries(raw)) idMap[String(k).trim().toLowerCase()] = v;
  }
  if (!idMap || Object.keys(idMap).length === 0) {
    throw new Error('--id-map 未能解析出任何映射：文件应是 {characters:[...]}、[{id,name}] 或 {name:"C01"}');
  }
  return idMap;
}

/* ------------------------------------------------------------------ */
/* render — markdown                                                   */
/* ------------------------------------------------------------------ */

export function renderMarkdown(characters, source, summary = '', lang = DEFAULT_LANG, ui = null) {
  const t = strings(lang, ui);
  const out = [t.mdTitle(source), '', t.mdCast(characters.length, characters.map((c) => c.name).join('、')), ''];
  if (summary) out.push(t.mdSynopsis, '', summary, '');

  for (const c of characters) {
    const { persona, image, voice } = c;
    out.push('---', '');
    out.push(`## ${c.name}${c.aliases.length ? `（${c.aliases.join('、')}）` : ''}`, '');
    out.push(`> ${t.importance[c.importance] ?? c.importance} · ${c.oneLiner}`, '');

    if (c.sheetImage) out.push(`![${c.name} ${t.sheetCaption}](${c.sheetImage})`, '');

    out.push(`### ${t.groups.persona}`, '');
    out.push(`- **${t.persona.gender}**：${persona.gender}`);
    out.push(`- **${t.persona.ageRange}**：${persona.ageRange}`);
    out.push(`- **${t.persona.identity}**：${persona.identity}`);
    if (persona.personality.length) out.push(`- ${persona.personality.join(' / ')}`);
    out.push('');
    out.push(`**${t.persona.appearance}**　${persona.appearance}`, '');
    out.push(`**${t.persona.temperament}**　${persona.temperament}`, '');
    out.push(`**${t.persona.motivation}**　${persona.motivation}`, '');
    out.push(`**${t.persona.arc}**　${persona.arc}`, '');

    if (persona.relationships.length) {
      out.push(`**${t.persona.relationships}**`, '');
      for (const r of persona.relationships) out.push(`- ${r.name} — ${r.relation}`);
      out.push('');
    }
    if (persona.evidence.length) {
      out.push(`**${t.persona.evidence}**`, '');
      for (const q of persona.evidence) out.push(`> ${q}`, '');
    }

    out.push(`### ${t.groups.image}`, '');
    out.push(`**${t.image.style}**　${image.style}`, '');
    if (image.tags.length) out.push(`\`${image.tags.join('`, `')}\``, '');
    out.push(`**${t.image.prompt}**`, '', '```text', image.prompt, '```', '');
    if (image.promptLocal) out.push(`${image.promptLocal}`, '');
    out.push(`**${t.image.negative}**`, '', '```text', image.negativePrompt, '```', '');
    out.push(`**${t.image.sheet}**`, '', '```text', image.sheet, '```', '');

    out.push(`### ${t.groups.voice}`, '');
    for (const f of HUMAN_VOICE_FIELDS) out.push(`- **${t.voice[f]}**：${voice[f]}`);
    out.push('');
    out.push(`**${t.voice.prompt}**`, '', '```text', voice.prompt, '```', '');
    if (voice.promptLocal) out.push(`${voice.promptLocal}`, '');
  }

  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* render — html                                                       */
/* ------------------------------------------------------------------ */
/*
 * 三栏工作台。设计约定见 references/report-style.md。不能破的：
 *   1. 双字域：衬线=叙事与原文，无衬线=分析，等宽=喂给机器的提示词
 *   2. 「（推断）」自动高亮，让读者一眼分清有据和补全
 *   3. 一次只看一个角色，靠左栏切换 + 顶栏搜索找人
 *   4. 打印时全部展开——屏幕上一次一个，纸上要是完整的一份
 */

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** 推断标记：半角/全角 × 中英四种写法都要认，模型不挑食地乱产。 */
const INFERRED = /（\s*(?:推断|inferred)[^）]*）|\(\s*(?:推断|inferred)[^)]*\)/gi;
const marked = (s) => esc(s).replace(INFERRED, (m) => `<span class="inf">${m}</span>`);

const IMPORTANCE_ORDER = ['protagonist', 'major', 'supporting', 'minor'];

/** 左栏的一条角色。缩略图取设定图的左半边——那里正好是半身像。 */
function renderRosterItem(c, index, t) {
  const meta = [c.persona?.gender, c.persona?.ageRange].filter(Boolean).join(' · ');
  const hay = [
    c.name,
    ...(c.aliases ?? []),
    c.persona?.identity,
    c.persona?.gender,
    c.persona?.ageRange,
    ...(c.persona?.personality ?? []),
    c.oneLiner,
  ]
    .filter(Boolean)
    .join(' ');

  return `<button class="rost${index === 0 ? ' on' : ''}" data-target="p-${slug(c.name)}" data-hay="${esc(hay)}">
  <span class="rost-thumb"${
    c.sheetImage ? ` style="background-image:url('${esc(c.sheetImage)}')"` : ''
  }></span>
  <span class="rost-body">
    <span class="rost-top">
      <em class="rost-n">${String(index + 1).padStart(2, '0')}</em>
      <b class="rost-name">${esc(c.name)}</b>
      <span class="badge">${esc(t.importance[c.importance] ?? c.importance)}</span>
      ${meta ? `<span class="rost-meta">${esc(meta)}</span>` : ''}
    </span>
    <span class="rost-one">${esc(c.oneLiner)}</span>
    ${
      c.persona?.personality?.length
        ? `<span class="rost-chips">${c.persona.personality.map((x) => `<i>${esc(x)}</i>`).join('')}</span>`
        : ''
    }
  </span>
</button>`;
}

function renderCharacter(c, index, t) {
  const { persona, image, voice } = c;

  const promptRow = (label, value) =>
    !value
      ? ''
      : `<details class="pr">
  <summary><span>${esc(label)}</span><button class="copy" data-copy="${esc(value)}">${esc(t.copy)}</button></summary>
  <p>${esc(value)}</p>
</details>`;

  const kv = (label, value) =>
    !value ? '' : `<div class="kv"><dt>${esc(label)}</dt><dd>${marked(value)}</dd></div>`;

  const block = (label, body) =>
    !body ? '' : `<section class="blk"><h3>${esc(label)}</h3><p>${marked(body)}</p></section>`;

  const plate = c.sheetImage
    ? `<figure class="plate-wrap">
         <button class="plate zoom" data-src="${esc(c.sheetImage)}" aria-label="${esc(t.zoomImage)}">
           <img src="${esc(c.sheetImage)}" alt="${esc(c.name)} ${esc(t.sheetCaption)}" loading="lazy">
         </button>
         <button class="copy-img" data-img="${esc(c.sheetImage)}" title="${esc(t.copyImage)}">${esc(t.copyImage)}</button>
       </figure>
       <p class="plate-c">${esc(t.sheetCaption)}</p>`
    : `<div class="plate plate-empty">
         <span>${esc(c.name)} · ${esc(t.noImage)}<br><em>${esc(t.noImageHint)}</em></span>
       </div>`;

  return `<article class="char${index === 0 ? ' on' : ''}" id="p-${slug(c.name)}">
  <header class="char-h">
    <span class="char-n">${String(index + 1).padStart(2, '0')}</span>
    <h2>${esc(c.name)}</h2>
    <span class="badge">${esc(t.importance[c.importance] ?? c.importance)}</span>
    ${c.aliases.length ? `<span class="aka">${esc(t.aka)}　${esc(c.aliases.join(' · '))}</span>` : ''}
    <span class="char-one">${marked(c.oneLiner)}</span>
  </header>

  <div class="upper">
    <div class="stage">
      ${plate}

      <div class="grid2">
        ${block(t.persona.appearance, persona.appearance)}
        ${block(t.persona.temperament, persona.temperament)}
        ${block(t.persona.motivation, persona.motivation)}
        ${block(t.persona.arc, persona.arc)}
      </div>

      ${
        persona.evidence.length
          ? `<section class="blk source"><h3>${esc(t.persona.evidence)}</h3>
               <div class="quotes">${persona.evidence.map((q) => `<blockquote>${esc(q)}</blockquote>`).join('')}</div>
             </section>`
          : ''
      }
    </div>

    <aside class="side-cards">
      <div class="card">
        <dl>${kv(t.persona.gender, persona.gender)}${kv(t.persona.ageRange, persona.ageRange)}${kv(t.persona.identity, persona.identity)}</dl>
      </div>

      ${
        persona.relationships.length
          ? `<div class="card"><h4>${esc(t.persona.relationships)}</h4>
               <dl>${persona.relationships.map((r) => `<div class="kv"><dt class="rel-n">${esc(r.name)}</dt><dd>${marked(r.relation)}</dd></div>`).join('')}</dl>
             </div>`
          : ''
      }

      <div class="card">
        <h4>${esc(t.groups.voice)}<i class="tag-en">${esc(t.voiceTag)}</i></h4>
        <dl>${HUMAN_VOICE_FIELDS.map((f) => kv(t.voice[f], voice[f])).join('')}</dl>
      </div>

      <div class="card">
        <h4>${esc(t.image.style)}</h4>
        <p class="style">${esc(image.style)}</p>
        ${image.tags.length ? `<ul class="tags">${image.tags.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      </div>
    </aside>
  </div>

  <div class="prompts">
    <div class="pgroup">
      ${promptRow(t.image.promptLocal, image.promptLocal)}
      ${promptRow(t.image.prompt, image.prompt)}
      ${promptRow(t.image.sheet, image.sheet)}
      ${promptRow(t.image.negative, image.negativePrompt)}
    </div>
    <div class="pgroup">
      ${promptRow(t.voice.promptLocal, voice.promptLocal)}
      ${promptRow(t.voice.prompt, voice.prompt)}
      <div class="pgroup-f">
        <button class="copy wide" data-copy="${esc(JSON.stringify(c, null, 2))}">${esc(t.copyJson)}</button>
      </div>
    </div>
  </div>
</article>`;
}

/* ------------------------------------------------------------------ */
/* render — 关系图谱                                                    */
/* ------------------------------------------------------------------ */
/*
 * 圆环布局 + 向心贝塞尔。位置在 Node 里算好直接写进内联 SVG，
 * 浏览器端只管高亮和跳转——报告要能离线双击打开，不许引任何库。
 */

/** 节点大小按戏份分档，一眼能看出谁是主角。 */
const NODE_R = { protagonist: 11, major: 9, supporting: 7, minor: 5.5 };
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * 把 persona.relationships 解析成无向边。
 *
 * 按**名字 + 别名**建索引：老周的关系里写「老伯」也要连到同一个节点，
 * 只按 name 匹配会把一半的边漏掉。同一对人的两条单向记述合并成一条边，
 * 两个方向的说法都留着。指向没做画像的人算 dangling——不画，但要报数。
 */
export function buildGraph(characters) {
  const key = (s) => String(s).trim().toLowerCase();
  const index = new Map();
  for (const c of characters) {
    index.set(key(c.name), c.name);
    for (const a of c.aliases ?? []) index.set(key(a), c.name);
  }

  const edges = new Map();
  let dangling = 0;
  for (const c of characters) {
    for (const r of c.persona?.relationships ?? []) {
      if (!r || typeof r.name !== 'string') continue;
      const target = index.get(key(r.name));
      if (!target || target === c.name) {
        dangling++;
        continue;
      }
      const [a, b] = [c.name, target].sort();
      const k = `${a} ${b}`;
      if (!edges.has(k)) edges.set(k, { a, b, notes: [] });
      edges.get(k).notes.push({ from: c.name, text: String(r.relation ?? '') });
    }
  }
  return { edges: [...edges.values()], dangling };
}

function renderGraph(ordered, t) {
  const { edges, dangling } = buildGraph(ordered);
  const n = ordered.length;
  // 半径跟人数走，四个人不必撑满一整张画布；两侧留 110 给名字
  const R = Math.max(130, Math.min(260, 40 + n * 14));
  const side = Math.round((R + 110) * 2);
  const c0 = side / 2;

  const pos = new Map();
  ordered.forEach((c, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 1);
    pos.set(c.name, { x: c0 + R * Math.cos(a), y: c0 + R * Math.sin(a), cos: Math.cos(a), sin: Math.sin(a) });
  });

  // 控制点往圆心拉，弦是弯的——直线在人多时会糊成一团网
  const arcs = edges.map((e, i) => {
    const p = pos.get(e.a);
    const q = pos.get(e.b);
    const cxq = c0 + ((p.x + q.x) / 2 - c0) * 0.35;
    const cyq = c0 + ((p.y + q.y) / 2 - c0) * 0.35;
    // 标签沿弦错位排：正对面的两条弦中点都在圆心，全放 t=0.5 会叠成一坨
    const t = 0.5 + ((i % 3) - 1) * 0.14;
    const u = 1 - t;
    return {
      e,
      d: `M${r1(p.x)} ${r1(p.y)} Q${r1(cxq)} ${r1(cyq)} ${r1(q.x)} ${r1(q.y)}`,
      lx: u * u * p.x + 2 * u * t * cxq + t * t * q.x,
      ly: u * u * p.y + 2 * u * t * cyq + t * t * q.y,
    };
  });

  const paths = arcs
    .map((a) => `<path class="gedge" data-a="${esc(a.e.a)}" data-b="${esc(a.e.b)}" d="${a.d}"></path>`)
    .join('');

  // 弦上的关系文字：取最短的一条说法截断，全文进 <title> 当原生 tooltip
  const labels = arcs
    .map((a) => {
      const notes = a.e.notes.filter((x) => x.text.trim());
      if (!notes.length) return '';
      const pick = notes.reduce((s, x) => ([...x.text].length < [...s.text].length ? x : s), notes[0]);
      // 六个字。再长就压到隔壁那条弦上去了——全文在 title 和右侧关系表里
      const chars = [...pick.text.trim()];
      const text = chars.length > 6 ? `${chars.slice(0, 6).join('')}…` : chars.join('');
      const full = notes.map((x) => `${x.from} · ${x.text}`).join('\n');
      return `<text class="glabel" data-a="${esc(a.e.a)}" data-b="${esc(a.e.b)}" x="${r1(a.lx)}" y="${r1(a.ly)}" text-anchor="middle" dominant-baseline="middle">${esc(text)}<title>${esc(full)}</title></text>`;
    })
    .join('');

  const dots = ordered
    .map((c) => {
      const p = pos.get(c.name);
      // 圆顶和圆底的名字居中放，两侧的往外甩，免得压在节点上
      const flat = Math.abs(p.cos) < 0.25;
      const anchor = flat ? 'middle' : p.cos < 0 ? 'end' : 'start';
      const lx = c0 + (R + 15) * p.cos;
      const ly = c0 + (R + 15) * p.sin + (flat ? (p.sin < 0 ? -6 : 14) : 4.5);
      return `<g class="gnode${c.importance === 'protagonist' ? ' lead' : ''}" data-node="${esc(c.name)}" data-target="p-${slug(c.name)}" tabindex="0" role="button" aria-label="${esc(c.name)}">
  <circle class="ghit" cx="${r1(p.x)}" cy="${r1(p.y)}" r="24"></circle>
  <circle class="gdot" cx="${r1(p.x)}" cy="${r1(p.y)}" r="${NODE_R[c.importance] ?? 7}"></circle>
  <text x="${r1(lx)}" y="${r1(ly)}" text-anchor="${anchor}">${esc(c.name)}</text>
</g>`;
    })
    .join('');

  const rows = edges
    .map(
      (e) => `<button class="grow" data-a="${esc(e.a)}" data-b="${esc(e.b)}" data-target="p-${slug(e.a)}">
  <b>${esc(e.a)}</b><i>—</i><b>${esc(e.b)}</b>
  ${e.notes.map((x) => `<span><em>${esc(x.from)}</em> ${marked(x.text)}</span>`).join('')}
</button>`,
    )
    .join('');

  // 边少就直接把关系文字标上；边一多就糊成一团，默认收起来，开关留给用户
  const labelsOn = edges.length <= 14;

  return `<section class="graph${labelsOn ? ' labels' : ''}" id="graph">
  <header class="graph-h">
    <h2>${esc(t.graphTitle)}</h2>
    <span class="badge">${esc(t.graphCounts(n, edges.length))}</span>
    <button class="glabtoggle${labelsOn ? ' on' : ''}" aria-pressed="${labelsOn}">${esc(t.graphLabels)}</button>
    <span class="hint">${esc(t.graphHint)}</span>
  </header>
  <div class="graph-body">
    <div class="graph-canvas">
      <svg viewBox="0 0 ${side} ${side}" role="img" aria-label="${esc(t.graphTitle)}">
        <g class="gedges">${paths}</g>
        <g class="gnodes">${dots}</g>
        <g class="glabels">${labels}</g>
      </svg>
      ${edges.length ? '' : `<p class="graph-empty">${esc(t.graphEmpty)}</p>`}
    </div>
    <aside class="grel">
      <h4>${esc(t.relationsAll)}</h4>
      <div class="grel-list">${rows}</div>
      ${dangling ? `<p class="grel-foot">${esc(t.graphDangling(dangling))}</p>` : ''}
    </aside>
  </div>
</section>`;
}

/*
 * 报告里内嵌的那份数据，形状**就是 cast.json**——编辑完能直接喂回
 * `render` 重新出报告，不另立一套导出格式。
 *
 * `<` 转成 <：JSON 里 `<` 只可能出现在字符串值中，整体替换是安全的，
 * 而不转的话正文里一个 `</script` 就能把这个数据块提前截断。
 */
function embedCast(characters, source, summary, lang, ui, style) {
  const data = { source, lang, style, summary, ...(ui ? { ui } : {}), characters };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function renderHtml(
  characters,
  source,
  summary = '',
  lang = DEFAULT_LANG,
  ui = null,
  style = DEFAULT_STYLE,
) {
  const t = strings(lang, ui);
  const shots = characters.filter((c) => c.sheetImage).length;
  const ordered = [...characters].sort(
    (a, b) => IMPORTANCE_ORDER.indexOf(a.importance) - IMPORTANCE_ORDER.indexOf(b.importance),
  );

  return `<!doctype html>
<html lang="${esc(lang)}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.docTitle(source))}</title>
<style>
/* 冷灰印张 + 铁锈红印记。红色只用在与原文有关的地方和当前选中态。 */
:root{
  --paper:#eceded; --panel:#f5f6f5; --side:#e4e6e3; --ink:#191d21; --ink-2:#5b636a; --ink-3:#8c9298;
  --rule:#d2d5d0; --rule-2:#c2c6bf; --seal:#8a3324; --seal-soft:#8a332412;
  --serif:"Songti SC","STSong","Source Han Serif SC","Noto Serif CJK SC",Georgia,"Iowan Old Style",serif;
  --sans:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --top:60px; --side-w:400px;
}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.7 var(--sans);
  -webkit-font-smoothing:antialiased}
h1,h2,h3,h4{margin:0;font-weight:400}
button{font-family:inherit}

/* ---------- 顶栏 ---------- */
.top{position:sticky;top:0;z-index:20;height:var(--top);display:flex;align-items:center;gap:24px;
  padding:0 20px;background:var(--panel);border-bottom:1px solid var(--rule-2)}
.brand{display:flex;align-items:baseline;gap:10px;flex:none}
.brand h1{font:400 22px/1 var(--serif);letter-spacing:.04em}
.brand em{font:italic 12px/1 var(--serif);color:var(--ink-3)}
.search{flex:1;max-width:720px;position:relative}
.search input{width:100%;height:34px;padding:0 12px 0 32px;border:1px solid var(--rule-2);
  border-radius:3px;background:var(--paper);color:var(--ink);font:14px/1 var(--sans);outline:none}
.search input:focus{border-color:var(--seal)}
.search svg{position:absolute;left:10px;top:9px;width:14px;height:14px;stroke:var(--ink-3);fill:none}
.topmeta{margin-left:auto;font-size:12px;color:var(--ink-3);display:flex;align-items:center;
  gap:10px;flex:none}
.topmeta i{font-style:normal;color:var(--rule-2)}
/* 导出：下载的就是内嵌的那份 cast.json，编辑完能直接喂回 render */
.expo{margin-left:4px;font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--paper);
  border:1px solid var(--rule-2);border-radius:2px;padding:6px 10px;cursor:pointer;transition:.15s}
.expo:hover{border-color:var(--seal);color:var(--seal)}
.expo:focus-visible{outline:2px solid var(--seal);outline-offset:2px}

/* ---------- 骨架 ---------- */
.shell{display:grid;grid-template-columns:var(--side-w) minmax(0,1fr);align-items:start}
@media(max-width:1080px){:root{--side-w:100%}.shell{grid-template-columns:1fr}}

/* ---------- 左栏 ---------- */
.side{position:sticky;top:var(--top);height:calc(100vh - var(--top));overflow-y:auto;
  background:var(--side);border-right:1px solid var(--rule-2)}
@media(max-width:1080px){.side{position:static;height:auto}}
.synopsis{padding:18px 20px;border-bottom:1px solid var(--rule)}
.lbl{font:500 10px/1 var(--sans);letter-spacing:.24em;text-transform:uppercase;color:var(--ink-3)}
.synopsis p{margin:10px 0 0;font:400 14px/1.95 var(--serif)}
/* 摘要默认三行，底部渐隐——左栏第一屏要留给角色列表。点一下展开，之后不再收起 */
.syn-clamp{cursor:pointer}
.syn-clamp p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;
  -webkit-mask-image:linear-gradient(180deg,#000 58%,transparent);
  mask-image:linear-gradient(180deg,#000 58%,transparent)}
.syn-more{display:none;margin-top:7px;padding:0;background:none;border:0;cursor:pointer;
  font:500 11px/1 var(--sans);letter-spacing:.06em;color:var(--seal)}
.syn-clamp .syn-more{display:block}
.syn-more:hover{text-decoration:underline}
.syn-more:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
.roster-h{padding:14px 20px 8px}
.roster{display:block}
.rost{display:grid;grid-template-columns:76px minmax(0,1fr);gap:12px;width:100%;text-align:left;
  padding:12px 20px;background:none;border:0;border-bottom:1px solid var(--rule);
  border-left:2px solid transparent;cursor:pointer;color:inherit}
.rost:hover{background:#00000006}
.rost.on{background:var(--panel);border-left-color:var(--seal)}
.rost:focus-visible{outline:2px solid var(--seal);outline-offset:-2px}
/* 缩略图 = 设定图的左栏切片。设定图固定 16:9、左栏占约 34%，
   所以把整图按 1/0.34 ≈ 294% 放大再左上对齐，裁出来正好是半身像。
   比 <img> + object-position 可控：不依赖浏览器怎么 cover。 */
.rost-thumb{display:block;width:76px;height:76px;border:1px solid var(--rule-2);border-radius:6px;
  background:#fff no-repeat left top;background-size:294% auto}
.rost-body{min-width:0}
.rost-top{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
.rost-n{font:500 10px/1 var(--mono);color:var(--ink-3);font-style:normal}
.rost-name{font:400 17px/1.2 var(--serif);letter-spacing:.03em}
.rost-meta{font-size:11px;color:var(--ink-3)}
.rost-one{display:block;margin-top:5px;font-size:12.5px;line-height:1.65;color:var(--ink-2)}
.rost-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px}
.rost-chips i{font-style:normal;font-size:11px;padding:1px 6px;border:1px solid var(--rule-2);
  border-radius:2px;color:var(--ink-2);background:var(--paper)}
.side-foot{padding:14px 20px 28px;font-size:11px;line-height:1.7;color:var(--ink-3)}
.badge{font-size:11px;padding:1px 7px;border:1px solid var(--rule-2);border-radius:2px;color:var(--ink-2)}
.rost.on .badge,.char-h .badge{border-color:var(--seal);color:var(--seal)}

/* ---------- 主区 ---------- */
.main{padding:26px 28px 72px;min-width:0;max-width:1500px}
.char{display:none}
.char.on{display:block}
.char-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--rule-2)}
.char-n{font:500 13px/1 var(--mono);color:var(--seal)}
.char-h h2{font:400 clamp(24px,2.4vw,30px)/1.1 var(--serif);letter-spacing:.05em}
.aka{font-size:12px;color:var(--ink-3)}
.char-one{margin-left:auto;font:400 14px/1.7 var(--serif);color:var(--ink-2);text-align:right;max-width:44ch}
@media(max-width:900px){.char-one{margin-left:0;text-align:left}}

.upper{display:grid;grid-template-columns:minmax(0,1fr) 500px;gap:26px;align-items:start;margin-top:20px}
@media(max-width:1240px){.upper{grid-template-columns:1fr}}

/* 设定图是白底印张 */
.plate-wrap{position:relative;margin:0}
.plate{display:block;width:100%;padding:0;background:#fff;border:1px solid var(--rule-2);
  border-radius:2px;overflow:hidden;cursor:zoom-in}
.plate img{display:block;width:100%;height:auto}
.plate:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
/* 右下角浮在图上，hover 才明显——别挡住画面 */
.copy-img{position:absolute;right:10px;bottom:10px;font:500 11px/1 var(--sans);color:var(--ink-2);
  background:var(--paper);border:1px solid var(--rule-2);border-radius:3px;padding:6px 10px;
  cursor:pointer;opacity:.55;transition:.15s}
.plate-wrap:hover .copy-img{opacity:1}
.copy-img:hover{border-color:var(--seal);color:var(--seal)}
.copy-img:focus-visible{opacity:1;outline:2px solid var(--seal);outline-offset:2px}
.copy-img[data-done]{border-color:var(--seal);color:var(--seal);opacity:1}

/* 弹层 */
.lightbox{position:fixed;inset:0;z-index:50;display:none;place-items:center;
  background:#191d21e6;padding:32px;cursor:zoom-out}
.lightbox.on{display:grid}
.lightbox img{max-width:100%;max-height:100%;background:#fff;border-radius:2px;
  box-shadow:0 8px 40px #0006}
.lightbox-x{position:absolute;top:18px;right:22px;font:500 13px/1 var(--sans);color:#fff;
  background:none;border:1px solid #fff6;border-radius:3px;padding:8px 12px;cursor:pointer}
.lightbox-x:hover{border-color:#fff}
.plate-empty{display:grid;place-items:center;min-height:220px;text-align:center;
  border:1px dashed var(--rule-2);background:var(--panel);color:var(--ink-3);font-size:13px}
.plate-empty em{font-style:normal;font-size:12px;opacity:.8}
.plate-c{margin:7px 0 0;font-size:11px;letter-spacing:.1em;color:var(--ink-3)}

.grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 30px;margin-top:24px}
@media(max-width:700px){.grid2{grid-template-columns:1fr}}
.blk{margin-bottom:20px}
.blk h3{font:500 11px/1 var(--sans);letter-spacing:.2em;color:var(--seal);margin-bottom:7px}
.blk p{margin:0;font-size:13.5px;line-height:1.85}

/* 原文：衬线体，铁锈红边栏。这里是书自己在说话 */
.source .quotes{display:grid;grid-template-columns:1fr 1fr;gap:10px 30px}
@media(max-width:700px){.source .quotes{grid-template-columns:1fr}}
.source blockquote{margin:0;padding-left:13px;border-left:2px solid var(--seal);
  font:400 13.5px/1.85 var(--serif)}

/* ---------- 右侧信息卡 ---------- */
.side-cards{display:flex;flex-direction:column;gap:14px}
.card{border:1px solid var(--rule);border-radius:2px;background:var(--panel);padding:14px 16px}
.card h4{font:500 11px/1 var(--sans);letter-spacing:.2em;color:var(--ink-3);margin-bottom:10px;
  display:flex;align-items:center;gap:8px}
.tag-en{font:500 9px/1 var(--mono);letter-spacing:.22em;color:var(--rule-2);font-style:normal}
.card dl{margin:0}
.kv{display:flex;gap:12px;padding:2.5px 0;font-size:13px}
.kv dt{color:var(--ink-3);flex:none;width:46px}
.kv dd{margin:0;min-width:0}
.rel-n{color:var(--ink)!important;width:auto!important;min-width:46px}
.style{margin:0;font-size:12.5px;line-height:1.7;color:var(--ink-2)}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0 0;padding:0;list-style:none}
.tags li{font:400 11px/1.5 var(--mono);color:var(--ink-2);border:1px solid var(--rule-2);
  background:var(--paper);border-radius:2px;padding:1px 6px}

/* ---------- 提示词 ---------- */
.prompts{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:28px}
@media(max-width:900px){.prompts{grid-template-columns:1fr}}
.pgroup{border:1px solid var(--rule);border-radius:2px;background:var(--panel);padding:6px 14px 10px}
.pr{border-bottom:1px solid var(--rule)}
.pgroup .pr:last-of-type{border-bottom:0}
.pr summary{display:flex;align-items:center;gap:10px;padding:11px 0;cursor:pointer;list-style:none;
  font:500 12px/1 var(--sans);letter-spacing:.04em}
.pr summary::-webkit-details-marker{display:none}
.pr summary::before{content:"▸";color:var(--seal);font-size:11px;transition:transform .15s}
.pr[open] summary::before{transform:rotate(90deg)}
.pr summary span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pr p{margin:0 0 12px;padding:11px 12px;background:var(--paper);border:1px solid var(--rule);
  border-radius:2px;font:400 12px/1.75 var(--mono);white-space:pre-wrap;word-break:break-word}
.pgroup-f{padding:12px 0 4px}

.copy{flex:none;font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--paper);
  border:1px solid var(--rule-2);border-radius:2px;padding:4px 10px;cursor:pointer;transition:.15s}
.copy:hover{border-color:var(--seal);color:var(--seal)}
.copy:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
.copy[data-done]{border-color:var(--seal);color:var(--seal)}
.copy.wide{width:100%;padding:9px}

/* ---------- 关系图谱 ---------- */
/* 布局在 Node 里算好写进 SVG，这里只管高亮。红色仍然只给选中态 */
.gtoggle{display:flex;align-items:center;gap:9px;width:100%;padding:13px 20px;text-align:left;
  background:none;border:0;border-bottom:1px solid var(--rule);border-left:2px solid transparent;
  cursor:pointer;color:var(--ink-2);font:500 12px/1 var(--sans);letter-spacing:.1em}
.gtoggle:hover{background:#00000006}
.gtoggle.on{background:var(--panel);border-left-color:var(--seal);color:var(--seal)}
.gtoggle:focus-visible{outline:2px solid var(--seal);outline-offset:-2px}
.gtoggle svg{width:15px;height:15px;flex:none;stroke:currentColor;fill:none;stroke-width:1.3}
.graph{display:none}
.graph.on{display:block}
.main.gmode .char{display:none}
.graph-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;
  padding-bottom:14px;border-bottom:1px solid var(--rule-2)}
.graph-h h2{font:400 clamp(22px,2.2vw,28px)/1.1 var(--serif);letter-spacing:.05em}
.graph-h .hint{margin-left:auto;font-size:12px;color:var(--ink-3)}
.graph-body{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:26px;
  align-items:start;margin-top:20px}
@media(max-width:1100px){.graph-body{grid-template-columns:1fr}}
.graph-canvas{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:10px}
.graph-canvas svg{display:block;width:100%;height:auto}
.graph-empty{margin:0 0 8px;text-align:center;font-size:12.5px;color:var(--ink-3)}
.gedge{fill:none;stroke:var(--rule-2);stroke-width:1.1;transition:.15s}
.gedge.hot{stroke:var(--seal);stroke-width:2}
.gedge.dim{opacity:.15}
.gnode{cursor:pointer;transition:.15s}
.gnode .gdot{fill:var(--paper);stroke:var(--ink-2);stroke-width:1.5}
/* 看不见的命中区：节点本身才十来个像素，光标很难压准。
   单独一个类，免得被下面 .lead / .hot 的规则一起染色 */
.gnode .ghit{fill:none;stroke:none;pointer-events:all}
.gnode text{font:400 13px var(--serif);fill:var(--ink)}
.gnode.lead .gdot{fill:var(--seal);stroke:var(--seal)}
.gnode.hot .gdot{stroke:var(--seal);stroke-width:2.5}
.gnode.hot text{fill:var(--seal)}
.gnode.dim{opacity:.22}
.gnode:focus-visible{outline:2px solid var(--seal)}
/* 弦上的关系文字。默认按边数决定开不开，悬停的那条永远显示。
   paint-order + 同色描边 = 给字加一圈底衬，压在弦上也读得清 */
.glabel{display:none;font:400 9px var(--sans);fill:var(--ink-3);pointer-events:none;
  paint-order:stroke;stroke:var(--panel);stroke-width:3px;stroke-linejoin:round}
.graph.labels .glabel{display:block}
.glabel.dim{opacity:.15}
.glabel.hot{display:block;fill:var(--seal);font-weight:500}
.glabtoggle{font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--paper);
  border:1px solid var(--rule-2);border-radius:2px;padding:4px 10px;cursor:pointer;transition:.15s}
.glabtoggle:hover{border-color:var(--seal);color:var(--seal)}
.glabtoggle.on{border-color:var(--seal);color:var(--seal);background:var(--seal-soft)}
.glabtoggle:focus-visible{outline:2px solid var(--seal);outline-offset:2px}
.grel{border:1px solid var(--rule);border-radius:2px;background:var(--panel)}
.grel h4{font:500 11px/1 var(--sans);letter-spacing:.2em;color:var(--ink-3);padding:14px 16px 11px}
.grel-list{max-height:56vh;overflow-y:auto;border-top:1px solid var(--rule)}
.grow{display:block;width:100%;text-align:left;padding:11px 16px;background:none;border:0;
  border-bottom:1px solid var(--rule);cursor:pointer;color:inherit;transition:.15s}
.grow:last-child{border-bottom:0}
.grow:hover,.grow.hot{background:var(--seal-soft)}
.grow.dim{opacity:.3}
.grow:focus-visible{outline:2px solid var(--seal);outline-offset:-2px}
.grow b{font:400 14px/1.4 var(--serif);letter-spacing:.03em}
.grow i{font-style:normal;color:var(--ink-3);padding:0 6px}
.grow span{display:block;margin-top:4px;font-size:12.5px;line-height:1.65;color:var(--ink-2)}
.grow em{font-style:normal;color:var(--ink-3)}
.grel-foot{margin:0;padding:11px 16px;border-top:1px solid var(--rule);
  font-size:11px;line-height:1.6;color:var(--ink-3)}

/* 签名：推断标记 */
.inf{color:var(--ink-3);font-size:.88em;background:var(--seal-soft);padding:0 3px;border-radius:2px}

.nomatch{display:none;padding:20px;font-size:13px;color:var(--ink-3)}
.nomatch.on{display:block}

@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}

/* 屏幕上一次一个角色，纸上要完整 */
@media print{
  .top,.side,.copy{display:none!important}
  .shell{display:block}
  .main{padding:0}
  .graph{display:block!important;page-break-after:always}
  .char{display:block!important;page-break-after:always}
  .pr p{display:block!important}
  .pr summary::before{content:""}
  body{background:#fff}
}
</style></head><body>

<header class="top">
  <div class="brand"><h1>${esc(source)}</h1></div>
  <div class="search">
    <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke-width="1.5"/><path d="M11 11l4 4" stroke-width="1.5"/></svg>
    <input id="q" type="search" placeholder="${esc(t.searchPlaceholder)}" aria-label="${esc(t.searchPlaceholder)}" autocomplete="off">
  </div>
  <div class="topmeta">
    <span>${esc(t.kicker)}</span><i>·</i>
    <span>${esc(t.counts(characters.length, shots))}</span>
    <button class="expo" data-name="${esc(slug(source))}-cast.json">${esc(t.exportJson)}</button>
  </div>
</header>

<div class="shell">
  <aside class="side">
    ${summary ? `<section class="synopsis syn-clamp"><div class="lbl">${esc(t.synopsis)}</div><p>${marked(summary)}</p><button class="syn-more">${esc(t.expandAll)}</button></section>` : ''}
    <button class="gtoggle" aria-controls="graph">
      <svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="3.2" cy="4" r="1.9"/><circle cx="12.8" cy="6.2" r="1.9"/><circle cx="7.2" cy="13" r="1.9"/><path d="M5 4.6l6 1.2M4 5.9l2.5 5.4M11.7 7.9l-3.3 3.7"/></svg>
      <span>${esc(t.graphTitle)}</span>
    </button>
    <div class="roster-h lbl">${esc(t.rosterTitle)}</div>
    <nav class="roster" aria-label="${esc(t.indexLabel)}">
      ${ordered.map((c, i) => renderRosterItem(c, i, t)).join('\n')}
    </nav>
    <p class="nomatch">${esc(t.noMatch)}</p>
    <p class="side-foot">${esc(t.footnote)}</p>
  </aside>

  <main class="main">
    ${renderGraph(ordered, t)}
    ${ordered.map((c, i) => renderCharacter(c, i, t)).join('\n')}
  </main>
</div>

<div class="lightbox" role="dialog" aria-modal="true">
  <button class="lightbox-x" aria-label="${esc(t.closeImage)}">${esc(t.closeImage)}</button>
  <img alt="">
</div>

<script type="application/json" id="cast-data">${embedCast(characters, source, summary, lang, ui, style)}</script>

<script>
const L = ${JSON.stringify({ copied: t.copied, failed: t.copyFailed })};

// 导出：报告自己就带着完整的 cast.json，下载的是它原样
document.querySelector('.expo').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const url = URL.createObjectURL(
    new Blob([document.getElementById('cast-data').textContent], { type: 'application/json' }),
  );
  const a = Object.assign(document.createElement('a'), { href: url, download: btn.dataset.name });
  a.click();
  // 别在 click 之后立刻回收——Safari 上会抢在下载读完之前把 blob 撤掉，存出来是空文件
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

// 左栏切换：一次只显示一个角色
document.querySelector('.roster').addEventListener('click', (e) => {
  const btn = e.target.closest('.rost');
  if (!btn) return;
  document.querySelectorAll('.rost').forEach((b) => b.classList.toggle('on', b === btn));
  document.querySelectorAll('.char').forEach((a) => a.classList.toggle('on', a.id === btn.dataset.target));
  showGraph(false);
  document.querySelector('.main').scrollIntoView({ block: 'start', behavior: 'smooth' });
});

// 关系图谱：一张全景视图，跟角色详情互斥
const gv = document.querySelector('.graph');
const gbtn = document.querySelector('.gtoggle');
function showGraph(on) {
  gv.classList.toggle('on', on);
  gbtn.classList.toggle('on', on);
  document.querySelector('.main').classList.toggle('gmode', on);
}
gbtn.addEventListener('click', () => {
  showGraph(true);
  document.querySelector('.main').scrollIntoView({ block: 'start', behavior: 'smooth' });
});
{
  // 弦和弦上的文字共用 data-a/data-b，高亮逻辑完全一样，放一个数组里
  const edges = [...gv.querySelectorAll('.gedge, .glabel')];
  const nodes = [...gv.querySelectorAll('.gnode')];
  const rows = [...gv.querySelectorAll('.grow')];
  const clear = () => [...edges, ...nodes, ...rows].forEach((el) => el.classList.remove('hot', 'dim'));

  // 悬停一个人：他的关系线亮起来，没关系的压到背景里
  const byNode = (name) => {
    const near = new Set([name]);
    for (const e of edges) {
      if (e.dataset.a === name) near.add(e.dataset.b);
      if (e.dataset.b === name) near.add(e.dataset.a);
    }
    for (const e of edges) {
      const hot = e.dataset.a === name || e.dataset.b === name;
      e.classList.toggle('hot', hot);
      e.classList.toggle('dim', !hot);
    }
    for (const nd of nodes) {
      nd.classList.toggle('hot', nd.dataset.node === name);
      nd.classList.toggle('dim', !near.has(nd.dataset.node));
    }
    for (const r of rows) {
      const hot = r.dataset.a === name || r.dataset.b === name;
      r.classList.toggle('hot', hot);
      r.classList.toggle('dim', !hot);
    }
  };

  // 悬停关系表的一行：只亮那一条弦
  const byEdge = (a, b) => {
    for (const e of edges) {
      const hot = e.dataset.a === a && e.dataset.b === b;
      e.classList.toggle('hot', hot);
      e.classList.toggle('dim', !hot);
    }
    for (const nd of nodes) {
      const hot = nd.dataset.node === a || nd.dataset.node === b;
      nd.classList.toggle('hot', hot);
      nd.classList.toggle('dim', !hot);
    }
    for (const r of rows) {
      const hot = r.dataset.a === a && r.dataset.b === b;
      r.classList.toggle('hot', hot);
      r.classList.toggle('dim', !hot);
    }
  };

  const jump = (el) => {
    const item = document.querySelector('.rost[data-target="' + el.dataset.target + '"]');
    if (item) item.click();
  };

  // 关系文字的总开关：人多的时候标签会盖住图，一键收起
  const glab = gv.querySelector('.glabtoggle');
  glab.addEventListener('click', () => {
    const on = !gv.classList.contains('labels');
    gv.classList.toggle('labels', on);
    glab.classList.toggle('on', on);
    glab.setAttribute('aria-pressed', String(on));
  });

  gv.addEventListener('mouseover', (e) => {
    const nd = e.target.closest('.gnode');
    const row = e.target.closest('.grow');
    if (nd) byNode(nd.dataset.node);
    else if (row) byEdge(row.dataset.a, row.dataset.b);
    else clear();
  });
  gv.addEventListener('mouseleave', clear);
  gv.addEventListener('focusin', (e) => {
    const nd = e.target.closest('.gnode');
    if (nd) byNode(nd.dataset.node);
  });
  gv.addEventListener('click', (e) => {
    const hit = e.target.closest('.gnode, .grow');
    if (hit) jump(hit);
  });
  // SVG 的 <g> 不是原生按钮，回车/空格要自己接
  gv.addEventListener('keydown', (e) => {
    const nd = e.target.closest('.gnode');
    if (!nd || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    jump(nd);
  });
}

// 搜索：过滤左栏；结果只剩一个就直接切过去
document.getElementById('q').addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  let hits = [];
  document.querySelectorAll('.rost').forEach((b) => {
    const hit = !q || b.dataset.hay.toLowerCase().includes(q);
    b.style.display = hit ? '' : 'none';
    if (hit) hits.push(b);
  });
  document.querySelector('.nomatch').classList.toggle('on', hits.length === 0);
  if (q && hits.length === 1) hits[0].click();
});

// 摘要默认三行，点一下展开全部；短到不需要折叠的就直接去掉折叠态
const syn = document.querySelector('.synopsis');
if (syn) {
  const body = syn.querySelector('p');
  if (body.scrollHeight <= body.clientHeight + 1) syn.classList.remove('syn-clamp');
  syn.addEventListener('click', () => syn.classList.remove('syn-clamp'));
}

// 图片弹层
const lb = document.querySelector('.lightbox');
const lbImg = lb.querySelector('img');
function closeLb() { lb.classList.remove('on'); lbImg.removeAttribute('src'); }
document.addEventListener('click', (e) => {
  const z = e.target.closest('.zoom');
  if (z) { lbImg.src = z.dataset.src; lb.classList.add('on'); return; }
  if (e.target.closest('.lightbox')) closeLb();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLb(); });

// 复制图片本身到剪贴板（不是路径）
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy-img');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const label = btn.textContent;
  try {
    const blob = await (await fetch(btn.dataset.img)).blob();
    // Safari 只认 image/png，其它格式先过一遍 canvas
    let png = blob;
    if (blob.type !== 'image/png') {
      const bmp = await createImageBitmap(blob);
      const cv = Object.assign(document.createElement('canvas'), { width: bmp.width, height: bmp.height });
      cv.getContext('2d').drawImage(bmp, 0, 0);
      png = await new Promise((r) => cv.toBlob(r, 'image/png'));
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    btn.textContent = L.copied;
    btn.dataset.done = '1';
  } catch {
    btn.textContent = L.failed;
  }
  setTimeout(() => { btn.textContent = label; delete btn.dataset.done; }, 1600);
});

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
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const USAGE = `novel-characters.mjs — novel-characters skill 的确定性工具

  chunk <book.txt> <workdir>       段落感知重叠切块，写 chunk-NN.txt，打印块数
  merge <workdir>                  归并 roster-*.json，打印 {characters, mergeCandidates}
        [--apply merges.json]      落地复核后的合并决定：{"merges":[{"keep":…,"absorb":[…]}]}
  assemble <workdir> --source <书名>
        [--lang] [--style] [--out] 把 card-*.json + summary.txt（+ ui.json）合成 cast.json
        [--order merged.json]      同档角色的戏份顺序（默认自动找 <workdir>/merged.json）
        [--id-map map.json]        角色 id 映射（{name:"C01"} 或 outline 角色表 [{id,name}]）；
                                    不给且卡片无 id 则 assemble 失败（id 是下游必填契约）
  validate <cast.json> <book.txt> [--refs refs.json]
                                校验；有违规逐条打印并 exit 1
                                --refs 显式给下游引用角色集；不给则自动从同目录
                                outline/script/storyboard 收集，接入「被引用但 cast 缺失」检查
  render <cast.json> [--html|--md] 渲染报告到 stdout（默认 --md）
  slug <name>                      角色名转安全文件名
  ui-template [lang]               打印界面文案骨架，供翻译成内置表没有的语言
  styles [id]                      打印画风预设的完整内容

通用选项：
  --lang <code>     报告语言，默认取 cast.json 的 lang，再默认 ${DEFAULT_LANG}
                    内置界面文案：${SUPPORTED_UI_LANGS.join(' / ')}；其他语言码用英文界面骨架

render 选项：
  --source <name>   报告标题用的书名（默认取 cast.json 的 source 或文件名）
  --images <dir>    图片目录名，默认 images
                    会去找 <dir>/<slug>-sheet.png`;

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), 'utf8'));
}

/**
 * 从下游文件（outline / script / storyboard）收集被引用的角色标识。
 * 只收集「字段名含 character 且数组元素是字符串」的情况——即下游对角色的引用
 * （如 scenes[].characters=['C01','C02']、cuts[].characters=['C01']）。
 * 元素是对象的数组（如 roles=[{id,name,...}] 角色定义本体、或 outline 角色表）不收集，
 * 否则会把「改动记录」「场景ID」等文本误判为角色引用。
 */
function collectReferencedIds(obj) {
  const out = new Set();
  const walk = (v) => {
    if (v == null || typeof v !== 'object') return;
    if (Array.isArray(v)) {
      // 纯字符串数组：若父级字段名含 character 则由调用方判断；这里只处理对象递归
      for (const e of v) walk(e);
      return;
    }
    for (const [k, val] of Object.entries(v)) {
      const key = String(k).toLowerCase();
      if (key.includes('character') && Array.isArray(val) && val.every((e) => typeof e === 'string')) {
        for (const e of val) if (e.trim()) out.add(e.trim());
      }
      walk(val);
    }
  };
  walk(obj);
  return [...out];
}

/** 自动探测下游文件：从 cast 所在目录向下（含子目录）搜索，并在向上查找时
 *  限定在「最近的项目根目录」内——项目根 = 第一个同时含 characters/outline/script/
 *  storyboard 其中多类的祖先目录（通常 cast 住在 <根>/characters/ 下）。
 *  命中「同项目前缀 + 下游类型」的 json，合并去重出被引用角色集；找不到返回 null。
 *  注意：必须完整遍历候选文件再返回，不能在遍历中途因 ids 非空就停，
 *  否则目录顺序靠前的无关文件会让后续真正的 script/storyboard 被漏掉。
 *  关键：绝不向上扫到 Desktop / 用户目录 / 盘根，避免混入同级其他项目、备份或
 *  同名作品的角色引用（造成引用污染与误报）。正式流水线应优先用 --refs 显式给文件。 */
export function autoRefsFromDir(castPath) {
  const base = basename(castPath).replace(/\.json$/i, '');
  const projPrefix = base.includes('-') ? base.split('-')[0] : base; // 渡口-cast -> 渡口
  const ids = new Set();
  const stem0 = basename(castPath);

  // 项目根的判定：含 characters 子目录（cast 必在 <根>/characters/ 下），
  // 或同时含 outline/script/storyboard 中至少两类。
  const isProjectRoot = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    const names = new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name.toLowerCase()));
    if (names.has('characters')) return true;
    const kinds = ['outline', 'script', 'storyboard'].filter((k) => [...names].some((n) => n.startsWith(k)));
    return kinds.length >= 2;
  };

  const walk = (dir, depth) => {
    if (depth > 3) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name === stem0) continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        walk(full, depth + 1);
      } else if (e.name.endsWith('.json')) {
        const stem = e.name.replace(/\.json$/i, '');
        if (/outline|script|storyboard/i.test(stem) && stem.startsWith(projPrefix)) {
          try {
            const obj = readJson(full);
            for (const id of collectReferencedIds(obj)) ids.add(id);
          } catch {
            /* 单个文件坏掉不影响其他 */
          }
        }
      }
    }
  };

  // 1) 向下：从 cast 所在目录（characters/）递归搜子目录
  walk(resolve(castPath, '..'), 0);

  // 2) 向上：只在「最近的项目根」范围内扫。找到项目根后扫它本身，立即停止，
  //    绝不继续上探父级（Desktop / 用户目录 / 盘根）——避免混入同级其他项目或同名作品。
  let cur = resolve(castPath, '..'); // characters/
  let guard = 0;
  while (guard++ < 12) {
    const parent = resolve(cur, '..');
    if (parent === cur) break; // 已到盘根（兜底，正常会在命中项目根时先 break）
    if (isProjectRoot(parent)) {
      walk(parent, 0); // 扫项目根本身的平级文件（outline/script/storyboard 常在这里）
      break;
    }
    cur = parent;
  }

  return ids.size ? [...ids] : null;
}

/** 取 --flag 的值，没有就返回 fallback。 */
function flag(rest, name, fallback = null) {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback;
}

/** cast.json 可以是 {source, lang, summary, characters}，也可以是裸数组（旧格式）。 */
function loadCast(path) {
  const raw = readJson(path);
  const characters = Array.isArray(raw) ? raw : raw.characters;
  if (!Array.isArray(characters)) throw new Error(`${path} 里没有 characters 数组`);
  return {
    characters,
    source: Array.isArray(raw) ? null : raw.source,
    summary: Array.isArray(raw) ? '' : (raw.summary ?? ''),
    lang: Array.isArray(raw) ? DEFAULT_LANG : (raw.lang ?? DEFAULT_LANG),
    ui: Array.isArray(raw) ? null : (raw.ui ?? null),
    style: Array.isArray(raw) ? DEFAULT_STYLE : (raw.style ?? DEFAULT_STYLE),
  };
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
    const text = readFileSync(resolve(book), 'utf8');
    const chunks = chunkText(text);
    mkdirSync(resolve(workdir), { recursive: true });
    chunks.forEach((c, i) => {
      writeFileSync(join(resolve(workdir), `chunk-${String(i).padStart(2, '0')}.txt`), c, 'utf8');
    });
    const truncated = chunks.length >= MAX_CHUNKS && text.length > CHUNK_SIZE * MAX_CHUNKS;
    console.log(
      JSON.stringify(
        { chunks: chunks.length, chars: text.length, workdir: resolve(workdir), truncated },
        null,
        2,
      ),
    );
    if (truncated) console.error(`⚠️ 文本超过 ${MAX_CHUNKS} 块上限，尾部未扫描`);
    return;
  }

  if (cmd === 'merge') {
    const [workdir] = rest;
    if (!workdir || workdir.startsWith('--')) throw new Error('用法：merge <workdir> [--apply merges.json]');
    const dir = resolve(workdir);
    const files = readdirSync(dir).filter((f) => /^roster-.*\.json$/.test(f)).sort();
    if (!files.length) throw new Error(`${dir} 里没有 roster-*.json`);
    const batches = files.map((f) => {
      const raw = readJson(join(dir, f));
      return Array.isArray(raw) ? raw : (raw.characters ?? []);
    });
    let cast = mergeRoster(batches);
    const applyPath = flag(rest, '--apply');
    if (applyPath) {
      const raw = readJson(applyPath);
      cast = applyMerges(cast, Array.isArray(raw) ? raw : (raw.merges ?? []));
    }
    // mergeCandidates 是嫌疑名单不是判决：由调用方复核后写 merges.json 再 --apply
    console.log(JSON.stringify({ characters: cast, mergeCandidates: mergeCandidates(cast) }, null, 2));
    return;
  }

  if (cmd === 'assemble') {
    const [workdir] = rest;
    if (!workdir || workdir.startsWith('--')) {
      throw new Error('用法：assemble <workdir> --source <书名> [--lang zh] [--style realistic] [--out cast.json]');
    }
    const dir = resolve(workdir);
    const sourceName = flag(rest, '--source');
    if (!sourceName) throw new Error('assemble 需要 --source <书名>');
    const lang = flag(rest, '--lang', DEFAULT_LANG);
    const style = flag(rest, '--style', DEFAULT_STYLE);

    const files = readdirSync(dir).filter((f) => /^card-.*\.json$/.test(f)).sort();
    if (!files.length) throw new Error(`${dir} 里没有 card-*.json`);

    // 宽容解析：一份坏卡不废整批——逐个点名，重跑坏的那个角色就行
    const problems = [];
    const cards = [];
    const seen = new Map();
    for (const f of files) {
      let card;
      try {
        card = readJson(join(dir, f));
      } catch (error) {
        problems.push(`${f} 不是合法 JSON（${error.message}）——重跑这个角色即可`);
        continue;
      }
      if (!card || typeof card !== 'object' || Array.isArray(card) || !card.name) {
        problems.push(`${f} 不是单张角色卡（缺 name）——重跑这个角色即可`);
        continue;
      }
      if (seen.has(card.name)) {
        problems.push(`「${card.name}」有两份卡（${seen.get(card.name)} 和 ${f}），删掉多余的那份`);
        continue;
      }
      seen.set(card.name, f);
      cards.push(card);
    }

    const summaryPath = join(dir, 'summary.txt');
    const summary = existsSync(summaryPath) ? readFileSync(summaryPath, 'utf8').trim() : '';
    if (!summary) problems.push(`缺 ${summaryPath}（故事摘要）——用报告语言写 3–5 句进去`);

    const uiPath = join(dir, 'ui.json');
    const ui = existsSync(uiPath) ? readJson(uiPath) : null;
    if (needsUiTranslation(lang) && !ui) {
      problems.push(`lang=${lang} 不在内置界面语言里，缺 ${uiPath}——用 ui-template 生成骨架翻译后放进去`);
    }

    // 同档角色的戏份顺序来自 merge 的输出——卡按文件名读入是 slug 字典序，
    // 不给顺序的话「按戏份排序」就名存实亡
    const orderPath = flag(rest, '--order', existsSync(join(dir, 'merged.json')) ? join(dir, 'merged.json') : null);
    let order = null;
    if (orderPath) {
      const raw = readJson(orderPath);
      const list = Array.isArray(raw) ? raw : (raw.characters ?? []);
      order = list.map((e) => (typeof e === 'string' ? e : e?.name)).filter(Boolean);
    } else {
      console.error(`⚠️ 没有 --order 也没有 ${join(dir, 'merged.json')}，同档角色将按文件名序而不是戏份序`);
    }

    // 角色 id 映射：从 outline 角色表或显式 --id-map 继承稳定 id，不能靠数组顺序临时编号
    const idMapPath = flag(rest, '--id-map');
    let idMap = null;
    if (idMapPath) {
      idMap = parseIdMap(readJson(idMapPath));
    } else {
      console.error('⚠️ 没给 --id-map，角色 id 将从卡片自带 id 继承；若卡片无 id 则 assemble 会失败（id 是必填契约）');
    }

    if (problems.length) {
      console.error(`✗ ${problems.length} 处问题：\n`);
      for (const p of problems) console.error('  ' + p);
      process.exit(1);
    }

    const cast = assembleCast(cards, { source: sourceName, lang, style, summary, ui, order, idMap });
    const json = JSON.stringify(cast, null, 2) + '\n';
    const out = flag(rest, '--out');
    if (out) {
      writeFileSync(resolve(out), json, 'utf8');
      console.log(`✓ ${cast.characters.length} 个角色 → ${resolve(out)}`);
    } else {
      process.stdout.write(json);
    }
    return;
  }

  if (cmd === 'validate') {
    const [castPath, bookPath] = rest;
    if (!castPath) throw new Error('用法：validate <cast.json> <book.txt>');
    const { characters, summary, lang: castLang, ui, style: castStyle } = loadCast(castPath);
    const lang = flag(rest, '--lang', castLang);
    const style = flag(rest, '--style', castStyle);
    const source = bookPath ? readFileSync(resolve(bookPath), 'utf8') : null;
    if (!bookPath) console.error('⚠️ 没给原文，跳过逐字引文校验');

    // 下游角色引用：优先显式 --refs <file>（JSON 数组或含 .characters 字段的对象），
    // 否则自动探测同目录的 outline/script/storyboard 收集，让“被引用但 cast 缺失”门真正接入流水线
    const refsFlag = flag(rest, '--refs');
    let referencedIds = null;
    if (refsFlag) {
      const raw = readJson(refsFlag);
      referencedIds = Array.isArray(raw) ? raw : (raw?.characters ?? []);
      console.error(`ℹ️ 用 --refs 提供的 ${referencedIds.length} 个引用角色对账`);
    } else {
      referencedIds = autoRefsFromDir(castPath);
      if (referencedIds) console.error(`ℹ️ 自动从同目录下游文件收集到 ${referencedIds.length} 个引用角色，已接入缺失对账`);
      else console.error('⚠️ 未给 --refs 且同目录找不到 outline/script/storyboard，跳过「被引用但缺失」检查');
    }

    const problems = validateCast(characters, source, lang, style, referencedIds);
    if (!SUPPORTED_STYLES.includes(style)) {
      problems.unshift(`顶层 style=${style} 不是已知预设（${SUPPORTED_STYLES.join('/')}）`);
    }
    // 顶层的故事摘要——报告要用，缺了就没法在顶部交代背景
    if (typeof summary !== 'string' || !summary.trim()) {
      problems.unshift('顶层缺少 summary（故事摘要），报告顶部会空着');
    }
    // 内置表没有这个语言，又没给 ui 翻译 —— 报告界面会露出英文
    if (needsUiTranslation(lang) && !ui) {
      problems.unshift(
        `lang=${lang} 不在内置界面语言（${SUPPORTED_UI_LANGS.join('/')}）里，` +
          '顶层需要一份 ui 翻译，否则界面文案会是英文。' +
          '用 `ui-template` 生成骨架后翻译填进去。',
      );
    }
    if (problems.length) {
      console.error(`✗ ${problems.length} 处违规：\n`);
      for (const p of problems) console.error('  ' + p);
      process.exit(1);
    }
    console.log(`✓ ${characters.length} 个角色全部通过校验（lang=${lang}, style=${style}）`);
    return;
  }

  if (cmd === 'render') {
    const [castPath] = rest;
    if (!castPath) throw new Error('用法：render <cast.json> [--html|--md]');
    const html = rest.includes('--html');
    const imagesDir = flag(rest, '--images', 'images');
    const sourceFlag = flag(rest, '--source');

    const { characters, source, summary, lang: castLang, ui, style } = loadCast(castPath);
    const lang = flag(rest, '--lang', castLang);
    const title = sourceFlag ?? source ?? basename(castPath).replace(/\.[^.]+$/, '');

    // 图存在才挂上去；没有就渲染成占位，不影响其余内容。
    const outDir = resolve(castPath, '..');
    for (const c of characters) {
      const stem = `${imagesDir}/${slug(c.name)}`;
      if (existsSync(join(outDir, `${stem}-sheet.png`))) c.sheetImage = `${stem}-sheet.png`;
    }

    process.stdout.write(
      (html
        ? renderHtml(characters, title, summary, lang, ui, style)
        : renderMarkdown(characters, title, summary, lang, ui)) + '\n',
    );
    return;
  }

  if (cmd === 'ui-template') {
    const lang = rest[0] ?? '<lang>';
    console.log(
      JSON.stringify(
        { note: `把下面每个值翻译成 ${lang}，整块放进 cast.json 的顶层 "ui"`, ui: uiTemplate() },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === 'styles') {
    const only = rest[0];
    if (only && !SUPPORTED_STYLES.includes(only)) {
      throw new Error(`未知风格 ${only}（可用：${SUPPORTED_STYLES.join('/')}）`);
    }
    const ids = only ? [only] : SUPPORTED_STYLES;
    console.log(
      JSON.stringify(
        {
          default: DEFAULT_STYLE,
          note: '整块取用，不要混搭；两个预设的 negative 几乎是相反的',
          presets: Object.fromEntries(ids.map((id) => [id, STYLE_PRESETS[id]])),
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === 'slug') {
    if (!rest[0]) throw new Error('用法：slug <name>');
    console.log(slug(rest[0]));
    return;
  }

  throw new Error(`未知命令 ${cmd}\n\n${USAGE}`);
}

// 只有直接运行才跑 CLI —— selftest.mjs 需要 import 这些函数。
// 两边都取 realpath：软链安装时 argv[1] 是链接路径，而 import.meta.url
// 已被 Node 解析成真实路径，不归一化就永远不相等。
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
