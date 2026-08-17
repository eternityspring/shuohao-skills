---
id: foreground-occlusion
---

## What it is

Put an object close to the lens so it blocks part of the frame: the edge of a doorframe, leaves, a railing, a bottle on the table, a body crossing in front. **Its relationship to `ots-shot-reverse` is containment**: the over-the-shoulder is this move specialised for dialogue, where the blocker is always the listener's shoulder and head, and the cut count and the side-swap are prescribed. This card is the general technique — the blocker can be anything, the subject can be alone, and there need be no dialogue at all.

The one-line test: **two people talking with the listener's shoulder in front, use `ots-shot-reverse`; everything else, use this card.**

What it actually buys is **the audience's position**: block a corner of the frame and they assume they are hiding behind whatever is doing the blocking. Translated into words a model obeys: do not write "with a foreground element". Write what the object is, which edge it enters from, and which part of the subject it hides — **that last clause is the whole card, and without it the model politely parks the object beside the subject where it blocks nothing.**

## When to use it

- **Surveillance and spying.** Watching the subject through leaves, shelving, a car window. The audience becomes the person tailing them, far cheaper than cutting to a point-of-view frame.
- **Depth on the cheap.** One solid object near the lens turns a flat frame into a near-and-far frame, with no lens change and no repositioning.
- **Hiding what should not be shown.** Blood, a wound, a body — block seventy percent of it and the cut lands harder than the full view, and clears review more easily.
- **Crowding.** Shoot past a silhouette, the back of a head, a shoulder, and the frame says "this place is full of people" without generating a crowd.
- **Product and talking head.** A table corner, a plant, the edge of a lampshade entering from one side turns a clean studio setup into something that looks like a real room.

**When not to use it**:

- **Not when the subject is already small and far.** Block any more and there is nothing left to watch but a search.
- **Not on a cut that already uses a frame within a frame.** Two layers of blocking stack into mush with no legible edges.
- **Not on the cut that carries the detail.** Handwork, a product's ports, a prop changing hands — occlusion and information are natural enemies.
- **Not with a horizontal blocker in 9:16.** A vertical frame is narrow, and a horizontal foreground object cuts it clean in half, leaving the subject in two strips.

## How to prompt it

One cut is the norm. Pin the amount of blocking; never write "partially obscured" — the model has no quantity attached to "partially".

```
medium shot, what the subject is doing, foreground object cuts across the frame edge
（what it is, which side it enters from, how much width it takes）,
part of the subject hidden behind it（which part: half a shoulder / one leg /
the left side of the face）, how blurred and how bright the foreground is,
background and lighting state
```

- **"There is a tree in the foreground" is nowhere near enough.** The model paints the tree beside the subject and blocks nothing. `part of the subject hidden behind it` is the clause that forces the overlap.
- **The blocker must enter from a frame edge.** An object sitting wholly inside the frame gets treated as a second subject and rendered in full detail, which destroys the near/far read. `cuts across the frame edge` is what makes it foreground.
- **Give the blur its own clause.** Heavier blur looks more like finished footage, but overdo it and the model collapses the foreground into a slab of colour — the same disease as "foreground turns into a wall" on the over-the-shoulder card.
- **In 9:16, use upright blockers**: a doorframe edge, a post, someone's body in profile, a hanging curtain, entering from the left or right and taking a quarter to a third of the width. Never cut a vertical frame in half with a horizontal object.
- **The `[Shot k]` passage carries the subject's action**; the blocker holds still by default. If it has to move (someone crossing in front of the lens), give that its own sentence and state that the crossing occupies only the first half of the cut.
- **Keep the foreground two stops under the subject.** A foreground brighter than the subject steals the eye and the audience never looks at the person. State that it is out of focus and darker, and it stays scenery instead of becoming the star.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Foreground's share of width | one quarter | 1/6 – 1/2 | Push it up for more depth and more of a spying feel; past 1/2 the audience starts hunting for the subject and the scene breaks |
| How much of the subject is hidden | 20% | 10%–50% | At 10% it reads as a framing error rather than a choice; past 50% you are hiding, not blocking — reserve that for deliberate withholding |
| Foreground blur | medium | light – heavy | Heavier looks more cinematic; too heavy and the foreground collapses into a slab the model repaints as a wall or a shadow |
| Foreground-to-subject brightness | 2 stops darker | 1–3 stops | Darker reads more like a frame; past 3 stops it becomes a solid black block and the depth disappears with it |
| Seconds per cut | 3s | 2–5s | A static blocker can hold long; a body crossing in front wants 2–3s, because the same person passing twice reads as fake |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| No blocking | The foreground object appears but stands politely beside the subject, hiding nothing | `part of the subject hidden behind it` is mandatory, and name the part |
| Colour slab | The foreground blurs into one dark shape nobody can identify | Drop the blur one step and name the object (`the edge of a wooden post`) |
| Stolen focus | The foreground is sharp and more detailed than the subject; the audience watches it instead | Pull the foreground two stops down and state explicitly that it sits outside the focus plane |
| Extra arm | You wrote "someone passes in front" and the model grew the subject a third arm | Give the passer their own sentence and state that they do not touch the subject; if it persists, switch to a static solid blocker |
| Halved vertical | In 9:16 a horizontal blocker cuts the frame in two and the subject survives as a strip | Switch to an upright blocker entering from the left or right |

## Examples

*The Letter Back* R17: a medium with the red enamel flask standing tall right by the lens, running out of the bottom of the picture and up through the left third. Half the father's face is lost behind the body of the flask; one eye and the line of his jaw survive past it. The flask is soft, the father is sharp. Three seconds, locked off.

**Four things are pinned, which is why the block actually happens**: what the object is (the flask), which edge it enters from (bottom, running up), how much width it takes (the left third), and which part of the subject it hides (half the face, one eye left over). Drop that last clause and the render parks the flask politely beside the father, blocking nothing, and the frame stays flat. Note also that the occluder is a prop, not a listener's shoulder — a shoulder would belong to the over-the-shoulder card; this one is the general-purpose move.

Example frame not generated.
