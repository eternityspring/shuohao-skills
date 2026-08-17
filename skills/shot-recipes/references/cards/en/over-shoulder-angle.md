---
id: over-shoulder-angle
---

## What it is

The lens sits outside and slightly behind one person's shoulder, **just above the shoulder line**, looking past them at whatever they are looking at. This is a **camera position**, and one cut is enough for it to work.

**Draw the line against `ots-shot-reverse` first.** That is a recipe card, and it is about how a conversation gets cut: two or three cuts trading back and forth, the foreground shoulder switching sides, which cut carries the line, how not to cross the axis. **This card governs three geometric quantities inside a single frame**: how high the lens sits, how much of the width the shoulder takes, and how the sightline out of the frame is aligned. Shooting a back-and-forth conversation? Read `ots-shot-reverse`. Borrowing a shoulder in one cut to establish a relationship — reading a letter, watching the door, looking at a skyline, following a demonstrator's hands? Read this one.

One-line test: **if the question is "how many cuts", that's the recipe; if the question is "where does the camera go", that's this card.**

Of the three quantities, **height** is the one that gets forgotten. Over the shoulder does not mean "standing behind someone" — the lens has to be slightly above the shoulder line, roughly at the near person's ear height. Below the shoulder line the foreground becomes a wall of back. Above the crown it turns into a high angle with an obstruction in the way.

## When to use it

- **Establishing "who is looking at what" in one cut.** A letter, a photograph, a phone screen, a ledger, a face through a gap in the door. The audience reads the thing at the same moment the character does — one cut cheaper than object-then-person, and no explanation required.
- **The cut where someone arrives.** A door opens; the camera stays behind the shoulder of whoever was already in the room. Who was waiting and who has come, in one frame — and you can cut straight into dialogue without a separate establishing shot.
- **Product demonstrations and tutorials.** Watching the hands over the demonstrator's shoulder reads as "standing next to them learning", not "being sold to". In presenter-led work this is the only position that feels closer than facing the lens.
- **Following someone into a space.** Pair it with `Tracking Shot`: the camera rides behind the shoulder as the space unfolds along their sightline. It is cheaper on consistency than a frontal follow — the face is out of frame most of the time.
- **When you need a second person present but not performing.** That foreground shoulder is the entire proof of their presence; they need no action and no line.

**When not to use it**:

- **Don't build a back-and-forth out of this card alone.** A single over-shoulder is a position; two people trading lines is a recipe, with rules about switching sides, crossing the axis and where the dialogue lands. Go read `ots-shot-reverse` rather than improvising with this one.
- **Not when the foreground person has no wardrobe design sheet.** That shoulder is the nearest and largest object in the frame. Get its colour or its shoulder line wrong and the audience concludes there is an extra person in the room.
- **Not when the far subject needs a full performance.** Over the shoulder necessarily makes them smaller, pushes them off-centre, and lets the foreground crop into them. If you need the face, cut to a clean single.
- **Careful with a big height difference.** Shooting the tall one from behind the short one's shoulder adds a low angle on top; the reverse adds a high angle. **An over-shoulder carries an angle of its own, and that is the easiest thing to forget.**
- **Not with three or more people in frame.** You can only borrow one shoulder; the third person gets squeezed to the edge or eaten by it.

## How to prompt it

One cut. Height, shoulder width and occlusion each get a clause. Skip none of them.

```
medium over-the-shoulder framing, lens just above the shoulder line（just above the shoulder,
roughly at the near person's ear height）, far subject clear of the shoulder（the far face fully
visible, not covered by the shoulder or the back of the head）, how much width the foreground
shoulder takes（a quarter by default）＋ fabric colour and shoulder line,
what the far subject is doing and where they are looking, environment anchors, lighting state
```

