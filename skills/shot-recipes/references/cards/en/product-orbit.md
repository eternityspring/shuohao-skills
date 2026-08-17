---
id: product-orbit
---

## Intent

The highest-frequency shot in e-commerce hero videos and launch keynotes: the camera walks a lap around the product and the audience sees front, side and corner inside a single cut. What it sells is not information, it is **material** — brushed metal catching a travelling highlight, matte plastic going dull at the corner, leather grain deepening with the angle. A still image cannot argue that; one lap can.

Which means this card is not won on framing. It is won on whether the product is still the same product by the end of the lap.

## Prompt skeleton

One cut if the lap fits in one; split into two beyond 180 degrees.

```
medium shot, the product centered in frame throughout, the camera arcing 90 degrees along
a horizontal path, a consistent product silhouette with proportions and port positions
unchanged for the whole move, seamless solid backdrop, broad soft key plus one rim light,
the front logo kept out of frame
```

- **Write the angle as a number**: `orbiting 90 degrees`, not `orbiting around`. Without a number the model decides how far to travel and two generations travel different distances
- **Keep logos and packaging text out of frame** — the most expensive rule on this card; see the pitfalls for why. If a logo must appear, orbit on the side where it is not visible and composite it back in post
- **The `[Shot k]` passage says the camera is orbiting** — the product itself must not also rotate. Product spin plus camera arc is two motions stacked, and the silhouette will break
- `Arc Shot` alone; never stack `Push In` on top. Arcing while pushing changes perspective so fast that the model re-imagines the whole object

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 6s | 4–8s | Seconds and orbit angle move together: at 90 degrees, 4s is brisk and 8s is unhurried. Widen the angle without adding seconds and you whip past the material nobody got to see |
| Orbit angle | 90° | 45°–180° | 45° is a glance at the side; 90° is one clean corner; past 120° the breakage rate climbs steeply and reference images for those angles become mandatory |
| Cuts | 1 | 1–2 | A full lap means two cuts, each under 180°, with cut 1 hung as the reference for cut 2 |
| Size | medium | medium–close | Medium states the overall form; close is the material-detail lap — one corner only, never the whole body |
| Background simplicity | seamless solid | solid–shallow-focus real set | The simpler the background, the more of the model's attention lands on the product. A real set repaints itself mid-orbit; if you must have one, throw it out of focus |
| Light ratio | soft | soft–medium | Broad soft key plus one rim is the default product setup; hard light makes highlights jump during the orbit, and matte surfaces show it worst |

## Reference-image constraints

- **Multi-angle product images are mandatory**: front, three-quarter and side, plus the back once you pass 90 degrees. **The wider the orbit, the more angles you need** — if you have no reference for an angle, do not orbit into it
- **Hang one material close-up of its own** (brush lines, matte grain, leather texture). This card sells material; with only whole-body references the surface flattens into generic plastic
- The prompt carries **how the camera moves and how far**; what the product looks like belongs to the reference images
- In the two-cut version, **cut 1 must be the reference for cut 2**, or the product swaps for a different unit at the seam

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Silhouette drift | By the side view the proportions, thickness and port positions have all moved | `consistent product silhouette` is mandatory, hang multi-angle references, and pull the orbit back under 90° |
| Garbled type | Logos and packaging text turn into characters that do not exist — the single most common failure on this card | Orbit away from the front logo, or keep the logo out of frame entirely and composite it in post |
| Off-centre creep | The product slides out of the middle and drifts toward the edge as the lap progresses | `product centered` is mandatory; the camera orbits, the product does not — pin the centre |
| Invented hardware | Rounding to the back grows ports, buttons and vents that were never there | Hang a rear reference; with no rear asset, do not orbit past 90° |
| Floating | The product separates from the table and its shadow refuses to follow, so it reads as pasted on | State the resting surface and the contact shadow, and keep that surface in the lower edge of the frame |

## Examples

*The Letter Back*, R25: the camera laps halfway around the red enamel vacuum flask standing on the round table — 6 seconds, medium, `Arc Shot`. The flask never leaves the middle of the picture, the camera holds its distance, and the pale green wainscot and the cold blue window slide past behind it.

What the cut is selling is exactly what this card promises: **material**. The glaze pulls a soft highlight along the body as the angle turns, the chips around the base come into view on the way round, the brushed metal cap and the side handle trade places. No still can say that; half a lap says it. `consistent product silhouette` is the gate holding the body, the cap and the handle at the same proportions for the whole arc.

The travel sits right on this card's split point: half a lap is 180 degrees, and anything past that should become a second cut. This section also skips the seamless white backdrop — sinking the room into darkness is enough to read the outline — and since 1990s enamelware carries no branding, the most expensive rule on this card, keeping logos out of frame, comes free.

The example frames are exactly this cut (R25).
