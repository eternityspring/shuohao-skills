---
id: normal-lens
---

## What it is

Perspective looks roughly the way the eye sees it: near things are not especially big, far things are not especially close, straight lines are straight. **The difference from wide and long lenses is not a number, it is presence** — a wide lens and a long lens are both saying something (this place is huge / this place has been flattened). A normal lens says nothing at all.

That is not the same as having no character. **Its character is that it does not interrupt**: the audience's attention lands entirely on the people and what they are doing, with nothing spent on the lens. If every cut in a scene is talking through the lens, then no cut is.

There is also a very practical reason: **the normal focal length is the most stable band in AI generation.** The model has seen the most of it, and the further you get from it the worse its distortion control becomes — wide edges stretch sideways, long backgrounds blur into something fake. **When you do not know what focal length to give a cut, normal is never the wrong answer.**

## When to use it

- **The default for dialogue.** Both sides of a shot/reverse on a normal lens: the least likely to break, and the two sides agree about the space.
- **Most cuts in any scene.** Save wide and long for the two or three cuts that actually need to say something; run everything else normal.
- **Talking head.** Facing the lens on a normal focal length reads as "this person is talking to me". A wide reads as a selfie; a long reads as surveillance.
- **Honest product shots.** If the audience has to read the object's true proportions, neither a wide nor a long lens will let them.
- **Stretches where consistency is under strain.** Several consecutive cuts on the same person drift least at this focal length.

**When not to use it**:

- **Not in a small space you cannot back out of.** That is the wide lens's job; a normal lens in a boat cabin gets you half a person.
- **Not when the background needs to be stacked behind the subject.** That is telephoto compression; a normal lens will not compress anything for you.
- **Not when one cut has to stun the audience.** A normal lens does not have that cut in it. What it offers is stability, not impact.
- **Not once a scene has committed to a stylised focal length.** Three focal lengths in one scene and the spatial sense fights itself; the audience stops believing it is one room.

## How to prompt it

Copy the same three lines into every cut of the scene so the space does not jump.

```
medium shot, natural perspective, no visible distortion,
what the subject is doing, distance from subject to background（pinned: the cabin
wall two metres behind）, two or three background anchors, one light soft layer,
no vignette, lighting state, cinematic film still
```

- **Write both phrases together.** With only `natural perspective` the model still leans on its default idea of "cinematic" and slips a little wide-angle flavour in.
- **`50mm feel` is a fine addition**: that is a description of field of view, not a camera setting, and the model reads it.
- **Pin the subject-to-background distance.** A normal lens neither exaggerates nor compresses, so the depth comes entirely from that sentence.
- **`no vignette` earns its place.** The model loves to add heavy blur and dark corners unasked, and either one takes the shot out of this band.
- Any camera move is fine — this focal length is the most forgiving one there is. Dolly, track, truck, all stable. That tolerance is a large part of its value.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Field of view | 50mm view | 40mm – 65mm view | Wider brings back a little sense of space without becoming a wide lens; longer flatters faces but narrows the background, and past 65mm it slides toward telephoto |
| Seconds per cut | 4s | 2–6s | The most forgiving band in the library: 6s still holds. Six seconds on a wide lens and the edges would already be shifting |
| Subject-to-background distance | two metres | half a metre – five metres | Further back spreads the background out more. A normal lens will not compress it for you: far is simply far |
| Background blur | light | none – medium | One light layer is closest to how the eye sees it; blur it harder and what you actually want is the shallow-focus card, not this one |
| Focal-length changes per scene | 0 | 0 – 2 | Two changes maximum per scene, each with a reason. Three and the audience can no longer read the space |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Secret wide angle | You specified a normal lens and the frame edges still stretch | `no visible distortion` is mandatory, plus `straight lines stay straight` |
| Jumping space | Across cuts in one scene the person-to-background distance keeps changing | Copy the same distance sentence into every cut instead of letting the model re-decide |
| Fake cinematic | Unrequested heavy blur and dark corners change the look | Set background blur to light and write `no vignette` explicitly |
| Flatness | The whole scene is normal and no cut is memorable | Not a lens problem — an emphasis problem. Pick two cuts and switch to a long lens or a closer size so the frame speaks once |
| Drifting size | The focal length holds but the shot size wanders | Focal length and size are two separate things; write both lines, the size phrase and the focal-length phrasing |

## Examples

The storyboard JSON carries no focal length, and none of the thirty-six cuts in *The Letter Back* annotates one, so there is no cut to point at here.

Where it belongs is obvious all the same: **the whole sitting sequence**. R11 and R12 are an over-the-shoulder pair, R15 is the eye-level two-shot, R16 is the father's single — four cuts at the same round table under the same bare bulb, all destined to be cut together. Write every one of them as a normal lens and copy the same "wainscot two metres behind him" clause into each, and the space holds across the cuts. Let one of them drift wide and the table between the two men changes size, and the audience starts doubting it is the same room.

The inverse says it better. Only two cuts in that stretch need the lens to speak: R29 flattens the tabletop and the back wall into one plane with a long lens, and R22 dissolves the father with shallow focus — one spends focal length, the other spends depth of field. **The quieter everything else stays, the louder those two land. This card exists to keep the other lens cards rare.**

Example frame not generated.
