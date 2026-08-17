---
id: pov-shot
---

## What it is

Put the camera where somebody's eyes are, and what appears in frame is what they are looking at right now. It is the only word in the official vocabulary that **describes not how the camera moves but whose head it is mounted in** — which is why it stacks with other moves (first person plus a follow is someone looking around as they walk), and why it has to be pinned down on its own before you stack anything on it.

**It is most often confused with an over-the-shoulder.** Over-the-shoulder is "we are standing next to him watching him look"; first person is "we are him." The dividing line is whether any part of his body is in frame — over-the-shoulder needs the shoulder, first person cannot show a single hair.

That is also where all the difficulty lives: **models are bad at holding on to "these are one specific person's eyes."** They render "he is looking" as "he is in frame looking"; they grow a pair of hands nobody owns halfway through; they let the eye height drift from standing to sitting inside one cut. Every rule on this card exists to hold down one of those three.

## When to use it

- **The look through the opened door.** Whatever is behind it lands straight in the audience's face, twice as fast as an objective wide. Always follow it with a cut of his face — that cut is the scene.
- **A hand coming at you.** A hand, a face, a blade pushing toward the lens turns "he is being violated" into "you are being violated." This is the highest-frequency use of first person in short drama.
- **Searching a room with your eyes.** An unfamiliar room, the gaze crossing the table, the drawer, the space under the bed. First person plus a small drift and the audience starts searching on their own.
- **Unboxing and first handling.** Peeling the seal, lifting it, turning it over, your own hands along the bottom edge. Almost every first-person shot in product and vlog work is this one, and it reads as "here is what holding it will be like."
- **Falling, blacking out, being shoved down.** Drop the eye height from standing to floor level with `Shake Strongly` (no more than 2 seconds) and the audience goes down with him.

**When not to use it**:

- **Not before the audience knows whose eyes these are.** A first-person cut has to be established by the cut before it: that face, then this look. Without that setup it is just an unexplained empty shot drifting for no reason.
- **Not when you need his reaction.** He is not in his own first-person cut, so the emotion has nowhere to live. First person is the question; his face is the answer, and a scene with only questions is empty.
- **Never more than two in a row.** By the third the audience is asking what he is actually doing, because they have not seen him in a long time. First person / reverse / first person is a safe rhythm; three in a row is not.
- **Not on a dialogue cut.** The speaker is off screen, so the audience hears a voice with no mouth, and a good line is thrown away.
- **Not as a way out.** "I do not know how to cut this beat, give it a first-person shot" is the only reason this card gets abused. Either it is revealing something or it is strapping the audience to somebody; doing neither leaves an empty shot with no owner.

## How to prompt it

One cut is the norm, and a reverse has to follow it (that cut belongs to another card). Pin two things without exception: the eye height, and whether hands are in frame.

```
medium shot, first-person view — the frame is what one person is looking at
right now (name who, and whether they stand, sit or lie),
eye height held constant (pin it: standing eye height / seated eye height /
floor level), the observer stays out of frame (no face, shoulder or back of
head, ever), hands in or out — pick one (either own hands entering the lower
frame, naming what they hold, or no hands in frame), what they are looking at,
gaze direction and environmental anchors, lighting state
```

- **Pin the eye height as a posture**: `standing eye height`, `seated eye height`, `from floor level`. Write "first-person view" with no height and the model picks a new one every time; two cuts will not join and the person seems to grow and shrink.
- **Hands in or hands out — never leave it open.** This is the biggest trap on the card. Say nothing and the model grows a pair halfway through; say hands in and it sometimes grows three. If they are in, state what they are holding and which edge they enter from.
- **`the observer stays out of frame` is the load-bearing phrase.** Models love to render "this person is looking" as "this person is in frame looking." Leave it out and roughly three cuts in ten put him in his own shot.
- **Name environmental anchors**: a door frame, a table edge, the horizon. A first-person cut has no subject to steady it, and the anchors are the audience's only read on where the gaze is pointed.
- **The `[Shot k]` passage says what he is looking at and how the gaze drifts.** Give `POV`; add `Tracking Shot` for looking while walking, or `Shake Strongly` for the world going over. One stack per cut, no more.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–5s | Under 2s nobody has time to register whose eyes these are and it reads as a flash frame; over 5s the audience starts missing his face |
| Eye height | standing eye height | floor level to standing eye height | The lower the height, the weaker the audience: seated height is being looked over, floor level is already down. **This knob is the power relationship itself**, and it is more direct than any angle word |
| Hands in frame | out | out to the lower third | The moment hands enter, realism goes up a notch and so does the failure rate. Past the lower third the model starts drawing a third hand |
| Gaze drift | none | none to half a room | No drift is safest; the further you sweep, the more room the model invents. To cross a whole room, take two cuts and sweep half in each |
| Consecutive cuts | 1 | 1–2 | First person / reverse / first person is a safe rhythm; three in a row and the audience detaches from the person |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Grown hands | A pair of hands appears along the lower edge halfway through, sometimes three of them | Hands in or out has to be pinned in the prompt; if they are in, state what they hold and hang a hand reference |
| The owner appears | The observer is rendered into his own shot, turning it into an over-the-shoulder or a back view | `the observer stays out of frame` must be present; add `no part of the viewer visible` |
| Height drift | Inside one cut the view slides from standing to seated and the horizon creeps across frame | `eye height held constant` must be present, with the posture pinned (`standing eye height`) |
| Ownerless eyes | The audience cannot tell whose look this is and the cut reads as scenery | The cut before it never established the face. A first-person cut hangs off a face; it cannot stand alone |
| Impossible viewpoint | The frame looks out from somewhere nobody could stand — mid-air, inside a wall | Name the anchors and state the observer's posture and position (`standing just inside the doorway`) |

## Examples

*The Letter Back* R08 is this card: three seconds, medium, camera word `POV`. The son's own hands enter the bottom of frame, one palm goes flat against the dark red door and pushes it open, and the room appears past its edge — the round wooden table, the single bare bulb above it, the folded brown paper letter lying there. Eye height is pinned at standing, and the observer is nowhere in the picture: no face, no shoulder, no back of a head, and nothing held in the hand.

Three things are worth noting. **One, it comes straight after R07**, which is the same action shot objectively — the camera following him through the doorway. Run the two together and you have this card's dividing line: R07 is "we are standing next to him while he opens the door", R08 is "we are him". **Two, the cut can afford to be first-person because the film has already said whose eyes these are** — R03's back, R05's small figure at the third-floor turn, R07 through the doorway. Move the same cut to R01's position and it is just an unowned empty frame. **Three, the hands have to be pinned**: one palm, flat on the door, holding nothing. Leave that open and the model grows a pair of hands halfway through that belong to nobody.

R08 is the only time in the film the camera lives on a person. It lands on the push of a door rather than anywhere else because opening a door comes with a first-person action built in — **a POV holds up when the audience can see what "he" is doing, not just what he is looking at.**

Example frame not generated.
