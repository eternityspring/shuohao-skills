---
id: tilt-move
---

## What it is

The camera stays where it is and swivels about its horizontal axis: upward is `Tilt Up`, downward is `Tilt Down`. The camera height never changes.

**The move it gets mistaken for is the pedestal (`Pedestal Up` / `Pedestal Down`)**: a pedestal raises or lowers the whole body, so the height genuinely changes while the direction of view holds; a tilt holds the position and only raises or lowers the gaze. The test is on screen: **during a pedestal the horizon sits at roughly the same height in frame; during a tilt it visibly slides down or runs up.**

A tilt is a pan's sibling — one turns its head, the other lifts it, and the risk structure is identical: **where the move lands is open season for the model.** The difference is that a tilt's landing goes wrong far more often, because up means sky and ceiling and down means ground, and those three are exactly what your reference images photograph least.

## When to use it

- **Tilting up to state how tall something is.** From the doorway to the name board, from the deck to the masthead, from the steps to the ridge of the roof. One cut says "this place is not small".
- **Tilting down to state where something landed.** A character's eyeline drops, the camera follows, and the move ends on the thing on the ground — more continuous than cutting to an insert.
- **The bottom-to-top entrance.** Shoes to face is the cheapest way to say "this person carries weight". It is also the most overused, so once per episode.
- **Height and layers on a product.** Stacked things — cakes, shelves, tall bottles — are explained better by a tilt than a pan.
- **Opening a passage.** Tilting down from the sky onto a person reads more like "something is starting" than cutting to a wide does.

**When not to use it**:

- **Not when the reference images never photographed the ceiling or the ground.** Whatever the tilt lands on is not in the sheets, so the model paints it — this is the card's main way of crashing.
- **Never past 60 degrees.** Beyond that the two ends share almost no content, the model reads them as two locations, and it swaps the whole picture midway.
- **Not while somebody is speaking.** A tilt slides the face up or down the frame, the audience watches the camera instead of the person, and the line is wasted.
- **Not tilting up when you want pressure.** Tilting up hands out height and openness, which is the opposite of pressure; that feeling comes from a low angle held still.
- **Never stacked with a push in the same cut.** Two motions together and the perspective collapses partway through.

## How to prompt it

One cut. **Pin both ends, and above all pin the end that is new to frame.**

```
wide shot at the start（what is in frame, where the horizon sits）,
camera pivots vertically in place（up or down, and how far — e.g. raises about thirty degrees）,
horizon line moves within the frame（the horizon slides down or runs up accordingly）,
what the move lands on（named item by item: the sky's condition / the ceiling's material / the ground's material）,
the ground keeps the same material throughout（no substitution underfoot）, lighting state
```

- **Measure the swing in degrees**: `raises about thirty degrees`, `lowers a quarter turn`. Write `tilts up to the roof` and the model picks its own stopping point, usually too far, landing on empty air.
- **`camera pivots vertically in place` is the line against a pedestal.** Leave it out and the model often raises the whole body instead, the horizon does not budge, and the move states nothing.
- **The landing end has to be named down to the material**: for a tilt up, the sky (`flat overcast sky, no clouds`) or the ceiling (`dark wooden beams`); for a tilt down, the ground (`wet stone slabs`). **This is the single most valuable clause on the card.**
- **`the ground keeps the same material throughout` is mandatory on a downward tilt**; on an upward one swap it for `the sky stays a single flat tone`.
- **The `[Shot k]` passage says only that the camera is swivelling vertically.** The subject's action gets its own sentence. Give either `Tilt Up` or `Tilt Down`.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–5s | Under 2s nobody reads what was crossed; over 5s the cut lingers on the landing and the model starts adding detail to the sky or the ground, all of it unwritten |
| Swing angle | 30° | 10–60° | Under 10° it reads as shake; past 60° the two ends share almost nothing and the model treats them as separate locations |
| Speed | even, slow | slow to moderate | Slow is appraisal, moderate is following an eyeline; a fast tilt has almost no legitimate use — fast enough and it is a whip |
| Items named at the landing | 2 objects plus 1 material | 2–4 | The material item is not optional. Name objects without naming material and the ground turns from stone slabs into mud |
| Shared content across the swing | yes | yes / no | Leave one vertical object visible at both ends (a pillar, a mast, a door frame, a standing figure) and the anchor stops the model from swapping locations |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Grown ceiling | Tilt up and the ceiling sprouts beams, lanterns and patterns that were never written; outdoors it is clouds and birds out of nowhere | Name the landing down to material and sky condition (`flat overcast sky, no clouds`) and add `the sky stays a single flat tone` |
| Substituted ground | Tilt down and the ground turns from planking into stone or mud, and the two ends will not cut together | `the ground keeps the same material throughout` is mandatory, and name the ground material at the start as well |
| Tilted into a pedestal | The horizon holds its height in frame and the whole picture simply slides upward | `camera pivots vertically in place` and `horizon line moves within the frame`, neither one optional |
| Overshoot | The move lands on blank sky or blank floor with nothing in it | Cap the swing at 30° and pin what has to be visible at the end |
| Sliding face | The person slides up or down the frame and their features change while sliding | No tilt on cuts with dialogue; if you must tilt, put the person at one end of the move and keep the face out of the other |

## Examples

*The Letter Back* tilts once, at R05: the camera sits at the foot of the stairwell shaft at knee height and swings up, four flights of railing spiralling toward a pale skylight, the son a small figure at the third-floor turn with one hand on the rail. Cold daylight falls down the shaft; one warm bulb burns on the second landing.

The cut is filed under `low-angle` — that is the camera-angle card — but the act of swinging up belongs to this one, and it demonstrates the tilt's first requirement: **there has to be something at the far end of the swing.** The stairwell is the only space in the film with vertical information — four flights of rail, landing after landing, the skylight at the top — so every stage of the climb states something new. Nothing in the flat can be tilted: above the chest-high wainscot there is cracked plaster and one bare bulb, and swinging up buys you a blank wall.

The end of a tilt is where the model gets to invent, which is why R05 pins it: the top is "a pale skylight", not a vague "ceiling". **Tilt only when you can say what is up there and what it is made of.**

Example frame not generated.
