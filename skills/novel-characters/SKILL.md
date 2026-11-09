---
name: novel-characters
description: |
  从小说或短故事里拆出角色表、人物画像、形象提示词、音色提示词，
  其中形象提示词含一张角色设定图的完整版面指令（左半身像 + 右全身三视图 + 细节条），
  产出 JSON + Markdown + 可交互的 report.html。
  报告语言可指定（--lang），默认中文，任意语言都支持；零依赖、零 API key、脚本不出图，
  出图配方另附（references/asset-recipe.md：半身像 → 三视图版面 → 1:1 头像三件套）。
  Use when asked to 拆小说角色、分析人物、生成角色卡、character sheets from a novel。
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
metadata:
  version: 2.1.0
  triggers:
    - novel-characters
    - 拆角色
    - 拆书角色
    - 小说角色
    - 人物画像
    - 角色卡
    - 三视图
    - character sheet from novel
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18，只用标准库，无 npm 依赖
  runtimes:
    - claude-code
    - codex
---

## novel-characters

输入一篇小说/短故事，输出每个角色的：人物画像、形象提示词、音色提示词、角色设定图的版面指令。

**脚本不出图，只产提示词。**出图要选模型、选画风、选画幅，那三件事在这里一个都答不了——但只要当前环境有出图能力（ImageGen 之类），就按 `{baseDir}/references/asset-recipe.md` 出，那是本 skill 已经踩过坑沉淀下来的配方，不是随便写的一段说明。

`{baseDir}` = 本文件所在目录。脚本 `{baseDir}/scripts/novel-characters.mjs`，零依赖，`node` 直接跑。

**运行环境**：Claude Code 和 codex 都能跑，没有差别——这条管线全是 node 脚本加模型读写，不碰任何本机可执行文件。

---

### Step 0 — 确定报告语言

用户可以指定语言，比如「用英文」「--lang en」「日本語で」。**没说就是中文（`zh`）。**

这个 `lang` 会一路传下去：第二趟生成角色卡时决定人类可读字段用什么语言，`validate` 和 `render` 也都要带上。

**界面文案分两种情况：**

- `zh` / `en` / `ja` —— 内置，不用管
- **其他任何语言** —— 你要现场翻一份。跑

  ```bash
  node {baseDir}/scripts/novel-characters.mjs ui-template <lang>
  ```

  它打印一份英文骨架，把每个值翻译成目标语言，整块放进 `cast.json` 顶层的 `ui` 字段。渲染时会合并进内置表。

  **不给 `ui` 的话 `validate` 会直接报错**——否则报告会是「角色内容是法语、界面标签是英文」的半吊子状态。

支持的语言不受内置表限制，法语韩语西班牙语都能出完整报告。

### Step 1 — 定位输入

用户给文件路径就直接用。直接粘正文的，**先落到一个临时 .txt**——后面校验「引文是否逐字」要拿原文比对，没有原文文件这步就没法做。

确定输出目录：用户指定就用；没指定就用原书同级目录。

**有 `outline.json`（novel-outline 的产出）就一起要过来，走 seed**——大纲是角色设定的上游，它的 `characters` 块已经定死了角色清单：

```bash
node {baseDir}/scripts/novel-characters.mjs seed <outline.json> > <workdir>/seed.json
```

搬过来的是大纲已经拍板的事实，留空的是这一层才该做的设计：

| outline 的字段 | seed 之后 |
| --- | --- |
| `id` | 原样保留成角色码——下游 script / storyboard 用它引用角色 |
| `name` | 角色表就照这份，**不再自己判断谁该进** |
| `tier` | 映射成 `importance`：`lead` → `protagonist`、`support` → `supporting`、`functional` → `minor` |
| `arc` | 直接落进 `persona.arc` |
| `role` / `from` | 进 `seedNote`——定位（女主 / 反派）与「由原著的谁合并而来」，扫原文时知道该收哪几条线的戏 |

留空待填：`aliases`（要读原文才知道）、`oneLiner`、`persona` 其余各项、`image`、`voice`。**seed 出来的是骨架不是成品**，直接跑 `validate` 会报一堆字段缺失，那是预期的——后面 Step 2–6 就是来填它的。

两处口径要守住：

