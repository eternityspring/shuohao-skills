#!/usr/bin/env node
/**
 * novel-director 自测：不调模型、不花额度。
 * 每个启发式各有一个触发用例 + 一个零触发用例。
 */
import { review, resolveLead } from './novel-director.mjs';

let pass = 0, fail = 0;
const ok = (cond, msg) => {
  if (cond) { pass++; }
  else { fail++; console.error('  ✗ ' + msg); }
};

/* ---------------- 夹具构造 ---------------- */

const CUT_DEF = {
  beats: [1, 1], seconds: 3, size: 'medium', camera: 'Static Shot',
  characters: [], props: [], frame: '', shot: '', lens: '50mm',
  cameraPosition: '年轻男子 + 平视正面', composition: '三分法',
  eyeline: '对方面部', focus: '锁定面部', stability: 'stable',
  performance: '', hold: '',
};

function cut(o) { return { ...CUT_DEF, ...o }; }
function seg(id, sceneIndex, cuts, extra = {}) {
  return { id, sceneIndex, cuts, blocking: '', soundscape: '', ...extra };
}
function board(segments) {
  return { source: 'FIX', aspectRatio: '16:9', episodes: [{ ep: 1, segments }] };
}

const CAST = { characters: [{ name: '刘诚', importance: 'protagonist' }] };
const OUTLINE = { characters: [{ id: 'C01', name: '刘诚' }] };

/* ---------------- 1. 同质镜 ---------------- */

(function homogeneous() {
  // 4 切连续同签名（景别/机位主体/构图全同）+ 全静态 → 窗口 1 + 整段 1
  const b = board([seg('E01-01', 1, [
    cut({ size: 'medium', camera: 'Static Shot', cameraPosition: '年轻男子 + 平视正面', composition: '三分法' }),
    cut({ size: 'medium', camera: 'Static Shot', cameraPosition: '年轻男子 + 平视正面', composition: '三分法' }),
    cut({ size: 'medium', camera: 'Static Shot', cameraPosition: '年轻男子 + 平视正面', composition: '三分法' }),
    cut({ size: 'medium', camera: 'Static Shot', cameraPosition: '年轻男子 + 平视正面', composition: '三分法' }),
  ])]);
  const r = review(b, {});
  const n = r.findings.filter((f) => f.category === '同质镜').length;
  ok(n === 2, `同质镜 应触发 2（窗口+整段），实际 ${n}`);
})();

/* ---------------- 2. 运镜动机 ---------------- */

(function cameraMotivation() {
  const seg1 = seg('E01-01', 1, [
    cut({ size: 'wide', camera: 'Push In', performance: '', cameraPosition: '年轻男子 + 平视正面' }),           // 远景无表演
    cut({ size: 'medium', camera: 'Push In', performance: '', cameraPosition: '年轻男子 + 平视正面后退' }),      // 推 vs 后退
  ]);
  const seg2 = seg('E01-02', 2, [
    cut({ size: 'medium', camera: 'Shake Strongly', performance: '', cameraPosition: '年轻男子 + 平视正面', frame: '他站着' }), // 滥用晃动
    cut({ size: 'medium', camera: 'Tracking Shot', performance: '', cameraPosition: '年轻男子 + 平视正面' }),
    cut({ size: 'medium', camera: 'Push In', performance: '', cameraPosition: '年轻男子 + 平视正面' }),
  ]); // seg2 全运动 → 整段无静帧
  const r = review(board([seg1, seg2]), {});
  const n = r.findings.filter((f) => f.category === '运镜动机').length;
  ok(n === 4, `运镜动机 应触发 4（远景无表演/矛盾/晃动/整段无静帧），实际 ${n}`);
})();

/* ---------------- 3. 轴线 ---------------- */

(function axis() {
  const b = board([seg('E01-01', 1, [
    cut({ cameraPosition: '年轻男子 + 平视正面', eyeline: '对方面部' }),       // front
    cut({ cameraPosition: '年轻男子 + 背后平视', eyeline: '对方面部' }),       // back → 正面↔背后
    cut({ cameraPosition: '民警 + 左侧平视', eyeline: '画面外' }),             // 对视断裂(接上) + 左
    cut({ cameraPosition: '民警 + 右侧平视', eyeline: '对方面部' }),           // 右 → 左右跳变
  ])]);
  const r = review(b, {});
  const n = r.findings.filter((f) => f.category === '轴线').length;
  ok(n === 3, `轴线 应触发 3（正面↔背后/对视断裂/左右跳变），实际 ${n}`);
})();

/* ---------------- 4. POV ---------------- */

