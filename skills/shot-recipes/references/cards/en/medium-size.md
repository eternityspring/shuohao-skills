---
id: medium-size
---

## What it is

The bottom edge cuts between the waist and the hip, so the upper body, both hands and the whole face share the frame. **The line against a wide is not a feeling, it is that edge**: feet visible is a wide, cut at the waist is a medium, cut at the chest and you are sliding into a close.

The one-line test: **this cut has to read both the expression and what the hands are doing — that is a medium.**

A medium is the default size of short-form drama, not a special move. Most cuts in a scene should be mediums; spend closes on the emotional landings and wides on the one cut that states the space. **The value of a default size is reliability, not beauty.**

## When to use it

- **The backbone of a dialogue scene.** Shot and reverse both on mediums: the face reads, the hands read, and the cuts are the least likely to betray you.
- **Talking while doing.** Pouring tea, lighting a cigarette, digging through a case, sliding something across a table. The words and the action are two halves of one beat and a medium holds both.
- **A two-hander.** Two people on a medium is the ceiling in vertical; go any wider and both faces get small.
- **The default for talking-head.** With the hands in frame the shot stays alive; face-only talking-head goes stale within thirty seconds.
- **Product explanation.** Someone holding the thing while they explain it — the object reads and so does the person.

**When not to use it**:

- **Not on the landing of a hard line.** After the line the audience wants the face; that is a close. A medium halves the emotion.
- **Not for whole-body action.** Standing up, crouching, turning away — the legs do the talking and they are outside the frame.
- **Not to establish an environment.** All a medium's background gives you is the patch behind someone's shoulder; it cannot say where this is.
- **Not with three or more people.** Three faces do not fit a vertical medium, and the model will wedge the third one into the gap between the other two.

## How to prompt it

One cut is the norm, two for a shot/reverse pair. Copy the same two framing lines into every cut of the scene or the size will drift.

```
medium shot, framed from the waist up, elbows inside the frame,
what the person is doing（talking / pouring tea / sliding something across）,
the material of what they are holding, two or three background anchors（no more）,
one soft background layer, lighting state, cinematic film still
```

- **`framed from the waist up` pins the bottom edge.** Without it the model drifts between medium and close and the size wanders from cut to cut.
- **`elbows inside the frame` pins the width.** Once an elbow is outside the frame the hand tends to break off at the edge — or a spare one grows just past it.
- **Give the hand action an endpoint**: pushed in front of the other person, cup set down. A hand with no endpoint idles for four seconds.
- **Two or three background anchors is plenty.** Name them, soften them one notch, and the model has nowhere to improvise.
- Give `Static Shot`; when the emotion is climbing, a very slow `Push In` of no more than 15%.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Bottom cut line | waist | hip – lower chest | Lower (at the hip) approaches a wide: more of the action, less of the feeling. Higher (at the chest) approaches a close: more face, and the hands start getting cropped |
| Seconds per cut | 3s | 2–5s | 3s per cut is the safest rhythm for dialogue; past 5s the model starts editing the features, worst on cuts with speech |
| People in frame | 1 | 1–2 | Two is the ceiling in vertical, and both need their side of frame and facing pinned |
| Headroom | a tenth of frame height | 1/20 – 1/6 | Less headroom is tighter and more oppressive; more sinks the figure and makes the room feel like it is pressing down |
| Background blur | light | none – medium | A little blur cuts the model's improvisation budget; too much and the medium reads like a close with all the location information gone |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Drifting size | You asked for mediums and the scene cuts between close and wide | Copy `framed from the waist up` into every single cut of the scene |
| Broken hand | A hand snaps off at the frame edge, or a spare one appears just outside it | `elbows inside the frame`, and stage the hand action toward the centre rather than the edge |
| Morphing face | The features slowly change over the back half of the line | Hold cuts under 4s, always attach the character sheet, split long lines across two cuts |
| Empty background | An unreadable smear of colour behind the person | Name two or three anchors and pin which side of them the person is on |
| Fused pair | In a two-person medium they look glued together | Pin the spacing and the facing: seated across the aisle, side by side but not touching |

## Examples

No cut in *The Letter Back* is filed under this card — **in this reel the medium is not a technique, it is the ground colour**: 19 of the 36 cuts are mediums, and every other size in the reel is one step away from that baseline.

Take the most typical of them: R11, the father seated at the right end of the round table, speaking, one hand resting flat on the wood beside the letter. The cut needs three things at once — the expression on his face, where that hand has landed relative to the letter, and the width of table between the two men. **Expression and hands legible in the same frame is a thing only a medium can pay for**: back off to a wide like R09 and the hand is too small to read; push in to a close like R12 and the hand drops out of frame entirely.

Look at how it sits in the run: R11 (medium) → R12 (close) → R13 (close) → R14 (close, pushing in). The medium sets the relationship first, which is what lets the next three cuts tighten all the way down to faces. **That is what a default size is for: it banks the credit the close-ups spend.**

Example frame not generated.
