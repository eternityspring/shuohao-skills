---
id: negative-space
---

## What it is

The subject occupies a small part of the frame and the rest is left empty: fog, water, sky, a white wall, a plain backdrop. **The difference from thirds is quantity**: thirds moves the subject aside and hands over two thirds so the eye has somewhere to travel; negative space pushes the emptiness past seventy percent until the emptiness is the subject.

The one-line test: **the empty part is clearing a path for the eye, that is thirds; the empty part is itself the meaning — solitude, smallness, waiting, loss — and it is negative space.**

**This card carries a rule no other composition card needs: the model hates emptiness.** Its training data contains almost nothing that is largely nothing, so whatever you clear out, it will helpfully fill — a bird, a distant boat, a tree, a passer-by, an unexplained patch of light. **Half the work of prompting negative space is stopping it from filling, and that is the most valuable thing on this card.**

## When to use it

- **Solitude and smallness.** A figure occupying a fraction of a fog bank, a snowfield, an empty room. The audience does not read "they are there", they read "only they are there".
- **Waiting and loss.** Hold on the empty frame after someone leaves. Two extra seconds of nothing lands harder than any close reaction.
- **Closing a scene.** After the emotional peak, cut to one empty frame and let the audience digest it themselves — the cheapest emotional settlement available in short-form drama.
- **Layout needs in talking head and product.** The cleared side takes the title, the subtitle band, the spec list. Composition and layout solved in one pass.
- **The best negative space available in 9:16**: push the figure into the bottom third and hand the top two thirds entirely to sky, fog or wall.

**When not to use it**:

- **Not in a driving sequence.** Negative space is a pause; two in a row and the whole scene's rhythm falls out.
- **Not when the cut carries information.** Who is where, what happened, what is on the table — emptiness and information are natural enemies.
- **Not in a cluttered location.** A market, a room stacked with things. Ask for emptiness and the model simply shrinks the clutter; nothing gets cleared.
- **Not on short cuts.** Emptiness needs time to be read; under 3s it is wasted entirely.

## How to prompt it

One cut is the norm. The emptiness has to be written as a material, never as "empty".

```
wide shot, who the subject is, how small they are, where they sit（e.g. bottom
third, slightly left）, large empty area in the frame（what the emptiness is made
of: even gray fog / flat still water / a plain wall, and how much of the frame）,
nothing else enters that empty area（name and negate the three or four things this
location would most likely grow: no boats, no birds, no people, no buildings）,
even light
```

- **Write the emptiness as a material, not as absence.** `an even sheet of gray fog`, `flat still water`, `a plain white wall` are all things the model can paint. `empty space` and `nothing` give it no target, so it improvises.
- **Negate item by item.** `no boats, no birds, no people, no buildings` — one of the very few places in this library where negative phrasing is mandatory. `nothing else enters that empty area` on its own is not enough; name the three or four things this specific location would most likely grow.
- **The smaller the subject, the harder you pin size and position.** "A tiny figure" comes back mid-sized. `the figure occupies about one tenth of the frame height` comes back tiny.
- **In 9:16, empty the top and bottom, never the sides.** A vertical frame is already narrow, so lateral emptiness carries no weight. The standard build is the figure in the bottom third with sky, fog or wall filling the top two thirds — and the subtitle lands neatly in the empty band between, solving composition and layout at once.
- **The `[Shot k]` passage must state that almost nothing moves.** Leave it out and the model finds itself something to do in the emptiness: wind gets up, ripples spread, a bird crosses.
- **`Static Shot` by default.** `Pull Out` grows the emptiness and is the most sympathetic move for this card, but the newly revealed edges are exactly where the model is most likely to plant something — keep the travel short.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Empty share | 70% of frame | 50%–90% | 50% is just loose framing; 70% starts to carry feeling; past 90% the subject is so small the audience cannot find them at a glance |
| Subject's share of height | one tenth | 1/20 – 1/4 | Smaller reads smaller in every sense; below 1/20 the model smears the figure into a dot and the face is gone beyond rescue by reference sheets |
| Evenness of the empty material | very even | even – slightly graded | Evener is stronger and easier for the model to invade; a slight grade (fog density, a sheen on the water) lowers the fill rate at the cost of one notch of impact |
| Number of negations | 3–4 | 2–6 | Under 2 will not hold it; past 6 the model starts treating the negated nouns as instructions, and `no birds` produces birds |
| Seconds per cut | 5s | 3–8s | Emptiness needs reading time; under 3s it is wasted; past 8s the audience assumes the video has frozen |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Filled in | A bird, a distant boat or a tree materialises in the cleared area | Negate the three or four things this location would grow; write the emptiness as a material rather than "empty" |
| Subject inflation | You asked for one tenth and got a figure filling half the frame | Give the share as a number (`one tenth of the frame height`) and pin the extent of the surrounding emptiness too |
| Patterned void | The even fog or wall develops mysterious markings, light patches, gradients | Add `even tone, no texture, no gradient, no light patches` |
| Backfire | You wrote `no birds` and got birds | Keep negations to four or fewer, and convert the one you fear most into a positive (`only flat gray fog above the waterline`) |
| Squeezed vertical | You emptied the sides in 9:16 and the subject is a strip down the middle with no weight | Switch to top-and-bottom emptiness with the subject in the bottom third |

## Examples

*The Letter Back* R32: a wide with the son small in the bottom left corner, perched on the edge of a wooden chair, while the upper right three quarters go to bare cracked white plaster above the wainscot. Nothing else enters that empty area for the whole cut; the round table is clipped by the bottom edge. The window is off frame to the left, giving flat daylight. Five seconds, locked off.

Two moves are worth stealing. **The emptiness is written as a material** — not "negative space" but "cracked white plaster", so the model has something specific to paint and stops hunting for filler. **And the negation is explicit**: "nothing else enters that empty area" is its own clause, which is where half the value of this card lives. The proportions clear the bar as well — three quarters empty, the figure confined to one corner. That is past the thirds range; here the emptiness is the line.

Example frame not generated.
