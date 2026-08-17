[中文](README.md) · **English**

# novel-characters

Feed it a novel or a short story, and get a complete design bible for every character:

- **Cast list** — who appears, how central they are, with every name a character is called by folded into one person
- **Profile** — gender, age, standing, appearance, temperament, motivation, arc, relationships, each backed by **verbatim quotes from the source**
- **Design prompts** — semi-realistic painterly direction, bilingual image prompt + negative prompt + style tags, ready for Midjourney / SD / GPT-Image
- **Voice prompts** — timbre, pitch, pace, accent, emotion, plus a voice-design prompt for Qwen3-TTS / ElevenLabs Voice Design
- **A character model sheet** — **one per character**: a 16:9 image in three zones: an ID-photo-style bust on the left (~34%, the reference for the face design), a full-body turnaround top-right, and a strip of key-detail close-ups bottom-right. White background for clean cut-out, generated through codex's built-in image tool (optional)
- **Relationship map** — a whole-cast view inside the report: who is tied to whom, and how. Hover a character to light up every link they are part of, click to jump to their profile

Outputs `cast.json`, a Markdown report, and a self-contained `report.html` you can just double-click.

**Any output language**, Chinese by default:

```
/novel-characters ./book.txt --lang en
/novel-characters ./book.txt --lang ja
```

Chinese, English and Japanese UI strings ship built in. **Other languages work too** — the skill translates the UI labels on the fly into the target language and stores them in `cast.json` under `ui`, so French, Korean or Spanish reports come out fully localized rather than half-English.

![report.html](assets/report.webp)

A character model sheet (Shen Zhiwei, from the bundled sample story):

![model sheet](assets/sheet.jpg)

## Use

For installation see the [repository README](../../README.en.md). Then:

```
/novel-characters ./your-novel.txt
```

Or just say "break this book down into characters" and give it the path.

### Report language

Chinese by default. Use `--lang`, or just ask in words:

```
/novel-characters ./book.txt --lang en
/novel-characters ./book.txt --lang ja
```

Chinese, English and Japanese UI strings ship built in. **Any other language works too** — the skill translates the UI labels into the target language on the fly and stores them in `cast.json` under `ui`, so French, Korean or Spanish reports come out fully localized rather than half-English.

Two things never follow the language: **image and TTS prompts stay English** (those engines work best that way), and **source quotes stay in the original language** (translate them and they stop being evidence).

### Image style

`realistic` by default (semi-realistic painterly). For an animation look:

```
/novel-characters ./book.txt --style ghibli
```

| id | What it is |
| --- | --- |
| `realistic` | Semi-realistic painterly — skin with pores and texture, fabric with weave and wear. Default |
| `ghibli` | Ghibli-like hand-painted cel — even ink linework, a single soft shadow tone, flat colour |

They combine: `--lang ja --style ghibli`.

```bash
node scripts/novel-characters.mjs styles          # list all presets
node scripts/novel-characters.mjs styles ghibli   # dump one in full
```

**Switching style swaps the whole set**, not just one line — each preset carries its own rendering clause, surface treatment, lighting, negative prompt and tags. See [`references/style-presets.md`](references/style-presets.md).

## What the report looks like

A three-column workbench: search on top, synopsis plus a prominence-ordered cast list on the left, one character at a time in the main area.

The **relationship map** sits at the top of the left rail and takes over the main area. Its edges come straight from each character's `relationships` — no extra model pass:

- Edges resolve by **name *and* alias**, so a relationship written as "老伯" still lands on 老周's node
- Two one-directional accounts of the same pair collapse into one edge, keeping both wordings
- Each chord carries a short label (6 characters, full text in the tooltip and the side list). Labels get noisy on a large cast, so they are on by default up to 14 edges and off above that, with a toggle in the header
- Hover a character to light up every link they are part of, hover a row to isolate one link, click either to open that character

The circular layout is computed in Node and written straight into inline SVG — **no libraries**, so report.html stays a single file you can open offline.

### Export JSON

The **Export JSON** button in the top bar downloads exactly the `cast.json` shape — not some separate export format:

```json
{ "source": "…", "lang": "zh", "style": "realistic", "summary": "…", "characters": [ … ] }
```

So an external tool can edit it and **feed it straight back into `render`**, and it still passes `validate`. Each character keeps its `sheetImage` path (`images/<slug>-sheet.png`), so you know which sheet belongs to whom.

The data is embedded as `<script type="application/json">`; exporting just wraps it in a Blob and downloads it — **no network request**.

## How it works

Feeding a long text into one context window loses characters, so it runs in two passes:

