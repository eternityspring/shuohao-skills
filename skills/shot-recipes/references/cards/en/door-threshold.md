---
id: door-threshold
---

## Intent

One person steps out of one space and into another. The whole drama of the shot lives in **the difference in light across the threshold**: dark into bright is walking toward an answer, bright into dark is walking into danger. Flatten that difference and the cut is just someone walking.

It doubles as a transition — the space changes inside a single cut, so nothing after it needs an establishing shot. The cost is that one cut now has to describe two spaces, and **the relationship between inside and outside is exactly where the model breaks**.

## Prompt skeleton

One or two cuts. The one-cut version follows the subject through; the two-cut version is outside (`Static Shot`) plus inside (`Tracking Shot`), cutting on the step over the threshold.

```
medium shot, the subject walking toward and through the door,
doorway in frame (which side the frame sits on, how much width it takes,
half open or wide open),
light differs across the threshold (inside — what source, warm or cold,
how bright; outside — the same, named),
camera follows the subject through the doorway,
contents of the inside space named item by item,
contents of the outside space named item by item
```

- **The door frame has to physically be in shot.** `doorway in frame` is a composition gate; without the frame there is no crossing to see, only a person walking
- **Name the light on both sides.** Write "dark inside" alone and the model tends to darken the outside as well, which erases the very difference the shot is built on
- **Name the contents of both spaces.** This is where the card breaks hardest; whichever side you leave unnamed is the side the model improvises
- The **`[Shot k]` passage carries the feet and the body**: the step over the threshold is the beat of this card — say whether it is a stride, a shove from behind, or a pause first
- Put the door's material, colour and swing direction in the prompt too. Two scene sheets will not agree on one door; only words can pin it

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–5s | Walking straight through takes 2s; a beat of hesitation in the doorway wants 4–5s, and that beat is the performance |
| Number of cuts | 1 | 1–2 | Following through in one cut is cheapest; two cuts feel more ceremonial but neither scene sheet can be skipped |
| Light difference | two stops | one–three stops | One stop is too flat to read as a crossing; past three the dark side is pure silhouette and the face is gone |
| Direction | dark → bright | dark→bright / bright→dark | Dark into bright walks toward an answer, bright into dark walks into danger; pick the wrong one and the scene means the opposite |
| Door frame share | a third of the width | a quarter–a half | More frame reads as pressure and ceremony; too much and the door hides the subject |
| Camera | Tracking Shot | Tracking Shot / Static Shot | Following through wants tracking; standing outside and watching someone go in wants static, and plays far colder |
| Door position | half open | half open–wide open | Half open holds the mystery behind a gap; wide open shows everything, and then this card is not needed |

## Reference-image constraints

- **Two scene sheets are mandatory: one inside, one outside.** This is the most unusual reference requirement in the library — one cut describes two spaces, and whichever sheet is missing is the side that grows the wrong room
- **Describe the door itself in the prompt** (material, colour, handle, which way it swings). The two sheets each draw their own space; only text keeps it the same door
- Hang the character sheet as usual. Exposure swings hard at the moment of crossing, and that is when faces change
- In the two-cut version, **hang cut 1 as the reference for cut 2** so the door and the light ratio do not change identity at the cut point

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Wrong room behind the door | Beyond the threshold is a room that appeared in no prompt | Hang a scene sheet for each side, and write the contents of both sides item by item |
| Flat light | Inside and outside are the same brightness and the crossing carries no drama | `light differs across the threshold` is mandatory (the gate checks it), and each side's source must be named |
| No door in shot | Just a person walking; the doorway is nowhere to be seen | `doorway in frame` is mandatory, plus which side the frame sits on and how much width it takes |
| Identity change | The subject comes out of the doorway with a different face or different clothes | Hang the character sheet, keep the light difference within two stops, shorten the cut |
| The door acts alone | Nobody opened it, yet it swings — or it swings inconsistently | State the door's position once (half open / pushed open / opening inward) and never restate it differently |
| Silhouette face | Walking from bright into dark leaves the subject as a black shape | Bring the difference down to two stops and add a visible practical source on the dark side (lamp, window, fire) |

## Examples

*The Letter Back*, R07: the son pushes the dark red door of the flat open and walks through — 4 seconds, medium, `Tracking Shot`. The doorway sits on the right and takes a third of the width, half open, swinging inward. Inside, the single bare bulb over the round table pools warm on the terrazzo; outside, the corridor has nothing but one cold white sound-operated bulb.

Both gates are visible in the still. `doorway in frame` is that dark red jamb on the right; `light differs across the threshold` is the pair of sources named separately on each side. The difference here is colour temperature more than brightness — cold white outside, warm yellow inside. The card's dark→bright / bright→dark knob is effectively replaced by cold→warm, so the crossing reads as coming home rather than walking toward an answer; what is actually waiting inside does not land until R08, when the door opens on the letter.

Worth noting: the two spaces this one cut has to describe — the stairwell and the room — are two of the reel's only three locations, so both scene sheets already existed. The door itself (material, colour, which way it swings) is still pinned in words, because two sheets drawn separately will never agree on one door.

Example frame not generated.
