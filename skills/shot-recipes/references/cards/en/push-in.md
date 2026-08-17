---
id: push-in
---

## What it is

The whole camera travels forward. The lens axis does not turn, the focal length does not change; the camera simply ends up closer.

**This and the zoom are the pair this vocabulary confuses most often, and the difference is not cosmetic.** Moving the body forward and lengthening the lens produce completely different images: a push changes the camera position, so perspective changes with it — the subject magnifies faster than the background, the stuff behind them falls away, and the audience feels *I walked in*. A zoom leaves the position alone and simply magnifies everything at the same rate, perspective frozen, and the audience feels *I can see it better*.

The one-line test: **want the audience closer to him, push; only want them to see him clearly, zoom.** That other card is `zoom-move`, and its must-phrases are the exact inverse of these.

Generative video adds a third difference: a push forces the model to recompute perspective across the whole cut, so **it is far more expensive than a zoom and far more likely to fall apart**. Spend pushes sparingly and precisely.

## When to use it

- **Pressing in after a hard line.** Hold both sides of the shot-reverse static and give the push only to the cut where the emotion turns — the audience hears that one line differently.
- **The moment somebody decides.** A fist closing, eyes coming up, a chin setting. The push takes an inward action and makes it an event.
- **Lifting one detail out of its surroundings.** A pocket, a clasp, a letter on a table: the start of the move still shows the room, the end holds only the thing.
- **The key sentence in a talking-head passage.** The presenter reaches the point, the frame creeps one size tighter, and the audience sits up without being told to.
- **Material and craft on a product.** From the whole object down to a chamfer or a line of stitching — one cut states both "where this is" and "how good this is".

**When not to use it**:

- **Not twice in one scene.** If every cut pushes, every line is the important one, which means none of them are. One per passage, maximum.
- **Not from an already-close start.** Push further in from a close size and you end on half a face, and the features will drift. Emphasise by holding longer or by cutting to a tighter static frame instead.
- **Not over a large action.** Standing, turning, a swung arm colliding with a push — the model bends the body and grows extra hands.
- **Never with a truck or a zoom in the same cut.** Two motions stacked and the model re-imagines the entire space.
- **Not when you only want the thing seen clearly.** That is the zoom's job. Do not use a push to write a spec sheet.

## How to prompt it

One cut. **Pin the travel as a change of size; never write "slowly pushes in".**

```
medium shot at the start（where the subject sits in frame, what is around them）,
camera moves forward toward the subject（what size it ends on — e.g. ends framed from the chest up）,
subject grows faster than the background（the subject enlarges while the background falls away）,
perspective shifts during the move（geometry changes with the camera, not a flat magnification）,
the small thing the subject does during the cut, the two or three items left at the end named, lighting state
```

- **Measure the move in end size, not multipliers**: `ends framed from the chest up`, `ends on the hands only`. `pushes in 30%` means nothing to the model.
- **The two must-phrases are the line between this card and `zoom-move`.** Drop `perspective shifts during the move` and you will almost certainly get a zoom back — the image enlarges and the space is flat.
- **Name what survives to the end of the move.** A push squeezes most of the environment out of frame; whatever remains has to be written down, or the model will invent replacements.
- **The `[Shot k]` passage says only that the camera travels forward.** The subject's own small action gets its own sentence. Give `Push In`.
- **If the starting frame already exists, hang it as a reference image** — lighting ratio, wardrobe and background dressing ride on it for the whole move.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–6s | Under 3s the push becomes a collision and the emotion never catches up; over 6s the audience is waiting for it to stop and the beat leaks away |
| Travel amount | one size step | half a step to two steps | Half a step looks most like finished film and breaks least; two steps (medium to extreme-close) is powerful and doubles the odds the features fall apart |
| Speed | slow and even | slow to moderate | A slow push is emotion, a fast push is a scare; anything approaching a snap should be a zoom instead — fast dolly work almost always wrecks the model's perspective |
| Items named at the end | 2 | 1–3 | The fewer things left, the easier to pin; needing more than three means you did not push far enough to be worth it |
| Size of the subject's action | tiny | none to small | Smaller is steadier. Anything as big as standing up should be split into two cuts: one for the push, one for the action |
| Pushes per scene | 1 | 1 | This row has no range. The moment a second push appears, the first one stops counting |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Pushed into a zoom | The whole image enlarges, subject and background together, and the space is flat | Write `perspective shifts during the move` and `subject grows faster than the background` together, plus `the camera itself moves closer` |
| Overshoot | You end on half a face with the chin cropped off | Cut the travel to one size step and pin the end as `ends framed from the chest up` |
| Warping face | The nose and chin stretch as the camera nears and the person stops being the person | Always hang the character sheet, and keep the end out of extreme-close; if it is already there, split into a push cut and a static close cut |
| Grown scenery | Objects that were never in the prompt appear once the push lands | Name the two or three items that remain at the end |
| Wobble | The frame sways gently left and right during the move, like handheld | Add `the forward move is smooth and level` to the `[Shot k]` passage, and confirm no shake was requested in the same cut |

## Examples

*The Letter Back* spends `Push In` exactly twice in thirty-six cuts, and the two uses sit at opposite ends of what the move can do.

R14 is the emotional end: a close-up creeping in on the son's face until it fills the frame, eyes sharp and unblinking, the camera advancing at a steady rate with no change of angle. The prompt has the wainscot and the cracked plaster dissolving behind him — **the subject growing faster than the background is the proof that the camera actually travelled**. Write the same cut as a zoom and the wall enlarges along with the face; all the audience gets is "now I can see him".

R28 is the object end: a medium on the red enamel flask, tracked straight in along the centre line of the table, constant speed start to finish, no acceleration, no easing, no arc and no drift.

The two pushes are more than a dozen cuts apart, in two different passages. A push makes the model recompute perspective for the whole cut, which costs more than a zoom and breaks more often than a zoom, so it is spent rarely and spent precisely — two out of thirty-six, and each one lands. R14 hangs off the recipe card `slow-push-face` and R28 off `dolly-track`; this card is only about the act of moving forward.

Example frame not generated.
