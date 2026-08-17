---
id: handheld-follow-in
---

## Intent

The default way into a space: the camera walks in behind someone. The audience **goes in with them** rather than standing at the door watching someone else arrive — the back in front, the room behind it, and one cut carries both "who just walked in" and "what kind of place this is".

The official camera vocabulary has `Tracking Shot`, which covers the following. What it does not cover — anywhere — is **how to write "handheld"**. A machine following someone and a person carrying a camera behind them are two different things: the first glides like a dolly, only the second breathes. That is the gap this card fills: a slight, irregular sway pitched to the walk, with the amplitude kept deliberately small.

## Prompt skeleton

One cut is the norm; add a second only to land the arrival.

Write the single cut (also cut 1 of the two-cut version) on this skeleton:

```
medium shot from behind, the subject seen from behind walking into the room,
the camera following at a steady distance with a handheld feel,
slight irregular sway timed to the footsteps, the doorway and the corridor
as fixed anchors, natural light coming from the far end
```

- **Write the sway as small**: pick one of `slight`, `subtle`, `gentle`. `shaky` or `violent` smears the whole cut, and once it smears you cannot even tell whose back that is
- **Tie the sway to the footsteps**: one soft dip per step reads far more like a person carrying a camera than random jitter. Write `timed to the footsteps` — that phrase is the line between handheld and malfunction
- **Pin the travel distance**: "three or four steps", "through one doorway". Writing "down a long corridor" is an invitation to invent a corridor
- `Tracking Shot` is the default. If you genuinely need more texture, stack `Shake Slightly` on top — that is the ceiling. `Shake Strongly` has no place on this card
- Two-cut version: cut 1 walks in from behind, cut 2 stops or turns around. Cut 2 must hang cut 1 as its reference

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–6s | The longer the walk, the more background gets reinvented; 6s is the ceiling and past it you should have cut |
| Sway amplitude | slight | barely there–slight | Barely there reads as a shoulder rig, slight as a handheld grip; one notch above that and faces and door frames smear together |
| Following distance | one to two steps | half a step–three steps | Close reads as pressure, almost surveillance; far reads as observation, almost documentary |
| Travel distance | three to four steps | two steps–through one doorway | This is the master valve on invented background, more so than the sway |
| Size | medium | medium–wide | Medium lets the back fill the frame (cheap on consistency); wide explains the space, but shrink the figure and the "back" stops working |
| Cuts | 1 | 1–2 | If one cut gets them in, use one; cut 2 exists to land the arrival, not to change angle |
| Camera | Tracking Shot | Tracking Shot / + Shake Slightly | Tracking alone is usually enough; stacking Shake buys grain, not more movement |

## Reference-image constraints

- **The scene sheet is mandatory** — this is the most scene-hungry card in the library: a following shot eats new frame the whole way, and without the sheet the model invents it as it goes
- **The character sheet is mandatory too.** Backs swap identity just as readily: coat colour, hair silhouette and bag shape all hang off it
- Write the anchors you pass (the door frame, the window at the end, the clock on the wall) into the prompt, so the model has something to match instead of a blank to fill
- In the two-cut version, **cut 1 must be the reference for cut 2** — the turn is exactly where faces change

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Growing corridor | Two steps in and the corridor sprouts a new door, a new frame, a new branch | Hang the scene sheet and cut the travel to three or four steps, with the objects along the way written into the prompt |
| Over-shaken | The sway was written too hard and the cut looks shot through water | Only `slight` / `subtle`, and add `timed to the footsteps` |
| Identity swap | The coat colour or the hair changes halfway down the hall | Hang the character sheet and write the coat colour and hair into the prompt directly |
| Fake dolly | Perfectly smooth — reads as a gimbal, and the immediacy of walking in is gone | `handheld feel` may never be dropped; add the per-step dip on top |
| Floating feet | The figure drifts and the feet do not meet the floor | Write `walking`, not `moving forward`, and give the floor a material (wood, concrete) to land on |

## Examples

*The Letter Back*, R03: the son climbs the stairwell with the camera a step and a half behind him, four steps up to the half-landing — 4 seconds, medium, `Tracking Shot`. Nothing but his back the whole way: dark blue work jacket and short black hair holding the centre, cracked plaster over chest-high pale green wainscot on the left, an iron railing on the right, a small window of cold blue daylight at the landing with one bare bulb above it.

Only one of the two gates survives in a still. `subject seen from behind` is plain to see; `handheld feel` is a property of the motion and no still can prove it — it lives in the `[Shot k]` passage, a slight irregular sway timed to the footsteps, one small dip per step, and the word is `slight`, never `shaky`. The travel is pinned as well: a step and a half of following distance, four steps, ending on the half-landing. No room left to invent a staircase.

The example frame is exactly this cut (R03).
