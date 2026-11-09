#!/usr/bin/env node
/**
 * novel-director — 短剧审片层
 *
 * 对 storyboard.json 的镜头表做「导演视角」的提示性审查。
 * 只提示、不设门：所有结论都是建议，不阻塞任何生成流程。
 *
 * 六类检查（详见 SKILL.md）：
 *   1. 同质镜      —— 连续多镜同机位同景别同构图，像没切
 *   2. 运镜动机    —— 运镜缺支点（远景无表演 / 与机位反向 / 孤立运镜 / 整段无静帧 / 滥用晃动）
 *   3. 轴线        —— 同一主体正面↔背后跳变、对视关系断裂、画面左右跳变（需人工核对）
 *   4. POV         —— 主观视线指向某物却全场不呈现；视线落空需补反打
 *   5. 反应镜      —— 情绪/特写高潮后无对手反应；对手戏一方全程无脸
 *   6. 主角在场    —— 关键/收尾段无主角；覆盖主角台词拍却无主角入画
 *
 * 零依赖、零 API key，node 直接跑。
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/* ------------------------------------------------------------------ */
/* 常量                                                                 */
/* ------------------------------------------------------------------ */

// 运镜词表（与 novel-storyboard 的 CAMERA_MOVES 对齐）
const STATIC = 'Static Shot';
const POV = 'POV';
const SHAKE_ROLL = new Set(['Shake Slightly', 'Shake Strongly', 'Roll Clockwise', 'Roll Counterclockwise']);

// 景别 → 远近序（数字越大越近）
const SIZE_ORDER = {
  'extreme-wide': 0,
  'wide': 1,
  'medium': 2,
  'close': 3,
  'extreme-close': 4,
};

const SEVERITY = { high: '重点', medium: '建议', low: '提示' };
const SEV_RANK = { high: 3, medium: 2, low: 1 };

// 视线落点里「空」的一类：没看具体东西，或看向画外
const VOID_EYELINE = new Set([
  '虚空', '上方虚空', '上方', '下方', '路面', '地面', '路缘石', '尾灯',
  '纸', '笔下纸面', '内袋', '上衣口袋', '裤子上的烟灰', '地面烟灰', '烟头', '烟灰',
]);

// 视线落点里「关系型」的一类：看向对方，不是具体物件，不应当作 POV 具体目标
const RELATIONAL_EYELINE = new Set(['对方', '对方面部', '对方脸', '两人']);

// 焦点里「脸」的一类：能承接情绪
const FACE_FOCUS = ['面部', '脸', '眼', '侧脸', '嘴', '表情', '瞳仁', '眉', '下颌', '左脸', '嘴部'];

// 机位主体里「人」的一类：只有人需要反应镜/脸部特写；车/手/桌/屏等物件排除
const PERSON_RE = /男子|女人|男人|女孩|男孩|民警|年轻人|人|老板|叔|父|母|警|生|师|员|客|孩|秃顶|壮实|戴眼镜|靠椅背|柜台后|同伴/;

/* ------------------------------------------------------------------ */
/* 加载                                                                 */
/* ------------------------------------------------------------------ */

