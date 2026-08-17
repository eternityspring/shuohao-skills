---
id: talking-head-anchor
---

## Intent

The single largest form in AI video is one person talking to the lens — explainers, product walkthroughs, cold opens. The difficulty is not the framing; it is **the narrow gap between still and alive**: hold perfectly still and it reads as a photograph with audio glued on; move too much and the face drifts within seconds.

The whole point of this recipe is to write that gap down: lock the camera, keep only breathing-level motion.

## Prompt skeleton

One cut is the norm; add a second only to underline something.

```
medium shot, the speaker facing the lens, framed above the shoulders, eyes on the camera,
natural subtle breathing motion, clean background set well back from the camera, soft key light
```

- **Keep the background far and plain**: the further and simpler it is, the less likely the model repaints it mid-sentence
- The **`[Shot k]` passage says one thing only**: the speaking. No gestures, no walking — whatever body part you add is the body part that breaks
- Dialogue goes into the `<d>` block as usual. This card is inherently a lip-sync shot; accept that rather than routing around it with voice-over
- For the two-cut version, cut 2 is a `Push In` from medium to close **on the same axis** — never a new angle

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 6s | 4–8s | The most stretchable recipe in the library — the picture barely changes, so longer often reads steadier; past 8s accumulated facial drift becomes visible |
| Size | medium | medium–close | Facts play at medium (the shoulder line reads as credible); emotion or a conclusion closes in |
| Breathing amplitude | subtle | barely there–subtle | Writing `subtle` is enough; visible sway reads as handheld and the face smears with it |
| Background distance | far | mid–far | The closer the background, the more it grows new objects mid-sentence; if it must be close, make it a plain wall |
| Key light | soft three-quarter | frontal–three-quarter | Hard light exaggerates the shadows around the mouth and the facial structure jumps while speaking |
| Cuts | 1 | 1–2 | If one cut says it, use one; cut 2 exists to emphasise, not to change angle |

## Reference-image constraints

- **One character sheet is mandatory** — this is the most reference-dependent card in the library: the whole cut is that face, and any drift is visible
- If the background is a real space, hang the scene sheet. If it is plain or blurred, pin the colour and blur level in the prompt rather than leaving it to the model
- In the two-cut version, **cut 1 must be the reference for cut 2** — the push-in is where faces swap

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Photograph syndrome | Nothing moves for the whole cut; it reads as a still with audio | `subtle breathing motion` is mandatory; the shoulder line and a blink are the minimum evidence of life |
| The speaker changes | Features slowly shift over the second half of the cut | Shorten the cut, hang the character sheet, push the background back — all three together |
| Background grows things | Plants, frames and patterns appear mid-sentence | Write the background as far, plain and set back — or make it a solid colour |
| Gestures break it | You wrote "raises a hand to emphasise" and the hand grows a sixth finger | No hands in a talking-head cut; if you need the gesture, cut to a separate `hands-tell` |
| Hard light jumps | Under hard side light the cheekbone shadow changes frame to frame | Switch to soft light and bring the key toward three-quarter frontal |

## Examples

*The Letter Back*, R30: the son sits at the round table facing the lens and tells where the letter came from — 6 seconds, medium, locked off.

Nobody delivered a piece to camera in 1995, so the reel reads this section as a documentary interview instead: the setup is a talking-head anchor and still part of the story. The framing comes straight off this card — facing the lens, above the shoulders, gaze on the lens, eyes on the upper third line, the near edge of the table crossing the bottom of frame.

`subtle breathing motion` cannot be proven by a still; it lives in the `[Shot k]` passage — breathing and natural blinks, nothing else moving. The cut also shows why this card's "far and plain" background rule is worth so much: behind him is chest-high wainscot under cracked white plaster, one wall with nothing on it, and nothing for the model to redraw across six seconds of talking.

The example frame is exactly this cut (R30).
