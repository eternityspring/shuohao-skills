---
id: tracking-move
---

## What it is

The camera goes where the subject goes, taking both its speed and its direction from them, so the subject's size and position in frame never change. The audience is strapped to this person: **as long as they keep going, the cut keeps going.**

**The line between tracking and trucking is the subject.** Tracking follows the subject — they turn, the camera turns. Trucking follows a straight line — the camera goes straight whether the subject does or not. So a truck changes *the place* and a track changes *where this person goes next*. Either is defensible for the same walk; the choice is whether you want the audience watching the person or the place.

The one-line test: **did the subject move inside the frame?** If they did, it is not tracking — it is a truck or a pan.

## When to use it

- **A whole walk to somewhere.** They go from one end to the other and you never cut. Tracking is the cheapest "this isn't over yet" in the library, precisely because it gives the audience nowhere to breathe.
- **Someone chasing, someone hiding.** Track the back of the one in front and the audience is as blind behind them as they are; track the face of the one behind and the audience knows who they are after before they catch them. Same chase, two entirely different scenes.
- **Entering a new space.** They walk in, the camera goes with them, and door frames, corridors and corners feed into shot along the way — one cut delivers both "who came in" and "what this place is." The full recipe for that beat is `handheld-follow-in`, which adds handheld texture on top of the tracking.
- **Cutting through a crowd.** The subject pushes through, everyone else sweeps past the edges of frame, and the subject never moves. "He has somewhere to be and they don't" without a line of dialogue.
- **The walk-and-talk in a vlog.** They talk to camera while walking and the camera retreats ahead of them. Here the value is not the movement — it is that tracking stops a piece to camera from feeling like a piece to camera.

**When not to use it**:

- **Not when the subject is standing still.** With no subject motion, tracking degrades into a slightly unsteady locked-off shot, and the model will invent a wobble just to have something to "follow".
- **Not on the line of dialogue.** A talking cut wants stillness so attention sits on the mouth and eyes; drifting along with the speaker lets the movement eat the weight of the line.
- **Not for complicated routes.** More than two turns and the model repaints the corridor into a different corridor at the second one. Complicated routes get split into cuts, one turn each.
- **Never mix tracking and trucking in one prompt.** Ask for both "follow him" and "run straight" and the model does neither — the subject just slides diagonally across frame.

## How to prompt it

One cut is the norm; take a second only to land. Pin the travel distance — never "follow him across the building".

```
medium shot, the camera follows the subject (name the route: into the corridor
/ through the crowd / along the jetty), camera keeps pace with the subject
(neither gaining nor falling behind), subject holds the same spot in frame
(same size and position throughout — say whether they sit left or right of
centre), travel distance pinned (three or four paces / through one doorway),
landmarks along the way named item by item, lighting state
```

- **Pin the distance as paces or doorways.** "Follow him down the long corridor" is an invitation to invent a corridor, and the longer it is the more the model invents.
- **`subject holds the same spot in frame` is the load-bearing phrase.** Without it the model lets the subject drift backwards or lunge forwards, and the shot loses them mid-move.
- **Say whether you are on the front, the back or the side**: `following from behind`, `facing the subject and moving backwards`, `keeping pace from the side`. Leave it open and the model picks a different one each time, and two cuts will not join.
- **Name the landmarks along the route.** A tracking camera eats new frame the whole way; without landmarks the model invents the whole way. Landmarks are something for it to align to rather than a blank for it to fill.
- **The `[Shot k]` passage says only that the camera is following.** Subject action gets its own sentence. Give `Tracking Shot`; if you want grit, one `Shake Slightly` on top is the ceiling.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–6s | Under 3s "still going" never registers, and duration is the whole point of tracking; over 6s invented background climbs steeply and it is time to cut |
| Travel distance | three or four paces | two paces to one doorway | This is the master valve on invented scenery — more important than size or speed |
| Following distance | one to two paces | half a pace to three | Close reads as pursuit; far reads as documentary. Inside half a pace the subject butts against the frame edge and their face leaves shot |
| Subject's place in frame | a third of the way to one side | centre to one side | Centre is safest and flattest; offset leaves room ahead and the audience looks forward with them. Once set it must not change inside the cut |
| Landmarks along the way | 2 | 1–4 | One is not enough to align to; past four the model lays them out as a repeating pattern and the corridor becomes an endless copy of itself |
| Speed | matched to the walk | matched | Tracking has no speed knob worth turning: faster leaves the subject behind, slower lets them walk out of frame, and both are losing them |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Lost the subject | They shrink through the move, or get pinned against the frame edge | Both `camera keeps pace with the subject` and `subject holds the same spot in frame` must be present |
| Grown scenery | Two paces in and the corridor sprouts new doors, junctions and picture frames | Cap the travel at three or four paces, name the landmarks, hang the location sheet |
| Floating feet | The figure hovers; the feet do not agree with the floor | Write `walking`, not `moving forward`, and give the floor a material (planks, concrete, mud) to land on |
| Changed person | Halfway along, the coat colour or the hair changes | Hang the character sheet and put coat colour and hairstyle directly in the prompt |
| Diagonal slide | The subject slides across frame at an angle, like something pushed along glass | A straight-line phrase leaked into the prompt. A tracking cut carries no "travels in a straight line" wording at all |

## Examples

*The Letter Back* tracks three times, all inside the arrival passage, and the three cuts come out with three different textures.

R03: behind the son as he climbs the stairwell, the camera a step and a half back for four steps up to the half-landing, with a small irregular sway timed to his footfalls. R04: the same corridor, one continuous stabilised glide, no jitter and no bounce, horizon level throughout, the sound-operated bulbs lighting one at a time ahead of him and dying out behind. R07: following him through the dark red door, warm bulb inside, cold corridor outside. **Same camera word all three times; the difference is not the following, it is the stabilisation** — R03 is filed under `handheld-follow-in`, R04 under `steadicam-move`, R07 under `door-threshold`.

The test for tracking holds in all three: **the subject's position and size in frame never change.** R03 keeps the son centred and medium the whole way, and when he turns on the stairs the camera turns with him. R01's `Truck Right` is the exact opposite — a straight line, with no one in the frame at all.

R04 also shows what tracking buys you: five seconds, one bulb on and one bulb out at a time, and the audience reads how long that corridor is and how long he was in it. A locked-off version of the same beat can only say "he came in".

Example frame not generated.
