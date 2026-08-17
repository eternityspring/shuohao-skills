---
id: static-hold
---

## What it is

The camera is locked off. Position, lens axis and focal length hold for the whole cut; the frame edges are nailed down.

**This is not the same as "no camera move specified."** No move specified means nobody thought about it. A static hold means somebody thought about it and decided to hand every scrap of movement to the people and things inside the frame. **Holding still is itself a statement** — it says "this does not need me to underline it, look for yourself."

The move it gets confused with is a slight shake. The test is the frame: **if the frame moves it is a shake; if only the contents of the frame move it is a static hold.**

In generative video there is one more reason nobody gets to ignore: **a cut where the camera does not move is the cut where the model has the least to recompute, so it is the cheapest cut you own in consistency terms.** The higher the proportion of static cuts in a scene, the less your faces drift. Twenty-four of the thirty-six cuts in *The Letter Back* are static — that is not timidity, that is budgeting.

## When to use it

- **The default bed for dialogue.** Both sides of the shot-reverse hold still, and only the cut where the emotion turns gets a push. If everything moves, nobody can hear which line mattered.
- **Cutting to the listener after a hard line.** A reaction cut has to be static: the entire content of that cut is the change on that face, and any camera move steals the attention.
- **An establishing cut the audience has to search.** Four static seconds on a wide — the fogged ferry landing, the figure squatting in the distance — lets their eyes do the scanning, which involves them far more than scanning it for them.
- **The front-on cut in talking-head and product work.** A presenter addressing the lens, a product sitting on a surface. Move the camera and it turns into an advert.
- **The first few cuts after a character is locked.** Use static holds to nail the face, the clothes and the lighting ratio, then hang those cuts as reference images for the moving ones that follow.

**When not to use it**:

- **Not when two people are far apart and the distance is the point.** A static frame cannot state space; that is what a truck or a push is for.
- **Not four or more consecutive static cuts.** It starts reading as a slideshow. Something has to move every three or four cuts to keep a pulse.
- **Not when the subject is still either.** Camera still, person still, light steady, and you have shipped a photograph that plays for four seconds. Either give the subject an action or switch to a slight shake.
- **Not at the peak of action.** Fights, chases, falls — a locked frame turns them into weightless flailing.

## How to prompt it

One cut. **The hard part is not the camera word, it is naming what moves** — leave that out and the model hands you a photograph.

```
medium shot, frame edges stay locked（position, axis and focal length hold throughout）,
who the subject is and what they are doing（that action is the entire movement in this cut）,
small motion inside the frame（breath, a hem, smoke, drifting fog, water — name two or three）,
environment anchors named item by item, lighting state
```

- **`frame edges stay locked` governs the frame; `small motion inside the frame` governs what is inside it.** Write only the first and you get a photograph; write only the second and the model helpfully starts drifting the camera too. They ship as a pair.
- **Name what moves, item by item**: the rise and fall of breath, a hem lifted by wind, pipe smoke curling, fog drifting sideways, ripples on water. Two or three is plenty — more and the model animates all of them at once, and a quiet cut turns busy.
- **Environment anchors go in the prompt, not just in the reference image.** In a static cut the audience stares at the background for the whole duration; how many bowls are on the table, what hangs on the wall — anything vague will slowly change over four seconds.
- **The `[Shot k]` passage carries only the performance** — the action and whether they are speaking. Not one word about the camera; write one and the camera moves.
- Give `Static Shot`. If the cut shares a location with the previous one, **hang that previous cut as a reference image** so the lighting ratio and the set dressing line up.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–6s | Under 2s the audience cannot read a face; past 4s you need dialogue or a visible action holding it up; at 6s it reads dead no matter what |
| Motion items inside frame | 2 | 1–4 | With only one the model tends to drop it, which is the same as giving none; past four it animates them all at once and the quiet cut turns noisy |
| Size of the subject's action | small (a turn of the head, a lifted glance, a hand set down) | tiny to moderate | The bigger the action, the less you need extra motion items; once they stand and walk you want a track or a truck instead |
| Consecutive static cuts | 3 | 1–4 | At four the audience drifts; past four you must insert something moving, even a small push |
| Size | medium | any of the five | Closer costs more in face consistency but sustains duration better; a wide needs environment detail to survive four seconds, and a clean environment will not |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Photograph | Four seconds and not a hair moves; it reads as a slide that got stuck | `small motion inside the frame` is mandatory, with two or three moving things named explicitly |
| Volunteered motion | You asked for stillness and got a slow float or a faint sway | Add `the camera does not move at all` alongside `frame edges stay locked`, and keep every camera verb out of the `[Shot k]` passage |
| Slow morph | Two bowls on the table for the first two seconds, three for the last two | Write the set dressing item by item and hang the previous same-location cut as a reference image |
| Drifting face | The features shift over the back half of the cut, worst in close sizes | Keep it under 3s, always hang the character sheet; if you truly need longer, split it into two cuts and join them |
| Slideshow | Five static cuts back to back and the audience checks out | Count the run. Past four, insert a small push or a truck |

## Examples

*The Letter Back* opens its sitting scene with five straight `Static Shot` cuts: R09, the wide with the two men at opposite ends of the round table; R10, both of them holding the frame for six unbroken seconds; R11, over the son's shoulder as the father starts to speak; R12, the reverse, the son not answering; R13, the reaction hold on the face that is doing the listening. Across all five the position, the axis and the focal length never change, and the frame edges stay pinned. The movement budget is saved until R14 — the slow push onto the son's face, the one beat in the passage that needed underlining.

R13 carries the harder half of this card: **a static hold has to state what moves.** The only motion in that cut is the father's eyes going down to the letter and coming back up. Camera still, mouth closed, bulb steady — that one beat is all that keeps the cut from being a photograph with a three-second runtime.

Five locked cuts in a row work here because the cutting supplies the rhythm: R11 and R12 swap the foreground shoulder, R13 changes the size, and every cut changes the angle. Twenty-four of the film's thirty-six cuts are `Static Shot`; the remaining twelve share out every move in the picture. That is how a movement budget gets saved up.

Example frame not generated.
