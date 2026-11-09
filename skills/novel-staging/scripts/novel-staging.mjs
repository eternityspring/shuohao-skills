#!/usr/bin/env node
// novel-staging — deterministic helpers for the novel-staging skill（开场站位）.
// Zero dependencies on purpose: the skill must work in any directory
// without an npm install. Node 18+ (stdlib only).

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
/* core — 站位的几何与说法                                              */
/* ------------------------------------------------------------------ */
/*
 * 报告页面上拖人、命令行写走位句、质量门，三处用的是同一份算法：这个函数整个
 * 被 toString() 嵌进报告页面，改一处两边一起变。所以函数体里不许引用外面的任何东西。
 *
 * 平面坐标：把房间摆平从正上方看，北在上、西在左，0–1，从西北角量起。
 * 主视角（场景图的标准取景）的机位在南侧向北看：图的左边是西、右边是东、越往上越靠北。
 */
export function stagingCore() {
  const SIDES = ['north', 'east', 'south', 'west', 'on'];
  const POSTURES = ['sit', 'stand'];
  const FACINGS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  /** 人站在一件东西边上时，离它的边多远。 */
  const PLAN_GAP = 0.04;
  /** 同一件东西同一侧的两个人，along 至少差这么多才不算叠在一处。 */
  const MIN_APART = 0.12;
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  const ZH_SIDE = { north: '北侧', east: '东侧', south: '南侧', west: '西侧' };
  const ZH_FACING = {
    north: '北', northeast: '东北', east: '东', southeast: '东南', south: '南', southwest: '西南', west: '西', northwest: '西北',
  };
  /** 东西两侧沿南北排，南北两侧沿东西排。 */
  const runsNorthSouth = (side) => side === 'east' || side === 'west';

  /** 从正上方看是圆的（圆桌、圆地毯）：画成圆，人围着它一圈。没写 round 就看名字。 */
  const isRound = (i) => (typeof i.round === 'boolean' ? i.round : /圆|round|circular|oval/i.test(`${i.name} ${i.alt ?? ''}`));

  function alongWord(side, along, lang) {
    if (side === 'on') return '';
    const third = along < 1 / 3 ? 0 : along > 2 / 3 ? 2 : 1;
    if (runsNorthSouth(side)) {
      return lang === 'zh' ? ['靠北', '中段', '靠南'][third] : ['toward the north end', 'in the middle', 'toward the south end'][third];
    }
    return lang === 'zh' ? ['靠西', '', '靠东'][third] : ['toward the west end', '', 'toward the east end'][third];
  }

  /**
   * 一个人的位置写成一句走位：「胡二爷坐在左舷长坐板上，面朝东」。`after` 是同一件东西
   * 同一侧排在他前面的那个人（「…东侧中段、胡二爷南侧」），落在同一段里也说得清先后。
   */
  function placeSentence(p, lang, after, itemName) {
    const thing = itemName ?? p.item;
    if (!p.present || !p.item || !thing) return null;
    const step = runsNorthSouth(p.side) ? 'south' : 'east';
    if (lang === 'zh') {
      const verb = p.posture === 'sit' ? '坐在' : '站在';
      const where = p.side === 'on'
        ? `${thing}上`
        : `${thing}${ZH_SIDE[p.side]}${alongWord(p.side, p.along, 'zh')}${after ? `、${after.name}${step === 'south' ? '南' : '东'}侧` : ''}`;
      return `${p.name}${verb}${where}，面朝${ZH_FACING[p.facing] ?? p.facing}`;
    }
    const verb = p.posture === 'sit' ? 'sits' : 'stands';
    const where = p.side === 'on'
      ? `on the ${thing}`
      : [`on the ${p.side} side of the ${thing}`, alongWord(p.side, p.along, 'en'), after ? `just ${step} of ${after.name}` : '']
          .filter(Boolean).join(', ');
    return `${p.name} ${verb} ${where}, facing ${p.facing}`;
  }

  /** 同一件东西同一侧，每个人前面紧挨着的是谁（按 along 排）。 */
  function neighbours(places) {
    const groups = new Map();
    for (const p of places) {
      if (!p.present || !p.item || p.side === 'on') continue;
      const key = `${p.item}:${p.side}`;
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }
    const before = new Map();
    for (const list of groups.values()) {
      const sorted = [...list].sort((a, b) => a.along - b.along);
      sorted.forEach((p, i) => { if (i > 0) before.set(p.id, sorted[i - 1]); });
    }
    return before;
  }

  function extrasSentence(s, lang) {
    const where = (s.extrasWhere ?? '').trim();
    if (!(s.extras > 0)) return lang === 'zh' ? '其余座位空着，没有其他人' : 'every other seat is empty and nobody else is there';
    return lang === 'zh'
      ? `另有 ${s.extras} 名群演${where ? `在${where}` : ''}，只作背景`
      : `${s.extras} extra${s.extras === 1 ? '' : 's'}${where ? ` ${where}` : ''}, background only`;
  }

  /**
   * 这一场的开场走位：在场的每个人一句，按站位表的顺序，最后一句交代还有没有别人。
   * 分镜这一场第一段的开场走位就照抄它。`nameIn` 把东西的名字换成另一种语言。
   */
  function stagingBlocking(scene, lang, nameIn) {
    const places = (scene.places ?? []).filter((p) => p.present && p.item);
    const before = neighbours(places);
    const clauses = places
      .map((p) => placeSentence(p, lang, before.get(p.id), nameIn ? nameIn(p.item) : p.item))
      .filter(Boolean);
    if (!clauses.length) return null;
    clauses.push(extrasSentence(scene, lang));
    return lang === 'zh' ? `${clauses.join('；')}。` : `${clauses.join('; ')}.`;
  }

  /** 面朝他所在的那件东西：在它东侧就面朝西。在它上面就面朝房间——背对它靠着的那面墙，不靠墙就朝南（机位）。 */
  function defaultFacing(side, item) {
    if (side === 'east') return 'west';
    if (side === 'west') return 'east';
    if (side === 'north') return 'south';
    if (side === 'south') return 'north';
    if (!item) return 'south';
    const cx = (item.plan[0] + item.plan[2]) / 2;
    if (cx < 0.25) return 'east';
    if (cx > 0.75) return 'west';
    return 'south';
  }

  /*
   * 圆的东西一侧是四分之一圈，along 沿这段弧走，跟沿直边走一样：南侧是下面那段，从西南（0）
   * 到东南（1）；东侧是右边那段，从东北（0）到东南（1）。角度在平面上量，y 朝下：0 是东、90 是南。
   */
  const ARC_START = { south: 135, west: 225, north: 225, east: -45 };
  const ARC_TURN = { south: -90, west: -90, north: 90, east: 90 };

  function arcPlace(deg) {
    const a = ((deg % 360) + 360) % 360;
    if (a > 45 && a <= 135) return { side: 'south', along: (135 - a) / 90 };
    if (a > 135 && a <= 225) return { side: 'west', along: (225 - a) / 90 };
    if (a > 225 && a <= 315) return { side: 'north', along: (a - 225) / 90 };
    return { side: 'east', along: ((a > 315 ? a - 360 : a) + 45) / 90 };
  }

  /** 一个位置画在平面上的哪一点。 */
  function placePoint(item, side, along, spread = 0) {
    const [x0, y0, x1, y1] = item.plan;
    const t = clamp01(along ?? 0.5);
    if (side !== 'on' && isRound(item)) {
      const deg = ((ARC_START[side] + ARC_TURN[side] * t) * Math.PI) / 180;
      return {
        x: clamp01((x0 + x1) / 2 + ((x1 - x0) / 2 + PLAN_GAP) * Math.cos(deg)),
        y: clamp01((y0 + y1) / 2 + ((y1 - y0) / 2 + PLAN_GAP) * Math.sin(deg)),
      };
    }
    let p;
    if (side === 'north') p = { x: x0 + (x1 - x0) * t, y: y0 - PLAN_GAP };
    else if (side === 'south') p = { x: x0 + (x1 - x0) * t, y: y1 + PLAN_GAP };
    else if (side === 'west') p = { x: x0 - PLAN_GAP, y: y0 + (y1 - y0) * t };
    else if (side === 'east') p = { x: x1 + PLAN_GAP, y: y0 + (y1 - y0) * t };
    // 在它上面：放在中间，几个人就并排
    else p = { x: (x0 + x1) / 2 + (x1 - x0) * 0.2 * spread, y: (y0 + y1) / 2 };
    return { x: clamp01(p.x), y: clamp01(p.y) };
  }

  /**
   * 每个在场的人画在平面上的哪一点，按句子里说的（东西、哪一侧、沿着多远）算——画出来的跟写出来的
   * 永远是一回事。几个人在同一件东西上就并排。东西不在 items 里的人没有点。
   */
  function placePoints(places, items) {
    const byName = new Map(items.map((i) => [i.name, i]));
    const onSoFar = new Map();
    const out = new Map();
    for (const p of places) {
      const it = p.present && p.item ? byName.get(p.item) : undefined;
      if (!it) continue;
      let spread = 0;
      if (p.side === 'on') {
        const k = onSoFar.get(it.name) ?? 0;
        onSoFar.set(it.name, k + 1);
        spread = k === 0 ? 0 : k % 2 ? (k + 1) / 2 : -k / 2;
      }
      out.set(p.id, placePoint(it, p.side, p.along, spread));
    }
    return out;
  }

  /**
   * 拖到平面上某一点松手，人落在哪：落在能坐能站的东西里面（最小的那件）就在它上面；否则落在
   * 最近那件东西最近的一侧、沿这一侧多远——松在桌面上就是桌子最近的那条边。
   */
  function nearestPlace(pt, items) {
    const inside = (b) => pt.x >= b[0] && pt.x <= b[2] && pt.y >= b[1] && pt.y <= b[3];
    const area = (b) => (b[2] - b[0]) * (b[3] - b[1]);
    const seat = items.filter((i) => i.on && inside(i.plan)).sort((a, b) => area(a.plan) - area(b.plan))[0];
    if (seat) return { item: seat.name, side: 'on', along: 0.5 };
    let best = null;
    for (const i of items) {
      const [x0, y0, x1, y1] = i.plan;
      if (isRound(i)) {
        const rx = (x1 - x0) / 2 || 0.001;
        const ry = (y1 - y0) / 2 || 0.001;
        const dx = pt.x - (x0 + x1) / 2;
        const dy = pt.y - (y0 + y1) / 2;
        const deg = Math.atan2(dy / ry, dx / rx);
        const d = Math.hypot(dx - rx * Math.cos(deg), dy - ry * Math.sin(deg));
        const bias = (dx / rx) ** 2 + (dy / ry) ** 2 <= 1 ? -1 + area(i.plan) * 0.01 : 0;
        if (!best || d + bias < best.d) best = { item: i.name, ...arcPlace((deg * 180) / Math.PI), d: d + bias };
        continue;
      }
      const cx = Math.min(x1, Math.max(x0, pt.x));
      const cy = Math.min(y1, Math.max(y0, pt.y));
      const sides = [
        ['north', Math.hypot(pt.x - cx, pt.y - y0), clamp01((pt.x - x0) / (x1 - x0 || 1))],
        ['south', Math.hypot(pt.x - cx, pt.y - y1), clamp01((pt.x - x0) / (x1 - x0 || 1))],
        ['west', Math.hypot(pt.x - x0, pt.y - cy), clamp01((pt.y - y0) / (y1 - y0 || 1))],
        ['east', Math.hypot(pt.x - x1, pt.y - cy), clamp01((pt.y - y0) / (y1 - y0 || 1))],
      ];
      // 点在某件东西里面就算它最近，不管哪条边；两件都罩着它时取小的那件
      const bias = inside(i.plan) ? -1 + area(i.plan) * 0.01 : 0;
      for (const [side, d, along] of sides) {
        if (!best || d + bias < best.d) best = { item: i.name, side, along, d: d + bias };
      }
    }
    return best ? { item: best.item, side: best.side, along: best.along } : null;
  }

  /**
   * 拖动后这个人怎么变：换了东西或换了一侧就转过去面朝它；落在能坐的东西上就坐下；
   * 原来不在场、刚拖进来的人站着。
   */
  function moveTo(place, target, items) {
    const it = items.find((i) => i.name === target.item);
    const turned = !place.present || target.side !== place.side || target.item !== place.item;
    return {
      ...place,
      present: true,
      item: target.item,
      side: target.side,
      along: target.side === 'on' ? 0.5 : Math.round(target.along * 100) / 100,
      posture: target.side === 'on' && it?.on ? 'sit' : !place.present ? 'stand' : place.posture ?? 'stand',
      facing: turned ? defaultFacing(target.side, it) : place.facing,
    };
  }

  /**
   * 一场的站位哪里不对：质量门按 gate 汇总，报告页面上改一下就重算一遍。
   * `location` 是这一场所在地点的认图结果。
   */
  function sceneProblems(scene, location, lang = 'zh') {
    const zh = lang === 'zh';
    const out = [];
    const add = (gate, text) => out.push({ gate, text });
    const items = location?.items ?? [];
    const things = new Map(items.map((i) => [i.name, i]));
    const cast = scene.cast ?? [];
    const places = scene.places ?? [];
    const ids = places.map((p) => p.id);
    const castIds = cast.map((c) => c.id);
    const missing = cast.filter((c) => !ids.includes(c.id)).map((c) => c.name);
    if (missing.length) add('cast-complete', zh ? `站位表里少了：${missing.join('、')}` : `missing from the places: ${missing.join(', ')}`);
    const extra = places.filter((p) => !castIds.includes(p.id)).map((p) => p.name ?? p.id);
    if (extra.length) add('cast-complete', zh ? `出场人物表以外的人：${extra.join('、')}` : `not in the scene's cast: ${extra.join(', ')}`);
    const twice = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (twice.length) add('cast-complete', zh ? `同一个人写了两次：${[...new Set(twice)].join('、')}` : `listed twice: ${[...new Set(twice)].join(', ')}`);

    const undecided = places.filter((p) => typeof p.present !== 'boolean').map((p) => p.name);
    if (undecided.length) add('present-set', zh ? `还没定开场在不在：${undecided.join('、')}` : `not yet said whether they are there at the opening: ${undecided.join(', ')}`);
    else if (places.length && !places.some((p) => p.present)) add('present-set', zh ? '开场一个人都不在' : 'nobody is there when the scene opens');

    for (const p of places) {
      if (p.present === false) {
        if (p.item != null || p.side != null || p.along != null) {
          add('place-valid', zh ? `${p.name} 开场不在，item、side、along 要空着` : `${p.name} is not there at the opening: leave item, side and along empty`);
        }
        continue;
      }
      if (p.present !== true) continue;
      const it = things.get(p.item);
      if (!it) add('place-valid', zh ? `${p.name} 站的「${p.item ?? ''}」不在这个地点认出来的东西里` : `${p.name}'s "${p.item ?? ''}" is not one of the things read off this place`);
      if (!SIDES.includes(p.side)) add('place-valid', zh ? `${p.name} 的 side 要是 north / east / south / west / on` : `${p.name}'s side must be north / east / south / west / on`);
      else if (p.side === 'on' && it && !it.on) add('place-valid', zh ? `${p.name} 写了在「${p.item}」上，可它上面不能坐也不能站，写它的哪一侧` : `${p.name} is on the "${p.item}", which nobody can sit or stand on: say which side`);
      if (p.side !== 'on' && !(typeof p.along === 'number' && p.along >= 0 && p.along <= 1)) {
        add('place-valid', zh ? `${p.name} 的 along 要是 0 到 1 之间的数` : `${p.name}'s along must be a number from 0 to 1`);
      }
      if (!POSTURES.includes(p.posture)) add('place-valid', zh ? `${p.name} 的 posture 要是 sit 或 stand` : `${p.name}'s posture must be sit or stand`);
      if (!FACINGS.includes(p.facing)) add('place-valid', zh ? `${p.name} 的 facing 要是八个方位之一` : `${p.name}'s facing must be one of the eight directions`);
    }

    const sideGroups = new Map();
    for (const p of places) {
      if (p.present !== true || !things.has(p.item) || p.side === 'on' || typeof p.along !== 'number') continue;
      const key = `${p.item}:${p.side}`;
      sideGroups.set(key, [...(sideGroups.get(key) ?? []), p]);
    }
    for (const list of sideGroups.values()) {
      const sorted = [...list].sort((a, b) => a.along - b.along);
      for (let i = 1; i < sorted.length; i++) {
        const a = sorted[i - 1];
        const b = sorted[i];
        if (b.along - a.along < MIN_APART) {
          add('no-overlap', zh
            ? `${a.name} 和 ${b.name} 叠在「${b.item}」${ZH_SIDE[b.side]}同一处，沿这一侧拉开`
            : `${a.name} and ${b.name} stand on one spot on the ${b.side} side of the "${b.item}": spread them along it`);
        }
      }
    }

    if (!(Number.isInteger(scene.extras) && scene.extras >= 0)) add('extras', zh ? '群演人数要是 0 或正整数（剧本没写有别人就是 0）' : 'extras must be 0 or a whole number (0 when the script names nobody else)');
    else if (scene.extras > 0 && !(scene.extrasWhere ?? '').trim()) add('extras', zh ? `有 ${scene.extras} 名群演，没写他们在哪` : `${scene.extras} extras, but not where they are`);
    else if (scene.extras === 0 && (scene.extrasWhere ?? '').trim()) add('extras', zh ? '没有群演，extrasWhere 要空着' : 'no extras: leave extrasWhere empty');
    return out;
  }

  return {
    SIDES, POSTURES, FACINGS, PLAN_GAP, MIN_APART, ZH_FACING,
    isRound, placeSentence, extrasSentence, stagingBlocking, defaultFacing,
    placePoint, placePoints, nearestPlace, moveTo, sceneProblems,
  };
}

