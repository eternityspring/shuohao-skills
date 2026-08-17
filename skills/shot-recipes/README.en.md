[中文](README.md) · **English**

# shot-recipes

**A shot recipe library for generative AI video.** The premise is baked in: this is generative video (MiniMax H3, Kling) and not programmatic rendering — where a code-driven library writes frame counts and easing curves, this one writes **how to phrase the prompt, which reference images to hang, how many cuts to take, and where the model breaks**.

It fills the gap in the middle:

| Layer | Who owns it | The problem |
| --- | --- | --- |
| Vocabulary | Shot-size enum + the official H3 camera terms | Atoms, not recipes — the model combines them freely with no knowledge of *how this cut should be taken* |
| **Recipe + technique** | **This skill** | **Named shot vocabulary: intent / when to use it + prompt skeleton + parameters + known pitfalls — and it can be machine-audited** |
| Feel | Rules of thumb in a cutting guide | Spoken experience; whether it was used, and used correctly, cannot be checked |

## Two families of card

| Family | The question it answers | Categories | Count |
| --- | --- | --- | --- |
| **Recipe cards** | **How should this cut in this scene be taken** | dialogue / emotion / reveal / entrance / reaction / transition / emphasis / product / talking head | 17 (7 with example frames) |
| **Technique cards** | **What this device is, when to use it, and when not to** | camera move / angle / shot size / composition / lens & depth / lighting / special | 50 |

Chinese and English bodies · **useful well beyond short drama** (product promos, explainers, vlogs).

**Why they are not one family**: merged, the category axis would be saying two different things at once (function and device), and the category × energy matrix in the gallery would stop meaning anything. Each family gets its own chart.

## Completeness is a gate, not a claim

The failure mode a technique library dies of is "looks thorough, actually half missing". So every technique category declares a **domain**, each card claims the items it covers with `covers`, and **`lint` names any item nobody covered**:

| Category | Domain | Items |
| --- | --- | --- |
| Camera move | **all 20 official H3 camera terms, no exceptions** | 20 |
| Angle | eye level / low / high / overhead / worm's eye / dutch / over-shoulder | 7 |
| Shot size | extreme wide / wide / medium / close / extreme close | 5 |
| Composition | thirds / centered / frame-within-frame / foreground occlusion / symmetry / negative space / leading lines | 7 |
| Lens & depth | wide / normal / telephoto compression / shallow focus / deep focus | 5 |
| Lighting | backlit silhouette / side / top / under / practical source / high key / low key | 7 |
| Special | dolly zoom / oner / slow motion / freeze frame / time lapse / jump cut | 6 |

**"This library covers camera movement" is now something you check, not something anyone claims.** The gallery lays each domain out item by item; a greyed, hatched item is one nobody has written yet.

![Shot recipe library report](assets/report.webp)

## What a card looks like

Machine fields live in the frontmatter; the body is six fixed sections, one set per family:

```
Recipe card                      Technique card
## Intent                        ## What it is        drawn against what it is confused with
## Prompt skeleton               ## When to use it ★  which scene / where / what mood + when NOT to
## Parameters                    ## How to prompt it
## Reference-image constraints   ## Parameters
## Known pitfalls                ## Known pitfalls
## Examples                      ## Examples
```

**The "how it feels when you tune it" column is where the value sits** — a default value alone says nothing; the card has to say what happens when you push the knob up, down, and past the point where it breaks.

**A technique card's "when to use it" must contain a "when not to use it" block, and that is gated.** Write only when to use something and readers will over-use it, so `lint` looks for that marker verbatim and fails without it. The same reasoning puts the section ahead of the prompt: **a device without "when to use it" is dead knowledge.**

## Must-have phrases: the only machine-enforced part

Each card declares at most three must-have phrases — English phrases that are **true of every cut in that recipe**. Once a storyboard references the card, a checker verifies cut by cut that the phrases actually made it into the prompt.

Six hard constraints (`lint` enforces each):

| Constraint | Why |
| --- | --- |
| At most 3 | More phrases make the recipe more expensive to adopt, and an optional thing that gets expensive stops being used at all |
| Lowercase | Both sides are lowercased before comparison, so casing never causes a false failure |
| Contains a space or hyphen, at least 6 characters | A single generic word gets matched as a substring: `wide` lives inside `extreme wide shot`, so a card declaring it would pass falsely on an extreme wide |
| **Never collide with the 20 H3 camera terms or the 5 shot-size phrases** | Those already have gates of their own, and those gates look in a different place (one at the `[Shot k]` passage, one at `frame`) — the same word judged twice passes in one place and fails in the other |
| **Must appear verbatim, on one line, inside the card's own prompt skeleton** | The skeleton is there to be copied; what you copy has to pass `check` as-is. Wrapping a phrase across two lines for layout leaves it visible to the eye and invisible to the matcher — we hit this for real |
| **Must carry a Chinese gloss** (`must_phrases_zh`) | The phrase itself can never be translated — it gets copied verbatim into the prompt, and one changed letter and the gate stops recognising it. But a whole index of English phrases is unusable to a Chinese reader, so the gloss lives in its own column, one per phrase, and **the same phrase must be glossed identically on every card**. The gloss only shows in the Chinese UI |

