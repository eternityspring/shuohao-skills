---
id: high-angle
---

## What it is

The lens rises to roughly 20–45° above the subject's eye line and looks down at a slant. **The hard line to draw is against the overhead shot (`overhead-angle`)**: a high angle looks down obliquely — there is still a back wall, still a horizon, and the figure is still standing up in the frame. An overhead shot is straight down at 90°, the floor is the only plane left, and the figure collapses into a silhouette seen from above. **The test is simply whether a horizon (or a wall base line) is present.** If it is, you have a high angle, no matter how high you think you went.

On the generative side, the high angle is **the one that overshoots**. The model resists low angles and volunteers high ones, because its default viewpoint already sits above the eye line. So most of this card is about stopping it from sliding all the way to 60°.

## When to use it

- **The cut where someone is surrounded, judged, or left alone.** A high angle pins the figure to the lower part of the frame, and the empty floor around them is the weight on their shoulders. Placed at a scene's turn, it does the work of three lines.
- **Establishing the layout of a space.** How big the room is, where the table sits, who is where — one high-angle cut says it; eye level needs three. For an establishing shot, high beats level.
- **When the event is on the floor.** A fall, a collapse to the knees, something dropped, blood running into the tile grout. The subject is already low, so a high angle is simply the natural way to see it.
- **Laying out a product set.** For a full kit on a table, 30° beats straight down — straight down loses thickness, while 30° keeps the sides and the height of each object.
- **One standing, one seated.** Shoot from just above the standing figure's shoulder down at the seated one and you get the power relation, the sightline and the space in a single frame.

**When not to use it**:

- **Be careful when you want sympathy.** A high angle says "weak", not "pitiable" — and enough weakness reads as "unimportant". For sympathy, go back to eye level, go closer, and let the eyes do it.
- **Not when the face is the entire content of the cut.** Looking down enlarges the forehead, shortens the chin and pushes the eyes into the shadow of the brow. Half the information in the face is gone. Faces want level.
- **Not when you have no design sheet for the floor.** A high angle necessarily gives the lower half of the frame to the ground, and the model will invent tile, carpet or grain that contradicts the other cuts — the same room reads as two rooms.
- **Not across a whole conversation.** Shot down on throughout, the audience feels like it is watching surveillance footage and never gets inside the scene.
- **Past 45°, stop calling it a high angle.** Beyond that the figure starts turning into a lump. Either come back to 30° or commit fully to 90° and use `overhead-angle` — the middle of that range is the ugliest place to be.

## How to prompt it

One cut is normal. Pin the degrees and name the floor material that fills the bottom.

```
medium shot, high angle, lens above the eye line（how many degrees — 30 is the safe value）,
floor or ground fills the bottom（name the material: wet planks, grey brick, carpet）,
eyes lifted toward the lens, environment anchors, lighting state
```

- **Always state the degrees**: `high angle, about 30 degrees above the eye line`. Bare `high angle` lands anywhere between 15° and 60°, and two cuts in the same scene will not match.
- **`floor or ground fills the bottom` does two jobs**: it pins the angle (at a real 30° the bottom of the frame must be ground) and it forces you to say what the ground is. This clause is what makes the floor match between cuts of the same scene.
- **The eyes have to come up**: `eyes lifted toward the lens`. Looking level ahead under a high angle drops the eyes into the brow shadow and the performance disappears. Lift the gaze and the face comes back to life.
- **Do not write both the degrees and `looking down at the subject`.** One is a description, the other an instruction; given both, the model applies the tilt twice and overshoots.
- **The `[Shot k]` passage carries the subject's action only**, with `Static Shot`. Use `Tilt Down` if the gaze needs to travel downward, but do not add `Push In` to that same cut.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Degrees above the eye line | 30° | 15–45° | Under 15° there is no sense of being pressed down, just a slightly tall camera; 30° balances vulnerability against facial information; past 45° the crown of the head takes over and the figure becomes a lump — switch to `overhead-angle` |
| Ground share of frame height | 1/3 | 1/4 – 1/2 | Raise it for more isolation; past half the figure shrinks to the bottom edge and the audience studies the floor pattern instead of the person |
| Head size relative to body | normal for medium | normal to slightly small | A high angle inherently enlarges the crown and foreshortens the body. Deliberately writing the figure small (`the figure small in the lower half`) looks better than forcing a close size, which only magnifies the distortion |
| Seconds per cut | 3s | 2–5s | Slightly more durable than a low angle because there is more to read; past 5s the space has been absorbed and boredom sets in |
| Repeats per scene | once | 1 cut | Two high-angle cuts in one scene and the second one does nothing. Cut down, then cut back to level — the drop is the product |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Overshoot | You asked for 30° and got something like 60°: nothing but crown and shoulders | Pin the degrees, and delete every redundant `looking down` / `from above` in the prompt — they stack |
| Lost eyes | The angle is right but the eyes are buried in brow shadow and the face is empty | Add `eyes lifted toward the lens`; drop some fill in from below with `soft fill from below the face` |
| Grown floor | Same room, two cuts, completely different tile pattern or plank direction | After `floor or ground fills the bottom`, name the material and direction (`wet plank floor running left to right`) and attach the location sheet |
| Bobblehead | Visibly big head, visibly short legs — a squashed doll | Pull back to under 20°, or out to a wide. `full body proportions preserved` helps, but it will not save anything past 45° |
| All down | The entire scene is shot from above; it reads as CCTV and the emotion never lands | One high-angle cut per scene. The value is entirely in the contrast with the level cut beside it |

## Examples

*The Letter Back* never uses one. The reel's angles are deliberately restrained: apart from the low-angle stairwell in R05, not a single cut is written down from above, and R15 pins the baseline for the whole sitting scene at eye level. **There is a reason.** Neither man in this story has power over the other — what has power over both of them is the letter on the table. Any downward angle picks a loser on the audience's behalf, and this film does not want to pick.

If it were going to be used, the spot is obvious: **R09**, the first wide inside the flat, the son standing at the left end of the round table and the father seated at the right. Take that cut down 30° and the terrazzo floor fills the bottom edge (this card's must-phrase comes free here), the round table stops being an ellipse seen edge-on and becomes a full circle, and the two men turn into opposite points on one closed shape. **Same beat: level says "they are sitting on either side of a table", 30° down says "the flat is only this big and neither of them can get out of it".** An establishing shot has to describe the space anyway; the pressure comes along for the ride.

The cut immediately after has to come back to level, though. In the reel R09 is followed by R10 (the unbroken two-shot) and R11 (the over-shoulder), both at human height. **Drop once, return once, and the fall is what registers** — shoot three in a row from above and the audience concludes that is simply how the show looks.

Example frame not generated.
