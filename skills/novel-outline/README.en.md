[中文](README.md) · **English**

# novel-outline

Feed it a novel plus target parameters, and get a five-piece short-drama adaptation outline:

- **Adaptation notes** — one-line core, keep/cut/merge tables, risk plans, and decision conclusions (`cutNote` "this means…" / `mergeNote` lead-roster rationale), with key decisions backed by **verbatim quotes from the source**
- **Cast table** — tiered by asset weight: leads ≤ 5, named supporting ≤ 10, functional roles ≤ 10 (a face, not a name — labelled by function), each carrying a **← change record** (who they map to in the book, who got merged in)
- **Beat table** — major/minor beats pinned to episodes, gaps ≤ 3 episodes, no dead zones
- **Per-episode synopses** — three mandatory fields per episode: synopsis + hook + suspense; narrative prose only, quoted dialogue counts as out of scope
- **Asset list** — **computed by script, never hand-written by the model**: scene/character usage, reuse plans for one-off scenes, production-risk warnings

Outputs `outline.json`, a Markdown report, and a self-contained `outline-report.html`:

![outline-report.html](assets/report.png)

## The quality gates are code

The core stance of this skill: **a checklist the model grades itself on is worthless.** All 13 gates are deterministic checks in `validate`, not prose for the model to read — per-tier cast caps (leads 1–5, supporting ≤ 10, functional ≤ 10), a primary-scene cap that **scales with episode count** (4 + ⌈episodes/10⌉ clamped to 5–15 — tuned for AI production, where scenes are generated and the cap guards consistency assets rather than set-building money), reuse plans for one-off scenes, beat gaps, episode-1 hook, major-beat timing, three-fields-per-episode, crowd-scene plans, risk keywords flagged, reference integrity (no jobless characters, no unused scenes, no dangling IDs), and no quoted dialogue in synopses.

Why tiers instead of one flat cap: a flat cap conflates *who the audience must remember* with *how many consistent faces production must maintain*. The lead cap guards screen time and memory; the support/functional caps guard **AI character-asset cost** — and the asset list converts tiers into workload automatically (leads → full model sheets, supporting → bust references, functional → prompt-only). Unnamed extras stay off the table entirely. Functional roles legitimately have no arc — the doctor is there to stitch a wound.

Thresholds are parameters (`params.thresholds`), not constants — different platforms want different beat cadences. The selftest **defeats every single gate on purpose** to prove each one actually blocks.

## The most valuable rule in the flow

The skeleton (cut lines / merge characters / place beats) ships as a **quick draft for sign-off first** — which lines died, who got merged, which episode carries the big payoff. Only after the user nods does episode writing begin, and that's enforced as a stage gate (`validate --stage beats`), not a promise. Episodes are then written in batches of ≤ 10; writing 60 in one go always collapses in the back half.

## The report

A single-page, 1600px-wide review document — everything laid flat and Cmd+F-able:

- **KPI band**: episodes, beats, tiered cast, primary scenes, production risks, adaptation mode — six stat tiles up front
- **Beat rhythm**: chart/table tabs — the story timeline by default (filled majors, lighter minors, **dead gaps annotated right on the axis**, rust-red past the threshold, wrapping every 20 episodes), one click to the detail table
- **Per-episode cards** in three columns, first three shown by default with a fade-out and an expand button; each card carries beat capsules, hook/suspense fields, and scene/cast/risk tags
- **Scene overview**: one card per scene — ghost episode numbers top-right, a presence strip, beats carried, cast seen or the reuse plan
- **Key decisions**: the three sign-off items on paper — which lines were cut (with a "this means…" conclusion), who got merged (cast-slot counts and the lead roster are **computed**), and where the major beats land (auto-listed from the beat table, first/final tagged)
- **Dispatch matrix**: characters and scenes on one grid — read a column top-to-bottom and you have that episode's requirements
- **Asset conversion**: cast tiers, scene environments, and production risks converted into prep workload — all computed
- **Quality gates**: header badge, a failure banner when anything fails, and the full ✓/✗ list at the end — baked in by the script
- **Export JSON** downloads `outline.json` verbatim — edit and feed it straight back into `render` / `validate`
- All graphics are inline SVG/CSS with a validator-checked palette; zero external resources, opens offline

## Checkup mode

Have an outline already and just want a diagnosis?

```bash
node scripts/novel-outline.mjs checkup outline.json
node scripts/novel-outline.mjs render outline.json --html > outline-report.html
```

Failing gates don't block rendering — showing the problems is the point.

## Long texts

An 800k-character novel doesn't fit in context. `chunk` splits by chapter headings into volumes (15 chapters each by default), each volume summarised concurrently, then merged. Caps at 60 volumes and reports `truncated` explicitly — it never drops the tail silently. Key decisions must point back at the source (`keep[].evidence`, verbatim) — **no inventing content from the title**.

## Relationship to novel-characters

novel-characters owns character design (profiles, image/voice prompts, model sheets); novel-outline owns adaptation structure (cutting, merging, beat placement, episodes). If you have a `cast.json`, feed it in as character raw material. This skill writes no dialogue, no storyboards, no generation prompts.

## Selftest

```bash
node scripts/selftest.mjs
```

200 assertions — chunking, validation, gate-defeating cases, asset aggregation, rendering, export. No model calls, runs in about a second.

**Only tested on macOS + Node 24.**