The fourth constraint states the reason this library exists: **a recipe only describes what the official vocabulary cannot** — the foreground shoulder, shallow depth of field, handheld feel, a silhouette that survives an orbit, the light ratio across a threshold.

## CLI

```bash
node scripts/shot-recipes.mjs list                       # index table (both families)
node scripts/shot-recipes.mjs list --kind technique      # technique cards only
node scripts/shot-recipes.mjs list --kind recipe         # recipe cards only
node scripts/shot-recipes.mjs list --for product         # filter by subject (drama/product/talking-head/vlog)
node scripts/shot-recipes.mjs list --category camera-move # filter by category
node scripts/shot-recipes.mjs search over-the-shoulder # search names and bodies
node scripts/shot-recipes.mjs show ots-shot-reverse --lang en   # print a full card
node scripts/shot-recipes.mjs lint                     # library self-check
node scripts/shot-recipes.mjs check <storyboard.json>  # audit recipe references in a storyboard
node scripts/shot-recipes.mjs render --html --lang en > references/cards/gallery.html
```

Write the report into `references/cards/` — example frames are referenced relatively as `frames/…`, so anywhere else and the images do not resolve.

## The gallery report

A single page, zero external resources, double-click to open — the same visual language as the other five reports in this repo. Reports render with a Chinese UI by default; pass `--lang en` for a fully English one.

- **Category × energy matrix** (the signature chart, recipe cards): 9 category rows × 5 energy columns, and **an empty cell is a vocabulary gap** — you can see at a glance what the library is missing
- **Recipe card wall**: two columns, each card carrying chips (category / energy / seconds / cuts / subjects), example frames (click to zoom; an honest placeholder when not generated), **must-have phrases that copy on click**, and the six body sections in a collapsible block
- **Technique coverage**: all seven domains laid out item by item, **a greyed hatched item being one nobody has written yet**; hover to see which card covers it. The score on the right (`20 / 20`) turns red the moment anything is missing
- **Technique card wall**: same as the recipe wall, with an extra row of `covers` chips in the header — which domain items this card claims
- **Must-have phrase index**: phrase → cards that declare it → count, so collisions surface immediately. The Chinese UI adds a gloss column; the phrase column is always the English original, since that is what gets copied
- **Coverage** (only with `--check`): how often each card is used, **and which cards were never used** — no pretending the library is thriving
- **Export JSON**: downloads a snapshot of the whole library (machine fields + parsed sections)

## Self-contained — copy the directory anywhere

This directory **depends on no other skill**. Card bodies reference no external document; the image-generation contract, the card-writing discipline and the report conventions all live in its own `references/`; the scripts have zero dependencies and use only the Node standard library. **Copy `shot-recipes/` into another repo and it works.**

- The demo data is its own: `examples/vocab-reel.json` — ***The Letter Back***, a small northern Chinese city in 1995, one story carrying the whole vocabulary across **2 people / 3 spaces / 3 props / 36 cuts**. Every example frame was generated from that reel — **nothing is borrowed from another skill's sample**
- Where cards say "character sheet" or "scene sheet" they mean whatever reference images you already have; no particular image tool is assumed
- The 20 camera terms and 5 shot-size phrases are **this library's own copy** of the constants, with the source noted — nothing is imported across directories

The next section covers the optional integration with `novel-storyboard` in the same repo — **the library runs fine without it**.

## Hooking it onto a storyboard

Put `"recipe": "<card id>"` on a cut, then:

```bash
node scripts/shot-recipes.mjs check <storyboard.json>
```

`check` walks any JSON, collecting **objects that carry both `recipe` and `frame`**, and uses the JSON path as the locator — so it eats any storyboard shape. Chinese prompts are skipped and counted rather than reported as a wall of false failures.

The `novel-storyboard` skill in this repo can optionally mount the same library with `--shots <this dir>/references/cards`; without the flag its gate says so and skips. Neither skill depends on the other.

## How the two languages are organised

**Machine fields exist once** (the frontmatter of `cards/<id>.md`, language-neutral); bodies are per language — Chinese in the same file, English in `cards/en/<id>.md`. With `--lang en` the body comes from the English file, falling back to Chinese with a visible marker. The checker only ever reads the single set of machine fields, so the two languages cannot drift apart.

## Adding a card

```bash
node scripts/shot-recipes.mjs lint
```

Field structure is in `references/card-schema.md`, writing discipline in `references/card-pass.md`. **The bar is not the format**: the `## Examples` section has to point at a storyboard fragment you actually shot or a frame you actually generated — if you cannot, it is not a recipe yet, it is an idea.

## Attribution

The card **format** (one-liner / when to use / intent / a parameter table with a "how it feels" column / known pitfalls) is learned from the open-source project [video-shotcraft](https://github.com/Vincentwei1021/video-shotcraft), which targets programmatic rendering with Remotion. **All content here is this repo's own generative practice**: their parameters are frame counts and easing curves, ours are seconds, cut counts, blur strength and reference-image hookups. The methodology is internalized into this skill's own references — **it depends on no external skill**.

**Only tested on macOS + Node 24.**
