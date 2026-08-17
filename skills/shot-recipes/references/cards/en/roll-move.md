---
id: roll-move
---

## What it is

The camera spins about its own lens axis and the whole image turns with it. The camera has not moved, the size has not changed, the thing being filmed has not changed — **the only thing that changed is which way is up.**

**A roll is to a dutch angle what a process is to a state.** A dutch angle sits tilted and still; it belongs to camera angle, and the tilt is the same at the first frame and the last. A roll is the image turning; it belongs to camera movement, and what the audience sees is the passage from level to tilted (or back). A dutch angle says "something is wrong here." A roll says "something is going wrong right now."

The one-line test: **tilted but not moving is a dutch angle and has nothing to do with this card; turning is a roll.** The two join best as motion into stillness — roll into position on this cut, then hold the dutch angle on the next, so the audience never feels the frame quietly righting itself.

## When to use it

- **The instant the world goes over.** Knocked down, falling, losing consciousness. A roll plus `Shake Strongly` — two seconds for the pair, no more — takes the audience's balance away outright.
- **A mind starting to come apart.** Fever, drugs, real fear. A small slow roll (10°–20° over three seconds or more) leaves the audience unable to name what is wrong and unable to sit still. This is the most sophisticated thing a roll does, and the easiest to overdo.
- **A switch thrown on a scene.** Roll from level to 20°, then hold the dutch angle for every cut after. Here the roll is punctuation: from this point on, the rules of this scene have changed.
- **A transition with force behind it.** Roll plus motion blur into the next scene — harder than a straight cut, faster than a dissolve. This is a cousin of the recipe card `whip-blur-bridge`, which handles the horizontal version; here the whip is rotational.
- **A tech or product outro.** A very small (5°–10°) slow roll against a clean background gives the image a slight floating quality. **This is a vlog and title-sequence move; leave your actual product explainer cuts level.**

**When not to use it**:

- **Not on a dialogue cut.** The audience is busy working out which way is up and the line goes unheard. To put unease under dialogue, hold a fixed dutch angle instead of rolling.
- **Not without a horizontal reference in frame.** "Horizon" here means any horizontal straight line: a waterline, a table edge, the join of floor and wall, a ceiling beam. With none of them — pure fog, open sky, a seamless backdrop — a roll is an event the audience cannot see.
- **Not past 45°.** Beyond that the audience spends half a second deciding whether the footage was mounted upside down, and the scene stops for that half second. A full 90° or 180° is reserved for falling or blacking out, and the frame has to show a body actually going over.
- **Never two rolling cuts in a row.** The audience is immune to the second one and only the nausea is left. For sustained imbalance, roll once and hold the dutch angle across the cuts that follow.
- **Not on cuts that have to be read.** Inserts, product cuts and hand close-ups stay level — once the frame turns, the shape of the thing stops reading.

## How to prompt it

One cut, short. Pin the start and end angle; never write "the frame slowly rotates".

```
medium shot, the frame rotates around its center (pin the direction and the
degrees, e.g. rotating 20 degrees clockwise), horizon tips out of level (name
which horizontal line is acting as the horizon: waterline / table edge / the
join of wall and floor), the subject stays centered in frame, what the subject
is doing, environmental anchors named item by item, lighting state
```

- **Pin both degrees and direction**: `rotating 20 degrees clockwise`. Without a number the model decides for itself, and two generations come back at 5° and at 40°.
- **Name the line doing the work of a horizon.** It is the only source of legibility a roll has. Indoors, with no real horizon, name the table edge, the skirting board, the beam over the door — **a roll with no horizontal in frame is not a roll.**
- **Pin the subject at the centre of frame.** Leave it loose and the model reads "rotate" as "swing the subject around", so they slide off along an arc.
- **The `[Shot k]` passage says what caused the turn** — the punch landing, consciousness going, the hull heeling over. An unmotivated rotation reads as a transition effect rather than drama.
- Give `Roll Clockwise` or `Roll Counterclockwise`, one of them. Stack `Shake Strongly` if you want it harder; two seconds for the pair is the ceiling.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 2s | 1–4s | 1s is the punch landing; 3s and up is control slipping away. At the same angle, longer reads as a state of mind and shorter reads as physical impact |
| Rotation angle | 20° | 5°–45° | 5°–10° leaves the audience unable to say what is wrong but unable to settle; 20° is unambiguous imbalance; past 30° it starts looking like an effect; past 45° they stop to check whether the footage is upside down |
| Rotation speed | constant | constant to fast-then-settle | Fast-then-settle reads most like being hit; constant reads most like consciousness sliding away. Change speed twice mid-move and it reads as an editing mistake |
| Horizontal lines | at least 1 crossing the frame | 1–3 | One is enough. With none, every other knob on this table stops working |
| Subject size | half the frame height | a third to two thirds | Bigger subject, more nausea in the turn; too small and attention wanders into the background to audit what is crooked |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Invisible roll | The frame really is turning and you cannot tell | Nothing horizontal in shot. Name the waterline, table edge or skirting board so `horizon tips out of level` has something to cash in |
| Subject swings | The subject slides off along an arc instead of the whole frame turning | `the frame rotates around its center` must be present; add `the subject stays at the center of frame` |
| Overshoot | You asked for 20° and got sixty or seventy, like footage mounted upside down | Pin the degrees and state them again in the `[Shot k]` passage; for larger angles lengthen the cut too and the model converges |
| Warping | The corners stretch through the turn and faces near the edges pull long | Bring the subject back to centre and hold it under half the frame height; it is worst past 30° |
| Unmotivated turn | The frame rotates for no reason and reads as a transition effect | Put the cause in the `[Shot k]` passage — the hit, the hull heeling, consciousness going. Every roll needs a reason |

## Examples

A general-purpose card; *The Letter Back* never uses one. There is no roll in its thirty-six cuts, and no dutch angle either.

What makes that interesting is that the film is not short of the means. Horizontals are everywhere in it: the edge of the round table, the chest-high wainscot line, the same line running down both sides of the corridor, every balcony rail on six storeys of the block. The reference a roll needs is all there. It never rolls because it has no reason to. **A roll says "this is going wrong right now"**, and nothing in this picture goes out of control: a father and a son sit with a letter all afternoon, the son leaves, the letter stays. Rewrite R33 — the son standing and walking out of frame left — as a roll, and what the audience reads is not that he is leaving but that the building is coming down. **Having a line you could tip is not a reason to tip it.**

The card's signature cut looks like this: the frame starts level, rotates ten or fifteen degrees within the cut and stops there, with one unmistakable horizontal in shot so the audience can see the tilt at all — a horizon, a table edge, the lintel of a door frame. The cleanest way to carry it is one moving cut then one still: roll into position here, cut to a dutch angle that holds it, and the picture never seems to spring back upright.

Example frame not generated.
