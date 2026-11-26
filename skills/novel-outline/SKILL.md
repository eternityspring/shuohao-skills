---
name: novel-outline
version: 2.0.0
description: |
  把一本小说改编成短剧大纲五件套：改编说明、人物表、爽点表、分集梗概、资产清单，
  产出 outline.json + Markdown + 单页评审报告（KPI 带、关键决策、爽点时间轴、调度矩阵、场景概览、质量门）。
  14 道质量门全部由脚本确定性检查（角色分档上限、主场景上限随集数动态、爽点间隔≤3集、每集钩子悬念必填……），不靠模型自觉；
  支持体检模式：贴一份现成大纲进来，只跑质量门给诊断。
  零依赖、零 API key，用当前会话额度。
  Use when asked to 改编大纲、短剧大纲、拆大纲、小说转短剧、adaptation outline。
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-outline
  - 改编大纲
  - 短剧大纲
  - 拆大纲
  - 小说转短剧
  - 大纲体检
  - adaptation outline
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18，只用标准库，无 npm 依赖
  runtimes:
    - claude-code
    - codex
---

## novel-outline

输入一本小说 + 目标参数，输出短剧改编大纲五件套。**四件模型写、一件脚本算**（资产清单从分集数据自动汇总）。

`{baseDir}` = 本文件所在目录。脚本 `{baseDir}/scripts/novel-outline.mjs`，零依赖，`node` 直接跑。

**边界（不做的事）**：不写剧本台词、不做分镜、不出图像/TTS 提示词。梗概是叙述体，出现引号对白就是越界——`validate` 会拦。想从小说拆角色设定（画像/形象提示词/设定图），那是 `novel-characters` 的活。

---

### Step 0 — 收参数 ⛔ 缺了不开工

一次问完，别轮流盘问。两件必问 + 两件给默认值待确认：

| 参数 | 处理 |
| --- | --- |
| **总集数 × 单集时长** | **必问**，没有合理默认 |
| **题材** | **必问**，决定爽点类型，猜错整份废 |
| 改编幅度 | 默认**抽核**（忠实 / 抽核 / 借壳），告知即可 |
| 已有偏好 | 默认无（想保哪个角色、哪场戏） |

平台阈值不同可以带上 `params.thresholds` 覆盖（默认：主角组 ≤ 5、重要配角 ≤ 10、功能性角色 ≤ 10、爽点间隔 ≤ 3 集）。**主场景上限不用配，随集数自动算**：4 + ⌈集数/10⌉，夹在 5–15（60 集 → 10）。这是 AI 短剧的数——场景是生成的没有搭景钱，放宽换观赏性；显式给 `maxPrimaryScenes` 才覆盖。**短篇（20–30 集）建议收紧角色档的阈值**，默认值是按 60 集以上给的。

**人物表从原文拆**——大纲是角色设定的上游，`characters` 块定下的分档、人物线与来源，下游 `novel-characters` 直接拿去当角色清单，不用再判断一遍谁重要。

例外是用户手上已经有 `cast.json`（此前单独跑过 `novel-characters`）：那就拿来当人物原料，角色、别名、关系都是现成的，不用重拆原文。分档按 `importance` 反向映射：protagonist/major → `lead`，supporting → `support`，minor → `functional`。

### Step 1 — 定位输入

材料优先级，写死：

1. 用户点名的**精读章节**
2. **章节目录 + 简介**
3. 全文**分卷摘要**（Step 2）

**禁止凭书名脑补内容**——一切判断基于给到的文本。落地手段：`adaptation.keep` 的关键取舍要附 `evidence`（原文逐字片段）。

直接粘正文的先落成 .txt。输出目录：用户指定就用，没指定用原书同级目录。

### Step 2 — 分卷摘要（长文本才需要）

**这一步是脚手架，不是交付物**——分卷摘要是给没读过原文的模型压缩用的。两种情况直接跳到 Step 3：

- 短篇，单卷装得下
- **当前会话已经通读过原文**——不用再压缩一遍，也不用事后补档

长篇且没读过原文：

```bash
node {baseDir}/scripts/novel-outline.mjs chunk <book.txt> <workdir>
```

按章节标题分卷（默认每卷 15 章，`--per-volume` 可调），识别不出章节就按字数切。打印 `{"volumes": N, ...}`；`truncated: true` 就明确告诉用户尾部没扫到，别闷着。

每卷一个子代理（支持并发就**同一条消息里全部发出**）：读 `{baseDir}/references/volume-pass.md`，读 `<workdir>/vol-NN.txt`，把卷摘要写到 `<workdir>/summary-NN.json`，只回一句「done NN」。

### Step 3 — 快版骨架 → 用户拍板 ⛔

