---
id: side-light
---

## What it is

The source sits off to one side, half the face is lit, half falls away into shadow, and a visible terminator runs between them. **The difference from front light is how much it says**: front light flattens a face so the audience sees it clearly and learns nothing else. Side light splits the face in two, and the audience reads "there are two sides to this person" without being told.

The one-line test: **want the audience to see the person, front-light them; want the audience to sense they are holding something back, side-light them.**

The most useful thing on this card has nothing to do with lighting and everything to do with wording: **asking for "side light" barely works; asking for "10 a.m. window light from the left" works immediately.** To the model, `side light` is a style tag attached to wildly mixed material. "Ten in the morning, through the window on the left" maps onto thousands of real photographs in its training set, and direction, hardness and color temperature all arrive together. **Any light position you can express as a time of day, express as a time of day.**

## When to use it

- **The one who is withholding, in a dialogue scene.** Give the honest party something close to frontal and the evasive one a side key; the ratio argues the subtext without a line of dialogue.
- **One person alone, thinking, near a window.** Window side light is the default answer for this beat and needs no justification.
- **Talking head that should look shot rather than recorded.** A window 30° off the front is the cheapest upgrade there is, far better than an overhead room light.
- **Surface texture on a product.** Leather, wood grain, weave, brushed metal — **side light is the only position that renders texture**, and front light flattens all of it.
- **Time-of-day phrasings worth stealing verbatim**: 10 a.m. window light (hard, cool); 4 p.m. low sun (warm, long shadows); evening light through a door at the end of a corridor (soft, unmistakably directional).

**When not to use it**:

- **Not on a talking head meant to feel warm and trustworthy.** Half a face in shadow reads as "this person is not saying everything", which is a net negative for a pitch or an introduction.
- **Not on group scenes.** A row of half-lit faces each demands its own reading and the audience cannot keep up.
- **Not for a hard side key on a vertical close-up.** On a phone the shadow half collapses into a black slab and you have deleted half a face.
- **Never side light and backlight in the same cut.** Two directions and the model scatters terminators all over the face until it stops holding together.

**On ratio, to be clear**: the ratio this card talks about is **how many stops separate the two halves of one face**. The library's `door-threshold` card owns a phrase about light differing between two spaces — a different measurement entirely. That phrase belongs to that card; this one does not use it.

## How to prompt it

One to three cuts. Direction has to stay fixed across the scene, and it has to be restated in every cut — not just the first.

```
medium shot, light comes from one side（which side, and from what: 10 a.m. daylight
through the window on the left / low 4 p.m. sun / a lamp at the end of the corridor）,
shadow side keeps detail（the dark half still shows features — it is not a black slab）,
which part of the face the lit half covers, which way the nose shadow falls,
background brightness and color temperature (e.g. 5600K cool daylight)
```

- **A clock time beats a term.** `10 a.m. window light from the left` sits on top of a mountain of real photographs; `side light` gets treated as a mood word.
- **Fix the direction once and never flip it** — and repeat it word for word in every cut. State it only in the first and by the third the light has walked to the other side.
- **The nose shadow is the acceptance test.** Which way it falls says exactly where the key is; write it in and the direction stops drifting.
- **Give color temperature as a number.** `3200K`, `5600K` genuinely land in a prompt. Ask for "warm light" and you get an orange filter over the whole plate.
- Default `Static Shot`; give `Push In` to the cut where the temperature rises.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Ratio across the face | 2 stops | 1–4 | One stop looks like front light; past four the shadow half is simply gone and you are in `low-key` territory, not side light |
| Key position | 45° front-left | 90° full side – 30° off front | Closer to full side is harder and more dramatic; closer to frontal is flatter and safer. At a true 90° on a vertical frame you have half a usable face |
| Detail left in shadow | features still visible | features visible – edge contour only | Turning it down buys mood, but the model grows beards, scars and moles inside anything it cannot see |
| Color temperature | 5600K daylight | 3200K – 6500K | 3200K is indoor tungsten warmth, 5600K is daylight, past 6500K skin goes blue. Put the number in the prompt |
| Seconds per cut | 3s | 2–5s | Bigger ratios survive less time; at four stops past 4s the features in the shadow half wander all the way through |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Split face | The terminator lands like a knife down the bridge of the nose and the halves stop belonging together | Drop to two stops, and `shadow side keeps detail` must be present |
| Flipped key | The light comes from the left in one cut and the right in the next | Restate the direction verbatim in every cut, not just the first |
| Orange wash | You asked for a "warm side light" and the whole image went orange | Use a number (3200K) and say only the source is warm while the background stays neutral |
| Grown features | Beards, scars and moles appear on the shadow half that were never in the design sheet | Raise shadow detail to "features still visible" — the model invents inside anything too dark to see |
| Flattened | You asked for side light and got even frontal light | Rewrite as a clock time plus a physical source (window, door gap, desk lamp) instead of "side light" |

## Examples

*The Letter Back*, R27: the red enamel flask and the white enamel mug standing side by side on the round table, a single hard source at ninety degrees from the left drawing a line of glaze down both bodies; the shadow half still shows the chips in the enamel and the worn red rim rather than going black. Close, 3s, locked off.

Both required phrases are present, and the cut spends this card on objects rather than on a face — **side light is the only position that renders texture**, and anything frontal would have flattened the glaze and the dents together.

Two things worth noticing. First, **the ratio runs to three stops, one above this card's default.** A face cannot take that; enamel can. There are no features on it to lose, and the shadow half only has to keep the chips. Second, **no face in *The Letter Back* is ever side-lit.** The key indoors is the bare bulb over the round table, and that sits overhead, not off to one side. Side light appears exactly once in this film, and it appears in order to describe two surfaces.

Example frame not generated.