- **大纲定的分档不要推翻**。谁重要是改编阶段拍板的事，这一层只负责把定下来的人做深。真觉得分档不对，回去改大纲，别在这里悄悄改一个不一样的
- **主角组内部可以细分**。outline 的 `lead` 是「男女主 + 主反派」一整组，对应 `protagonist` 与 `major` 两档，seed 一律给 `protagonist`；照 `seedNote` 里的定位把主角之外的改成 `major`，这不算推翻分档

**没有 `outline.json` 也照常跑**，本 skill 不依赖它——跳过 seed，从 Step 2 开始自己从原文拆角色表。

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

### Step 4 — 归并 + 复核

```bash
node {baseDir}/scripts/novel-characters.mjs merge <workdir> | tee <workdir>/merged.json
```

落到 `merged.json` 不只是留档：Step 6 的 assemble 靠它拿同档角色的戏份顺序。

按名字+别名精确收敛（某块把「陆」列成「陆行远」的别名，两条就并成一个人），notes 累加、quotes 去重，按出现块数降序——出现的块越多戏份越重。

输出是 `{ "characters": [...], "mergeCandidates": [...] }`。**`mergeCandidates` 要逐条复核**：精确匹配只能收敛两块恰好写了相同称呼的情况，剩下的是语义判断，脚本做不了。候选来自名字包含关系（`「陆」⊂「陆行远」`）——是强信号不是判决，同姓的父子、兄弟就不能合。候选之外你自己看出来的同人（「陆先生」和「行远」没有包含关系，不会进候选）也要合。

要合并就写一份 merges.json 再落地：

```json
{ "merges": [{ "keep": "陆行远", "absorb": ["陆", "陆先生"] }] }
```

```bash
node {baseDir}/scripts/novel-characters.mjs merge <workdir> --apply merges.json | tee <workdir>/merged.json
```

`keep`/`absorb` 用名字或任一别名定位都行，找不到会直接报错。输出仍带 `mergeCandidates`，剩下的都确认是不同的人（或清空）再进下一步。没有要合的就直接往下走——但 `merged.json` 必须留着。

### Step 5 — 选角

取前 N 位。默认 30，用户说了就听用户的。剩下的角色在最后汇报里提一句「还识别出 X 位没做画像」。

### Step 6 — 第二趟出卡

每个角色一份，同样能并发就并发。

每份任务拿到：
- `{baseDir}/references/profile-pass.md` 和 `{baseDir}/references/schema.md`（读它们，照着做）
- **报告语言 `lang`**（Step 0 定的）
- 该角色归并后的 `name` / `aliases` / `notes` / `quotes`
- **同批其他角色的名字**（避免长相声线撞车）

按 `profile-pass.md` 完成身份—外观语义自检后再交卡：人物档案、形象提示词、本地译文与设定图主体不能各说一种身份。大纲决定名单和改编取舍，原文观察补足外形依据；不要只给大纲而跳过 Step 2–4 的原文扫描。

角色卡 JSON 写到 `<workdir>/card-<slug>.json`。**断点续跑**：`card-<slug>.json` 已存在的角色不必重跑。

**同时写一段故事摘要**：用 `lang` 指定的语言，3–5 句，交代时空背景、核心情境、这几个人聚在一起的由头。短篇直接从原文写；长篇从各块的 roster note 归纳。不剧透结局，不写成推荐语。写到 `<workdir>/summary.txt`。非内置语言的话，把 Step 0 翻好的 ui 整块存成 `<workdir>/ui.json`。

然后合成 cast.json——**用 assemble，不要手拼**（手拼会丢字段、写错顶层键）：

```bash
node {baseDir}/scripts/novel-characters.mjs assemble <workdir> \
  --source <书名> --lang <lang> \
  --out <输出目录>/<书名>-cast.json
```

坏卡会被逐个点名——哪份 `card-*.json` 坏了就只重跑那个角色，其他不用动。

同档角色的先后是戏份顺序，来自 Step 4 留下的 `<workdir>/merged.json`（assemble 自动读，也可用 `--order` 指别的文件）。报告左栏「按戏份排序」的序号就靠它——看到「同档角色将按文件名序」的警告说明 merged.json 丢了，回 Step 4 重新生成。

### Step 7 — 校验 ⛔ 不能跳