const core = stagingCore();
export const {
  SIDES, POSTURES, FACINGS, PLAN_GAP, MIN_APART,
  isRound, placeSentence, extrasSentence, stagingBlocking, defaultFacing,
  placePoint, placePoints, nearestPlace, moveTo, sceneProblems,
} = core;

/** 认图结果里东西的件数范围：少了排不开人，多了是把杯子碗碟也写进来了。 */
export const ITEM_RANGE = [4, 20];

/* ------------------------------------------------------------------ */
/* seed — 从剧本确定性预填骨架                                          */
/* ------------------------------------------------------------------ */
/*
 * 有哪几场、每场在哪个地点、谁出场，剧本里都是现成的——这些不该让模型重新想一遍。
 * seed 把它们搬进骨架；模型只做两件事：认每个地点的图，给每一场排开场站位。
 */

/** `1-3`、`2`、`1,3,5` → 集号集合；不给就是全部。 */
export function parseEps(spec) {
  if (!spec) return null;
  const out = new Set();
  for (const part of String(spec).split(',')) {
    const [a, b] = part.split('-').map((x) => Number(x.trim()));
    if (!Number.isInteger(a)) throw new Error(`集号写法不对：${spec}`);
    for (let n = a; n <= (Number.isInteger(b) ? b : a); n++) out.add(n);
  }
  return out;
}

