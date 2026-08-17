---
id: practical-source
---

## What it is

A practical is a light that appears in the shot itself: a kerosene lantern, a desk lamp, a candle, a neon sign, a phone screen, headlights, a hearth, a television. **The one thing separating it from every other lighting position is that the audience can see where the light comes from.**

**This is the most useful card in the batch**, and for a reason that has nothing to do with how it works on a real set. On a set a practical is an aesthetic choice — the lamp is there anyway, and whether it lands in frame is a composition question. In generative video it is a **technical instrument**:

The model has no lights. It re-guesses where the light comes from on every frame. With no source in frame that guess is unconstrained — the key is on the left at second one and has wandered to the right by second three, the modelling on the face slides the whole way, and the shadow shapes never repeat. **Put the source in frame and the model has an anchor inside the picture**: which way light should travel and how much darker the far side should be both follow from that object. Direction stabilises, and falloff stabilises with it.

The one-line test: **if you cannot say where the light comes from, put a lamp in the frame.** It is the best trade available in generative video — one bright object in exchange for a whole cut's worth of lighting stability.

## When to use it

- **The first thing you reach for on a night scene, not a fallback.** Without a practical, night gives you an unexplained wash of blue with a face floating on it, and no cut will match the next one.
- **Long cuts, past 4 seconds.** The longer the cut the more visible the drift. A practical is the most effective stabiliser available, which is why this is one of the few cards in the library willing to put 8 seconds in the range.
- **Several consecutive cuts that must share one lighting state.** Copy the lamp's description word for word into every cut and the shadow shapes finally agree with each other.
- **Emotional turns with a physical cause.** Blown out, struck, blocked by someone stepping past, a wick flaring — the change in ratio stops being render noise and becomes plot.
- **Product work.** Neon, a monitor, an LED strip are the source and the background layer at once: one object doing two jobs.
- **`under-light` and `backlit-silhouette` both want a practical attached first.** Under light needs it to suppress the stage look; a silhouette needs it to explain what that light behind the figure actually is.

**When not to use it**:

- **Not in daytime exteriors.** The sun is already the anchor. Adding a lamp is redundant, and the model will draw two sets of shadows for two sources.
- **Do not let the source outrun the subject — pull it down instead.** The model exposes for the brightest object in frame, so an overbright lamp buys you a black face.
- **Never more than two sources in one cut.** Three sets of shadows fight, the tabletop ends up with shadows in three directions, and the fake is instantly visible.
- **Be careful with a source that travels with a character.** A hand-carried lantern swinging as they walk forces a recomputation of the modelling every frame, and it is the fastest way to smear this card. If you must, hold the cut under 3 seconds.

## How to prompt it

One to three cuts. Across multiple cuts the lamp's description gets copied verbatim — do not paraphrase it.

```
medium shot, light source visible in frame（what the lamp is, where in frame it sits,
how big: a kerosene lantern on the table corner / half a neon sign behind him /
a phone screen held up）,
light falls off with distance（bright near the lamp, sinking into shadow further out）,
what the lamp reaches（which half of the face, the tabletop, the wall behind）,
the lamp's own brightness and color temperature (a 2000K amber flame,
the brightest thing in frame), how dark the unlit parts of the frame are
```