```bash
node {baseDir}/scripts/novel-characters.mjs validate <cast.json> <book.txt>
```

记得带上 `--lang`（Step 0 定的）。检查：结构、`importance` 枚举、**引文逐字**、**出图提示词不含人名**、**语言分工**（人类字段跟随 `lang`、出图/TTS 提示词永远英文）、以及**非内置语言必须带 `ui`**。

**有违规就按报错逐条修，改完重跑，直到通过。** 这四类错模型真的会犯——这套检查就是被真实输出打出来的。

### Step 8 — 输出

```bash
cd <输出目录>
node {baseDir}/scripts/novel-characters.mjs render <cast.json> --md   > <书名>-cast.md
node {baseDir}/scripts/novel-characters.mjs render <cast.json> --html > report.html
```

语言取 `cast.json` 里的 `lang`，要临时覆盖就加 `--lang <code>`。

`render` 默认去 cast.json 同级的 `images/` 找两类图，图在别处就用 `--images <目录>` 指过去（任意路径）：

| 文件 | 用在报告哪里 | 找不到时 |
| --- | --- | --- |
| `<slug>-avatar.png`（1:1） | 左列 76×76 缩略图，整张铺满 | 回退成从 sheet 左栏切片，会切到肩膀 |
| `<slug>-sheet.png`（16:9） | 右侧大图（外形设定） | 留空占位 |

**脚本不产生这些文件**——出完图重跑一次 render 就能把图嵌进报告。

report.html 的样式约定见 `{baseDir}/references/report-style.md`——要改样式先读它，别把它改回通用卡片墙。

最终落地：

```
<输出目录>/
├── <书名>-cast.json
├── <书名>-cast.md
├── report.html                    ← 双击就能开
└── images/                        ← 脚本不写这个目录
    ├── <slug>-bust.png            ← 竖版半身像，打样与锁脸用，不进报告
    ├── <slug>-sheet.png           ← 16:9 版面，报告右侧大图
    └── <slug>-avatar.png          ← 1:1 头像，报告左列缩略图
```

### Step 9 — 出图（环境有出图能力时才做）

照 `{baseDir}/references/asset-recipe.md` 走，要点只有三条：

1. **按集出，不要一次铺全剧**——只出这一集要用的角色，风格在第 5 个人才定型的话，前面全废
2. **顺序是 bust → sheet → avatar**，后两张都拿 bust 当参考图（`input_fidelity: high`）锁脸；`sheet` 的提示词直接用 cast.json 的 `image.sheet`，不要自己重写
3. 出完逐张看（一人一脸、手指、有没有切到脸），去水印，再重跑 `render --images <目录>`，数一下 `<img>` 数量和角色数对不对得上

头像三条硬指标：**脸占画面 62%、头顶留边、下巴不进底边**——少一条就成半身像或被切头。

### Step 10 — 汇报

一句话说清：角色数、报告路径、出了几张图。校验一次没过的话，说明修了什么。原文被截断要明确说清楚。

**没真出图就不要说「已出图」**——交付的是提示词和挂图清单，出没出按实际说。

---

## 边界

- 单次上限 24 块（净覆盖约 93 万字符），超了会明确报 `truncated`，不静默截断
- 人类可读字段跟随 `--lang`（默认中文）；出图和 TTS 提示词**永远英文**，那些引擎吃英文最稳
- **脚本不出图。**出图配方在 `references/asset-recipe.md`；`image.sheet` 是版面指令，版面最容易崩的几处（一张图两个长相、
  为了塞细节把人物压扁、左栏收口）靠提示词里写死的几句压住，见 `references/sheet.md`
- 想要能实时编辑、边跑边看的交互界面，那是另一个东西，不在这个 skill 里

## 自测

```bash
node {baseDir}/scripts/selftest.mjs
```

329 项断言，不调模型、不花额度，覆盖分块 / 归并 / 合成 / 多语言 / 校验 / 渲染的全部确定性逻辑。改完脚本先跑这个。

## 自带样例

`{baseDir}/examples/渡口.txt` 是一篇短故事，4 个角色，其中货郎全程只有绰号、船夫只被叫过「老伯」——专门用来验别名归并。对应产出 `渡口-cast.json` / `渡口-cast.md` 可以当质量基准，也是校验的自检夹具。
