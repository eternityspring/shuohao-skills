# novel-director（审片层）

消费 `novel-storyboard` 产出的 `storyboard.json`，从导演视角做**提示性**审查。

- 六类检查：同质镜、运镜动机、轴线、POV、反应镜、主角在场
- **只提示，不设门**：全部是 `重点 / 建议 / 提示` 三级建议，不阻塞生成、不改 JSON
- 零依赖、零 API key：`node scripts/novel-director.mjs review <storyboard.json> [--script s] [--outline o] [--cast c] [--lead C01] [--json|--md|--html] [--out 文件]`

详见 [SKILL.md](./SKILL.md)。自测：`node scripts/selftest.mjs`。
