---
id: low-angle
---

## What it is

The lens drops to roughly 15–30° below the subject's eye line and looks up. **Draw the line against a worm's-eye shot (`worm-eye-angle`) first**: a low angle still sits somewhere between waist and chest height, and the ground still reads as a surface running away behind the subject. A worm's-eye shot is pressed against the floor (near 0°), the ground touches the bottom edge of the frame, and the near leg eats half the picture. The amount of distortion differs by an order of magnitude, and so do the prompts and the failure modes.

The one-line test: **you can still see where their feet are planted, that's a low angle; the foot is already bigger than the head, that's worm's-eye.**

The real problem on the generative side is not "it makes people look powerful" — everyone knows that. The real problem is two things: the model **quietly declines to give you the angle** (you write low angle, you get eye level), and **the moment it does give you the angle, the face starts to break**.

## When to use it

- **The first line out of the villain, or whoever holds the power.** A low angle plus one short line beats any adjective. Put it on the first cut of the exchange, drop back to eye level for the reverses, and the drop does the work.
- **The weaker party's point of view.** Someone seated looking at someone standing, someone kneeling looking up — here the low angle is not rhetoric, it is literally where those eyes are. That is the version the model breaks least, because it has a reason to put the camera there.
- **The moment a character decides something and stands up.** Low angle with a touch of `Tilt Up`, so the rise of the head and the rise of the frame land together. One cut is enough.
- **Giving a product mass.** A bottle, a tower case, an appliance on a countertop: drop the lens just below the counter and shoot up, and the thing turns monumental. This is the safest use of the card, far safer than faces — **objects have no chin.**
- **Hiding a messy floor.** A low angle pushes the ground out of frame and replaces it with ceiling or sky. For cramped, dirty or under-dressed sets, it is cheaper than a redress.

**When not to use it**:

- **Never inside a shot-reverse conversation.** One low-angle cut in a back-and-forth and the audience reads a power relationship, even if all you wanted was a different composition. For a different composition, change the size, not the angle.
- **Not with a wide lens and a close size.** Low angle + wide + close is the most reliable face-breaker in this whole library: a second chin appears, the nostrils face the lens, the forehead shrinks to a strip. Want the angle? Pull back to medium. Want the size? Pull the angle back inside 10°.
- **Not on anything longer than 5 seconds.** An angle is a sentence; cut when it's finished. Hold a low angle past six seconds and the audience slides from "this person is dangerous" to "this shot is odd".
- **Not when you have no design sheet for the ceiling.** A low angle necessarily brings the ceiling into frame and the model will invent one — beams, lamps, a roof pitch that contradicts your set. It will not survive the edit.
- **Not for a piece to camera.** Being looked up at puts an audience on guard, which is precisely what a presenter cannot afford.

## How to prompt it

One cut is normal. Pin the angle in degrees and name what shows up along the top of the frame.

```
medium shot, low angle, lens below the eye line（how many degrees — 20 is the safe value）,
ceiling or sky fills the top（name what is up there: beams, a hanging lamp, fog, flat sky）,
chin line clean and jaw not widened, what the subject is doing,
environment anchors, lighting state
```

- **Always state the degrees**: `low angle, about 20 degrees below the eye line`. Bare `low angle` usually comes back under 5°, which is indistinguishable from level.
- **`ceiling or sky fills the top` is the phrase that forces the angle to be real.** If the angle is genuinely there, the top of the frame has to be ceiling or sky — so pinning the top down removes the model's escape route back to level. It works far better than repeating `low angle` a third time.
- **Name what is up there, item by item**: `dark wooden beams and a hanging oil lamp`. Unnamed, the model invents, and the invention will not match your set.
- **Do not skip the chin clause.** `chin line clean`, `jaw not widened`, `nostrils not exaggerated` — pick one or two. They are not must-phrases (they are not true of every cut; object subjects don't need them), but no face shot should go out without them.
- **The `[Shot k]` passage carries the subject's action**, with `Static Shot`. Pair it with `Tilt Up` if the character is rising, but **do not also add `Push In`** — a low angle plus a push changes the perspective too fast and the face regenerates mid-move.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Degrees below the eye line | 20° | 10–30° | Under 10° the model mostly ignores it and you've written nothing; 20° is the sweet spot between presence and facial integrity; past 30° you enter the distortion zone where chin and nostrils take over the frame — at that point switch to `worm-eye-angle` and give up on the face |
| Ceiling share of frame height | 1/3 | 1/4 – 1/2 | Raise it for more pressure at the cost of shrinking the figure; past half, the subject is no longer the subject, the ceiling is |
| Shot size | medium | wide to close | Closer distorts harder. Close at 20° is the ceiling; anything more aggressive has to retreat past medium |
| Seconds per cut | 3s | 2–5s | Under 2s the angle never registers; past 5s the novelty is gone and only the strangeness is left |
| Wide-lens amount | none | none to slight | The most dangerous knob on the card. A low angle is already stretching perspective; stack a wide lens and the chin, nostrils and forehead all fail at once. If you truly need the wide, drop the angle back to 10° |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Fake low | You wrote low angle and got something nearly level, just a bit shorter | Pin the degrees (`about 20 degrees below the eye line`) and add `ceiling or sky fills the top` to force the top of the frame |
| Double chin | The underside of the chin renders as a second chin; neck and jaw fuse into one mass | Add `chin line clean` and `jaw not widened`; simultaneously drop to 15° and back off to medium |
| Nostril show | The nostrils become the centre of the frame, two dark holes dragging the face down | Add `nostrils not exaggerated`, and have the subject **tip their head down slightly toward the lens** rather than holding it level |
| Grown ceiling | Beams, lamps and ducts appear that are nowhere in the design sheets | Name what's overhead item by item and attach the location sheet; outdoors, pin it as `flat overcast sky, no branches` |
| Push-in face swap | Low angle plus `Push In` and the features slowly become someone else | One thing per cut. Give the low-angle cut `Static Shot`; if you need a push, take another cut and return the angle to level |

## Examples

*The Letter Back*, R05: the son climbing, the lens set down at the foot of the stairwell shaft at knee height and tilting up, four flights of iron railing spiralling toward a pale skylight. Wide, 4s, `Tilt Up`.

It satisfies `ceiling or sky fills the top` cleanly, and it does so indoors — what fills the top is not sky but the skylight at the head of the shaft. The railings are convergence lines you get for free; the steeper the tilt, the tighter they close.

Two things worth noticing. First, **this sits right on the card's lower edge**: knee height is a good deal below the waist-to-chest default, and the only thing keeping it out of `worm-eye-angle` territory is that the stairwell floor is not pressed to the bottom edge — it still recedes into the picture. Second, **nobody is made to loom.** The son is a small figure at the third-floor turn. A low angle is not only for presence; it is just as good at pushing a space open above someone's head.

Example frame not generated.
