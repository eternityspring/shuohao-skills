---
name: novel-characters
version: 1.5.0
description: |
  从小说或短故事里拆出角色表、人物画像、形象提示词、音色提示词，
  并给主要角色出角色设定图（左半身像 + 右全身三视图 + 细节条），产出 JSON + Markdown + 可交互的 report.html。
  报告语言可指定（--lang），默认台湾正体中文（zh-TW），任意语言都支持；
  出图风格可指定（--style），默认半写实，也可以出吉卜力动画风或拟真实拍。
  零依赖、零 API key，用当前会话额度；出图走 codex 内置 $imagegen（可选）。
  Use when asked to 拆小说角色、分析人物、生成角色卡、character sheets from a novel。
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-characters
  - 拆角色
  - 拆书角色
  - 小说角色
  - 人物画像
  - 角色卡
  - 三视图
  - character sheet from novel
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18，只用标准库，无 npm 依赖
    optional:
      - codex         # 有才出三视图；没有就只交提示词，其余照常
  runtimes:
    - claude-code
    - codex
---

## novel-characters

输入一篇小说/短故事，输出每个角色的：人物画像、形象提示词、音色提示词、角色设定图。

`{baseDir}` = 本文件所在目录。脚本 `{baseDir}/scripts/novel-characters.mjs`，零依赖，`node` 直接跑。

**运行环境**：Claude Code 和 codex 都能跑。差别只在第 8 步出图——见 `references/sheet.md`。

---

### Step 0 — 确定报告语言

用户可以指定语言，比如「用英文」「--lang en」「日本語で」。**没说就是台湾正体中文（`zh-TW`）。**

想要简体中文得明确说，用 `--lang zh`。

这个 `lang` 会一路传下去：第二趟生成角色卡时决定人类可读字段用什么语言，`validate` 和 `render` 也都要带上。

**界面文案分两种情况：**

- `zh-TW` / `zh` / `en` / `ja` —— 内置，不用管
- **其他任何语言** —— 你要现场翻一份。跑

  ```bash
  node {baseDir}/scripts/novel-characters.mjs ui-template <lang>
  ```

  它打印一份英文骨架，把每个值翻译成目标语言，整块放进 `cast.json` 顶层的 `ui` 字段。渲染时会合并进内置表。

  **不给 `ui` 的话 `validate` 会直接报错**——否则报告会是「角色内容是法语、界面标签是英文」的半吊子状态。

支持的语言不受内置表限制，法语韩语西班牙语都能出完整报告。

#### `zh-TW` 的用语规范

界面文案脚本管了，**角色卡内容是你写的，得你自己守**。写 `persona`、`voice` 的人类可读字段时：

**用台湾惯用词，不是简体词换字形。** 直接换字形会写出一眼看得出的翻译腔：

| 别写 | 要写 |
| --- | --- |
| 性格、气质 | 個性、氣質 |
| 视频、图片 | 影片、圖片 |
| 质量 | 品質 |
| 信息 | 資訊 |
| 默认、通过、支持 | 預設、透過、支援 |
| 水准、计划 | 水準、計畫 |

**一简对多繁的字最容易翻错**，外貌描写里几乎必踩：

| 简 | 看语境选 | 例 |
| --- | --- | --- |
| 发 | 髮／發 | 頭**髮**、一**頭**長**髮**；**發**現 |
| 干 | 乾／幹／干 | **乾**淨、**乾**瘦；**幹**活 |
| 里 | 裡／里 | 眼**裡**、**裡**面；公**里** |
| 松 | 鬆／松 | **鬆**垮、**鬆**弛；**松**樹 |
| 丑 | 醜／丑 | **醜**陋；**丑**角 |
| 面 | 面／麵 | **面**容；**麵**條 |
| 只 | 只／隻 | **只**是；一**隻**手 |
| 复 | 復／複／覆 | 恢**復**；**複**雜；答**覆** |
| 系 | 係／系／繫 | 關**係**；**系**統；維**繫** |

**引号用「」『』**，不要 `""`。

