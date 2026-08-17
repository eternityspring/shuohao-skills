---
id: time-lapse
---

## What it is

The framing is nailed down and time is squashed flat: cloud running across the sky, shadows swinging round the foot of a wall, pedestrians pulled into blurred bands. The audience reads one sentence — **"a long time went by."**

It is the other half of the pair with `slow-motion`: one stretches time until every stage is readable, the other compresses it until you can watch it move. The hard constraints are the same on both cards: **no dialogue, and no face that has to be legible.**

**A generative time-lapse is an imitation, not undercranking.** What the model produces is "what time-lapse footage looks like" — racing cloud, streaked headlights, shifting shadow. That fact sets the boundary: **subjects it has seen a lot of work well (sky, cloud, water, street traffic, the angle of daylight), and subjects that demand strict causal continuity do not (a flower opening, food spoiling, a building going up).** The latter require one object to keep its identity and change in one direction across dozens of seconds, and the model will swap it out midway.

The one-line test: **compressing an environment, use this card; compressing the transformation of one specific object, the technique cannot do it yet — use two cuts as a before and after instead.**

## When to use it

- **A time transition.** Day into dusk, fog lifting, the tide coming in. One time-lapse cut replaces a "three hours later" caption without breaking the fiction.
- **The establishing cut at the top of an episode.** City, river, pier, rooftops. Three seconds buys you place and hour more cheaply than any wide.
- **A breathing space between two heavy scenes.** Drop one in and the episode suddenly has a pulse.
- **An environmental backdrop for product work.** The coffee on the table is still; the cloud outside the window is running. Static object against moving world is advertising grammar in itself.

**When not to use it**:

- **Not in a cut with dialogue or a face.** A face inside a time-lapse survives about half a second before it becomes somebody else.
- **Not inside continuous time.** This is the easy mistake: a time-lapse says "a long time passed", so dropping one into the middle of a scene that plays continuously tells the audience the clock jumped. That is a narrative error, not a stylistic choice.
- **Not for changes with a specific causal chain.** Flowers opening, rot spreading, construction — the model replaces the object partway through, so you get two things rather than two stages of one thing.
- **Never more than once an episode.** It is punctuation; after the second the audience starts counting them.
- **Not on a vertical close framing.** All the value lives in wide sky and long lines, and a tight vertical frame has nowhere to put them.

## How to prompt it

One cut, two to five seconds, **and the only camera word is `Static Shot`.** A moving time-lapse — a hyperlapse — needs a frame-accurate camera path that generative video cannot hold. Do not try it.

```
extreme wide shot, place and hour（the courtyard of an old housing block, lirst light）,
everything moves faster than real time,
the frame stays put while time runs,
what is moving, named item by item（cloud sweeping sideways, shadow travelling along the wall, reflections changing fast）,
what is not moving, named item by item（the pier, the jetty, the mooring posts — the anchors that prove the camera held）,
any people kept tiny（no more than an eighth of frame height）, the colour temperature it starts at and ends at
```

- **Name both the moving and the fixed things.** Name only the moving ones and the model accelerates the whole picture, which reads as fast-forward; name what stays nailed down and the acceleration has a reference, which is what makes it read as a time-lapse.
- **Keep people tiny** — an eighth of frame height at most. Any larger and the face changes three times in three seconds.
- **Give colour temperature a start and an end**: `from cold blue dawn to warm amber`. Leave it open and the model rocks the colour back and forth, which looks like two clips spliced together.
- **The `[Shot k]` passage says the camera does not move at all.** Put "time is passing" into the picture content — cloud, shadow, light — never into a camera action.
- **Sky or water should fill at least half the frame.** That is where a time-lapse is easiest to read; an interior-only time-lapse barely works at all.

## Parameters

| Knob | Default | Range | How it feels when you tune it |
| --- | --- | --- | --- |
| Seconds per cut | 3s | 2–5s | Under 2s nobody registers that this is a time-lapse; over 5s the picture repeats and the cloud comes back round |
| Time compressed | two or three hours | one hour – a full day | Under an hour the light barely changes and it just looks windy; across a full day you are changing colour temperature and light direction together, and the model usually breaks it into two halves |
| Sky or water share | half the frame | one third – two thirds | Less and there is nothing to read time on; more than two thirds and there is no room left for the ground information |
| People size | under 1/8 frame height | 1/10 – 1/6 | Past a sixth the model starts rendering the face properly, and then starts changing it |
| Moving elements | 2 | 1–3 | One (cloud only) is thin; more than three and the model loses track, leaving one or two of them running at normal speed |
| Takes per attempt | 2 | 1–3 | Failure rate is low here; what fails is camera drift, and two takes are usually enough to pick from |

## Known pitfalls

| Symptom | What you see | Fix |
| --- | --- | --- |
| Fast-forward | The whole thing reads as an ordinary clip on fast-forward, with none of the time-lapse feel | The fixed anchors were never named. Write the pier, the rail and the posts into the prompt so the acceleration has a reference |
| Drifting frame | The framing creeps over three seconds and the racing cloud counts for nothing | `the frame stays put while time runs` in the prompt, `Static Shot` as the only camera word, and name the fixed objects at the frame edges |
| Grown face | Someone in frame is slightly too large and turns into a different person a few frames later | Keep everyone under an eighth of frame height, or clear the frame of people entirely |
| Season change | Cloud type or light colour jumps midway and it looks like two clips joined | Pin the colour temperature start and end, and give no second lighting description in between |
| Sun in reverse | Shadow direction contradicts the light source and the sun appears to run backwards | State both which side the light comes from and which way the shadows travel |

## Examples

**A general-purpose technique card: no cut in *The Letter Back* uses a time-lapse — and none should.**

The story runs from the son crossing the courtyard to the son walking back out of the block, all inside one continuous afternoon. "Not inside continuous time" covers very nearly every cut in the film.

The more interesting part is the one slot that looks like a time-lapse: **between R17 and R18, the daylight in the flat goes.** The film simply cuts across it — the light drops a stop between two frames and the audience supplies "they sat there a long while" on its own. A time-lapse could not do the job: it cannot carry a face that has to be legible, and two men are sitting in every frame of that sequence. To attach this card you would first have to send them out of shot and insert an empty frame, which is exactly the breath that holds the two of them at that table. **Both of this card's prohibitions — no legible face, nothing inserted into continuous time — fire at the same spot.**

Its most typical cut looks like this: a locked-off empty frame of the courtyard, cloud sweeping across, the shadow of the block travelling along the foot of the wall, colour temperature running from cold grey to warm amber, the fixed things named item by item (the bicycle shed, the two drying lines, the bare tree in the middle of the yard), not one person written, three seconds.

The real slot is between sequences: one ends at night, the next opens at dawn, and three seconds of courtyard in between does what no caption does as cheaply.

Example frame not generated.
