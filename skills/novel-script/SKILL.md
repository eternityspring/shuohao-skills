---
name: novel-script
version: 2.0.0
description: |
  给 AI 短剧写剧本：把 novel-outline 的分集梗概落成结构化的场次 + 节拍流（动作节拍与台词行交替），
  台词逐句带说话人与语气，时长逐集按语速确定性折算。产出 script.json + Markdown + 单页评审报告
  （时长仪表 / 分集剧本 / 场次总表 / 按角色聚合的台词本，含导出 JSON）。
  剧本管戏，分镜管拍——本 skill 不分镜头、无镜号、不写生成提示词，那些是下一层分镜 skill 的活。
  10 道质量门全部由脚本确定性检查（每集时长 ±15%、单句 ≤35 字、说话人合法、钩子悬念落纸、
  钩子具象前 3 拍内兑现（hookBeat 认领冷开场）、每场至少一个动作节拍、爽点认领、
  角色/场景/光照/道具对账上游……）。
  有 outline.json 就用 seed 预填每集骨架；给 --art 连光照状态一起对账。
  零依赖、零 API key，用当前会话额度。
  Use when asked to 写剧本、出剧本、台词、场次、写戏、screenwriting for AI short drama。
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-script
  - 剧本
  - 写剧本
  - 出剧本
  - 写台词
  - 场次
  - 写戏
  - screenplay
  - script
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18，只用标准库，无 npm 依赖
  runtimes:
    - claude-code
    - codex
---

## novel-script

给 AI 短剧写**剧本**。**前提刻在骨子里：剧本管戏，分镜管拍**——「爽不爽」和「怎么拍」是两种迭代节奏，台词要反复推翻重写，绑上镜头分解每改一句都得重排镜头。所以这层只有集、场次、节拍流，没有镜号；镜头、首帧提示词、生成批次都是下一层分镜 skill 的活。

但有一条底线：**台词必须是结构化数据，不能写成散文**。每句台词是独立条目（说话人 + 台词 + 语气），动作是独立节拍——这是全部确定性检查的地基：

| 交付 | 解决什么 |
| --- | --- |
| 逐集时长预算 | 一集三分钟就是三分钟：台词按语速折算、动作按节拍估时，写超写欠当场拦下，不流到生成环节才发现 |
| 节拍流（动作 ⇄ 台词） | 台词直接对接 TTS 逐句生成；动作节拍就是画面要发生的事。混成散文两头都喂不进管线 |
| 每场至少一个动作节拍 | 纯对白的场是广播剧——AI 生成时没有画面可写 |
| 开场钩子 + 结尾悬念 | 短剧的生死线，每集都要落在纸面；**钩子不是标签是第一拍**——`hookBeat` 认领具象位置，必须落在全集前 3 拍内（冷开场） |
| 爽点认领 | 大纲说这一集有大爆点，剧本必须有戏认领它——防止改着改着把爆点改丢 |
| 上游对账 | 场景/光照/道具对 art.json、角色对 outline.json，写了美术没登记的光照状态当场报 |

`{baseDir}` = 本文件所在目录。脚本 `{baseDir}/scripts/novel-script.mjs`，零依赖，`node` 直接跑。

**边界（不做的事）**：不分镜头、无镜号、不写画面生成提示词、不出图、不配乐——分镜层的活一件不碰。不改大纲结构（砍线合人是 `novel-outline` 的活）；不做角色和场景设定（`novel-characters` / `novel-art` 的活）。

---

### Step 0 — 定输入与范围

**outline.json 是剧本的直接上游**（分集梗概、爽点落点、单集时长都在里面），标准流程从它开始。没有的话先问用户是否跑 `novel-outline`；用户坚持直接写，就问清集数与单集分钟数，手建骨架，对账门会明说跳过。

**一次写几集**：默认一批 ≤ 3 集。剧本是全管线改得最凶的一层，小批量出、快拍板、再往下写。用户明确要全剧也分批产出，每批过一次校验。

顺手带上（都可选，给了才对账/显示名字）：

- `--outline`：角色引用对账 + 爽点认领检查 + 报告里 C01 显示成人名
- `--art`：场景/光照状态/道具对账 + 报告里 S01 显示成场景名

### Step 1 — seed 骨架

```bash
node {baseDir}/scripts/novel-script.mjs seed <outline.json> --eps 1-3 > <workdir>/script.json
```

确定性搬运：目标秒数（单集分钟 × 60）、钩子、悬念、该集爽点认领、候选场景与人物（进 `seedNote`）。**这些事实不要让模型重新想一遍。** scenes 留空，那才是写戏的活。

### Step 2 — 逐集写戏

每集一份任务，能并发就并发。每份任务拿到：

