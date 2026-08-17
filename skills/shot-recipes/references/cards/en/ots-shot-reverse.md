---
id: ots-shot-reverse
---

## Intent

When two people talk, the audience must know **who is speaking to whom** in the very first frame. The over-the-shoulder puts the listener in the foreground and the speaker in focus — one frame carries the relationship, the distance and the subject at once.

This is the default solution for dialogue, not a special technique. Dialogue cut without it comes out as two people filmed separately, and the two frames read as two different scenes.

## Prompt skeleton

Solve it inside one segment: 2–3 cuts bouncing back and forth (A over B's shoulder → B over A's shoulder → optionally back to A to close).

Write each cut's frame prompt on this skeleton:

```
medium over-the-shoulder shot, the listener's shoulder and back of the head filling the
left (right) foreground, out of focus (blurred foreground shoulder), the speaker facing
the camera in sharp focus, environment anchors, lighting state
```

- **The foreground shoulder must switch sides**: foreground left in cut 1 means foreground right in cut 2 — no switch reads as no cut at all
- The **`[Shot k]` passage** carries who speaks and what the body does while speaking (a nod, a glance breaking away, the hands). `Static Shot` is the default; only the cut where the emotion steps up gets `Push In`
- **Dialogue** goes into the `<d>` block of the speaker's cut. The listener's cut carries no line — that cut is already a reaction

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–4s | Long line, give it 4s; a terse exchange compresses to 2s, and three cuts of that is an interrogation |
| Number of cuts | 2 | 2–3 | The third cut returns to A to hold silence or a turn; steadier, but half a beat slower |
| Foreground shoulder | quarter of the width | one sixth to one third | More shoulder reads as pressure (interrogation, closing in); less reads as an even conversation |
| Size on the speaker | medium | medium–close | Whoever carries the information gets the closer framing |
| Foreground blur | medium | soft–strong | Stronger blur looks more like a finished film; too strong collapses the shoulder into a slab and the model paints it as a wall |
| Camera | Static Shot | Static Shot / Push In | Locked off is the default; pushing in on both cuts is showing off |

## Reference-image constraints

- **Two character sheets per cut** (the one in the foreground and the one in focus) plus one scene sheet. The foreground shoulder is blurred, but its clothing colour and shoulder line still have to match — without the sheet the person changes
- The prompt only carries **framing and the pose of this instant** (who is in the foreground, which side the shoulder is on, where the speaker looks). Faces and clothing belong to the reference images
- Once cut 1 exists, **hang it as a reference for cut 2** — it locks the light ratio, the fog density and whatever sits on the table

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Filmed separately | Both cuts are single close-ups with no foreground shoulder; they read as two scenes | Neither `over-the-shoulder` nor `blurred foreground shoulder` may be dropped (the gate checks both) |
| Shoulder never switches | The foreground shoulder is on the left in both cuts; it reads as one person talking to themselves | Write `foreground shoulder on the right` explicitly in cut 2 |
| Shoulder becomes a wall | Blur pushed too far and the model paints a dark slab | Drop the blur one notch and state that it is `the back of a shoulder and head` |
| Crossing the line | The two people swap left and right between cuts and the audience loses orientation | The speaker's eyeline must be opposite across the cuts: looking to the left in one, to the right in the other |
| Drifting tabletop | The cup on the table changes place and count between cuts | Hang cut 1 as the reference for cut 2, and write the tabletop objects into both prompts |

## Examples

*The Letter Back*, R11 and R12, are one unit and have to be read together:

- **R11** — the son's shoulder and the back of his head fill the left foreground, blurred; the father sits on the right, in focus, one hand flat on the table beside the letter, speaking. 3 seconds, medium, locked off.
- **R12** — the reverse. The foreground shoulder moves to the right and becomes the father's grey-flecked head; the son stays on the left, in focus, jaw set, saying nothing. 3 seconds, close, locked off.

The pair demonstrates both rules of the card. **The foreground shoulder changes sides** (left → right), which is the only real evidence that a cut happened; and **neither man changes his side of the frame** — the son is left in both, the father right in both. Crossing the line is how this card actually fails. The dialogue hangs on R11 only; R12 gets no line, because the listener's cut is already a reaction cut, and R13 right after it is a full reaction hold.

Note that R12 also steps the size in (medium → close). Size can move inside an exchange; which side the shoulder sits on, and which side each man sits on, cannot move with it.

The example frames are exactly these cuts (R11 / R12).
