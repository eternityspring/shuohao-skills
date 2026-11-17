[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.md)
[![English](https://img.shields.io/badge/English-8b1a1a?style=for-the-badge)](README.en.md)
[![日本語](https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.ja.md)
[![Follow on X](https://img.shields.io/badge/Follow-%40eternityspring-b07070?style=for-the-badge&labelColor=8b1a1a&logo=x&logoColor=f2e3e3)](https://x.com/eternityspring)

# novel-staging

Opening staging for every scene of an AI short drama: when the scene opens, which thing each person in it stands or sits by, sitting or standing, and which way they face.

**Why a separate step**: every segment of a short drama is generated on its own, and each one decides for itself who sits where. Six people round a long table: the first segment adds five nameless guests, the third has someone pouring wine in the lead's clothes. The storyboard hands the blocking on from segment to segment word for word, but the **first** segment of each scene made its sentence up. So before the storyboard, each scene gets a staging, and the storyboard copies it.

- **Read the picture first** — the things people stand by or sit on, read off the scene picture's main view (4–20 of them) and placed on a top view. People stand only by what the picture really has: a dais the prompt mentions but the picture never drew puts someone on it differently in every clip
- **Then place people** — who is there when the scene opens and who comes in later; sitting or standing as the script has it; elders in the seat of honour, opponents across the table, the shunned at the far end; no extras unless the script names a crowd
- **The program writes the blocking sentence** — "胡二爷 sits on the third bench row, facing north; every other seat is empty and nobody else is there." The storyboard's first segment of the scene copies it
- **The report can be edited** — a top view per scene: drag people, click one to set sitting or standing and facing, export the result as a new staging.json

**The default deliverable is the interactive `staging-report.html` tool report.** Open it in a browser, drag people, adjust posture and facing, and export the edited JSON. `staging.json` is also saved as working data; Markdown is an optional `--md` export. The report UI defaults to Chinese; `render --lang en` gives an English UI (the blocking sentences then use the English names given when reading the picture).

![staging-report.html with English UI](assets/report-en.jpg)

## Quality gates: 8, all code

| Gate | Rule |
| --- | --- |
| Picture read | 4–20 things per place |
| Things well formed | Unique names; valid top-view boxes; picture boxes when read off a picture |
| Places resolved | Every scene's place has been read (checked against art.json when given) |
| Cast | Each person exactly once; checked against script.json when given, and **says so when not** |
| There or not | Everyone marked there or not at the opening; someone is there |
| **At things read off the place** | People stand at things in the reading; only things one can sit or stand on take "on"; side, posture and facing valid |
| Nobody on one spot | Two people on the same side of the same thing are spread along it |
| Extras | A whole number; where they are is said when there are some |

Every gate has a test case that breaks it.

## The report: a top view you can drag

- Drag a person anywhere on the plan; on release they land on the nearest side of the nearest thing, or on it if it is a seat. Moved to another side, they turn to face the thing
- Below the plan is the tray of those not there at the opening: drag in to bring them in, drag back to take them out
- Click a person to set sitting or standing and one of eight facings
- Extras up or down, and where; the blocking sentence and the scene's checks update live
- With a scene picture, hovering a thing lights its box on the picture
- Changes are kept in the browser across reloads; "Export JSON" downloads the edited staging.json, which `validate` takes back as is

The page runs the same code as the command line: landing spots, points on the plan, sentences and checks all come from `stagingCore()`, embedded whole.

## Where it sits in the pipeline

```
novel-outline    → outline.json  (names)
novel-art        → art.json      (places + scene pictures)
novel-script     → script.json   (who is in each scene, what happens)
novel-staging    → staging.json  (who is where when each scene opens)
novel-storyboard → storyboard.json
```

- `seed <script.json> --art <art.json> --outline <outline.json>` fills in places, scenes and cast deterministically
- novel-storyboard does not read staging.json by itself yet: `blocking` prints each scene's opening sentence for the storyboard's first segment of the scene

## Command line

```bash
node scripts/novel-staging.mjs seed script.json --art art.json --outline outline.json > staging.json
node scripts/novel-staging.mjs validate staging.json --script script.json --art art.json
node scripts/novel-staging.mjs checkup staging.json                 # gates only
node scripts/novel-staging.mjs render staging.json > staging-report.html  # HTML by default
node scripts/novel-staging.mjs render staging.json --lang en > staging-report.html # English UI
node scripts/novel-staging.mjs render staging.json --md > staging.md # optional text export
node scripts/novel-staging.mjs blocking staging.json --lang en       # each scene's opening blocking
```

## Self-test

```bash
node scripts/selftest.mjs
```

99 assertions: top-view geometry, landing spots, sentences, seed, each of the 8 gates broken one by one, rendering (both UIs, escaping, pictures), and a rebuild of the embedded code from its own source to check it matches the command line. No model calls, under a second.

**Tested on macOS + Node 24 only.** Nothing platform-specific in the code, but Linux and older Node are **not verified**.
