---
id: drone-shot
---

## What it is

**None of H3's twenty official camera words is a drone**, because those words describe what the camera *did* while a drone shot describes where the camera *is*. In generative terms this is not a move at all — it is **four things assembled**:

**an extreme wide size ＋ a high downward angle ＋ one slow horizontal flight ＋ the words `aerial view` in the prompt.** Drop any one of them and it degrades into something else.

That makes the lines against its two neighbours hard:

- **`overhead-angle` is an angle**: lens straight down at 90°, the frame collapsed to the ground plane, no horizon at all. A drone shot usually is **not** that — it sits at 40 to 70 degrees, and a strip of horizon and sky normally survives at the top of frame.
- **`extreme-wide-size` is a size**: the person is reduced to a mark. You can get that from a hillside or a rooftop, and that is not a drone shot.
- **A drone shot is both of those plus a flight**, plus one crucial implication: **there is nothing under the camera to stand on.**

The one-line test: **could a person physically stand where this camera is?** If yes — hillside, rooftop, balcony, bridge — you have a high-angle wide. If no, if it is hanging in mid-air, it is aerial.

How it lands in practice: **write `extreme wide shot` for size, give the downward angle in degrees, and give one slow camera word — `Truck Left` / `Truck Right` for lateral flight, `Tracking Shot` for following a vehicle or a boat, `Static Shot` for a hover. Altitude itself rides entirely on `aerial view from high above`.** To climb away, give `Pull Out` — still one camera word per cut.

## When to use it

- **The opening cut that says where we are.** What terrain, what scale, how many households — said once, and the rest of the episode never has to explain it. This is the drone shot's most honest job and its only guaranteed win in short drama.
- **A bridge between two locations.** Last scene in the village, next scene in town; one cut skimming over fields and a road in between and the audience does the travelling for you, no caption required.
- **Following a car, a boat, a column of people.** Track it slowly from above: the road is a line and the vehicle is a dot, and "this journey is long" gets said cleanly in a way nothing at ground level manages.
- **Climbing away at the end of a scene.** They stay where they are, the camera lifts and retreats, and the village, the jetty, the whole field come in layer by layer. Harsher than a ground-level pull out, because the audience knows they could never get to this viewpoint.
- **The first look at a new place in a vlog.** Land, open on the aerial, place is big and person is small, and the pace is set.

**When not to use it**:

- **Not when you need to see a person.** This is the card's hardest rule: **from altitude a human being is a clump of pixels** — no face, no expression, no action, with arms and legs fused. A drone shot photographs a place, never a person.
- **Not on a cut with dialogue.** The speaker is a few dozen pixels across and nobody can attach the voice to a body.
- **Not when your reference images only cover ground level.** What this place looks like from above is then wholly invented, and the invented roof layout and road geometry will not match any of your ground cuts — the audience reads two different villages.
- **Not indoors, not in small or low spaces.** Aerials need terrain to be about. A courtyard from altitude is three grey rectangles.
- **Never more than once in a scene.** Two aerials back to back and the short drama turns into a tourism reel; the audience starts waiting for it to be over.

## How to prompt it

One cut is the norm. **The whole craft of this card is how finely you describe the ground**: too fine and it smears, too coarse and it invents. The answer is to **name it in large blocks and pin every count**.

```
extreme wide shot, aerial view from high above（hanging in mid-air, about fifty
degrees down, nothing under the camera to stand on）, what this place is（pin it in
one clause: a fishing village at the river mouth / a factory yard after shift）,
ground detail reads as texture（read the ground as texture: roofs are a field of
dark grey slopes, trees are a rolling dark green mass, no chasing individual
houses or individual trees）,
buildings and trees named with counts pinned（one main road, seven houses along its
east side, three trees at the village entrance）,
the water's edge pinned（hard stone embankment or soft mudflat edge）,
a slow lateral flight（which way and how far）, weather and light, cinematic film still
```

