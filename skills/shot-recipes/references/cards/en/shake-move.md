---
id: shake-move
---

## What it is

Irregular movement added to the camera body. It does not change the camera position, it does not change the size, it delivers no new information — **all it changes is how much the audience trusts the cut**. A steady frame tells them they are seeing this clearly; an unsteady one makes them doubt it.

`Shake Slightly` and `Shake Strongly` are not two settings of one thing. They are **two different textures**, and the line between them is a single question: **does the shake have a source?**

- **`Shake Slightly` comes from the person holding the camera** — breath, footsteps, the small dip of a wrist. It says "somebody is in the room." It is texture, so it can run the length of a cut, or the length of a scene.
- **`Shake Strongly` comes from something happening in front of the camera** — a blast, a fall, an impact, a shove. It says "that just landed." It is an event, so it has to line up with the event, and it has to be short.

The test: **if you cannot say who delivered the hit, do not use Strongly.** A hard shake with no source does not read as tension to an audience; it reads as broken equipment.

## When to use it

- **`Slightly`: a handheld floor under a whole scene.** An interrogation, an argument, a walk — lay the faintest tremor across all of it and the footage stops being beautifully shot and starts being shot by somebody who was there. The full recipe for a handheld entrance is `handheld-follow-in`, which bundles this texture with a follow.
- **`Slightly`: someone holding themselves together.** They sit still and speak evenly while the frame trembles very slightly — the audience reads that they are about to break. Best value in the library for saying something without saying it.
- **`Strongly`: the blast, the fall, the collision.** Land the shake on the impact, run it a second to a second and a half, then settle it or cut away.
- **`Strongly`: the cut where someone takes a hit.** Shake the one who got hit; hold the one who threw it steady. One hard cut against one steady cut is how the audience knows who is losing the fight.
- **`Strongly`: the world going over in first person.** Shoved down, passing out, falling from height — hard shake plus a first-person view and the audience goes down with them. Read this one alongside `pov-shot`.

**When not to use it**:

- **Never `Strongly` on a dialogue cut.** Hard shake and the audience spends the line hunting for something to focus on; the line is wasted. To add pressure under dialogue, lay `Slightly` underneath it.
- **Never `Strongly` past 2 seconds.** Past two seconds "I got hit" becomes "I cannot see", and shortly after that it becomes nausea. This is the most common mistake on this card — whoever writes the shake always wants it to last a little longer.
- **Never two hard-shake cuts in a row.** The audience has already discounted the second one; all that is left is fatigue. For sustained chaos, hard-shake the first cut and cut to something steady and close — the contrast is more disorienting than more shaking.
- **Never a hard shake plus a camera move in one cut.** Stack it on a dolly or a follow and the model botches both; the result is a cut of pure noise where nobody can identify the subject.
- **Never on a cut that has to be read.** A pair of hands, a note on a table, the finish on a product — inserts and product cuts stay locked off, and a shake wastes the shot entirely.

## How to prompt it

One cut, short. Give `Slightly` or `Strongly`, never both.

```
medium shot, irregular camera jitter (state the amplitude — slight or strong —
and where the hit comes from: footsteps / breath / a blast / a shove),
subject remains recognizable (face and outline readable throughout, never
smeared), what the subject is doing, environmental anchors named item by item
(a shake needs something to be measured against), lighting state
```

- **Fix the amplitude with one word.** `slight` / `subtle` / `gentle` are one band; `strong` / `violent` / `jarring` are the other. Mix words from both bands and the model splits the difference, giving you neither texture nor impact.
- **The source belongs in the prompt**: `timed to the footsteps`, `timed to the impact`, `as the blast hits`. This is the line between handheld and malfunction — with no source, the model renders the whole cut as motion blur instead.
- **`subject remains recognizable` is the load-bearing phrase.** Shake is the fastest way in this library to lose a face; leave this out and half your `Strongly` cuts are unusable.
- **Name environmental anchors.** Door frames, table edges, the horizon. A shake is relative motion; with nothing steady in frame the audience cannot tell shake from blur.
- **The `[Shot k]` passage says when the hit lands** ("the impact at one second in"), and the camera word is either `Shake Slightly` or `Shake Strongly`. The recipe card `handheld-follow-in` states outright that it does not use `Shake Strongly`, and this is why: an entrance exists to be read clearly, and a hard shake works directly against that.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut (Slightly) | 3s | 2–4s | A light shake can run a whole cut, even a whole scene; under 2s nobody has time to read it as texture and it registers only as a flicker |
| Seconds per cut (Strongly) | 1.5s | 1–2s | The hardest ceiling in this library. Past 2s tension turns into illegibility, illegibility turns into discomfort, and the audience reaches for the scrub bar |
| Amplitude | slight | barely there to strong | Barely there is a shoulder rig, slight is a handheld grip, strong is something that happened. There is no smooth ramp between the two ends — the middle setting reads as nothing at all |
| Frequency | matched to the source | once per footstep to a single impact | Footstep frequency is one small dip per step; an impact is one hard hit and two or three aftershocks. Continuous patternless jitter reads as broken gear |
| Shot size | medium | close to wide | The tighter the size, the more the same amplitude exaggerates. Close-up plus hard shake is almost always a write-off — the face smears. For pressure inside a close-up, drop to barely there |
| Environmental anchors | 2 | 1–3 | Anchors are the frame of reference. With none of them, a hard shake and motion blur are indistinguishable on screen |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Smear | The hard-shake cut is all streaks and the subject is unidentifiable | `subject remains recognizable` must be present; cap it at 1.5s and pull the size back to medium or wider |
| Sourceless jitter | The frame keeps twitching while nothing at all happens in it, like a broken rig | Put the source in the prompt: `timed to the footsteps` or `timed to the impact`. Every shake needs a reason |
| Turns into blur | You asked for shake and got a cut of motion blur with a camera that never moved | No anchors were named. Add hard edges — door frame, table edge, horizon — for the shake to register against |
| Will not settle | The impact is long over and the frame is still twitching when the cut ends | State it in the `[Shot k]` passage: "two shudders and it settles" — or simply cut one second after the hit |
| Split the difference | You wanted a hard shake and got a mild, indeterminate float | Both bands of amplitude words are in the prompt. One band per cut, one camera word only |

## Examples

Not one cut in *The Letter Back* is written as `Shake Slightly` or `Shake Strongly` — and yet the texture of the gentle half is already sitting on R03. That cut's camera word is `Tracking Shot`, and the frame description carries a clause with it: a handheld feel with a slight irregular sway timed to the footsteps. The sway has a source, and the source is the person carrying the camera, so what the audience reads is "somebody is climbing those stairs behind him". **A slight shake is a texture; it can ride on another move and does not need a cut of its own.**

R04 is the control group, ready made: same corridor, same man, one continuous stabilised glide with the prompt stating outright that there is no jitter, no bounce and a level horizon. Put the two side by side and the difference between a camera in someone's hands and a camera that walks by itself reads instantly.

The hard half really is absent, and it is right to be. The heaviest beat in the film is R19 — the father's palm flat on the letter, the son's hand stopping short of it in mid-air — and the sample plays it as a locked-off close-up. Correctly: **what struck was a hand, not the building.** If you cannot say who delivered the blow, do not reach for `Strongly`. Its home is a cut where something with real physics just happened — a blast, a fall, an impact, a shove — and *The Letter Back* has none of those. The largest event in the whole picture is a letter sliding across a table.

Example frame not generated.
