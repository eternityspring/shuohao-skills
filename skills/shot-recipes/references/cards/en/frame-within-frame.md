---
id: frame-within-frame
---

## What it is

Use an opening that already exists in the location — a doorway, a window, a cabin hatch, a gap between railings, a slot in a crowd — to build a second frame inside the frame, with the subject sitting in it. **The difference from `door-threshold` is whether the subject moves**: that card is an entrance recipe where someone actually steps across and the drama lives in the crossing; this is a general composition move where the subject can be completely still and the drama lives in "who is watching" and "what is closing around them". A doorway is only the most common opening, nowhere near the only one.

The one-line test: **they pass through it, use `door-threshold`; they sit inside it, use this card.**

Translated into words a model obeys: `frame within a frame` does almost nothing — the model will not go hunting for an opening on your behalf. Name the opening, pin its size and side, then add that the surround is darker than the gap. **Whether the inner frame reads at all comes down to that brightness difference.**

## When to use it

- **Watching and being watched.** Look at someone through a door gap, in from outside a window, past a railing, and the audience is instantly standing where the watcher stands — no reverse needed to establish who is looking.
- **Trapped.** A figure sitting inside a window frame, a hatch, the gaps in a banister. No line required to say "there is no way out of this".
- **Two spaces in one cut.** Interior on this side of the opening, street on the other. One cut does the work of two and saves an establisher.
- **A small distant subject.** The opening narrows the audience's view into a tunnel, so the subject can be tiny and still impossible to lose.
- **Product and talking head.** An arched backdrop, a ring prop, one cell of a shelving unit around the product — the cheapest high-end look available in a bare studio.

**When not to use it**:

- **Not when the subject travels through the opening.** That is `door-threshold`'s job; never stack both cards on one cut.
- **Not when the opening is so tight the subject is barely visible.** That reads as blocked, which is foreground occlusion, not framing.
- **Not on a cut that already has heavy foreground occlusion.** Two layers of blocking stack into a mush where no edge is legible.
- **Not with letterbox-shaped openings in 9:16.** A vertical frame squashes a wide window or the gap between beams into a slit the subject cannot fit inside.

## How to prompt it

One cut is the norm. To move into the opening, take two and use the first as reference for the second.

```
medium shot, what the subject is doing and where, inner opening frames the subject
（name it: doorway / window / hatch / railing gap, how much width and height it
takes, which side it sits on）, dark border around the opening（how many stops
darker the surrounding wall is）, contents on this side named item by item,
contents beyond the opening named item by item, lighting state
```

- **Name the opening and pin its share.** `inner opening frames the subject` has to be followed immediately by what kind of opening, how much of the width it occupies, and which side it sits on. An abstract "frame" gets filed as style and skipped.
- **`dark border around the opening` is the load-bearing phrase.** The inner frame reads only because its surround is darker. Leave it out and the model paints a doorway at the same brightness as the wall, the frame vanishes, and you are back to an ordinary medium.
- **Name what is on both sides of the opening.** Same logic as `door-threshold`: the side you did not describe grows a room nobody asked for.
- **In 9:16, pick upright openings** — doorways, narrow windows, the gap between two posts. There is also a cheap vertical build: let the opening span the full frame width and keep only the lintel and sill as the border. The border is thin but its position is stable, and platform safe areas will not eat it.
- **The `[Shot k]` passage covers what the subject does inside the opening.** Camera holds by default; if it has to move, `Push In` slowly toward the opening — but stop before the border leaves frame, because the moment it does, this card switches itself off.
- **State the opening's material, colour and open/shut position exactly once.** Say it twice and the model treats the two descriptions as two different openings.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Opening's share of width | one third | 1/5 – 2/3 | Smaller reads more voyeuristic and pushes the subject further away; below 1/5 the face is unreadable; above 2/3 the border is too thin for the frame to exist |
| Border-to-opening brightness gap | 2 stops | 1–3 stops | At 1 stop the frame never reads; past 3 the border goes solid black and every scrap of location information is gone |
| Subject's position inside the opening | centred in the opening | centred to a third of the opening | Centred is safest; pushed to the edge of the opening and the model tends to slice half the subject outside the border |
| Number of nested layers | 1 | 1–2 | Two layers (a window inside a doorway) looks superb and doubles the failure rate — do not attempt it without location design sheets |
| Seconds per cut | 3s | 2–5s | Framing like this rewards holding; under 2s the audience never registers the inner frame and the design is wasted |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| No frame | The render contains no doorway or window at all, just a person standing there | Name the opening, pin its share and side, and add `dark border around the opening` — all three together |
| Mushy border | The border blurs into something you cannot identify as wall or shadow | Make the border a solid object (`brick wall edge`, `wooden hatch frame`) and never assign it blur |
| Grown room | A space nobody wrote appears on the far side of the opening | Name the contents on both sides item by item; add a location sheet per side if it persists |
| Sliced subject | The figure stands at the edge of the opening with half their body cut off by the border | State that the subject is centred in the opening and give their share of the opening's height |
| Nested mush | You asked for two layers and got a pile of unreadable edges | Fall back to one; if you truly need two, split into two cuts with the first as reference for the second |

## Examples

*The Letter Back* R06: a medium looking out through the stairwell window at the single bare tree in the middle of the courtyard, the bicycle shed and two drying lines behind it, and the unlit stairwell wall closing in as a dark border that eats the outer third of the picture on every side. Three seconds, locked off.

**The whole cut stands on the brightness gap**: cold daylight outside, dark corridor inside, and only then does the opening read as a frame rather than a hole in a wall. Two other things earn attention. What sits inside the frame is a tree, not a person — framing needs no protagonist, and whatever fills the opening reads as something somebody is watching. And one cut carries two spaces, corridor and courtyard, which buys back the establishing shot the sequence would otherwise owe before going inside.

Example frame not generated.
