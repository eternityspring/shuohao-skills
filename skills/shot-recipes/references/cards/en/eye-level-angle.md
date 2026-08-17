---
id: eye-level-angle
---

## What it is

The lens sits on the line through the subject's eyes, axis dead level. **This is not the same thing as writing no angle at all** — that distinction is the entire reason this card exists. Leave the angle out and the model does not give you eye level; it gives you its own default viewpoint, roughly a standing adult looking slightly down. With a seated subject it is blatant: the model assumes the camera is standing too and hands you a twenty-degree high angle.

There is one test. **You can see neither the crown of the head nor the underside of the chin.** If either shows up, what you have is not eye level.

Eye level is something you write on purpose. It is not what you get by leaving the field blank.

## When to use it

- **Every cut of a conversation.** Two people trading lines, no power gap between them: hold eye level throughout and the audience spends its attention on the words. Let one cut drift high and that character reads, inexplicably, as having shrunk.
- **All the way through a piece to camera.** Presenter facing the lens, eyes at lens height — that is what makes it feel like being spoken to. Lower reads as a speech from the pit; higher reads as a scolding. Both leak trust.
- **The cut where a character's face first appears.** The audience has to bank this face. Any angle deforms it, and that deformation contaminates the next fifty cuts of consistency.
- **Dense runs of five or six cuts.** Eye level is the cheapest angle in terms of viewer attention, so it survives rapid cutting. Put another way: the attention budget you save here is what pays for the one or two cuts that genuinely need an angle.
- **Two actors with a big height difference.** Put the line on the eyes of **whoever is speaking**, and move it cut by cut. Never average the two — average and both of them are wrong.

**When not to use it**:

- **Not when the point is who has power over whom.** Eye level says "these two are equals", which fights you directly. Reach for `high-angle` or `low-angle` instead.
- **Not on a seated subject when you can't be bothered to specify height.** Bare `eye level` gets read as "a standing person's eye level" and comes back as a high angle. Either pin it — `lens level with the seated woman's eyes` — or admit the cut is a high angle.
- **Not when the space itself is the subject.** Introducing a hall, a street, a warehouse: eye level shows you one layer of heads and no layout at all. That job belongs to `high-angle` or `overhead`.
- **Not to be defended when the subject isn't a person.** Objects on a table or on the floor have no eye line. Insist on eye level and the model will go looking for a pair of eyes, then grow a person to attach them to.

## How to prompt it

One cut, static by default. Write the height as "level with whose eyes", never in metres.

```
medium shot, lens level with the eyes（whose eyes — standing or seated, name them）,
horizon line at eye height（no crown of the head, no underside of the chin）,
what the subject is doing, environment anchors, lighting state
```

- **Name whose eyes.** With one person standing and one seated, write `level with the seated woman's eyes`. Bare `eye level` lets the model pick, and it picks differently every cut.
- **`horizon line at eye height` is an acceptance test, not decoration.** It tells the model where the horizon lands, which rules out the scalp and the chin underside for free. Interiors have no horizon; the model translates it into where the wall and floor lines converge, which works out the same.
- **Never stack a second angle word** like `slightly low angle` in the same cut. Two angle words and the model splits the difference — a different difference every time.
- **The `[Shot k]` passage covers the subject's action only.** Not one word about camera height; it is already locked in the still, and repeating it makes the model drift that way over the clip.
- Give `Static Shot`; give `Push In` only on the cut where the emotion lifts, with the height held constant through the push.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Lens height | level with the eyes | ±5° | Inside 5° nobody can tell, so treat it as pure eye level; past 10° you have a high or low angle and should stop pretending otherwise |
| Seconds per cut | 3s | 2–6s | The only angle that holds up at 6s. Any angled shot past 4s and the audience starts noticing the camera instead of the scene |
| Horizon height in frame | just above centre | ±1/6 of frame height | Raise it and the figure feels planted, with ground under their feet; lower it, sky takes over and they start to float. Past a third it reads as a high or low angle anyway |
| Camera-to-subject distance | medium | close to wide | Eye level is the most forgiving angle for distance — nothing deforms from close-up to wide. That is exactly why it survives dense cutting |
| Height delta between adjacent cuts | 0 | 0 (do not tune) | Every eye-level cut in a scene must share one height. Off by a little and the cut looks like someone quietly gained an inch |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Default downward | You wrote eye level and still got a look-down: short chin, big forehead | Pin the reference: `lens level with the seated woman's eyes`. The model's default viewpoint is a standing person |
| Shrinking sitter | Across a scene, the seated character gets a little shorter in every cut | Rewrite the height reference in every cut. Do not expect the model to remember the last one |
| Grown eyes | Shooting objects on a table and a face or a pair of eyes turns up in a corner | Do not write eye level for non-people. Use a concrete height reference: `lens level with the tabletop` |
| Height drift | The first two seconds are level, then the camera creeps upward as if rising on tiptoe | Keep camera height out of the `[Shot k]` passage; add `camera height does not change` |
| Dodged gaze | Height is right but the eyes look just past the lens, like reading a teleprompter | State the target: `looking directly into the lens`, or `looking at the man across the table` |

## Examples

*The Letter Back*, R15: father and son seated at opposite ends of the round table, the lens dropped onto the eye height the two of them share, axis dead level. Medium, 4s, locked off.

The instructive part is **where the horizon goes when there is no horizon**. The prompt hands the job to the top edge of the chest-high pale green wainscot on the back wall: that line runs clean across the picture at exactly the height of both men's eyes. With the reference nailed down the model cannot quietly stand the camera up — no crown of a head and no underside of a chin anywhere in frame.

Note also that **both men are sitting**. That is precisely the case this card exists for: bare `eye level` gets read as a standing person's eye level and comes back as a twenty-degree look-down. R15 pins the reference to the eyes of both of them, and only then is the cut really level. Nobody looks up or down at anybody, and the lens declines to take a side.

Example frame not generated.