**不受影响的**：`image.prompt` / `image.negativePrompt` / `image.tags` / `image.sheet` / `voice.prompt` 这些机器字段永远是英文，`validate` 会拦中文字符。

### Step 0.5 — 确定画风

用户可以指定出图风格，**默认 `realistic`**：

| id | 说明 | 什么时候用 |
| --- | --- | --- |
| `realistic` | 半写实厚涂。默认 | 一般设定集 |
| `ghibli` | 吉卜力式手绘赛璐璐 | 想要动画质感 |
| `photoreal` | 拟真实拍，剧组试装定妆照 | 要真人选角感、历史剧质感 |

```bash
node {baseDir}/scripts/novel-characters.mjs styles   # 打印预设的完整内容
```

读 `{baseDir}/references/style-presets.md`。**换风格是整套换**——每个预设自带 render / surface / lighting / negative / tags 五块，整块取用，不要混搭。

最容易搞反的是反向提示词，三个预设的立场两两不同：

- `realistic` / `photoreal` **绝不能**禁 `photorealistic`
- `ghibli` **必须**禁
- `photoreal` 另外**必须**禁 `illustration` / `painting` / `anime` / `cartoon`——它要的是照片不是画，漏了模型很容易交一张插画

`validate` 三条都会拦。

版面规则（16:9 三区、比例、细节让位）**不随风格变**，变的只有渲染质感。

### Step 1 — 定位输入

用户给文件路径就直接用。直接粘正文的，**先落到一个临时 .txt**——后面校验「引文是否逐字」要拿原文比对，没有原文文件这步就没法做。

确定输出目录：用户指定就用；没指定就用原书同级目录。

### Step 2 — 分块

```bash
node {baseDir}/scripts/novel-characters.mjs chunk <book.txt> <workdir>
```

打印 `{"chunks": N, ...}`。

- **N == 1**：跳过 Step 3，直接在当前会话读原文做第一趟，结果自己写成 `<workdir>/roster-00.json`
- **N > 1**：进 Step 3
- `truncated: true`：明确告诉用户尾部没扫到，别闷着

### Step 3 — 第一趟扫描（仅 N > 1）

**当前环境支持子代理就并发**（Claude Code 的 Task、codex 的 subagent）：每块一个子代理，**所有调用放在同一条消息里**才是真并发。不支持就一块一块串行读，结果一样，只是慢。

每个子代理的任务：
1. 读 `{baseDir}/references/roster-pass.md`，照它执行
2. 读 `<workdir>/chunk-NN.txt`
3. 把 roster JSON 写到 `<workdir>/roster-NN.json`
4. 只回一句「done NN，抽到 X 个角色」

### Step 4 — 归并

```bash
node {baseDir}/scripts/novel-characters.mjs merge <workdir>
```

按名字+别名收敛（`陆行远`/`陆`/`姑娘` 会收敛成一个人），notes 累加、quotes 去重，按出现块数降序——出现的块越多戏份越重。

### Step 5 — 选角

取前 N 位。默认 10，用户说了就听用户的。剩下的角色在最后汇报里提一句「还识别出 X 位没做画像」。

### Step 6 — 第二趟出卡

每个角色一份，同样能并发就并发。

每份任务拿到：
- `{baseDir}/references/profile-pass.md` 和 `{baseDir}/references/schema.md`（读它们，照着做）
- **报告语言 `lang`**（Step 0 定的）
- 该角色归并后的 `name` / `aliases` / `notes` / `quotes`
- **同批其他角色的名字**（避免长相声线撞车）

角色卡 JSON 写到 `<workdir>/card-<slug>.json`。

**同时写一段故事摘要**：用 `lang` 指定的语言，3–5 句，交代时空背景、核心情境、这几个人聚在一起的由头。短篇直接从原文写；长篇从各块的 roster note 归纳。不剧透结局，不写成推荐语。

合成 `<输出目录>/<书名>-cast.json`：

```json
{ "source": "书名", "lang": "zh", "style": "realistic", "summary": "……", "characters": [ ... ] }
```

