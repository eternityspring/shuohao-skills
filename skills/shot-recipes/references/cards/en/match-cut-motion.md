---
id: match-cut-motion
---

## Intent

No dissolve, no fade to black between the two cuts — **momentum** welds them. Something is travelling right in the first cut; something else keeps travelling right in the second, and the eye has not landed yet when the picture has already changed.

There is exactly one discipline, and breaking it is instantly visible: **cut while the movement is still happening, not after it finishes**. A hand reaches, stops, and then you cut — the momentum has already decayed and the two cuts read as two separate pictures. Cut while the hand is halfway out and the next cut catches the momentum, and the two are welded.

Generative video has a natural advantage here: the motion inside a cut is the model's own interpolation, so if the prompt says "still moving when the cut comes", it simply will not compose that settling beat at the end.

## Prompt skeleton

Two cuts, fixed. Write both — one alone does not exist as a match cut.

**Cut 1** (momentum out):

```
medium shot, a hand reaching toward the case, travelling from left to right and
still travelling when the cut comes, motion continues across the cut,
the same movement direction carries into the next shot, locked-off camera
```

**Cut 2** (momentum in):

```
close-up, another hand pressing down onto the same case, entering from the left
and already in motion, picked up mid-way rather than restarted,
motion continues across the cut, the same movement direction as the previous shot,
locked-off camera
```

- **No settling at the end of cut 1**: write `still travelling`; never `comes to rest`, never `pauses`
- **No restart at the head of cut 2**: write `already in motion`, `picked up mid-way rather than restarted`. Start cut 2 from stillness and the momentum breaks once, which wastes everything before it
- **The direction must match across the cuts**: both rightward, or both downward. The direction itself is free; reverse it and the audience reads two events, and the match cut is dead
- The two cuts may jump in size (medium → close). **They may not jump in direction**
- `Static Shot` on both is the default — the subject already supplies the momentum. With `Tracking Shot`, the camera movement must run the same way as the subject in both cuts

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 2s | 2–4s | A match cut lives on momentum, not duration. At 4s the movement completes inside the cut and the cut point slides back to "after" |
| Number of cuts | 2 | 2 | No range: three cuts is not a match cut, it is an action beat |
| Cut point | six or seven tenths through the movement | five–eight tenths | Cutting early hits harder, like being pulled by the arm; past eight tenths the momentum has decayed and the join reads blunt |
| Movement direction | left to right | any, but identical across both cuts | Pick whichever direction you like; mismatched across cuts, it is two events |
| Size gap | medium → close | one step–two steps | One step is safest; two (wide → close) needs a shared object to keep the audience anchored |
| Movement amplitude | medium | medium–large | Small movements (a blink, a nod) cannot carry momentum and the join goes unnoticed |
| Camera | Static Shot | Static Shot / Tracking Shot | If the subject moves, the camera need not; move both and the two directions start fighting |

## Reference-image constraints

- **Hang the same object sheet on both cuts** (the case being reached for, the door being pushed, the cup being handed over) — the object is what aligns the two cuts, and if it changes the audience immediately sees two places
- **Once cut 1 exists, hang it on cut 2**: hand position, cuff, table height and light ratio all align off it
- The prompt carries the direction and how far into the movement we are; faces and clothing belong to the references
- For a match cut across spaces (reaching in one room → pinned down elsewhere), each cut also needs its own scene sheet — only the object is shared

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Cut too late | Cut 1 finishes the movement and stops before the cut; the two read as two segments | End cut 1 on `still travelling` and strip every word for stopping out of the prompt |
| Reversed | One cut goes right, the other left, and the audience reads two events | Write `same movement direction` in both and pin the actual direction (left to right) |
| Restarted | Cut 2 begins the same movement from stillness and the momentum breaks | Write `already in motion` and `picked up mid-way rather than restarted` in cut 2 |
| Speed mismatch | One cut slow, one fast, and the join stutters | Give both cuts the same duration and keep the movement amplitude in the same bracket |
| Object drift | The case changes colour between cuts, or the handle moves to the other side | Hang the object sheet on both cuts, and hang cut 1 as the reference for cut 2 |

## Examples

*The Letter Back* contains no motion match cut. The reel's only two-cut transition is R33/R34, the whip-blur bridge (`whip-blur-bridge`), and the two should not be confused: a whip welds two spaces with motion blur and the camera does the moving; a match cut welds two cuts with the momentum of the subject and the camera can sit perfectly still. The cards share exactly one rule — direction must hold — and nothing else. A whip changes location; a match cut usually does not, it just chops a continuous action apart and keeps it reading as continuous.

The nearest thing is R19 → R20: the son's hand stops in mid-air, and the next cut has the letter already sliding across the table. It does not qualify, because the hand at the end of R19 has **come to rest** — the momentum is spent, and the first rule of this card is that the cut lands mid-action. To rebuild the pair as a match cut, R19 would have to still be reaching when the cut arrives (`still travelling when the cut comes`), R20 would have to enter from the same side and be `picked up mid-way rather than restarted`, and both prompts would carry the same direction, word for word.

Example frame not generated.