export function seedFromScript(script, { art = null, outline = null, eps = null } = {}) {
  const names = new Map((outline?.characters ?? []).map((c) => [c.id, c.name]));
  const artScenes = new Map((art?.scenes ?? []).map((s) => [s.id, s]));
  const scenes = [];
  const locationIds = [];
  for (const ep of script?.episodes ?? []) {
    if (eps && !eps.has(ep.ep)) continue;
    (ep.scenes ?? []).forEach((sc, i) => {
      if (sc.sceneId && !locationIds.includes(sc.sceneId)) locationIds.push(sc.sceneId);
      const cast = (sc.characters ?? []).map((id) => ({ id, name: names.get(id) ?? id }));
      scenes.push({
        ep: ep.ep,
        scene: i + 1,
        sceneId: sc.sceneId ?? null,
        ...(sc.lighting ? { lighting: sc.lighting } : {}),
        cast,
        // 模型要定的：开场在不在、在哪件东西的哪一侧、坐还是站、面朝哪
        places: cast.map((c) => ({ id: c.id, name: c.name, present: null, item: null, side: null, along: null, posture: null, facing: null })),
        extras: null,
        extrasWhere: null,
      });
    });
  }
  const locations = locationIds.map((id) => ({ sceneId: id, name: artScenes.get(id)?.name ?? id, readFrom: null, items: [] }));
  return { source: script?.source ?? '', lang: script?.lang ?? 'zh', locations, scenes };
}

/* ------------------------------------------------------------------ */
/* 质量门                                                              */
/* ------------------------------------------------------------------ */

const isBox = (b) => Array.isArray(b) && b.length === 4 && b.every((v) => typeof v === 'number' && v >= 0 && v <= 1) && b[2] > b[0] && b[3] > b[1];

export function sceneLabel(s, lang = 'zh') {
  return lang === 'zh' ? `第 ${s.ep} 集第 ${s.scene} 场` : `E${s.ep} scene ${s.scene}`;
}

/** 一个地点的认图结果哪里不对。 */
export function locationProblems(loc) {
  const out = [];
  const items = Array.isArray(loc.items) ? loc.items : [];
  if (!loc.readFrom || !items.length) {
    out.push({ gate: 'items-read', text: `「${loc.name}」还没认图` });
    return out;
  }
  if (!['picture', 'prompt'].includes(loc.readFrom)) out.push({ gate: 'items-read', text: `「${loc.name}」的 readFrom 要是 picture 或 prompt` });
  if (items.length < ITEM_RANGE[0] || items.length > ITEM_RANGE[1]) {
    out.push({ gate: 'items-read', text: `「${loc.name}」认出 ${items.length} 件，要 ${ITEM_RANGE[0]}–${ITEM_RANGE[1]} 件` });
  }
  const names = items.map((i) => String(i.name ?? '').trim());
  const twice = names.filter((n, i) => n && names.indexOf(n) !== i);
  if (twice.length) out.push({ gate: 'item-shape', text: `「${loc.name}」里名字重复：${[...new Set(twice)].join('、')}` });
  for (const i of items) {
    const n = String(i.name ?? '').trim();
    if (!n) out.push({ gate: 'item-shape', text: `「${loc.name}」里有一件东西没写名字` });
    if (!isBox(i.plan)) out.push({ gate: 'item-shape', text: `「${loc.name}·${n}」的 plan 要四个 0 到 1 的数，右大于左、下大于上` });
    // 按图认的才有框；没有图、按提示词推算的没有图上的位置
    if (loc.readFrom === 'picture' && !isBox(i.box)) out.push({ gate: 'item-shape', text: `「${loc.name}·${n}」的 box 要四个 0 到 1 的数，右大于左、下大于上` });
    if (typeof i.on !== 'boolean') out.push({ gate: 'item-shape', text: `「${loc.name}·${n}」的 on 要写 true 或 false` });
    if (i.round !== undefined && typeof i.round !== 'boolean') out.push({ gate: 'item-shape', text: `「${loc.name}·${n}」的 round 要写 true 或 false` });
  }
  return out;
}

const GATES = [
  { id: 'items-read', label: `每个地点都认了图，${ITEM_RANGE[0]}–${ITEM_RANGE[1]} 件东西` },
  { id: 'item-shape', label: '东西的名字不重复，平面位置和图上位置都是合法的框' },
  { id: 'location-ref', label: '每一场的地点都有认图结果' },
  { id: 'cast-complete', label: '每一场的出场人物正好各一条' },
  { id: 'present-set', label: '每个人都定了开场在不在，至少一个人在场' },
  { id: 'place-valid', label: '在场的人落在认出来的东西上，方位、坐站、朝向合法' },
  { id: 'no-overlap', label: '同一侧的人不叠在一处' },
  { id: 'extras', label: '群演人数是整数，有群演写明在哪' },
];

const GATE_LABELS_EN = {
  'items-read': `Every place read, ${ITEM_RANGE[0]}–${ITEM_RANGE[1]} things`,
  'item-shape': 'Thing names unique; plan and picture boxes well formed',
  'location-ref': 'Every scene’s place has been read',
  'cast-complete': 'Every scene lists each of its cast exactly once',
  'present-set': 'Everyone marked there or not at the opening; someone is there',
  'place-valid': 'People stand at things read off the place; side, posture and facing valid',
  'no-overlap': 'Nobody stands on one spot with another on the same side',
  'extras': 'Extras are a whole number, and where they are is said',
};

/** 全部违规，每条带场次或地点。`script` 给了就核对出场人物跟剧本一致，`art` 给了就核对地点编号。 */
export function stagingProblems(doc, { script = null, art = null } = {}) {
  const out = [];
  const locations = Array.isArray(doc?.locations) ? doc.locations : [];
  const scenes = Array.isArray(doc?.scenes) ? doc.scenes : [];
  const byId = new Map(locations.map((l) => [l.sceneId, l]));
  for (const loc of locations) out.push(...locationProblems(loc));
  if (art) {
    const known = new Set((art.scenes ?? []).map((s) => s.id));
    for (const loc of locations) if (!known.has(loc.sceneId)) out.push({ gate: 'location-ref', text: `地点 ${loc.sceneId} 不在 art.json 里` });
  }
  for (const s of scenes) {
    const label = sceneLabel(s);
    const loc = byId.get(s.sceneId);
    if (!loc) out.push({ gate: 'location-ref', text: `${label} 的地点 ${s.sceneId ?? '（空）'} 没有认图结果` });
    if (script) {
      const sc = (script.episodes ?? []).find((e) => e.ep === s.ep)?.scenes?.[s.scene - 1];
      const want = sc?.characters ?? null;
      const have = (s.cast ?? []).map((c) => c.id);
      if (!sc) out.push({ gate: 'cast-complete', text: `${label} 在 script.json 里找不到` });
      else if (want.length !== have.length || want.some((id) => !have.includes(id))) {
        out.push({ gate: 'cast-complete', text: `${label} 的出场人物跟剧本不一致：剧本 ${want.join('、')}，这里 ${have.join('、')}` });
      }
    }
    for (const p of sceneProblems(s, loc)) out.push({ gate: p.gate, text: `${label}：${p.text}` });
  }
  return out;
}

export function validateStaging(doc, opts = {}) {
  return stagingProblems(doc, opts).map((p) => p.text);
}

/** 每道门 ✓/✗；没给 script.json 时「出场人物跟剧本一致」那一半明说没查。 */
export function gateReport(doc, opts = {}) {
  const problems = stagingProblems(doc, opts);
  return GATES.map((g) => {
    const mine = problems.filter((p) => p.gate === g.id);
    const skipped = g.id === 'cast-complete' && !opts.script;
    return {
      id: g.id,
      label: g.label,
      ok: !mine.length,
      detail: mine.length ? mine.slice(0, 3).map((p) => p.text).join('；') + (mine.length > 3 ? ` 等 ${mine.length} 处` : '') : skipped ? '未提供 script.json：只查站位表自己，没跟剧本核对' : '',
    };
  });
}