读 `{baseDir}/references/outline-pass.md` 和 `{baseDir}/references/schema.md`，照着做。产出骨架四块（adaptation / characters / scenes / beats），写成 `<workdir>/outline.json`。

```bash
node {baseDir}/scripts/novel-outline.mjs validate <workdir>/outline.json --stage beats
```

过了 beats 档，**把三件事摆给用户拍板：砍了哪条线、合了哪些人、大爆点落在第几集**。不点头不进 Step 4——快版错了只损失一轮骨架，分集写完才发现方向错，全废。

### Step 4 — 细版骨架

吸收用户意见改骨架，再过一次 `validate --stage beats`。用户没意见就直接进 Step 5。

### Step 5 — 分集梗概（分批）

**每批 ≤ 10 集**，能并发就并发。每个子代理拿到：拍板后的骨架四块、自己负责的集数区间、区间内的爽点，读 `{baseDir}/references/episode-pass.md` 照着写，产出写到 `<workdir>/eps-NN.json`。

合并时按 ep 排序拼进 outline.json 的 `episodes`。

### Step 6 — 校验 ⛔ 不能跳

```bash
node {baseDir}/scripts/novel-outline.mjs validate <输出目录>/<书名>-outline.json
```

14 道质量门全部是代码，不是给你读的清单：主角组 1–5 人、重要配角 ≤ 10、功能性角色 ≤ 10、主场景不超上限（随集数动态，60 集 → 10）、叙事道具 ≤ 8 件、一次性场景有规避方案、爽点间隔 ≤ 3 集无真空、第 1 集有钩子、至少一个大爆点（多集项目的首个大爆点须早于最后一集）、每集三栏齐全、三人同框有拆解、生成难点进预警、引用完整无失业角色无空转场景无零集道具、叙述体无对白。

**有违规逐条修，改完重跑，直到通过。**

### Step 7 — 输出与汇报

```bash
cd <输出目录>
node {baseDir}/scripts/novel-outline.mjs render <书名>-outline.json --md   > <书名>-outline.md
node {baseDir}/scripts/novel-outline.mjs render <书名>-outline.json --html > outline-report.html
```

报告界面默认中文；用户要英文界面就加 `--lang en`（或在 outline.json 顶层写 `lang` 字段，`--lang` 优先）。只翻译界面文案，数据内容（爽点类型、梗概、质量门文案）原样出。

report 里自带：KPI 带、关键决策（拍板三件事，大爆点列表和角色位统计自动算）、爽点时间轴（空档标在轴上，超阈值变红）、每集调度矩阵、场景概览卡、资产量折算、质量门（✓/✗ 烘进页面，未过弹病灶横幅）、导出 JSON 按钮（下载的就是 outline.json 原样）。

汇报一句话说清：几集、几个角色几个场景、爽点分布、报告路径；被截断或有没过的门要明说。

最终落地：

```
<输出目录>/
├── <书名>-outline.json
├── <书名>-outline.md
└── outline-report.html            ← 双击就能开
```

---

## 体检模式

用户贴一份**已有大纲**只想要诊断：转成 outline.json（缺的字段问用户或标注缺失），然后：

```bash
node {baseDir}/scripts/novel-outline.mjs checkup <outline.json>   # 终端 ✓/✗
node {baseDir}/scripts/novel-outline.mjs render <outline.json> --html > outline-report.html
```

质量门面板就是诊断书。未过的门不阻止渲染——要的就是把病灶摆出来看。

## 联动更新

用户改了上游就跑一次 `validate`，报错会点名下游哪里断了：合并人物后哪些集还引用着被删的 ID、砍场景后哪些集空转、爽点挪动后哪里出现真空区。**不要靠记忆提示联动，靠校验器。**

## 边界

- 单次上限 60 卷（每卷 15 章约 900 章）。超了明确报 `truncated`，不静默截断
- 阈值是参数不是圣旨：平台不同就用 `params.thresholds` 覆盖，别改代码
- 报告界面内置中英（`--lang`，默认中文、或跟 outline.json 的 `lang` 字段）：界面文案与质量门标签翻译，数据内容（爽点类型、梗概、人名）与门的失败详情保持原文
- 五件套的第五件（资产清单）永远是算出来的，模型手写必漏

## 自测

```bash
node {baseDir}/scripts/selftest.mjs
```

249 项断言，不调模型、不花额度。14 道质量门每一道都有击穿用例——证明它真的会拦。改完脚本先跑这个。

## 自带样例

`{baseDir}/examples/渡口-outline.json`：把短故事《渡口》（novel-characters 的自带样例）改编成 6 集 × 2 分钟的微型大纲，四角色三场景四爽点，全部质量门通过。当质量基准，也是自测夹具。
