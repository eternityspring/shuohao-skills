---
id: phone-split-beat
---

## Intent

Phone scenes carry an absurd share of short-form drama: the confession, the warning, the interrogation, the threat — more than half of them happen on two ends of a call. The reason is practical. Neither actor has to share a frame, so each end is shot in its own space.

Think of it as the cross-space version of `ots-shot-reverse`. The over-the-shoulder stitches two people together with a foreground shoulder; a phone call has no foreground to borrow, so **only three stitches are left: the hand at the ear, one shared colour temperature, and eyelines that point opposite ways**.

## Prompt skeleton

Bounce 2–4 cuts. Odd cuts belong to A, even cuts to B, and the last cut returns to whichever end carries the information.

Write each frame prompt on this skeleton:

```
medium shot of character A in space A, a phone held to the ear, posture and eyeline of this
instant, environment anchors, 3200K key light, matching color temperature across both
locations, soft light ratio, cinematic film still
```

- **Pin the colour temperature to one number and write it into both cuts** (3200K on both ends, say). This single clause is the hard part of the card, and it is why `matching color temperature` sits in the must-have phrases
- **The phone has to be visible**: the hand at the ear is the only connective symbol the audience gets. Hide it behind a sleeve or crop it out and the two cuts fall apart into two scenes
- **Opposite eyelines**: `looking off to the left` on A, `looking off to the right` on B. Matching eyelines read as two people calling a third
- Dialogue goes into each cut's own `<d>` block. The half-line coming out of the earpiece is not spoken by the person on screen, and no cut ever carries both voices

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–4s | One line per cut. Squeeze to 2s across four cuts and it becomes an interrogation; stretch to 4s and the other end is hesitating |
| Number of cuts | 2 | 2–4 | Two is a question and an answer; four is a full exchange. Past four the audience forgets it is a phone call |
| Size | medium | medium–close | **Offset the two ends by one step**: closer on whoever is pressing, more air around whoever is taking it. Close on both reads as one scene |
| Colour temperature gap | 0 | 0 (do not tune) | The one knob that stays locked. To separate the spaces, change background brightness and key position — never the temperature |
| Light ratio | matched, about 3:1 | 2:1–4:1 | Hard on one end and soft on the other gives it away instantly; soft on both is the safe pick |
| Background density | low | low–medium | The plainer both backgrounds are, the more the two spaces read as one production; clutter makes the two art directions fight |
| Camera | Static Shot | Static Shot / Push In | Locked off throughout by default; spend one `Push In` on the cut where the truth lands |

## Reference-image constraints

- **Two sheets per cut**: the character sheet for that end plus the scene sheet for that space. Different scene sheet and different character sheet on each end — never cross them
- **Put the phone in a prop sheet**, or write the same one-line description of it (colour, candybar or flip, case or no case) into both prompts. Same handset on both ends is what makes it one call
- **Hang cut 1 as a reference for cut 2** — not for composition but for colour temperature and light ratio. Using it as a colour chip beats any adjective you could write
- The prompt carries framing, posture and eyeline only; faces and spaces come from the reference images

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Two productions | One end is warm amber, the other cold blue; cut together they look like two different crews | `matching color temperature` goes into every cut, with one Kelvin value written out |
| Calling with an empty hand | The hand reaches the ear but the phone is gone, or it passes through the skull | Write `phone held to the ear` and let it be the only hand action in the cut |
| Morphing handset | Bezel, screen reflection and buttons change from cut to cut | Give the phone a prop sheet; step back to medium and skip extreme close-ups |
| Model swap | Candybar on A's end, flip phone on B's | Write the identical handset clause into both prompts, in the same position |
| Same-side eyeline | Both ends look left, as if talking to a third person | Reverse them: `looking off to the left` in one cut, `looking off to the right` in the other |

## Examples

There is no telephone in *The Letter Back*. A northern Chinese flat in 1995, a round table, a flask, a mug, two men in the same room from beginning to end — the reel simply cannot produce this cut.

The cheapest way to think about it is as the cross-space form of `ots-shot-reverse`: the reverse stitches two people with a foreground shoulder, and a phone call has no foreground to borrow, so the seam is down to three things — the hand at the ear, one colour temperature written identically into both prompts, and eyelines that answer each other. The textbook pair: A in one space, handset at the right ear, looking off frame left; then B in the other space, handset at the left ear, looking off frame right, both keyed at the same stated temperature. Miss any one of the three and the audience reads two people each calling somebody else.

Example frame not generated.
