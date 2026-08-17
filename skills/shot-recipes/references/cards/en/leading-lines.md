---
id: leading-lines
---

## What it is

Use lines the location already has — the seams in a jetty's planking, rails, the wall lines of a corridor, a riverbank, a roofline, a row of lamps — to carry the audience's eye onto the subject. **The difference from a frame within a frame is direction**: the inner frame encircles the eye and the subject sits inside it; leading lines push the eye along and the subject sits at the point where they converge.

The one-line test: **subject surrounded, that is a frame within a frame; subject standing on the vanishing point, that is leading lines.**

**The real problem here is not that the model cannot draw lines** — it renders jetties, corridors and rails happily. The problem is that **its lines almost never actually point at the subject**: the figure stands beside the jetty while the lines converge on some empty spot deep in the frame, unrelated to anyone. Forcing that alignment is the entire job of this card, and the only thing on it worth paying for.

## When to use it

- **Someone at the end of a corridor, a jetty, a street.** The lines push the audience toward them and "they are waiting there" never has to be said.
- **The cut before an entrance.** One frame of lines converging on an empty end, then the next frame puts the person exactly on that point. Two cuts, and it is the cheapest reveal in the library.
- **A small distant subject.** The smaller they are, the more they need the lines to lead; without them the audience cannot find the subject in the first second and the cut is wasted.
- **Product.** Table edge, light strip and backdrop seam all converging on the product is the cheapest high-end look a studio can produce.
- **9:16 loves this.** A tall narrow frame makes depth lines — running from the bottom edge into the frame — stronger than they ever are in landscape.

**When not to use it**:

- **Not when the subject already fills the frame.** At close sizes the lines have nowhere to run and nothing reads.
- **Not when the location has no straight lines.** Open country, heavy fog, a plain studio. Force it and the model invents a road and a railing that do not exist.
- **Not twice in a scene.** Converging lines are visually memorable; the second use is already tiring.
- **Not when the subject is not at the end of the lines.** Lines pointing elsewhere take the audience's eye with them — worse than not using the card at all.

## How to prompt it

One cut is the norm. Where the lines go and where the subject stands have to be written as the same place.

```
wide shot, what the lines are（jetty plank seams / corridor wall lines / a row of
lamps / a riverbank）and where they start, converging lines point at the subject
（state that the direction they converge on is the direction the subject is in）,
lines end where the subject stands（the subject's position in frame and their share
of frame height）, what the subject is doing, background and lighting state
```

- **Writing `leading lines` achieves nothing.** The model paints its usual road and puts the person beside it. Write two relational clauses — where the lines go, where the person is — and make those two places identical.
- **State where the lines start too.** Something like `starting at the bottom edge of the frame`. Without a start point the lines begin somewhere in the middle with dead space below them, and the lead breaks.
- **Keep it to two or three sets of lines.** Plank seams plus the two railings is plenty. Ask for four or five and the model draws competing perspectives and the frame starts to warp.
- **In 9:16 use depth lines, not horizontals.** Horizontal lines in a vertical frame — the waterline, a roofline, a railing's top rail — cut it in half. Depth lines running from the bottom edge up to the subject are stronger in 9:16 than in 16:9, one of the few compositional advantages the vertical frame has.
- **The `[Shot k]` passage says what the subject does at the end of the lines.** `Static Shot` is safest; `Push In` along the lines is the strongest version, but the vanishing point moves while you push, so keep the travel short.
- **Give the subject's share of frame height.** Without it, "a distant figure" comes back as a smear, and it does not matter how well the lines point.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Sets of lines | 2 | 1–3 | One is too weak to read as leading; past three the perspectives fight and the lines start kinking mid-run |
| Distance from vanishing point to subject | zero | zero to half a body width | Half a body still reads as leading; a full body off and the eye lands on empty ground, which means the card did nothing |
| Subject's share of height | one fifth | 1/10 – 1/2 | Smaller means more reliance on the lines; below 1/10 the face is gone no matter how well the lines aim |
| Line start point | bottom edge | bottom edge / bottom-left / bottom-right corner | From the bottom edge is safest; from a corner gives the strongest depth and warps the perspective most easily |
| Seconds per cut | 3s | 2–6s | Static frames can hold long; pushing along the lines wants 4s minimum, because a fast push smears the lines |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Aimed at nobody | The lines are beautiful, they converge deep in frame on empty ground, and the person stands off to the side | `lines end where the subject stands` is mandatory, and the subject's position and the convergence direction must be written as one place |
| Invented road | In fog or open country the model conjures a path or railing that does not exist | Do not use this card where there are no lines; if you must, make the line object something already on the location sheet |
| Warped perspective | Lines kink mid-run and the two railings sit at different heights | Cut back to two sets and state that they are parallel and equal in height |
| Floating start | The lines begin in the middle of the frame with dead space below them | Pin the start (`starting at the bottom edge of the frame`) |
| Halved vertical | Horizontal lines in a 9:16 frame cut it into a top and a bottom | Switch to depth lines running from the bottom edge up to the subject |

## Examples

*The Letter Back* is full of lines and never once writes them as a technique.

**R05 is the readiest candidate**: the low angle up the stairwell shaft, four flights of railing spiralling toward the pale skylight, the son a small figure at the third-floor turn with one hand on the rail. **The lines are there and they do not point at him** — the railing converges on the skylight while the son hangs off it halfway up, a textbook instance of this card's "does not point at the subject" failure. Making it work means writing the line and the figure as one position: the railing starts at the bottom edge and runs to the point where he grips the rail, he occupies a fifth of the frame height, and the skylight demotes to a layer of light behind him rather than the destination. Count the cost as well — R05 currently carries the low-angle card, and the harder the tilt, the further the convergence point climbs toward the top edge. Run both cards at full strength and they fight; ease the tilt.

**R04 is a different case**: the steadicam glide down the corridor, the wainscot lines on both sides, the terrazzo floor meeting the walls underfoot, bulbs igniting one at a time overhead — three sets of lines converging on the far end all by themselves. It is not written as leading lines because the far end is empty: the lines deliver the eye and nobody is standing there. To use the card, either put the son at that end first, or play it as the entrance setup — this cut converges on an empty vanishing point and the next one has him arrive exactly there.

Example frame not generated.
