---
id: entrance-trio
---

## Intent

When the audience arrives in a new space, three things have to land within three cuts: **who just showed up, where this is, and what in here is worth looking at**. One cut each — moving subject, establishing wide, key detail — and the space is standing on its own.

**This is a three-cut recipe**, not three cards written in a row. Drop any one of them and something is missing: the wide alone is a postcard, the subject alone leaves you lost, the detail alone is a close-up of nothing. The order is fixed too — the first second must have a person in motion.

## Prompt skeleton

Three cuts as a set, and all three carry `consistent location anchors`. Choose the anchors first (the same lamp, the same railing, the same ground material), then copy them word for word into all three.

**Cut 1 · moving subject** (`Tracking Shot`, medium or wide):

```
medium shot, the subject in motion (running / pushing a door / entering from off-frame),
camera moves alongside the subject, consistent location anchors: (name each one — fog,
timber jetty, storm lantern), lighting state
```

**Cut 2 · establishing wide** (`Static Shot`, extreme wide or wide):

```
extreme wide shot, the whole space, the subject small in frame but still findable,
consistent location anchors: (the same anchors, word for word from cut 1),
sky and time of day, locked camera
```

**Cut 3 · key detail** (`Push In`, close or medium):

```
close-up, the single most informative detail in this space (a sign / the water / an object
/ a pair of hands), consistent location anchors: (the one anchor that reads best at this
size), shallow depth of field, slow push in
```

- **`consistent location anchors` is the only must-have phrase, because it is the invariant that holds for all three cuts**: the three cuts must share one set of spatial anchors, and without them you have three different places
- **"Moving subject" is only true of cut 1, so it stays in the body rather than becoming a must-have phrase. That is the whole criterion — a must-have phrase has to hold for every cut of the recipe; anything true of a single cut is written in prose and never gated.** Gate it and the other two cuts fail for no reason, and nobody attaches the recipe again
- **Anchors must be word-identical.** If cut 1 says `a rusted iron railing`, cuts 2 and 3 may not become `an old metal fence` — to the model a synonym is a different object
- Dialogue normally stays out of these three; if a line is unavoidable, put it in the cut that follows, so the trio stays a pure statement of place

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 2 / 4 / 3s | 2–4s each | The wide carries the most information and needs the most time; keep the trio under 10s total or it stops reading as an opening |
| Number of cuts | 3 | 3 | This is the definition of the recipe, not a knob; two cuts is just an ordinary entrance |
| Cut order | subject → wide → detail | fixed | Lead with the wide and you have a postcard opening with nobody in the first second |
| Anchor count | 3 | 2–4 | Too few and the space is not locked; too many and anchors fill all three prompts, burying the subject |
| Cut 1 motion | medium | medium–large | Walking into frame is the floor, running or shouldering a door is the ceiling; a still subject is a dead frame |
| Subject size in cut 2 | a tenth of frame height | a twentieth–a sixth | Too small and nobody finds the person; too large and it stops being an establishing shot |
| Cut 3 size | close | close–medium | The tighter it is, the more it reads as a point being made; at medium it becomes a second wide and the trio was for nothing |

## Reference-image constraints

- **One scene sheet, shared by all three cuts** — this is the only real guarantee that the three read as one place, stronger than the anchor phrases
- If the subject is a person, hang the character sheet on **all three cuts**. Cut 2 included: the figure is tiny, and a tiny unreferenced figure will be wearing different clothes
- **Chain the references**: cut 1 becomes a reference for cut 2, cut 2 for cut 3. Light, sky and fog density are locked by that chain — without it you get three versions of the weather
- The prompts carry framing and what is happening right now; what the space looks like belongs to the scene sheet

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Still-life opening | Cut 1 is a sign, an empty frame or a motionless object, and the audience scrolls away in the first second | Cut 1 must contain a person in motion; move the thematic still life to cut 3 |
| Three places | The three cuts read as three unrelated locations | Write `consistent location anchors` plus the anchor text word for word into all three (the gate checks this) |
| Wide comes first | Reordered to wide → subject → detail and the opening becomes a postcard | Restore the order: someone moving first, then the location |
| Empty wide | Cut 2 has no subject at all, so it does not connect back to cut 1 | Keep the subject in the wide, even at a tenth of frame height |
| Three skies | Time of day drifts between cuts — dusk in one, noon in the next | One sentence for time and light, shared by all three, plus the reference chain |
| Reworded anchors | The anchors get paraphrased and the model reads them as different objects | Copy anchor phrases verbatim; no synonyms |

## Examples

*The Letter Back* has no run of three consecutive cuts hung on this recipe. The closest thing is the opening section, Arrival: R01, an aerial over a block of walk-up flats with one fourth-floor window burning warm (extreme wide, `Truck Right`) → R02, the courtyard in extreme wide with the son reduced to a speck (locked off) → R03, following his back into the stairwell (medium, `Tracking Shot`).

Two differences, neither of them small:

- **The order is inverted.** The trio insists somebody is moving in the first second; the reel puts two establishing cuts first and holds the moving subject until third, because it wants to say "this is the building" before it says "this is the man". Written to this card, R03 comes first — the back walks, then the courtyard opens behind it.
- **The third piece is missing.** Nothing after R03 lifts out the one detail worth seeing in this place. Written to this card, cut three would be a slow `Push In` on something the first two cuts already established: the lone bare tree in the courtyard, or that one lit fourth-floor window. A detail, not new information.

`consistent location anchors` does hold between R01 and R02 — the same blocks, the same courtyard, the same drying lines and bicycle shed, copied word for word. R03 breaks it: stepping into the stairwell swaps the entire anchor set for wainscot and an iron railing, which is exactly what the trio forbids.

Example frame not generated.
