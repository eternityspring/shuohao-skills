---
id: insert-beat
---

## Intent

Every continuous scene has one action that matters more than the rest — a palm slamming down on a trunk lid, a finger tightening on a trigger, a fingertip sweeping across a screen. Buried inside a wider frame, it goes by unseen. The insert beat **lifts that one action out and gives it a cut of its own**: nothing else is in frame, and the rhythm lands a downbeat right there.

It is not an explanatory close-up; it is the beat itself. The cuts on either side keep playing the continuous scene. The one wedged between them is short, close and carries a single piece of information — that is how a drum works.

## Prompt skeleton

One cut is the norm. Never split a single action across two cuts; split it and the accent is gone.

```
extreme close-up, a hand pressing the trunk lid down at the instant the weight goes into it,
action in progress, that hand and the closing gap the only isolated detail in frame,
background dropped into darkness, one hard side light drawing a line along the edge
```

- **The verb must sit mid-motion**: `pressing down`, `the trigger finger tightening`, `a fingertip sliding`. Write `has pressed` or `the closed lid` and you have described a result — the model returns a still life
- **One piece of information in frame**: that is what `isolated detail` enforces. Half a face, a second hand, clutter on the table — each one softens the accent
- **The `[Shot k]` passage carries the action alone** — no expression, no line, no second person
- `Static Shot` is the default. `Push In` only when this beat needs one more notch of pressure, and keep the move small

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 2s | 2–3s | The shortest card in the library — the accent lives on brevity. Go to 3s only because the action itself is slow (a lid easing shut), never to linger |
| Size | extreme-close | close–extreme-close | Closer hits harder, but closer also means more hand deformity; close is the safer default |
| Where you cut into the action | just before it completes | start of the move–settled | "Pressing down" hits hardest; the start of the move reads as a trailer, and "already pressed" is a still life |
| Background simplicity | bare | bare–moderate | The cleaner the background, the louder the accent. Crush it dark, blur it, or shoot in tight — pick any one |
| Light ratio | high | medium–high | A hard side light carves the edge of the action. Flat light makes the insert feel weightless against the scene around it |
| Camera | Static Shot | Static Shot / Push In | Locked off is the default. The cut is short; move the camera and nothing reads at all |

## Reference-image constraints

- **Hang the character sheet** even when only a hand is in frame. The cuff colour, the watch, a ring, the nails — that is the entire basis on which the audience decides it is still the same person
- **Hang the prop or scene sheet**: the object the action acts upon is the real subject here — the grain of the lid, the interface on the screen, the metal of the trigger all have to match
- **Hang the previous cut as a reference** to lock the light ratio and the materials. An insert is the cut most likely to look spliced in from another film
- The prompt carries **this instant's action and framing only**; faces, clothing and materials belong to the reference images

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Still life | The insert comes back as a product photo, the hand resting motionless on the lid | `action in progress` is mandatory and the verb must be progressive; delete every result-state noun |
| Competing detail | Half a face, a second hand and a table of clutter dilute the beat | `isolated detail` plus a crushed background; keep asking whether one more thing can leave the frame |
| Held too long | You gave it 5s, the action finished early, and the accent turned into a pause | Back to 2s. Resonance belongs to the next cut, not this one |
| The hand changes | The hand no longer matches the previous cut and the cuff has changed colour | Hang the character sheet, write the cuff and accessories into the prompt, and reference the previous cut |
| Sixth finger | Extreme close framing grows an extra finger, or fingers pass through the prop | Pull back to close and let some fingers leave frame; never spread all five across the picture |

## Examples

*The Letter Back*, R20: the letter slides across the tabletop under the father's fingertips — 2 seconds, close, locked off. It is already moving when the cut opens and has not arrived when the cut ends: `action in progress` executed literally, with the movement neither starting nor finishing inside the frame.

`isolated detail` is just as clean — the letter, the hand pushing it, the grain of the wood, and nothing else. It sits between R19 (two hands frozen against each other) and R21 (the extreme close-up of the crease), which makes it the downbeat of the whole section: the cuts on either side describe a state, and only these 2 seconds carry an action.

Example frame not generated.
