---
id: pull-reveal
---

## Intent

Open on one detail — a hand, a sign, a face — and the audience is locked onto that small patch of frame. Then the camera backs away, the surroundings arrive, and the detail you were staring at gets reinterpreted: so that is where he was standing, and someone else has been there the whole time.

It is the best closing shot in the library and the cheapest way to reveal anything, because **the information is not spoken, it is pulled into frame**. The price: every square inch the camera uncovers is blank canvas to the model, and it will happily paint something there.

## Prompt skeleton

One cut, camera `Pull Out`. Pin down the contents of both the opening framing (the detail) and the closing framing (the whole).

```
medium shot opening on the detail (state exactly what it is and where it sits) in sharp
focus, camera pulls back, widening reveal, surroundings enter the frame: (name every
element that arrives — the X on the left, the Y on the right, the ground material),
lighting state, the subject stays centred throughout
```

- **Name what arrives, item by item.** Anything you leave unnamed is space the model gets to invent, and it always does
- **Keep the pull inside one size step** (medium → wide). Jumping two steps out to extreme wide doubles the newly revealed area, and the odds of invented objects double with it
- The **`[Shot k]` passage carries only what the subject does** during the pull (stays still, turns slowly, looks up). Big subject motion plus a moving camera breaks both
- Use `Pull Out`, never `Zoom Out` — a zoom changes the field of view without changing perspective, so the revealed space arrives flat and the reveal loses half its force

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–6s | The detail has to register and the whole has to be read; leave a beat at each end. Under 3s all the audience sees is a frame getting wider |
| Pull distance | one size step | one–two steps | One step is the safe zone; two steps looks grander, but newly revealed area is newly invented area |
| Opening size | medium | medium–close | The tighter you open, the more new space the ending has to explain, and the risk rises with it |
| Closing size | wide | medium–wide | Stop at wide. If you need an extreme wide, cut a separate establishing shot instead of pulling all the way out here |
| Named elements | 3 | 2–5 | More names, tighter lock; past five the prompt starts competing with itself and the model drops whatever came last |
| Subject position | centred | centred–third line | Off-centre subjects drift toward the edge as the camera retreats, and sometimes out of frame entirely |
| Background complexity | plain | plain–moderate | Markets, bookshelves and crowds are where invented objects breed. The cleaner the background, the steadier this card |

## Reference-image constraints

- **The scene sheet is mandatory** — the entire risk of this card is "what is actually in the wide", and that sheet is the answer key
- If the subject is a person, hang the character sheet too: the pull shrinks the face down to a handful of pixels, which is exactly when the model swaps people
- The prompt describes **two states only** — the detail at the start and the elements present at the end. What the space looks like belongs to the reference images
- If this cut follows another one in the same location, **hang that cut as a reference** so the props, the sky and the light ratio line up in the wide

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Invented furniture | Objects, passers-by and patterns appear that were never in the prompt | Name every element of the wide, hang the scene sheet, cut the pull to one size step — all three together |
| Pulled too far | The camera retreats to extreme wide, the subject shrinks to a few pixels and everything you established is gone | Stop at wide; cut a separate establishing shot if you need more |
| Subject drifts out | The subject slides to the edge and leaves frame before the cut ends | Write `the subject stays centred throughout` |
| Wrong direction | The result pushes in instead of pulling back | Set the camera to `Pull Out` and restate the direction in the `[Shot k]` passage |
| Flat reveal | Switched to `Zoom Out`; the frame widens but the space has no depth | Go back to `Pull Out` so perspective moves with the camera |
| Weather change | It opens overcast and ends in sunshine | Write the lighting state once and share it across both framings; hang the previous cut as a reference |

## Examples

The closest cut in *The Letter Back* is R36, but the reel hangs it on the technique card `pull-out` — the movement itself — not on this recipe. R36: the son crosses the courtyard away from camera, the camera travels backward, and the shot ends on the whole block, six storeys of balconies filling the frame with one fourth-floor window still lit. 5 seconds, `Pull Out`.

Two differences. **The opening frame is not a detail.** This card wants one specific thing holding the audience first — a hand, a sign, a face — so that widening can reinterpret it; R36 opens on a medium of a man already standing in a courtyard, so pulling back only makes him smaller and nothing gets reinterpreted. **The travel spans two size steps.** Medium out to an extreme wide of the entire block, where this card advises staying inside one step, because the newly revealed area doubles and so does the chance of the model painting something into it. R36 gets away with it only because that space was itemised twice already, in R01 and R02 — same blocks, same courtyard, same drying lines.

Written strictly to this card, the shot would open tight on that one lit fourth-floor window and pull back to the block: a bright point first, then the discovery that it is the only window still burning in the whole dark building.

Example frame not generated.
