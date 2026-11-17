[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.md)
[![English](https://img.shields.io/badge/English-8b1a1a?style=for-the-badge)](README.en.md)
[![日本語](https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.ja.md)
[![Follow on X](https://img.shields.io/badge/Follow-%40eternityspring-b07070?style=for-the-badge&labelColor=8b1a1a&logo=x&logoColor=f2e3e3)](https://x.com/eternityspring)

# novel-characters

Feed it a novel or a short story, and get a complete design bible for every character:

- **Cast list** — who appears, how central they are, with every name a character is called by folded into one person
- **Profile** — gender, age, standing, appearance, temperament, motivation, arc, relationships, each backed by **verbatim quotes from the source**
- **Design prompts** — bilingual image prompt + negative prompt + tags, ready for Midjourney / SD / GPT-Image. The look is not written into the prompt: the caller prepends one style instruction to the whole batch at generation time
- **Voice prompts** — timbre, pitch, pace, accent, emotion, plus a voice-design prompt for Qwen3-TTS / ElevenLabs Voice Design
- **A character model sheet** — **one per character**: a 16:9 image in three zones: an ID-photo-style bust on the left (~34%, the reference for the face design), a full-body turnaround top-right, and a strip of key-detail close-ups bottom-right. White background for clean cut-out. **This skill does not generate the image** — the instruction is the deliverable
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

## Upstream

In the pipeline the **outline sits upstream of the character bible**:

```
novel-outline    → outline.json (what: structure & episodes, who is in)
novel-characters → cast.json    (who: character assets)
```

If you have an `outline.json`, start with `seed` — its `characters` block already settles the roster:

```bash
node scripts/novel-characters.mjs seed outline.json > seed.json
```

What comes across is what the outline already decided (character id, name, tier, arc, which source characters were merged into this one); what is left blank is the work this layer owes (aliases, profile, design prompt, voice prompt). `tier` maps onto `importance`: `lead` → protagonist, `support` → supporting, `functional` → minor.

**Do not overturn the outline's tiers here**; if a tier looks wrong, go fix the outline. Splitting *within* the lead group is fine — `lead` covers leads plus the main antagonist, so `seed` assigns protagonist to all of them and you demote the non-leads to major using the `role` recorded in `seedNote`.

**It runs fine without one** — this skill does not depend on it. Skip `seed`, feed it a raw novel, and it builds the roster from the text itself.

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
{ "source": "…", "lang": "zh", "summary": "…", "characters": [ … ] }
```

So an external tool can edit it and **feed it straight back into `render`**, and it still passes `validate`. Each character keeps its `sheetImage` path, so you know which sheet belongs to whom — point `render --images <dir>` at wherever the generated sheets live and it picks them up (without the flag it looks in `images/` next to cast.json).

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
Three hard rules, all checked deterministically by a script rather than trusted to the model:

| Rule | Why |
| --- | --- |
| `evidence` must be a **verbatim, contiguous** span of the source | Stops invention. Dialogue split by a narration beat may not be stitched back together |
| Image prompts must **not contain character names** | Image models bias hard on names and will draw the character they remember instead of yours |
| **Language split** per field | Human-readable fields follow `--lang`, image and TTS prompts are always English — the model drifts otherwise |
| Structure and enums | `importance` is one of exactly four values |

None of these were written up front. Each one exists because real model output violated it and the validator caught it.

## Use the scripts directly

The helpers run fine without an agent — only the two model passes need one:

```bash
node scripts/novel-characters.mjs seed outline.json              # seed the roster from an outline, if you have one
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
- **Style stays out of the prompts.** It is a layer the downstream generator prepends to the whole batch at generation time. Pinning a look into every prompt used to suppress some drift, but it froze each prompt to one style and fought whatever the caller picked. Consistency across a cast is therefore the generator's problem; see `references/sheet.md`

## Files

```
SKILL.md                 the workflow the agent reads
scripts/
  novel-characters.mjs   chunk / merge / assemble / validate / render / slug
  selftest.mjs           329 assertions, never calls a model
references/
  roster-pass.md         pass 1: scanning for characters
  profile-pass.md        pass 2: building a character sheet (8 hard rules)
  schema.md              sheet structure and which language each field takes
  sheet.md               layout spec for the model sheet
  report-style.md        design conventions for report.html
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

329 assertions across chunking, alias merging, assembly, localization, validation, and rendering. No model calls, no quota, runs in about a second. Run it before anything else after touching the scripts.

**Only tested on macOS with Node 24.** There is no platform-specific code, so Linux and older Node releases should be fine, but that is **unverified**.
