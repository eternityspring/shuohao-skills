---
id: jump-cut
---

## What it is

Same camera, same size, same person — and between two cuts their posture has jumped. The time in between has been visibly thrown away, and the seam is not hidden but handed to the audience on purpose.

**It is the exact opposite of `match-cut-motion`, the only head-on opposed pair in this library.** A motion match carries momentum across the seam, same direction, same speed, so that **the audience forgets there was a cut**; a jump cut throws the position out of register so that **the audience knows a chunk went missing.** The one-line test: **the less visible the seam should be, the more you want `match-cut-motion`; if the seam has to be seen, you want this card.**

**In AI short drama this is mainly an editing action.** The generator's entire contribution is to produce two or three frames that are **identical apart from the pose** — same camera, same size, same key light, same clothes, same table. The jump itself is made by butting them together; the model never knows it took part in a jump cut.

Which is exactly where the difficulty sits: **"identical apart from the pose" is the hardest thing to get out of a generator.** Background, lighting ratio, the folds in a sleeve, the cup on the table — all of it drifts a little on every generation. A jump cut is one of the cheapest devices in live action and one of the more demanding ones here, because it has to be nailed down with reference images. Worth knowing before you start.

## When to use it

- **Compressing a wait.** A cigarette, some writing, pacing the room. Three jumps and the audience reads "a while passed", more cleanly than any transition.
- **Agitation and loss of control.** Same person, same chair, position jumping, posture collapsing a little further each time. The psychology is written directly into the edit.
- **Cutting the dead air out of talking-head and vlog.** This is those formats' native tongue — remove the pauses and the restarted half-sentences, and the jump cut *is* the rhythm.
- **Comic escalation.** The same pose three times, each one more absurd; the laugh lands on the third jump.

**When not to use it**:

- **Never with only one jump.** A jump cut needs two or three in a row before it reads as a device; one on its own just reads as a bad edit. **This is the hardest rule on this card.**
- **Not in the middle of a serious dialogue scene.** In straight drama, two people talking and then a sudden jump reads as a continuity error, not a style.
- **Not with two people in frame.** Every jump has to re-align two faces and two body positions at once, and one of them will break.
- **Not when the seam should be invisible.** That is `match-cut-motion`'s job; the two cards pull in opposite directions and the wrong one makes a whole sequence feel off.
- **Not when the framing cannot be made identical.** A slightly different size or angle produces a continuity error, not a jump cut — and audiences can tell the two apart.

## How to prompt it

Two or three cuts. **Each is a full generation, and every prompt is word-for-word identical except for the pose line.** It sounds crude; it is the entire craft of this card.

```
medium shot, identical framing in every cut,
only the pose changes between cuts,
the pose for this cut（cut 1: chin propped on one hand / cut 2: slumped back / cut 3: face down on the table）,
scene and dressing named item by item（same table, same cup, cup in the same place）,
the same key light, the same lighting ratio, the same clothes
```

- **Apart from the pose line, all three prompts are literally identical.** Do not casually rewrite an adjective, do not swap in a synonym. Change one word and the background drifts one notch.
- **Generate cut 1 first, then attach it as the reference image for the other two.** This is the only thing that actually holds the dressing and the lighting ratio; no amount of prompt repetition does it as well.
- **The pose difference has to be obvious without relocating the person.** Same chair, plainly different posture. Move them to a new position and the audience reads two separate scenes, and the jump cut evaporates.
- **The `[Shot k]` passage gives one static pose per cut**, never an action in progress — a jump cut trades on the gap between states, not on movement.
- **Keep the cuts short and equal**: 1–2 seconds each, all the same length. Uneven lengths turn a jump cut into a rhythm accident.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Number of cuts | 3 | 2–4 | Two is the floor and only really works in talking-head; three is the safe default; past four the poses themselves need to escalate to justify it |
| Seconds per cut | 1.5s | 1–3s | Under 1s the new pose is not read in time; over 3s each cut becomes its own shot and the jump disappears |
| Pose difference | obvious | obvious – very obvious | Too small and it reads as a glitch; large enough to relocate the person and it reads as two scenes. "Clearly different posture in the same chair" is the safe zone |
| Framing difference | 0 | 0 | No range. A slight change of size or angle gives you a continuity error, not a device |
| Time skipped per jump | a few minutes | tens of seconds – half an hour | Too little and no time appears to pass; too much and the clothes or the daylight should have changed, which costs you an explanation |
| Takes per cut | 2 | 1–3 | You are not picking the best individual cut, you are picking the three that most resemble each other. Choose as a set, never one at a time |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Single jump | One jump and straight on to the next scene, which reads as a mistake | Two jumps minimum. If you cannot find a second, use another device rather than forcing one |
| Fake jump | The framing differs slightly between cuts and it reads as a continuity error | Make all three prompts word-for-word identical apart from the pose line, and attach cut 1 as the reference for the others |
| Everything drifts | The pose jumped, and so did the cup, the picture on the wall and the lighting ratio | Name the dressing in every cut, always attach the reference image, and darken or defocus the background if it keeps moving |
| Face swap | One of the three clearly is not the same person | Attach the character sheet on all three, pull back to medium, and do not give the face too much frame |
| Over-jumped | The poses differ so much that it reads as three different scenes | Bring the difference back to "different posture, same chair" and never relocate the subject |

## Examples

**A general-purpose technique card: no cut in *The Letter Back* uses a jump cut, and this film largely should not.**

The closest slot is the whole sitting sequence, R09 to R18: father and son on opposite sides of a round table for an afternoon. **Restless waiting and a stand-off are the textbook jump-cut position** — same camera, three jumps, each one slouched a little further, and an entire afternoon is said in two seconds.

**The sample chooses the opposite.** R10 runs six seconds without a cut; R13 holds on the listener for one drop and lift of the eyes; R18 lets the daylight go on its own. It says time by refusing to cut. A jump cut says "I threw the middle away", and this story is saying the middle was not thrown away — they really did sit there that long. Both are defensible; the choice sets the film's tone rather than its editing habits.

The jump cut's real home is talking-head and vlog. The "He tells it" group in the sample (R30 to R32) is that format's camera position — the son at the round table, telling the lens where the letter came from. Shoot it as an actual piece to camera, cut the pauses and the restarted half-sentences, and the jump cut there is not a special technique at all but the default way of cutting. The sample does not cut it that way because those three frames are each demonstrating a different card.

Example frame not generated.
