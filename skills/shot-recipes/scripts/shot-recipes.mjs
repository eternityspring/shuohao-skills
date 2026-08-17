#!/usr/bin/env node
// shot-recipes — deterministic helpers for the shot-recipes skill（镜头配方卡库）。
// Zero dependencies on purpose: the skill must work in any directory
// without an npm install. Node 18+ (stdlib only).

import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* ------------------------------------------------------------------ */
/* 枚举                                                                 */
/* ------------------------------------------------------------------ */
/*
 * 类目是「镜头的功能」不是题材——题材走 applies_to 那一维，两者正交。
 * 这样 Vlog、口播这类题材不必各开一个类目，卡片也不会因为题材分裂。
 */

export const CATEGORIES = {
  dialogue: { zh: '对话', en: 'Dialogue' },
  emotion: { zh: '情绪', en: 'Emotion' },
  reveal: { zh: '揭示', en: 'Reveal' },
  entrance: { zh: '进场', en: 'Entrance' },
  reaction: { zh: '反应', en: 'Reaction' },
  transition: { zh: '转场', en: 'Transition' },
  emphasis: { zh: '强调', en: 'Emphasis' },
  product: { zh: '产品展示', en: 'Product' },
  'talking-head': { zh: '口播', en: 'Talking head' },
};

export const APPLIES_TO = ['drama', 'product', 'talking-head', 'vlog'];

/*
 * 两类卡回答的是两个问题，所以分成两族，不塞进同一套类目：
 *   recipe    功能向——「这场戏这一刀该怎么切」（过肩正反打、进场三件套）
 *   technique 手段向——「这个手段是什么、什么时候用、什么时候别用」（横移、低角度、逆光剪影）
 * 混进同一套类目的话，类目 × 能量矩阵就同时在说两件事，那张图立刻失去意义。
 */
export const KINDS = ['recipe', 'technique'];

/** 技法卡的类目。与配方卡的功能类目**不交叉**，各画各的矩阵。 */
export const TECHNIQUE_CATEGORIES = {
  'camera-move': { zh: '运镜', en: 'Camera move' },
  angle: { zh: '机位角度', en: 'Camera angle' },
  size: { zh: '景别', en: 'Shot size' },
  composition: { zh: '构图', en: 'Composition' },
  lens: { zh: '焦段与景深', en: 'Lens & depth' },
  lighting: { zh: '光线', en: 'Lighting' },
  special: { zh: '特殊技巧', en: 'Special technique' },
  rig: { zh: '设备与复合运镜', en: 'Rig & compound move' },
};

/** 景别 id 与 H3 官方运镜词：卡库自带一份，注明来源，不跨 skill import（自包含硬规则）。 */
export const SIZES = ['extreme-wide', 'wide', 'medium', 'close', 'extreme-close'];
export const SIZE_PHRASES = ['extreme wide shot', 'wide shot', 'medium shot', 'close-up', 'extreme close-up'];
export const CAMERAS = [
  'Static Shot', 'Push In', 'Pull Out', 'Zoom In', 'Zoom Out',
  'Pan Left', 'Pan Right', 'Truck Left', 'Truck Right', 'Tilt Up', 'Tilt Down',
  'Pedestal Up', 'Pedestal Down', 'Arc Shot', 'Tracking Shot',
  'Shake Slightly', 'Shake Strongly', 'POV', 'Roll Clockwise', 'Roll Counterclockwise',
];

/**
 * 保留短语：必备短语不许撞它们。
 * 运镜词和景别短语各自已经有一道门在管（camera-phrase / size-phrase），
 * 而且那两道门查的位置和本库不同（一个查 [Shot k] 段落、一个查 frame）——
 * 同一个词在两处判定，极易一边过一边不过。配方只描述官方词表描述不了的东西。
 */
export const RESERVED_PHRASES = [...CAMERAS.map((c) => c.toLowerCase()), ...SIZE_PHRASES];

/*
 * 每个技法类目要覆盖满的域。**完整性是门，不是口号**——少一项 lint 就点名，
 * 「这个库覆盖全了运镜」这句话从此是查出来的，不是谁说的。
 * 运镜域直接就是 20 个 H3 官方词：官方词表说得出的，这个库必须都讲得出。
 */
export const COVER_DOMAINS = {
  'camera-move': CAMERAS,
  // pov 不放这里——它在 H3 词表里是一个运镜词，归 camera-move，一项只许一个家
  angle: ['eye-level', 'low-angle', 'high-angle', 'overhead', 'worm-eye', 'dutch', 'over-shoulder'],
  size: SIZES,
  composition: ['rule-of-thirds', 'centered', 'frame-within-frame', 'foreground-occlusion', 'symmetry', 'negative-space', 'leading-lines'],
  lens: ['wide-angle', 'normal', 'telephoto-compression', 'shallow-focus', 'deep-focus'],
  lighting: ['backlit-silhouette', 'side-light', 'top-light', 'under-light', 'practical-source', 'high-key', 'low-key'],
  special: ['dolly-zoom', 'oner', 'slow-motion', 'freeze-frame', 'time-lapse', 'jump-cut'],
  /*
   * 设备域是**故意越出 H3 词表**的那一类：官方词表说的是「机器做了什么动作」，
   * 而观众和客户是照电影术语点单的——「给我个航拍」「摇臂升上去」。
   * 生成式里没有器材，但这些术语都有确定的生成式译法（航拍 = 大远景 + 俯视 +
   * 缓慢平移 + aerial view），答不上来就是缺口，不能拿「官方没这个词」挡回去。
   */
  rig: ['steadicam', 'crane', 'drone', 'dolly-track'],
};

/*
 * 正文六节，顺序固定，lint 查齐全与顺序。两族各一套：
 * 配方卡的第二节是提示词骨架，技法卡的第二节是**适用场景**——
 * 手段本身没有「什么时候用」就是废知识，所以它排在提示词前面，而且单独设门。
 */
export const SECTIONS = {
  recipe: {
    zh: ['## 意图', '## 提示词骨架', '## 参数表', '## 参考图约束', '## 已知坑', '## 示例'],
    en: ['## Intent', '## Prompt skeleton', '## Parameters', '## Reference-image constraints', '## Known pitfalls', '## Examples'],
  },
  technique: {
    zh: ['## 这是什么', '## 适用场景', '## 提示词怎么写', '## 参数表', '## 已知坑', '## 示例'],
    en: ['## What it is', '## When to use it', '## How to prompt it', '## Parameters', '## Known pitfalls', '## Examples'],
  },
};

/** 六节里哪一节装提示词代码块——必备短语要落在它的代码块里。 */
export const SKELETON_INDEX = { recipe: 1, technique: 2 };

/** 「适用场景」一节必须写清楚什么时候别用——这一句是硬要求，逐字查。 */
export const NOT_WHEN_MARK = { zh: '什么时候别用', en: 'When not to use it' };

export const sectionsOf = (kind, lang) => SECTIONS[kind === 'technique' ? 'technique' : 'recipe'][lang === 'en' ? 'en' : 'zh'];
export const catalogOf = (kind) => (kind === 'technique' ? TECHNIQUE_CATEGORIES : CATEGORIES);

/**
 * 取「提示词骨架」一节里所有 fenced 代码块的行。
 * 必备短语必须原样落在这些行里——骨架是给人抄的，抄下来就该直接过 check。
 */
