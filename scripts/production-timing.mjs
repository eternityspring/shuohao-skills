// New Studio jobs use content-derived estimates; saved legacy jobs retain their timing contract.
import { computeStats } from '../skills/novel-script/scripts/novel-script.mjs';
export const CONTENT_FIRST = 'content-first';
export const contentFirst = options => options?.planningMode === CONTENT_FIRST;
export function planningPolicy(options) {
  if (!contentFirst(options)) return '';
  return `CONTENT-FIRST PLANNING OVERRIDE: Episode count and seconds in options are optional ROUGH ESTIMATES, never requirements or budgets. Infer the genre when unspecified. Read and preserve the complete source, all meaningful events, dialogue, motivations and ending. Choose the number of episodes and scenes from natural story boundaries, with sufficient setup, performance, reaction, atmosphere and payoff. You may exceed any supplied episode/time estimate. Do not shorten, accelerate, omit details or add filler to match a number. Quality means purposeful, coherent detail, not gratuitous length. Estimate duration AFTER writing the full content; the server calculates script estimates. Every approved outline episode must be scripted and storyboarded. Storyboard timing follows physically readable action and dialogue, not the script estimate or desired total. Keep technical clip limits (3–5s shots, <=15s segments), full beat coverage, dialogue fit, character DNA and shot continuity. Split into as many segments/calls as necessary; never truncate content to fit one response. This policy overrides any fixed episode-count or total-duration examples in references.`;
}
export function prepareTiming(stage,doc,options) {
  if (!contentFirst(options) || !['outline','script'].includes(stage)) return doc;
  doc.params={...doc.params,timingMode:CONTENT_FIRST};
  if (stage==='script') for (const ep of doc.episodes || []) {
    const seconds=computeStats({...doc,episodes:[ep]}).episodes[0].est;
    ep.estimatedSeconds=seconds;
    ep.targetSeconds=seconds; // Kept for existing report/export consumers; this is an estimate.
  }
  return doc;
}
