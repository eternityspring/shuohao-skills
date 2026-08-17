---
id: truck-move
---

## What it is

The camera body travels left or right on a straight line; the lens axis never changes direction. **The difference from a pan is the whole point**: a pan keeps the camera planted and swivels its head, so near and far swing together and the spatial relationships stay put. A truck actually moves, so near things sweep past faster than far things — and that speed difference is the only cue the audience reads as depth.

The one-line test: **want the audience to feel the space, truck; only want them to see what else is over there, pan.**

## When to use it

- **Walking alongside someone.** They walk forward, the camera keeps pace from the side, and pillars, market stalls and passers-by sweep through the foreground one by one. This is the cheapest way to say "this place is big" — far more effective than cutting to a wide.
- **Going down a row of things.** Products on a shelf, photographs on a wall, people in a queue. A truck lets each one enter and leave frame, so the audience counts them.
- **Shifting the balance in a stand-off.** Travel from behind one figure's shoulder to in front of the other's, and the question of who has the upper hand flips during the move.
- **Reading the surface of a product.** A truck reads length and straight edges better than an orbit, so long objects — keyboards, blades, light tubes — want a truck, not an arc.

**When not to use it**:

- **Not without a foreground.** Travel past a plain backdrop and nobody can tell whether the camera moved or the subject did; the frame just drifts for no reason. Put a pillar, a leaf or a passer-by in the near ground first.
- **Not when the subject walks straight at the lens.** That is the dolly's job. A truck makes them slide diagonally across frame and it reads as a mistake.
- **Not when the point is that the place is claustrophobic.** A truck inherently says "there is more over here", which fights the feeling. Lock the camera off and compress with a long lens instead.
- **Never truck and zoom in the same cut.** Two motions stacked and the model re-imagines the whole space.

## How to prompt it

One cut is the norm. Pin the travel distance; never write "trucks across the room".

```
medium shot, camera slides sideways（which way and how far — e.g. slides
sideways to the right past two market stalls）, parallel to the subject（same
distance held throughout）, what the subject is doing（walking / standing still）,
foreground named item by item（pillars, stalls, passers-by — they carry the
speed difference）, background and lighting state
```

- **Measure distance in things passed, not metres**: `past two market stalls`, `the length of the counter`. `three meters` means nothing to the model; "past two stalls" does.
- **`parallel to the subject` is the load-bearing phrase.** Leave it out and the model curves the move into an orbit, which is an `Arc Shot`, not this card.
- **The foreground has to be named in the prompt.** The entire effect comes from the near/far speed difference; no foreground, no effect.
- **The `[Shot k]` passage says only that the camera is travelling.** Put the subject's own action in a separate sentence — never both motions in one clause.
- Give either `Truck Left` or `Truck Right`, never both.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–5s | Under 2s the speed difference never registers and the move is wasted; over 5s the frame starts repeating unless what you pass keeps changing |
| Travel distance | past 2 foreground objects | 1–4 | Past only one and there is no rhythm; past more than four and the model invents new foreground that will not match your design sheets |
| Foreground size | a quarter of frame width | 1/6 – 1/3 | Push it up for more depth at the cost of hiding the subject; past a third the audience starts wondering what they are looking at |
| Camera-to-subject distance | medium | medium to wide | Closer exaggerates the speed difference and gets nauseating; at close-up size it falls apart completely — never truck a close-up |
| Speed | matched to the walk | slower or faster | Slower and the subject walks out of frame; faster and the subject is left behind. Both are usable statements — just make them deliberate rather than drift |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Turns into an orbit | You asked for a straight travel and got a curve around the subject | `parallel to the subject` must be in the prompt; add `the camera does not rotate` |
| Drift | You cannot tell the camera moved; the image just floats | No foreground was named. Add at least one fixed near object for the move to sweep past |
| Sliding subject | The subject slides diagonally with their feet off the ground | Give the subject's action its own sentence, and state what they do relative to the ground (`walking forward at a steady pace`) |
| Grown scenery | Stalls and signs appear mid-move that are not in the design sheets | Pin the distance as "past two stalls" and name those two stalls item by item |
| Double motion | Truck plus push in inside one cut, and the perspective collapses | One motion per cut. If you need both, take two cuts |

## Examples

*The Letter Back* R01 is a truck: an aerial, the camera sliding level to the right across four identical 1990s walk-up blocks at dusk, one fourth-floor window in the nearest block glowing warm while the rest stay cold. At that altitude the ground detail has already flattened into texture — grey tiled roofs, bare courtyard trees, a few drying lines.

The difference between trucking and panning is the speed difference: the camera really travels, so near things sweep past faster than far ones. R01 stages that at aerial height, where the four blocks sit almost on one plane and the speed difference is thin; what the cut mostly delivers is "this district is large". **A truck earns more the closer it gets to the ground** — put a pole, a tree or a run of railing in the foreground and the depth arrives at once. Swing the same cut as a pan instead and the four blocks rotate together, the district collapsing into a flat painted backdrop, and even "how large" is gone.

The other boundary is in that cut too. R03, R04 and R07 are `Tracking Shot`s: the camera is strapped to a man and turns when he turns. R01 runs a straight line with nobody in frame at all. **A truck is about the place; tracking is about where this person goes next.**

The film has no ground-level truck anywhere. If you wanted one, the slot is R09's wide — run the camera level along one side of the round table, the son's end first, then the father's, and what the audience reads is how long that table is and how far apart they sit. The sample plays it locked off, because what that cut has to say is that the two of them hold opposite ends and neither moves.

Example frame not generated.