(function pov() {
  const b = board([seg('E01-01', 1, [
    cut({ camera: 'POV', performance: '盯着不放', eyeline: '对方面部' }),         // 主观隐藏脸
    cut({ camera: 'POV', cameraPosition: '年轻男子 + 主观视角', eyeline: '三楼窗户', performance: '' }), // 看物未呈现
  ])]);
  const r = review(b, {});
  const n = r.findings.filter((f) => f.category === 'POV').length;
  ok(n === 2, `POV 应触发 2（主观隐藏脸/看物未呈现），实际 ${n}`);
  // 普通镜（非 POV）看向某物不应触发
  const b2 = board([seg('E01-01', 1, [
    cut({ camera: 'Static Shot', cameraPosition: '年轻男子 + 平视正面', eyeline: '三楼窗户', performance: '' }),
  ])]);
  const r2 = review(b2, {});
  ok(r2.findings.filter((f) => f.category === 'POV').length === 0, '普通镜看向某物不应触发 POV');
})();

/* ---------------- 5. 反应镜 ---------------- */

(function reaction() {
  const seg1 = seg('E01-01', 1, [
    cut({ size: 'close', performance: '下颌绷着', focus: '锁定年轻男子面部', cameraPosition: '年轻男子 + 平视正面', characters: ['C01'] }),
    cut({ cameraPosition: '年轻男子 + 平视正面', performance: '', focus: '锁定手部', characters: ['C01'] }), // 缺反应
  ]);
  const seg2 = seg('E01-02', 2, [
    cut({ cameraPosition: '年轻男子 + 平视正面', focus: '锁定面部', characters: ['C01'] }),
    cut({ cameraPosition: '民警 + 平视正面', focus: '锁定上半身', characters: ['C07'] }),
    cut({ cameraPosition: '民警 + 平视正面', focus: '锁定手部', characters: ['C07'] }), // 民警无脸
  ]);
  const r = review(board([seg1, seg2]), {});
  const n = r.findings.filter((f) => f.category === '反应镜').length;
  ok(n === 2, `反应镜 应触发 2（高潮后缺反应/对手戏一方无脸），实际 ${n}`);
})();

/* ---------------- 6. 主角在场 ---------------- */

(function lead() {
  const mk = (chars, perf, extra = {}) => cut({ characters: chars, performance: perf, ...extra });
  const segs = [
    seg('E01-01', 1, [mk(['C07'], '下颌绷着')]),          // 无主角 + 有表演 → medium
    seg('E01-02', 2, [mk(['C07'], '')]),                  // 无主角 + 无表演 + 非末段 → low
    seg('E01-03', 3, [mk(['C01'], '')]),
    seg('E01-04', 4, [mk(['C01'], '')]),
    seg('E01-05', 5, [mk(['C01'], '')]),
  ];
  const r = review(board(segs), { cast: CAST, outline: OUTLINE });
  const n = r.findings.filter((f) => f.category === '主角在场').length;
  ok(n === 2, `主角在场 应触发 2（medium/low），实际 ${n}`);
  ok(r.lead && r.lead.code === 'C01', `主角编号应解析为 C01，实际 ${r.lead && r.lead.code}`);
})();

/* ---------------- 零触发（clean） ---------------- */

(function clean() {
  const b = board([
    seg('E01-01', 1, [cut({ characters: ['C01'] })]),
    seg('E01-02', 2, [cut({ characters: ['C01'] })]),
    seg('E01-03', 3, [cut({ characters: ['C01'] })]),
  ]);
  const r = review(b, { cast: CAST, outline: OUTLINE });
  ok(r.findings.length === 0, `clean 应零触发，实际 ${r.findings.length}: ${r.findings.map(f => f.category + '/' + f.title).join('; ')}`);
})();

/* ---------------- resolveLead 退化路径 ---------------- */

(function leadFallback() {
  const b = board([seg('E01-01', 1, [cut({ characters: ['C99'] })])]);
  // 给了 cast 但里面没有 protagonist → 解析不到编号
  const r = review(b, { cast: { characters: [{ name: '路人', importance: 'minor' }] } });
  const f = r.findings.find((x) => x.category === '主角在场' && x.title.includes('无法定位'));
  ok(!!f, 'cast 无 protagonist 时应给「无法定位主角编号」提示');
})();

/* ---------------- 输出格式 ---------------- */

(function formatters() {
  const b = board([seg('E01-01', 1, [
    cut({ size: 'wide', camera: 'Push In', cameraPosition: '年轻男子 + 平视正面' }),
  ])]);
  const r = review(b, {});
  ok(JSON.stringify(r).includes('运镜动机'), 'JSON 输出含分类');
  ok(typeof r.findings[0].severity === 'string', 'finding 含 severity');
})();

console.log(`\nnovel-director 自测：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