- **The height clause is the load-bearing one.** Bare `over-the-shoulder` frequently puts the lens below the shoulder line, and you get a slab of the back of a head plus a person obscured by a jaw. Pin `just above the shoulder line` and `roughly at ear height` and the frame snaps into place.
- **Write the occlusion positively.** Models have a strong centring bias and will try to put both the shoulder and the far face in the middle, which lands the shoulder squarely over the face. `far subject clear of the shoulder` is what stops that.
- **What the foreground shoulder needs named is fabric colour plus shoulder-line shape**, not who the person is. Once it is defocused, those two are the only information left, and they are what has to match the character sheet.
- **Offset from the sightline.** Sitting exactly on the line between the two faces gives you a point-of-view frame and the shoulder disappears; leaving the line entirely makes the two look like they are watching different things. Ten to twenty-five degrees off is where an over-shoulder actually lives: write `slightly off the line between the two faces`.
- **The `[Shot k]` passage carries the far subject's action only**; write the foreground shoulder as still (`the near shoulder stays still`) — let it move and the model starts inventing a face for it. Use `Static Shot`; `Push In` to press; `Tracking Shot` to follow someone into a room.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Lens height | just above the shoulder, at ear height | shoulder line to crown | Below the shoulder line the foreground becomes a wall of back and the far person keeps half a face; up at the crown the frame starts carrying a high angle, and you have rewritten the power relation by accident |
| Foreground shoulder share of width | 1/4 | 1/6 – 1/3 | Raise it for pressure — interrogation, closing in, spying; past a third the model treats it as the subject and starts giving it features |
| Offset from the sightline | 15° | 10–25° | Under 10° the shoulder shrinks to nothing and you have a slightly off-centre single; over 25° the over-shoulder relationship breaks and it reads as a third party watching from the side |
| Far subject's position in frame | a third off centre | 1/4 – 1/2 | The closer to centre the more it becomes a plain frontal single and the borrowed shoulder is wasted; too near the edge and the model crops half the face |
| Seconds per cut | 3s | 2–5s | The foreground shoulder is the least stable thing in the frame, and every extra second is another chance for it to deform. Past 5s, split it into two cuts |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Lens too low | A great slab of the back of a head, with the far person's lower face hidden behind shoulder and jaw | Write both `lens just above the shoulder line` and `roughly at ear height` |
| Shoulder over face | The foreground shoulder covers one side of the far face, and re-rolls keep covering it | `far subject clear of the shoulder` is mandatory; add a position for the far subject (`in the right third of the frame`) |
| Face on the shoulder | Half a profile, an ear or a lock of hair grows on the foreground shoulder and matches no character sheet | Pin the foreground as `the back of a shoulder and head, no facial features visible` and state that it never moves |
| Creeping shoulder | It starts at a quarter of frame width and has eaten half the picture a few seconds later | Put `the near shoulder stays still` in the `[Shot k]` passage; hold the cut under 3s |
| Wrong sightline | The far subject looks somewhere else entirely and the relationship breaks | State the target explicitly: `looking at the person whose shoulder is in the foreground` |

## Examples

R11 and R12 of *The Letter Back* are over-shoulders: in R11 the son's shoulder and the back of his head hold the left foreground while the father sits sharp on the right, speaking; R12 reverses it, the father's grey-flecked head moving to the right foreground with the son sharp on the left, saying nothing. But those two cuts are filed in the library under the recipe card `ots-shot-reverse` — **two layers of the same thing**. How many cuts, which one switches sides, where the dialogue lands: recipe. What this card governs is the three geometric quantities inside a single frame. The prompts make the split obvious: both `over-the-shoulder` and `blurred foreground shoulder` are there, so the recipe's gate passes comfortably — **and nowhere in either prompt is there a word about how high the lens sits, how much width the shoulder takes, or how far the lens sits off the line between the two faces.**

Written out for R11, those three clauses go like this. Both men are seated at opposite ends of the round table, so the shoulder line is a seated shoulder line, and the lens goes just above it at roughly the son's ear height — drop below that line and the foreground turns into one solid slab of dark blue back with half a father surviving behind it. The shoulder takes a quarter of the frame width, and the father stays in the right third, his face fully clear of the shoulder and the back of the head. What the foreground names is "dark blue work jacket plus the shape of the shoulder line", not "this is the son" — once it blurs, those are the only two things left to match against the character sheet.

For the off-axis clause the reel supplies a ready-made counter-example: **R08 is an actual POV.** The lens sits exactly on the sightline, the observer is nowhere in frame, and there is no shoulder at all. R11 does not want that; it wants 15° off the line between the two faces. Come in tighter and the shoulder shrinks to nothing and the cut degrades into a slightly off-centre single. Go past 25° and the over-shoulder relationship snaps — the audience reads a third person standing there watching.

One last note. R12 moves the foreground shoulder to the right. **Switching sides is the recipe's move, but the height has to be rewritten after the switch** — this time the shoulder line is the father's, and so is the ear height. Copy the previous cut's numbers across and the two rigs end up at different heights, which cuts together as if the floor of the flat were sloping.

Example frame not generated.
