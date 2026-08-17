---
id: hero-drop-in
---

## Intent

The opening beat of an ad or a keynote: the product enters from outside the frame, lands dead centre, holds, and everything that follows starts from there. What it delivers is **certainty** — the thing has arrived, now you can look at it.

Most people write this card backwards. The point is not the drop; the point is **the hold**. The travel occupies only the first half, and the stillness after it is when the audience actually reads the product — and the frame you will pull for the thumbnail.

## Prompt skeleton

One cut, never split. The landing and the hold have to happen inside the same cut.

```
medium shot, the product entering from just above the top edge, a short travel distance,
decelerating on the way down, until it settles into place dead centre of frame and holds
completely still, solid backdrop, soft key light, a tight contact shadow where it meets the surface
```

- **Never write free fall**: `free fall`, `drops from above`, `falls onto the table` guarantee floating and clipping. Rewrite as short travel, deceleration, settle
- **Never write a bounce**: delete `bounces`, `rebounds`, `springs`. `settles into place` means one arrival and no rebound
- **Never write elastic materials**: `rubbery`, `elastic`, `squishy` will soften metal and glass along with everything else
- **Write the hold into the `[Shot k]` passage** — "holds still once it lands" must be explicit, or the model keeps finding things to animate
- `Static Shot` is the default. `Push In` for emphasis, but the push happens **after** it settles — never while it is still travelling

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–4s | 2s is crisp, 4s is unhurried. Past 4s the hold runs so long the picture reads as frozen |
| Travel distance | one product height | half to two heights | The decisive knob on this card: shorter travel, more believable physics. Past two heights you are in free-fall territory and the product starts to float |
| Share of the cut spent holding | over half | 40–70% | The hold is when the product is actually read. More of it looks like finished film; less looks like a motion-graphics demo |
| Size | medium | medium–wide | Medium is the default; wide states the relationship to the set, but the smaller the product sits in frame, the less the landing weighs |
| Background simplicity | solid | solid–shallow-focus real set | The moment the background gets busy during the landing, the model starts animating it too |
| Camera | Static Shot | Static Shot / Push In | Locked off is steadiest. `Push In` only after the settle — pushing during the travel puts two motions in conflict |

## Reference-image constraints

- **Hang the front product sheet at the landed angle** — the settled frame is this card's finished frame, and it has to match every product shot that follows
- **Hang a landing composition reference**: the product at rest, dead centre. The model stops against that image, which is what keeps the landing point from wandering
- Hang the surface and background sheets (tabletop material, backdrop colour). The contact shadow only reads correctly against them
- The prompt carries **the travel and the settle**; what the product looks like belongs to the reference images

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Feather drop | The product drifts down like a leaf with no weight at all | Pull travel under one product height, keep `short travel distance`, and state the deceleration and the stop |
| Clipping | The product sinks into the tabletop, or passes through the backdrop | State the resting surface and the contact shadow, land it on top of that surface, and keep the surface visible rather than imagined |
| Rubber ball | It bounces twice on arrival and the metal reads as rubber | Strip every `bounce` / `rebound` / `elastic` word; `settles into place` means one arrival, stated explicitly |
| Wobbling form | The product stretches during the travel and its outline changes frame to frame | Shorten the travel, lengthen the cut so the model has headroom, and hang the product sheet |
| Wrong landing spot | It stops off-centre, and the same prompt lands somewhere new every run | Pin "dead centre of frame" in the prompt and hang a landing composition reference as the anchor |

## Examples

*The Letter Back*, R24: the white enamel mug comes down into the middle of the round tabletop, its lid rattles once, and it stops — 3 seconds, medium, locked off.

Both gates are written in the open: `short travel distance` is "about a hand's width above the table", `settles into place` is "one small rattle and done, no bounce". A hand's width is the entire drop, which is the point this card keeps making — the value is not in the fall but in the stillness after it, and the red rim and the chipped glaze get read in those frames. No hands in shot; the room behind sinks dark so the silhouette stays clean.

The section also skips the studio white backdrop, and that carries its own lesson: 1990s enamelware is unbranded to begin with, so `no logo and no readable text` costs nothing to satisfy here.

Example frame not generated.