/* ------------------------------------------------------------------ */
/* blocking — 每场的开场走位句                                          */
/* ------------------------------------------------------------------ */

/** 东西名字换成另一种语言（认图时写的 alt），没写 alt 就用原名。 */
export function nameInFor(doc, scene, lang) {
  if (lang === (doc.lang ?? 'zh')) return undefined;
  const loc = (doc.locations ?? []).find((l) => l.sceneId === scene.sceneId);
  const alt = new Map((loc?.items ?? []).map((i) => [i.name, i.alt || i.name]));
  return (name) => alt.get(name) ?? name;
}

export function blockingLines(doc, lang = null) {
  const code = lang ?? doc.lang ?? 'zh';
  return (doc.scenes ?? []).map((s) => ({ scene: s, label: sceneLabel(s, code), blocking: stagingBlocking(s, code, nameInFor(doc, s, code)) }));
}

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
const fmtBox = (b) => (isBox(b) ? b.map((v) => v.toFixed(2)).join(', ') : '');

function langOf(doc, lang) {
  const code = lang ?? doc?.lang ?? 'zh';
  if (!I18N[code]) throw new Error(`报告界面只内置 zh / en，没有 ${code}`);
  return code;
}

export function renderMarkdown(doc, lang = null) {
  const code = langOf(doc, lang);
  const t = I18N[code];
  const gates = gateReport(doc);
  const lines = [`# ${doc.source} · ${t.kicker}`, ''];
  lines.push(`## ${t.secLocations}`, '');
  for (const loc of doc.locations ?? []) {
    lines.push(`### ${loc.sceneId} ${loc.name}${loc.readFrom ? ` · ${loc.readFrom === 'picture' ? t.readFromPicture : t.readFromPrompt}` : ` · ${t.notRead}`}`, '');
    if ((loc.items ?? []).length) {
      lines.push(mdHead(t.itemCols));
      for (const i of loc.items) lines.push(mdRow([i.name, i.alt ?? '', i.on ? t.yes : '', isRound(i) ? t.yes : '', fmtBox(i.plan)]));
      lines.push('');
    }
  }
  lines.push(`## ${t.secScenes}`, '');
  for (const { scene: s, label, blocking } of blockingLines(doc, code)) {
    const loc = (doc.locations ?? []).find((l) => l.sceneId === s.sceneId);
    lines.push(`### ${label} · ${loc?.name ?? s.sceneId}${s.lighting ? ` · ${s.lighting}` : ''}`, '');
    lines.push(blocking ?? t.nobody, '');
    const absent = (s.places ?? []).filter((p) => p.present === false).map((p) => p.name);
    if (absent.length) lines.push(`${t.absentLine}${t.colon}${absent.join(t.listSep)}`, '');
    if (s.why) lines.push(`> ${s.why}`, '');
  }
  lines.push(`## ${t.secGates}`, '');
  for (const g of gates) lines.push(`- ${g.ok ? '✓' : '✗'} ${code === 'en' ? GATE_LABELS_EN[g.id] : g.label}${g.detail ? ` — ${g.detail}` : ''}`);
  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* render — html                                                       */
/* ------------------------------------------------------------------ */
/*
 * 跟其余几份报告同一套视觉语言：冷灰印张 + 铁锈红印记，1600 宽，零外部依赖，离线双击能开。
 * 跟它们不一样的是这份报告能改：每一场一张俯视平面，人可以拖，点一个人改坐站和朝向，
 * 改完「导出 JSON」就是改过的 staging.json。设计约定见 references/report-style.md。
 */

const I18N = {
  zh: {
    langCode: 'zh',
    docTitle: (s) => `${s} · 开场站位`,
    kicker: '开场站位',
    gatePill: (n, m) => `质量门 ${n}/${m}`,
    exportJson: '导出 JSON',
    restore: '还原到文件里的版本',
    restoreAgain: '再点一次还原',
    edited: '页面上改过，还没导出',
    saved: '和文件一致',
    kpi: { scenes: '场次', locations: '地点', present: '开场在场', extras: '群演' },
    kpiSub: { scenes: (n) => `${n} 场有人不在场`, locations: (n) => `${n} 个按图认的`, present: '人次', extras: '名，只作背景' },
    gatesFail: (n) => `${n} 道质量门没过`,
    gatesPass: '质量门全部通过',
    gatesAtRender: '这是 render 那一刻的结果；页面上改过以后，以导出后再跑 validate 为准。每场卡片右下角是改动后实时重算的检查。',
    secLocations: '地点与认出来的东西',
    secScenes: '各场开场站位',
    secGates: '质量门',
    readFromPicture: '按图认的',
    readFromPrompt: '没有图，按设定提示词推算',
    notRead: '还没认图',
    itemCols: ['东西', '另一种语言', '能坐能站', '圆的', '平面位置（西、北、东、南）'],
    yes: '✓',
    noImage: '没有图',
    noImageHint: (f) => `把场景图放到 ${f} 再 render，就能对着图核对`,
    planLabel: '俯视平面，上北下南、左西右东',
    north: '北', south: '南', west: '西', east: '东',
    tray: '开场不在场——拖到平面上就是在场',
    trayEmpty: '都在场',
    pickHint: '点一下平面上的人，调整坐站和朝向；拖动调整位置',
    sit: '坐着', stand: '站着',
    facing: '朝向',
    makeAbsent: '移出：开场不在',
    extras: '群演',
    extrasWhere: '群演在哪，如「长桌东侧南端」',
    sentence: '开场走位',
    copy: '复制', copied: '已复制', copyFailed: '复制失败',
    why: '为什么这么排',
    ok: '这一场没问题',
    nobody: '（开场没人在场）',
    absentLine: '开场不在',
    colon: '：', listSep: '、',
    people: (n) => `${n} 人`,
    colophon: 'novel-staging · 开场站位。平面上的位置由「东西 + 哪一侧 + 沿着多远」算出来，跟走位句永远是一回事。',
    facingNames: { north: '正北', northeast: '东北', east: '正东', southeast: '东南', south: '正南', southwest: '西南', west: '正西', northwest: '西北' },
  },
  en: {
    langCode: 'en',
    docTitle: (s) => `${s} · Opening staging`,
    kicker: 'Opening staging',
    gatePill: (n, m) => `Gates ${n}/${m}`,
    exportJson: 'Export JSON',
    restore: 'Back to the file’s version',
    restoreAgain: 'Click again to restore',
    edited: 'Changed on this page, not exported yet',
    saved: 'Same as the file',
    kpi: { scenes: 'Scenes', locations: 'Places', present: 'There at the opening', extras: 'Extras' },
    kpiSub: { scenes: (n) => `${n} with someone not there`, locations: (n) => `${n} read off a picture`, present: 'people', extras: 'background only' },
    gatesFail: (n) => `${n} gate${n === 1 ? '' : 's'} failed`,
    gatesPass: 'All gates passed',
    gatesAtRender: 'As of the render. After changes on this page, export and run validate again. Each scene card checks itself live.',
    secLocations: 'Places and the things read off them',
    secScenes: 'Opening staging, scene by scene',
    secGates: 'Quality gates',
    readFromPicture: 'Read off the picture',
    readFromPrompt: 'No picture: worked out from the art prompt',
    notRead: 'Not read yet',
    itemCols: ['Thing', 'Other language', 'Sit / stand on', 'Round', 'Plan (W, N, E, S)'],
    yes: 'yes',
    noImage: 'No picture',
    noImageHint: (f) => `Put the scene picture at ${f} and render again to check against it`,
    planLabel: 'Top view: north up, west left',
    north: 'N', south: 'S', west: 'W', east: 'E',
    tray: 'Not there at the opening — drag onto the plan to bring them in',
    trayEmpty: 'Everyone is there',
    pickHint: 'Click someone on the plan to set sitting or standing and facing; drag to move',
    sit: 'Sit', stand: 'Stand',
    facing: 'Facing',
    makeAbsent: 'Take out: not there at the opening',
    extras: 'Extras',
    extrasWhere: 'Where the extras are, e.g. "south end of the long table"',
    sentence: 'Opening blocking',
    copy: 'Copy', copied: 'Copied', copyFailed: 'Copy failed',
    why: 'Why this way',
    ok: 'Nothing wrong in this scene',
    nobody: '(nobody there at the opening)',
    absentLine: 'Not there at the opening',
    colon: ': ', listSep: ', ',
    people: (n) => `${n} people`,
    colophon: 'novel-staging · opening staging. Every point on a plan is worked out from thing + side + how far along, so the drawing and the blocking sentence always agree.',
    facingNames: { north: 'N', northeast: 'NE', east: 'E', southeast: 'SE', south: 'S', southwest: 'SW', west: 'W', northwest: 'NW' },
  },
};

function embed(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** `images` 是 sceneId → 报告里引用的图片路径（render 时按文件找到的才有）。 */
export function renderHtml(doc, lang = null, images = {}) {
  const code = langOf(doc, lang);
  const t = I18N[code];
  const gates = gateReport(doc);
  const failed = gates.filter((g) => !g.ok);
  const scenes = doc.scenes ?? [];
  const locations = doc.locations ?? [];
  const presentN = scenes.reduce((n, s) => n + (s.places ?? []).filter((p) => p.present === true).length, 0);
  const extrasN = scenes.reduce((n, s) => n + (Number.isInteger(s.extras) ? s.extras : 0), 0);
  const withAbsent = scenes.filter((s) => (s.places ?? []).some((p) => p.present === false)).length;
  const fromPicture = locations.filter((l) => l.readFrom === 'picture').length;
  const gateLabel = (g) => (code === 'en' ? GATE_LABELS_EN[g.id] : g.label);

  const picture = (loc, cls = '') => {
    const src = images[loc.sceneId];
    if (!src) {
      return `<div class="plate plate-empty ${cls}"><span>${esc(loc.name)} · ${esc(t.noImage)}<br><em>${esc(t.noImageHint(`images/${slug(loc.name)}-sheet.png`))}</em></span></div>`;
    }
    const boxes = (loc.items ?? []).filter((i) => isBox(i.box)).map((i) => {
      const [l, tp, r, b] = i.box;
      return `<i class="pbox" data-item="${esc(i.name)}" style="left:${(l * 100).toFixed(2)}%;top:${(tp * 100).toFixed(2)}%;width:${((r - l) * 100).toFixed(2)}%;height:${((b - tp) * 100).toFixed(2)}%"><span>${esc(i.name)}</span></i>`;
    }).join('');
    return `<figure class="plate ${cls}"><div class="pic"><img src="${esc(src)}" alt="${esc(loc.name)}" loading="lazy">${boxes}</div></figure>`;
  };

  const locationCards = locations.map((loc) => `<article class="card loc" data-loc="${esc(loc.sceneId)}">
  <header class="sc-h"><span class="sc-id">${esc(loc.sceneId)}</span><h3>${esc(loc.name)}</h3>
    <span class="badge${loc.readFrom === 'picture' ? '' : ' soft'}">${esc(loc.readFrom === 'picture' ? t.readFromPicture : loc.readFrom === 'prompt' ? t.readFromPrompt : t.notRead)}</span></header>
  ${picture(loc)}
  <table class="items"><thead><tr>${t.itemCols.slice(0, 4).map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>
  ${(loc.items ?? []).map((i) => `<tr data-item="${esc(i.name)}"><td>${esc(i.name)}</td><td>${esc(i.alt ?? '')}</td><td>${i.on ? esc(t.yes) : ''}</td><td>${isRound(i) ? esc(t.yes) : ''}</td></tr>`).join('\n  ')}
  </tbody></table>
</article>`).join('\n');

  const sceneCards = scenes.map((s, si) => {
    const loc = locations.find((l) => l.sceneId === s.sceneId);
    return `<article class="card scene" data-scene="${si}" id="sc-${s.ep}-${s.scene}">
  <header class="sc-h"><span class="sc-id">${esc(sceneLabel(s, code))}</span><h3>${esc(loc?.name ?? s.sceneId ?? '')}</h3>
    ${s.lighting ? `<span class="badge soft">${esc(s.lighting)}</span>` : ''}<span class="sc-use">${esc(t.people((s.cast ?? []).length))}</span></header>
  <div class="grid">
    <div class="planwrap">
      <div class="room" role="img" aria-label="${esc(t.planLabel)}">
        <span class="compass n">${esc(t.north)}</span><span class="compass s">${esc(t.south)}</span>
        <span class="compass w">${esc(t.west)}</span><span class="compass e">${esc(t.east)}</span>
        <div class="things"></div><div class="tokens"></div>
      </div>
      <div class="tray"><span class="tray-l">${esc(t.tray)}</span><div class="chips"></div></div>
    </div>
    <div class="side">
      ${loc ? picture(loc, 'mini') : ''}
      <div class="pick"></div>
      <div class="extras">
        <span class="lbl">${esc(t.extras)}</span>
        <button class="step" data-step="-1" aria-label="-1">−</button><b class="n"></b><button class="step" data-step="1" aria-label="+1">+</button>
        <input class="where" type="text" placeholder="${esc(t.extrasWhere)}">
      </div>
      <div class="sentence"><div class="sh"><span class="lbl">${esc(t.sentence)}</span><button class="copy mini">${esc(t.copy)}</button></div><p class="text"></p></div>
      ${s.why ? `<p class="why"><span class="lbl">${esc(t.why)}</span>${esc(s.why)}</p>` : ''}
      <ul class="live"></ul>
    </div>
  </div>
</article>`;
  }).join('\n');

  const gateList = `<ul class="gate">${gates.map((g) => `<li class="${g.ok ? 'ok' : 'bad'}"><span class="m">${g.ok ? '✓' : '✗'}</span><span>${esc(gateLabel(g))}${g.detail ? `<small>${esc(g.detail)}</small>` : ''}</span></li>`).join('\n')}</ul>`;

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
button{font-family:var(--sans)}

.hd{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:12px}
.hd h1{font:400 28px/1.1 var(--serif);letter-spacing:.06em}
.hd .sub{font-size:13px;color:var(--ink-2)}
.hd .right{margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.state{font-size:12px;color:var(--ink-3)}
.state.dirty{color:var(--seal)}
.gatepill{display:inline-flex;align-items:center;gap:6px;font:500 12px/1 var(--sans);border-radius:99px;padding:6px 12px}
.gatepill.pass{color:var(--ok);border:1px solid var(--ok)}
.gatepill.fail{color:var(--seal);border:1px solid var(--seal);background:var(--seal-soft)}
.expo,.restore{font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--panel);
  border:1px solid var(--rule-2);border-radius:2px;padding:7px 11px;cursor:pointer;transition:.15s}
.expo:hover,.restore:hover{border-color:var(--seal);color:var(--seal)}
.expo.dirty{border-color:var(--seal);color:#fff;background:var(--seal)}
.restore[hidden]{display:none}
button:focus-visible,input:focus-visible{outline:2px solid var(--seal);outline-offset:2px}

.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0 6px}
@media(max-width:900px){.kpis{grid-template-columns:repeat(2,1fr)}}
.kpi{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:11px 14px 9px}
.kpi .l{font:500 10px/1 var(--sans);letter-spacing:.18em;color:var(--ink-3)}
.kpi .v{font:400 28px/1.15 var(--serif);margin-top:5px}
.kpi .d{font-size:11px;color:var(--ink-2);margin-top:1px}
.kpi.accent{border-top:2px solid var(--seal)}
.galert{margin:14px 0 0;border:1px solid var(--seal);background:var(--seal-soft);border-radius:2px;padding:10px 14px;font-size:13px}
.galert b{color:var(--seal)}
.galert span{display:block;font-size:12px;color:var(--ink-2)}

section.top-sec{margin-top:34px}
.sec-h{display:flex;align-items:baseline;gap:12px;border-bottom:1px solid var(--rule-2);padding-bottom:8px;margin-bottom:16px}
.sec-h .no{font:500 12px/1 var(--mono);color:var(--seal)}
.sec-h h2{font:400 20px/1.2 var(--serif);letter-spacing:.05em}

.cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
.cards.one{grid-template-columns:1fr}
@media(max-width:1100px){.cards{grid-template-columns:1fr}}
.card{background:var(--panel);border:1px solid var(--rule);border-radius:2px;padding:18px 20px}
.sc-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;border-bottom:1px solid var(--rule-2);padding-bottom:10px;margin-bottom:14px}
.sc-id{font:500 12px/1 var(--mono);color:var(--seal)}
.sc-h h3{font:400 20px/1.2 var(--serif);letter-spacing:.04em}
.badge{font:500 10.5px/1 var(--sans);padding:2px 8px;border-radius:99px;border:1px solid var(--seal);color:var(--seal)}
.badge.soft{border-color:var(--rule-2);color:var(--ink-2)}
.sc-use{margin-left:auto;font-size:12px;color:var(--ink-2)}
.lbl{font:500 11px/1.6 var(--sans);letter-spacing:.14em;color:var(--seal)}

.plate{margin:0 0 12px;background:#fff;border:1px solid var(--rule-2);border-radius:2px;overflow:hidden}
.pic{position:relative;line-height:0}
.pic img{display:block;width:100%;height:auto}
.pbox{position:absolute;border:1.5px dashed transparent;border-radius:2px;pointer-events:none}
.pbox span{position:absolute;left:0;top:-1px;transform:translateY(-100%);font:500 11px/1.4 var(--sans);color:#fff;background:var(--seal);padding:0 4px;border-radius:2px;white-space:nowrap;display:none}
.pbox.lit{border-color:var(--seal);background:#8a33241f}
.pbox.lit span{display:block}
.plate-empty{display:grid;place-items:center;min-height:120px;text-align:center;border:1px dashed var(--rule-2);background:var(--paper);color:var(--ink-3);font-size:13px;padding:12px}
.plate-empty em{font-style:normal;font-size:12px;opacity:.8}
.plate.mini{max-width:420px}

table{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--rule);font-size:13px}
th,td{padding:6px 10px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top}
th{font:500 11px/1 var(--sans);letter-spacing:.1em;color:var(--ink-3);background:var(--side)}
tr:last-child td{border-bottom:0}
table.items tr.lit td{background:var(--seal-soft)}

.scene .grid{display:grid;grid-template-columns:minmax(320px,640px) minmax(0,1fr);gap:20px;align-items:start}
@media(max-width:1100px){.scene .grid{grid-template-columns:1fr}}
.room{position:relative;aspect-ratio:16/10;touch-action:none;user-select:none;-webkit-user-select:none;
  border:1px solid var(--rule-2);border-radius:2px;background:#fff}
/* 方位字放在平面外面一圈：东西贴着北墙、西墙摆时，字不压在它们上面 */
.planwrap{padding:16px 18px 0}
.compass{position:absolute;font-size:11px;line-height:1;color:var(--ink-3);pointer-events:none}
.compass.n{top:-14px;left:50%;transform:translateX(-50%)}
.compass.s{bottom:-14px;left:50%;transform:translateX(-50%)}
.compass.w{left:-14px;top:50%;transform:translateY(-50%)}
.compass.e{right:-14px;top:50%;transform:translateY(-50%)}
.tray{margin-top:22px}
.thing{position:absolute;border:1px solid var(--rule-2);border-radius:2px;background:var(--side)}
/* 名字贴在左上角、不折行：人站在东西中间时不挡名字，小东西的名字溢出到旁边 */
.thing span{position:absolute;left:2px;top:1px;font-size:11px;line-height:1.3;color:var(--ink-2);white-space:nowrap;pointer-events:none}
.thing.round span{left:50%;top:50%;transform:translate(-50%,-50%)}
.thing.seat{border-color:var(--seal-2);background:#c56a4e1a}
.thing.round{border-radius:50%}
.thing.lit{border-color:var(--seal);box-shadow:0 0 0 1.5px var(--seal)}
.token{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:var(--ink);color:#fff;
  display:grid;place-items:center;cursor:grab;touch-action:none;z-index:2;border:2px solid #fff;box-shadow:0 1px 3px #0004}
.token.sit{background:var(--ink-2)}
.token b{font:500 13px/1 var(--sans);pointer-events:none}
.token .name{position:absolute;top:100%;left:50%;transform:translateX(-50%);margin-top:2px;font-size:11px;line-height:1.3;
  color:var(--ink);background:#ffffffd9;padding:0 3px;border-radius:2px;white-space:nowrap;pointer-events:none}
.token .facing{position:absolute;inset:-9px;pointer-events:none}
.token .facing::before{content:"";position:absolute;left:50%;top:0;margin-left:-5px;border:5px solid transparent;border-bottom:7px solid var(--seal);border-top:0}
.token.sel{outline:2px solid var(--seal);outline-offset:2px}
.token.lifted{cursor:grabbing;z-index:5;transition:none}
.tray{border:1px dashed var(--rule-2);border-radius:2px;padding:8px 10px;background:var(--paper);min-height:46px}
.tray.over{border-color:var(--seal);background:var(--seal-soft)}
.tray-l{display:block;font-size:11px;color:var(--ink-3);margin-bottom:6px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font:500 12px/1 var(--sans);padding:6px 10px;border-radius:99px;background:var(--panel);border:1px solid var(--rule-2);cursor:grab;touch-action:none;user-select:none}
.chip.lifted{position:fixed;z-index:20;pointer-events:none;box-shadow:0 2px 8px #0003}
.chips .none{font-size:12px;color:var(--ink-3)}

.side{display:flex;flex-direction:column;gap:12px;min-width:0}
.pick{border:1px solid var(--rule);border-radius:2px;background:var(--paper);padding:10px 12px;font-size:12.5px;color:var(--ink-2)}
.pick h4{font:400 16px/1.3 var(--serif);color:var(--ink);margin-bottom:8px}
.pick .row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.seg{display:inline-flex;border:1px solid var(--rule-2);border-radius:2px;overflow:hidden}
.seg button,.rose button,.step,.out{font:500 12px/1 var(--sans);background:var(--panel);color:var(--ink-2);border:0;padding:6px 12px;cursor:pointer}
.seg button+button{border-left:1px solid var(--rule-2)}
.seg button[aria-pressed="true"],.rose button[aria-pressed="true"]{background:var(--seal);color:#fff}
.rose{display:grid;grid-template-columns:repeat(3,48px);gap:2px}
.rose button{border:1px solid var(--rule-2);border-radius:2px;padding:6px 0}
.rose .mid{display:grid;place-items:center;font-size:11px;color:var(--ink-3)}
.out{border:1px solid var(--rule-2);border-radius:2px}
.out:hover,.step:hover,.seg button:hover{color:var(--seal)}
.extras{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.step{border:1px solid var(--rule-2);border-radius:2px;padding:4px 10px}
.extras .n{font:500 15px/1 var(--mono);min-width:22px;text-align:center}
.extras .where{flex:1;min-width:180px;font:13px/1.4 var(--sans);padding:6px 8px;border:1px solid var(--rule-2);border-radius:2px;background:#fff}
.sentence{border:1px solid var(--rule);border-radius:2px;background:#fff;padding:8px 12px}
.sentence .sh{display:flex;align-items:center;justify-content:space-between}
.sentence .text{margin:6px 0 2px;font:400 14px/1.8 var(--serif)}
.copy{font:500 11px/1 var(--sans);color:var(--ink-2);background:var(--panel);border:1px solid var(--rule-2);border-radius:2px;padding:4px 10px;cursor:pointer}
.copy:hover,.copy[data-done]{border-color:var(--seal);color:var(--seal)}
.why{margin:0;font-size:12.5px;color:var(--ink-2)}
.why .lbl{margin-right:8px}
.live{list-style:none;margin:0;padding:0;font-size:12px}
.live li{color:var(--seal);background:var(--seal-soft);border-radius:2px;padding:4px 8px;margin-top:4px}
.live li.ok{color:var(--ok);background:none;padding-left:0}

.gate{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:2px 28px}
@media(max-width:900px){.gate{grid-template-columns:1fr}}
.gate li{display:flex;gap:8px;padding:5px 0;font-size:12.5px;line-height:1.55}
.gate .m{flex:none;font-weight:700}
.gate li.ok .m{color:var(--ok)}
.gate li.bad .m{color:var(--seal)}
.gate li.bad{background:var(--seal-soft);border-radius:2px;padding-left:6px}
.gate small{display:block;color:var(--ink-3)}
.gsum{margin:10px 0 0;font-size:12px;color:var(--ink-2)}
.foot{margin-top:40px;font-size:11px;color:var(--ink-3);border-top:1px solid var(--rule);padding-top:14px}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
@media print{
  .expo,.restore,.copy,.tray,.pick,.extras button{display:none!important}
  .page{max-width:none;padding:0}
  .card{page-break-inside:avoid}
  body{background:#fff}
}
</style></head><body>
<div class="page">

<header class="hd">
  <h1>${esc(doc.source)}</h1>
  <span class="sub">${esc(t.kicker)}</span>
  <span class="right">
    <span class="state" aria-live="polite">${esc(t.saved)}</span>
    <span class="gatepill ${failed.length ? 'fail' : 'pass'}">${failed.length ? '✗' : '✓'} ${esc(t.gatePill(gates.length - failed.length, gates.length))}</span>
    <button class="restore" hidden>${esc(t.restore)}</button>
    <button class="expo" data-name="${esc(slug(doc.source || 'staging'))}-staging.json">${esc(t.exportJson)}</button>
  </span>
</header>

<div class="kpis">
  <div class="kpi accent"><div class="l">${esc(t.kpi.scenes)}</div><div class="v">${scenes.length}</div><div class="d">${esc(t.kpiSub.scenes(withAbsent))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.locations)}</div><div class="v">${locations.length}</div><div class="d">${esc(t.kpiSub.locations(fromPicture))}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.present)}</div><div class="v">${presentN}</div><div class="d">${esc(t.kpiSub.present)}</div></div>
  <div class="kpi"><div class="l">${esc(t.kpi.extras)}</div><div class="v">${extrasN}</div><div class="d">${esc(t.kpiSub.extras)}</div></div>
</div>
${failed.length ? `<div class="galert"><b>✗ ${esc(t.gatesFail(failed.length))}</b>${failed.map((g) => `<span>${esc(gateLabel(g))}${g.detail ? ` — ${esc(g.detail)}` : ''}</span>`).join('')}</div>` : ''}

<section class="top-sec" id="sec-scenes">
  <div class="sec-h"><span class="no">01</span><h2>${esc(t.secScenes)}</h2></div>
  <div class="cards one">
${sceneCards}
  </div>
</section>

<section class="top-sec" id="sec-locations">
  <div class="sec-h"><span class="no">02</span><h2>${esc(t.secLocations)}</h2></div>
  <div class="cards">
${locationCards}
  </div>
</section>

<section class="top-sec" id="sec-gates">
  <div class="sec-h"><span class="no">03</span><h2>${esc(t.secGates)}</h2></div>
  ${gateList}
  <p class="gsum">${failed.length ? `<b>${esc(t.gatesFail(failed.length))}</b> · ` : `${esc(t.gatesPass)} · `}${esc(t.gatesAtRender)}</p>
</section>

<p class="foot">${esc(t.colophon)}</p>
</div>

<script type="application/json" id="staging-data">${embed(doc)}</script>
<script>
${stagingCore.toString()}
const core = stagingCore();
const LANG = ${JSON.stringify(code)};
const WORK = ${JSON.stringify(doc.lang ?? 'zh')};
const T = ${embed({
    pickHint: t.pickHint, sit: t.sit, stand: t.stand, facing: t.facing, makeAbsent: t.makeAbsent, trayEmpty: t.trayEmpty,
    copied: t.copied, copyFailed: t.copyFailed, ok: t.ok, nobody: t.nobody, edited: t.edited, saved: t.saved,
    restore: t.restore, restoreAgain: t.restoreAgain, facingNames: t.facingNames,
  })};
const ANGLE = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
const ROSE = ['northwest', 'north', 'northeast', 'west', null, 'east', 'southwest', 'south', 'southeast'];

const ORIGINAL = document.getElementById('staging-data').textContent;
// 页面上的改动先存在这台电脑的浏览器里，刷新不丢；文件内容变了（重新 render 过）就不再套用旧改动
const KEY = 'novel-staging:' + ORIGINAL.length + ':' + [...ORIGINAL].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
let doc = JSON.parse(ORIGINAL);
try { const kept = localStorage.getItem(KEY); if (kept) doc = JSON.parse(kept); } catch { /* 隐私模式或禁了存储：不保存，照样能改能导出 */ }
const selected = new Map(); // 场次序号 → 选中的人
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const locOf = (s) => (doc.locations || []).find((l) => l.sceneId === s.sceneId);
const nameIn = (s) => {
  if (LANG === WORK) return undefined;
  const alt = new Map((locOf(s)?.items || []).map((i) => [i.name, i.alt || i.name]));
  return (n) => alt.get(n) ?? n;
};

function persist() {
  const now = JSON.stringify(doc);
  const dirty = now !== JSON.stringify(JSON.parse(ORIGINAL));
  try { if (dirty) localStorage.setItem(KEY, now); else localStorage.removeItem(KEY); } catch { /* 见上 */ }
  const st = document.querySelector('.state');
  st.textContent = dirty ? T.edited : T.saved;
  st.classList.toggle('dirty', dirty);
  document.querySelector('.expo').classList.toggle('dirty', dirty);
  document.querySelector('.restore').hidden = !dirty;
}

function highlight(card, item) {
  card.querySelectorAll('.thing').forEach((el) => el.classList.toggle('lit', !!item && el.dataset.item === item));
  card.querySelectorAll('.pbox').forEach((el) => el.classList.toggle('lit', !!item && el.dataset.item === item));
  const loc = card.dataset.scene !== undefined ? locOf(doc.scenes[Number(card.dataset.scene)]) : null;
  if (loc) document.querySelectorAll('.loc[data-loc="' + CSS.escape(loc.sceneId) + '"] tr[data-item]').forEach((tr) => tr.classList.toggle('lit', !!item && tr.dataset.item === item));
}

function drawScene(si) {
  const s = doc.scenes[si];
  const card = document.querySelector('.scene[data-scene="' + si + '"]');
  const items = locOf(s)?.items || [];
  const pct = (v) => (v * 100).toFixed(2) + '%';
  card.querySelector('.things').innerHTML = items.map((i) => {
    const [x0, y0, x1, y1] = i.plan;
    return '<div class="thing' + (i.on ? ' seat' : '') + (core.isRound(i) ? ' round' : '') + '" data-item="' + esc(i.name) + '" title="' + esc(i.name) + '" style="left:' + pct(x0) + ';top:' + pct(y0) + ';width:' + pct(x1 - x0) + ';height:' + pct(y1 - y0) + '"><span>' + esc(i.name) + '</span></div>';
  }).join('');
  const pts = core.placePoints(s.places || [], items);
  const sel = selected.get(si);
  card.querySelector('.tokens').innerHTML = (s.places || []).filter((p) => pts.has(p.id)).map((p) => {
    const pt = pts.get(p.id);
    return '<div class="token' + (p.posture === 'sit' ? ' sit' : '') + (sel === p.id ? ' sel' : '') + '" role="button" tabindex="0" data-id="' + esc(p.id) + '" title="' + esc(p.name) + '" style="left:' + pct(pt.x) + ';top:' + pct(pt.y) + '">'
      + '<i class="facing" style="transform:rotate(' + (ANGLE[p.facing] ?? 180) + 'deg)"></i><b>' + esc([...p.name][0]) + '</b><span class="name">' + esc(p.name) + '</span></div>';
  }).join('');
  const out = (s.places || []).filter((p) => !pts.has(p.id));
  card.querySelector('.chips').innerHTML = out.length
    ? out.map((p) => '<span class="chip" role="button" tabindex="0" data-id="' + esc(p.id) + '">' + esc(p.name) + '</span>').join('')
    : '<span class="none">' + esc(T.trayEmpty) + '</span>';

  const p = (s.places || []).find((x) => x.id === sel && pts.has(x.id));
  card.querySelector('.pick').innerHTML = !p ? esc(T.pickHint)
    : '<h4>' + esc(p.name) + '</h4>'
      + '<div class="row"><span class="seg">' + ['sit', 'stand'].map((v) => '<button data-posture="' + v + '" aria-pressed="' + (p.posture === v) + '">' + esc(T[v]) + '</button>').join('') + '</span>'
      + '<button class="out">' + esc(T.makeAbsent) + '</button></div>'
      + '<div class="row"><span>' + esc(T.facing) + '</span><div class="rose">' + ROSE.map((f) => f
        ? '<button data-facing="' + f + '" aria-pressed="' + (p.facing === f) + '" title="' + esc(T.facingNames[f]) + '">' + esc(T.facingNames[f]) + '</button>'
        : '<span class="mid">' + esc(T.facingNames[p.facing] ?? '') + '</span>').join('') + '</div></div>';

  card.querySelector('.extras .n').textContent = Number.isInteger(s.extras) ? s.extras : '—';
  const where = card.querySelector('.extras .where');
  if (document.activeElement !== where) where.value = s.extrasWhere || '';
  card.querySelector('.sentence .text').textContent = core.stagingBlocking(s, LANG, nameIn(s)) || T.nobody;
  const problems = core.sceneProblems(s, locOf(s), LANG);
  card.querySelector('.live').innerHTML = problems.length
    ? problems.map((x) => '<li>' + esc(x.text) + '</li>').join('')
    : '<li class="ok">✓ ' + esc(T.ok) + '</li>';
}

function update(si, change) {
  change(doc.scenes[si]);
  persist();
  drawScene(si);
}

/* 拖动：平面上的人拖到别处，或从「开场不在场」拖进平面；拖回托盘就是开场不在 */
let drag = null;
function startDrag(e, si, id, el) {
  drag = { si, id, el, x: e.clientX, y: e.clientY, moved: false, fromTray: el.classList.contains('chip') };
  el.setPointerCapture?.(e.pointerId);
}
document.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('.token, .chip[data-id]');
  if (!el) return;
  e.preventDefault();
  const card = el.closest('.scene');
  startDrag(e, Number(card.dataset.scene), el.dataset.id, el);
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
  drag.moved = true;
  const card = document.querySelector('.scene[data-scene="' + drag.si + '"]');
  const room = card.querySelector('.room').getBoundingClientRect();
  drag.el.classList.add('lifted');
  if (drag.fromTray) {
    drag.el.style.left = e.clientX - 20 + 'px';
    drag.el.style.top = e.clientY - 14 + 'px';
  } else {
    drag.el.style.left = ((e.clientX - room.left) / room.width) * 100 + '%';
    drag.el.style.top = ((e.clientY - room.top) / room.height) * 100 + '%';
  }
  const inRoom = e.clientX >= room.left && e.clientX <= room.right && e.clientY >= room.top && e.clientY <= room.bottom;
  const items = locOf(doc.scenes[drag.si])?.items || [];
  const target = inRoom ? core.nearestPlace({ x: (e.clientX - room.left) / room.width, y: (e.clientY - room.top) / room.height }, items) : null;
  highlight(card, target?.item);
  const tray = card.querySelector('.tray').getBoundingClientRect();
  card.querySelector('.tray').classList.toggle('over', e.clientX >= tray.left && e.clientX <= tray.right && e.clientY >= tray.top && e.clientY <= tray.bottom);
});
document.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const { si, id, moved } = drag;
  drag = null;
  const card = document.querySelector('.scene[data-scene="' + si + '"]');
  card.querySelector('.tray').classList.remove('over');
  highlight(card, null);
  if (!moved) {
    selected.set(si, id);
    drawScene(si);
    return;
  }
  const room = card.querySelector('.room').getBoundingClientRect();
  const tray = card.querySelector('.tray').getBoundingClientRect();
  const within = (r) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  const s = doc.scenes[si];
  const items = locOf(s)?.items || [];
  if (within(room)) {
    const target = core.nearestPlace({ x: (e.clientX - room.left) / room.width, y: (e.clientY - room.top) / room.height }, items);
    if (target) {
      selected.set(si, id);
      update(si, (sc) => { sc.places = sc.places.map((p) => (p.id === id ? core.moveTo(p, target, items) : p)); });
      return;
    }
  } else if (within(tray)) {
    update(si, (sc) => { sc.places = sc.places.map((p) => (p.id === id ? { ...p, present: false, item: null, side: null, along: null } : p)); });
    return;
  }
  drawScene(si);
});

/* clipboard: the async API is blocked inside cross-origin iframes (composer panes / previews); */
/* fall back to a hidden textarea + execCommand, which still works there */
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch {}
  const ta = document.createElement('textarea');
  ta.value = t;
  ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(ta);
  ta.focus(); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch {}
  ta.remove();
  return ok;
}

/* 选中一个人以后：坐站、朝向、移出 */
document.addEventListener('click', async (e) => {
  const card = e.target.closest('.scene');
  if (card) {
    const si = Number(card.dataset.scene);
    const id = selected.get(si);
    const set = (change) => update(si, (sc) => { sc.places = sc.places.map((p) => (p.id === id ? { ...p, ...change } : p)); });
    const b = e.target.closest('button');
    if (b?.dataset.posture) return set({ posture: b.dataset.posture });
    if (b?.dataset.facing) return set({ facing: b.dataset.facing });
    if (b?.classList.contains('out')) { selected.delete(si); return set({ present: false, item: null, side: null, along: null }); }
    if (b?.dataset.step) {
      return update(si, (sc) => {
        sc.extras = Math.max(0, (Number.isInteger(sc.extras) ? sc.extras : 0) + Number(b.dataset.step));
        if (sc.extras === 0) sc.extrasWhere = null;
      });
    }
  }
  const copy = e.target.closest('.copy');
  if (copy) {
    const text = copy.closest('.sentence')?.querySelector('.text')?.textContent ?? '';
    const label = copy.textContent;
    if (await copyText(text)) { copy.textContent = T.copied; copy.dataset.done = '1'; } else { copy.textContent = T.copyFailed; }
    setTimeout(() => { copy.textContent = label; delete copy.dataset.done; }, 1600);
  }
});
document.addEventListener('keydown', (e) => {
  const el = e.target.closest?.('.token');
  if (el && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    const si = Number(el.closest('.scene').dataset.scene);
    selected.set(si, el.dataset.id);
    drawScene(si);
  }
});
document.addEventListener('input', (e) => {
  if (!e.target.classList.contains('where')) return;
  const si = Number(e.target.closest('.scene').dataset.scene);
  update(si, (sc) => { sc.extrasWhere = e.target.value.trim() ? e.target.value : null; });
});
document.addEventListener('pointerover', (e) => {
  const thing = e.target.closest('.thing, tr[data-item]');
  const card = e.target.closest('.card');
  if (!card || drag) return;
  if (card.classList.contains('loc')) {
    card.querySelectorAll('.pbox').forEach((el) => el.classList.toggle('lit', !!thing && el.dataset.item === thing.dataset.item));
    card.querySelectorAll('tr[data-item]').forEach((tr) => tr.classList.toggle('lit', !!thing && tr.dataset.item === thing.dataset.item));
  } else highlight(card, thing?.dataset.item);
});

/* 导出：下载的是改过的 staging.json，喂回 validate / render 照样能用 */
document.querySelector('.expo').addEventListener('click', (e) => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2) + '\\n'], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: e.currentTarget.dataset.name });
  a.click();
  // 别立刻回收——Safari 会抢在下载读完之前撤掉 blob
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});
/* 还原：点两次，防手滑 */
let armed = null;
document.querySelector('.restore').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  if (!armed) {
    btn.textContent = T.restoreAgain;
    armed = setTimeout(() => { armed = null; btn.textContent = T.restore; }, 3000);
    return;
  }
  clearTimeout(armed);
  armed = null;
  btn.textContent = T.restore;
  doc = JSON.parse(ORIGINAL);
  selected.clear();
  persist();
  doc.scenes.forEach((_, i) => drawScene(i));
});

