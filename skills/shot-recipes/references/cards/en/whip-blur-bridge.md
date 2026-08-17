---
id: whip-blur-bridge
---

## Intent

There is nothing between this room and that one, and a straight cut drops the audience out. The whip-blur bridge solves it like this: cut 1 throws the camera sideways at the end and the picture tears into streaks; cut 2 settles out of streaks arriving from the same side. What the audience reads is "I turned my head", and two unrelated places are welded together.

**A whip is far cheaper generatively than procedurally.** Procedural work means computing the blur kernel, the direction, the strength; the model already knows how to paint motion blur — it has seen thousands of whips — so telling it "these are streaks from a whip" gets you something more natural than hand-tuned values.

The cost is that it will not align the two sides for you: **both frame prompts have to carry the blur**. Write it on one cut only and what you get is a smear followed by a hard cut.

## Prompt skeleton

Two cuts, fixed. Write both.

**Cut 1** (whipping out — blur at the tail):

```
medium shot, the camera whipping to the right at the end of the shot,
motion blur streaks smearing the background into horizontal lines,
direction of travel preserved to the right, the subject sliding out of frame left,
vertical edges in the background — door frames, shelving — pulling into streaks
```

**Cut 2** (whipping in — blur at the head):

```
wide shot, the frame settling out of a whip coming from the same side,
motion blur streaks still dragging across the opening moment before the image steadies,
direction of travel preserved to the right, the new space resolving out of the blur,
the subject sharp once the frame has settled
```

- **Both cuts need `motion blur streaks`**: the one hard rule on this card. Write it only on cut 1 and cut 2 arrives as a clean new shot with the bridge broken underneath it
- **Both whips must run the same way**: cut 1 throws right, so cut 2 arrives from the right. Reverse it and it reads as two separate whips — worse than no whip at all
- **Say which end the blur is on**: `at the end of the shot` for cut 1, `across the opening moment` for cut 2. Leave it out and the model blurs the whole thing
- **The background needs vertical edges**: door frames, shelving, railings, store racks. A plain wall whips into flat grey, no streaks, and nobody reads it as a whip
- Use `Pan Left` / `Pan Right` — a whip is a **turn**, not a move. Not `Tracking Shot`

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 2s | 2–3s | The blur only occupies one end; the actual content still needs room. Past 3s it becomes two ordinary shots with a flick wedged between them |
| Blur segment | about half a second | half a second–one second | The critical knob on this card. Too short and it does not read as a whip; too long and it is a smear carrying no information |
| Whip direction | rightward | any of the four, but identical across both cuts | Any direction works; reverse it between cuts and the bridge collapses |
| Blur strength | strong | medium–strong | One of the few knobs in the library you may **push hard**: the model paints motion blur reliably, and what smears is the background — the subject comes back sharp once the frame settles |
| Size | medium → wide | medium / wide | Give cut 2 a wide: land out of the whip straight onto the whole new space, which is the cheapest way to explain it |
| Number of cuts | 2 | 2 | No range: one cut whips out, one settles in, and that is the bridge. To reach a third space, hang this card again |
| Camera | Pan Right | Pan Left / Pan Right | These two only. A whip pivots; write it as travel and there are no streaks |

## Reference-image constraints

- **Each cut hangs its own scene sheet.** A whip bridges two spaces and cut 2 is somewhere entirely new — without a sheet the model invents it
- Write the vertical edges (door frames, shelving, railings) into the prompt; the streaks are pulled out of them
- **The blur itself needs no character consistency** — that is where this card saves the most, since streaks swallow everything. The subject after the frame settles in cut 2 still needs its character sheet
- **Do not hang cut 1 as cut 2's reference.** The two spaces are supposed to look different, and hanging it drags the new space back into the old palette and light ratio

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Blur on one side | Only one cut carries the blur, so it plays as a smear plus a hard cut | `motion blur streaks` belongs in both frame prompts (that is what the gate checks) |
| Reversed whip | Cut 1 exits right, cut 2 arrives from the left, and it reads as two whips | Write `direction of travel preserved` in both and pin the same direction |
| Over-blurred | The blur drags on for two seconds and nothing readable is left | Cut it to half a second or one, and say which end it sits on |
| No streaks | A plain wall whips into flat grey | Move the background to somewhere with vertical edges: door frames, shelving, railings, racks |
| Smeared subject | The subject smears along with the background and never comes back sharp | State that the blur is on the background (`smearing the background`) and that the subject resolves once the frame settles |

## Examples

*The Letter Back*, R33 and R34, are one unit and both cuts have to be written:

- **R33 (the whip out)** — inside the room, the son stands up from the table and walks out of frame to the left; at the **end** of the shot the camera whips right and the wainscot, the tabletop and the bare bulb smear into horizontal streaks. 2 seconds, medium, `Pan Right`. The last sharp thing before the blur is the letter, still lying on the table — not incidental, it is where the whole film lands.
- **R34 (the whip in)** — the corridor, the frame arriving from the **same side**, streaks dragging across the opening moment before it steadies, the son sharp once it settles, walking away toward the stairwell. 2 seconds, medium, `Pan Right`.

The one non-negotiable rule holds across the pair: **both cuts carry `motion blur streaks`**. Write it into cut 1 only and what you get is a smear followed by a hard cut, with the bridge broken in the middle. `direction of travel preserved` is likewise the same word in both — whipped out to the right, so it has to arrive from the right. Reverse it and the audience reads two separate whips, which is worse than not whipping at all.

Where the blur sits is pinned separately in each: R33 is `at the end of the shot`, R34 is `across the opening moment`. Leave that out and the model blurs the entire cut. Last thing: the background needs something to smear. R33 has the wainscot line, the table edge and the hanging bulb to drag into streaks; a flat painted wall whipped past is a field of grey, and nobody reads it as a whip.

Example frame not generated.
