---
id: extreme-wide-size
---

## What it is

The subject shrinks to a mark on the frame and the location becomes the lead. **The line between this and a wide is who the shot is about**: in a wide the person is still the subject; here the person is a ruler you use to measure the place.

The one-line test: **cut the person out of the frame — if the shot still works, it is an extreme wide; if it collapses, it was a wide.**

Vertical format adds a rule. A widescreen extreme wide spreads sideways; a vertical frame has no sideways to spend, so it has to stack — sky, distant hills or buildings, the water or road in the middle, an occluder up close. **A vertical extreme wide lives or dies on those layers.** Skip them and you get a thin horizon line between two empty slabs.

## When to use it

- **The opening cut that establishes a place.** Time of day, weather, what kind of place this is — one cut, and the rest of the scene never has to explain it again.
- **The pressure release after a heavy beat.** Someone says the unforgivable thing; cut to an extreme wide and let the environment swallow them while the audience breathes.
- **How far apart two people are.** A chase, a farewell, the distance before a confrontation. No other size can state that.
- **Time passing.** Repeat the same extreme wide with different light and the audience reads half a day gone, no title card needed.
- **A vlog arrival.** First look at a new place: the person is small, the place is big.

**When not to use it**:

- **Not on a cut with dialogue.** The mouth is a few pixels wide, lip sync is hopeless, and nobody can even tell who is speaking. Put lines on a medium or tighter.
- **Not to sell sideways vastness in vertical.** The left and right of the world are already cropped away. In vertical, vastness comes from depth and layering, never from width.
- **Not for a lead's first appearance.** The audience has no face to attach to a speck. Give a medium to learn the face, then an extreme wide for the place.
- **Never twice in a row.** Two extreme wides back to back and the second one reads as no cut at all — the rhythm hits the floor.

## How to prompt it

One cut is the norm. Pin where the figure sits in frame and how much of it they occupy; do not expect the model to hold back on its own.

```
extreme wide shot, what this place is（one pinned sentence: the courtyard of an old housing block
drowned in fog / a factory yard after the shift）, figure reduced to a speck（where
in frame and how small — e.g. a dot in the lower third, right of centre）,
no facial detail, layers named top to bottom（sky / distant hills or buildings /
water or road in the middle / a near occluder）, where the horizon sits,
weather and light, cinematic film still
```

- **`no facial detail` is the counter-intuitive one.** The model's reflex is to resolve a face, so you get smeared features pasted onto a tiny body — worse than no face at all. Say the detail is not wanted and the model will treat the figure as a silhouette.
- **Pin the figure's position**: "a dot in the lower third, right of centre", not "a person in the distance". How far "the distance" is changes on every generation.
- **Naming the layers top to bottom is the whole information budget of a vertical frame.** Write only "a vast river" and you get a grey rectangle.
- **The `[Shot k]` passage says the camera holds, or moves very slowly.** Any fast move at this size churns distant detail into noise.
- Give `Static Shot`; use `Pull Out` when the point is scale, but pin both the start and the end framing.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Figure height in frame | 1/8 | 1/15 – 1/5 | Smaller makes the place bigger and the person more helpless; under 1/15 nobody finds them and the cut is just scenery; over 1/5 it slides into a wide |
| Seconds per cut | 3s | 2–4s | Under 2s the audience has not located the figure yet; over 4s it reads as an empty landscape and short-form rhythm dies |
| Horizon height | upper third | upper quarter – lower third | Higher makes the ground heavier and the person smaller; drop it to the lower third and sky takes over, turning oppression into emptiness |
| Number of stacked layers | 3 | 2–4 | This is the information budget in vertical. Two layers looks like a sticker; past four the model starts inventing buildings in the middle band |
| Near occluder size | a sixth of frame height | 0 – 1/4 | A reed bed, a railing, an eave up close and depth arrives instantly; past a quarter it hides the subject |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Smeared face | A blob of features pasted on a tiny body, uglier the longer you look | `no facial detail` in the prompt, plus `read as a silhouette` |
| Lost subject | All landscape, no person; the audience has nowhere to look | Raise figure height above 1/8 and give them a colour or a light that contrasts with the background |
| Empty slab | In vertical, sky eats most of the frame and it looks unfinished | Name the layers top to bottom, raise the horizon, let the ground bands carry the height |
| Grown scenery | Towers, bridges and boats appear that are not in the design sheets | Name every layer and pin the count: "one boat", never "some boats" |
| Paper legs | The tiny figure's legs fuse into a flat strip and the walk does not read | No complex action at this size — standing or walking only. Save the action for the wide that follows |

## Examples

*The Letter Back*, R02: the son crossing the courtyard below the block from the right, six storeys of balconies stacked behind him, the figure reduced to a dark blue speck with no facial detail at this distance. 3s, locked off.

The scale is measured off the background: **six floors of balconies are a ruler already standing in the frame.** The man occupies a tiny slice of the picture height, and one look tells you how big the building is and how small he is inside it. Apart from a bicycle shed and two drying lines the courtyard is empty — take him out and the cut still works, which is the test that makes this an extreme wide and not a wide.

The reel holds only two extreme wides, and the other one is R01, trucking across the whole estate from the air. That cut hangs on `drone-shot` and what it demonstrates is the move; R02 is locked off and carries no move at all. **To see what the size alone is doing, look at this one.**

One more cut is worth using as a boundary. R36 pulls back at the end until the entire block fills the frame — about the same amount of place as R02 — yet the reel files it as a wide. The reason is the subject: the son stays a legible human being throughout, and the cut belongs to him. **How much place sits inside the frame does not decide the size; whether the person is still the subject does.**

The example frame is exactly this cut (R02).
