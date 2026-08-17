---
id: slow-motion
---

## What it is

Something that would normally be over in an instant is stretched out until the audience can read every stage of it: how the spray breaks up, how the cloth lifts, how a head comes round.

**Slow motion in generative video is not overcranking.** The model has no frame-rate knob. Write "slow" in the prompt and what it reaches for is **what slow-motion footage looks like** — shallow focus, bokeh, individually resolved droplets, single strands of hair. It gives you the look, not an actual change in the rate of time. Two consequences follow directly: **it works beautifully on detail-rich subjects (fluids, fabric, dust, hair) and does nothing at all for a person standing and talking; and it arrives with a coat of commercial gloss you have to actively suppress.**

It is one half of a pair with `time-lapse`: one stretches time out, the other squashes it flat. They share the same hard constraint — **neither can carry dialogue.**

**Can you fix it in post?** A little, but do not count on it. Generated clips usually run at 24–25 fps; slow them to 0.5x and they judder frame by frame unless you add interpolation, which costs its own image quality. **The usable range in post is down to about 0.75x.** Everything slower than that has to be written into the prompt at generation time.

## When to use it

- **One decisive physical moment.** A palm slamming onto a case lid, a cup hitting the floor, a curtain thrown back, rain landing on a shoulder. That half-second is worth more screen time than it naturally has.
- **The turn of a head or the lift of an eye at an emotional peak.** Stretch the half-second the eyelids take and the audience watches the change happen instead of only seeing the result.
- **Texture and fluids in product work.** Pouring, scattering, fabric falling. This is the highest hit-rate category, because all the detail is genuinely in the frame.
- **The instant of an impact.** Slow the contact and keep everything either side at speed; the contrast is what makes the rhythm.

**When not to use it**:

- **Not in a cut with dialogue.** The mouth slows with everything else and no dub will ever sit on it; the audience is out of the story on the first syllable.
- **Not across a whole sequence.** Three slow cuts in a row and it reads as a music video; the drama's pulse dies. Slow motion is a contrast, and without normal speed to measure it against there is nothing.
- **Not on one person standing or walking.** There is no detail to resolve, so slowing it down only produces vacancy.
- **Not on a cut that has to deliver information.** Who is where, what they picked up, whether the door opened — slow motion halves the information density, and expository cuts need full speed.
- **Never more than twice in an episode.** By the third time it is not emphasis, it is a tic.

## How to prompt it

One cut, two to four seconds, and **only one action gets slowed.**

```
close-up, the single action and exactly how far into it we are（a palm coming down onto the case lid）,
motion slowed to a drift,
the whole frame moves at one speed,
the resolvable details named item by item（lifted dust, a trembling edge of cloth, separating droplets, a strand of hair）,
nothing else moving in the background, lighting state and where the highlights sit
```

- **One action only.** Slow motion already carries little information; put two actions in one cut and neither is readable.
- **`the whole frame moves at one speed` is not optional.** The single most common failure is that the subject slows while background extras and water keep running at normal speed — the result looks like two clips laid over each other.
- **Name the details.** The entire value of slow motion is the stuff you normally cannot see. Without dust, cloth edges and droplets named, the model simply plays the action slowly and nothing new appears.
- **Never write `frozen`, `still` or `motionless`.** Push it too far and the model hands back a still image. What you want is a drift — still moving.
- **The `[Shot k]` passage states the start and end of this one beat** (palm an inch off the lid → palm fully pressed down), not just "slowly presses down".
- Locked camera by default. If you must move in, make it a tiny `Push In` — a big move against slow motion is two speeds fighting.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–4s | Slow motion feels roughly twice as long as it is. Four seconds is already long; past five the audience starts waiting for the next cut |
| Number of actions | 1 | 1 | No range. Slow two things at once and neither reads |
| Degree of slowness | close to a drift | slightly slow – drift | "Slightly slow" does not read as a technique, only as a slow actor; any slower than a drift and the model gives up on motion entirely |
| Resolvable details | 2–3 | 1–4 | One and the frame is empty; more than four and the model loses track, rendering some of them as smears |
| Post speed change | 1x (none) | 1x – 0.75x | Down to 0.75x nobody sees judder; at 0.5x it steps frame by frame unless you interpolate |
| Times per episode | 1 | 0–2 | The third one stops working. Save the budget for a single real hammer blow |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Half speed | The subject is slow but background figures and water run at normal speed, like two clips overlaid | `the whole frame moves at one speed` goes in the prompt, and clear the background of anything that moves |
| Judder | Slowed in post, the picture steps frame by frame | Keep post speed at 0.75x or above; put the rest of the slowness in the prompt |
| Advert gloss | The cut turns into soft light, bokeh and shallow focus that no longer matches the scenes either side | Delete blanket style phrases like `cinematic slow motion`; describe only how slow this one action is |
| Frozen | Pushed too far and the model returns an almost static image | Strip `frozen` / `still` out of the prompt, write `drift`, and state where the action starts and ends |
| Lip mismatch | A slowed cut with dialogue where mouth and audio are hopelessly apart | No dialogue in this cut. If you need a line, give it its own cut at normal speed |

## Examples

**A general-purpose technique card: not one of the thirty-six cuts in *The Letter Back* uses slow motion.**

The place that most wants it is R20: the letter sliding across the tabletop under the father's fingertips. Paper dragging over wood grain, the crease lifting as it goes — the detail is genuinely in the frame, which is this card's highest hit-rate category. It ships as a two-second insert at normal speed for a rhythm reason. **That slide is the answer to the stand-off in R19**, where the father's palm is flat on the letter and the son's hand stops short of it; the landing has to be clean. Slow it and "he let go" turns into a lyrical moment, and the extreme close-up on the crease in R21 has nothing left to catch.

Nowhere else fits better. R24, the enamel mug settling onto the table, is the crisp landing that opens the object sequence, and slowing it only adds a coat of advertising gloss. R13 — the eyes going down to the letter and coming back up — is on paper exactly the "lift of an eye at an emotional peak" this card describes, but it is already carrying `reaction-hold`, and a reaction hold needs a picture that breathes in real time. Change the speed and it stops saying "he held it in" and starts saying "somebody is pointing out that he held it in".

**Slow motion runs on contrast, and every contrast in *The Letter Back* is built from not cutting and from holding still, never from changing speed.**

Example frame not generated.