### Step 7 — 校验 ⛔ 不能跳

```bash
node {baseDir}/scripts/novel-characters.mjs validate <cast.json> <book.txt>
```

记得带上 `--lang`（Step 0 定的）。检查：结构、`importance` 枚举、**引文逐字**、**出图提示词不含人名**、**语言分工**（人类字段跟随 `lang`、出图/TTS 提示词永远英文）、以及**非内置语言必须带 `ui`**。

**有违规就按报错逐条修，改完重跑，直到通过。** 这四类错模型真的会犯——这套检查就是被真实输出打出来的。

### Step 8 — 出图（可选，只给 protagonist 和 major）

**每个角色一张**，用 `image.sheet`，落到 `./images/<slug>-sheet.png`。一张横构图内部左右分栏：

```
┌──────────┬────────────────────────────┐
│  半身像   │   正视    侧视    背视       │
│ （证件照） ├────────────────────────────┤
│  面部基准  │  细节 · 细节 · 细节 · 细节   │
│   ~34%   │            16:9            │
└──────────┴────────────────────────────┘
```

左栏半身像是面部设计基准，右上三视图的脸照它画，右下是关键细节的小特写。**两条硬要求**：三视图的脸必须与半身像一致（否则一张图两个长相）；三个全身像的比例必须协调（模型会为了塞下细节把人压扁）。

读 `{baseDir}/references/sheet.md`，照它的调用契约做。要点：

- **没有 codex 就整步跳过**，只交提示词，后面照常走
- 跑在 codex 里就直接用 `$imagegen`；跑在别处就 shell 调 codex，先按那里的脚本探测版本最高的 binary（旧版会直接报错）
- **一个角色一次调用，绝不批量**
- 单个失败就跳过，不阻断；最后汇总说明

`supporting` / `minor` 只给提示词不出图。用户明确要求全出就全出。

### Step 9 — 输出

```bash
cd <输出目录>
node {baseDir}/scripts/novel-characters.mjs render <cast.json> --md   > <书名>-cast.md
node {baseDir}/scripts/novel-characters.mjs render <cast.json> --html > report.html
```

语言取 `cast.json` 里的 `lang`，要临时覆盖就加 `--lang <code>`。

`render` 会自动去 `images/<slug>-sheet.png` 找图。所以**先出图再 render**。

report.html 的样式约定见 `{baseDir}/references/report-style.md`——要改样式先读它，别把它改回通用卡片墙。

最终落地：

```
<输出目录>/
├── <书名>-cast.json
├── <书名>-cast.md
├── report.html                    ← 双击就能开
└── images/
    └── <slug>-sheet.png           ← 有 codex 才有
```

### Step 10 — 汇报

一句话说清：角色数、出图数、报告路径。校验一次没过的话，说明修了什么。有角色出图失败、被截断、或因为没有 codex 而没出图，明确说清楚。

---

## 边界

- 单次上限 24 块（约 33 万字符），超了会明确报 `truncated`，不静默截断
- 人类可读字段跟随 `--lang`（默认中文）；出图和 TTS 提示词**永远英文**，那些引擎吃英文最稳
- 设定图最容易出的两个问题：**一张图里两个长相**、**为了塞细节把人物压扁**。拿到图先扫一眼，见 `references/sheet.md`
- 出图只走 codex built-in `$imagegen`。**不用它的 CLI fallback**（要 `OPENAI_API_KEY`）
- 想要能实时编辑、边跑边看的交互界面，那是另一个东西，不在这个 skill 里

## 自测

```bash
node {baseDir}/scripts/selftest.mjs
```

220 项断言，不调模型、不花额度，覆盖分块 / 归并 / 多语言 / 校验 / 渲染的全部确定性逻辑。改完脚本先跑这个。

## 自带样例

`{baseDir}/examples/渡口.txt` 是一篇短故事，4 个角色，其中货郎全程只有绰号、船夫只被叫过「老伯」——专门用来验别名归并。对应产出 `渡口-cast.json` / `渡口-cast.md` 可以当质量基准，也是校验的自检夹具。