doc.scenes.forEach((_, i) => drawScene(i));
persist();
</script>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const USAGE = `novel-staging.mjs — novel-staging skill 的确定性工具（开场站位）

  seed <script.json> [--art a.json] [--outline o.json] [--eps 1-3]
                                         从剧本预填 staging.json 骨架（打印到 stdout）：地点、场次、出场人物
                                         给了 art.json 地点带名字；给了 outline.json 人物带名字
  validate <staging.json> [--script s.json] [--art a.json]
                                         校验；有违规逐条打印并 exit 1
                                         给了 script.json 才核对出场人物跟剧本一致
  checkup <staging.json> [--script s.json] [--art a.json]
                                         只打印质量门 ✓/✗，有未过项 exit 1
  blocking <staging.json> [--lang zh|en] 打印每一场的开场走位句（分镜这一场第一段照抄它）
  render <staging.json> [--html|--md]    渲染报告到 stdout（默认 HTML 工具报告）；--md 按需导出 Markdown
        [--lang zh|en]                   界面语言优先级：--lang > staging.json 顶层 lang 字段 > 中文
        [--images <dir>]                 场景图所在目录，默认 staging.json 同级的 images/；
                                         找 <dir>/<地点名>-sheet.png，找到就嵌进报告
  slug <name>                            地点名转安全文件名`;

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

  if (cmd === 'seed') {
    const [path] = rest;
    if (!path) throw new Error('用法：seed <script.json> [--art a.json] [--outline o.json] [--eps 1-3]');
    const art = flag(rest, '--art');
    const outline = flag(rest, '--outline');
    if (!outline) console.error('⚠️ 没给 --outline，人物先用编号（C01）代替名字');
    const doc = seedFromScript(readJson(path), {
      art: art ? readJson(art) : null,
      outline: outline ? readJson(outline) : null,
      eps: parseEps(flag(rest, '--eps')),
    });
    console.log(JSON.stringify(doc, null, 2));
    return;
  }

  if (cmd === 'validate' || cmd === 'checkup') {
    const [path] = rest;
    if (!path) throw new Error(`用法：${cmd} <staging.json> [--script s.json] [--art a.json]`);
    const doc = readJson(path);
    const scriptPath = flag(rest, '--script');
    const artPath = flag(rest, '--art');
    const opts = { script: scriptPath ? readJson(scriptPath) : null, art: artPath ? readJson(artPath) : null };
    if (!scriptPath) console.error('⚠️ 没给 --script，出场人物没跟剧本核对');

    if (cmd === 'checkup') {
      const gates = gateReport(doc, opts);
      for (const g of gates) console.log(`${g.ok ? '✓' : '✗'} ${g.label}${!g.ok && g.detail ? ` — ${g.detail}` : ''}`);
      const failedN = gates.filter((g) => !g.ok).length;
      console.log(failedN ? `\n✗ ${failedN} 项未过` : '\n✓ 全部通过');
      if (failedN) process.exit(1);
      return;
    }

    const problems = validateStaging(doc, opts);
    if (problems.length) {
      console.error(`✗ ${problems.length} 处违规：\n`);
      for (const x of problems) console.error('  ' + x);
      process.exit(1);
    }
    console.log(`✓ ${doc.locations.length} 个地点、${doc.scenes.length} 场站位全部通过校验`);
    return;
  }

  if (cmd === 'blocking') {
    const [path] = rest;
    if (!path) throw new Error('用法：blocking <staging.json> [--lang zh|en]');
    const doc = readJson(path);
    const code = langOf(doc, flag(rest, '--lang'));
    for (const { label, blocking } of blockingLines(doc, code)) console.log(`${label}\t${blocking ?? I18N[code].nobody}`);
    return;
  }

  if (cmd === 'render') {
    const [path] = rest;
    if (!path) throw new Error('用法：render <staging.json> [--html|--md] [--lang zh|en] [--images <dir>]');
    if (rest.includes('--html') && rest.includes('--md')) throw new Error('--html 与 --md 不能同时指定');
    const doc = readJson(path);
    const lang = flag(rest, '--lang');
    // 报告默认写在 staging.json 旁边，图片路径按那里算；--images 按普通命令行路径解析
    const outDir = resolve(path, '..');
    const imagesFlag = flag(rest, '--images');
    const imagesDir = imagesFlag ? resolve(imagesFlag) : join(outDir, 'images');
    const images = {};
    for (const loc of doc.locations ?? []) {
      const abs = join(imagesDir, `${slug(loc.name)}-sheet.png`);
      if (existsSync(abs)) images[loc.sceneId] = relative(outDir, abs).split(sep).join('/');
    }
    process.stdout.write((rest.includes('--md') ? renderMarkdown(doc, lang) : renderHtml(doc, lang, images)) + '\n');
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