function loadJson(p) {
  if (!p) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`无法读取 ${p}: ${e.message}`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* 把 storyboard 摊平成可分析的镜头序列                                  */
/* ------------------------------------------------------------------ */

function buildShots(board) {
  const shots = [];
  const byScene = new Map(); // `${ep}:${sceneIndex}` -> [shot]
  const bySeg = new Map();   // segId -> [shot]

  board.episodes.forEach((ep, epIndex) => {
    (ep.segments || []).forEach((seg, segIndex) => {
      const sceneKey = `${ep.ep}:${seg.sceneIndex}`;
      const segShots = [];
      (seg.cuts || []).forEach((cut, cutIndex) => {
        const s = {
          ep: ep.ep, epIndex, segId: seg.id, segIndex, sceneIndex: seg.sceneIndex,
          cutIndex, cut, seg,
          sceneKey,
        };
        shots.push(s);
        segShots.push(s);
        if (!byScene.has(sceneKey)) byScene.set(sceneKey, []);
        byScene.get(sceneKey).push(s);
        bySeg.set(seg.id, segShots);
      });
    });
  });

  // 全局播放顺序上的 prev / next
  shots.forEach((s, i) => {
    s.prev = i > 0 ? shots[i - 1] : null;
    s.next = i < shots.length - 1 ? shots[i + 1] : null;
    // 同场（跨段）的相邻，用于轴线/POV/反应镜
    const sc = byScene.get(s.sceneKey);
    const si = sc.indexOf(s);
    s.scenePrev = si > 0 ? sc[si - 1] : null;
    s.sceneNext = si < sc.length - 1 ? sc[si + 1] : null;
  });

  return { shots, byScene, bySeg };
}

/* ------------------------------------------------------------------ */
/* 小工具                                                               */
/* ------------------------------------------------------------------ */

const camSubject = (cp) => (cp ? String(cp).split('+')[0].trim() : '');
const isMovement = (cam) => cam && cam !== STATIC && cam !== POV;
const isShake = (cam) => SHAKE_ROLL.has(cam);
const hasFaceFocus = (focus) => FACE_FOCUS.some((k) => String(focus).includes(k));
const sizeRank = (sz) => (SIZE_ORDER[sz] == null ? 2 : SIZE_ORDER[sz]);

function sameSubject(a, b) {
  const sa = camSubject(a), sb = camSubject(b);
  if (!sa || !sb) return false;
  return sa === sb;
}

/* ------------------------------------------------------------------ */
/* 检查 1：同质镜                                                       */
/* ------------------------------------------------------------------ */

function reviewHomogeneous(ctx) {
  const out = [];
  for (const [, sceneShots] of ctx.byScene) {
    // 滑动窗口 3 连
    for (let i = 0; i + 2 < sceneShots.length; i++) {
      const win = sceneShots.slice(i, i + 3);
      const sig = (s) => `${s.cut.size}|${camSubject(s.cut.cameraPosition)}|${s.cut.composition}`;
      const a = sig(win[0]), b = sig(win[1]), c = sig(win[2]);
      if (a && a === b && b === c) {
        const ev = `连续 3 镜同签名（景别=${win[0].cut.size} / 机位主体=${camSubject(win[0].cut.cameraPosition)} / 构图=${win[0].cut.composition}）：`
          + win.map((s) => `${s.segId}#${s.cutIndex + 1}`).join('、');
        out.push({
          category: '同质镜', severity: 'medium',
          segId: win[1].segId, cutIndex: win[1].cutIndex,
          title: '连续同机位同景别同构图',
          detail: '三镜连在一起像没切，观众接收不到剪辑节奏。',
          evidence: ev,
          suggestion: '其中一两镜换景别（推近/拉远）、换角度（侧→背）或换构图，或把重复的几镜并成移动长镜。',
        });
        i += 2; // 跳过已报的窗口
      }
    }
  }

  // 整段静止同机位同构图 —— 节奏扁平
  for (const [, segShots] of ctx.bySeg) {
    if (segShots.length < 3) continue;
    const allStatic = segShots.every((s) => s.cut.camera === STATIC || !s.cut.camera);
    const sigSame = new Set(segShots.map((s) => `${s.cut.size}|${camSubject(s.cut.cameraPosition)}|${s.cut.composition}`)).size === 1;
    if (allStatic && sigSame) {
      out.push({
        category: '同质镜', severity: 'medium',
        segId: segShots[0].segId, cutIndex: null,
        title: '整段静止同机位同构图',
        detail: '一段之内全是固定镜、同一景别同一机位，节奏扁平，没有视觉支点。',
        evidence: `${segShots[0].segId} 共 ${segShots.length} 切，全部 Static Shot，签名 ${segShots[0].cut.size}|${camSubject(segShots[0].cut.cameraPosition)}|${segShots[0].cut.composition}`,
        suggestion: '至少插入 1–2 镜运动或反向机位，给这段一个视觉呼吸点。',
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 检查 2：运镜动机                                                     */
/* ------------------------------------------------------------------ */

function reviewCameraMotivation(ctx) {
  const out = [];
  for (const s of ctx.shots) {
    const cam = s.cut.camera;
    if (!isMovement(cam)) continue;

    // 远景 + 无表演层 → 动机薄弱
    if (!s.cut.performance && (s.cut.size === 'wide' || s.cut.size === 'extreme-wide')) {
      out.push({
        category: '运镜动机', severity: 'medium',
        segId: s.segId, cutIndex: s.cutIndex,
        title: '远景上的运镜缺支点',
        detail: '在远景、又没有表演层（performance 为空）的镜上做运镜，观众既看不清人、又接不到情绪，运镜像为动而动。',
        evidence: `${s.segId}#${s.cutIndex + 1} camera=${cam} size=${s.cut.size} performance=空`,
        suggestion: '要么把镜推近到人（特写/中景）让运镜服务表情，要么给这镜一个明确的动作支点。',
      });
    }

    // 推/拉 与 机位方向相反
    const cp = String(s.cut.cameraPosition || '');
    const pushish = cam === 'Push In' || cam === 'Zoom In';
    const pullish = cam === 'Pull Out' || cam === 'Zoom Out';
    if (pushish && /后退|拉远|远离|拉开|退后/.test(cp)) {
      out.push({
        category: '运镜动机', severity: 'high',
        segId: s.segId, cutIndex: s.cutIndex,
        title: '运镜与机位方向矛盾',
        detail: '镜头在「推」，机位描述却在「后退/拉远」，同一镜自相矛盾，视频模型会左右为难。',
        evidence: `${s.segId}#${s.cutIndex + 1} camera=${cam} cameraPosition="${cp}"`,
        suggestion: '统一方向：要么改 camera 为 Pull Out，要么改机位描述去掉「后退/拉远」。',
      });
    }
    if (pullish && /推近|逼近|靠近|压近|凑近/.test(cp)) {
      out.push({
        category: '运镜动机', severity: 'high',
        segId: s.segId, cutIndex: s.cutIndex,
        title: '运镜与机位方向矛盾',
        detail: '镜头在「拉」，机位描述却在「推近/逼近」，同一镜自相矛盾。',
        evidence: `${s.segId}#${s.cutIndex + 1} camera=${cam} cameraPosition="${cp}"`,
        suggestion: '统一方向：要么改 camera 为 Push In，要么改机位描述去掉「推近/逼近」。',
      });
    }

    // 孤立运镜：前后皆静 + 本镜无表演
    if (!isShake(cam) && !s.cut.performance
      && s.prev && s.next
      && (s.prev.cut.camera === STATIC || !s.prev.cut.camera)
      && (s.next.cut.camera === STATIC || !s.next.cut.camera)) {
      out.push({
        category: '运镜动机', severity: 'medium',
        segId: s.segId, cutIndex: s.cutIndex,
        title: '孤立运镜缺动机',
        detail: '前后两镜都静止、本镜也无表演层，这一下运动没有戏剧理由，容易被读成技术失误。',
        evidence: `${s.segId}#${s.cutIndex + 1} camera=${cam}，前后镜均为 Static Shot 且无 performance`,
        suggestion: '让这镜接住一处情绪（写 performance）或一次明确动作；否则换成静帧。',
      });
    }

    // 强烈晃动无戏剧支点
    if ((cam === 'Shake Strongly') && !s.cut.performance && !/冲击|爆炸|撞|倒|混乱|奔跑|追|摔|抖|震/.test(String(s.cut.frame || ''))) {
      out.push({
        category: '运镜动机', severity: 'low',
        segId: s.segId, cutIndex: s.cutIndex,
        title: '强烈晃动未必必要',
        detail: '强烈晃动通常用于冲击/混乱场面；此镜 frame 无对应戏剧支点、也无表演层，晃动可能只是噪点。',
        evidence: `${s.segId}#${s.cutIndex + 1} camera=${cam} performance=空`,
        suggestion: '确认这镜是否需要晃；若只是普通叙事，改 stable 或 slight-shake。',
      });
    }
  }

  // 整段无静帧锚点
  for (const [, segShots] of ctx.bySeg) {
    if (segShots.length < 3) continue;
    const anyStatic = segShots.some((s) => s.cut.camera === STATIC);
    const anyPov = segShots.some((s) => s.cut.camera === POV);
    if (!anyStatic && !anyPov) {
      out.push({
        category: '运镜动机', severity: 'medium',
        segId: segShots[0].segId, cutIndex: null,
        title: '整段无静帧锚点',
        detail: '一段之内每镜都在运动，没有一镜固定，观众缺少落点、容易眩晕。',
        evidence: `${segShots[0].segId} 共 ${segShots.length} 切，全部为运动镜（含晃动/移动），无 Static Shot`,
        suggestion: '在其中插入至少一镜固定机位，作为视觉呼吸点。',
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 检查 3：轴线（需人工核对，全部低/中）                                 */
/* ------------------------------------------------------------------ */

function reviewAxis(ctx) {
  const out = [];
  for (const [, sceneShots] of ctx.byScene) {
    // 同一主体在对话中正面↔背后跳变
    const bySubj = new Map();
    for (const s of sceneShots) {
      const subj = camSubject(s.cut.cameraPosition);
      if (!subj) continue;
      const cp = String(s.cut.cameraPosition);
      const front = /正面|侧前|四分之三|平视正面|正面平视/.test(cp);
      const back = /背后|背面|过肩|越过肩膀/.test(cp);
      if (front || back) {
        if (!bySubj.has(subj)) bySubj.set(subj, []);
        bySubj.get(subj).push({ s, front, back });
      }
    }
    for (const [subj, arr] of bySubj) {
      const hasFront = arr.some((x) => x.front);
      const hasBack = arr.some((x) => x.back);
      if (hasFront && hasBack && arr.length >= 2) {
        out.push({
          category: '轴线', severity: 'medium',
          segId: arr[0].s.segId, cutIndex: arr[0].s.cutIndex,
          title: `主体「${subj}」正面↔背后跳变`,
          detail: '同一主体在对话里一会儿正面、一会儿背后，疑似越过 180° 轴线；若无明确的越轴调度，接在一起会跳轴。',
          evidence: arr.map((x) => `${x.s.segId}#${x.s.cutIndex + 1}(${x.front ? '正面' : '背后'})`).join('、'),
          suggestion: '核对这组正反打是否在同一侧拍摄；若越轴，补一个骑轴或移轴过渡镜。',
        });
      }
    }

    // 对视关系断裂：A 看对方，下一镜 B 却看向画面外/虚空
    for (let i = 0; i + 1 < sceneShots.length; i++) {
      const a = sceneShots[i], b = sceneShots[i + 1];
      const aLook = /对方|对方面部|对方脸|两人/.test(String(a.cut.eyeline || ''));
      const bVoid = VOID_EYELINE.has(String(b.cut.eyeline || '')) || /画面外/.test(String(b.cut.eyeline || ''));
      if (aLook && bVoid && !sameSubject(a.cut.cameraPosition, b.cut.cameraPosition)) {
        out.push({
          category: '轴线', severity: 'medium',
          segId: b.segId, cutIndex: b.cutIndex,
          title: '对视关系断裂',
          detail: '前一镜一方看向对方，后一镜另一方视线却指向画面外/虚空，回看缺失，正反打接不上。',
          evidence: `${a.segId}#${a.cutIndex + 1} eyeline="${a.cut.eyeline}" → ${b.segId}#${b.cutIndex + 1} eyeline="${b.cut.eyeline}"`,
          suggestion: '让回看的那一镜也落在对方脸上（eyeline=对方面部），或补一镜看清被看对象。',
        });
      }
    }

    // 画面左右跳变（同一主体在相机位描述里左/右互换）
    const lrBySubj = new Map();
    for (const s of sceneShots) {
      const subj = camSubject(s.cut.cameraPosition);
      if (!subj) continue;
      const cp = String(s.cut.cameraPosition);
      let side = null;
      if (/左侧|左前|左后|左边/.test(cp)) side = 'L';
      else if (/右侧|右前|右后|右边/.test(cp)) side = 'R';
      if (side) {
        if (!lrBySubj.has(subj)) lrBySubj.set(subj, []);
        lrBySubj.get(subj).push({ s, side });
      }
    }
    for (const [subj, arr] of lrBySubj) {
      if (arr.length >= 2 && arr[0].side !== arr[arr.length - 1].side) {
        out.push({
          category: '轴线', severity: 'low',
          segId: arr[0].s.segId, cutIndex: arr[0].s.cutIndex,
          title: `主体「${subj}」画面左右跳变`,
          detail: '同一主体在镜头里从左跳到右（或反之），疑似越轴或机位错乱。',
          evidence: arr.map((x) => `${x.s.segId}#${x.s.cutIndex + 1}(${x.side})`).join('、'),
          suggestion: '核对这几镜是否在同一侧拍摄，保持屏幕方向一致。',
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 检查 4：POV（主观视线落空）                                          */
/* ------------------------------------------------------------------ */

function reviewPOV(ctx) {
  const out = [];
  for (const [, sceneShots] of ctx.byScene) {
    for (const s of sceneShots) {
      const cam = s.cut.camera;
      const cp = String(s.cut.cameraPosition || '');
      const eye = String(s.cut.eyeline || '');
      // 只盯真正的 POV / 过肩镜：这类镜头观众是「透过角色眼睛看」，必须呈现所见
      const isPov = cam === POV || /主观|越过肩膀|过肩/.test(cp);
      if (!isPov) continue;

      // 主观视角隐藏脸
      if (s.cut.performance) {
        out.push({
          category: 'POV', severity: 'low',
          segId: s.segId, cutIndex: s.cutIndex,
          title: '主观视角隐藏表演',
          detail: '主观视角（POV / 过肩）会藏起表演者脸，但本镜写了 performance（有情绪要传），情绪可能落空。',
          evidence: `${s.segId}#${s.cutIndex + 1} camera=${cam} performance="${s.cut.performance}"`,
          suggestion: '在这镜之后接一镜该角色的反应（脸），把情绪接到观众看得到的地方。',
        });
      }

      // POV 看向具体物，却同场不呈现
      const isRelational = RELATIONAL_EYELINE.has(eye) || /对方|两人/.test(eye);
      const isVoid = VOID_EYELINE.has(eye) || /画面外/.test(eye);
      if (!isRelational && !isVoid && eye) {
        const target = eye;
        const shown = sceneShots.some((o) =>
          o !== s && (String(o.cut.focus || '').includes(target) || String(o.cut.frame || '').includes(target)
            || String(o.cut.cameraPosition || '').includes(target)));
        if (!shown) {
          out.push({
            category: 'POV', severity: 'medium',
            segId: s.segId, cutIndex: s.cutIndex,
            title: `视线指向「${target}」却未呈现`,
            detail: '这是主观/过肩镜（观众透过角色眼睛看），角色在看一个具体东西，但同场没有一镜呈现它，视线落空。',
            evidence: `${s.segId}#${s.cutIndex + 1} eyeline="${eye}"，同场无 focus/frame 含「${target}」`,
            suggestion: '让本镜焦点给到该物，或在邻近补一镜展示它（门缝、三楼窗、手中物等）。',
          });
        }
      }

      // POV 看向画面外/虚空，缺反打
      if (isVoid) {
        const reverse = sceneShots.some((o) =>
          o !== s && hasFaceFocus(o.cut.focus) && !sameSubject(o.cut.cameraPosition, s.cut.cameraPosition));
        if (!reverse) {
          out.push({
            category: 'POV', severity: 'low',
            segId: s.segId, cutIndex: s.cutIndex,
            title: `POV 视线指向画面外（${eye}）`,
            detail: '主观镜的视线落点在画外/虚空，但同场没呈现对应的反打或所见，观众看不到角色在看的什么。',
            evidence: `${s.segId}#${s.cutIndex + 1} eyeline="${eye}"，同场无反向呈现`,
            suggestion: '让本镜或邻近镜呈现被看之物/反打，否则改普通镜、把视线写实。',
          });
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 检查 5：反应镜                                                       */
/* ------------------------------------------------------------------ */

function reviewReaction(ctx) {
  const out = [];
  for (const [, sceneShots] of ctx.byScene) {
    // 情绪/特写高潮后缺反应镜（仅针对人：物件特写不需要反应镜）
    for (let i = 0; i + 1 < sceneShots.length; i++) {
      const a = sceneShots[i], b = sceneShots[i + 1];
      const aPerson = PERSON_RE.test(camSubject(a.cut.cameraPosition) || '');
      const aDrama = aPerson && !!a.cut.performance
        && (a.cut.size === 'close' || a.cut.size === 'extreme-close' || hasFaceFocus(a.cut.focus));
      const bSame = sameSubject(a.cut.cameraPosition, b.cut.cameraPosition);
      const bNoReaction = !b.cut.performance && !hasFaceFocus(b.cut.focus);
      if (aDrama && bSame && bNoReaction) {
        out.push({
          category: '反应镜', severity: 'medium',
          segId: b.segId, cutIndex: b.cutIndex,
          title: '情绪/特写高潮后缺反应镜',
          detail: '前一镜是带表演的近景/特写（情绪或动作高潮），后一镜仍是同一主体同向动作、没有谁被「击中」。',
          evidence: `${a.segId}#${a.cutIndex + 1}(表演/特写) → ${b.segId}#${b.cutIndex + 1}(同主体、无表演无脸)`,
          suggestion: '在后一镜插入对手或旁观者的脸/反应，让情绪有承接对象。',
        });
      }
    }

    // 对手戏：两方只有一方有脸（仅针对人）
    const subjects = new Set(sceneShots.map((s) => camSubject(s.cut.cameraPosition)).filter((x) => x && PERSON_RE.test(x)));
    const dialogic = sceneShots.some((s) => (s.cut.characters || []).length >= 1)
      && new Set(sceneShots.flatMap((s) => s.cut.characters || [])).size >= 2;
    if (dialogic) {
      for (const subj of subjects) {
        const subjShots = sceneShots.filter((s) => camSubject(s.cut.cameraPosition) === subj);
        const hasFace = subjShots.some((s) => hasFaceFocus(s.cut.focus));
        const otherFace = sceneShots.some((s) => camSubject(s.cut.cameraPosition) !== subj && hasFaceFocus(s.cut.focus));
        if (otherFace && !hasFace && subjShots.length >= 2) {
          out.push({
            category: '反应镜', severity: 'medium',
            segId: subjShots[0].segId, cutIndex: subjShots[0].cutIndex,
            title: `对手戏中「${subj}」无反应镜`,
            detail: '这场对手戏另一方有脸部特写，但「' + subj + '」全程没有一张脸被呈现，观众看不到它的反应。',
            evidence: `场 ${(subjShots[0].ep)}:${subjShots[0].sceneIndex} 中「${subj}」出镜 ${subjShots.length} 次，无 face-focus 切`,
            suggestion: `给「${subj}」至少一镜反应（脸/侧脸/表情）承接对手的戏。`,
          });
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 检查 6：主角在场                                                     */
/* ------------------------------------------------------------------ */

function resolveLead(board, opts) {
  if (opts.lead) return { code: opts.lead, name: opts.lead };
  const cast = opts.cast;
  const outline = opts.outline;
  // 1) cast.importance === 'protagonist'
  if (cast && Array.isArray(cast.characters)) {
    const p = cast.characters.find((c) => c.importance === 'protagonist');
    if (p) {
      const name = p.name;
      // 映射到 outline 的 C 编号
      const code = outline && outline.characters
        ? (outline.characters.find((c) => c.name === name) || {}).id
        : null;
      return { code: code || null, name };
    }
  }
  // 2) outline role 含 男主/主角/重生
  if (outline && outline.characters) {
    const p = outline.characters.find((c) => /男主|主角|重生者|protagonist/i.test(c.role || c.name || ''));
    if (p) return { code: p.id, name: p.name };
  }
  // 给了 cast/outline 却仍定位不到 → 显式 null，让审片层提示用户用 --lead
  if (cast || outline) return { code: null, name: null };
  // 什么都没给 → 默认按 C01 试一次（常见主角编号）
  return { code: 'C01', name: '主角' };
}

function reviewLeadPresence(ctx, lead, opts) {
  const out = [];
  if (!lead.code) {
    out.push({
      category: '主角在场', severity: 'low', cutIndex: null, segId: null,
      title: '无法定位主角编号',
      detail: '已提供 cast/outline 但找不到明确的 protagonist（cast.importance:"protagonist" 或 outline.role 含 男主/主角），无法确定主角编号。',
      evidence: `lead=${JSON.stringify(lead)}`,
      suggestion: '跑 review 时加 --lead C01（或你的主角编号），或在 cast 里标 importance:"protagonist"。',
    });
    return out;
  }
  const code = lead.code;

  for (const ep of ctx.board.episodes) {
    for (const seg of ep.segments) {
      const inFrame = (seg.cuts || []).some((c) => (c.characters || []).includes(code));
      if (inFrame) continue;
      // 是否关键/收尾段：有表演层 or 是集末段 or 有配乐
      const hasPerf = (seg.cuts || []).some((c) => c.performance);
      const isLast = seg === ep.segments[ep.segments.length - 1];
      const hasMusic = !!seg.music;
      const sev = (hasPerf || isLast || hasMusic) ? 'medium' : 'low';
      out.push({
        category: '主角在场', severity: sev,
        segId: seg.id, cutIndex: null,
        title: `${lead.name}（${code}）全程未入画`,
        detail: (hasPerf || isLast || hasMusic)
          ? '这段是情绪/收尾/有配乐的关键段，却整段没有主角在场，确认是否为有意留白（他人视角）。'
          : '这段没有主角在场，可能是他人视角或过渡，确认是否有意。',
        evidence: `${seg.id} 的 cuts 中 characters 均不含 ${code}`
          + (hasPerf ? '（含 performance）' : '') + (isLast ? '（集末段）' : '') + (hasMusic ? '（有 music）' : ''),
        suggestion: `若非有意，补一镜 ${lead.name} 的反应或存在；若是有意留白，可忽略。`,
      });
    }
  }

  // 全局：主角戏份占比
  const segs = ctx.board.episodes.flatMap((e) => e.segments || []);
  const withLead = segs.filter((s) => (s.cuts || []).some((c) => (c.characters || []).includes(code))).length;
  if (segs.length && withLead / segs.length < 0.6) {
    out.push({
      category: '主角在场', severity: 'low', cutIndex: null, segId: null,
      title: '主角戏份偏薄',
      detail: `全剧 ${segs.length} 段中仅 ${withLead} 段有主角在场（${Math.round((withLead / segs.length) * 100)}%），叙事重心可能分散。`,
      evidence: `withLead=${withLead}/${segs.length}`,
      suggestion: '确认这是群像开场还是主角线被稀释；重生/成长线通常主角应在多数关键段在场。',
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 编排                                                                 */
/* ------------------------------------------------------------------ */

function review(board, opts = {}) {
  const ctx = buildShots(board);
  ctx.board = board;
  ctx.opts = opts;

  const findings = [
    ...reviewHomogeneous(ctx),
    ...reviewCameraMotivation(ctx),
    ...reviewAxis(ctx),
    ...reviewPOV(ctx),
    ...reviewReaction(ctx),
  ];

  if (opts.cast || opts.outline || opts.lead) {
    const lead = resolveLead(board, opts);
    findings.push(...reviewLeadPresence(ctx, lead, opts));
    ctx.lead = lead;
  }

  // 排序：severity 高→低，再按 段号/切序
  findings.sort((a, b) => {
    if (SEV_RANK[a.severity] !== SEV_RANK[b.severity]) return SEV_RANK[b.severity] - SEV_RANK[a.severity];
    const sa = a.segId || '', sb = b.segId || '';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return (a.cutIndex ?? -1) - (b.cutIndex ?? -1);
  });

  const byCat = {};
  const bySev = {};
  for (const f of findings) {
    byCat[f.category] = (byCat[f.category] || 0) + 1;
    bySev[f.severity] = (bySev[f.severity] || 0) + 1;
  }

  return {
    source: board.source || '(未知剧)',
    totals: { segments: ctx.board.episodes.flatMap((e) => e.segments || []).length, cuts: ctx.shots.length },
    counts: { byCategory: byCat, bySeverity: bySev },
    lead: ctx.lead || null,
    findings,
  };
}

/* ------------------------------------------------------------------ */
/* 输出格式                                                             */
/* ------------------------------------------------------------------ */

function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function cutRef(f) { return f.segId ? `${f.segId}${f.cutIndex != null ? '#' + (f.cutIndex + 1) : ''}` : '—'; }

function toText(r) {
  const lines = [];
  lines.push(`审片报告 · 《${r.source}》`);
  lines.push(`镜头规模：${r.totals.segments} 段 / ${r.totals.cuts} 切`);
  const sev = r.counts.bySeverity;
  lines.push(`提示总数：${r.findings.length}（重点 ${sev.high || 0} / 建议 ${sev.medium || 0} / 提示 ${sev.low || 0}）`);
  if (r.lead) lines.push(`主角判定：${r.lead.name}（${r.lead.code || '未定位编号'}）`);
  lines.push('');
  const cats = [...new Set(r.findings.map((f) => f.category))];
  for (const cat of cats) {
    const fs = r.findings.filter((f) => f.category === cat);
    lines.push(`■ ${cat}（${fs.length}）`);
    for (const f of fs) {
      lines.push(`  [${SEVERITY[f.severity]}] ${cutRef(f)} ${f.title}`);
      lines.push(`      证据：${f.evidence}`);
      lines.push(`      建议：${f.suggestion}`);
    }
    lines.push('');
  }
  if (!r.findings.length) lines.push('未发现明显问题（仅限本 skill 的六类提示性检查）。');
  return lines.join('\n');
}

function toMarkdown(r) {
  const L = [];
  L.push(`# 审片报告 · 《${r.source}》`);
  L.push('');
  L.push(`- 镜头规模：**${r.totals.segments} 段 / ${r.totals.cuts} 切**`);
  const sev = r.counts.bySeverity;
  L.push(`- 提示总数：**${r.findings.length}**（重点 ${sev.high || 0} / 建议 ${sev.medium || 0} / 提示 ${sev.low || 0}）`);
  if (r.lead) L.push(`- 主角判定：${r.lead.name}（${r.lead.code || '未定位编号'}）`);
  L.push('');
  L.push('> 本 skill 只提示、不设门；所有结论均为导演视角的建议，不阻塞生成。');
  L.push('');
  const cats = [...new Set(r.findings.map((f) => f.category))];
  for (const cat of cats) {
    const fs = r.findings.filter((f) => f.category === cat);
    L.push(`## ${cat}（${fs.length}）`);
    L.push('');
    for (const f of fs) {
      L.push(`- **[${SEVERITY[f.severity]}] ${cutRef(f)} ${f.title}**`);
      L.push(`  - 证据：${f.evidence}`);
      L.push(`  - 建议：${f.suggestion}`);
    }
    L.push('');
  }
  if (!r.findings.length) L.push('未发现明显问题。');
  return L.join('\n');
}

function toHtml(r) {
  const sevBadge = { high: 'badge-high', medium: 'badge-med', low: 'badge-low' };
  let body = '';
  const cats = [...new Set(r.findings.map((f) => f.category))];
  for (const cat of cats) {
    const fs = r.findings.filter((f) => f.category === cat);
    body += `<section><h2>${esc(cat)} <span class="cnt">${fs.length}</span></h2>`;
    for (const f of fs) {
      body += `<div class="f ${sevBadge[f.severity]}">
        <div class="ft"><span class="sev">${SEVERITY[f.severity]}</span><span class="ref">${esc(cutRef(f))}</span><span class="ti">${esc(f.title)}</span></div>
        <div class="dt">${esc(f.detail)}</div>
        <div class="ev"><b>证据</b> ${esc(f.evidence)}</div>
        <div class="sg"><b>建议</b> ${esc(f.suggestion)}</div>
      </div>`;
    }
    body += `</section>`;
  }
  if (!r.findings.length) body = '<p class="none">未发现明显问题。</p>';
  const sev = r.counts.bySeverity;
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<title>审片报告 · ${esc(r.source)}</title>
<style>
  body{font-family:-apple-system,system-ui,'PingFang SC',sans-serif;max-width:920px;margin:24px auto;padding:0 18px;color:#1c1c1e;background:#fafafa}
  h1{font-size:22px;margin:0 0 4px}
  .meta{color:#666;font-size:14px;margin-bottom:18px}
  h2{font-size:17px;margin:22px 0 8px;border-left:4px solid #c8a04a;padding-left:8px}
  .cnt{color:#999;font-weight:400;font-size:14px}
  .f{border:1px solid #e4e4e7;background:#fff;border-radius:8px;padding:10px 12px;margin:8px 0}
  .ft{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
  .sev{font-size:12px;padding:1px 7px;border-radius:10px;color:#fff}
  .badge-high .sev{background:#d6453d}.badge-med .sev{background:#e0892b}.badge-low .sev{background:#3a8ec0}
  .ref{font-family:ui-monospace,monospace;font-size:13px;color:#444}
  .ti{font-weight:600}
  .dt{color:#444;margin:6px 0;font-size:14px}
  .ev,.sg{font-size:13px;color:#666;margin:3px 0}
  .ev b,.sg b{color:#333}
  .none{color:#777}
</style></head><body>
<h1>审片报告 · 《${esc(r.source)}》</h1>
<div class="meta">${r.totals.segments} 段 / ${r.totals.cuts} 切 · 提示 ${r.findings.length}（重点 ${sev.high || 0} / 建议 ${sev.medium || 0} / 提示 ${sev.low || 0}）${r.lead ? ' · 主角 ' + esc(r.lead.name) + '（' + esc(r.lead.code || '?') + '）' : ''}</div>
${body}
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--script') opts.script = argv[++i];
    else if (a === '--outline') opts.outline = argv[++i];
    else if (a === '--cast') opts.cast = argv[++i];
    else if (a === '--lead') opts.lead = argv[++i];
    else if (a === '--json') opts.json = true;
    else if (a === '--md') opts.md = true;
    else if (a === '--html') opts.html = true;
    else if (a === '--out') opts.out = argv[++i];
    else opts._.push(a);
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const args = opts._;
  // 兼容 `review <文件>` 与直接 `<文件>`
  const file = args[0] === 'review' ? args[1] : args[0];
  if (!file) {
    console.error('用法：node novel-director.mjs review <storyboard.json> [--script s] [--outline o] [--cast c] [--lead C01] [--json|--md|--html] [--out 文件]');
    process.exit(2);
  }
  const board = loadJson(file);
  const result = review(board, {
    script: loadJson(opts.script),
    outline: loadJson(opts.outline),
    cast: loadJson(opts.cast),
    lead: opts.lead,
  });

  let output;
  if (opts.json) output = JSON.stringify(result, null, 2);
  else if (opts.md) output = toMarkdown(result);
  else if (opts.html) output = toHtml(result);
  else output = toText(result);

  if (opts.out) {
    fs.writeFileSync(opts.out, output, 'utf8');
    console.error(`已写入 ${opts.out}`);
  } else {
    console.log(output);
  }
}

export {
  review, buildShots, toText, toMarkdown, toHtml,
  reviewHomogeneous, reviewCameraMotivation, reviewAxis, reviewPOV, reviewReaction, reviewLeadPresence,
  resolveLead, SIZE_ORDER, SEVERITY, STATIC, POV,
};

// 直接运行（非被测试 import）时启动 CLI
// 注意：技能通过软链安装，process.argv[1] 是软链路径，import.meta.url 是真实路径，
// 必须按 realpath 比较，否则经软链调用时 main() 不会执行。
try {
  const entryReal = fs.realpathSync(process.argv[1]);
  const thisReal = fs.realpathSync(new URL(import.meta.url));
  if (entryReal === thisReal) main();
} catch {
  // realpath 失败（极少见）时退化为原比较
  if (import.meta.url === `file://${process.argv[1]}`) main();
}
