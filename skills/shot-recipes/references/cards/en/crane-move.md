---
id: crane-move
---

## What it is

On a live set a crane is a long counterweighted arm with the camera on its far end. What it uniquely does is a pedestal and a tilt at once: **the camera rises while the lens tips down to keep looking at the subject.**

So the line against the two neighbouring cards is drawn by one question — **are the verticals and the horizon changing at the same time?**

- **`pedestal-move`**: the camera changes height with the lens axis dead level. Verticals stay straight and parallel; the horizon barely moves in frame.
- **`tilt-move`**: the camera stays planted and looks up or down. The horizon visibly slides while the camera's height never changes.
- **A crane**: both at once. Verticals start converging toward the middle of frame, the horizon climbs, and the subject shrinks as it goes.

The one-line test: **if only one of the two is changing, it is not a crane — it is a pedestal or a tilt.**

### H3 takes one camera word per cut — this section is why the card exists

In generative terms a crane is a **compound move**: Pedestal Up plus Tilt Down. H3 accepts a single camera word per cut, and if you hand it two it splits the difference — it neither gets the height nor tips the head, doing half of each and delivering a cut nobody can read.

Two workable routes, in order of precision:

- **A: take two cuts.** Cut 1 is `Pedestal Up` with the axis held level, lifting away from the ground; cut 2 is `Tilt Down`, camera planted, head lowered. **This is the safest option, and it costs you an edit** — a single continuous lift is broken into two sentences.
- **B: one camera word per cut, the other motion carried by description.** Give `Pedestal Up`, then write `the lens tips down to keep him in frame as it rises` in the description. The model returns an approximation — it starts tipping about halfway up rather than evenly — but it is continuous, and at short-drama scale that is plenty.

**A descending crane works the same way**: give `Pedestal Down` and describe the lens levelling up on the way; split it and cut 1 is `Pedestal Down`, cut 2 is `Tilt Up`.

A real crane also sweeps sideways through a large arc. That half is not on this card — a lateral curve is `arc-move`, a lateral straight line is `truck-move`. This card is only the vertical compound.

## When to use it

- **Ending a scene by handing the character over to the place.** The words are said, they stay put, the camera rises and looks down — they shrink until they are simply one person in this courtyard. This is the crane's oldest cut and the hardest one to fake by other means.
- **Opening a whole scene out from one person.** Start on someone at the edge of a crowd, rise and tip down, and only then does it turn out two hundred people are standing there. A pedestal cannot do this: rise with the axis level and what you see is the opposite wall, not the ground below.
- **Coming down to start a passage.** Drop from roofline to a face, levelling up as you go — more of a "here we go" than cutting from a wide to a medium.
- **Places with vertical layers.** Jetties, staircases, terraces, courtyards, markets. **The test is: is there anything to see from up there?** If not, do not rise.
- **Products and spaces, whole down to detail.** Start on the full display, sink to one piece of workmanship — more continuous than an extra cut.

**When not to use it**:

- **Not when all you want is a change of height.** If you are changing the audience's altitude rather than their attitude, `pedestal-move` does it cleanly with one camera word. A crane is a compound move at double the cost and double the risk — **do not crane for the sake of craning**, which is this card's most common misuse.
- **Not when your reference images never show what the place looks like from above.** The ground, the roofs and the crowd layout at the top of the move are entirely invented, and the higher you go the more of it is invented.
- **Not on a cut with dialogue.** The face slides down and shrinks at once, the audience spends the cut chasing it, and the line is wasted.
- **Not in low spaces.** Cabins, carriages, low-ceilinged interiors physically cannot hold the lift; the model returns an interior with no ceiling, which reads as an obvious mistake.
- **Never stack a push in or a truck on top.** A crane is already two motions; add a third and the perspective collapses midway.

## How to prompt it

**Pin the start height, the end height and the final downward angle**, and give exactly one camera word.

```
medium shot at the start（where the subject is, what surrounds them, camera height:
chest / standing eye level）,
the camera rises to（end height: eaves height / second-floor height）,
height and angle change together（the lens lowers as the camera climbs, ending about
thirty degrees down）,
subject stays in frame as the height changes（the subject never leaves frame and ends
at a fifth of frame height）,
what the height reveals, named item by item（ground material, how many people in the
yard, roof colour）, lighting state
```

