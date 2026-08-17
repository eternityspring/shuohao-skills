---
name: shot-recipes
version: 1.0.0
description: |
  AI 视频的镜头语汇卡库，两族卡：配方卡回答「这场戏这一刀该怎么切」（对话、情绪、揭示、进场、
  反应、转场、强调、产品展示、口播九个类目）；技法卡回答「这个手段是什么、什么时候用、
  什么时候别用」（运镜、机位角度、景别、构图、焦段与景深、光线、特殊技巧七个类目，
  20 个 H3 官方运镜词全覆盖）。短剧之外也能用（产品宣传、口播、Vlog）。
  卡片中英双版；CLI 支持 list / show / search / lint / check / render（单页画廊报告，含类目 ×
  能量矩阵、技法覆盖表与必备短语索引）。
  每张卡声明必备短语，可以被机器复核：check 吃任意带 recipe 与 frame 字段的分镜 JSON；
  novel-storyboard 也可以通过 --shots 可选挂载这套卡库。技法卡的完整性也是门——域里少一项 lint 就点名。
  零依赖、零 API key。
  Use when asked to 镜头语言、运镜、机位角度、构图、光线、景别、分镜怎么切、
  shot vocabulary / camera movement / camera angle for AI video。
allowed-tools:
  - Read
  - Write
  - Bash
  - Glob
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18，只用标准库，无 npm 依赖
    optional:
      - codex         # 有才出示例帧；没有就只交文字，其余照常
  runtimes:
    - claude-code
    - codex
---

## shot-recipes

**AI 生成式视频的镜头语汇库。** 前提刻在骨子里：这是生成式视频（MiniMax H3 / 可灵）不是程序化渲染——同一个位置，程序化那边写帧数与缓动曲线，我们写**提示词怎么写、参考图怎么挂、切几格、AI 会在哪崩**。

它补的是这一层空缺：

| 层 | 谁在管 | 问题 |
| --- | --- | --- |
| 词汇层 | 景别枚举 + H3 官方运镜词 | 是原子词，不是配方——模型自由组合，没有「这一刀该怎么切」的知识 |
| **配方层 + 技法层** | **本 skill** | **命名的镜头语汇：意图 / 适用场景 + 提示词骨架 + 参数 + 已知坑，还能被机器复核** |
| 手感层 | 各管线 skill 的切镜手册 | 口头经验，用没用、用对没用无从检查 |

**两族卡**，`kind` 字段区分，各有各的类目表与正文六节：

| 族 | 回答什么问题 | 类目 |
| --- | --- | --- |
| **配方卡** `recipe` | 这场戏这一刀该怎么切 | 对话 / 情绪 / 揭示 / 进场 / 反应 / 转场 / 强调 / 产品展示 / 口播 |
| **技法卡** `technique` | 这个手段是什么、**什么时候用、什么时候别用** | 运镜 / 机位角度 / 景别 / 构图 / 焦段与景深 / 光线 / 特殊技巧 |

**技法卡的完整性是门**：每个技法类目有一个域（运镜域就是 20 个 H3 官方词），每张卡用 `covers` 认领它讲掉的项，域里少一项 `lint` 就点名——「覆盖全了」是查出来的，不是说出来的。

`{baseDir}` = 本文件所在目录。脚本 `{baseDir}/scripts/shot-recipes.mjs`，零依赖，`node` 直接跑。

**自包含**：不依赖任何别的 skill——卡片正文不引用外部文档，出图契约 / 写卡纪律 / 报告约定都在自带的 `references/` 里，展示数据与示例帧也是这个 skill 自己的（`examples/vocab-reel.json`）。**整个目录拷走就能用**。用法五讲的与 `novel-storyboard` 的挂载是**可选集成**，不用它照样跑。

**边界（不做的事）**：不写剧本、不排分镜结构、不出视频。它只提供语汇与检查——**配方只描述官方词表描述不了的东西**（前景肩、浅景深、手持质感、材质轮廓、光比差）；景别与运镜词各自已经有门在管，卡片不重复设门。

---

### 用法一：查卡（最常用）

```bash
node {baseDir}/scripts/shot-recipes.mjs list                     # 索引表（两族都列）
node {baseDir}/scripts/shot-recipes.mjs list --kind technique    # 只看技法卡
node {baseDir}/scripts/shot-recipes.mjs list --kind recipe       # 只看配方卡
node {baseDir}/scripts/shot-recipes.mjs list --for product       # 按题材筛
node {baseDir}/scripts/shot-recipes.mjs list --category camera-move
node {baseDir}/scripts/shot-recipes.mjs search 正反打            # 搜卡（正文也搜）
node {baseDir}/scripts/shot-recipes.mjs show ots-shot-reverse   # 打印整张卡
node {baseDir}/scripts/shot-recipes.mjs show ots-shot-reverse --lang en
```

