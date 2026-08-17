---
id: two-shot-hold
---

## Intent

AI video loves to cut — split a segment into three or four shots and it feels like editing rhythm. But every cut is another chance for the model to regenerate a face, which is another chance to get a different person back.

The value of this card is counter-intuitive: **not cutting is the cheapest way to hold consistency**. Both people stay in one frame, both faces are generated once, and the relative positions, the light ratio and whatever sits on the table never have to be matched across a cut.

It belongs to the moments where the power relation is already settled — a standoff, a silence, someone refusing to answer. That tension comes from neither person walking away, and cutting is exactly what throws it away.

## Prompt skeleton

Solve it in one shot: 4–8 seconds, no cut.

Write the frame prompt on this skeleton:

```
medium (wide) shot, both figures share the frame, one on the left third and one on the right
third, visible space between them, both bodies fully inside the frame, a single change of
posture, one unbroken take, locked-off camera, environment anchors, lighting state
```

- **Put them on the left and right thirds and leave the middle empty** — that gap is the relationship: wide reads as distance, narrow reads as pressure
- **One change of posture per shot** (a turn of the head, standing up, a hand reaching out, a glance breaking away). Ask for two and the model stacks them, and both people start to twitch
- The **`[Shot k]` passage** fixes the order: who speaks first, and what the other one does while they speak. Both lines go into the same `<d>` block with silence between them
- `Static Shot` is the default. Reach for a very small `Push In` only to tighten the pressure — never pan and push inside the same shot

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per shot | 6s | 4–8s | Silence can stretch to 8s, but there are two faces in this frame and drift shows sooner; with dialogue, come back to 5–6s |
| Number of cuts | 1 | fixed at 1 | The whole point is not cutting. The moment you need a back-and-forth, switch to `ots-shot-reverse` rather than splitting this card in two |
| Distance between them | one body width | half to two body widths | Half reads as intimacy or threat, two reads as a stalemate. Below half the faces start to blend |
| Size | medium | wide–medium | Wide carries the space and who stands higher; medium is where you can read a face |
| Share of frame | a third each | a quarter to a half | Give one of them noticeably more and the power tips to them; a standoff needs them even |
| Blur | soft | none–medium | Both people must sit on the same focal plane; push the blur and one of them becomes scenery |
| Camera | Static Shot | Static Shot / tiny Push In | Locked off is the default; if you push, push barely — a big push drifts both faces at once |

## Reference-image constraints

- **Two character sheets are mandatory** (the one on the left and the one on the right) plus a scene sheet. Two faces in one frame, and a missing sheet means a swapped person
- Never hang a photo of the two of them together — the model copies that pose and that distance, and the spacing you wrote stops mattering. Hang two separate single-character sheets
- The prompt carries only **placement, facing and the posture of this instant** (who is on the left, who faces whom, whose eyes break away). Faces and clothing belong to the reference images
- If the shot follows another one, hang the previous frame to lock the light ratio and the room; past 6 seconds this stops being optional

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Blended faces | They stand too close and the model trades features between them until they look related | Keep at least one body width and state `visible space between them` |
| Late swap | Both faces are right for three seconds, then one set of features quietly changes | Cut back to 4–5s, hang both character sheets, push the background further away |
| Wax museum | Neither of them moves for the whole take; it reads as a photo with audio | Allow exactly one change of posture, and give the other person breathing-level motion |
| Talking over each other | Both mouths open at once and neither matches a line | Fix the order in the `[Shot k]` passage and leave silence between the two lines |
| Creeping out of frame | Over a long take someone drifts out of the edge, or loses half a shoulder | Write `both bodies fully inside the frame` and step the size back to wide |

## Examples

*The Letter Back*, R10: the son pulls out the chair at the left end of the round table and sits down while the father stays seated at the right end, and the cut never breaks — 6 seconds, wide, locked off.

Both gates sit in plain view: `both figures share the frame` means neither man leaves the picture at any point, and `unbroken take` means no cut and no reframe. Each takes an end of the table, and the gap between them is occupied by the letter, the red enamel flask and the white enamel mug. This card says the gap between two people is the relationship itself; here the gap has three objects sitting in it, which makes the distance more specific rather than less.

One posture change inside the cut and no more: the son sits down. That is the card's ceiling, and a second change would set both men twitching. The payoff is the counter-intuitive one — across these 6 seconds two faces are generated once, and relative positions, light ratio and tabletop never have to match across a cut, because there is no cut.

Example frame not generated.