- **Pin the lamp's position**: lower-left of frame, half a metre behind the character, right front of the table. Write "there is a lamp in the room" and it will be somewhere else next cut.
- **The source itself has to be the brightest thing in frame**, or the audience cannot read the causality — a dark lamp next to a lit face is a picture that lies.
- **`light falls off with distance` is the load-bearing phrase.** Leave it out and the model lights the whole room evenly, the lamp degrades into set dressing, and its anchoring effect is gone entirely.
- **Give color temperature as a number**: candle 1800K, kerosene lantern 2000K, incandescent desk lamp 2700K, fluorescent 4000K, phone screen 6500K. Neon by color (`magenta neon`, `cyan neon`).
- **Copy the lamp clause verbatim across cuts.** Rewording it to avoid repetition is how you change lamps by accident.
- Default `Static Shot`; a cut where the lamp holds still and someone walks past it can take `Tracking Shot`.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Lamp size in frame | one eighth of frame height | one twentieth – one quarter | At a twentieth nobody sees it and the anchor never forms; past a quarter the lamp competes with the subject and the model exposes for it, blacking out the face |
| Lamp-to-subject distance | arm's length | touching the face – three metres | Right at the face the ratio explodes and half the face is gone; past three metres the falloff stops reading and the card does nothing |
| Ratio, lit to unlit | 3 stops | 2–5 | Two is too flat to look like one lamp did it; past five the shadows go solid and the room is a single glowing point |
| Color temperature | 2000K | 1800K – 6500K | The number genuinely lands in the prompt; "warm light" gets you an orange filter over everything, including what should have stayed neutral |
| Number of sources | 1 | 1–2 | With two, say which is the key: one warm one cool, one near one far, one strong one weak. Three and the shadows fight |
| Seconds per cut | 4s | 2–8s | The anchor holds long cuts together — one of the few cards in the library willing to go to 8 seconds |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Sourceless light | The room is bright but nothing explains why, and the face floats on the background | Put the lamp in frame and name its position; add `light falls off with distance` |
| Dead lamp | The lantern is in frame with a dark shade while the room is lit | State that the lamp itself is the brightest thing in frame, and give the flame a specific color and brightness |
| Exposed for the lamp | A beautiful lamp and a completely black face | Bring the lamp under an eighth of frame height, and state that the face is lit by that same lamp, one stop under the flame |
| Wandering lamp | Across two cuts the lamp moves from the table corner to the windowsill | Copy the lamp clause verbatim into every cut, and hang cut one as the reference image for cut two |
| Bloom eats the room | A large milky halo around the lamp swallowing everything near it | Cut glow / bloom / halo; write "the flame edge is sharp, the halo reaches only just past the shade" |

## Examples

**The entire lighting of *The Letter Back* is built on one bare bulb.** This card is not "a cut in the sample happens to use it" — it is the film's lighting chassis. A single incandescent bulb over the round table is the warm key, the blue glass window in the back wall is the cold fill, both clauses repeat cut after cut, and across thirty-six frames there is never a second scheme.

The numbers say it fastest. **Of the twenty-seven interior cuts from R07 to R33, twenty-five contain the words `bare bulb`** — the two that do not are R27, where a side key is thrown across the two enamel objects on their own, and R32, the wide of empty wall by the window in daylight. One of the twenty-five uses it backwards: R31 names the bulb only in order to say it is switched off. Across the whole film the wording never changes — not once does it become "a hanging lamp" or "an incandescent fixture" or any other synonym. This card's instruction to copy the lamp clause verbatim across consecutive cuts is what that looks like when somebody actually does it.

It works the whole way through, and it does different jobs as it goes. R07 uses it to split the threshold: warm pooling on the terrazzo inside, cold sound-operated white in the corridor outside. R18's low key is the pool that bulb throws, which is why the shadow shapes agree from cut to cut. R19, hands only, has it "dropping the rest of the room into soft darkness" — falloff written straight into the prompt. R21 rakes it across the crease in the paper. R22 defocuses it into a round warm bloom, which is itself the proof that focus is on the letter. And every cut in the object group except R27, which takes its own side key, gets its clean silhouette against a dark room from the same source.

**The two ends are the best part.** R01, the aerial over the estate, has one warm fourth-floor window in a field of cold blue ones — that is this bulb, seen from several hundred metres away. R36 pulls back at the close: the son crosses the courtyard, the whole block comes into frame, and the fourth-floor window is still burning. One lamp gives the audience a destination in the opening frame and leaves the story something that does not walk out with him. R31 is the proof by negation: the only cut in the film that says the bulb is switched off is the only cut whose lighting is a different animal altogether, and that one is high key.

**One thing stated plainly: no cut in the sample names this card in its recipe field.** It never appears as a single cut's technique, and neither required phrase is written verbatim into any prompt. To genuinely attach it, those two clauses are what you add. R19 is closest already — it says the bulb drops the rest of the room into darkness, which is falloff by another name; rewrite it as `light source visible in frame` plus `light falls off with distance` and the cut is on the card.

Example frame not generated.
