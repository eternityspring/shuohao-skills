---
name: novel-art
version: 1.1.0
description: |
  给 AI 短剧出美术设定集（场景 + 叙事道具）：场景的设计意图、一致性锚点、光照时段变体、
  空景提示词；道具的戏剧功能、状态变体、尺度参照、白底无手提示词。
  产出 art.json + Markdown + 单页评审报告（含导出 JSON）。
  为 AI 生成而设计，不是实拍——环境和道具都是生成资产，交付的是让它们跨集长一样的一致性方案；
  12 道质量门全部由脚本确定性检查（锚点 3–5、无人无手、白底可抠、尺度短语、提示词英文、状态变体已出图……）。
  有 novel-outline 的 outline.json 就用 seed 预填场景清单与出现集；出图走 codex 内置 $imagegen（可选）。
  零依赖、零 API key，用当前会话额度。
  Use when asked to 场景设定、出场景、环境设定集、场景一致性、scene bibles for AI short drama。
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-art
  - 美术设定
  - 场景设定
  - 场景道具
  - 出场景
  - 道具设定
  - 环境设定
  - scene bible
  - prop sheet
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18，只用标准库，无 npm 依赖
    optional:
      - codex         # 有才出环境设定图；没有就只交提示词，其余照常
  runtimes:
    - claude-code
    - codex
---

## novel-art

给 AI 短剧出**美术设定集**：场景 + 叙事道具。**前提刻在骨子里：这是 AI 生成，不是实拍**——没有堪景搭景置景采买，环境和道具都是要被生成几十次还得长一样的资产，所以交付物全部围绕一致性：

| 交付 | 解决什么 |
| --- | --- |
| 一致性锚点（每景 3–5 个） | 观众靠它认场景，QC 靠它核对生成镜头有没有漂 |
| 光照时段变体 | AI 换时段是重新生成不是重新打灯，每个状态落成完整提示词 |
| 空景出图提示词 | 环境和角色是两层资产，参考图里混进人，一致性全毁 |
| 变体机制（variantOf） | 生成新景便宜，但变体复用母场景资产更一致 |
| 道具状态变体 | 皮箱的合上与打开是两张参考图——道具有状态弧，场景没有 |
| 道具尺度参照 | AI 经常把手持道具画成家具尺寸，提示词必须带尺度短语 |
| 道具白底无手 | 道具图要被贴进各种镜头，必须可抠；拿着道具的手是最常见污染 |

`{baseDir}` = 本文件所在目录。脚本 `{baseDir}/scripts/novel-art.mjs`，零依赖，`node` 直接跑。

**边界（不做的事）**：不做分镜、不写剧本、不管角色（`novel-characters` 的活）、不排大纲（`novel-outline` 的活）。**道具只收叙事道具**（有特写、跨集、承载剧情的，通常 3–8 件）——场景陈设归场景锚点，一次性手部道具镜头级提示词解决，都不单独建资产。

---

### Step 0 — 定输入与画风

三种输入，优先级从高到低：

1. **outline.json**（novel-outline 的产出）——最优，场景清单、出现集、承载爽点、复用方案都是现成的
2. 小说原文——自己归纳场景清单（主舞台优先，参考 novel-outline 的主场景上限思路：别贪多）
3. 用户手写的场景清单

画风：**默认 `realistic`**（半写实厚涂），动画质感用 `ghibli`。**跟角色 skill 保持同一档**——角色是吉卜力、场景是半写实，合成的时候没法看。跑 `node {baseDir}/scripts/novel-art.mjs styles` 看预设全文，整块取用不混搭。

有 cast.json（novel-characters 的产出）也带上——校验「提示词不含角色名」要用。

### Step 1 — seed 骨架（有 outline.json 才有这步）

```bash
node {baseDir}/scripts/novel-art.mjs seed <outline.json> > <workdir>/art.json
```

确定性搬运：场景 id/名称/主场景标记/出现集/承载爽点，带复用方案的场景会有 `seedNote` 提示做成变体。**这些事实不要让模型重新想一遍。**

没有 outline.json 就自己按 `references/schema.md` 建清单。

### Step 2 — 逐场景填设定 + 提取叙事道具

每个场景一份，能并发就并发。每份任务拿到：

- `{baseDir}/references/scene-pass.md` 和 `{baseDir}/references/schema.md`（读它们，照着做）
- 该场景的骨架 + 原文/大纲里关于这个空间的全部信息
- **同批其他场景的名字**（空间气质要区分开，别都写成同一种破旧）
- 画风预设全文（`styles` 命令的输出）

核心要求都在 scene-pass.md 里，最重的三条：锚点要**可画可认可核对**（「补丁船篷」是锚点，「陈旧的氛围」是形容词）；光照状态**从分集反推**，不写用不上的全家桶；**能做变体就别开新景**。

