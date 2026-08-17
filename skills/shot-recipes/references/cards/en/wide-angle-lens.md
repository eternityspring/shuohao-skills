---
id: wide-angle-lens
---

## What it is

Wide angle is about field of view, not about shot size. **They are two different axes**: size is how much of the frame the subject occupies, field of view is how much world the frame swallows. The same medium shot on a wide lens and on a long lens can put the person at exactly the same height and still describe two completely different spaces — the wide pushes near things bigger and far things further, and straight lines start bending at the edges.

The one-line test: **want the audience to feel "this place is huge" or "this thing is right here", go wide; just need one more person in frame, step back and shoot a wide size.**

## When to use it

- **Small spaces you cannot back out of.** Cars, bathrooms, boat cabins, lifts. The camera has nowhere to retreat to, so field of view is the only lever left.
- **Subjective pressure.** A wide lens close to a face stretches the features and the person turns menacing or ridiculous on the spot: villains, drunks, nightmare sequences.
- **Handheld entrances.** Wide plus walking sweeps foreground past the lens continuously — the strongest sense of depth any focal length gives you.
- **Product held in the hand or sitting on a table.** Shove the object at the viewer; it conveys scale better than a spec sheet.
- **Vlog at arm's length.** Camera held out, person and background both in frame — nothing else covers that distance.

**When not to use it**:

- **Not on your lead's close-up.** Nobody looks good with a wide lens in their face: the nose swells, the face widens. Unless that is exactly the effect you want.
- **Not when the frame needs to look expensive.** A wide flattens nothing and spreads everything, which reads as everyday, sometimes cheap. Looking expensive is the long lens's job.
- **Not for two-person dialogue in vertical.** Vertical plus wide stretches whoever sits near the edge; the closer to the edge, the wider the face.
- **Not stacked on a high angle.** Wide plus looking down gives you a big head on a small body, and that proportion is exactly what the model cannot hold.

## How to prompt it

One cut is the norm. Name the foreground — with nothing near the lens, a wide lens is just "more stuff in frame", not a wide-angle look.

```
medium shot, wide field of view, foreground objects look oversized,
the near object（pin what it is and how close to the lens）, what the subject is doing,
the line running into depth（a corridor / the river / the street — a wide needs one）,
straight vertical lines stay straight（door frames and posts must not bend）,
lighting state, cinematic film still
```

- **Phrases like `35mm feel` are fair game.** The model understands "the view a certain focal length gives"; it does not understand aperture and shutter. Describe focal length as field of view, never as camera settings.
- **`straight vertical lines stay straight` is the stop-loss line.** Without it the model overcooks the distortion, door frames bow like bananas, and the audience reads it as a visual effect.
- **Name the foreground item by item.** The entire wide-angle effect is near-big/far-small; nothing near the lens, no effect.
- **Keep faces away from the edges.** Stretching is worst there, so pin the person to the centre of frame.
- Give `Static Shot` or `Tracking Shot`. Stacking `Push In` on a wide changes perspective too violently — the space looks yanked within one cut.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Field of view | 35mm view | 24mm – 50mm view | Wider exaggerates the space and stretches the edges harder; at the 24mm end any face off centre starts widening |
| Foreground distance | within arm's reach | touching the lens – two metres | Closer means a bigger foreground and fiercer depth; right against the lens and the model smears it into an unidentifiable blob |
| Amount of distortion | light | none – medium | More is more oppressive; past medium every straight line bends and the shot stops reading as a lens and starts reading as an effect |
| Subject position in frame | centre | centre – a quarter off | The further off centre, the wider the face gets pulled. Unless distortion is the point, keep faces inside the quarter line |
| Seconds per cut | 3s | 2–5s | Motion reads faster on a wide lens, so 3s covers the same action; past 5s the edge distortion starts shifting on its own |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Stretched face | The face near the frame edge widens like a funhouse mirror | Move the person to centre, drop to the 35mm view, and never put two faces in a wide-angle frame |
| Banana doorway | Door frames, posts and masts bow into arcs | `straight vertical lines stay straight` in the prompt, and drop the distortion one notch |
| Fake depth | You asked for a wide and got something as flat as a sticker | No foreground was named. Put a pinned object near the lens: a railing, a load of goods, a hand reaching in |
| Bobblehead | Wide stacked on a low or high angle turns people into big heads on small bodies | Do not stack a wide with extreme angles; if you must, move the subject back to medium distance |
| Grown edges | Doors, windows and passers-by appear at the sides that are not in the design sheets | A wide holds more, so the background needs more writing: name one anchor on each side |

## Examples

*The Letter Back* has no focal-length field in its storyboard JSON — **focal length is not a storyboard field; it lives in the prompt** — so no cut in the sample can be called a wide-angle cut.

**R08 has the strongest claim on it**: the POV pushing the door open, his own hands entering the bottom of frame with one palm flat on the dark red wood, the room opening past the door edge onto the round table, the letter on it, the chest-high wainscot and the blue glass window in the back wall. The two preconditions are already met — something solid right against the lens (his own hand) and a small room with nowhere to back up to. Add "wide field of view" and "foreground objects look oversized" and the hand shoves itself at the viewer while the whole room unrolls behind the door: the audience is standing in the doorway, not watching it. Budget the cost in the same breath — the door frame is the longest straight line in the cut, so "straight vertical lines stay straight" has to ride along or it bends into a banana.

**R09 is the plainer use**: one wide has to hold two men at either end of the round table, three props on it, the ceiling fan and the wall calendar. The room is small and the camera runs out of floor at the wall, so field of view is the only lever left. Do not push it hard here, though — with a man on each side of the frame, one more stop of width and the outer face starts growing sideways.

Example frame not generated.
