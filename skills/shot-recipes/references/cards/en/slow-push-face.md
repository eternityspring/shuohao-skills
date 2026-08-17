---
id: slow-push-face
---

## Intent

Emotion is not acted into a shot; it is squeezed out by **the camera getting closer**. Every scene has a moment where the audience must look at nothing but a face — hearing the bad news, making the decision, holding back the tears. That moment belongs to this card.

In AI video it is a high-risk move. The frame holds one face, and a face is the thing the model most readily changes its mind about over time; the camera is also moving, which invites it to re-imagine the features on the way in. So almost everything written on this card is a **constraint**: push slowly, push a little, keep it short.

## Prompt skeleton

One cut, 3–5 seconds, `Push In` only.

Write the frame prompt on this skeleton:

```
close-up, the face fills the frame from chin to hairline, eyes in sharp focus, a single
change of expression, slow push in, framing changing no more than twenty percent, background
falling out of focus, soft light ratio, environment anchors, cinematic film still
```

- **Keep the push under twenty percent**: the change from start to end only needs to be visible, not dramatic. Write `slow`, never `dramatic`
- **One change of expression per cut** (the eyes dropping, the jaw setting, the breath going shallow). Move brows, eyes and mouth together and you get a grimace
- **`Push In` only — never stacked with `Zoom In`**: one moves the camera, the other stretches the lens, and writing both makes the model add them together
- Dialogue goes into the `<d>` block if there is any, but this card is usually at its best **with no line at all** — the push is the line

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–5s | 3s is a stomach drop, 5s is holding something back. Past 5s facial drift becomes all but visible |
| Push amount | 15% | 10–20% | 10% is a barely perceptible approach and holds up best; past 20% it turns jerky, as if the face were being dragged forward |
| Starting size | medium | medium–close | Ending one step closer than you started is plenty. Start at close and the end frame is all features with the face jammed against the edges |
| Blur | medium | medium–strong | More blur looks more like a finished film, but the eyes stay on the focal plane — never blur into the lashes |
| Changes of expression | 1 | 0–1 | Zero also works under a push (a blank face can be crueller); two will break |
| Light ratio | 3:1 | 2:1–4:1 | Push in under hard light and the shadows on the cheekbone and the nose repaint all the way in, taking the face with them |
| Cuts | 1 | fixed at 1 | Needing a second push means the first one did not land; never push twice in a row |

## Reference-image constraints

- **One character sheet is mandatory** — second only to `talking-head-anchor` in reference dependence: the cut is that face, and the camera is moving. Without the sheet the person changes
- Hang the scene sheet if the background is a real space. If the background is pure blur, pin its colour and blur level in the prompt rather than leaving it to the model
- The prompt carries framing and this one change of expression; features, hair and collar belong to the reference image
- When this cut follows another, hang the previous frame to lock the light ratio — shift the ratio during a push and the facial structure shifts with it

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Jerky push | The push is fast and heavy, as though the lens were yanking, and the last half second springs back | Hold it under twenty percent, stretch to 4s, and write only `slow push in` |
| Drifting face | The features shift on the way in and the end frame is a different person | Cut to 3s, hang the character sheet, drop the push amount one notch — all three together |
| Dead eyes | The eyes lose focus, the pupils smear, and the emotion goes with them | `eyes in sharp focus` is never optional; blur belongs to the background only |
| Cropped face | The forehead or the chin gets clipped by the frame at the end of the push | Leave ten percent more headroom at the start and write `from chin to hairline` |
| Overacting | Brows, eyes and mouth all move at once, and it reads as a grimace | Keep one change of expression and write the rest of the face as still |

## Examples

*The Letter Back*, R14: a slow push onto the son's face until it fills the frame, the decision arriving without a word — 4 seconds, close, `Push In`.

Both gates in one cut: `face fills the frame` is where the push ends, `eyes in sharp focus` is the pair of eyes that never blink through it. And it follows this card's principle that almost every instruction here is a restriction — slow, no change of angle, only 4 seconds long, the wainscot and cracked plaster dissolving out of focus behind. By the end there is almost nothing left for the model to reimagine except one face.

One expression change and no more: the decision lands, rather than eyebrows, eyes and mouth all moving at once. The light is pinned too — warm bulb from the upper left, cold window light grazing the right cheek — so the ratio across the face does not drift while the camera creeps in. That is the other half of why the face holds.

The example frame is exactly this cut (R14).
