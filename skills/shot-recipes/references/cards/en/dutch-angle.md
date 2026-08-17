---
id: dutch-angle
---

## What it is

The whole frame is rotated around the lens axis and then **left there**. The horizon is crooked, the walls are crooked, the person is crooked — but the person is still standing straight relative to the floor. What is tilted is the viewfinder, not the world.

**It pairs with the roll (`roll-move`), and the line between them is time**: a dutch angle is a **state** — the same tilt from the first frame to the last, unchanging within the cut. A roll is a **process** — the frame rotates during the cut, starting and ending at different tilts. One-line test: **if the tilt changes, it's a roll; if it holds, it's a dutch angle.** The prompts are near opposites: a dutch angle keeps insisting on "unchanged", a roll has to specify from how many degrees to how many.

On the generative side the difficulty is not getting a crooked frame. It is **stopping it from straightening itself back up**. The model's prior is strongly horizontal, and over a few seconds of video it will quietly "correct" whatever tilt you gave it.

## When to use it

- **The cut right after something gets exposed.** A lie collapses, an identity is recognised, a fake smile freezes. The previous cut is level, this one leans 12°, and the audience's stomach drops with it. This is the highest-value position for the card.
- **Subjective imbalance.** Drunk, feverish, poisoned, concussed, just dragged out of the water. Here the tilt has a physiological justification, and the model renders it more reliably because it has a reason to lean.
- **One cut inside a chase or a fight.** Slip a crooked frame into a fast sequence and the chaos arrives without you having to stage anything more complicated.
- **A single of the antagonist.** Every cut of the conversation level except theirs, tilted 8°. The audience cannot name what is wrong, but they know something is. **Small tilts work better here** precisely because they do not read as technique.
- **Spaces that really are crooked.** A listing cabin, a half-collapsed house, a hillside road. Now the tilt is describing reality rather than expressing emotion, and you can push to 20° without it feeling like a stunt.

**When not to use it**:

- **Think twice before tilting one cut of a shot-reverse.** The tilted cut reads as "something is off with this person". If you only wanted a different composition, change the size instead. If you genuinely want both cuts tilted, **they must tilt in opposite directions**, or the cut reads as the whole set sliding downhill.
- **Never in a piece to camera.** The presenter is building trust and every degree spends some of it. Same for product work — a tilted product shot reads as "they botched the photo".
- **Not on top of handheld.** Shake plus tilt and the model blends them into a mush that is neither; it just looks broken.
- **Do not stack a wide lens.** A wide lens is already bending straight lines; rotate on top of that and every line in the frame loses its reference, so the audience cannot read the tilt as deliberate.
- **No more than two cuts per scene.** A dutch angle is an exclamation; say it three times and it becomes the show's look rather than this moment's feeling.
- **Nothing under 5°.** Under 5° nobody reads it as a choice — they read it as a frame that wasn't levelled. You pay the cost and buy "these people are amateurs".

## How to prompt it

One cut. Pin the tilt to a number, and state that subject and background rotate **together**.

```
medium shot, dutch angle tilted 12 degrees clockwise（pin a number and a direction）,
tilted horizon line（horizon, window frames, table edges and wall base lines all rotate by the same amount）,
whole frame rotated together（subject and background rotate as one; the figure still stands upright on the floor）,
the tilt is held steady throughout（no return to level）,
what the subject is doing, environment anchors, lighting state
```

- **The tilt must be a concrete number plus a direction**: `tilted 12 degrees clockwise`. Bare `dutch angle` usually lands at 3–5°, which just looks like a frame nobody straightened.
- **`tilted horizon line` needs references attached.** Interiors have no horizon, so name the window frames, table edges, door frames and wall base lines that must rotate with it. Say only "horizon" and interiors ignore it.
- **`whole frame rotated together` guards against the biggest failure of all.** Without it the model often gives you a person leaning on level ground — that is a figure falling over, not a tilted camera, and it reads as the opposite of what you wanted.
- **"Held throughout" needs its own clause.** This is the boundary against the roll, and the thing most often lost in video. Adding `the camera does not roll back to level` makes it stick.
- **The `[Shot k]` passage carries the subject's action only**, with `Static Shot`. Use `Push In` to lift the intensity, holding the tilt constant through the push — **never give a roll camera word**, or you have left this card for `roll-move`.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Degrees of tilt | 12° | 5–20° | Under 5° it reads as sloppy framing; 8–12° is the "can't say what's wrong" sweet spot, ideal for an antagonist single; past 20° the model starts interpreting the tilt as sloped ground and the furniture slides downhill |
| Direction | fixed within a scene | clockwise / counter-clockwise | Two tilted cuts in one scene must lean opposite ways so they cancel; two the same way and the audience reads the whole world sliding |
| Seconds per cut | 2.5s | 2–4s | One of the shortest-lived angles. Past 4s the model's self-correction accumulates visibly, and the audience slides from unease into discomfort |
| Density of use | 1 cut per scene | 1–2 cuts | The effect is entirely the contrast with the level cuts around it. Three in a row and the contrast is gone, leaving only a look |
| Shot size | medium | close to wide | Tilt is hardest to read close — there are not enough straight lines for reference and the audience just thinks the face is wrong. To be read at all, the frame needs at least two lines that ought to be horizontal or vertical |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Self-levelling | The still is crooked, the video is crooked for a second, then rotates back to level | Pin `the tilt is held steady throughout` plus `the camera does not roll back to level`; keep the cut under 3s |
| Leaning person | The figure leans but the floor and walls stay level, as if they are about to fall over | `whole frame rotated together` is mandatory; add `the figure stands upright relative to the floor` |
| Corner wedges | Black triangles in the four corners, as if the image was rotated in an editor | The model is rotating a picture rather than a camera. Rewrite as `the camera is rolled, the frame is fully filled edge to edge`, and keep the tilt under 15° |
| Sliding furniture | Push the tilt too far and the chairs and cups look like they are sliding to the low side | Come back inside 12°; add `objects rest naturally on the floor` |
| Unreadable tilt | It is tilted, but the frame is all face and fabric and nobody can tell | The composition must keep two straight lines: window frame, door frame, table edge, gunwale, wall base. Pick two and write them into the prompt |

## Examples

*The Letter Back* never uses one — all 36 cuts are level, and the film's premise does not support a tilt. Nothing surreal happens between these two men, nothing comes off the rails, and the feeling stays pinned below the waterline throughout.

There is one moment worth imagining, though: **the beat where the son works the letter out and makes up his mind**, which is R14. Note that **R14 itself is not the frame to tilt.** It is a close pushing slowly in, containing one face and a wall dissolving behind it — no straight lines to read a tilt against, so the audience will not perceive a crooked frame at all, only a badly drawn face.

The frame to tilt is the room cut next to it — the framing of R33, as he stands and leaves. **The framing, not the whip: never put a whip and a tilt in the same cut.** That picture comes with three hard straight lines already in it: the top edge of the chest-high wainscot, the rim of the round table, and the flex of the bare bulb hanging above it. **That flex is a real plumb line — the instant it leans, the audience knows the frame is crooked and the room is not.** Twelve degrees clockwise and all three go over together, and "this decision is wrong" gets said without anybody saying it — held rock steady from the first frame to the last, with no roll back to level, because rolling back turns it into `roll-move`.

Example frame not generated.
