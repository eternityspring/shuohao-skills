---
id: shallow-focus
---

## What it is

The plane of focus is thin: the subject is sharp and everything in front of and behind them dissolves. **The line against `rack-focus-reveal` is time** — shallow focus is a state that holds for the whole cut; a rack focus is a process, handing focus from one layer to another inside the cut. To decide which card you are on, ask one question: **does focus move in this cut? Still is shallow focus, moving is a rack focus.**

It also gets confused with telephoto compression. **Compression is about the distance between near and far; shallow focus is about their sharpness.** Both can happen at once, but they are two separate knobs and the prompt should treat them separately.

## When to use it

- **Lifting a face out of a busy environment.** The messier the background, the more this is worth.
- **Hands and props.** The object stays sharp, the person and the room dissolve, and the eye has nowhere else to go.
- **The rescue move in vertical.** The sides of a vertical frame are full of useless information; blurring it is a crop, and a more natural-looking one than an actual crop.
- **Isolating a product.** Product sharp, tabletop and background soft, silhouette instantly clean.
- **Talking head in a cluttered room** — blur the room away and keep the speaker.
- **Night scenes and practical lights.** Point sources in the background render as bokeh, the cheapest texture there is.

**When not to use it**:

- **Not on cuts that establish who is where.** Position and distance both vanish into the blur.
- **Not on group scenes.** Three people cannot share one focus plane, so someone will be soft — and the audience will read that person as unimportant.
- **Not on a moving subject.** The moment they move they leave the focus plane, and the model's usual response is to render everything sharp instead, which wastes the cut.
- **Not when the background is already clean.** Shallow focus in front of a blank wall is invisible.
- **Never shallow focus and deep-focus layering in one cut** — the request contradicts itself.

## How to prompt it

One cut is the norm. Pin what the focus plane sits on: on the eyes and on a clasp are two completely different images.

```
close-up, focus plane on the subject（pin what it sits on: the eyes / the brass
clasp / the fingertips）, background melts into soft blur, what the subject is doing,
what the background is made of（describe it even though it dissolves: lanterns /
cabin wall / a crowd）, the shape the point lights render as,
how far the background sits behind, lighting state, cinematic film still
```

- **Always follow `focus plane on the subject` with what it lands on.** Without that the model picks a plane itself, and on a two-person cut it picks wrong about half the time.
- **`background melts into soft blur` governs the quality of the blur.** Leave it out and you get "slightly soft", which is not shallow focus.
- **Describe the background even though it dissolves.** Blur is not permission to write nothing — the model needs to know what is dissolving to get the colour and shape right.
- **Name the bokeh shape** (round, oval-stretched). It is the cheapest and most effective single stroke in the whole card.
- Keep the subject still. Give `Static Shot`, or a very slow `Push In` of no more than 10%.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Blur strength | medium | light – strong | Stronger isolates the subject and costs less to keep consistent; at full strength the background becomes a flat colour and the audience loses their bearings |
| Focus plane thickness | thin (the subject's layer only) | thin – medium | Thinner is prettier and riskier: thin enough that only the eyes are sharp while nose and ears go soft, and the model often changes its mind mid-cut and sharpens the whole face |
| Subject-to-background distance | two metres | half a metre – ten metres | Distance is the precondition. Inside half a metre no prompt wording will get the background to fall away |
| Point lights in background | 2–3 | 0 – 5 | Point sources are what produce bokeh, the signature of the look; past five it turns into a Christmas tree |
| Seconds per cut | 3s | 2–5s | Past 5s there is a good chance the model quietly re-sharpens a layer of the background halfway through |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| All sharp | You asked for shallow focus and everything front to back is crisp | Both phrases are mandatory, and pin the subject-to-background distance at two metres or more |
| Half-soft | The background is a bit soft but nowhere near blurred | Pin `background melts into soft blur`, raise blur one notch, push the background further back |
| Re-sharpening | The first two seconds are blurred and then the background resolves itself | Hold under 4s, and restate in the `[Shot k]` passage that focus never changes |
| Wrong person soft | On a two-person cut the one who should be sharp is the blurred one | Pin whose plane it is (`focus plane on the woman in the corner`) and keep the two of them off the same depth |
| Blobbed bokeh | Background lights fuse into one shapeless bright mass | Cut to three point sources or fewer, name the bokeh shape (round / hexagonal) and which side of frame they fall on |

## Examples

*The Letter Back* R22: a close-up with the focus plane on the folded brown paper letter on the table, and only its near half holding sharp. The father behind it dissolves into a dark grey shape, the bare bulb overhead becomes a round warm bloom, the white mug at the edge becomes a soft white smear, and the blue window becomes a cold wash behind everything. Three seconds, locked off.

Both required phrases are written down to a quantity here. **The focus plane is pinned to "the near half of the letter"**, not vaguely "focus on the letter" — a model left to choose its own plane is where this card usually fails. **And the blurred background is itemised**: the father as a grey mass, the bulb as a round bloom, the mug as a white smear. Blur does not excuse you from describing what is blurred; the model needs to know what it is before it can get the colour and the shape right.

One comparison is worth making. R23 is the same table and the same letter, but the focus travels from the letter to the father's face. **Whether the focus moves is the entire boundary between the two cards** — R22 holds for the whole cut and is shallow focus; R23 moves, and that belongs to the rack-focus card.

Example frame not generated.
