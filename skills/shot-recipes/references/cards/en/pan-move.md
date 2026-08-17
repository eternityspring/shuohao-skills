---
id: pan-move
---

## What it is

The camera stays where it is and swivels horizontally. The position never moves.

**This card and `truck-move` have to be read together** — they are two faces of one thing. A pan keeps the camera planted and turns its head, so near and far swing together and the spatial relationships stay put. A truck actually travels, so near things sweep past faster than far things, and that speed difference is the only cue the audience reads as depth. A pan has no such cue.

The one-line test (the same sentence `truck-move` gives — the two cards do not get to disagree): **want the audience to feel the space, truck; only want them to see what else is over there, pan.**

Generative video adds a practical reason: **a pan is cheaper and much steadier than a truck.** The position holds, so the model does not recompute perspective — it just continues the image sideways. In a truck the spatial relationships change every frame, and there are far more chances to break. When the budget is tight, ask first whether a pan would have done the job.

## When to use it

- **Following somebody's eyeline.** They look right; the camera swings from them to the thing they are looking at. It is the cheapest subjective turn there is, and far steadier than cutting to a `POV`.
- **Joining two people in one cut.** One finishes speaking, the camera swings to the other, no cut in between — what the audience reads is "they are in the same place", which lands harder than a shot-reverse.
- **Laying out an environment along a line.** A row of shops, a wall of photographs, a corridor, a ridgeline. A pan states length, never depth.
- **Opening a talking-head piece.** Swing from the empty room onto the presenter and one cut does the work of a title sequence.
- **A product range laid out sideways.** Swing along the whole line rather than cutting between items, and it reads as one family.

**When not to use it**:

- **Not when depth is the point.** A pan produces no parallax and the space it uncovers is flat. Use `truck-move` instead.
- **Not before you have decided what the pan lands on.** The end of the swing is open season for the model, and the wider the angle the more it invents.
- **Never past 90 degrees.** Wide pans in generative video almost always break: the picture swaps its contents somewhere in the middle and never reconnects with where it started.
- **Not while the subject moves sideways.** They walk right, the camera pans right, and they stay pinned to the same spot in frame looking like they are jogging on the spot. That beat wants a `Tracking Shot`.
- **Not for a whip pan used as a transition.** That is the whip's job — the library has `whip-blur-bridge` for it.

## How to prompt it

One cut. **Pin both ends**; the middle of the swing looks after itself.

```
wide shot at the start（what is in frame, which side the subject is on）,
camera pivots in place（which way and how far — e.g. turns to the right about forty degrees）,
near and far sweep at the same rate（foreground and background swing together, no parallax）,
what the swing lands on（named item by item）,
the horizon stays level and at the same height（no roll, no rise）, lighting state
```

- **Measure the swing in degrees, never in prose**: `about forty degrees`, `a quarter turn`. Write `pans across the room` and the model picks its own distance, usually too far.
- **`camera pivots in place` is the line against a truck.** Leave it out and the model happily slides the body sideways, the foreground starts sweeping past, and you are on a different card.
- **`near and far sweep at the same rate` states the readable result on screen** — with it, the model stops faking parallax.
- **The horizon sentence is not optional.** The common failure is not swinging the wrong way; it is the horizon tilting or climbing partway through.
- **The `[Shot k]` passage says only that the camera is turning.** The subject's action gets its own sentence. Give either `Pan Left` or `Pan Right`, never both.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–5s | Under 2s all the audience registers is a smear; over 5s the middle of the swing starts repeating unless what you cross keeps changing |
| Swing angle | 40° | 15–90° | Under 15° nobody can tell the camera turned; past 90° the two ends share almost no content, the model treats them as two locations, and it breaks outright |
| Speed | even, moderate | slow to fast | Slow is appraisal, fast is searching for somebody; fast enough to smear is already a whip pan, which is another card |
| Items named at the end | 2 | 1–4 | The end of the swing is where this cut is won or lost, so name it precisely; past four the model starts dropping items |
| Shared content across the swing | yes | yes / no | Leave one thing visible at both ends (a pillar, a wall line) so the model has an anchor and does not swap locations midway; a pan with nothing in common at either end is the hardest kind to land |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Panned into a truck | You asked for a pivot and the foreground sweeps past with visible parallax | `camera pivots in place` is mandatory; add `the camera does not travel sideways` |
| Tilting horizon | The frame starts leaning partway through and ends crooked | Write `the horizon stays level and at the same height`; if it is already crooked, halve the angle |
| Location swap | The end of the swing is a different place that will not reconcile with the start | Cap the angle at 40°, leave one object visible at both ends, and hang the location sheet |
| Grown scenery | People and stalls appear at the far end that were never written | Name the end content item by item; do not expect the model to consult the design sheet on its own |
| Jogging on the spot | The subject walks right, the camera pans right, and they never leave the middle of frame | Switch to `Tracking Shot`, or pan slower than they walk so they move forward through the frame |

## Examples

*The Letter Back* uses `Pan Right` in exactly two cuts, R33 and R34, and both are the pan pushed to its limit — the whip. R33 is inside the room: the son stands and exits frame left, the camera whips right at the tail of the shot, the wainscot and the tabletop and the bulb smearing into horizontal streaks, and the last sharp thing before the blur is the letter left lying on the table. R34 is the corridor: the frame settles out of a whip coming from the same side, blur at the head this time, direction still to the right. The two cuts are joined by that shared direction.

Between them they also draw the line against trucking. The camera never leaves its spot; only the body swings, so the near wainscot and the far wall sweep across the frame together — **no speed difference, no depth to read**. R01's `Truck Right` goes the same way but actually travels, and that is the cut where near moves faster than far.

The film contains no normal-speed pan at all, and the location explains it: the only lateral content in the room is one arc of the round table with all three props on it, and a single frame already holds them. If you wanted a cut built to demonstrate this card, it is there at the table — swing slowly off the chair the son has left empty and land on the letter. **A pan is only worth making when there is something at the far end of the swing.**

Example frame not generated.