- **Give heights as parts of a building, not metres**: `up to eaves height`, `up to second-floor height`. `rises four meters` means nothing to the model.
- **`height and angle change together` is the line against `pedestal-move`.** Leave it out and the model rises without tipping; by the end the subject has slid out of the bottom of frame and you own a cut of a blank wall.
- **`subject stays in frame as the height changes` is the acceptance test.** Subjects get abandoned outside the frame during vertical moves more than any other kind — this pins them. Pin their final size in the same breath.
- **Name what the height reveals, item by item**: ground material, headcount, roof colour. **This is the most valuable line on the card** — every part of the newly revealed area you fail to name is the model's to invent.
- **The `[Shot k]` passage carries one camera word**: `Pedestal Up` or `Pedestal Down`. The tip is carried by the description above; never add a second word. If you need precision, take two cuts and give each one its own word.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–6s | A compound move needs more time to read than a simple one. Under 3s the audience sees only shrinking and never registers the climb; over 6s the newly revealed area gets large enough that invention scales with it |
| Rise | two body heights | one body height – second floor | Under one body height you may as well use a plain pedestal; above second-floor height the ground below appears in none of your reference images and the model invents the lot |
| Final downward angle | 30° | 15–60° | Under 15° it is indistinguishable from a pedestal and the compound was wasted; over 60° it slides into a top-down view where a person is just a scalp — switch to `overhead-angle` |
| Subject height in frame | 1/2 at the start → 1/5 at the end | 1/8 – 1/3 at the end | Smaller reads more like an ending; below 1/8 nobody can find the person. Above 1/3 you did not rise far enough and the cut says nothing new |
| Shared anchor across the move | 1 | 1–2 | Keep one thing visible at both ends — a tree, a flagpole, the subject themselves. Without it the model treats start and end as two different locations and swaps the place out midway |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Rise without tip | The camera climbs all right, and the cut ends on a blank wall with the subject long gone below the frame | `height and angle change together` and `subject stays in frame as the height changes` — neither is optional |
| Split the difference | You gave two camera words and got half a metre of rise and ten degrees of tip, with neither completed | One camera word per cut. If both motions must land, take two: `Pedestal Up` then `Tilt Down` |
| Grown courtyard | Once you are up there, side buildings, water jars and wandering extras appear that were never written | Name what the height reveals with counts pinned ("four people", never "some people"), and attach the location sheet |
| Bent architecture | As the frame climbs, door frames and pillars converge and bend, as if the building were squeezed | Cut the rise back to two body heights and the angle to 30°, and name one full-height vertical in the opening framing |
| Subject vanishes | By the end the person is too small to identify and the emotional point lands nowhere | Pin the final size at a fifth of frame height and give the subject a colour that contrasts with the ground |

## Examples

There is no crane in *The Letter Back*. The film owns three spaces, and two of them — the flat and the corridor — are too low to hold a lift at all. Outdoors would hold one, but both ends of it are already spoken for: R01 opens hanging in the air, R36 closes on a level pull out, and nothing in between leaves room for a climb from human height. **"Not in low spaces" alone rules out two thirds of the picture.**

Its two nearest relatives each own half of it:

- **R01, the aerial** (extreme wide, `Truck Right`, 5s) **has the height but not the journey.** The camera hangs two or three storeys above the roofs from the first frame to the last, and the subject never changes size. A crane is precisely that journey — start at human height, finish high, and shrink the subject in between.
- **R05, the stairwell tilt** (wide, `Tilt Up`, 4s) **has the tilt but no change of height.** The lens is planted at knee height at the bottom of the shaft and only raises its head to take in four flights of spiralling railing. A crane needs height and angle changing **together**.

Put plainly: R01 is missing the climb, R05 is missing the actual change of camera height. Fold both halves into one cut and you have a crane.

To attach it here, the place is the ending: the son steps out of the block and stops in the courtyard, and the camera rises from chest height to second-floor height, tipping down the whole way, until he is one small patch of dark blue on the concrete — with the concrete, the bicycle shed and the two drying lines named item by item. The film does not do that; it takes the `pull-out` in R36 instead. The two say very nearly the same thing, and the difference is that a crane adds the look from above, which reads as "he was left there" — while *The Letter Back* wants "he left, and the fourth-floor window is still lit". The pull out is the right one for that.

Example frame not generated.