- **`aerial view from high above` is the only line that actually gets the camera airborne.** Write `bird's eye`, `drone shot` or `from the sky` and a solid share of generations hand back a photograph taken from a rooftop or a hillside — its training data holds far more of those than of true altitude. Follow it with `nothing beneath the camera to stand on` and the hit rate climbs noticeably.
- **`ground detail reads as texture` is the card's least obvious line.** The model's instinct is to resolve the ground, so it grows unreadable clutter on roofs and a smear of branches in tree canopies, getting faker the harder it tries. Tell it the ground is texture and it will paint fields of colour and relief instead — which is what real aerials actually look like.
- **Pin counts on repeating units, and give two or three of them a distinguishing feature**: "seven houses along the east side, the one at the entrance has red tiles, the third has a walled yard." Without that the model copy-pastes one house down the whole row.
- **Give the water's edge its own clause.** It is the line most likely to fall apart in an aerial and it earns a row of its own — see the pitfalls table.
- **The `[Shot k]` passage says only that the camera is flying slowly.** One camera word: `Truck Left` / `Truck Right` to fly across, `Tracking Shot` to follow something, `Static Shot` to hover, `Pull Out` to climb away. **Never two.**

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Downward angle | 50° | 30–75° | Under 30° there is too much sky and it reads as a rooftop shot with no aerial flavour; over 75° the horizon leaves frame and it has become a top-down view — switch to `overhead-angle` |
| Altitude | two or three storeys above the roofs | treetop height – below cloud | Higher looks like satellite imagery with all detail dissolved; lower and every error in an individual building is on show. Two or three storeys is the sweet spot: legible as a place, illegible as a mistake |
| Seconds per cut | 4s | 3–6s | Under 3s nothing reads as flight and you own a still aerial photo; over 6s the repeating units start visibly looping and the roofs turn into wallpaper |
| Flight speed | slow | slow – moderate | Aerials must be slow. Nudge the speed and the ground texture churns into noise with roofs flickering frame to frame. The least negotiable knob on the card |
| Ground items named | 5–8 | 3–10 | Below 3 the model invents the lot; above 10 it starts dropping items, and the dropped ones are exactly where the looping begins. Name in blocks — a road, a field, seven houses — never doors and windows |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Smeared ground | Ground detail dissolves into unreadable speckle and the roofs look painted over | `ground detail reads as texture` is mandatory, and name the ground in blocks (roofs a field of dark grey, fields a yellow-green mass) rather than naming small objects |
| Looped units | Every house in the row is identical, one tree is copy-pasted ten times, field boundaries form a tidy grid | Pin the counts and give two or three units a distinguishing feature: red tiles at the entrance, a walled yard on the third, one tree at the far end taller than the rest |
| Broken shoreline | Water and land smear together at the join, water climbs onto the bank, or an unexplained white fringe appears along the edge | Give the water's edge its own clause and state hard or soft (`hard stone embankment` / `soft mudflat edge`), and write water and land as clearly contrasting colours |
| People as pixels | The figures are writhing clumps of pixels with arms and legs fused and an impossible gait | Do not put people at altitude. If you must, write them as colour: `a single figure in a red coat, read as a dot of colour`, and give them no body action at all |
| Back on the roof | You asked for aerial and got a high-angle photograph with half a parapet in frame | `aerial view from high above` is mandatory; add `nothing beneath the camera to stand on` and give it a slow lateral flight — a static high angle is the easiest thing to mistake for a rooftop |

## Examples

*The Letter Back*, R01: dusk, the camera hanging above a block of 1990s northern Chinese walk-up flats and trucking slowly to the right, the ground read as texture — grey tiled roofs a field of dark slopes, the bare courtyard trees and the drying lines flattened into pattern; four identical blocks pass through frame, and one fourth-floor window in the near block is warm while every other window stays cold blue. Extreme wide, 5s, `Truck Right`.

Both required phrases are present, and the instructive part is **how the cut disposes of the looping-units pitfall**: four blocks, all identical, with the count pinned first and then one of them given a feature of its own — that lit fourth-floor window. The move does two jobs at once. It stops the model copy-pasting one building down the row, and it tells the audience in the opening frame which window this story is heading for. **A technical guard against a known failure that also happens to be the film's first piece of information.**

One more thing: **not a single person is written into this frame.** The son does not appear until R02, and even there he is a speck against six storeys of balconies; faces wait until the shot-reverse in R11 and R12. The aerial establishes the place and leaves recognising people to later cuts — which is exactly the order the sample puts them in.

The example frame is exactly this cut (R01).