**叙事道具**从原文/大纲提取（大纲没有现成道具表，这步是模型的活）：只收**有特写、跨集出现、承载剧情**的，通常 3–8 件，跟主角数量一个量级。每件按 `references/prop-pass.md` 填：戏剧功能、锚点、状态变体、尺度、白底无手提示词。皮箱这种「跟人走的道具」就该在这——塞进场景锚点和角色画像都不对。

### Step 3 — 校验 ⛔ 不能跳

```bash
node {baseDir}/scripts/novel-art.mjs validate <art.json> --cast <cast.json> \
  --prop-states <prop-states.json>
```

12 道质量门全是代码。场景 + 共用 7 道：锚点 3–5、光照状态 ≥1、**无人**、提示词全英文、不含角色名（给了 --cast 才查）、变体引用完整、风格与反向词匹配。道具专属 5 道：**状态 ≥1**、**状态变体已出图**（每个状态须声明 `image` 且文件真实存在）、**尺度短语写进提示词**、**反向词禁手**、**设定图纯白背景**。

`--prop-states <file>` 是**独立来源**（如 `{"P01":["合上","打开"],"P02":["正面","底面刻印"]}`），优先级高于 art.json 自报；它必须覆盖全部现有道具（缺项即报错，确实无状态可显式写 `"none"`）。不传则跳过「状态变体是否都出图」反查、并在报告里明说。

**有违规逐条修，改完重跑，直到通过。**

### Step 4 — 出图（可选）

场景和道具各一张 16:9 设定图，版面都是**主视角大图 + 底部和右侧的 L 形细节边框**。场景：标准取景 + 第一个光照状态，细节格是锚点特写。道具：白底三四分之一主视角（主状态），细节格是锚点特写 + 其他状态 + 侧面。读 `{baseDir}/references/sheet.md` 照调用契约做，要点：

- **没有 codex 就整步跳过**，只交提示词
- **全图无人**；道具图另加**无手**、**纯白背景**，出现人影或手就重生成
- **变体场景拿母场景成图当参考图**（`-i` + stdin）——变体机制的意义就在这
- 一个场景一次调用绝不批量；单个失败跳过不阻断

### Step 5 — 输出与汇报

```bash
cd <输出目录>
node {baseDir}/scripts/novel-art.mjs render <剧名>-art.json --md   > <剧名>-art.md
node {baseDir}/scripts/novel-art.mjs render <剧名>-art.json --html --prop-states <prop-states.json> > art-report.html
```

报告界面默认中文；用户要英文界面就加 `--lang en`（或在 art.json 顶层写 `"lang": "en"`，`--lang` 优先）。`render` 自动去 `images/<slug>-sheet.png` 找图（场景和道具都找），**先出图再 render**。报告含：KPI 带、场景清单、场景设定卡、道具清单、道具设定卡（锚点核对表 / 状态变体 / 提示词包全带复制按钮）、质量门面板、导出 JSON（下载的就是 art.json 原样）。

汇报一句话说清：几个场景（主场景/变体各几）、几件道具、锚点总数、出图数、报告路径；没过的门和没出的图明说。

最终落地：

```
<输出目录>/
├── <剧名>-art.json
├── <剧名>-art.md
├── art-report.html                ← 双击就能开
└── images/
    └── <slug>-sheet.png           ← 有 codex 才有
```

---

## 三个 skill 的接力

```
novel-characters → cast.json    （谁：角色资产）
novel-outline    → outline.json （什么：结构与分集）
novel-art        → art.json     （哪里 + 手里拿的：美术资产）
```

seed 吃 outline.json（场景部分；道具表大纲里没有，模型从原文提取），`--cast` 吃 cast.json。三份 JSON 各自的报告都带导出按钮，改完都能喂回各自的 render/validate。

## 边界

- 报告界面内置中英（`--lang`，默认中文、或跟 art.json 的 `lang` 字段）；出图提示词永远英文
- 画风要跟角色 skill 同档，别一半写实一半动画
- 出图只走 codex built-in `$imagegen`，不碰要 API key 的 CLI fallback
- 场景数量不设硬上限——上限在 novel-outline 的主场景门那里管；这里管的是每个资产的质量
- 道具只收叙事道具，3–8 件为宜——每多一件就多一份跨集一致性维护

## 自测

```bash
node {baseDir}/scripts/selftest.mjs
```

163 项断言，不调模型、不花额度。12 道质量门每一道都有击穿用例。改完脚本先跑这个。

## 自带样例

`{baseDir}/examples/渡口-art.json`：《渡口》三场景 + 两件叙事道具（旧皮箱、县衙旧砚）的完整设定，全部质量门通过（含对着 novel-characters 样例 cast 的角色名检查）。当质量基准，也是自测夹具。