export function skeletonLines(body, lang = 'zh', kind = 'recipe') {
  const want = sectionsOf(kind, lang)[SKELETON_INDEX[kind] ?? 1];
  const sect = splitSections(body).find((s) => s.title === want);
  if (!sect) return [];
  const lines = [];
  let inBlock = false;
  for (const line of sect.text.split(/\r?\n/)) {
    if (/^\s*```/.test(line)) { inBlock = !inBlock; continue; }
    if (inBlock) lines.push(line);
  }
  return lines;
}

/** 哪些必备短语没有原样单行落在骨架代码块里。判定与 check 一致：两边小写化。 */
export function missingInSkeleton(body, phrases, lang = 'zh', kind = 'recipe') {
  const lines = skeletonLines(body, lang, kind).map((l) => l.toLowerCase());
  return (phrases ?? []).filter((ph) => {
    const s = String(ph).toLowerCase();
    return !lines.some((l) => l.includes(s));
  });
}

const REQUIRED_FIELDS = [
  'id', 'kind', 'name', 'name_en', 'one_line', 'one_line_en', 'category',
  'applies_to', 'energy', 'seconds', 'cuts', 'sizes', 'cameras', 'must_phrases', 'must_phrases_zh',
  'tags', 'example_frames',
];

/* ------------------------------------------------------------------ */
/* 受限 frontmatter 解析                                                */
/* ------------------------------------------------------------------ */
/*
 * 零依赖意味着没有 YAML 库。所以语法先受限：只允许 `key: 标量` 和
 * `key: [a, b, c]` 行内数组，不允许嵌套、块标量、多行数组。
 * 语法一受限，25 行解析器就不会有歧义；不合规的写法由 lint 拦下来。
 */

const unquote = (s) => s.replace(/^['"](.*)['"]$/, '$1').trim();

export function parseScalar(raw) {
  const v = raw.trim();
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) return { error: '行内数组没有闭合的 ]' };
    const inner = v.slice(1, -1).trim();
    const list = inner ? inner.split(',').map((x) => unquote(x)).filter((x) => x !== '') : [];
    return { value: list.map((x) => (/^-?\d+$/.test(x) ? Number(x) : x)) };
  }
  if (/^-?\d+$/.test(v)) return { value: Number(v) };
  return { value: unquote(v) };
}

export function parseCard(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(String(text ?? ''));
  if (!m) return { data: null, body: '', error: '缺少 frontmatter（--- 包裹的头部）' };
  const data = {};
  const lines = m[1].split(/\r?\n/);
  for (const [i, line] of lines.entries()) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line);
    if (!kv) return { data: null, body: '', error: `frontmatter 第 ${i + 1} 行不是 key: value（受限语法不支持嵌套与多行）` };
    const parsed = parseScalar(kv[2]);
    if (parsed.error) return { data: null, body: '', error: `字段 ${kv[1]}：${parsed.error}` };
    data[kv[1]] = parsed.value;
  }
  return { data, body: m[2], error: null };
}

/* ------------------------------------------------------------------ */
/* 卡片加载                                                             */
/* ------------------------------------------------------------------ */
/*
 * 机器字段只有一份（cards/<id>.md 的 frontmatter，语言中立），
 * 正文分语言：中文在同一个文件里，英文在 cards/en/<id>.md。
 * 英文正文缺失不阻断——回落中文并标记，画廊里明说，不装有。
 */

export function loadCards(dir, { lang = 'zh' } = {}) {
  const root = resolve(dir);
  const files = existsSync(root)
    ? readdirSync(root).filter((f) => f.endsWith('.md')).sort()
    : [];
  const cards = [];
  for (const f of files) {
    const raw = readFileSync(join(root, f), 'utf8');
    const { data, body, error } = parseCard(raw);
    const card = {
      file: f,
      fileId: basename(f, '.md'),
      ...(data ?? {}),
      body: body ?? '',
      bodyLang: 'zh',
      parseError: error,
    };
    if (lang === 'en') {
      const enPath = join(root, 'en', f);
      if (existsSync(enPath)) {
        const en = parseCard(readFileSync(enPath, 'utf8'));
        card.body = en.error ? en.body || card.body : en.body;
        card.bodyLang = en.error ? 'zh' : 'en';
        card.enParseError = en.error;
      } else {
        card.enMissing = true;
      }
    }
    cards.push(card);
  }
  return cards;
}

/** 正文按 `## ` 切成节：{ 标题: 正文 }，顺序保留。 */
export function splitSections(body) {
  const out = [];
  const re = /^## (.+)$/gm;
  let m;
  const marks = [];
  while ((m = re.exec(String(body ?? '')))) marks.push({ title: `## ${m[1].trim()}`, start: m.index, bodyStart: m.index + m[0].length });
  for (const [i, mk] of marks.entries()) {
    const end = i + 1 < marks.length ? marks[i + 1].start : undefined;
    out.push({ title: mk.title, text: String(body).slice(mk.bodyStart, end).trim() });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* lint — 卡库自检                                                      */
/* ------------------------------------------------------------------ */

const isRange = (v) => Array.isArray(v) && v.length === 2 && v.every((n) => typeof n === 'number') && v[0] <= v[1];

export function lintCards(cards, opts = {}) {
  const cardsDir = opts.cardsDir ?? '.';
  const imageExists = opts.imageExists ?? (() => false);
  // 英文正文的存在与读取可注入——自测拿合成卡片逐条击穿时不必落盘（同 renderHtml 的 imageExists）
  const enExists = opts.enExists ?? ((file) => existsSync(join(resolve(cardsDir), 'en', file)));
  const readEn = opts.readEn ?? ((file) => readFileSync(join(resolve(cardsDir), 'en', file), 'utf8'));
  const problems = [];
  const p = (card, msg) => problems.push(`${card.file}：${msg}`);
  const seen = new Map();
  const glossSeen = new Map();

  for (const card of cards) {
    if (card.parseError) {
      p(card, card.parseError);
      continue;
    }
    for (const f of REQUIRED_FIELDS) {
      if (card[f] === undefined) p(card, `缺字段 ${f}`);
    }
    if (card.id !== card.fileId) p(card, `id「${card.id}」与文件名不一致`);
    if (seen.has(card.id)) p(card, `id 与 ${seen.get(card.id)} 重复`);
    seen.set(card.id, card.file);

    const kind = card.kind === 'technique' ? 'technique' : 'recipe';
    if (card.kind !== undefined && !KINDS.includes(card.kind)) p(card, `kind「${card.kind}」必须是 recipe 或 technique`);
    // 两族各查各的类目表，交叉即错——类目混族，画廊的两张矩阵就都读不成话
    if (card.category !== undefined && !catalogOf(kind)[card.category]) {
      const other = catalogOf(kind === 'technique' ? 'recipe' : 'technique')[card.category];
      p(card, other
        ? `category「${card.category}」是${kind === 'technique' ? '配方卡' : '技法卡'}的类目，${kind === 'technique' ? '技法卡' : '配方卡'}不许用`
        : `category「${card.category}」不在 ${kind} 的类目表里（${Object.keys(catalogOf(kind)).join(' / ')}）`);
    }

    // covers：技法卡专属，驱动完整性门
    if (kind === 'technique') {
      const covers = card.covers ?? [];
      if (!covers.length) p(card, '技法卡必须写 covers——它是完整性门的输入，不写就没人知道这张卡把哪一项讲掉了');
      const domain = COVER_DOMAINS[card.category] ?? [];
      for (const c of covers) {
        if (!domain.includes(c)) p(card, `covers 里的「${c}」不在类目「${card.category}」的域里（${domain.join(' / ') || '该类目没有域'}）`);
      }
    } else if (card.covers !== undefined) {
      p(card, 'covers 是技法卡专属字段，配方卡不许写——配方讲的是怎么切，不认领词表里的某一项');
    }
    for (const a of card.applies_to ?? []) {
      if (!APPLIES_TO.includes(a)) p(card, `applies_to 里的「${a}」不在题材枚举里`);
    }
    if (card.energy !== undefined && !(Number.isInteger(card.energy) && card.energy >= 1 && card.energy <= 5)) {
      p(card, `energy「${card.energy}」必须是 1–5 的整数`);
    }
    if (card.seconds !== undefined && !isRange(card.seconds)) p(card, 'seconds 必须是 [min, max] 且 min ≤ max');
    if (card.cuts !== undefined && !isRange(card.cuts)) p(card, 'cuts 必须是 [min, max] 且 min ≤ max');
    for (const s of card.sizes ?? []) if (!SIZES.includes(s)) p(card, `sizes 里的「${s}」不在景别枚举里`);
    for (const c of card.cameras ?? []) if (!CAMERAS.includes(c)) p(card, `cameras 里的「${c}」不在 H3 运镜词表里`);

    const phrases = card.must_phrases ?? [];
    if (!phrases.length) p(card, 'must_phrases 不能为空——没有必备短语的卡片查不了');
    if (phrases.length > 3) p(card, `must_phrases 有 ${phrases.length} 条，上限 3 条——短语越多挂配方越贵，贵了就没人挂`);
    for (const ph of phrases) {
      const s = String(ph);
      if (s !== s.toLowerCase()) p(card, `必备短语「${s}」必须全小写`);
      if (s.length < 6) p(card, `必备短语「${s}」太短（<6 字符），容易假通过`);
      if (!/[ -]/.test(s)) p(card, `必备短语「${s}」必须含空格或连字符——单个通用词会被当子串误判`);
      const hit = RESERVED_PHRASES.find((r) => s.includes(r));
      if (hit) p(card, `必备短语「${s}」撞了保留词「${hit}」——运镜与景别各有一道门在管，配方不许重复设门`);
    }

    // 中文释义与短语一一对应。短语本身必须是英文（要原样进提示词），
    // 释义是给读卡的人看的——两个数组错位比没有释义更糟
    const gloss = card.must_phrases_zh ?? [];
    if (gloss.length !== phrases.length) {
      p(card, `must_phrases_zh 有 ${gloss.length} 条、must_phrases 有 ${phrases.length} 条——必须一一对应，错位比没有更糟`);
    }
    gloss.forEach((g, i) => {
      const s = String(g);
      if (!s.trim()) p(card, `第 ${i + 1} 条必备短语的中文释义是空的`);
      else if (!/[一-龥]/.test(s)) p(card, `必备短语「${phrases[i]}」的释义「${s}」里没有中文——这一列是给中文读者看的`);
      // 同一条短语被多张卡声明时，释义必须逐字相同——索引表一行一条短语，两个译法只能显示一个
      const ph = phrases[i];
      if (ph === undefined) return;
      const prev = glossSeen.get(ph);
      if (prev === undefined) glossSeen.set(ph, { text: s, file: card.file });
      else if (prev.text !== s) {
        p(card, `必备短语「${ph}」的释义与 ${prev.file} 不一致（「${s}」vs「${prev.text}」）——同一条短语只能有一个译法`);
      }
    });

    // 正文六节齐全且顺序固定
    const bodyLang = card.bodyLang === 'en' ? 'en' : 'zh';
    const titles = splitSections(card.body).map((s) => s.title);
    const want = sectionsOf(kind, bodyLang);
    const missing = want.filter((t) => !titles.includes(t));
    if (missing.length) p(card, `正文缺节：${missing.join(' / ')}`);
    else {
      const order = want.map((t) => titles.indexOf(t));
      if (order.some((v, i) => i > 0 && v < order[i - 1])) p(card, '正文六节顺序不对');
    }

    // 技法卡的「适用场景」必须写清楚什么时候别用——只写什么时候用，读的人一定会滥用
    if (kind === 'technique' && !missing.length) {
      const sect = splitSections(card.body).find((s) => s.title === want[1]);
      if (!sect?.text.includes(NOT_WHEN_MARK[bodyLang])) {
        p(card, `「${want[1].replace('## ', '')}」一节里没有「${NOT_WHEN_MARK[bodyLang]}」——只写什么时候用，读卡的人一定会滥用它`);
      }
    }

    // 必备短语必须原样单行落在自己的提示词骨架里
    for (const miss of missingInSkeleton(card.body, phrases, bodyLang, kind)) {
      p(card, `必备短语「${miss}」没有原样出现在「提示词骨架」的代码块里（换行截断也算没有）——骨架抄下来必须能直接过 check`);
    }

    // 英文正文
    if (!enExists(card.file)) p(card, `缺英文正文 en/${card.file}`);
    else {
      const en = parseCard(readEn(card.file));
      if (en.error) p(card, `英文正文解析失败：${en.error}`);
      else {
        if (en.data?.id !== card.id) p(card, `英文正文的 id「${en.data?.id}」与卡片不一致`);
        const enWant = sectionsOf(kind, 'en');
        const enTitles = splitSections(en.body).map((s) => s.title);
        const enMissing = enWant.filter((t) => !enTitles.includes(t));
        if (enMissing.length) p(card, `英文正文缺节：${enMissing.join(' / ')}`);
        else {
          const skelTitle = enWant[SKELETON_INDEX[kind] ?? 1].replace('## ', '');
          for (const miss of missingInSkeleton(en.body, phrases, 'en', kind)) {
            p(card, `英文正文的必备短语「${miss}」没有原样出现在「${skelTitle}」的代码块里（换行截断也算没有）`);
          }
          if (kind === 'technique') {
            const sect = splitSections(en.body).find((s) => s.title === enWant[1]);
            if (!sect?.text.includes(NOT_WHEN_MARK.en)) {
              p(card, `英文正文的「${enWant[1].replace('## ', '')}」一节里没有「${NOT_WHEN_MARK.en}」`);
            }
          }
        }
      }
    }

    // 声明了示例帧就必须真的存在
    for (const fr of card.example_frames ?? []) {
      if (!imageExists(join('frames', String(fr)))) p(card, `声明的示例帧 frames/${fr} 不存在——没有就写空数组，不写占位假文件名`);
    }
  }

  /*
   * 完整性门：每个技法类目的域必须被 covers 铺满。
   * 「这个库覆盖全了运镜」以前只能靠嘴说，现在缺一项就点名——
   * opts.wholeLibrary 为 false 时跳过（自测拿一两张合成卡跑 lint，不该被整库门拦）。
   */
  if (opts.wholeLibrary !== false) {
    const covered = new Map();
    for (const c of cards) {
      if (c.kind !== 'technique' || c.parseError) continue;
      for (const item of c.covers ?? []) {
        if (!covered.has(item)) covered.set(item, []);
        covered.get(item).push(c.id);
      }
    }
    for (const [cat, domain] of Object.entries(COVER_DOMAINS)) {
      const gap = domain.filter((item) => !covered.has(item));
      if (gap.length) {
        problems.push(`类目「${cat}」的域没铺满，缺 ${gap.length} 项：${gap.join(' / ')}——完整性是门，缺一项就不算讲全了`);
      }
    }
  }

  return problems;
}

/** 覆盖情况：每个类目的域逐项列出谁讲了它，给画廊与 CLI 共用。 */
export function coverageOf(cards) {
  const covered = new Map();
  for (const c of cards) {
    if (c.kind !== 'technique') continue;
    for (const item of c.covers ?? []) {
      if (!covered.has(item)) covered.set(item, []);
      covered.get(item).push(c.id);
    }
  }
  return Object.entries(COVER_DOMAINS).map(([cat, domain]) => ({
    category: cat,
    items: domain.map((item) => ({ item, ids: covered.get(item) ?? [] })),
    gap: domain.filter((item) => !covered.has(item)).length,
  }));
}

/* ------------------------------------------------------------------ */
/* check — 检查外部分镜 JSON                                            */
/* ------------------------------------------------------------------ */
/*
 * 输入契约刻意与 novel-storyboard 解耦：深度遍历任意 JSON，
 * 收集同时带 recipe 与 frame 的对象，JSON 路径当定位符。
 * 这样别人手里的任何分镜结构都能吃。
 */

export function collectRecipeRefs(json, path = '') {
  const refs = [];
  const walk = (node, p) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${p}[${i}]`));
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (typeof node.recipe === 'string' && typeof node.frame === 'string') {
      refs.push({ path: p || '(root)', recipe: node.recipe, frame: node.frame, size: node.size, camera: node.camera });
    }
    for (const [k, v] of Object.entries(node)) walk(v, p ? `${p}.${k}` : k);
  };
  walk(json, path);
  return refs;
}

const hasLatin = (s) => /[a-z]/i.test(String(s ?? ''));

export function checkRecipes(refs, cards) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const problems = [];
  const usage = new Map(cards.map((c) => [c.id, 0]));
  let skipped = 0;

  for (const ref of refs) {
    const card = byId.get(ref.recipe);
    if (!card) {
      problems.push(`${ref.path} 引用的配方「${ref.recipe}」不在配方库里`);
      continue;
    }
    usage.set(card.id, (usage.get(card.id) ?? 0) + 1);
    if (!hasLatin(ref.frame)) {
      skipped += 1;
      continue;
    }
    const frame = ref.frame.toLowerCase();
    for (const ph of card.must_phrases ?? []) {
      if (!frame.includes(String(ph).toLowerCase())) {
        problems.push(`${ref.path} 的分镜图提示词缺配方「${card.name}」的必备短语「${ph}」`);
      }
    }
  }
  const unused = cards.filter((c) => (usage.get(c.id) ?? 0) === 0).map((c) => c.id);
  return { problems, skipped, usage, unused, total: refs.length };
}

/* ------------------------------------------------------------------ */
/* render — 界面文案                                                    */
/* ------------------------------------------------------------------ */

const I18N = {
  zh: {
    langCode: 'zh',
    docTitle: '镜头配方卡库',
    subtitle: 'AI 视频的镜头语汇 · 配方卡（这一刀怎么切）+ 技法卡（什么时候用、什么时候别用）',
    exportJson: '导出 JSON',
    gatePill: (ok, total) => `卡库自检 ${ok} / ${total}`,
    kpi: {
      cards: '卡片', cardsSub: (r, t) => `配方 ${r} · 技法 ${t}`,
      cats: '类目', catsSub: '配方 9 类 + 技法 7 类',
      cover: '技法覆盖', coverSub: (gap) => (gap ? `还缺 ${gap} 项` : '七个域全部铺满'),
      frames: '配示例帧', framesSub: (n) => `其余 ${n} 张只有文字`,
      phrases: '必备短语', phrasesSub: '去重后，门查的就是它们',
      cuts: '平均格数', cutsSub: '多格配方是生成式的特点',
    },
    secMatrix: '类目 × 能量矩阵',
    secCards: '配方卡墙',
    secCover: '技法覆盖表',
    secTech: '技法卡墙',
    coverNote: '灰掉的就是还没有人讲的那一项 · 悬停看是哪张卡讲的',
    coverCols: ['类目', '域逐项', '覆盖'],
    techNote: '每张卡：这是什么 / 适用场景 / 提示词怎么写 / 参数 / 已知坑 / 示例',
    secPhrases: '必备短语索引',
    secCoverage: '覆盖对照',
    secLint: '卡库自检',
    matrixNote: '空格子就是语汇缺口 · 点卡片跳到详情',
    cardsNote: '每张卡：意图 / 提示词骨架 / 参数 / 参考图约束 / 已知坑 / 示例',
    phrasesNote: '同一短语被多张卡声明时，在这里一眼看见',
    coverageNote: '给了 --check 才出现',
    energyLabel: '能量',
    secondsLabel: (a, b) => `${a}–${b} 秒`,
    cutsLabel: (a, b) => (a === b ? `${a} 格` : `${a}–${b} 格`),
    sizesLabel: '建议景别',
    camerasLabel: '建议运镜',
    phrasesLabel: '必备短语',
    frameMissing: '示例帧未生成',
    enMissing: '英文正文缺失，暂显中文',
    copy: '复制', copied: '已复制', copyFailed: '复制失败',
    detailsLabel: '展开卡片正文',
    listCols: ['id', '族', '名称', '类目', '能量', '秒', '格', '短语', '帧'],
    listSum: (n, c, f) => `${n} 张卡 · ${c} 个类目 · ${f} 张配示例帧`,
    phraseCols: ['短语', '中文释义', '声明它的卡', '次数'],
    coverageCols: ['卡片', '使用次数'],
    unusedLabel: (n) => `${n} 张卡一次都没有被使用`,
    lintPass: '全部通过',
    lintFail: (n) => `${n} 处问题`,
    colophon: '配方卡描述的是官方词表描述不了的东西——前景肩、浅景深、手持质感、材质环绕。景别与运镜各有一道门在管，卡片不重复设门。',
  },
  en: {
    langCode: 'en',
    docTitle: 'Shot recipe library',
    subtitle: 'Shot vocabulary for AI video — recipe cards (how to take this cut) + technique cards (when to use it, when not to)',
    exportJson: 'Export JSON',
    gatePill: (ok, total) => `Library checks ${ok} / ${total}`,
    kpi: {
      cards: 'Cards', cardsSub: (r, t) => `${r} recipe · ${t} technique`,
      cats: 'Categories', catsSub: '9 recipe + 7 technique',
      cover: 'Technique coverage', coverSub: (gap) => (gap ? `${gap} still missing` : 'all seven domains full'),
      frames: 'With frames', framesSub: (n) => `${n} text-only`,
      phrases: 'Must-have phrases', phrasesSub: 'deduped — this is what the gate checks',
      cuts: 'Cuts per recipe', cutsSub: 'multi-cut recipes are generative-specific',
    },
    secMatrix: 'Category × energy matrix',
    secCards: 'Recipe cards',
    secCover: 'Technique coverage',
    secTech: 'Technique cards',
    coverNote: 'A greyed item is one nobody has covered yet · hover to see which card covers it',
    coverCols: ['Category', 'Domain, item by item', 'Covered'],
    techNote: 'Each card: what it is / when to use it / how to prompt it / parameters / pitfalls / examples',
    secPhrases: 'Must-have phrase index',
    secCoverage: 'Coverage',
    secLint: 'Library checks',
    matrixNote: 'Empty cells are vocabulary gaps · click a card to jump',
    cardsNote: 'Each card: intent / prompt skeleton / parameters / reference constraints / pitfalls / examples',
    phrasesNote: 'A phrase claimed by several cards shows up here at a glance',
    coverageNote: 'only shown with --check',
    energyLabel: 'Energy',
    secondsLabel: (a, b) => `${a}–${b}s`,
    cutsLabel: (a, b) => (a === b ? `${a} cut` : `${a}–${b} cuts`),
    sizesLabel: 'Suggested sizes',
    camerasLabel: 'Suggested camera',
    phrasesLabel: 'Must-have phrases',
    frameMissing: 'Example frame not generated',
    enMissing: 'English body missing — showing Chinese',
    copy: 'Copy', copied: 'Copied', copyFailed: 'Copy failed',
    detailsLabel: 'Open card body',
    listCols: ['id', 'kind', 'name', 'category', 'energy', 'sec', 'cuts', 'phr', 'frame'],
    listSum: (n, c, f) => `${n} cards · ${c} categories · ${f} with example frames`,
    phraseCols: ['Phrase', 'Declared by', 'Count'],
    coverageCols: ['Card', 'Uses'],
    unusedLabel: (n) => `${n} card(s) never used`,
    lintPass: 'all passing',
    lintFail: (n) => `${n} problem(s)`,
    colophon: 'A recipe describes what the official vocabulary cannot — the foreground shoulder, shallow depth of field, handheld feel, an orbit that keeps the silhouette. Shot size and camera move each have their own gate; recipes never gate them twice.',
  },
};

export const tOf = (lang) => {
  if (lang && !I18N[lang]) throw new Error('报告界面语言目前内置 zh / en');
  return I18N[lang ?? 'zh'];
};

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const nameOf = (c, t) => (t.langCode === 'en' ? c.name_en ?? c.name : c.name);
const oneLineOf = (c, t) => (t.langCode === 'en' ? c.one_line_en ?? c.one_line : c.one_line);
const catOf = (c, t) => catalogOf(c.kind)[c.category]?.[t.langCode] ?? c.category;
const isTech = (c) => c.kind === 'technique';

/* ------------------------------------------------------------------ */
/* stats                                                               */
/* ------------------------------------------------------------------ */

export function computeStats(cards) {
  const cats = new Set(cards.map((c) => c.category));
  const withFrames = cards.filter((c) => (c.example_frames ?? []).length > 0).length;
  const phraseMap = new Map();
  const glossMap = new Map();
  for (const c of cards) {
    (c.must_phrases ?? []).forEach((ph, i) => {
      if (!phraseMap.has(ph)) phraseMap.set(ph, []);
      phraseMap.get(ph).push(c.id);
      const g = (c.must_phrases_zh ?? [])[i];
      if (g && !glossMap.has(ph)) glossMap.set(ph, String(g));
    });
  }
  const cutAvg = cards.length
    ? Math.round((cards.reduce((n, c) => n + ((c.cuts?.[0] ?? 1) + (c.cuts?.[1] ?? 1)) / 2, 0) / cards.length) * 10) / 10
    : 0;
  const cov = coverageOf(cards);
  const coverTotal = cov.reduce((n, r) => n + r.items.length, 0);
  const coverGap = cov.reduce((n, r) => n + r.gap, 0);
  return {
    cards: cards.length,
    recipes: cards.filter((c) => c.kind !== 'technique').length,
    techs: cards.filter((c) => c.kind === 'technique').length,
    categories: cats.size,
    coverTotal,
    coverGap,
    coverDone: coverTotal - coverGap,
    withFrames,
    withoutFrames: cards.length - withFrames,
    phrases: [...phraseMap.entries()]
      .map(([phrase, ids]) => ({ phrase, ids, zh: glossMap.get(phrase) ?? '' }))
      .sort((a, b) => b.ids.length - a.ids.length || a.phrase.localeCompare(b.phrase)),
    cutAvg,
  };
}

/* ------------------------------------------------------------------ */
/* render — markdown                                                   */
/* ------------------------------------------------------------------ */

export function renderMarkdown(cards, { lang = 'zh' } = {}) {
  const t = tOf(lang);
  const st = computeStats(cards);
  const out = [`# ${t.docTitle}`, '', `> ${t.listSum(st.cards, st.categories, st.withFrames)}`, '', t.subtitle, ''];
  for (const cat of Object.keys(CATEGORIES)) {
    const inCat = cards.filter((c) => c.category === cat);
    if (!inCat.length) continue;
    out.push(`## ${CATEGORIES[cat][t.langCode]}`, '');
    for (const c of inCat) {
      out.push(`### ${c.id} · ${nameOf(c, t)}`, '', oneLineOf(c, t), '');
      out.push(`- ${t.energyLabel} ${c.energy} · ${t.secondsLabel(c.seconds?.[0], c.seconds?.[1])} · ${t.cutsLabel(c.cuts?.[0], c.cuts?.[1])}`);
      out.push(`- ${t.sizesLabel}: ${(c.sizes ?? []).join(' / ')}　${t.camerasLabel}: ${(c.cameras ?? []).join(' / ')}`);
      const zh = t.langCode !== 'en';
      out.push(`- ${t.phrasesLabel}: ${(c.must_phrases ?? [])
        .map((p, i) => {
          const g = zh ? (c.must_phrases_zh ?? [])[i] : '';
          return `\`${p}\`${g ? `（${g}）` : ''}`;
        })
        .join(' · ')}`, '');
      out.push(c.body.trim(), '');
    }
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* render — html                                                       */
/* ------------------------------------------------------------------ */

export function renderHtml(cards, { lang = 'zh', lintProblems = [], lintChecks = 0, check = null, imageExists = () => false } = {}) {
  const t = tOf(lang);
  const st = computeStats(cards);
  const failed = lintProblems.length;

  const ENERGY_ALPHA = { 1: 0.22, 2: 0.38, 3: 0.55, 4: 0.75, 5: 1 };

  // ---- 01 类目 × 能量矩阵（只画配方卡：技法卡另有一张覆盖表，两族不混在同一张图里）----
  const recipes = cards.filter((c) => !isTech(c));
  const techs = cards.filter(isTech);
  const matrixRows = Object.entries(CATEGORIES)
    .map(([id, label]) => {
      const cells = [1, 2, 3, 4, 5]
        .map((e) => {
          const hit = recipes.filter((c) => c.category === id && c.energy === e);
          if (!hit.length) return '<td class="mx empty"></td>';
          return `<td class="mx" style="background:rgba(138,51,36,${ENERGY_ALPHA[e] * 0.16})">${hit
            .map((c) => `<a class="chip" href="#card-${esc(c.id)}">${esc(nameOf(c, t))}</a>`)
            .join('')}</td>`;
        })
        .join('');
      return `<tr><th>${esc(label[t.langCode])}</th>${cells}</tr>`;
    })
    .join('\n');

  // ---- 02 卡片墙 ----
  // 中文界面多给一份释义：短语本身必须是英文（要原样进提示词），中文读者需要能读的一列
  const showGloss = t.langCode !== 'en';
  const wallOf = (list) => list
    .map((c) => {
      const frames = (c.example_frames ?? []).filter((f) => imageExists(join('frames', String(f))));
      const frameHtml = frames.length
        ? `<div class="frames">${frames
            .map((f) => `<img class="frame" src="${esc(join('frames', String(f)))}" alt="${esc(c.id)}" loading="lazy">`)
            .join('')}</div>`
        : `<div class="frame ph"><b>${esc(t.frameMissing)}</b><span>${esc((c.must_phrases ?? []).join(' · '))}</span></div>`;
      const sections = splitSections(c.body)
        .map((s) => `<h4>${esc(s.title.replace(/^## /, ''))}</h4>\n<div class="sect">${esc(s.text)}</div>`)
        .join('\n');
      return `<article class="card" id="card-${esc(c.id)}">
  <header class="card-h">
    <b class="cid">${esc(c.id)}</b>
    <span class="cname">${esc(nameOf(c, t))}</span>
    <span class="chip cat">${esc(catOf(c, t))}</span>
    <span class="chip">${esc(t.energyLabel)} ${'●'.repeat(c.energy ?? 0)}${'○'.repeat(5 - (c.energy ?? 0))}</span>
    <span class="chip">${esc(t.secondsLabel(c.seconds?.[0], c.seconds?.[1]))}</span>
    <span class="chip">${esc(t.cutsLabel(c.cuts?.[0], c.cuts?.[1]))}</span>
    ${(c.applies_to ?? []).map((a) => `<span class="chip soft">${esc(a)}</span>`).join('')}
    ${(c.covers ?? []).map((v) => `<span class="chip cov mono">${esc(v)}</span>`).join('')}
  </header>
  <p class="one">${esc(oneLineOf(c, t))}</p>
  ${frameHtml}
  <div class="meta">
    <span class="ml">${esc(t.sizesLabel)}</span>${(c.sizes ?? []).map((s) => `<span class="chip mono">${esc(s)}</span>`).join('')}
    <span class="ml">${esc(t.camerasLabel)}</span>${(c.cameras ?? []).map((s) => `<span class="chip mono">${esc(s)}</span>`).join('')}
  </div>
  <div class="meta">
    <span class="ml">${esc(t.phrasesLabel)}</span>${(c.must_phrases ?? [])
      .map((p, i) => {
        // 中文界面把释义挂在 title 上：短语本身一个字母都不能改（要被复制走），
        // 释义只能待在旁边
        const g = showGloss ? (c.must_phrases_zh ?? [])[i] : '';
        return `<button class="chip phrase copy" data-copy="${esc(p)}"${g ? ` title="${esc(g)}"` : ''}>${esc(p)}</button>`;
      })
      .join('')}
  </div>
  ${c.enMissing ? `<p class="warn">${esc(t.enMissing)}</p>` : ''}
  <details><summary>${esc(t.detailsLabel)}</summary>
${sections}
  </details>
</article>`;
    })
    .join('\n');
  const cardBlocks = wallOf(recipes);
  const techBlocks = wallOf(techs);

  // ---- 技法覆盖表：域逐项列出谁讲了它，空的那一项就是缺口 ----
  const covRows = coverageOf(cards)
    .map((row) => {
      const label = TECHNIQUE_CATEGORIES[row.category]?.[t.langCode] ?? row.category;
      const cells = row.items
        .map((it) => (it.ids.length
          ? `<span class="cvi ok" title="${esc(it.ids.join(' / '))}">${esc(it.item)}</span>`
          : `<span class="cvi gap">${esc(it.item)}</span>`))
        .join('');
      return `<tr><th>${esc(label)}</th><td>${cells}</td><td class="cnum${row.gap ? ' bad' : ''}">${row.items.length - row.gap} / ${row.items.length}</td></tr>`;
    })
    .join('\n');

  // ---- 03 必备短语索引 ----
  const phraseRows = st.phrases
    .map((p) => `<tr><td class="mono">${esc(p.phrase)}</td>${showGloss ? `<td class="gl">${esc(p.zh)}</td>` : ''}<td>${p.ids.map((id) => `<a class="chip" href="#card-${esc(id)}">${esc(id)}</a>`).join('')}</td><td>${p.ids.length}</td></tr>`)
    .join('\n');

  // 区块编号跟着实际出现的区块走，不留空号（覆盖对照只在给了 --check 时出现）
  let secNo = 0;
  const no = () => String(++secNo).padStart(2, '0');

  // ---- 覆盖对照（给了 --check 才出）----
  const coverageSection = () => (check
    ? `<section class="top-sec" id="sec-coverage">
  <div class="sec-h"><span class="no">${no()}</span><h2>${esc(t.secCoverage)}</h2><span class="note">${esc(t.coverageNote)}</span></div>
  <table><thead><tr>${t.coverageCols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
${cards.map((c) => `<tr><td><a href="#card-${esc(c.id)}">${esc(c.id)}</a></td><td>${check.usage.get(c.id) ?? 0}</td></tr>`).join('\n')}
  </tbody></table>
  <p class="gsum">${esc(t.unusedLabel(check.unused.length))}${check.unused.length ? `：${esc(check.unused.join(' / '))}` : ''}</p>
</section>`
    : '');

  const lintList = failed
    ? `<ul class="gate">${lintProblems.map((x) => `<li class="bad"><span class="m">✗</span><span>${esc(x)}</span></li>`).join('')}</ul>`
    : `<ul class="gate"><li class="ok"><span class="m">✓</span><span>${esc(t.lintPass)}（${lintChecks}）</span></li></ul>`;

  return `<!doctype html>
<html lang="${t.langCode}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(t.docTitle)}</title>
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
.expo{font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--panel);border:1px solid var(--rule-2);
  border-radius:2px;padding:7px 11px;cursor:pointer;transition:.15s}
.expo:hover{border-color:var(--seal);color:var(--seal)}
.kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:18px 0 6px}
@media(max-width:980px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:11px 14px 9px}
.kpi .l{font:500 10px/1 var(--sans);letter-spacing:.18em;color:var(--ink-3)}
.kpi .v{font:400 28px/1.15 var(--serif);margin-top:5px}
.kpi .v small{font:400 14px var(--serif);color:var(--ink-2)}
.kpi .d{font-size:11px;color:var(--ink-2);margin-top:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kpi.accent{border-top:2px solid var(--seal)}
section.top-sec{margin-top:34px}
.sec-h{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--rule-2);padding-bottom:8px;margin-bottom:16px}
.sec-h .no{font:500 12px/1 var(--mono);color:var(--seal)}
.sec-h h2{font:400 20px/1.2 var(--serif);letter-spacing:.05em}
.sec-h .note{margin-left:auto;font-size:12px;color:var(--ink-3)}
table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--rule);font-size:13px}
th,td{padding:8px 12px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top}
th{font:500 11px/1 var(--sans);letter-spacing:.1em;color:var(--ink-3);background:var(--side)}
tr:last-child td{border-bottom:0}
td.mono,.mono{font-family:var(--mono);font-size:12px}
td.gl{color:var(--ink-2);white-space:nowrap}
.chip.cov{border-color:var(--rule-2);color:var(--ink-2);background:var(--side)}
table.cov td{padding:6px 12px}
.cvi{display:inline-block;font-family:var(--mono);font-size:11px;padding:3px 7px;margin:2px 4px 2px 0;border-radius:2px;border:1px solid var(--rule-2)}
.cvi.ok{color:var(--ink);background:var(--seal-soft);border-color:var(--seal-2)}
.cvi.gap{color:var(--ink-3);background:repeating-linear-gradient(45deg,transparent,transparent 3px,var(--rule) 3px,var(--rule) 4px)}
td.cnum{font-family:var(--mono);font-size:12px;white-space:nowrap;color:var(--ok)}
td.cnum.bad{color:var(--seal)}
td a{color:var(--seal);text-decoration:none}
.mx{min-width:120px}
.mx.empty{background:repeating-linear-gradient(45deg,transparent,transparent 5px,var(--side) 5px,var(--side) 6px)}
.cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;align-items:start}
@media(max-width:1100px){.cards{grid-template-columns:minmax(0,1fr)}}
.card{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.card-h{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}
.cid{font:500 12px/1 var(--mono);color:var(--seal)}
.cname{font:400 17px/1.2 var(--serif);letter-spacing:.04em}
.one{margin:0;font:400 13px/1.7 var(--serif);color:var(--ink-2)}
.chip{font:400 10.5px/1.7 var(--mono);border:1px solid var(--rule-2);border-radius:2px;padding:0 6px;
  background:var(--paper);color:var(--ink-2);text-decoration:none}
.chip.cat{border-color:var(--seal);color:var(--seal)}
.chip.soft{color:var(--ink-3)}
a.chip:hover{border-color:var(--seal);color:var(--seal)}
.chip.phrase{cursor:pointer;border-color:var(--seal-2);color:var(--seal-2);font-family:var(--mono)}
.chip.phrase:hover{border-color:var(--seal);color:var(--seal)}
.frames{display:grid;grid-template-columns:1fr;gap:6px}
.frames:has(img+img){grid-template-columns:1fr 1fr}
.frame{width:100%;aspect-ratio:16/9;object-fit:cover;border:1px solid var(--rule-2);border-radius:2px;
  cursor:zoom-in;display:block;background:var(--side)}
.frame.ph{display:flex;flex-direction:column;gap:6px;padding:12px;cursor:default;aspect-ratio:auto;min-height:64px}
.frame.ph b{font:500 10px/1 var(--sans);letter-spacing:.14em;color:var(--ink-3)}
.frame.ph span{font:400 10.5px/1.6 var(--mono);color:var(--ink-2)}
.meta{display:flex;flex-wrap:wrap;gap:5px;align-items:baseline}
.ml{font:500 10px/1.7 var(--sans);letter-spacing:.12em;color:var(--ink-3);margin-right:2px}
.warn{margin:0;font-size:11px;color:var(--seal)}
details{border-top:1px solid var(--rule);padding-top:8px}
summary{cursor:pointer;font:500 11.5px/1 var(--sans);color:var(--ink-2);letter-spacing:.06em}
summary:hover{color:var(--seal)}
details h4{font:500 12px/1.8 var(--sans);letter-spacing:.08em;color:var(--seal);margin-top:8px}
.sect{font-size:12px;line-height:1.75;color:var(--ink-2);white-space:pre-wrap;word-break:break-word}
.gate{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 28px}
@media(max-width:900px){.gate{grid-template-columns:1fr}}
.gate li{display:flex;gap:8px;padding:5px 0;font-size:12.5px;line-height:1.55}
.gate .m{flex:none;font-weight:700}
.gate li.ok .m{color:var(--ok)}
.gate li.bad .m{color:var(--seal)}
.gate li.bad{background:var(--seal-soft);border-radius:2px;padding-left:6px}
.gsum{margin:10px 0 0;font-size:12px;color:var(--ink-2)}
.copy{font:500 11px/1 var(--sans);background:var(--paper);cursor:pointer;transition:.15s}
.copy[data-done]{border-color:var(--seal);color:var(--seal)}
.lightbox{position:fixed;inset:0;background:rgba(20,22,24,.88);display:none;align-items:center;
  justify-content:center;z-index:9;cursor:zoom-out;padding:32px}
.lightbox.on{display:flex}
.lightbox img{max-width:96%;max-height:96%;border:1px solid #555;border-radius:2px}
.foot{margin-top:40px;font-size:11px;color:var(--ink-3);border-top:1px solid var(--rule);padding-top:14px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media print{
  .expo,.copy{display:none!important}
  details{display:block}
  .cards{grid-template-columns:minmax(0,1fr)}
  .page{max-width:none;padding:0}
  .card{page-break-inside:avoid}
  body{background:#fff}
}
</style></head><body>
<div class="page">

<header class="hd">
  <h1>${esc(t.docTitle)}</h1>
  <span class="sub">${esc(t.subtitle)}</span>
  <span class="right">
    <span class="gatepill ${failed ? 'fail' : 'pass'}">${failed ? '✗' : '✓'} ${esc(t.gatePill(lintChecks - failed, lintChecks))}</span>
    <button class="expo" data-name="shot-recipes.json">${esc(t.exportJson)}</button>
  </span>
</header>

<div class="kpis">
  <div class="kpi accent"><div class="l">${esc(t.kpi.cards)}</div><div class="v">${st.cards}</div><div class="d">${esc(t.kpi.cardsSub(st.recipes, st.techs))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.cats)}</div><div class="v">${st.categories}</div><div class="d">${esc(t.kpi.catsSub)}</div></div>
  <div class="kpi${st.coverGap ? '' : ' accent'}"><div class="l">${esc(t.kpi.cover)}</div><div class="v">${st.coverDone} <small>/ ${st.coverTotal}</small></div><div class="d">${esc(t.kpi.coverSub(st.coverGap))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.phrases)}</div><div class="v">${st.phrases.length}</div><div class="d">${esc(t.kpi.phrasesSub)}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.frames)}</div><div class="v">${st.withFrames}</div><div class="d">${esc(t.kpi.framesSub(st.withoutFrames))}</div></div>
</div>

<section class="top-sec" id="sec-matrix">
  <div class="sec-h"><span class="no">${no()}</span><h2>${esc(t.secMatrix)}</h2><span class="note">${esc(t.matrixNote)}</span></div>
  <table><thead><tr><th></th>${[1, 2, 3, 4, 5].map((e) => `<th>${esc(t.energyLabel)} ${e}</th>`).join('')}</tr></thead>
  <tbody>
${matrixRows}
  </tbody></table>
</section>

<section class="top-sec" id="sec-cards">
  <div class="sec-h"><span class="no">${no()}</span><h2>${esc(t.secCards)}</h2><span class="note">${esc(t.cardsNote)}</span></div>
  <div class="cards">
${cardBlocks}
  </div>
</section>

<section class="top-sec" id="sec-cover">
  <div class="sec-h"><span class="no">${no()}</span><h2>${esc(t.secCover)}</h2><span class="note">${esc(t.coverNote)}</span></div>
  <table class="cov"><thead><tr>${t.coverCols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
${covRows}
  </tbody></table>
</section>

<section class="top-sec" id="sec-tech">
  <div class="sec-h"><span class="no">${no()}</span><h2>${esc(t.secTech)}</h2><span class="note">${esc(t.techNote)}</span></div>
  <div class="cards">
${techBlocks}
  </div>
</section>

<section class="top-sec" id="sec-phrases">
  <div class="sec-h"><span class="no">${no()}</span><h2>${esc(t.secPhrases)}</h2><span class="note">${esc(t.phrasesNote)}</span></div>
  <table><thead><tr>${t.phraseCols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
${phraseRows}
  </tbody></table>
</section>

${coverageSection()}

<section class="top-sec" id="sec-lint">
  <div class="sec-h"><span class="no">${no()}</span><h2>${esc(t.secLint)}</h2></div>
  ${lintList}
  <p class="gsum">${failed ? esc(t.lintFail(failed)) : esc(t.lintPass)}</p>
</section>

<p class="foot">${esc(t.colophon)}</p>
</div>

<div class="lightbox" id="lightbox"><img alt=""></div>

<script type="application/json" id="cards-data">${JSON.stringify(cards.map(({ body, ...rest }) => ({ ...rest, sections: splitSections(body) }))).replace(/</g, '\\u003c')}</script>
<script>
const L = ${JSON.stringify({ copied: I18N.zh.copied, failed: I18N.zh.copyFailed })};

// 点图放大
const lb = document.getElementById('lightbox');
document.addEventListener('click', (e) => {
  const img = e.target.closest('img.frame');
  if (img) { lb.querySelector('img').src = img.src; lb.classList.add('on'); return; }
  if (e.target.closest('#lightbox')) lb.classList.remove('on');
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') lb.classList.remove('on'); });

// 短语 chip 点击即复制
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('.copy');
  if (!btn || btn.classList.contains('expo')) return;
  e.preventDefault();
  const label = btn.textContent;
  try { await navigator.clipboard.writeText(btn.dataset.copy); btn.textContent = L.copied; btn.dataset.done = '1'; }
  catch { btn.textContent = L.failed; }
  setTimeout(() => { btn.textContent = label; delete btn.dataset.done; }, 1600);
});

// 导出：报告自己带着整份卡库快照
document.querySelector('.expo').addEventListener('click', (e) => {
  const url = URL.createObjectURL(new Blob([document.getElementById('cards-data').textContent], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: e.currentTarget.dataset.name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CARDS = resolve(HERE, '../references/cards');

const USAGE = `shot-recipes.mjs — 镜头配方卡库的确定性工具

  list [--category c] [--for drama|product|talking-head|vlog]
       [--lang zh|en] [--json]        卡片索引表
  show <id> [--lang zh|en] [--json]   打印整张卡
  search <关键词> [--in name|body|all] 搜卡片，零命中 exit 1
  lint [--cards <目录>]                卡库自检，有问题逐条打印并 exit 1
  check <storyboard.json>             检查外部分镜 JSON 的配方引用
        [--cards <目录>]
  render [--html|--md] [--lang zh|en] 画廊报告到 stdout（默认 --md）
         [--check <sb.json>]

卡片默认从 ${DEFAULT_CARDS} 读。`;

function flag(rest, name, fallback = null) {
  const i = rest.indexOf(name);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : fallback;
}

const LINT_CHECK_COUNT = 20; // lint 覆盖的规则条数，报告徽章用

function main(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === '-h' || cmd === '--help') {
    console.log(USAGE);
    process.exit(cmd ? 0 : 1);
  }

  const cardsDir = resolve(flag(rest, '--cards', DEFAULT_CARDS));
  const lang = flag(rest, '--lang', 'zh');
  const cards = loadCards(cardsDir, { lang });
  const imageExists = (rel) => existsSync(join(cardsDir, rel));

  if (cmd === 'list') {
    const cat = flag(rest, '--category');
    const forWhat = flag(rest, '--for');
    const kindFlag = flag(rest, '--kind');
    if (kindFlag && !KINDS.includes(kindFlag)) throw new Error(`--kind 只能是 ${KINDS.join(' 或 ')}`);
    let out = cards;
    if (kindFlag) out = out.filter((c) => (c.kind ?? 'recipe') === kindFlag);
    if (cat) out = out.filter((c) => c.category === cat);
    if (forWhat) out = out.filter((c) => (c.applies_to ?? []).includes(forWhat));
    if (rest.includes('--json')) {
      console.log(JSON.stringify(out.map(({ body, ...r }) => r), null, 2));
      return;
    }
    const t = tOf(lang);
    // 中日韩字符占两列，英文占一列——按显示宽度对齐并截断，超宽名字不撑破表
    const width = (s) => [...String(s ?? '')].reduce((n, ch) => n + (/[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe6f\uff00-\uff60]/.test(ch) ? 2 : 1), 0);
    const pad = (s, n) => {
      let out = '';
      for (const ch of String(s ?? '')) {
        if (width(out + ch) > n - 1) { out += '…'; break; }
        out += ch;
      }
      return out + ' '.repeat(Math.max(1, n - width(out)));
    };
    const W = [24, 6, 24, 14, 8, 8, 7, 6, 7];
    const kindMark = (c) => (isTech(c) ? (t.langCode === 'en' ? 'tech' : '技法') : (t.langCode === 'en' ? 'rec' : '配方'));
    console.log(t.listCols.map((c, i) => pad(c, W[i])).join(''));
    for (const c of out) {
      console.log([
        c.id, kindMark(c), nameOf(c, t), catOf(c, t), c.energy,
        `${c.seconds?.[0]}–${c.seconds?.[1]}s`, `${c.cuts?.[0]}–${c.cuts?.[1]}`,
        (c.must_phrases ?? []).length, (c.example_frames ?? []).length ? '✓' : '—',
      ].map((v, i) => pad(v, W[i])).join(''));
    }
    console.log(`\n${t.listSum(out.length, new Set(out.map((c) => c.category)).size, out.filter((c) => (c.example_frames ?? []).length).length)}`);
    return;
  }

  if (cmd === 'show') {
    const id = rest[0];
    if (!id || id.startsWith('--')) throw new Error('用法：show <id> [--lang zh|en]');
    const card = cards.find((c) => c.id === id);
    if (!card) throw new Error(`没有这张卡：${id}（试试 list 或 search）`);
    if (rest.includes('--json')) {
      const { body, ...r } = card;
      console.log(JSON.stringify({ ...r, sections: splitSections(body) }, null, 2));
      return;
    }
    // frontmatter 只有一份（语言中立），正文按 --lang 取——不能整份文件原样打，
    // 那样 --lang en 会打出中文正文，末尾却写着「英文正文来自 …」，是句谎话（踩过）
    const raw = readFileSync(join(cardsDir, card.file), 'utf8');
    const fm = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(raw);
    console.log(`${fm ? fm[0] : ''}${card.body}`.trimEnd());
    if (card.bodyLang === 'en') console.log(`\n---\n（英文正文来自 en/${card.file}）`);
    else if (card.enMissing) console.log(`\n---\n（缺 en/${card.file}，正文回落中文）`);
    const withGloss = (card.must_phrases ?? [])
      .map((p, i) => {
        const g = (card.must_phrases_zh ?? [])[i];
        return g ? `${p}（${g}）` : p;
      })
      .join(' / ');
    console.log(`\n必备短语：${withGloss}——必须写进这张配方每一格的分镜图提示词`);
    return;
  }

  if (cmd === 'search') {
    const kw = rest.find((x) => !x.startsWith('--'));
    if (!kw) throw new Error('用法：search <关键词> [--in name|body|all]');
    const where = flag(rest, '--in', 'all');
    const k = kw.toLowerCase();
    const hits = cards.filter((c) => {
      const nameHay = [c.id, c.name, c.name_en, c.one_line, c.one_line_en, ...(c.tags ?? [])].join(' ').toLowerCase();
      const bodyHay = String(c.body).toLowerCase();
      if (where === 'name') return nameHay.includes(k);
      if (where === 'body') return bodyHay.includes(k);
      return nameHay.includes(k) || bodyHay.includes(k);
    });
    for (const c of hits) {
      console.log(`${c.id} · ${c.name} — ${c.one_line}`);
      const idx = String(c.body).toLowerCase().indexOf(k);
      if (idx >= 0) console.log(`    …${String(c.body).slice(Math.max(0, idx - 30), idx + 50).replace(/\n/g, ' ')}…`);
    }
    console.log(`\n${hits.length} 张卡命中「${kw}」`);
    if (!hits.length) process.exit(1);
    return;
  }

  if (cmd === 'lint') {
    const problems = lintCards(cards, { cardsDir, imageExists });
    if (problems.length) {
      console.error(`✗ ${problems.length} 处问题：\n`);
      for (const x of problems) console.error('  ' + x);
      process.exit(1);
    }
    console.log(`✓ ${cards.length} 张卡 · ${LINT_CHECK_COUNT} 类检查全部通过`);
    return;
  }

  if (cmd === 'check') {
    const path = rest.find((x) => !x.startsWith('--'));
    if (!path) throw new Error('用法：check <storyboard.json> [--cards <目录>]');
    const json = JSON.parse(readFileSync(resolve(path), 'utf8'));
    const refs = collectRecipeRefs(json);
    const res = checkRecipes(refs, cards);
    for (const x of res.problems) console.error('  ✗ ' + x);
    console.log(`${res.total} 处配方引用 · ${res.problems.length} 处违规 · ${res.skipped} 个非英文提示词已跳过`);
    if (res.unused.length) console.log(`从没被使用的卡：${res.unused.join(' / ')}`);
    if (res.problems.length) process.exit(1);
    return;
  }

  if (cmd === 'render') {
    const checkPath = flag(rest, '--check');
    let check = null;
    if (checkPath) {
      const json = JSON.parse(readFileSync(resolve(checkPath), 'utf8'));
      check = checkRecipes(collectRecipeRefs(json), cards);
    }
    const problems = lintCards(cards, { cardsDir, imageExists });
    const html = rest.includes('--html');
    process.stdout.write(
      (html
        ? renderHtml(cards, { lang, lintProblems: problems, lintChecks: LINT_CHECK_COUNT, check, imageExists })
        : renderMarkdown(cards, { lang })) + '\n',
    );
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
