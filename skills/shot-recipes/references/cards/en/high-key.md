---
id: high-key
---

## What it is

The whole frame sits bright, the ratio is small, the shadows are shallow and soft, and even the darkest area still holds detail. **The distinction that matters most is between this and overexposure**: high key lifts the shadows while the highlights keep their texture. Overexposure kills the highlights, flattening fabric folds and skin texture — that is a mistake, not a style.

The one-line test: **want the audience to breathe out, go high key; want them held tight, go low key (see `low-key`).** The two cards are a pair, and choosing between them sets how a whole passage breathes rather than expressing a taste in brightness.

**On ratio, to be clear**: these two cards talk about how many stops separate light from shadow **inside a single frame**. The library's `door-threshold` owns a phrase about light differing between two spaces — a different measurement. That phrase belongs to that card; neither of these two uses it.

## When to use it

- **The default for talking head and product.** Clean, credible, nothing being hidden — high key hands you all three at once with no extra design work.
- **Memory and fantasy passages.** Lift a whole sequence and let it play against low-key present-day material; the audience knows the timeline changed without being told.
- **Comedy and light everyday scenes.** A small ratio keeps every face legible, so the cutting can be fast and the audience still keeps up.
- **E-commerce and unboxing.** Materials and colors land closest to the truth under high key — the kind of truth that keeps return rates down.
- **A natural fit for vertical.** Shadow gradation is unreadable on a phone anyway, and high key does not depend on shadows. It is the lighting card that survives a small screen best.

**When not to use it**:

- **Not for suspense, threat or night.** High key lays everything out for the audience, which fights head on with the idea that something is being withheld.
- **Not on an emotional cut that needs the audience locked onto one face.** A flat ratio spreads attention evenly, nothing stands out, and the feeling has nowhere to land.
- **Do not treat it as the low-effort option.** It is the least forgiving light there is for skin blemishes, hands and background clutter — everything is lit, so everything is visible, and AI hands get caught under high key faster than anywhere else.
- **Not cutting straight into a low-key passage.** A three or four stop jump between adjacent cuts outruns the eye and the cut point reads as a mistake.

## How to prompt it

One to three cuts. If a whole passage is high key, copy the lighting clause verbatim into each of them.

```
medium shot, bright even light throughout（where the brightness comes from: diffuse
light through a large window on an overcast day / bounce off a full white wall —
name it, do not just write "high key"）,
shadows stay soft and open（shallow shadows with soft edges; detail survives even
at the darkest point）, background brightness (half a stop above the subject /
near white but not pure white）, what separates subject from background
(clothing color, a faint shadow behind them, a contour line）,
color temperature (5600K neutral daylight), texture retained in the brightest areas
```

- **The hard part of high key is not brightness, it is separation.** Both sides are lit, so the figure sticks to the wall. You need another handle: a color difference, a soft shadow at the feet or behind the shoulder, a faint contour line.
- **Do not write overexposed or blown out.** Those words instruct the model to kill the highlights and hand you the "dead white" row of the pitfalls table.
- **Naming the source beats naming the style**: "diffuse light through a big window on an overcast day" is well represented in the model's material; `high key lighting` is treated as a mood tag.
- **Write a white background as "near white, not pure white".** Pure white and the model eats the subject's edges — hair and shoulder line go first.
- **High key is not the same as even.** There still has to be one brightest point on the face, with the key slightly off to one side. Skip that clause and the face goes grey and lifeless.
- Default `Static Shot`; product cuts can take `Push In`.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Ratio | 1 stop | half – 2 stops | At half a stop there is no modelling at all and the face reads as a sticker; past two you have ordinary normal lighting and the high-key tone is gone |
| Background brightness | half a stop above subject | level with subject – 1.5 stops above | Let the background drop below the subject and the clean feeling evaporates; past 1.5 stops the subject's edges get eaten, hair first |
| Shadow depth | shallow | very shallow – medium | Very shallow removes all structure from the face; medium is already conventional lighting. This knob has less usable travel than it looks |
| Separation device | color difference | color / soft shadow / contour line | Brightness difference cannot do the work here, so pick another; using all three at once looks contrived — choose one and pin it |
| Color temperature | 5600K | 4500K – 6500K | Past 6500K skin goes blue and morgue-like; below 4500K it warms, and too warm turns high key into dusk |
| Seconds per cut | 3s | 2–6s | Small ratio, small drift — high key survives long cuts better than any other light in the library |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Stuck to the wall | Subject and background both bright; the figure reads as a sticker | Give the subject a definite color difference, or add a soft shadow at the feet or behind them |
| Dead white | Whole areas of highlight with no detail; fabric folds flattened out | Cut overexposed / blown out; write "texture retained in the brightest areas" |
| Grey face | The frame is bright but the face is dull and lifeless | High key is not even light. State that one point on the face is brightest and the key sits slightly off axis |
| Magnified flaws | Skin, hands and background clutter all exposed; finger counts visible at a glance | High key hides nothing by design. Clean up the background, keep hands out of frame, or park them in a defocused foreground |
| Morgue skin | Color temperature drifts past 6500K and the subject looks laid out on a slab | Write 5600K as a number and add that the skin tone is warm |

## Examples

*The Letter Back*, R31: daytime by the window, the bare bulb switched off, flat daylight flooding through the blue glass, the son sitting close to the sill and facing the lens; barely a stop between the lit and shadow sides of his face, cracked white plaster and pale green wainscot bright and low in contrast together, the white enamel mug on the sill catching the light. Medium, 4s, locked off.

Both required phrases are there, and the brightness is given a source — not `high key` but "flat daylight through the blue glass window". **The better lesson is how the cut becomes high key: not by adding light but by changing the source.** This is the only frame in the film that says the bulb is off, and with the warm key withdrawn the whole ratio collapses with it.

Separation gets answered here too. Wall lit, subject lit, so brightness difference is off the table; the prompt writes plaster and wainscot alike as bright and low-contrast, and the only thing left to lift the figure off the wall is the dark blue work jacket the art baseline gave him. That is the "colour difference" setting in the parameter table — one separation device, picked and pinned, not all three.

One more thing to note: **R18 runs four stops, R31 under one, and two whole sequences sit between them.** That is not an accident. It is the "not cutting straight into a low-key passage" rule in practice: eleven cuts of the letter and the objects, plus a piece to camera in R30, are what give the audience's eyes time to make the jump.

Example frame not generated.