- `{baseDir}/references/script-pass.md` 和 `{baseDir}/references/schema.md`（读它们，照着做）
- 该集的 seed 骨架 + 大纲里这一集的梗概/爽点/人群方案
- 该集用到的场景卡（art.json 里的锚点、光照状态）与角色信息（性情、说话方式——有 cast.json 更好）
- **前一集的结尾悬念**（这一集的开场要接得上）

核心要求都在 script-pass.md 里，最重的四条：**动作节拍只写常见动作**（挑担上船、搭手卸担这种 AI 见过千万次的；伸篙一挡、睫毛颤这种精巧动作生成必崩）；**时长预算先于一切**（三分钟一集约 50 个节拍，写完自己跑一遍 validate 看秒数）；台词口语、单句一口气、**谁的话像谁**（有 cast.json 就吃角色的性情与说话方式）——「一口气」以能装进下游分镜的单切为准：默认切上限 5 秒 × 4.5 字/秒 = 22.5 字，单句超过它，到 novel-storyboard 的 dialogue-fit 门**任何切法都装不下**；**每集第 1 拍冷开场给钩子的具象**（`hookBeat` 认领，门查位置），结尾一拍必须是悬念。

写完把 `seedNote` 删掉。

### Step 3 — 校验 ⛔ 不能跳

```bash
node {baseDir}/scripts/novel-script.mjs validate <script.json> \
  --outline <outline.json> --art <art.json>
```

10 道质量门全是代码：每集时长在目标 ±15% 内（台词按 4.5 字/秒折算、动作按 2.5 秒/拍，`params` 可调）、单句台词 ≤ 35 字、说话人在本场人物里或标 `VO`、每集钩子悬念落纸、**钩子具象在全集前 3 拍内兑现**（`hookBeat` 认领，`params.hookWindow` 可调）、每场至少一个动作节拍、动作叙述体不混引号台词、爽点认领、角色对账、场景/光照/道具对账。

**有违规逐条修，改完重跑，直到通过。** 写超了先砍动作节拍再压台词；写欠了补戏不注水——加冲突不加寒暄。需要一个美术没登记的光照状态时，去 art.json 里补状态再回来，不要绕过门。

### Step 4 — 输出与汇报

```bash
cd <输出目录>
node {baseDir}/scripts/novel-script.mjs render <剧名>-script.json --md \
  --outline <outline.json> --art <art.json> > <剧名>-script.md
node {baseDir}/scripts/novel-script.mjs render <剧名>-script.json --html \
  --outline <outline.json> --art <art.json> --cast <cast.json> > script-report.html
# 英文界面：加 --lang en（默认中文，也可跟 script.json 顶层的 lang 字段）
```

报告含：KPI 带（含台词占比）、时长仪表（每集条形打在目标区间带上，超欠标红）、分集剧本（一排两集，场次信息超过 300px 渐隐截断、点开展开）、场次总表、**台词本**（一排两个，按角色聚合、列表六行高可滚动、整组复制；给了 `--cast` 每个角色组头带**音色提示词**按钮——台词和音色一页配齐直接跑 TTS）、质量门面板、导出 JSON（下载的就是 script.json 原样）。

汇报一句话说清：几集几场几句台词、预估总时长 vs 目标、哪几集贴着容差边、报告路径；没过的门明说。

最终落地：

```
<输出目录>/
├── <剧名>-script.json
├── <剧名>-script.md
└── script-report.html             ← 双击就能开
```

---

## 四个 skill 的接力

```
novel-outline    → outline.json （什么：结构与分集）
novel-characters → cast.json    （谁：角色资产）
novel-art        → art.json     （哪里 + 手里拿的：美术资产）
novel-script     → script.json  （戏：场次、节拍、台词）
```

seed 吃 outline.json；validate/render 的 `--outline` `--art` 负责对账和显示名字。四份 JSON 各自的报告都带导出按钮，改完都能喂回各自的 render/validate。往下一层是分镜：镜号、单镜头时长、首帧提示词、生成批次单都在那边。

## 边界

- 报告界面内置中英（`--lang`，默认中文、或跟 script.json 的 `lang` 字段）；台词语言跟剧走
- 时长是**估算不是秒表**——容差 ±15% 就是为此留的；`params.charsPerSecond` 按配音语速可调
- `VO` 是画外音统一记号，谁的心声写在 `delivery` 里；台词本里 VO 单独成组
- 不设每集场次上限——AI 换景不要钱，换景次数只进 KPI 统计不设门

## 自测

```bash
node {baseDir}/scripts/selftest.mjs
```

154 项断言，不调模型、不花额度。10 道质量门每一道都有击穿用例。改完脚本先跑这个。

## 自带样例

`{baseDir}/examples/渡口-script.json`：《渡口》**全 6 集完整剧本**（9 场 123 句台词，每集冷开场兑现钩子、都落在 120 秒 ±15% 内），对着 novel-outline 与 novel-art 的样例全部质量门通过。当质量基准，也是自测夹具。
