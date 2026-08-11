[中文](README.md) · **English**

# shuohao-skills

> This project is forked from [eternityspring/shuohao-skills](https://github.com/eternityspring/shuohao-skills)
> and continues to build on the original work. What differs here:
>
> - **Defaults to Taiwanese Traditional Chinese** (`zh-TW`) — Taiwanese word choices, not just converted glyphs. Use `--lang zh` for Simplified
> - Adds a **`photoreal`** style preset: live-action wardrobe camera test
>
> See the [CHANGELOG](CHANGELOG.md).

**Agent skills for AI short-drama production** — from a novel to shoot-ready material: character bibles, model sheets, adaptation outlines. Built for AI coding agents, **runs in both Claude Code and codex**.

| Skill | What it does |
| --- | --- |
| [**novel-characters**](skills/novel-characters/README.en.md) | Turns a novel into a character bible: profiles, design prompts, voice prompts, model sheets. Report language and image style are both configurable |
| [**novel-outline**](skills/novel-outline/README.en.md) | Adapts a novel into a five-piece short-drama outline: adaptation notes, cast, beats, per-episode synopses, asset list. All 13 quality gates are script-checked; includes a checkup mode for existing outlines |

Point it at a novel and you get this:

![Character bible report](skills/novel-characters/assets/report.png)

## Install

```bash
git clone https://github.com/eternityspring/shuohao-skills.git
cd shuohao-skills
./scripts/install.sh
```

It detects whether you have Claude Code or codex installed and **symlinks** every skill into place — so `git pull` takes effect immediately, with no reinstall.

```bash
./scripts/install.sh novel-characters   # just one skill
./scripts/install.sh --codex            # only into codex
./scripts/install.sh --uninstall        # remove the symlinks
```

Prefer to do it by hand:

```bash
ln -s "$PWD/skills/novel-characters" ~/.claude/skills/novel-characters
ln -s "$PWD/skills/novel-characters" ~/.codex/skills/novel-characters
```

## Requirements

| | Required? | Notes |
| --- | --- | --- |
| **Node** | Yes | ≥ 18. The skill scripts use only the standard library — **no npm dependencies, nothing to install** |
| **Model quota** | Yes | Uses your current session's quota. **No API key needed** |
| **codex CLI** | Optional | Only for image generation (via its built-in `$imagegen`). Without it, image steps are skipped and everything else still runs |

> **Note on output language.** These skills are Chinese-first, and this fork defaults to Taiwanese Traditional Chinese (`zh-TW`). `novel-characters` produces Chinese character profiles even for an English source novel, and its validator actively rejects English in those fields. Pass `--lang en` for an English report; see that skill's README.

## Repository conventions

One directory per skill, **self-contained and copyable on its own**:

```
skills/<skill-name>/
├── SKILL.md          the workflow the agent reads (required)
├── README.md         the docs a human reads
├── scripts/
│   ├── <name>.mjs    deterministic helpers, zero dependencies
│   └── selftest.mjs  self-test, never calls a model (required)
├── references/       detailed instructions, loaded on demand
├── examples/         bundled samples that double as test fixtures
└── assets/           screenshots
```

Two hard requirements:

- Every skill must have a `SKILL.md`
- Every skill must have a `scripts/selftest.mjs` that **calls no model and costs no quota**, covering all deterministic logic

Run every self-test before adding a skill:

```bash
for f in skills/*/scripts/selftest.mjs; do node "$f"; done
```

There is no CI — the self-tests run in about a second, so running them locally beats waiting on a pipeline. **Only tested on macOS with Node 24**; there is no platform-specific code, so Linux and older Node releases should be fine, but that is unverified.

## Test corpus

[`testdata/classic-chinese-novels/`](testdata/classic-chinese-novels/) contains normalized plain-text editions of *Romance of the Three Kingdoms*, *Water Margin*, *Journey to the West*, *The Plum in the Golden Vase*, and *Dream of the Red Chamber* for local integration and stress testing. See the directory README for sources, checksums, and licensing notes.


## License

[Apache 2.0](LICENSE)
