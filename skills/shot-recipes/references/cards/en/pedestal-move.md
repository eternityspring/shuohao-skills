---
id: pedestal-move
---

## What it is

The camera body rides straight up or straight down a vertical line while the lens keeps looking dead ahead. **A pedestal is not a tilt, and height is not angle**: a tilt keeps the camera planted and tips its head; a pedestal actually changes the camera's height while the head stays level the whole way.

The one-line test: **look at the vertical edges.** Through a pedestal, door frames, pillars and wall corners stay dead straight and parallel, and nobody's proportions change. Tip the head up and those same edges immediately converge toward the top of frame, and a person goes from long-legged to big-headed — that is not "a different point of view", that is perspective distortion.

So: **pedestal to change the audience's height, tilt to change the audience's attitude.**

## When to use it

- **From the object up to the face.** A letter spread on the table, blood on the floor, a stack of cash on the counter — let the audience read the thing first, then ride level up to the face of whoever owns it. One cut ties "what this is" to "whose problem it is", and it is cleaner than two cuts.
- **Crouch to standing, framing unchanged.** Someone rises from a crouch and the camera rises with them by the same amount, so their size and position in frame never move. This is the cheapest way to stay glued to a person, and far steadier than a follow.
- **Drop down to give the audience the ground.** From chest height to knee height to the toe of a boot, and the mud, the footprints and whatever fell down there walk into frame on their own — no insert cut required.
- **Height as a product claim.** Tall, slim things — bottles, speakers, fragrance — read as tall when you ride from the base to the cap. An orbit cannot do this; an orbit reads width and depth.
- **The settle before a talking-head opener.** Rise from the desk dressing to the presenter's face: two seconds of something to watch before the first word, without competing with it.

**When not to use it**:

- **Not without a vertical in frame.** Pedestal against open sky, open water or a seamless backdrop and nobody can tell the camera moved; the image just drifts upward for no reason. Get a door frame, pillar, railing or wall corner into shot first.
- **Not to make someone look powerful or small.** That is the angle's job. A pedestal changes height without changing perspective, so nobody's stature changes at all — used as a substitute for a low angle it produces a cut that says nothing.
- **Not when the subject is walking straight at the lens.** They are already changing their own size in frame; add vertical camera motion on top and the audience reads neither change.
- **Never pedestal and push in inside one cut.** Vertical travel stacked on a size change and the model repaints the perspective of the whole room — door frames come out curved.

## How to prompt it

One cut is the norm. Pin the start height and the end height; never write "slowly rising".

```
medium shot, the camera rises level from (start height: knee / tabletop / chest)
to (end height: eye level / above head height) with its distance to the subject
unchanged, lens axis stays level (never tips up or down at any point),
verticals stay parallel (door frames, pillars and wall corners stay dead
straight), what the subject is doing, the vertical references named item by
item, lighting state
```

- **Measure height in body parts, not metres**: `from knee height to eye height`, `from tabletop height to standing eye height`. `rising one meter` means nothing to the model; "knee to eye" does.
- **`lens axis stays level` is the load-bearing phrase.** Leave it out and the model turns the pedestal into a tilt nine times out of ten — there is far more tilt in the training data, and nothing holding it back.
- **Name the verticals in the prompt.** Door frames, pillars, railings, the upright edge of a bookcase. They are the audience's only evidence that the camera moved, and the model's only anchor for keeping perspective honest.
- **The `[Shot k]` passage says only that the camera is changing height.** Give the subject's own action its own sentence — "he stands up" and "the camera rises" are two events, and written as one clause the model performs only one of them.
- Give either `Pedestal Up` or `Pedestal Down`, never both, and never stack `Tilt Up` on top — those two words are fighting each other.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–5s | Under 2s the move reads as a jump cut and the audience just sees a flicker; over 5s something new has to keep entering frame or it is an empty shot crawling upward |
| Travel amount | one body span (waist to eye) | half a span to two spans | Under half a span nobody notices and the move is wasted; over two spans the model starts inventing the space above and below — that ceiling and that floor are its own fiction |
| Start/end height | tabletop → eye level | floor level to above head height | End higher than eye level and the frame starts looking down at the floor, which contradicts the "never tips" promise; the model resolves the contradiction by turning it into a tilt |
| Vertical references | at least 1 running the full frame height | 1–3 | One is enough; past three the model tends to smear them into ghost copies of the same pillar, and the bigger the travel the worse it gets |
| Speed | constant | constant, gentle ease at both ends is fine | Of all the moves in this set the pedestal punishes speed changes hardest: one hitch mid-move and the audience reads "something bumped the camera" |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Turns into a tilt | You asked for a level rise and got the frame craning upward with door frames converging inward | Both `lens axis stays level` and `verticals stay parallel` must be present; add `the camera does not tilt` |
| Stretching | At the top of the move legs or a bottle body come out elongated and out of proportion | Pull the travel back inside one body span and put the proportion in the prompt (`full height of the bottle unchanged`) |
| Float | You cannot tell the camera rose; the image just seems to hover | No vertical was named. Put a pillar or door frame in shot that runs top to bottom |
| Sneaky push in | The subject grows in frame during the rise | The model stacked a dolly on its own. Pin `distance to the subject unchanged` and keep every size-change word out of the `[Shot k]` passage |
| Grown ceiling | At the top of the move, beams, pendant lamps and skylights appear that are in no design sheet | Cap the end height near eye level; if you genuinely need to rise past head height, name what is up there item by item |

## Examples

A general-purpose card; *The Letter Back* never uses one. There is no `Pedestal Up` or `Pedestal Down` anywhere in its thirty-six cuts.

The cut worth holding it against is R05, because R05 is exactly the move people confuse it with: from the bottom of the stairwell shaft the body swings up around the horizontal axis. That is a tilt, and **the camera's height never changes at all**. As a pedestal it becomes a different cut entirely — the camera rides straight up the vertical of the shaft with the lens level throughout, railings and wall corners staying parallel the whole way, human proportions untouched. Tilt up instead and those verticals immediately converge toward the top of frame and a man goes from long-legged to big-headed. **Height is not angle.**

The stairwell is also the best place in the film for a pedestal: the verticals are free — four flights of rail, a door frame on every landing, a corner at every turn — so the rise is legible. There is a slot in the flat too: start level with the tabletop, on the two hands over the letter, and ride up to the height of the two faces. The work first, then the men doing it. The sample splits that into R19's hands-only close-up and the faces that follow; a pedestal welds them into one sentence with a subject.

Example frame not generated.
