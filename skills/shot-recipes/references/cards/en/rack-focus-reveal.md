---
id: rack-focus-reveal
---

## Intent

Something solid sits in the foreground — a letter in a hand, a door handle, a profile — and the audience takes it for the point of the shot. Then focus travels backwards, the foreground goes soft, and the real answer is standing behind it. Attention has been moved without the frame moving an inch.

**The camera does not move at all; only focus does.** That is what separates this from a push or a pull, and it is why the card is so cheap on consistency: the composition never changes, so the model never gets a chance to repaint the space — it only has to swap which layer is sharp. This is the lowest-risk reveal in the library.

## Prompt skeleton

One cut, camera `Static Shot`. Put exactly two depth layers in frame and name both of them.

```
close-up, foreground subject (state what it is, which side it sits on, how much width it
takes) in sharp focus, background subject (state who or what, and how far behind) soft
behind it, shallow depth of field, focus shifts from foreground to background,
locked camera, lighting state
```

- **Two layers, no more.** A third one — a table in the midground, a second figure down the corridor — leaves the model unsure where focus should land, and it stalls halfway
- **Name both layers.** Write only the foreground and the back layer collapses into a smudge, so there is nothing to arrive at
- **Pin the shallow depth of field.** Without a sharp/soft difference there is nothing to rack; dropping `shallow depth of field` means the card simply does not happen
- The **`[Shot k]` passage carries the direction of focus only** (foreground handing off to background). Add character motion and focus starts wandering with it
- Keep the camera on `Static Shot`. Any translation throws away this card's whole advantage — a space that never gets repainted

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–4s | The rack itself only occupies the middle; leave a beat on either side. Under 2s nobody reads the foreground before it goes soft |
| Depth layers | 2 | 2 | The one knob in the library not worth turning: from three layers on, the focus landing point is a coin toss |
| Blur strength | medium-strong | medium–strong | Too little and the rack is invisible; too much and the background gets repainted while it is soft |
| Layer separation | one to two metres | half a metre–three metres | Further back means a softer, harder-to-read answer; too close and both layers stay sharp, leaving nothing to rack |
| Foreground share | a third of the width | a quarter–a half | More foreground, more suspense; fill the frame and all you have is a silhouette |
| Opening size | close | close–medium | A small object in front wants close; a shoulder or a profile wants medium |
| Rack timing | mid-cut | early–mid | Racking early gives the answer more time on screen, racking late holds the suspense; never in the last half second — the cut is gone before anyone sees it |

## Reference-image constraints

- **One sheet per subject** (the foreground object or person, plus whoever is behind). The back layer spends the first half of the cut out of focus, and **the instant it sharpens is the instant faces get swapped** — without the sheet it will happen
- Hang the scene sheet to fix the spatial relationship between the layers: who is left, who is right, how far apart
- The prompt carries only **what each layer is, which side it sits on, and which one starts sharp**. Faces and materials belong to the reference images
- If this cut sits mid-sequence, hang the previous cut as a reference so the person behind does not move between shots

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| No rack at all | Foreground stays sharp and background stays soft for the whole cut; nothing is revealed | Neither `shallow depth of field` nor `focus shifts from foreground to background` may be dropped (the gate checks both), and give the cut at least 3s |
| Three layers fighting | With three or more depth planes, focus parks on the middle one and stays there | Clear the set; keep two layers and move midground props out of frame |
| Everything sharp | Deep focus, both planes crisp, no sharp/soft difference to trade | Pin the shallow depth of field and raise the foreground share to force the separation |
| Sneaky drift | The frame pushes or slides slightly during the rack and the composition wanders | Set `Static Shot` and restate the locked camera in the `[Shot k]` passage |
| Background swaps | The moment the back layer sharpens, it is a different face | Hang the character sheet, bring the layers closer, drop the blur one notch |
| Foreground becomes a wall | The soft foreground collapses into a dark slab and the model paints it as masonry | State what the object physically is (paper, handle, shoulder) and reduce the blur |

## Examples

*The Letter Back*, R23: the folded letter sits large in the near foreground with the father seated behind it; the focus travels back, the letter goes soft, and his face comes up sharp — 3 seconds, medium, camera completely still.

This is the card's cheapest property demonstrated exactly: **not one inch of the frame moves and the composition never changes**, so the model is never handed an opportunity to redraw the space — only to swap which plane is sharp. The depth layers are strictly two, foreground letter and background father, with nothing in between to steal the pull. The shift takes about a second, and for that second nothing else in the frame moves at all.

It follows R22, the same shallow-focus setup with the letter still sharp. Two nearly identical compositions, one difference: R22 says "the letter is the point", R23 says "no — he is".

Example frame not generated.
