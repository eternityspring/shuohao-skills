---
id: low-key
---

## What it is

A large area of shadow plus one small pool of light. **The difference from underexposure is that pool**: in low key the dark is dark on purpose, and the lit part has to be solid, clean and full of detail. Underexposure is the whole frame falling short, including the parts that were supposed to be bright.

The one-line test is the other half of the one on `high-key`: **want the audience held tight, go low key.**

**The practical problem with vertical, which matters far more here than any aesthetic point.** Low key is beautiful on a monitor and something else entirely on a phone. Your viewer is outdoors, or in a lit room, with the screen brightness nowhere near maximum — and every bit of gradation you carefully preserved in the shadows is invisible. They see a black smear and swipe away. So **low key for vertical drama has to sit one to two stops above low key for widescreen cinema**, with a larger pool placed closer to the face. That is not a compromise; it is the difference between being seen and not.

**On ratio, to be clear**: the ratio here is stops between light and shadow inside one frame. The library's `door-threshold` owns a phrase about light differing between two spaces; that phrase belongs to that card and this one does not use it.

## When to use it

- **Night scenes, interrogations, whispered deals.** Low key is the grammar of those scenes, not decoration on top of them.
- **The cut where the secret gets said out loud.** Take the whole frame down and leave half the speaker's face lit; the audience holds its own breath.
- **A villain's entrance.** Give one small lit area first — a hand, a jaw, a single eye — and save the face for the next cut.
- **Metal, glass and spirits in product work.** All three speak through the shape of their highlights, and low key is the only light that keeps those shapes clean.
- **Tonal contrast across an episode.** A few low-key cuts set among high-key material carry weight on their own, without any help from music.

**When not to use it**:

- **Not on a dialogue-heavy vertical passage.** The audience cannot read lips or eyes, which deletes half the information the lines were carrying.
- **Not on group scenes.** Three people in shadow are indistinguishable, and making the audience identify them by voice is exhausting.
- **Never on the first cut of the first episode.** Nobody has built any patience yet; open on a black frame and the thumb moves.
- **Not without a practical.** Low key plus sourceless light is a noisy black rectangle. Attach `practical-source` first so the pool has somewhere to come from.
- **Never mixed with `backlit-silhouette`.** One wants the subject entirely dark, the other wants a lit patch on them; the requirements fight and the model lands on neither.

## How to prompt it

One to three cuts. Where the pool falls has to be pinned word for word — never leave that allocation to the model.

```
medium shot, most of the frame in shadow（how much of the frame, and how dark:
contours still legible / close to solid black）,
a small pool of light on the subject（where it lands: half the face / a band across
the eyes / the hands）, where that light comes from（a lantern on the table /
a gap in the door / a streetlight outside — get the source in frame if you can）,
what stays visible inside the shadow（an edge of window frame, a highlight on the
table edge）, color temperature (2700K incandescent / 1800K candle)
```

- **Pin where the pool lands, and land it on the face — especially the eyes.** On a shoulder or a tabletop does not count; low key without readable eyes transmits no feeling.
- **Keep one visible thing inside the shadow**: an edge of window frame, a highlight along the table, a light point in the distance. Solid black shadow is solid black on a phone, and half the frame is simply gone.
- **Get the source in frame where possible** (see `practical-source`). Low key is the most sensitive card to source drift, because the bigger the shadow, the more its shape changes frame to frame.
- **Do not just write dark or dimly lit.** The model takes the whole frame down with it, including the part you wanted lit, which is the "everything down" row of the pitfalls table.
- **Lift a stop for vertical delivery.** It will look slightly bright on your monitor and correct on a phone. Grade for the phone, not the monitor.
- Default `Static Shot`; `Push In` as the temperature rises.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Ratio | 4 stops | 3–6 | Under three it is just an ordinary night scene; past six the shadows go near-black and a phone reads nothing at all |
| Pool size | one sixth of frame | one tenth – one third | A tenth is too small on vertical and the audience cannot find where to look; past a third it stops being low key and becomes conventional night lighting |
| Where the pool lands | half the face including an eye | eyes / half face / hands / contour | On the eyes carries the most information; on the hands is suspense; on the contour you have slid into `backlit-silhouette` |
| Detail left in shadow | contours legible | contours legible – near black | Down is harsher, but past "near black" the model starts generating colored noise in the dark areas |
| Vertical compensation | one stop up | 0 – 2 stops | Widescreen cinema needs none; skip it on vertical and the shadows die on a phone. The most overlooked and most expensive knob on this table |
| Seconds per cut | 4s | 2–6s | Bigger shadows drift faster; keep cuts above a four-stop ratio under 4 seconds |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Black smear | On a phone the whole cut is one dark block with nothing readable in it | Lift a stop, grow the pool to a fifth of frame height, and make sure it lands on the face |
| Noise | Colored grain all over the shadows, like a high-ISO reject | Do not push the shadows to pure black; give them a faint ambient fill |
| Everything down | The part that should be bright went dark too and the whole frame is underexposed | Give the pool its own clause and state that it is the brightest thing in frame |
| Lost face | The light lands on a shoulder or the table, anywhere but the face | Pin the landing point verbatim: `the light falls across her left cheek and eye` |
| Swapped face | Shadow eats the features and the next cut is a different person | Hold the ratio under four stops and keep the eyes inside the pool; never attach this card to a plot-critical cut |

## Examples

*The Letter Back*, R18: after dark, the far wall, the ceiling fan and the window all sunk almost to black, and the only light left is the small pool the bare bulb throws on the tabletop; the two men are reduced to the lit half of each face and their hands on the wood, with one warm edge caught along the red enamel flask. Four stops between the tabletop and the room, and every shadow still holds detail. Medium, 5s, locked off.

Four stops is this card's default ratio, and the cut is explicit about the "detail left in shadow" knob: the film's art baseline has exactly one hard rule about light, and it is that shadows always keep detail. Low key is not turning the picture down — it is leaving the part that should be bright solidly, cleanly bright.

Three things worth noticing. First, **the pool has a source**: the bare bulb over the round table, which is the "not without a practical" rule done properly, and it is why the shadow shapes agree from cut to cut. Second, **something stays visible inside the shadow** — that warm edge on the flask, which is the antidote to "solid black shadow is solid black on a phone". Third, **two people in frame is already this card's ceiling**; the sample holds it by keeping a lit half of both faces and putting every hand inside the pool on the tabletop, so nobody has to be identified by voice.

It is also the film's hinge: R18 arrives, the sitting sequence is over, and the next cut goes straight to the letter.

Example frame not generated.
