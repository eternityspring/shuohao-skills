---
id: backlit-silhouette
---

## What it is

The light sits behind the subject, nothing lands on the front of them, and all that survives in frame is a dark human shape. **The line between this and a rim-lit backlight is whether the face is still there**: put a little fill back on the face and you have rim light, where the audience still recognises who it is. A silhouette refuses the fill and gives the whole face to shadow.

The one-line test: **if the audience has to recognise the face, rim-light it; if they only have to recognise the shape, silhouette it.**

This card gets a bonus in generative video that has no equivalent on a real set: **a silhouette has no face to draw, so it walks straight past the entire face-consistency problem.** Everything the model gets wrong about a person is in the features — they drift at distance, they drift in profile, they drift when three people share the frame, and they drift hardest under a big lighting ratio. In a silhouette the features were never supposed to appear, so the model never gets the chance to break them. That cut's consistency risk drops to zero.

## When to use it

- **A character's first appearance, when you do not want the face read yet.** Give the shape now and the face a scene later; you buy suspense and consistency budget with the same move.
- **The expensive cuts: a wide frame with several people in it.** More faces at more distance means more rolls of the dice. Convert that class of cut wholesale to silhouette and the cost collapses.
- **The end of an emotional beat.** A goodbye, a figure alone in a doorway or at the bow, watching someone walk away — these beats never ran on expression anyway, they run on posture.
- **Translucent product materials.** A perfume bottle, a glass, a pour of spirits backlit reads its outline and its interior clarity at once, which front light cannot do.
- **How to spend the consistency budget.** Design sheets only really hold up on the handful of cuts that show a face straight on. Pick three to five cuts an episode, make them silhouettes, and pour everything you saved into the close-ups that actually need a face. That accounting is the practical reason to reach for this card — bigger than anything aesthetic about it.

**When not to use it**:

- **Not on a cut with dialogue.** The audience reads lips and eyes; a black shape talking pulls sound and picture apart.
- **Not with two similarly built characters in frame.** Both go dark, nobody can tell them apart, and the audience has to scrub back.
- **Not vertical with a dark background.** On a phone a dark subject over a dark ground turns into one flat smear. Everything a silhouette carries is in the outline; lose the outline and you have nothing.
- **Not when the beat needs a reaction on a face.** A reaction cut is entirely facial information, and a silhouette deletes it.

## How to prompt it

One cut is the norm, two at most (one wide, one closer, both silhouetted). Pin the background brightness — a silhouette is cut out by the background, not painted onto the subject.

```
wide shot, light source behind the subject（what the source is and where it sits:
sunrise through morning fog / daylight in a doorway / a lamp on the far wall — name it）,
facial features in shadow（no light on the face; only a dark contour survives）,
the subject's posture and action（posture is the only thing a silhouette can say —
be specific）, how many stops separate the outline from the background,
background brightness, texture and color temperature
```

- **State how many stops brighter the background is.** A silhouette is not the subject painted black; it is a background bright enough to cut the subject out. Ask only for "a silhouette" and you get a flat black cut-out pasted onto the plate.
- **Posture carries everything.** Where the hand is raised, how far the back is bent, which shoulder the load sits on — that is all the audience can read here, so all of it goes in the prompt.
- **Leave a thin rim on the contour.** Hair, shoulder line, the glow through a fabric edge: that thread of light is what lifts the figure off the background, and it is the difference between a silhouette and a paper cut-out.
- **Silhouette cuts can skip the character design sheet**, but pin the costume's outline features (a long gown's hem, the brim of a straw hat, the slit of a qipao) — that is the only handle the audience has for identifying who it is.
- Default to `Static Shot`; use `Pull Out` to hand the figure over to the landscape, `Tracking Shot` if they walk.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Ratio, background to subject | 4 stops | 3–6 | Under three stops the face starts creeping back and you have rim light, not silhouette; over six the background clips and the highlight eats a bite out of the contour |
| Rim on the contour | one thin thread | none – a full bright edge | With no rim the subject is dead black; widen it and the face lights up again and you are back to rim light |
| Subject height in frame | half | one third – four fifths | Small puts the drama in the environment, large puts it in the posture. Below a third the outline detail stops reading and the silhouette is wasted |
| Background texture | fog or cloud | flat – richly layered | A flat backdrop is the cheapest and the fakest, like a bad key. Give the background fog, water or cloud and the silhouette gains space |
| Seconds per cut | 3s | 2–5s | With no features to hold, this survives long cuts better than most; past 5s the audience wants a face and you should have cut |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Paper cut-out | A flat black shape with no thickness, pasted over the background | Add the thin rim, and give the background real layers (fog, cloud, water) rather than a flat field |
| Face leak | The model fills the face in on its own and the features read clearly | `facial features in shadow` has to be there; add that the background is four stops up |
| Merged | Subject dark, background dark, no telling where the figure stands | Lift the background, or reframe so the figure sits against the brightest part of the plate |
| Interchangeable | Three silhouettes look like the same person | Give each figure one outline trait of their own (hat brim, shoulder pole, hem length) and stop relying on faces |
| Keyed edge | A hard black outline traces the subject, like a bad matte | Drop the ratio a stop and state that fog or haze sits between subject and background |

## Examples

*The Letter Back*, R35: the son stopped at the far end of the corridor, the pale daylight of the stairwell window behind him, nothing at all on the face — a dark contour of shoulders and short hair, one hand hanging at his side. Wide, 4s, locked off.

Four stops separate the outline from the window behind it, exactly this card's default, and it is "a silhouette is not the subject painted black, it is a background bright enough to cut them out" done properly: the corridor walls fall away to near black on both sides, the only bright thing in the picture is the light behind him, and he is the shape it leaves.

Two things worth noticing. First, **there is no dialogue in this cut**, or in the two either side of it — the "not on a cut with dialogue" rule cleared the ground for it. Second, **it takes the face back.** The film has been handing over the son's face since the reverse in R12 and the slow push in R14, and the last clear look at him has no features in it at all. Posture carries everything instead: the hand left hanging, the feet stopped. Both read perfectly in outline, and the consistency cost of the cut is zero.

Example frame not generated.
