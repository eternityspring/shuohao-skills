---
id: reaction-hold
---

## Intent

After a line lands, do not rush the reply — cut to the face that heard it. The drama happens in those two seconds: the speaker is done, and the audience needs to see who the line hit.

This is **the best value card in the library**, three savings stacked on top of each other: no dialogue to write, lip-sync avoided entirely (the single most fragile thing in AI video, routed around), and the audience gets time to digest — which instantly makes the pacing read as finished work. Drop a reaction in every few lines of a conversation and the scene starts breathing.

There is one cost: nothing may happen in this cut. Its whole difficulty is **not adding anything**.

## Prompt skeleton

One cut, fixed. Never stretched into two.

```
close-up, the listener in frame, held still under the same key light as the previous cut,
no dialogue in this cut, the mouth closed throughout, one small movement only —
the eyelashes lowering, locked-off camera
```

- **State that the mouth is shut**: `the mouth closed throughout`. Leave it out and the model helpfully gives the listener lip movement, which turns a reaction into a reply
- **Give exactly one tiny, concrete movement** — pick one: eyelashes lowering, a single swallow, fingers tightening. Name the movement; do not write "looks shocked". Abstract emotion words come back as a cartoon face
- **Leave the `<d>` block empty.** No line, no voice-over, no narration on this cut. Adding one breaks the whole thing
- The camera is `Static Shot`, always. This is the only card in the library with no second option

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 2s | 2–3s | The shortest cut in the library. Past 3s the audience starts waiting for the next line and "reacting" slides into "spacing out" |
| Size | close | close–medium | Heavy emotion closes in; if the small movement lives in the hands (tightening, releasing), back off to medium |
| Movement amplitude | tiny | tiny–small | Tiny is what listening actually looks like; once it becomes "visible" it becomes performance |
| Number of movements | 1 | 1 | This knob has no range: a frown plus a step back plus a head shake is two seconds of mime |
| Dialogue | none | none | No range either. If a reply is needed, that is another cut, not this one |
| Camera | Static Shot | Static Shot | A push-in lifts "heard it" into "emotional peak", and that is a different card's job |

## Reference-image constraints

- **One character sheet (the listener) is mandatory** — the cut is that face, and any drift sits dead centre
- **Hang the previous cut as this cut's reference**: same scene, same key. Change the light ratio and the audience reads it as a different scene. This one gets dropped more often than the character sheet
- The prompt carries only the pose of this instant and that single movement; the face and clothes belong to the reference
- **Do not hang the speaker's character sheet.** He should not be in this cut, and hanging his sheet makes the model want to fit him in

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Blank standing | A blank face holds for two seconds — the cut is spent on nothing | Give one tiny concrete movement: eyelashes lowering, a swallow, fingers tightening |
| Silent talking | The listener's mouth moves and reads as a reply, and now you owe a lip-sync | Beyond `no dialogue in this cut`, state `the mouth closed throughout` |
| Too much | Frown, step back and head shake all at once — two seconds of mime | Keep one movement and delete the rest |
| Light jump | The key does not match the previous cut and it reads as another scene | Hang the previous cut as reference and write the key position and ratio into the prompt |
| Pushed in | A `Push In` slipped in and the quiet reaction gets lifted into a climax | This card stays on Static Shot; if you need emphasis, spend a separate cut on it |

## Examples

*The Letter Back*, R13: the camera stays on the father's face while he listens — 3 seconds, close, locked off.

A literal execution of the card. `listener in frame` is the only person in the picture; `no dialogue in this cut` plus "the mouth closed throughout" leaves the model no room to invent a mouth shape. **The whole cut contains one tiny movement** — the eyes go down to the letter and come back up. Not "a shocked expression", but one specific eye movement that can actually be written into a prompt.

It follows the reverse pair directly: R11 the father speaks, R12 the son refuses to answer, R13 hands the frame back to the father so he can listen to the silence. Same bare bulb, same light ratio as the cuts before it, which is what makes the three read as one scene — and it is the cheapest pairing there is: the reverse carries the information, the hold carries the pacing.

Example frame not generated.
