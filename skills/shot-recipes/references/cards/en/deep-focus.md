---
id: deep-focus
---

## What it is

Everything from the nearest foreground to the furthest background is sharp; no layer is soft. **It is the exact opposite of shallow focus**, but it is not simply "shallow focus not applied" — deep focus has to be paid for: enough light, layers arranged deliberately, and something worth looking at on every one of them.

The one-line test: **this cut wants the audience to hunt for information inside the frame (the person in front is talking, the person behind is doing something with their hands) — that is deep focus. This cut wants them to look at one thing — that is shallow focus.**

In AI generation it carries an extra practical weight: **the model's default reading of "cinematic" is a blurred background.** Unless you state deep focus, you will not get it. This is one of the few techniques in the library that requires a negative instruction.

## When to use it

- **Two threads in one frame.** The person in front is speaking, the person behind is quietly doing something. The audience catching it themselves hits harder than a cutaway.
- **Passages where the environment is the information.** What is piled in the room, what is missing from it, whose seat has been taken.
- **Cuts that establish spatial relationships.** Who is in front, who is behind, how far apart — answered once, never explained again.
- **Product plus its context.** The pan on the stove and the whole kitchen behind it; the kitchen is often what is actually being sold.
- **Group compositions.** Everybody has to be sharp, because whoever is soft reads as unimportant.
- **Daylight exteriors.** The light is already there, which makes deep focus close to free.

**When not to use it**:

- **Not when the background is cluttered.** A sharp background is a background that participates in the storytelling; clutter in focus leaves the audience with nowhere to look.
- **Not on night scenes and dark interiors.** The model fills the shadows with noise, or lifts them until the whole frame goes plastic.
- **Not when one person's expression is the point.** In deep focus the background competes with the face, and it competes hard.
- **Not on vertical closes.** The narrow strip of background behind a vertical close-up rendered sharp only looks dirty.

## How to prompt it

One cut is the norm. Name all three layers and give each of them something to do — a layer with nothing happening is scenery, and scenery may as well be blurred.

```
wide shot, everything sharp from front to back, no blurred layers,
foreground layer: what it is and what is happening on it,
middle layer: what it is and what is happening on it,
background layer: what it is and what is happening on it,
left-right placement and front-back spacing of the layers,
light on every layer（any dark layer gets abandoned by the model）, cinematic film still
```

- **`no blurred layers` is the critical line.** The model's default reading of `cinematic` is background blur; say nothing and blur is what you get.
- **Light every layer.** Bright foreground, dark background, and the model gives up on the background entirely and smears it into a dark slab.
- **Pin the placement of the layers** (front left, centre, back right). Otherwise all three end up on the same depth line and the frame reads as a group photo.
- **Give the action only to the layer that matters.** Keep the background layer static — sitting, watching — or it steals the scene.
- Give `Static Shot`. The audience has to walk their eyes around the frame; a moving camera does not leave them the time.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Sharp layers | 3 | 2 – 4 | Two is the entry point (below that, depth of field is moot); past four the model cannot hold it and the furthest layer goes first |
| Seconds per cut | 5s | 3–8s | The card that most needs length: the eye has to sweep three layers, and under 3s the staging is wasted. Past 8s the far layer starts changing on its own |
| Distance to the furthest layer | five metres | two metres – tens of metres | The further, the harder to hold: past ten metres the model usually blurs it or reinvents it |
| Lighting ratio between layers | 2:1 | 1:1 – 3:1 | The closer the layers are in brightness, the easier it is to keep them all sharp; past 3:1 the dark layer gets treated as background and abandoned |
| Foreground size | a fifth of frame | 0 – 1/3 | The foreground layer is where deep focus pays off (a door frame, a railing, a shoulder); past a third it stops being a layer and becomes an occluder |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Sneaky blur | You wrote deep focus and the background is still soft | `no blurred layers` is mandatory, plus `deep focus throughout` and the content of every layer |
| Lost background | The furthest layer smears into a colour slab, or its content changes | Bring the furthest layer inside five metres, cut the lighting ratio to 2:1, and name that layer item by item |
| Group photo | All three layers land on the same depth line | Pin left-right placement and front-back spacing: foreground lower right, middle centre, background upper left |
| Noisy night | Deep focus in a dark interior fills the shadows with noise | Do not do deep focus at night; if you must, give every layer its own source — lamp, candle, window |
| Upstaged | The person in the background is more interesting than the lead in front | Keep the background layer static and reserve the action for the layer that matters |

## Examples

*The Letter Back* carries neither focal length nor depth of field in its storyboard JSON (**both live in the prompt**), so no cut in the sample can be called a deep-focus cut. The shallow end is written down explicitly at R22 and R23; the deep end never is.

**R09 is where it most wants to be added**: the wide of the room, the son standing at the left end of the round table, the father seated at the right, the letter, the flask and the mug between them. The information is already spread across three depths — the three props in front, the two men in the middle, the wainscot, the calendar and the blue glass window at the back. Add "everything sharp from front to back, no blurred layers" and the audience walks the frame themselves: the letter first, then the two men holding opposite ends of the table, then the window. Soften any one layer and the staging is wasted however carefully it was arranged.

Say the hard part too. The only warm key in the room is the single bare bulb over the table, and the back wall survives on cold fill from the blue window, so the layers pull apart in brightness by default. Past about three stops the model abandons the back wall and smears it into one dark block. **Deep focus in this room starts by giving that back layer a light of its own** — write the window as a real cold panel of light, not as "a window in the background".

Example frame not generated.
