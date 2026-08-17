---
id: dolly-track
---

## What it is

On a live set, track is a length of straight rail laid on the floor with the camera riding a wheeled dolly along it. It does not answer *where the camera goes* — it answers **how exactly it gets there**.

**First, separate it from the three direction cards.** `push-in`, `pull-out` and `truck-move` answer **direction**: forward, backward, sideways. This card answers **texture**: three paces forward on track is a line that is straight, single-speed and exactly repeatable; three paces forward handheld is an approach that breathes. The direction cards and this one stack — **pick the direction there, give that card's camera word, and put the track quality entirely on the two phrases here.**

**Second, separate it from the Steadicam.** `steadicam-move` and this card are two halves of one idea:

- **A Steadicam is free but soft**: it turns corners, climbs stairs, goes through doorways, and its path floats — never twice the same.
- **Track is constrained but exact**: it only runs straight, but that run's speed, height and end points can be reproduced verbatim in the next cut.

The one-line test: **if this move has to be performed identically again in another cut, it has to be track.**

## When to use it

- **Matched product coverage.** The same move performed over three colours and five models, cut together as one set. The moment the motion differs, the audience reads "these were shot separately" — constant speed and repeatability are the entire value here.
- **A very slow push through a piece to camera.** For the few seconds where the speaker reaches the point, close one size step at a perfectly even rate. The audience never notices the camera moving, only the pressure rising. Let it accelerate and the effect collapses into "the camera did something".
- **A push timed to land on one specific line.** Track can make "arrives" and "finishes the sentence" coincide; neither handheld nor a Steadicam hits that beat.
- **An even pass along a row of things.** Shelves, a name list, a wall of photographs. **Evenness is the whole job** — any speed variation and the audience assumes whatever slowed down is worth a second look.
- **One move split across two cuts.** Cut one goes half the distance and cut two continues it; they must be the same line at the same speed, which only track can supply.

**When not to use it**:

- **Not when you have to follow someone round a corner, up steps or through a door.** Track runs straight; that work belongs to `steadicam-move`.
- **Not when the scene wants immediacy or unease.** Absolute evenness is the least live-looking thing on screen — it says "this was arranged". For presence, go handheld: `shake-move`'s `Shake Slightly`.
- **Not when you simply want a push or a pull with no precision requirement.** Use `push-in` or `pull-out` as they stand. This card costs two extra phrases, and phrases are what make a card expensive to attach — **do not pay for precision you do not need.**
- **Not for lateral moves with no foreground.** Track sideways lives on the same precondition as trucking: without near objects sweeping past, nobody can tell the camera moved.
- **Never stack a zoom on top.** The value of track is a clean move; add a zoom and clean is the first casualty.

## How to prompt it

One cut is the norm; take a second only when the same line continues. **Pin where the move ends**, and let the two phrases carry speed and path.

```
medium shot at the start（where the subject is, what surrounds them）, the camera
moves（forward / backward / left / right）（where it ends: framed from the chest up
/ past two shelving units）,
constant speed from start to finish（no acceleration into it and none out of it,
one rate the whole way）,
the camera path stays straight（a straight line — no curve, no vertical float）,
what the subject is doing, foreground and depth anchors named item by item, lighting state
```

- **Never write `dolly`, `track`, `rails` or `on rails` in the prompt.** This is the most immediately useful line on the card: write them and a fair share of generations put the hardware in shot — two glinting metal strips on the floor, a wheeled cart at the bottom edge, or an actual length of rail laid out in a low-camera cut. Track is a method, not a prop.
- **`constant speed from start to finish` is the line against handheld and against the Steadicam.** Leave it out and the model delivers slow-in, rush-through, thump-to-a-stop — that is a software easing curve, not a dolly. Add `no acceleration and no easing` to hold it harder.
- **`the camera path stays straight` is what kills the vertical float.** Models habitually add a little rise and fall to a forward move, and that little rise and fall *is* the handheld flavour you laid track to avoid.
- **One direction word per cut**: `Push In` forward, `Pull Out` back, `Truck Left` / `Truck Right` sideways, `Tracking Shot` alongside a moving subject.
- **When one line spans two cuts, both phrases and the speed description must be word-for-word identical in both prompts**, and cut one should be attached as a reference image for cut two. One word of drift and the second cut invents its own speed.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–6s | Under 3s evenness has no time to be perceived and all the audience registers is that the frame changed; over 6s a perfectly constant move starts reading as mechanical — either give the frame something else that moves, or cut |
| Travel | one size step, or past 2 foreground objects | half a step – two steps | Half a step looks most like finished work; two steps has force but doubles the newly revealed area, and doubles the odds of invented scenery |
| Speed | slow, even | slow – moderate | Moderate is already the ceiling. Faster and the model reads "even" as "sprint", the ending always whips, and every bit of evenness you built is thrown away |
| Ease in / ease out | none | none (not adjustable) | The one knob on this card that must not be turned. Allow a soft start and stop and track becomes visually indistinguishable from handheld, which leaves the card with no reason to exist |
| Depth anchors | 2 | 1–3 | Evenness needs something to be measured against: depth lines for a forward move (corridor, table edge, floor tile joints), near objects sweeping past for a lateral one. With none, even motion and no motion look the same |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Rails in shot | Two metal rails, a wheeled cart, or a pair of metallic reflections appear on the floor | Strike `dolly`, `track` and `rails` from the prompt; the texture comes entirely from the two phrases |
| Slow in, fast out | The move is eased: creeping start, rushing middle, a bump at the stop | `constant speed from start to finish` is mandatory; add `no acceleration and no easing` |
| Stolen float | The frame rises and falls gently during a straight push, as if someone were carrying it | `the camera path stays straight` is mandatory, and drop `handheld`, `organic` and `natural` from this cut |
| Cuts do not join | One move split across two cuts, and the second has a different speed and camera height — it edits like two different rigs | Keep the phrases and the speed description word-for-word identical, and attach cut one as a reference for cut two |
| Stolen curve | You asked for a straight line and it starts bending around the subject halfway — that is an orbit | Add `the camera does not curve around the subject`; for lateral moves, carry over `truck-move`'s "stay parallel to the subject" wording as well |

## Examples

*The Letter Back*, R28: the camera moves straight in on the red enamel flask along the centre line of the round table, one rate the whole way, no acceleration into it and none out of it, no curve and no vertical float; the flask grows steadily while the pale green wainscot behind it holds its place. Medium, 5s, `Push In`.

Both required phrases are present, and each has its negation attached — `no acceleration and no easing` holds down the easing curve, `no arc and no drift` holds down the stolen curve. That is this card's "add a clause to hold it harder" done exactly as written. The words `dolly`, `track` and `rails` appear nowhere in the prompt, so no rail grows on the floor. The depth anchors are the table's centre line and the wainscot line on the back wall, and evenness only reads when it has something to be measured against.

**It pairs with R25 across the same tabletop.** R25 orbits the same flask through half a turn (`Arc Shot`); R28 drives straight at it. One curve, one line — the two faces of the stolen-curve pitfall sitting side by side, same object, same table, with only the nature of the motion changed.

One more thing worth noting: the object sequence, R24 to R29, works the same flask and the same mug over six cuts. **Run this push again on the other object and you have a set** — copy the seconds, the distance and the speed wording verbatim. That is the most practical use of track there is, and precisely the thing a Steadicam cannot supply.

Example frame not generated.
