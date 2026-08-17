---
id: hands-tell
---

## Intent

Hands are where generative models break most reliably — six fingers, a missing joint, a thumb passing through a prop. This card **turns that weakness around**: hands only in the frame, one unambiguous action, no face.

Inverting it works for two reasons. **No face means no consistency budget** — the most expensive drift in AI video simply is not in the shot. And **one action means no room for extra fingers** — the model never has to invent joints inside a complicated gesture. As a bonus it skips lip-sync entirely: a hands cut carries emotion without matching a mouth.

In short-form drama it is the most useful emotional patch there is: a fist closing, a hand offered and withdrawn, fingers moving over something old. One cut does the work of a monologue.

## Prompt skeleton

One cut is the norm; add a second when the result needs stating.

Write the frame prompt on this skeleton:

```
close-up of hands only, no face visible, one clear action (closing / releasing / offering /
running the fingers over), the material of the object being held, the forearm entering from
the frame edge, shallow depth of field, side light picking out the knuckles, environment
anchors, cinematic film still
```

- **One action per cut**: closing, releasing, offering, brushing over. No complex gestures, no counting, no sign language
- **No face**: this is the only card in the library that actively keeps the face out of frame, and `no face visible` is what it stands on
- **Give the hand somewhere to land**: shut, delivered, stopped. A hand with no endpoint keeps fidgeting, and the longer it fidgets the worse it gets
- Skip dialogue if you can. If a line is needed, let it land on this cut as voice-over — there is no mouth to match
- Two-cut version: cut 1 is the action, cut 2 is the aftermath (the open palm, the mark left behind, the empty hand)

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–4s | Hand actions stay stable only while they are brief; past 4s a finger grows mid-cut or a joint bends the wrong way |
| Cuts | 1 | 1–2 | Cut 1 is the action, cut 2 is only the aftermath — never a second action |
| Size | close | close–extreme-close | Extreme close-up for a single hand; if two hands interact, step back to close and keep whole palms in frame |
| Number of actions | 1 | fixed at 1 | The one knob in the library you may not tune. Add a second action and the finger count goes out of control |
| Hands in frame | 1 | 1–2 | Two hands in one cut break several times more often than one; if one hand can say it, use one |
| Blur | strong | medium–strong | The blurrier the background, the less likely a sixth finger grows out of the gaps between the others |
| Light ratio | 4:1 | 3:1–5:1 | Side light picking out knuckles and material is the entire texture of this card; flat light turns a hand into dough |

## Reference-image constraints

- **The prop sheet is mandatory**: the object in the hand drifts more visibly than the hand does — a brass clasp turning silver is caught instantly
- **The character sheet is optional** — the only card in the library that can skip a face. But the sleeve, the fabric, a ring, the nails, a scar have to live either in the prompt or in a reference, or the hand belongs to nobody from the previous cut
- If the surrounding cuts have a face in them, **do not** hang that character sheet here: the model will find a way to fit the face into the frame and `no face visible` stops meaning anything
- The prompt carries the action and the materials; what the hand looks like is left to the light and the framing

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Six fingers | An extra finger, an extra joint, a thumb on the wrong side | One action, step back to close, drop to a single hand — all three together |
| Passing through | Fingers pass through the prop, or the prop grows out of the palm | Hang the prop sheet and spell out the grip (held, cradled, pinched, and where) |
| Face creeps in | A chin, some hair or half an ear appears at the frame edge | `no face visible` is never optional; tighten the framing one more step |
| Severed hand | The wrist appears out of nowhere with no forearm and no sleeve | Write `the forearm entering from the frame edge` and name the cuff material |
| Idling | The hand keeps moving with nowhere to arrive; four seconds pass and nothing happened | The action needs an endpoint — shut, delivered, stopped — written into the action phrase |

## Examples

*The Letter Back*, R19: the father's palm flat on the folded brown paper letter, fingers spread; the son's hand comes in from the right and stops short of it — 3 seconds, close, locked off.

`hands only` and `no face visible` are literally true here: a tabletop, two hands, the red rim of the enamel mug at the edge, and the bare bulb pressing everything else into darkness. The two hands differ in age and in force, and one cut says who wants it taken away with no face anywhere in the picture — which also means no mouth to sync and no features to hold.

It keeps the one-action rule too: pinning the letter down is the whole action, and the reaching hand exists only to give that action a destination. No second gesture, no counting, no pointing.

The example frame is exactly this cut (R19).
