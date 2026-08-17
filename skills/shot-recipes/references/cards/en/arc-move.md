---
id: arc-move
---

## What it is

The camera walks a curve centred on the subject, holding one distance the whole way with the lens always aimed inward. The subject barely moves in frame; **what moves is the entire world behind them**.

**The line between an arc and a truck is the path.** A truck runs straight, so the subject slides from one side of frame to the other. An arc runs curved, so the subject stays pinned and the background swings past. A truck says "look how big this place is"; an arc says "right now this person is the centre of everything."

**It is also not the same thing as the recipe card `product-orbit`**, and the relationship is worth getting straight: this card is a **technique** — anything can be arced around: a person, a car, a table, a pile of rubble. `product-orbit` is a **recipe** answering "how do I cut this e-commerce hero shot", and it carries product-specific must-phrases, a multi-angle reference-sheet discipline and the whole family of garbled-logo pitfalls. Orbiting a product, read `product-orbit`; orbiting anything else, use this card.

## When to use it

- **The moment somebody makes up their mind.** They stand perfectly still, the camera arcs, and the background is replaced wholesale — the audience reads "everything around him is moving and he is not." This is the most expensive thing an arc can do; once an episode is plenty.
- **Crossing sides in a stand-off.** Travel from behind one figure's shoulder around to in front of the other's, and the question of who has the upper hand flips during the move. Slower than cutting shot-reverse, but the breath never breaks.
- **Showing what somebody is surrounded by.** A ring of onlookers, broken glass across the floor, photographs papering a wall. Arc around and the audience counts what is closing in on them; a wide shot cannot make that point.
- **Corners and thickness on a real object.** A watch, a shoe, a model kit — one corner is enough to read thickness and the side profile. **Note this means objects that happen to appear in a drama or a vlog**; a real product presentation goes to `product-orbit`.
- **Opening a space in a vlog.** Someone stands in a place they just arrived at, the camera arcs a quarter turn, and one cut delivers both the person and the place.

**When not to use it**:

- **Not against a flat backdrop or a wall of fog.** The whole effect lives in the background rotating past; with nothing recognisable back there, an arc looks like nothing more than a slight wobble.
- **Not while the subject is walking.** Subject motion plus camera motion means the model is solving two problems at once and gets both wrong — the person slides across frame with their feet off the ground. To stay with someone who is walking, follow them instead.
- **Never more than 180° in a single cut.** Passing the back means you need a reference image of the back; without that material, do not go round there — the model invents that half.
- **Never arc and push in inside one cut.** The perspective change is too large; the model re-imagines the whole space and swaps the subject's face somewhere in the middle.

## How to prompt it

One cut if one cut can finish it; past 180° take a second cut and hang the first as its reference. Pin the degrees.

```
medium shot, the camera travels a horizontal arc around the subject (pin the
degrees and the direction, e.g. orbiting 90 degrees to the left),
constant distance to the subject (never closes in while it arcs),
background sweeps behind the subject (name the things that will pass through
the background, item by item), what the subject is doing (standing still /
one small gesture), lighting state
```

- **Pin the degrees**: write `orbiting 90 degrees to the left`, never `orbiting around`. Without a number the model decides for itself how far to go, and two generations go different distances.
- **`constant distance to the subject` is not optional.** Leave it out and the model creeps inward while it arcs, so the cut lands on a close-up — that is not an arc any more, it is an arc plus a dolly.
- **Name what the background will sweep past**: a window, a doorway, the onlookers, a shelf. It is the audience's only evidence that the camera is arcing, and the model's only anchor against inventing new background.
- **Let the subject do one small thing, or nothing.** Turn their head, lift their eyes, close a fist. One action for the whole travel; give them two and the model botches both.
- **The `[Shot k]` passage says only that the camera is arcing.** Give `Arc Shot` and nothing else — never stack `Push In` on it.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 4s | 3–6s | Seconds and degrees move together: at 90°, 3s is brisk and 6s is unhurried. Widen the angle without adding time and you get a whip past with the background smeared into a stripe |
| Arc angle | 90° | 45°–180° | 45° is "let me see the other side"; 90° is one full corner; past 120° the failure rate climbs steeply and you need a reference image at that angle |
| Cuts | 1 | 1–2 | For a full lap take two cuts of 180° or less and hang the first as the second's reference |
| Arc radius | medium-shot distance | medium to wide | Smaller radius, faster background rotation, more nausea; at close-up distance it fails almost every time and the face changes halfway |
| Background legibility | medium | low to high | The more readable the background, the stronger the move — and the more the model has to maintain. Crowds are the most expensive of all; onlookers swap faces mid-arc |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Turns into a truck | You asked for an arc and the subject slides from one side of frame to the other | `constant distance to the subject` must be present; add `the camera stays aimed at the subject` |
| Sneaky closing in | The framing has changed by the end — you went in at medium and came out at close | The distance was never pinned. Write `constant distance to the subject` and state the shot size twice in the prompt, once at the start and once at the end |
| Face swap | Past the profile the subject's features, hair and collar come back as somebody else's | Hang the character sheet, cap the angle at 90°, and add a profile reference before you go beyond it |
| Grown background | The half you arc into has doors, windows and passers-by that are in no design sheet | Name the background items one by one, pin the degrees, and hang the location sheet |
| Sliding feet | The subject shuffles in frame while being arced, as though standing on a turntable | No walking in this cut. State `standing still, feet planted` |

## Examples

*The Letter Back* arcs exactly once, at R25: half a lap around the red enamel flask on the round table, six seconds. The flask is pinned dead centre and never budges — brushed metal cap fixed on top, the side handle swinging round the body — while everything behind it travels: the wainscot, the blue glass window, the darkened room sliding past. The camera holds a constant distance the whole way.

**Whether an arc worked is judged on one thing: did the subject move?** If it slides to one side of the frame you shot a truck. Subject pinned, background rotating — that is an arc. R25 writes the rule into the prompt (the subject never leaves the middle of the picture) and pins the silhouette alongside it: after half a lap the handle sits somewhere new, but the shape of the body must not have changed with it.

The old debt on angles applies to any subject: **pinning the degrees reduces the error, it does not remove it.** Ask for 90° and the render often travels forty-five. If you truly need a specific angle, split the lap into more cuts, travel a little in each, and hang the previous cut as the next one's reference.

R25 is filed under the recipe card `product-orbit` — go there for products, which brings its own must-phrases and the whole logo-garbling minefield. Orbiting a person, a car or a pile of rubble is this card.

Example frame not generated.
