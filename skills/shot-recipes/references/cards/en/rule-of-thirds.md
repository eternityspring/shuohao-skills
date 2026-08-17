---
id: rule-of-thirds
---

## What it is

Cut the frame into thirds each way, put the subject on a line or an intersection, and give the two remaining thirds to the side they face. **The difference from centred framing is not taste, it is direction**: centred says "this, and nothing else"; thirds says "they are looking at, or walking toward, something outside the frame" — and the two thirds you gave away are where that something lives.

The one-line test: **subject has a look direction or a travel direction, use thirds; subject is the end of the line with nowhere to go, use centre.**

What this card is really about is not the rule itself but **how to translate "rule of thirds" into words a model obeys**. Write `rule of thirds` in a prompt and the model ignores it. Write "the figure stands in the left third, their eyes sit on the upper third line, the right two thirds hold nothing but fog" and it complies. Every section below is that translation.

## When to use it

- **Someone heading for a place outside the frame.** Chasing, hurrying, fleeing. Park them on one side and hand the travel direction its two thirds — the audience reads "not there yet", not merely "walking".
- **The single in a dialogue scene.** Speaker on the left, empty on the right, and that empty is where the listener is. Swap sides on the reverse and the spatial relationship survives the cut intact.
- **Layout cuts for talking head and product.** Presenter or product off to one side, the other side reserved for the title, the subtitle band, the spec overlay. This is thirds earning its keep outside drama.
- **Cutting to the listener after a hard line.** Listener off to one side, gaze out toward the speaker. Those two empty thirds play "I have no answer" better than any expression does.

**When not to use it**:

- **Not when the subject talks straight at the lens with nobody off-frame.** An offset with no direction behind it reads as a framing mistake; centre it instead.
- **Not in a symmetrical location.** The end of a corridor, a head-on product board, a cabin with benches down both sides — nudge it off centre and it is not composed, it is crooked.
- **Not at extreme close size.** When the face fills the frame the third lines mean nothing; that cut is governed by eye height, not subject position.
- **Not forced onto the vertical thirds in 9:16.** The two vertical lines sit only a third of the frame width from the edge, and shoulders and arms pushed onto them get eaten by platform safe areas.

## How to prompt it

One cut is the norm. Pin the position; never write "composed on the rule of thirds".

```
medium shot, the subject stands in the left or right third（name which side）,
eyes on the upper third line（eye height sits on the upper horizontal third）,
open space on the side they face（two thirds of the width left open on the
facing side — name what fills it）, what the subject is doing, background and light
```

- **Keep the words "rule of thirds" out of the prompt.** That is vocabulary for humans, not coordinates for a model. Spell out the placement: subject in the left third, eyes on the upper third line, two thirds open on the right.
- **The open side must be named.** Say only "leave space" and the model fills it with a passer-by, a tree, a boat. State what those two thirds contain — fog, flat water, an empty corridor, a plain wall — and the fill rate drops off a cliff.
- **In 9:16, switch to horizontal thirds.** The safe vertical build is a slight offset only, with the eyes pinned to the upper third line and the open space handed to the bottom third (where subtitles land) or the top third (sky, wall). The vertical third lines are really only useful in 9:16 for product and overlay layouts.
- **The `[Shot k]` passage carries the action and the look direction only.** Placement belongs in the still prompt. State it twice and the model treats it as two demands, and the position drifts more, not less.
- **Moving cuts need one extra clause.** A `Tracking Shot` alongside a walker slowly slides them back to the middle; add "the open space stays on the direction of travel" or it will not hold.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Subject's horizontal position | a third in from the edge | 1/4 – 2/5 of frame width | Nearer the edge reads as "more to come"; inside 1/4 the model starts hauling them back and two renders land differently |
| Eye height | upper third line | 1/4 of frame height to the midline | Higher makes the figure smaller and the place heavier; on the midline it turns into centred framing and the direction evaporates |
| Open share | two thirds of the width | 1/2 – 3/4 | Half is just loose framing; two thirds starts to carry feeling; past 3/4 you want the negative-space card instead |
| Elements in the open side | 1–2 distant elements | 0–3 | Fully empty is strongest and the easiest for the model to invade; more than three is not open space, it is background clutter |
| Seconds per cut | 3s | 2–5s | Under 2s nobody registers which side the subject sits on; over 5s a still offset frame turns stuffy |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Snap to centre | You asked for the left third and the figure stands dead middle | Drop "rule of thirds", write `the subject stands in the left third of the frame`, and name what fills the open side |
| Filled space | A passer-by or a tree turns up in the two thirds you cleared | Pin the open side's contents (`only fog and flat water on the right side`) and state that nobody else is there |
| Backward gaze | The figure sits left of frame but looks left, nose almost against the edge | Give the look direction its own clause, always toward the open side — position and gaze are always a pair |
| Cropped in 9:16 | Shoulders and arms get trimmed in the delivered vertical | Keep the subject off the vertical third lines in 9:16 and use horizontal thirds instead |
| Drift | The subject slides from the third back to the middle within one cut | Add "the open space stays on the direction of travel"; if that fails, fall back to `Static Shot` |

## Examples

*The Letter Back* R16: a medium of the father alone on the right third, turned left toward the son who never enters the picture, eyes on the upper third line. The whole left two thirds go to cracked white plaster above the wainscot and the cold blue window, with a white enamel mug at his elbow. Four seconds, locked off.

**The open side is named**, not merely reserved — cracked plaster and a cold window, two things, spelled out, so the model has nothing to invent there. And because the son is genuinely off-frame, the offset reads as a man talking to someone outside the picture rather than a framing slip: those two thirds are where the son is. This is thirds doing its most ordinary job, the single in a dialogue scene; cut to the reverse, the open side swaps, and the geography survives intact.

Example frame not generated.
