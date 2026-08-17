---
id: wide-size
---

## What it is

The whole body is in frame, the feet are on the ground, and the location still reads. **The line against an extreme wide is who the shot is about**: there the person is a ruler, here they are still the subject. **The line against a medium is not a feeling, it is the bottom edge** — feet visible is a wide, cut at the waist is a medium.

The one-line test: **this cut has to show both what they are doing and where they are — that is a wide.**

This card covers wides with a person in them. Landscape with no figure belongs to the extreme wide card.

## When to use it

- **A complete action.** Walking over, crouching, setting something down, turning and leaving. If the action has to read whole, only a wide will do it — a medium crops the legs away.
- **Where two or three people stand.** Who is beside whom, who is further off, who is blocking the door. A wide answers all of it in one cut.
- **The first cut of an entrance.** Someone comes through the door and the wide states what kind of room they walked into. Earn the close-up afterwards.
- **A product in use.** Person and object in one frame: someone at the stove with the pan. What the pan is and what kitchen it lives in, settled at once.
- **The end of an emotional beat.** A person alone in an emptied room. A wide is crueller than a close-up here — a close-up gives you the feeling, a wide gives you the situation.

**When not to use it**:

- **Not through dense dialogue.** Mouths are too small, lip sync will not hold, and nothing on the face reads. Put the talk on a medium.
- **Not with three or more people in vertical.** A vertical frame fits two across. The third gets squeezed out or fused by the model into one body with three arms.
- **Not when the expression is the point.** A face at this size is a few dozen pixels; the model cannot render it and the audience cannot read it.
- **Not before the background is prepared.** A wide exposes the whole set. Anything you fail to name, the model invents — and its invention will not match the surrounding cuts.

## How to prompt it

One cut is the norm. Name the background item by item, like ordering off a menu; anything unnamed is left to the model to improvise.

```
wide shot, full body in frame（where in frame, facing which way）,
feet planted on the ground, the complete action（with a start and an end）,
clothing and carried objects named item by item,
background named item by item（furniture / doors and windows / floor material —
a wide exposes all of it）, a little headroom, lighting state, cinematic film still
```

- **`feet planted on the ground` is the expensive line here.** The model loves to float people half an inch above the floor, and it gets worse over fog, water and grass. Pin the phrase, then say what the ground is made of.
- **Name the background and pin the counts.** Copy the same anchor list into every cut of the scene or the space will jump.
- **Leave a little headroom.** Full body plus a head jammed against the top edge reads like a stretched passport photo.
- **One complete action per cut, and give it an end**: reaching the end of the gangplank, setting the case on the bench. An action with no endpoint just idles.
- Give `Static Shot`; give `Tracking Shot` if the camera walks with them. One or the other, never both.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Figure height in frame | 3/4 | 1/2 – 9/10 | Lower gives more environment and a smaller person; below 1/2 it slides into an extreme wide. Above 9/10 the head and feet start getting cropped and it stops being a wide |
| Seconds per cut | 4s | 2–5s | A wide needs time for the eye to sweep the frame; under 2s it is a blur of a person; over 5s the background begins to move on its own |
| People in frame | 1 | 1–3 | Two is the comfortable ceiling in vertical. A third has to have their position pinned — left, middle, right — or the model stacks bodies |
| Headroom | a twelfth of frame height | 0 – 1/6 | More headroom sinks the figure and makes them look pressed down by the room, good for whoever is losing; zero headroom is airless and the head crowds the edge |
| Background anchors | 3 | 2–5 | Under 2 and the background is mush; over 5 and the model starts improvising things that will not survive to the next cut |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Floating | Feet hovering just above the floor, or swallowed by it | Never drop `feet planted on the ground`, and state the ground material (wet planks / mud / grey brick) |
| Cropped legs | You asked for a wide and the frame cuts at the shin | Write `full body in frame` together with the headroom line; if it still will not hold, step back one size and make this a medium |
| Grown furniture | Cabinets, windows and signage appear that are not in the design sheets | Name the background item by item with pinned counts, and copy the anchor list across every cut in the scene |
| Fused bodies | Two shoulders melt together into one person with three arms | Pin positions and spacing: facing each other across a table, side by side but not touching |
| Broken small face | The face is a few dozen pixels and the features collapse | A wide is not responsible for expression; put the emotion in the next cut and keep expression adjectives out of this prompt |

## Examples

*The Letter Back*, R09 — the first wide inside the flat. The son stands at the left end of the round table, whole body in frame, feet planted on the terrazzo; the father sits at the right end facing him; the letter, the red enamel flask and the white enamel mug hold the wood between them. 4s, locked off.

The test lands on the cut line at the bottom edge: **it falls below the son's feet, so this is a wide and not a medium.** A little headroom above, and the ratio between the man and the room holds up.

What the cut is really for is being the **reference frame for everything that follows**: the chest-high wainscot, the cracked plaster, the ceiling fan, the wall calendar, the blue glass window at the back and all three props are handed over here, once. R11, R17 and R22 are all crops out of this geometry, and every time the audience can reattach the frame to this room on its own. **A wide is not valuable because it looks good; it is valuable because it saves the next dozen cuts from having to explain themselves.**

The example frame is exactly this cut (R09).
