[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.md)
[![English](https://img.shields.io/badge/English-8b1a1a?style=for-the-badge)](README.en.md)
[![日本語](https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.ja.md)
[![Follow on X](https://img.shields.io/badge/Follow-%40eternityspring-b07070?style=for-the-badge&labelColor=8b1a1a&logo=x&logoColor=f2e3e3)](https://x.com/eternityspring)

# novel-art

Art bibles for **AI short-drama production**: scenes + narrative props. The premise is baked in: **generated, not filmed** — no location scouting, no set building, no prop sourcing. Environments and props are assets that must be regenerated dozens of times and still look like the same thing, so the deliverable is a consistency plan.

**Scenes**: design intent, consistency anchors (3–5 per scene — viewers recognize the place by them, QC checks shots against them), lighting states (a time-of-day change is a **regeneration, not a relight**), and a variant mechanism (`variantOf` + `changes`, generating against the parent's sheet).

**Props** (narrative props only — close-ups, cross-episode, plot-bearing; typically 3–8 per show): dramatic function first, **state variants** (a suitcase closed and open are two references), a **scale reference** written into every prompt (AI loves rendering a handheld prop at furniture size), and **white-background, no-hands plates** — prop references get composited into shots, and a hand holding the prop is the classic contamination. Set dressing stays in scene anchors; one-off hand props are handled at shot level — neither gets its own asset.

Outputs `art.json`, a Markdown report, and a self-contained `art-report.html`. Reports render with a Chinese UI by default; pass `--lang en` for a fully English report (or set a top-level `"lang": "en"` in art.json — `--lang` wins). Image prompts are always English either way: In English mode the quality-gate labels are translated too (thresholds kept as computed); failing-gate details and all data stay as authored.

![art-report.html](assets/report.webp)

## The quality gates are code

Same stance as the other two skills: **a checklist the model grades itself on is worthless.** Ten deterministic gates — anchors 3–5 (scenes and props alike), lighting states ≥1 per scene, people banned in negatives everywhere, all prompts English, no character names (checked with `--cast`, explicitly reported as skipped without it), variant references complete, plus four prop-specific gates: **states ≥1**, **scale phrase present in prompts**, **hands banned in negatives**, **pure white background in the sheet**. The selftest defeats every gate on purpose.

## The three-skill relay

```
novel-outline    → outline.json (what: structure & episodes)
novel-characters → cast.json    (who: character assets)
novel-art        → art.json     (where & what they hold: art assets)
```

`seed <outline.json>` prefills both the scene list and the prop list deterministically, carrying over the episodes each one appears in and the beats it serves; if the outline has no `props`, the prop list is left empty and the model extracts it from the text per `prop-pass.md`. `validate --cast` cross-checks prompts against the character roster. Surface wording is environment-flavoured rather than the character skill's skin detail. The rendering style is not written into prompts at all — the caller prepends it at generation time.

## CLI

```bash
node scripts/novel-art.mjs seed outline.json > art.json
node scripts/novel-art.mjs validate art.json --cast cast.json
node scripts/novel-art.mjs checkup art.json
node scripts/novel-art.mjs render art.json --html             # Chinese report UI (default)
node scripts/novel-art.mjs render art.json --html --lang en   # English report UI
```

## Sheet layout spec

**This skill does not generate images.** The deliverable is `image.sheet` — a complete layout
instruction for whatever generates the image downstream, where the model, the style and the
aspect get chosen. None of those three can be answered at this layer.

One per scene and per prop, both using the **master-view + L-shaped detail border** layout
(bottom and right edges). Scene details = anchor close-ups; prop details = anchor close-ups +
other states + a side profile. Scenes are empty of people; props additionally ban hands and sit
on pure white for clean cut-out. A variant's instruction says to reference the parent's sheet.
Full spec in `references/sheet.md`.

## Selftest

```bash
node scripts/selftest.mjs
```

151 assertions — seeding, gate-defeating cases for all 10 gates, rendering (zh/en report UI), export. No model calls, runs in about a second.

**Only tested on macOS + Node 24.**
