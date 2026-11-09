---
name: novel-director
version: 1.0.0
description: |
  给 AI 短剧做「审片」——消费 novel-storyboard 产出的 storyboard.json 镜头表，从导演视角做
  提示性审查。六类检查：同质镜、运镜动机、轴线、POV、反应镜、主角在场。全部只提示、不设门：
  每条结论都是建议，不阻塞任何生成流程，也不改任何 JSON。零依赖、零 API key，用当前会话额度。
  Use when asked to 审片、导演视角、镜头审查、检查分镜、reaction shot、轴线、POV、运镜动机、主角在场。
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
triggers:
  - novel-director
  - 审片
  - 导演视角
  - 镜头审查
  - 检查分镜
  - 反应镜
  - 轴线
  - POV
  - 运镜动机
  - 主角在场
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18，只用标准库，无 npm 依赖
  runtimes:
    - claude-code
    - codex
---

## novel-director（审片层）

`novel-storyboard` 把「怎么拍」落成了镜头表（storyboard.json）。这部 skill 是它后面的**审片台**：不生成、不校验、不改文件，只站在导演位置上把镜头表里「别扭」的地方挑出来。

**核心立场：只提示，不设门。** 所有结论都是 `重点 / 建议 / 提示` 三级建议，不阻塞生成、不写回 JSON。它补的是 storyboard 那 18 道硬门之外的「软问题」——门查的是「对不对」，审片查的是「好不好看」。

`{baseDir}` = 本文件所在目录。脚本 `{baseDir}/scripts/novel-director.mjs`，零依赖，`node` 直接跑。

---

### 输入

| 文件 | 必填 | 用途 |
| --- | --- | --- |
| `storyboard.json` | ✅ | 镜头表本体（集→段→切），六类检查的主数据 |
| `--script <script.json>` | 可选 | 定位主角台词拍、给反应镜/POV 加剧本语境（目前主要用 `cut.characters` 的 C 编号，剧本仅作增强） |
| `--outline <outline.json>` | 可选 | 把主角姓名映射到 C 编号（主角判定用） |
| `--cast <cast.json>` | 可选 | 取 `importance:"protagonist"` 定位主角；没有就回退 outline 的 role 含「男主/主角」 |
| `--lead C01` | 可选 | 直接指定主角编号；最稳，优先级最高 |

**主角判定**：`--lead` > `cast.importance==="protagonist"`（再借 outline 把名字映射到 C 编号）> `outline.role` 含男主/主角 > 默认 `C01`（并提示你确认）。`cut.characters` 里存的是 C 编号，所以主角在场这类检查直接用编号对，不依赖镜头里写没写名字。

### 命令

```bash
# 控制台文本报告（默认）
node {baseDir}/scripts/novel-director.mjs review <剧名>-storyboard.json \
  --script <script.json> --outline <outline.json> --cast <cast.json>

# Markdown / 单页 HTML 报告
node {baseDir}/scripts/novel-director.mjs review <storyboard.json> --md  --out director-review.md
node {baseDir}/scripts/novel-director.mjs review <storyboard.json> --html --out director-review.html

# 机器可读
node {baseDir}/scripts/novel-director.mjs review <storyboard.json> --json
```

`review` 子命令可省略，直接 `novel-director.mjs <storyboard.json>` 也行。不给定 `--cast/--outline/--lead` 时，**主角在场** 这一类会整体跳过（或默认按 C01 试一次并提示你确认），其余五类照常。

---

### 六类检查（都只提示）

| 类别 | 查什么 | 典型信号 |
| --- | --- | --- |
| **同质镜** | 连续多镜同机位同景别同构图，像没切 | 3 连相同签名；整段静止同机位同构图 |
| **运镜动机** | 运镜缺支点 | 远景上的运镜无表演层；推/拉与机位方向相反（矛盾，重点）；孤立运镜（前后皆静且无表演）；整段无静帧锚点；强烈晃动无戏剧支点 |
| **轴线** | 180° 轴线 / 对视关系（需人工核对） | 同一主体正面↔背后跳变；前一镜看对方、后一镜视线却落画外（对视断裂）；同一主体画面左右跳变 |
| **POV** | 主观视线落空 | 仅对真正的 POV/过肩镜生效：主观视角藏住表演；POV 看向某具体物却同场不呈现；POV 视线落画外却无反打 |
| **反应镜** | 情绪/对手戏没人接 | 带表演的近景/特写高潮后，下一镜仍是同主体同向动作、无反应；对手戏中某一方全程无脸（仅针对人，物件如车/手不报） |
| **主角在场** | 主角戏份与关键段 | 情绪/收尾/有配乐的段全程无主角入画；全剧主角在场段占比 < 60% |

**分级**：`重点`=几乎肯定是问题（如运镜与机位方向相反）；`建议`=大概率值得改；`提示`=留意即可。

报告按类别分组，每条给 **段号#切序 / 证据（实际字段值）/ 建议**。

---

### 与 novel-storyboard 的边界

- 它是**消费端**：读 storyboard.json，不改它、不生成视频/分镜图。
- 它**不设门**：storyboard 的 18 道硬门查「合规」，审片查「观感」，二者互补不重叠。
- 它不是 `novel-staging`：staging 排开场站位（开拍前一刻谁在哪），审片看整张镜头表的导演问题。
- 报告可当作 storyboard 报告的附件：storyboard 出完跑一遍审片，把 重点/建议 丢回 storyboard 改，改完重跑 `validate`。

### 已知局限（ advisory 的本质）

- 轴线 / POV 靠 `cameraPosition`、`eyeline` 的自由文本推断，只能「建议核对」，不能当结论。
- 「对手戏一方无脸」「主角在场」依赖 `cut.characters` 的 C 编号准确；编号写错会误报。
- 没有 `--script` 时，反应镜/POV 只靠镜头表字段，拿不到剧本的情绪/台词语境，灵敏度会低一些。

---

### 自测

```bash
node {baseDir}/scripts/selftest.mjs
```

12 项断言（每类一个触发用例 + 一个零触发用例 + 退化路径），不调模型、不花额度。改完脚本先跑这个。