给用户切镜、写提示词之前，**先 `list` 挑卡、再 `show` 读全文**，照卡片的「提示词骨架」写这一格的分镜图提示词——骨架里的必备短语一条都不能少。

### 用法二：出画廊报告

```bash
node {baseDir}/scripts/shot-recipes.mjs render --html > {baseDir}/references/cards/gallery.html
node {baseDir}/scripts/shot-recipes.mjs render --html --lang en > {baseDir}/references/cards/gallery-en.html
node {baseDir}/scripts/shot-recipes.mjs render --html --check <storyboard.json> > {baseDir}/references/cards/gallery.html
```

**报告要写进 `{baseDir}/references/cards/`**——示例帧走相对路径 `frames/…`，写到别处图就不显示了。

单页、零外部依赖、双击就能开。含类目 × 能量矩阵（**空格子就是语汇缺口**）、配方卡墙、**技法覆盖表**（域逐项摊开，**灰掉画斜纹的就是还没有人讲的那一项**）、技法卡墙、必备短语索引（撞车一眼可见），给了 `--check` 还会列出**从没被使用的卡**。

### 用法三：检查分镜里的配方引用

```bash
node {baseDir}/scripts/shot-recipes.mjs check <storyboard.json>
```

深度遍历任意 JSON，收集**同时带 `recipe` 与 `frame` 的对象**，JSON 路径当定位符——所以它吃任何分镜结构，不绑定某个 skill。检查两条：配方 id 在库里、卡片的必备短语出现在该格的 `frame` 里。遇到中文提示词跳过并计数（`跳过 K 个非英文提示词`），不静默也不误报一片。

### 用法四：写新卡

读 `{baseDir}/references/card-schema.md`（字段结构与不变量）和 `{baseDir}/references/card-pass.md`（写卡纪律），写完跑：

```bash
node {baseDir}/scripts/shot-recipes.mjs lint
```

**加新卡的门槛不在格式上**：`## 示例` 节必须举得出一个真实做过的分镜片段或真的生成过的示例帧——举不出来的不是配方，是想法。

### 用法五：给 novel-storyboard 挂上（可选）

```bash
node <novel-storyboard>/scripts/novel-storyboard.mjs validate <storyboard.json> \
  --script <script.json> --shots {baseDir}/references/cards
```

分镜的 cut 上写 `"recipe": "<卡片 id>"`，`--shots` 指到卡库目录，那边的门就会查配方存在与必备短语落地。**不给 `--shots` 就明说跳过**——两个 skill 各自独立，谁没有谁都能跑。

---

## 卡片长什么样

frontmatter 是机器字段（族、类目、题材、能量、秒数、格数、建议景别与运镜、**必备短语**、示例帧，技法卡另有 `covers`），正文六节固定，**两族各一套**：

- **配方卡**：`意图` → `提示词骨架` → `参数表`（四列，含「调节手感」）→ `参考图约束` → `已知坑`（三列：病 / 症状 / 治法）→ `示例`
- **技法卡**：`这是什么` → **`适用场景`** → `提示词怎么写` → `参数表` → `已知坑` → `示例`

**技法卡的「适用场景」必须写「什么时候别用」，这是门**——只写什么时候用，读卡的人一定会滥用它。这一节排在提示词前面也是同一个理由：手段本身没有「什么时候用」就是废知识。

**必备短语是全库唯一被机器强制的东西**，六条硬约束：≤ 3 条、全小写、必须含空格或连字符且长度 ≥ 6、不许撞 20 个 H3 运镜词与 5 个景别短语、必须原样单行出现在本卡的提示词骨架里、必须配一条中文释义。第 4 条推出这个库的存在理由——配方只说词表说不了的；第 5 条保证骨架抄下来就能直接过 `check`；第 6 条让中文读者读得懂这张全英文的表。

双语的组织：**机器字段只有一份**（`cards/<id>.md` 的 frontmatter，语言中立），正文分语言（中文同文件、英文在 `cards/en/<id>.md`）。门永远只读一份机器字段，不存在双语漂移。

## 出示例帧（可选）

读 `{baseDir}/references/frame.md`。没有 codex 就整步跳过，卡片显示「示例帧未生成」占位——不装有。

## 自测

```bash
node {baseDir}/scripts/selftest.mjs
```

不调模型、不花额度。**lint 的每条规则都有击穿用例**，改完脚本先跑这个。

## 来源说明

卡片的**格式**（一句话 / 适用 / 意图 / 参数表带「调节手感」列 / 已知坑）学自 MiniMax 生态外的开源项目 video-shotcraft（Remotion 程序化渲染方向）。**内容全部是本仓库自己的生成式实践**：它的参数是帧数与缓动曲线，我们的参数是秒数、格数、虚化强度与参考图挂载。方法论内化在本 skill 自带的 references 里，**不依赖任何外部 skill**。
