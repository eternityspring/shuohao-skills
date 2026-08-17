---
id: extreme-close-size
---

## What it is

One detail fills the whole frame and all four edges crop it: an eye, a fingertip, a clasp, a blade, a ring spreading on water. **The line against a close is wholeness**: a close holds one complete face, an extreme close cannot even hold that.

The one-line test: **the cut works with nobody in it, and all the audience needs to see is that one thing — that is an extreme close.**

And a counter-intuitive one: **an extreme close is among the most reliable sizes in AI generation.** One object in frame, no spare joints to invent, no large background to keep consistent — put the lens right on it and the model's material rendering is the best it gets at any size. Faces always break in an extreme wide; verdigris on brass in an extreme close comes back with readable grain.

## When to use it

- **A key prop's first appearance.** The plot is going to lean on it later, so let the audience learn its shape and how worn it is now.
- **The top of an emotional beat.** A clenched hand, a bead of sweat, a tear that will not fall. Cheaper than a face and crueller.
- **The landing of a sound.** A lock clicking, a match catching, a cup set down. The extreme close gives the sound an owner, so the audience knows where it came from.
- **Closing a segment.** Leave one detail on screen and cut away; the audience carries it into the next scene.
- **Material and craft in product work.** Stitching, brushed metal, a water bead — this is the whole reason the size exists in a product film.

**When not to use it**:

- **Not before the audience knows what the thing is.** Establish it on a medium or a close first, then push in. Opening on an extreme close means nobody can read it and the cut is wasted.
- **Not on a cut with dialogue.** Lip sync at this size fails in one frame.
- **Not twice in a row on the same detail.** The audience loses their bearings. Put a close or a medium between them to hand the space back.
- **Not on a complex gesture.** Several fingers moving at once are all fully visible at this size, which means all of them are fully visible when they break.

## How to prompt it

One cut. Name the material down to how it would feel in the hand — texture is the entire value of the size.

```
extreme close-up, one detail fills the entire frame, cut off by the frame edges,
what the detail is（pin the material, colour, wear, temperature）,
the one change happening（tightening / catching the light once / falling）,
light direction and where the highlight lands, one soft background colour layer,
cinematic film still
```

- **`cut off by the frame edges` is the load-bearing line.** Leave it out and the model steps back half a pace to fit the whole object neatly into frame — which is an insert close, not this card.
- **Write material as touch**: brass gone green with verdigris, wood with the varnish worn off, coarse cloth dark with damp. "A clasp" gets you plastic; "a brass clasp tarnished green" gets you the scene.
- **One change only.** Ask for two and the model half-does both.
- **Pin where the highlight lands.** Most of the texture comes from that single highlight, and if you do not place it the model moves it every generation.
- Give `Static Shot`; to add pressure, a very slow `Push In` of no more than 10%.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| How much of the frame the detail fills | full, spilling slightly past the edges | full – spilling well past | Cropped on all four edges reads most like an extreme close; give it air on every side and you have fallen back to a close |
| Seconds per cut | 3s | 2–4s | 2s is enough to read one object; past 4s the model starts adding detail — an extra rivet, an extra seam |
| Number of changes | 1 | fixed at 1 | The knob not to turn. Ask for two changes and you get two half-finished ones |
| Background blur | strong | medium – strong | More blur is cheaper to keep consistent, but blurred to a flat slab the audience loses their bearings — leave one recognisable shape |
| Highlights | 1 | 0 – 2 | One highlight is where the texture comes from; two or more and the material goes fake, like rendered plastic |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Stepped back | You asked for an extreme close and got the whole object centred neatly in frame | `cut off by the frame edges` in the prompt, plus a line saying the detail overflows the frame |
| Unreadable | Two seconds in and the audience still cannot tell what they are looking at | Establish it on the previous cut, and pin material and shape in the prompt |
| Added detail | The same prop gains a rivet and loses a seam between two extreme closes | Attach the prop sheet, hold under 4s, name each mark of wear |
| Plastic look | The material reads rendered rather than photographed | Cut to one highlight and add a surface imperfection: a scratch, a fingerprint, a water stain |
| Lost bearings | After two extreme closes nobody knows where the people are | Put a close or medium between them, or leave one recognisable shape in the blurred background |

## Examples

*The Letter Back*, R21: one fold in the brown paper letter fills the whole frame, the crease running corner to corner, all four edges cutting it off — **the sheet has no outline of its own left in the picture.** 3s, locked off, the bare bulb raking across the ridge from above.

"Cut off by the frame edges" is exactly the line between this size and a close. The same letter turns up three more times in the reel: R19 is the father's hand pressed flat on it, R20 is it sliding across the table, R22 is the focus plane landing on it. All three are closes — the paper still has edges inside the frame and the audience can see it is a sheet of paper. Only R21 goes past the border, and all the audience is left holding is the crease.

One more thing gets proved along the way: **an extreme close is one of the most stable sizes in generative work.** The raised paper fibres along the ridge and the soft shadow in the valley of the fold both come through here. Ask for that same level of detail inside an extreme wide like R02 and it is the first thing to fall apart.

Example frame not generated.
