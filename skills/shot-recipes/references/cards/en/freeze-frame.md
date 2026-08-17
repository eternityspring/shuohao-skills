---
id: freeze-frame
---

## What it is

The picture stops. Not slows — stops. The breathing stops, the fog stops, the flicker in the light stops. **Not a pixel moves.**

**Draw the line first, because this is the easy one to confuse.** `reaction-hold` is "a person holding almost perfectly still", and the picture there is very much alive — she is breathing, her lashes are lowering, the fog outside is still drifting past. A freeze frame is the entire image stopped dead. The one-line test: **if you can still see him breathing, it is not a freeze frame.**

**Now whose job it is: in AI short drama, a freeze frame is an editing action, not a generation action.** The model cannot produce true stillness. Write `frozen`, write `completely still`, and you will still get a rising chest and drifting hair, because it generates video and static video barely exists in its training data. There is exactly one way to do this: **generate a normal cut → pull a single frame in the edit → hold that frame for 0.6–1.2 seconds**, with a sound cue, a desaturation or a title over it.

So the prompting section of this card is not about how to stop the picture. It is about **how to make that frame worth pulling**: the pose has to peak, the subject must not carry blur, and the outline has to separate from the background. Those three the prompt can do. The rest belongs on the timeline.

## When to use it

- **The hook at the end of an episode.** The instant she turns her head, held, cutting to the title card or next-episode tease. This is the single most common way a vertical short drama signs off.
- **Holding on a character while a name card comes up.** The freeze buys exactly the second the caption needs to be read.
- **A comic "and that is how bad it is" beat.** The action stops at the most awkward point and the laugh lands on the stop.
- **The top of a climactic action.** The hand at its highest, the slap not yet landed. Freeze, then cut to black — you never have to render the rest of it.

**When not to use it**:

- **Not when the point is that he is holding himself together.** That needs a picture that is still breathing so we know he is alive — that is `reaction-hold`.
- **Not more than twice in an episode.** A freeze is punctuation, not a sentence. By the third one it reads as a cheap short-form tic.
- **Not while the subject is moving fast.** The frame you pull carries motion blur and the hold looks like a playback fault rather than a choice.
- **Not without something layered on top.** A vertical-screen audience seeing a motionless image assumes the player has stalled. A freeze needs a sound cue, a desaturation or a caption landing with it so it reads as deliberate.
- **Not in the middle of a sequence for no reason.** A freeze stops the rhythm outright, and something has to catch it — a title, a caption, the next scene. With nothing to catch it, you have just dropped the episode on the floor.

## How to prompt it

What you generate is **a normal-speed short cut** with the freeze point about seventy percent of the way through. The prompt's job is to make that frame clean and pullable.

```
medium shot, who the subject is and exactly how far into the action we are,
the pose peaks and holds,
no motion blur on the subject,
the outline separated from the background（background darkened or thrown out of focus, edges clean）,
the subject complete in frame and not cropped, lighting state and where the rim light sits
```

- **Take the action to its peak and stop there**: `turns her head and holds at the far point`. Write it as a constant-speed turn and the only frames available are mid-turn ones, which look like random screenshots.
- **`no motion blur on the subject` is the load-bearing phrase.** The model attaches blur to fast movement by default, and a frozen frame with blur simply does not read. The edges have to be crisp.
- **Push the background down.** During that held second the audience has a full second to look at the picture, and anything vague back there will be found. Darken it, defocus it, or move it away.
- **The `[Shot k]` passage covers this one action reaching its peak** — no second action, no dialogue. A freeze frame with a half-open mouth in it is wasted.
- **The prompt's job ends here.** The actual freeze happens in the edit: pull the frame, hold it 0.6–1.2 seconds, land a sound cue, optionally desaturate or caption it. **This card does not pretend the generator can do that part.**

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Hold length | 0.8s | 0.4–2s | Under 0.4s it reads as a stutter; over 2s it stops being punctuation and becomes a silence before black, which needs its own audio to hold it up |
| Freeze point in the cut | 70% in | 60–80% | Too early and the rest of the cut is wasted; too late and there are only two or three candidate frames left to choose from |
| Source cut length | 3s | 2–4s | Three seconds leaves half a second either side of the peak, which is what gives you a choice; under two you often have no usable frame at all |
| Layered treatment | sound cue + desaturation | at least 1 | With none of it, the audience thinks the player stalled. The floor on this knob is one, not zero |
| Times per episode | 1 | 0–2 | The second needs to be far away from the first; the third is cheap |
| Takes per attempt | 2 | 1–3 | You are picking a frame, not a cut. Two takes yield six to eight candidate frames, which is plenty |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Still breathing | You wrote `frozen` and the chest still rises, the hair still drifts | The generator cannot do stillness; stop fighting it here. Pull the frame in the edit |
| Blurred frame | The frame you pulled has motion blur on the subject and the hold looks like a fault | `no motion blur on the subject` in the prompt, and put the freeze point at the peak rather than mid-movement |
| No peak | The action stops halfway and the hold reads as a mistake, not a device | Write `the pose peaks and holds` and describe the peak concretely (head turned until the profile faces the lens) |
| Looks stalled | Nothing layered on the freeze and the audience thinks the video hung | Land a sound cue on the same frame; desaturate or caption it if you are still unsure |
| Background steals it | For that whole second the audience is looking at the vague thing behind her | Darken or defocus the background; leave no second point of information on the frozen frame |

## Examples

**A general-purpose technique card: no cut in *The Letter Back* is a freeze, and no storyboard should contain one — a storyboard describes what to generate, and a freeze happens after generation.**

The most pullable frame in the film is nevertheless sitting there in R35: the son stopped at the end of the corridor, locked camera, the pose already at rest, backlight cutting his outline clean off the window behind him, both walls sunk to near black, not a trace of blur on him. All three things this card's prompting section asks for — the pose peaks and holds, no motion blur on the subject, the outline separated from the background — are already satisfied. What is left is a timeline job: hold it 0.8 seconds and land a door-closing cue on it.

For a heavier sign-off, move the freeze to the last frame of R36: the whole block in frame, the fourth-floor window still burning, held, desaturated, title over it. **The two landing points say two different sentences** — freeze on R35 and it is "he left"; freeze on R36 and it is "the letter is still on the table".

There is no "freeze frame" field in the storyboard JSON and there should not be. That boundary is the reason this card exists: it lives in the library so the frame gets protected while the prompt is being written, rather than discovered to be missing once you are already cutting.

Example frame not generated.
