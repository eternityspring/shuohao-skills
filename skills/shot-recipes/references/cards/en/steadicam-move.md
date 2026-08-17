---
id: steadicam-move
---

## What it is

On a live set a Steadicam is a counterweighted, gimballed harness worn by the operator, and it solves exactly one problem: **people bounce when they walk, and the frame must not**. It says nothing about where the camera goes, only about how clean the going is. Generative video has no such rig, so this card is not equipment documentation — it is a texture instruction.

Three cards divide the job of moving with someone, and the lines between them are hard:

- **`tracking-move` owns "who you follow"** — the subject sets the route; they turn, the camera turns.
- **This card owns "how steady the following is"** — the same walk, delivered as a glide.
- **`shake-move`'s `Shake Slightly` is its exact opposite** — the same walk, delivered as one small dip per footstep.

The one-line test: **does the audience notice there is a person behind the camera?** If they do, it is handheld. If they never do, it is a Steadicam.

None of H3's twenty official camera words covers this, because those words describe *what the camera did* while a Steadicam describes *how cleanly it did it*. So the work is split: **give `Tracking Shot` (or `Truck Left` / `Truck Right`) as the camera word and put the entire question of steadiness onto the three phrases in the prompt.**

## When to use it

- **A character covers ground before the scene proper starts.** Through a door, down a corridor, into the ballroom. The job is to walk the audience in with some dignity; one bump and they read it as "something is wrong".
- **A single take that carries someone from one space into another.** Steadiness is the precondition for not cutting: tracking supplies the route, the Steadicam keeps the route from looking amateur.
- **The walk-away after a decision lands.** The line is said, they turn, the camera glides after them from behind one shoulder. The whole weight of that cut is in the steadiness — the calmer the frame, the more final the exit.
- **Vlog walk-and-talk.** Handheld makes the audience hear the operator's footsteps; a Steadicam keeps a piece to camera a piece to camera, with the speaker merely happening to be walking.
- **A pass along a long product without laying track.** Where there is no dolly, this is the only way to have both travel and smoothness. If you need an exactly repeatable constant-speed straight line, switch to `dolly-track`.

**When not to use it**:

- **Not when the scene wants tension, immediacy or panic.** Steadiness inherently claims "everything is under control", which fights the beat. Those cuts belong to `shake-move`'s `Shake Slightly`.
- **Not when the subject is standing still.** With no subject motion this collapses into an aimless drift, and the model will push the entire background sideways just to prove something moved.
- **Not when you need a precise, constant-speed line you can reproduce in the next cut.** That is the dolly's job — see `dolly-track`. A Steadicam is free but soft; track is constrained but exact.
- **Never stack a push in or a zoom on top of it in one cut.** Add a second motion and smoothness is the first thing sacrificed: the model protects the size change and throws the glide away.

## How to prompt it

One cut is the norm; take a second only when the walk crosses into a different space. **All three phrases are load-bearing** — they pin continuity, absence of shake, and level respectively, and dropping any one of them lets the shot slide back into handheld.

```
medium shot, camera travels with the subject（where to and how far — through a
doorway / three or four paces down a corridor）,
one continuous glide（a single unbroken glide, no pause and no change of direction）,
no jitter and no bounce（footstep rise and fall never reaches the frame）,
horizon stays level throughout（level the whole way, no tipping and no floating）,
what the subject is doing, anchors along the route named item by item（door frame,
pillar, table edge）, walking at a normal pace, lighting state
```

- **Never name the rig in the prompt.** Write `steadicam`, `gimbal` or `stabilizer rig` and a fair share of generations put the hardware in the picture — a mirror at the end of the corridor, a puddle on the floor, a glass door reflecting a frame and an arm. The steadiness comes from the three phrases; not one equipment word is needed.
- **`walking at a normal pace` travels with them.** This is the card's least obvious line: models routinely read `smooth` as `slow`, so the frame steadies but the subject starts wading through treacle. Pin the pace and steady stops meaning slow.
- **Name a hard horizontal edge**: a table edge, a railing, a skirting line, a window sill. `horizon stays level throughout` needs something in frame to be level *against*; indoors there is no horizon, so supply a stand-in.
- **The `[Shot k]` passage says only that the camera glides alongside.** Put the subject's action in its own sentence. Give one camera word — `Tracking Shot`, or `Truck Left` / `Truck Right` for a straight line — and **never pair it with `Shake Slightly`**, which argues the opposite case.
- **Pin the distance as "three or four paces" or "through one doorway".** Background invention here behaves exactly as it does under tracking, and distance is the only master valve.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–6s | Steadiness is proved over time: under 3s nobody can tell steady from unsteady and the effort is wasted; over 6s horizon drift and background invention arrive together |
| Travel distance | three or four paces | two paces – through one doorway | The same valve as tracking. The longer the travel, the larger the model's free-invention area, and steadiness stops being the main problem |
| Camera height | chest | waist to eye | A worn rig sits half a head below eye level, and that half a head is the whole flavour difference from a dolly. Above eye level the frame starts looking arranged — at which point ask why you are not on track |
| Distance to subject | one to two paces | half a pace – three paces | Close reads as stalking, far reads as observing. Inside half a pace the subject collides with the frame edge, and closer also punishes residual wobble twice as hard |
| Hard horizontal edges | 1 | 1–2 | One edge running across frame is the only way to verify "not tipping". With none, any tilt the model produces is defensible; with more than two it starts arranging them into a repeating pattern |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Bounce leaks in | You asked for glide and got one downward dip per footstep, as if the camera were strapped to a chest | `no jitter and no bounce` is mandatory; add `footsteps do not transfer to the frame` |
| Steady turns slow | The shake is gone but the subject now walks like they are underwater | `smooth` was read as `slow`. Add `walking at a normal pace` and strike `slow`, `floating` and `dreamlike` from this cut |
| Slow tip | The first three seconds are fine; by second five the horizon is leaning | `horizon stays level throughout` is mandatory, and put a hard horizontal edge in frame to level against |
| Stalls halfway | The glide stops partway and the last second is a still image | `one continuous glide` is mandatory, and cut the travel back to three or four paces |
| Rig in shot | You wrote `gimbal`, and a glass door or a puddle reflects a frame and an arm holding it | Delete every equipment word. A Steadicam is a method, not a prop; it has no business being visible |

## Examples

*The Letter Back*, R04: the camera travels down the corridor behind the son in one continuous glide, no jitter and no bounce, horizon level throughout; the sound-operated lights come on one bare bulb at a time ahead of him and die out behind him, pale green wainscot and cracked plaster run past on both sides, terrazzo underfoot, the corridor empty apart from him. Wide, 5s, `Tracking Shot`.

All three required phrases are present, and **the problem of having no horizon indoors is solved here**: the level edge to check against is the chest-high wainscot line running the length of the frame, and with it there the model cannot quietly tip the picture. Not one equipment word appears in the prompt — steadiness sits entirely on the three phrases, and `steadicam` and `gimbal` are never needed. The lights coming on ahead and dying behind hand the glide a visible ruler as well: bulbs receding one by one are how the audience reads that the camera really is travelling at an even rate.

**The best part is the cut before it.** R03 is the previous stretch of the same building — the son climbing the stairwell, seen from behind, delivered handheld with an irregular sway and one small dip per footstep. R03 into R04 puts this card and `shake-move`'s `Shake Slightly` side by side: same man, same errand, and shaking reads as "he is climbing" while gliding reads as "he has arrived".

Example frame not generated.
