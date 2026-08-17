---
id: under-light
---

## What it is

The source sits below the subject's chin and throws light upward, so the shadows of the nose, brow and jaw all climb toward the forehead and the crown of the head becomes the darkest part of the frame. **It pairs with the same classic confusion as top light**: a low angle means the camera crouched and the audience is looking up. Under light means the light crouched, and the camera can stay at eye level.

The one-line test: **camera below is a low angle; light below is under light — stack them and the face is finished.**

**This is the card in this batch most likely to blow up**, and the reason has nothing to do with the light itself. It is the training material. Under light is vanishingly rare in ordinary photographs, so almost every example the model has seen comes from horror posters, stage productions and Halloween selfies. Ask for "under light" and that is exactly what it hands back: a face evenly lit from below, a pure black void behind it, a cheap theatrical effect.

**There is one reliable way to hold it down: always give under light a low source that is visible in frame and plausible in the world.** A lantern on the table, a brazier on the floor, a phone screen in a hand, a candle at the feet. With a physical source present, the model computes from that object — where the light comes from, how far it reaches, how bright it is are all anchored, and the stage preset never gets loaded. **In practice under light only works as a special case of `practical-source`; disembodied under light has no usable form in generative video.**

## When to use it

- **Talking around a fire or a brazier.** The oldest and safest under-light scene there is, because the source is already part of the drama.
- **Looking at a phone late at night.** Screen light thrown up onto a face is the modern, low-risk version of this card and needs no explanation at all.
- **Carrying a lantern at night.** A lamp held below the waist, swinging a little with each step, digging the walker and the path out of the dark together.
- **The "something is off about this one" cut.** Under light carries that tone by default — but it needs a physical reason. Give a face under light out of nowhere and the audience reads a special effect, not a character.
- **A single tone-setting cut in horror or suspense.** One or two an episode, purely to nail the genre down.

**When not to use it**:

- **Never without a low source in frame.** Disembodied under light produces the theatrical version one hundred percent of the time. No exceptions.
- **Never on a talking head.** The audience's first reading is "this person is about to frighten me", and there is no second reading.
- **Not in a daytime exterior.** There is nowhere for the light to come from, so it just reads as a rendering mistake.
- **Not on a cut where the audience should feel for the lead.** Under light is already saying "he is a problem"; you cannot run that and ask for sympathy at the same time.
- **Never stacked with a low camera angle.** Upturned nostrils plus a glowing chin and the proportions of the face collapse.

## How to prompt it

One or two cuts, none longer than 4 seconds. The source must be named and it must be in frame.

```
medium shot, light comes from below（what the low source is and where it sits:
a lantern on the table / a brazier on the floor / a phone screen held up —
it has to be visible in frame）,
shadows fall upward（nose and brow shadows climb toward the forehead）,
how far the light reaches（to the shoulders / to the chest）,
how dark the upper part of the frame is, color temperature
(2000K ember orange / 6500K phone-screen white), camera at eye level
```

- **The visible source is the only insurance this card has.** Leave it out of frame and you are gambling; the losing hand is the first row of the pitfalls table.
- **Give color temperature as a number.** Embers 1800–2200K, candle 1800K, kerosene lantern 2000K, phone screen 6000–6500K. Ask for "an uncanny light" and the model pulls the face into orange and green.
- **Say the upper part of the frame is dark.** "The crown is darker than the chin" is the identifying feature; without that line the model lights the whole face evenly and you have a lamp, not under light.
- **Do not write horror, creepy, eerie, sinister.** Those words drag the model straight back into the poster material and skin tone, eyes and background all deform together.
- **Cap the reach** (to the shoulders, to the chest). With no cap the model lights the entire room and the falloff disappears.
- Default `Static Shot`. Do not move on an under-lit cut — the source moves, the model recomputes the whole face every frame, and nothing smears faster.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Source height | one head below the chin | chest height – floor level | Lower is more sinister; at chest height it is just a warm lamp and the tone is gone; down at floor level the model starts painting stage footlights |
| Source in frame | fully visible | fully visible – a corner showing | Fully visible is the stable answer; a corner still holds; entirely out of frame is a gamble and not recommended |
| Ratio, lit area to crown | 3 stops | 2–5 | At two nobody can tell the light came from below; past five the crown vanishes and you get a floating lower half of a face |
| Color temperature | 2000K embers | 1800K – 6500K | Firelight 1800–2200K, phone screen 6000–6500K. The middle of that range (3000–5000K) looks least real under light — avoid it |
| Seconds per cut | 3s | 2–4s | Past 4s the audience reads it as an effect rather than an environment. Under light is a short-cut language |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Stage face | A face evenly lit from below against a pure black void, like a theatre publicity still | Put the source in frame, cap the reach at the shoulders, and give the background a trace of ambient rather than pure black |
| Halloween | The face pulled into orange and green with unnaturally bright eyes | Cut horror / eerie / creepy; give a numeric color temperature; add that the skin is a normal skin tone |
| Dead lamp | The lantern is in frame but is itself dark, while the face is lit | State that the source is the brightest thing in frame |
| Scattered shadows | Nose shadow climbing, neck shadow falling, the two contradicting each other | `shadows fall upward` must be there, and name the direction of every individual shadow |
| Swapped face | Features deform under the light and the next cut is a different person | Hold the ratio under three stops and the cut under 4 seconds; never attach this card to a plot-critical cut |

## Examples

A general-purpose technique card; *The Letter Back* does not use it — **and could not supply the conditions if it wanted to.** Indoors the light is the bare bulb overhead plus the blue glass window in the back wall; the corridor runs on sound-operated ceiling bulbs; outside is dusk. Across all three spaces there is not one source below anybody's chin. The first rule on this card is never without a low source in frame, and the sample honestly leaves it empty.

Its most typical cut looks like this: **night, a kerosene lantern fully in frame on the table, the flame the brightest thing in the picture, the light reaching the shoulders and no further, the crown of the head the darkest part of the frame, nose and brow shadows climbing toward the forehead together.** Camera at eye level, three seconds, locked off, colour temperature pinned at 2000K.

Attaching it to *The Letter Back* would mean changing the story, and adding a fourth object to a film that owns three — a candle lit on the table during a power cut, say. It would work. But under light is already saying "there is something wrong with this one", and nobody in this film is wrong. Whatever sits between these two men, the light does not get to point at it.

Example frame not generated.
