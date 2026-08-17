---
id: dolly-zoom
---

## What it is

The camera body travels toward the subject while the lens zooms the opposite way to compensate. The two cancel out: **the subject occupies exactly the same amount of frame from start to finish, while the perspective behind them is replaced wholesale.** What the audience reads is not "the camera moved" — it is "the ground is being pulled out from under him".

**The difference from a plain dolly in is total.** A dolly in enlarges everything together and the subject-to-background ratio never changes. A dolly zoom holds the subject and changes only the background — it alters the space itself, not the framing.

The one-line test: **if the subject got bigger, this is not the technique, it is just a push in.**

**Now the honest part: the hit rate.** H3 accepts exactly one camera word per shot, and "travel forward while zooming back" has no word in the vocabulary at all. It has to be described in plain language and inferred by the model — and this kind of footage is thin on the ground in any training set. In practice: generate six to eight takes from the same prompt and you are lucky to pull one where the subject genuinely held its size and the background genuinely changed perspective. **Most of the time you get an ordinary dolly in, or a frame that breathes back and forth like jelly.** The fallbacks at the end of the next section are not politeness — they are where this technique usually ends up in generative video.

## When to use it

- **The moment someone is nailed to the spot.** Hearing the news, recognising the enemy, seeing the thing they were not meant to see. The figure is perfectly still and the world behind them moves — this is the one job nothing else does as well.
- **The hook frame that closes an episode.** Land it under a low sub-bass hit and this is the image the audience takes away.
- **Subjective vertigo.** Poisoned, feverish, weightless, afraid of heights — space deforming as seen from inside a character's head.
- **Long corridors, long bridges, long alleys.** With rows of receding lines in the background the hit rate goes up noticeably, because the model has something to stretch.

**When not to use it**:

- **Not against a flat background.** Bare walls, seamless backdrops, thick fog — with no receding lines there is nothing for the perspective change to show on, and six takes will yield nothing.
- **Not in a cut that carries dialogue.** Warping space and syncing lips are the two hardest things this pipeline does. Stack them and the take is guaranteed to fail.
- **Not on a deadline.** At one in six, this cut costs six times an ordinary one — and even then it is not guaranteed.
- **Never twice in one episode.** It is an exclamation mark. Two side by side and neither one lands.
- **Not with two people in frame.** The compensation can only hold around one subject; anyone else deforms along with the background.

**Falling back** — say plainly what cannot be done. These three are what actually ships:

1. **A plain push in against a long-lens-flattened background.** Give `Push In` and swap the background for a wall of dense vertical lines (railings, shelving, bridge cables), stated as heavily compressed. The audience reads closing-in rather than space-changing — but this one delivers every time.
2. **Split it into two cuts and hard-cut between them.** Cut 1: the figure standing in deep space. Cut 2: same person, same pose, same size, background now flattened and close. The audience fills in the transformation.
3. **Deliver the psychological effect by another means entirely.** A sudden tightening of the composition plus one sound cue beats a broken dolly zoom every time.

## How to prompt it

One cut, never spread across two. **Give exactly one camera word** — `Push In` or `Pull Out`. The other half of the move, the counter-zoom, can only be described in prose. Give two camera words and you have stacked two motions in one cut; the model will re-imagine the entire space.

```
medium shot, who the subject is and their pose（state that they do not move at all）,
the subject holds the same size in frame,
background scale shifts against the subject,
whether the background stretches away or compresses closer（pick one and pin it）,
receding lines named item by item（railings, cables, columns, paving joints — at least two sets）,
perspective distorts only behind the subject, lighting state
```

- **Pin the subject still**: `standing perfectly still`. Give them any action at all and the model uses it as licence to resize them, which kills the compensation instantly.
- **Name the background's direction.** Stretching or compressing, pick one. Leave it open and the model rocks back and forth — that rocking is exactly where the jelly look comes from.
- **At least two sets of receding lines.** They are the only evidence the audience has that perspective changed. Without them, even a successful take looks like nothing happened.
- **The `[Shot k]` passage says only that the body is travelling forward.** Write the counter-zoom as "the space behind him is changing", never as a second camera action.
- **Generate six to eight takes and check exactly one thing**: did the subject change size? If none pass, move to the fallbacks rather than re-rolling. This prompt gives what it has on the first batch.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Takes per attempt | 6 | 4–10 | The real knob on this card. Under four and probably none work; past ten the returns are gone — which means the background is wrong, not the count |
| Seconds per cut | 4s | 3–5s | Under 3s the change never completes and reads as a twitch; over 5s the subject size will drift, because the compensation gets harder to hold the longer it runs |
| Sets of receding lines | 2 | 1–4 | One set and perspective is unreadable; more than four and the frame becomes a line grid that swallows the subject |
| Background change amount | medium | small–medium | `slightly` is safe but invisible; `dramatically` and the model simply replaces the background, growing doors and windows that were never there. Medium is the only usable setting |
| Subject size | medium | medium to close | The closer you get the harder the compensation is to hold — face size changes are visible to the naked eye. Tighter than this, forget it |
| Subject actions | 0 | 0 | No range. One movement and the technique falls apart |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Grows together | You got an ordinary dolly in; subject and background enlarge as one | Nine failures in ten look like this. `the subject holds the same size in frame` must be in the prompt and the subject must be written as motionless; if it still fails, take a fallback |
| Jelly | The background breathes in and out as if the lens were panting | The direction was never pinned. Commit to stretching or compressing, not both |
| Grown scenery | Doors, windows and signs appear mid-move that are not in the design sheets | Drop the change amount to medium and name every background object explicitly |
| Stretched face | Subject size holds, but the features stretch along with the perspective | Add `the face is not distorted` and pull the size back to medium |
| Money down the drain | All six fail, and another dozen fail too | The background is too flat. Reshoot the scene with real receding lines, or go straight to a fallback |

## Examples

**A general-purpose technique card: not one of the thirty-six cuts in *The Letter Back* uses it. The whole film is shot conventionally, and that fact is this card's conclusion.**

The reason is not budget, it is the background. The film's main space is the flat: cracked white plaster, chest-high pale green wainscot, a round table — **flat, with not one receding line in it.** "Not against a flat background" describes this room exactly, and six to eight takes would yield nothing. The only real depth lines in the film are in the arrival sequence: the corridor wainscot converging away in R04, and the four flights of railing spiralling up the stairwell shaft in R05.

So if this story had to spend a dolly zoom, the only place it could go is R04 — and R04 is a transit cut, not the moment somebody is nailed to the spot. **The card's own instruction to check whether you actually need it rules itself out here**: the three heaviest cuts in the film (R14 pushing in on the son's face, R19 with the two hands locked on the letter, R23 pulling focus from the letter to the father) all happen in front of that flat wall, and each of them has a steadier device available.

Example frame not generated.
