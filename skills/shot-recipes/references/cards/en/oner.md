---
id: oner
---

## What it is

**This card is not about live-action long-take blocking.** A oner in generative video is a different animal: a single generation can already run uncut — in H3, a segment has as many cut points as it has `[Shot k]` passages, so **writing only `[Shot 1]` makes the whole segment one continuous take.** The difficulty is therefore not "how do I stop it cutting", it is **how do I fill ten seconds**.

The one-line test: **what you are staging is the order in which things happen inside this one frame, not how the camera travels.**

It is not the same as `two-shot-hold`, and the dividing line is the number of events: a two-shot hold allows **exactly one change of posture** in the cut and builds tension out of stillness; a oner wants **three things to happen in sequence** — enter, set something down, turn and sit. Two people locked in a stand-off is the former. One person walking in and completing a chain of actions is this card.

**Its economics are among the best in the library, for the same reason as `two-shot-hold`**: the face is generated once, and the relative positions, lighting ratio and set dressing across those three events never have to be matched across a cut. The cost is that drift risk climbs linearly with the second count.

## When to use it

- **A whole entrance in one piece.** Push the door open, cross to the table, set the case down, sit. Cut into four and that is four fresh chances to regenerate a face; keep it in one and there is only one.
- **Establishing how big a space is.** Follow someone from the deck into the cabin and the audience has walked it themselves — far more effective than cutting to a wide.
- **A character alone with an emotional beat.** No one to cut to means no shot-reverse-shot is needed, and staying in one take reads more like finished film.
- **A short chain of product handling.** Pick it up, turn it over, set it back. Three actions in one cut and the product silhouette only has to match once.
- **The vlog cold open.** Door, bag, sit, speak — the oner is that format's native grammar.

**When not to use it**:

- **Not for two or more lines of back-and-forth dialogue.** Two people talking inside ten seconds means two lip-sync problems, the most fragile thing in AI video. Shot-reverse-shot is genuinely safer.
- **Not when the three events span two spaces.** The model will not walk someone out and back in; it will teleport them.
- **Not with more than two faces in frame.** Drift compounds: the longer the take, the worse it gets, and two faces drift independently.
- **Not when you need a precise emotional beat.** The two seconds of silence after a hard line have to be delivered by a cut point; buried inside a long take they carry no weight — that is `reaction-hold`'s job.
- **Not past twelve seconds with a face in frame.** The face will change. This is not a probability, it is a schedule.

## How to prompt it

One `[Shot 1]` for the whole generation, three events in the same passage, **each one pinned to a timestamp**.

```
wide shot, the location and lighting state, who the subject is and where they enter from,
no cut inside this shot,
actions follow one another in order,
first event with its timestamp（at 00:00 the door is pushed open）,
second event with its timestamp（at 00:04 he crosses to the table and sets the case down）,
third event with its timestamp（at 00:08 he turns and sits）,
how the camera behaves（locked off / a smooth follow）, environment anchors named item by item
```

- **Timestamps are the load-bearing part.** Without them the model crams all three events into the first three seconds and stands around for the remaining seven. Absolute marks — `at 00:04`, `at 00:08` — are what it responds to.
- **All three events must sit on one line of action**: enter, set down, sit. Slip in something unrelated (a glance out of the window) and the model treats it as a new scene.
- **`no cut inside this shot` belongs in the prompt.** The model has seen far too much edited footage; leave it out and it will insert a size jump of its own accord.
- **The `[Shot 1]` passage describes how the camera behaves.** Locked off is safest; a follow should be one smooth straight line or one smooth arc, never changing direction mid-take.
- **One line of dialogue at most, attached to the last event.** Leave the first two events to action; nobody speaks while walking here.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 10s | 8–15s | Under 8s three events do not fit and you may as well cut; past 12s with a face it starts to drift, and 15s is the physical ceiling of a single generation |
| Number of events | 3 | 2–4 | Two feels thin and the cut feels long; four or more leaves each event barely two seconds and none of them complete |
| Gap between events | 3–4s | 2–5s | Under 2s the audience cannot read them and the actions smear together; over 5s the middle is dead air |
| Faces in frame | 1 | 0–2 | With none (a back, a pair of hands, a product) you can safely run to 15s; with two, pull back to 8–10s |
| Camera motion | locked off | locked to smooth follow | Locked is safest; a follow travels one line and never turns; follow plus turn inside one cut and the space regenerates itself |
| Takes per attempt | 2 | 1–3 | Far cheaper than a dolly zoom, but long takes still fail more often than short cuts. Two and pick one |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Front-loading | All three events happen in the first three seconds, then seven seconds of standing about | Give every event an absolute timestamp (`at 00:04`, `at 00:08`). Not one of them is optional |
| Sneaky cut | The model inserts a size jump of its own and the take looks edited | Put `no cut inside this shot` in the prompt and confirm the segment has only one `[Shot 1]` |
| Late-take face swap | The face is right for five seconds and quietly wrong by the ninth | Pull back to ten seconds, always attach the character sheet, push the background one step further away |
| Teleport | The figure is on the left, then suddenly on the right, with the walk in between missing | Keep the three events on one line of action and write the path itself into the prompt (down the aisle to the far end) |
| Loop | The last two seconds replay an earlier action | End on an explicit terminal pose (seated, still, hands on knees) so the model has somewhere to stop |

## Examples

No cut in *The Letter Back* carries this card. The nearest is R10 — **and the line between the two cards falls precisely across it.**

R10 runs six seconds without a cut: the son pulls out the chair at the left end of the round table and sits, the father stays where he is at the right end, and there is no cut and no reframe anywhere in it. But it stages **one** change of posture and builds its tension out of two men not moving. That is `two-shot-hold`, not a oner. This card wants three things happening in sequence inside one frame.

To attach it here, the place is the end of the arrival sequence: fold R07 (through the door), R08 (his own eyes finding the letter), and R09 plus R10 (crossing to the table, sitting at the left end) into one ten-second take — `at 00:00` the door is pushed open, `at 00:04` he stops at the round table with his eyes landing on the letter, `at 00:08` he sits. All three events on one line of action, the dressing and the lighting ratio matched once, the face generated once. **The cost is R08:** the point-of-view cut shows the letter through his own eyes, and folded into a long take it is gone. The sample cuts them apart because *what he saw* matters more here than *how he walked in*.

Example frame not generated.
