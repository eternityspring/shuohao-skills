---
id: worm-eye-angle
---

## What it is

The lens is pressed against the ground (0–20 cm off the floor, tilt starting from near 0°) and looks up. **The gap from a low angle (`low-angle`) is one of magnitude, not of degree**: a low angle sits between waist and chest, 15–30° down, and the ground still reads as a surface running away behind the subject — you can still see where their feet are planted. A worm's-eye shot has the lens *on* the floor: the ground touches the bottom edge of frame, almost as near as the lens itself, the closest shoe is bigger than the head, and ceiling or sky takes most of the picture.

The one-line test: **if the strip along the bottom edge is the ground's own surface (not the ground receding into distance), it's worm's-eye; if you can still see the ground laying itself out toward the horizon, it's still a low angle.**

**This is the hardest angle in the category to stabilise**, for a specific reason: it asks the model to render extreme near ground and extreme far ceiling in the same frame, with perspective stretched to the limit at both ends, and its training data holds very few such images. Most of the time you write worm's-eye and get a slightly shorter low angle — the lens floating half a metre up, committed to neither. So the working method for this card is: **stop asking for the angle and start writing the things only a worm's-eye shot produces.**

## When to use it

- **Someone is down on the ground and someone else is standing over them.** The one use of this angle that needs no explanation — it *is* the fallen person's eyes. It is also the version the model gets right most often, because it has a narrative reason to put the camera there.
- **Feet and floor only.** Feet walking up, feet stopping, feet stepping into a puddle, a pair of heels halting in front of a pair of worn cloth shoes. No face enters the frame, consistency risk goes to zero, and the wet, the dirt and the reflections come right up to the eye.
- **Making tall things genuinely tall.** A stairwell, a flagpole, a big tree, the top shelf of a rack. A low angle is "somewhat high"; worm's-eye is "out of reach".
- **When the ground itself is the content.** Reflections in standing water, snow, mud, something spilled across the floor. Worm's-eye promotes the ground to foreground, so near and far each say something in the same frame.
- **Products that live on the floor.** Shoes, tyres, suitcases, robot vacuums. Floor height is their actual use height, so it is the natural way to see them — and objects grow no chin, so the deformation risk is far lower than with people.

**When not to use it**:

- **Not if you need the face.** At this angle a face is essentially unusable: chin underside, nostrils and neck dominate, the proportions invert, and no prompt clause holds it together. If you need the face, retreat to 15° and `low-angle`.
- **Not with the subject more than three or four metres away.** The whole effect comes from the gap between very near ground and very far subject. Move the subject back and the perspective flattens into an ordinary low angle for none of the benefit.
- **Not indoors without a ceiling design sheet.** Worm's-eye necessarily gives most of the frame to the ceiling, and the model invents worse here than it does for a low angle, because it has to invent the roof's perspective at the same time.
- **Once per scene is enough.** This is among the loudest angles in the library. Put two side by side and nobody hears the second.
- **Not on a cut with dialogue.** The mouth is at the far end of the frame and the face is broken; the audience cannot tell who is speaking.

## How to prompt it

One cut. Say the ground twice — once as what the lens is resting on, once as where it sits in the frame.

```
wide shot, extreme low camera position, lens resting on the ground（lens at floor level, essentially zero height）,
ground surface at the bottom edge（what that strip is: wet planks, brick joints, standing water）,
the figure rising from the bottom of the frame（the near shoe largest, the head small and high in frame）,
ceiling or sky taking the upper half（name what is overhead）, lighting state
```

- **The word "resting" is doing the work in `lens resting on the ground`.** `low camera` gets you half a metre; `camera on the ground` sometimes gets read as a camera lying there as a prop; `lens resting on the ground` has the best hit rate of the three.
- **`ground surface at the bottom edge` is the only thing that proves the lens really got down there.** With the angle real, the bottom strip must be the ground's *surface* — close enough to show texture and water beads — not the plane running away behind the subject. Pin that and the model cannot lift the camera.
- **State the near/far size relation explicitly**: `the near shoe large in the foreground, the head small at the top of the frame`. Models instinctively resist proportions this extreme; unwritten, they compromise.
- **Name the material of that near foot** — cloth shoe, leather boot, a wet trouser cuff. It is the biggest object in frame; if it smears, the cut is dead.
- **Give `Static Shot` in the `[Shot k]` passage.** Use `Tilt Up` to travel from the feet to the face, but **be ready for the face to be broken** — better to stop the tilt at chest height and cut. For feet walking toward camera, use `Tracking Shot` with the rig retreating along the ground.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Height off the ground | 0 (resting) | 0–20 cm | The only knob that decides whether the card works at all. Under 20 cm still reads as ground level; by 50 cm it has degenerated into an ordinary low angle — half the effect, all of the pitfalls |
| Subject distance | 1–2 m | 0.5–4 m | Closer means more extreme perspective and more force; nearer than 0.5 m and the foreground foot starts growing extra toes. Past 4 m the angle stops meaning anything |
| Upper share of frame | 1/2 | 1/3 – 2/3 | Raise it for a stronger "out of reach" and a smaller subject; past two thirds the subject is no longer the subject, the sky is |
| Foreground ground share | 1/6 of frame height | 1/10 – 1/4 | This is the card's signature. Below a tenth the audience cannot tell how low the lens is; past a quarter the bottom of the frame is a smeared block of colour |
| Seconds per cut | 2.5s | 2–4s | Under 2s the angle never registers; past 4s the audience starts staring at whatever is deformed. The angle that most wants to be short |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Floating lens | You asked for ground level and got a half-metre low angle; the ground never touches the bottom edge | Both `lens resting on the ground` and `ground surface at the bottom edge` must be present, and that bottom strip must be named by material |
| Monster foot | The foreground shoe smears, grows an extra toe, or the laces fail to connect | Give that shoe its own clause (`a worn cloth shoe, wet at the toe`) and push the subject back past 1.5 m |
| Split difference | Head and foot come out about the same size — no extreme perspective, like a snapshot on a short lens | State it explicitly: `the near shoe large, the head small at the top of the frame` |
| Grown roof | Beams, skylights and ducts appear overhead that are nowhere in the design sheets | Name what is overhead item by item and attach the location sheet; outdoors, pin `flat overcast sky, no branches, no birds` |
| Broken face | The tilt reaches the face and the features have inverted past recognition | Do not shoot faces at this angle. Stop the `Tilt Up` at chest height and cut, or have the subject look down toward the lens — a lowered head recovers part of the chin underside |

## Examples

*The Letter Back* never uses one. The lowest rig in the whole reel is R05, at knee height at the foot of the stairwell, and nothing goes below it.

Where it would belong in this story is the **corridor**. R04 is currently a steadicam gliding behind the son down the hallway, the sound-operated bulbs coming on one at a time ahead of him and dying out behind. Reshoot that cut from the floor: the lens resting on the terrazzo, the bottom edge of the frame filled with the surface of the terrazzo itself — close enough to read the cut faces of the aggregate and the dust in the seams; the son's shoes walking away out of the lower frame, the nearer shoe bigger than his head; the top half of the picture taken by the corridor ceiling and its row of bare bulbs, each one lighting up ahead of him. **The original says "he is walking in"; the ground-level version says "he is walking in over these floors" — the ground has been promoted to a character.**

It also draws the card's boundary. R04 never needs a face, which is exactly why it can take this. R13 (the father listening) and R14 (the slow push on the son's face) cannot take it for a single frame — ground level will stretch the chin, the nostrils and the forehead all at once, and those two cuts are nothing but face.

Example frame not generated.