**Pass 1 — scan** (cheap model)
The text is split on paragraph boundaries into overlapping 40k-character chunks. Each chunk is scanned in parallel for character names, aliases, concrete description, and verbatim quotes. The overlap is what keeps a character introduced right at a chunk seam visible to both sides.

**Merge**
Names and aliases are indexed together, so different forms of address across chunks converge onto one person. Where exact matching cannot reach (「陆」 and 「陆行远」 share no key), the script lists containment-based `mergeCandidates` for the model to review; confirmed merges are applied deterministically from a merges.json. Characters are ranked by how many chunks mention them — that ranking is the proxy for screen time.

**Pass 2 — profile**
Only the top N characters (**30 by default**) get a full sheet, built from every observation merged for them. Each one is told the names of its siblings in the same cast, so their looks and voices don't collapse into each other. Ethnicity, era and region are inferred from the source and written explicitly into the image prompts — **they do not follow `--lang`**. Rendering the report in Japanese does not turn a Republican-era Chinese ferryman into a Japanese man.

**Validate** (never skipped)
Four hard rules, all checked deterministically by a script rather than trusted to the model:

| Rule | Why |
| --- | --- |
| `evidence` must be a **verbatim, contiguous** span of the source | Stops invention. Dialogue split by a narration beat may not be stitched back together |
| Image prompts must **not contain character names** | Image models bias hard on names and will draw the character they remember instead of yours |
| **Language split** per field | Human-readable fields follow `--lang`, image and TTS prompts are always English — the model drifts otherwise |
| **Style matches its negative prompt** | `realistic` must not ban `photorealistic`, `ghibli` must — get it backwards and the whole batch is wasted |
| Structure and enums | `importance` is one of exactly four values |

None of these were written up front. Each one exists because real model output violated it and the validator caught it.

## Use the scripts directly

The helpers run fine without an agent — only the two model passes need one:

```bash
node scripts/novel-characters.mjs chunk book.txt /tmp/wk        # split
node scripts/novel-characters.mjs merge /tmp/wk                 # merge roster-*.json, with merge candidates
node scripts/novel-characters.mjs merge /tmp/wk --apply m.json   # apply reviewed merges
node scripts/novel-characters.mjs assemble /tmp/wk --source Book # combine card-*.json into cast.json, prominence-ordered
node scripts/novel-characters.mjs validate cast.json book.txt   # validate
node scripts/novel-characters.mjs render cast.json --html       # build report.html
node scripts/novel-characters.mjs slug "胡二爷"                  # filesystem-safe name
```

## Limits

- Caps at 24 chunks (~930k characters net of overlap) per run. Beyond that it reports `truncated` explicitly — it does **not** silently drop the tail
- Human-readable fields follow `--lang`; image and TTS prompts are **always English**, since those engines work best that way regardless of report language
- The top 30 characters by prominence are profiled by default, and **every one of them gets a sheet** — one call per character, so this is the slowest step on a large cast. Ask for a smaller number, or for leads only, if you want it shorter
- **Art style can still vary across a cast**, since each character is generated independently. It used to drift badly under the old "flat vector cartoon" wording — one run produced anime-ish, semi-realistic and ink-wash results side by side. The explicit style presets fixed most of that, but not all of it. Feeding the first sheet back as a reference helps; see `references/sheet.md`

> ⚠️ **If you have more than one codex installed, mind the version.** An older one fails outright with `requires a newer version of Codex` instead of degrading. The skill probes for the highest version it can find; if yours is simply old, run `npm i -g @openai/codex`.

## Files

```
SKILL.md                 the workflow the agent reads
scripts/
  novel-characters.mjs   chunk / merge / assemble / validate / render / slug
  selftest.mjs           316 assertions, never calls a model
references/
  roster-pass.md         pass 1: scanning for characters
  profile-pass.md        pass 2: building a character sheet (8 hard rules)
  schema.md              sheet structure and which language each field takes
  sheet.md               the codex contract for model-sheet generation
  report-style.md        design conventions for report.html
  style-presets.md       image style presets (realistic / ghibli)
examples/
  渡口.txt                bundled short story, 4 characters
  渡口-cast.json          its output, doubling as the validation fixture
  渡口-cast.md            rendered result, a quality baseline
```

In `examples/渡口.txt` the peddler is only ever referred to by a nickname and the ferryman is addressed once as "old uncle" — the story exists specifically to exercise alias merging.

## Self-test

```bash
node scripts/selftest.mjs
```

316 assertions across chunking, alias merging, assembly, localization, validation, and rendering. No model calls, no quota, runs in about a second. Run it before anything else after touching the scripts.

**Only tested on macOS with Node 24.** There is no platform-specific code, so Linux and older Node releases should be fine, but that is **unverified**.
