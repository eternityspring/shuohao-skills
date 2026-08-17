---
id: telephoto-compression
---

## What it is

Shoot from far away and the distance between near and far collapses: the background sits behind the subject like a painted flat, and the space in between disappears. **The difference from a dolly move is what happens to the background** — dollying forward keeps the background's proportions and simply shows less of it; a long lens stays put at a distance and enlarges the background until it stacks onto the subject.

**This is one of the few pieces of camera language in AI video that genuinely works when you write it.** The reason is simple: compression does not require the model to understand three-dimensional space. It only requires the background to be drawn bigger, flatter and a little softer, and the model is good at all three. Compare that with "a low angle makes someone look powerful", which the model gets wrong constantly.

**It is also the fastest way to make a frame look expensive.** Same person, same street: a wide lens gives you a documentary, a long lens gives you a film.

## When to use it

- **Someone walking a street, a bridge, a riverbank.** Traffic, crowds and lanterns flatten into one plane and the subject floats out of it.
- **One side of a stand-off.** The long lens flattens everything behind the other person, so the audience's attention has nowhere to go except that face.
- **Passages about being trapped.** A squashed space is itself a statement that there is no way out, and it says it faster than dialogue can.
- **Product against a textured background.** The background reduces to colour and shape and the product's silhouette comes back clean.
- **The upmarket version of talking head.** Put distance between the speaker and the wall behind them and the frame turns from meeting room into magazine.
- **Vertical video especially.** A vertical frame is already narrow; flatten the background and "narrow" stops being a limitation and becomes a style.

**When not to use it**:

- **Not on cuts that establish spatial relationships.** Who is in front of whom, how far apart — compression squeezes all of that information out.
- **Not in small spaces.** A cabin or a car has no distance to compress; write the phrases and nothing whatsoever happens.
- **Not for tracking fast movement.** Long lens plus walking and the model paints the background as a mess of smeared streaks.
- **Never with wide-angle depth in the same cut.** The two instructions fight; the model picks one and you do not get to know which.

## How to prompt it

One cut is the norm. Subject-to-background distance is the precondition for compression existing at all, so pin it.

```
medium shot, compressed perspective, background stacked behind the subject,
what the subject is doing, what the background is（pin the content: traffic /
lanterns / reeds / a crowd）, how enlarged the background reads（write it as a
comparison: the far lantern looks as big as a human head）, how far the background
sits behind the subject, background blur level, lighting state, cinematic film still
```

- **`background stacked behind the subject` is the load-bearing line.** Given only `compressed perspective` the model often hears "blur the background" — but blur is not compression. Blur softens; compression enlarges the distance and pastes it forward.
- **The background must have content.** A blank wall compresses into nothing. Compression wants layers: a row of lanterns, a line of cars, a reed bed, a crowd.
- **Write the enlargement as a comparison**: "the far lantern looks as big as a human head" beats any multiplier.
- **`85mm feel` or `135mm feel` are fine additions** — field of view phrasing, not camera settings.
- `Static Shot` is the safest. If it must move, a very slow lateral `Tracking Shot`; never a move toward or away from the subject.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Compression strength | medium (85mm view) | 70mm – 200mm view | Longer makes the background bigger and flatter; at the 200mm end it is essentially wallpaper — and that is also where the model starts painting fake repeating patterns |
| Subject-to-background distance | five metres or more | three metres – tens of metres | The single precondition. Without distance there is nothing to compress and the phrases do nothing |
| Background blur | medium | light – strong | A little blur looks more expensive; blurred to mush wastes the compression, since the pleasure of it is recognising things that have been flattened |
| Background layers | 2 | 1 – 3 | More layers is more spectacular — a row of lanterns, the roofs across the water. Past three the model inverts which layer is in front |
| Seconds per cut | 4s | 2–6s | Long-lens cuts can hold longer because the image is already still; past 6s the repeating background patterns start crawling |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Blur without compression | The background is soft but the space is unchanged | `background stacked behind the subject` is mandatory, and pin the distance at five metres or more |
| Wallpaper background | The flattened background turns into a repeating pattern | Drop compression one notch and name the background item by item (three lanterns, two boats) instead of "a sea of lights" |
| Smeared streaks | Long lens plus walking drags the background into streaks | No forward or backward motion on long-lens cuts; track slowly sideways or hold the camera still |
| Cut-out subject | The subject looks pasted on, with hard edges | Ease the blur one notch and state that the environment lights them: the lantern behind falls on their shoulder |
| Nothing compresses | You wrote a long lens inside a cabin and the frame is unchanged | Small spaces physically have no distance to compress — use the wide-angle card instead |

## Examples

*The Letter Back* R29: a medium from across the room at the flask on the table, with the tabletop, the flask body and the back wall crushed into a single plane. The white mug, the red flask, the wall calendar and the blue glass window stack up as four layers pressed one on top of another, the depth of the room disappears, and the far wall goes soft and sinks dark. Four seconds, locked off.

**The lesson here is how the background is written**: as four named layers — mug, flask, calendar, window — rather than "a cluttered room". What makes compression look good is precisely the things that stay recognisable after being flattened; write the background as a mass and flattening yields only mush. The cut also puts down a lazy assumption: interiors are not automatically uncompressible. The diagonal of one room still buys more than five metres. What genuinely cannot be compressed is a car interior or a lift, where there are not even three.

Example frame not generated.
