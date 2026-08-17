---
id: overhead-angle
---

## What it is

The lens hangs directly above the subject, axis perpendicular to the floor, pointing straight down at 90°. **The line against the high angle (`high-angle`) is a hard one**: a high angle looks down at a slant, keeping a back wall and a horizon, with the figure still upright. An overhead shot leaves one plane — the floor. A person seen from directly above is a silhouette whose widest point is the crown of the head, whose shoulders spread into a T, and whose feet are hidden underneath.

**One test: is there a horizon (or a wall base line) in the frame?** If yes, it's a high angle, whatever number you wrote. Only when there is none do you have an overhead.

This is the angle AI cheats on hardest. Write `overhead`, write `top-down`, write `bird's eye`, and seven times out of ten the model quietly settles back to something like forty-five degrees — because its training data holds far more images that *look* overhead than images that actually are. Most of this card is about forcing it all the way up there.

## When to use it

- **The moment someone goes down.** Collapsed on the floor, lying on a bed, sprawled on a sofa. The subject is already against the ground, so overhead is the only angle that takes the whole body in at once — and it never has to solve the perspective of a face.
- **A whole set of things on a table.** Spread letters, laid cutlery, an unboxing, a table of evidence. Overhead flattens them into shapes so the audience can count them and read their relationships at a glance. This is the most reliable single cut in product and unboxing work.
- **Blocking and routes.** Who is standing where in a space, who moves toward whom, who is in whose way — one overhead cut, versus three at eye level.
- **The first or last cut of a passage.** The gap between an overhead and any level shot is enormous, which makes it a good full stop: pull up to straight down, the figure shrinks to a dot, and the passage closes itself.
- **Dodging consistency risk.** Overhead shows no face, so it carries no face-swap risk. If a scene's character consistency has been unstable, dropping in an overhead cut is both cheap and non-obvious.

**When not to use it**:

- **Not when you need performance.** Overhead gives you no eyes, no mouth, no expression at all. It talks about layout and position, not people.
- **Careful with a standing subject.** From straight above, a standing person is a crown and two slabs of shoulder — nobody can tell who it is. If you must, pair it with a pose: lying, crouching, seated.
- **Never more than one cut per scene.** Overhead is a loud sentence; said twice it becomes stylistic noise, and two in a row has the audience wondering whether there's a drone following everybody.
- **Not when the ceiling height is undefined.** A ferry cabin, a train carriage, a low attic — there is physically nowhere to put the camera, and the model will hand you a cabin with no roof, which reads as a blatant continuity break.
- **Not when a product needs thickness.** From straight above a box shows only its lid; all height and material depth vanish. For mass, use `low-angle`; use overhead only for layout.

## How to prompt it

One cut. Say "vertical" three times over — once as a camera position, once as what is absent, once as what fills the frame.

```
wide shot, directly overhead, lens pointing straight down（straight down from above, 90 degrees）,
no horizon in frame（no horizon, no walls, no background）,
the floor plane fills the whole frame（name the material: wet planks, grey brick, the pattern and its direction）,
what the subject looks like from above（lying, crouching, where each figure sits）, lighting state
```

- **`lens pointing straight down` and `no horizon in frame` must both appear.** The first is the instruction, the second is the acceptance test — with only the first you get forty-five degrees; add the second and there is nowhere left to put a horizon, so the model has to climb.
- **A negative clause has no strength on its own**: models handle "there is no X" unreliably. That is why the third line gives a positive substitute — the floor fills everything. One negative and one positive together beat either alone by a wide margin.
- **Name the floor material and the direction of its pattern**: `wet plank floor running left to right`. In an overhead the floor is the entire image; unnamed, it is a smear.
- **Describe the subject as a shape, not as an expression**: `a woman lying on her back, arms at her sides, the suitcase beside her right hand`. From above, people are graphics — write them as graphics.
- **Give `Static Shot` in the `[Shot k]` passage.** For motion use `Push In` (descend) or `Pull Out` (rise) — but **only one per cut, and with zero lateral drift**, or the model will take the opportunity to tip the camera back to a slant.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| How vertical | 90° | 85–90° | The only knob that matters on this card, and it barely tunes. 85° is invisible to the eye; by 80° the wall base line enters frame and the shot has become a `high-angle`, which reads completely differently |
| Camera height above subject | 2–3 m | 1–6 m | Higher reads as "something is watching from above" and shrinks the figure to a dot, good for closing a passage; lower reads as "someone is standing over them" and presses harder. Under 1 m the model starts drawing the arm holding the camera |
| Subject share of frame | 1/3 | 1/5 – 1/2 | The information in an overhead lives in the space around the subject. Fill more than half and you have lost the point — that is just a flat product photo |
| Seconds per cut | 3s | 2–5s | Overhead is a static angle with no inherent sense of time. Past 5s it is a still image unless something in frame is moving — water, smoke, someone walking through |
| Floor pattern density | medium | low to medium | The more regular the pattern (tile, planks), the clearer the verticality, because perspective lines are the only evidence of angle. On a plain floor the model cannot prove the angle at all, and will happily fake it |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Camera slides down | You wrote overhead and got a forty-five degree slant with half a wall in the background | `lens pointing straight down` + `no horizon in frame` + "the floor fills the whole frame" — all three, or it slides back |
| Visible box sides | Shooting a tabletop from above and every box shows one of its sides | That proves the camera is not vertical. Add `only the top faces of the objects are visible, no sides` — the best self-test this card has |
| Impossible face | The body is drawn from above but the face is frontal, as if pasted on | Have the subject close their eyes, turn their head, or let hair cover it; or drop the face entirely with `face turned away from the lens` |
| Wrong shadow | A long shadow trailing toward the bottom of frame, as if lit from the side | An overhead shadow should be short and spread to one side. Write `short shadow spreading to one side` |
| Missing ceiling | An interior overhead where the frame edge opens onto nothing where a roof should be | Do not shoot overheads in low spaces; if you must, pin the source — `light from a single hanging lamp just out of frame` — and let the light imply what is above |

## Examples

*The Letter Back* never uses one. The only cut in the reel that genuinely leaves human height is R01, looking down on the whole estate from the air with the tiled roofs flattened into texture — but that one hangs on `drone-shot` and trucks steadily to the right, and this card forbids any lateral travel at all inside an overhead. It is an aerial, not an overhead.

Indoors, the closest thing is R19, the hands-only cut on the tabletop — but that is still a close looking at the table on a slant, with the table edge and a slice of background in shot, so by this card's own test (is there a horizon or a wall-floor line?) it is not an overhead either.

There is exactly one place in this story where an overhead would make sense: **straight above the round table**, R19 reshot pointing vertically down. Do that and the frame collapses to a single plane — the table is a complete circle, the brown paper letter pinned at its centre, the father's hand coming in from one side and the son's hand stopping short from the other, the flask and the mug parked at the rim. The wainscot, the blue glass window and the ceiling fan all vanish. **There is nowhere left to put a horizon, and the distance between two hands becomes the only information in the picture.** Overhead here is not photographing people; it is drawing the standoff as a diagram.

One practical snag to plan for: the warm key in this room is the bare bulb hanging directly over that table, so climbing to the vertical position means taking the bulb's place. Shooting it for real means moving the lamp off to one side above, and rewriting the lighting clause to match. **Overheads usually fail at this step — not because the angle is wrong, but because nobody remembered the rig would be standing in its own light.**

Example frame not generated.
