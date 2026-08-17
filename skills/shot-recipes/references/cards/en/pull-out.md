---
id: pull-out
---

## What it is

The whole camera retreats. The lens axis and the focal length hold; the subject gets smaller in frame while the space behind them opens layer by layer.

**Draw a line first.** The library also holds `pull-reveal`, which is a **recipe card**: it answers "how do I cut the last beat of this scene" — start on a detail, retreat to the whole, and let the widening frame deliver a fact the audience did not have. This is a **technique card**: it answers only "what is retreating, when do I reach for it, where does it break". For the reveal, go read `pull-reveal`. For the feel and the failure modes of backing the camera away, stay here.

**Against a `Zoom Out` the difference mirrors the push/zoom pair exactly**: retreating changes the camera position, so the subject shrinks faster than the background and real depth opens up; zooming out shortens the lens, everything shrinks together, and the space is flat.

The one-line test: **want the audience to withdraw and feel the person get smaller, pull out; only want them to see more, zoom out.**

## When to use it

- **Ending a scene.** The line has landed, the person is still standing there, and the camera backs off — no extra dialogue needed, the audience reads "he has been left behind" on their own.
- **Making somebody small.** The argument is over, the verdict is in, the boat has gone. Watching the same person shrink from protagonist to part of the scenery inside one cut is this card's hardest punch.
- **Stating where all that just happened.** Several close cuts have piled up questions; back off once and hand over the place.
- **Product, from detail back to whole.** Start on a piece of craft and retreat to the complete object — more continuous than cutting.
- **Closing a vlog segment.** Finish the thought, back off into the room, and the rhythm settles without a transition effect.

**When not to use it**:

- **Not against a busy background.** Markets, bookshelves, crowds, signage — every new inch that enters frame is open season for the model, and the messier the background the more it invents.
- **Never two size steps in one breath.** Medium to extreme wide doubles the new area, shrinks the subject to a handful of pixels, and throws away everything you had established.
- **Not while the subject does something important.** The retreat and the action compete and neither reads. Shoot the action static, then take a separate cut to back away.
- **Not in the middle of a passage.** Retreating inherently says "that is the end of that", so mid-scene it convinces the audience the story stopped and you have to win their attention back.
- **Not when the point is that the place is suffocating.** Backing off hands out space, which fights the feeling.

## How to prompt it

One cut. **Everything that enters frame at the end has to be named item by item** — any position you leave unnamed is a position the model gets to fill.

```
medium shot at the start（who the subject is, where they sit in frame）,
camera moves backward away from the subject（what size it ends on — e.g. ends framed at full body）,
subject shrinks faster than the background（the subject recedes while layers open behind）,
depth opens up behind the subject（real recession, not a flat reduction）,
what enters frame at the end named item by item（X on the left, Y on the right, the ground material）, lighting state
```

- **Write the amount as an end size, not a multiplier**: `ends framed at full body`, `ends with the whole pier in frame`.
- **`depth opens up behind the subject` is the line against `Zoom Out`.** Leave it out and you get a frame that widens with no recession in it at all.
- **Keep the naming to three items.** More and the clauses crowd each other, the model drops whatever sits last, and the dropped position is exactly where it improvises.
- **Pin the subject to the middle.** During a retreat the subject drifts to the edge and sometimes out of frame; add `the subject stays centred throughout`.
- **The `[Shot k]` passage says only that the camera is backing away.** The subject holds still or does one tiny thing. Give `Pull Out`.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–6s | Under 3s all the audience sees is a frame getting wider, not a withdrawal; over 6s there is too much new area and the odds of invented scenery climb |
| Travel amount | one size step | half a step to two steps | One step is the safe setting; two has more scale but doubles the new area, and new area is exactly where things grow |
| Items named at the end | 3 | 2–5 | The more you name the tighter it locks; past five the model starts dropping items, and it drops the last ones |
| Speed | slow and even | slow to moderate | A slow retreat is emotion, a fast one is flight; snap it and the model drags the subject backwards too |
| Background complexity | simple | simple to moderate | The entire risk of this cut lives on this row. The cleaner the background, the more reliable the card |
| Subject position | centre | centre to a third line | Off centre and the retreat squeezes them out of frame |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Grown scenery | Furniture, passers-by and signage that were never written appear once the frame widens | Name the end content item by item, hang the location sheet, and cut the travel to one step — all three at once |
| Retreated into a zoom | The view widens with no recession, like a photograph being scaled down | `depth opens up behind the subject` and `subject shrinks faster than the background`, neither one optional |
| Subject leaves frame | They drift to the edge during the retreat and the last half second is without them | Pin it: `the subject stays centred throughout` |
| Wrong direction | What comes back is getting closer, not further | Give `Pull Out` and restate the backward direction inside the `[Shot k]` passage |
| Weather change | Overcast at the start, sunny at the end, lighting ratios that will not cut | One lighting sentence shared by start and end, plus the previous same-location cut hung as a reference image |

## Examples

*The Letter Back* R36, the last cut in the film: the son crosses the courtyard away from camera, the camera retreats for five seconds, and the shot ends on the whole block — six storeys of balconies filling the frame, one fourth-floor window still burning warm, every other window cold.

Three things are worth noting. **One, he shrinks faster than the background.** The prompt pins that clause, so the layers behind him genuinely open out as the camera withdraws instead of the whole picture scaling down uniformly — which is exactly the line between a pull-out and a zoom out. **Two, the area it opens is empty**: a bicycle shed and two drying lines are all that is down there, and R01 and R02 have already shown the audience that same courtyard. **Put a retreat where the background costs least**, or you will lose a scene's ending to three passers-by that grew out of nothing. **Three, it stops at `wide`** and does not run all the way out to extreme wide.

This cut is not a reveal: the audience met the block back in R01, and pulling out only puts the man back where he came from. Using a retreat to state something the audience did not know is the job of the recipe card `pull-reveal`.

The example frame is exactly this cut (R36).
