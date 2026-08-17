**中文** · [English](README.en.md)

# novel-characters

丢一本小说或一篇短故事进去，输出每个角色的完整设定：

- **角色表** — 谁出场了，主角还是龙套，跨章节的不同称呼归并到同一个人
- **人物画像** — 性别、年龄、身份、外貌、性情、动机、人物弧光、关系网，每条附**原文逐字引文**
- **形象提示词** — 半写实厚涂路线，双语出图 prompt + negative prompt + 风格标签，直接喂 Midjourney / SD / GPT-Image
- **音色提示词** — 音色、音高、语速、口音、情绪，双语 voice-design prompt，直接喂 Qwen3-TTS / ElevenLabs Voice Design
- **角色设定图** — **每个角色一张**：16:9 分三区，左侧约 34% 证件照式半身像（面部基准）、右上全身三视图、右下关键细节特写条。**画风可选**：默认半写实厚涂，也可以出吉卜力动画风。白底方便抠图，走 codex 内置出图（可选）
- **关系图谱** — 报告里的一个全景视图：谁跟谁有关系、是什么关系，一眼看完。悬停一个人亮出他的全部关系，点一下跳到那个人的详情

产出 `cast.json` + Markdown + 一个双击就能开的 `report.html`。

**报告语言可指定**，默认中文：

```
/novel-characters ./book.txt --lang en
/novel-characters ./book.txt --lang ja
```

内置 **中文 / English / 日本語** 三套界面文案。**其他语言一样支持**——skill 会现场把界面文案翻译成目标语言，存进 `cast.json` 的 `ui` 字段，渲染时合并进去。所以法语、韩语、西班牙语都能出完整报告，不会露出英文界面。

想自己准备翻译：

```bash
node scripts/novel-characters.mjs ui-template fr   # 打印待翻译的骨架
```

![report.html](assets/report.webp)

角色设定图（自带样例《渡口》的沈知微）：

![角色设定图](assets/sheet.jpg)

## 使用

安装见[仓库根 README](../../README.md)。装好后：

```
/novel-characters ./你的小说.txt
```

或者直接说「帮我拆一下这本书的角色」并给出路径。

### 报告语言

默认中文。用 `--lang`，或者直接说「用英文」「日本語で」：

```
/novel-characters ./book.txt --lang en
/novel-characters ./book.txt --lang ja
```

内置 **中文 / English / 日本語** 三套界面文案。**其他语言一样支持**——skill 会现场把界面文案翻译成目标语言，存进 `cast.json` 的 `ui` 字段，渲染时合并。法语、韩语、西班牙语都能出完整报告，不会露出英文界面。

两条不跟随语言：**出图和 TTS 提示词永远英文**（引擎吃英文最稳）；**原文引文永远保持原文语言**（翻译了就不是证据了）。

### 出图风格

默认 `realistic`（半写实厚涂）。想要动画质感：

```
/novel-characters ./book.txt --style ghibli
```

| id | 说明 |
| --- | --- |
| `realistic` | 半写实厚涂，皮肤有毛孔和肌理，布料有织纹磨损。默认 |
| `ghibli` | 吉卜力式手绘赛璐璐，等宽墨线、单层柔和阴影、平涂色块 |

两个可以组合：`--lang ja --style ghibli`。

```bash
node scripts/novel-characters.mjs styles          # 看所有预设
node scripts/novel-characters.mjs styles ghibli   # 看某一个的完整内容
```

**换风格是整套换**，不是只换一句画风——每个预设自带渲染方式、表面处理、光照、反向提示词、标签五块。详见 [`references/style-presets.md`](references/style-presets.md)。

## 报告长什么样

三栏工作台：顶栏搜索，左栏是故事摘要 + 按戏份排的角色列表，主区一次只看一个角色。

**关系图谱**在左栏顶部，跟角色详情互斥。边直接来自每个角色的 `relationships`，不用模型再跑一趟：

- 按**名字 + 别名**连边——老周的关系里写「老伯」也连到同一个节点
- 同一对人的两条单向记述合并成一条边，两个方向的说法都留着
- 弦上标一段关系文字（截到 6 字，全文在悬停提示和右侧关系表里）。边多了会糊，
  ≤ 14 条默认标出来，再多默认收起，顶部有开关
- 悬停一个人亮出他的全部关系线，悬停关系表某一行只亮那一条，点谁跳谁

圆环布局在 Node 里算好直接写进内联 SVG，**不引任何库**——report.html 始终是一个能离线双击打开的单文件。

### 导出 JSON

顶栏的「导出 JSON」下载的**就是 `cast.json` 本身的形状**，不是另一套导出格式：

```json
{ "source": "…", "lang": "zh", "style": "realistic", "summary": "…", "characters": [ … ] }
```

所以外部工具改完可以**直接喂回 `render` 重新出报告**，也能过 `validate`。角色卡里的 `sheetImage`（`images/<slug>-sheet.png`）一并带出，拿得到哪张图对应哪个人。

数据以 `<script type="application/json">` 内嵌在报告里，点导出只是把它包成 Blob 下载，**不发任何网络请求**。

## 它是怎么工作的

长文本一次性塞进上下文会丢角色，所以拆成两趟：

**第一趟 · 扫描**（便宜）
按段落切成 4 万字符的重叠块，每块并发抽「角色名 + 别名 + 该块里的具体描写 + 逐字引文」。重叠是为了让卡在切口上的角色两边都能看见。

**归并**
按名字和别名建索引，`陆行远` / `陆` / `姑娘` 这类跨块的不同叫法收敛成同一个人。精确匹配管不到的（「陆」和「陆行远」没有共同键），脚本会按名字包含关系列成 `mergeCandidates` 疑似同人候选，由模型复核后写成 merges.json 确定性落地合并。按出现块数当戏份权重排序。

**第二趟 · 出卡**
只对戏份最重的 N 位（**默认 30**），把归并后的全部描写喂进去，一次生成完整角色卡。同批角色互相知道对方的名字，避免长相和声线撞车。族裔、年代、地域从原文推断后写死进出图提示词——**不跟报告语言走**，报告出成日文不会把民国的老船夫画成日本人。

**校验**（这步不能跳）
四类硬规则，全部由脚本确定性检查，不靠模型自觉：

| 规则 | 为什么 |
| --- | --- |
| `evidence` 必须是原文**逐字连续**片段 | 防编造。被「他说」断开的对白不许拼接 |
| 出图 prompt **不许出现人名** | 图像模型对人名偏见极重，会画成它记忆里的角色 |
| 字段**语言分工** | 人类字段跟随 `--lang`、出图和 TTS 提示词永远英文，模型会漂 |
| **风格与反向提示词匹配** | `realistic` 不能禁 `photorealistic`、`ghibli` 必须禁，搞反整批图就废 |
| 结构 + 枚举 | `importance` 只能是那四个值 |

这四条不是拍脑袋定的——是模型输出真的违反过、被校验脚本当场抓住才立起来的。

## 命令行直接用

脚本本身不需要 agent 也能跑，只有两趟模型调用需要：

```bash
node scripts/novel-characters.mjs chunk book.txt /tmp/wk        # 切块
node scripts/novel-characters.mjs merge /tmp/wk                 # 归并 roster-*.json，附疑似同人候选
node scripts/novel-characters.mjs merge /tmp/wk --apply m.json   # 落地复核后的合并
node scripts/novel-characters.mjs assemble /tmp/wk --source 书名 # card-*.json 合成 cast.json，同档按戏份排序
node scripts/novel-characters.mjs validate cast.json book.txt   # 校验
node scripts/novel-characters.mjs render cast.json --html       # 出 report.html
node scripts/novel-characters.mjs slug "胡二爷"                  # 安全文件名
```

## 边界

- 单次上限 24 块（净覆盖约 93 万字符）。超了会明确报 `truncated`，**不静默截断**
- 人类可读字段跟随 `--lang`；出图和 TTS 提示词**永远英文**，那些引擎吃英文最稳，跟报告语言无关
- 默认取戏份最重的 30 位角色，**每位都出设定图**——一个角色一次调用，所以角色多的时候这步最花时间。想少出就直接给个数，或者说只要主要角色
- **同一批角色的画风可能有差异**——各自独立出图。早期用「扁平矢量卡通」时漂得很厉害（同批出成动画感／半写实／水墨写实三种），换成明确的风格预设后好了很多，但不能保证完全一致。在意的话拿第一张当参考图压一压，见 `references/sheet.md`

> ⚠️ **机器上装了多个 codex 要注意版本。** 旧版本会直接报 `requires a newer version of Codex` 而不是降级。skill 里带了自动挑最高版本的探测逻辑，整体太旧就 `npm i -g @openai/codex`。

## 文件

```
SKILL.md                 给 agent 读的工作流
scripts/
  novel-characters.mjs   chunk / merge / assemble / validate / render / slug
  selftest.mjs           316 项断言，不调模型
references/
  roster-pass.md         第一趟：扫描角色
  profile-pass.md        第二趟：生成角色卡（8 条硬规则）
  schema.md              角色卡结构 + 字段语言归属
  sheet.md               角色设定图出图的 codex 调用契约
  report-style.md        report.html 的设计约定
  style-presets.md       出图风格预设（realistic / ghibli）
examples/
  渡口.txt                自带短故事，4 个角色
  渡口-cast.json          产出，同时是校验自检夹具
  渡口-cast.md            渲染结果，质量基准
```

`examples/渡口.txt` 里货郎全程只有绰号、船夫只被叫过「老伯」——专门用来验别名归并。

## 自测

```bash
node scripts/selftest.mjs
```

316 项断言，覆盖分块 / 别名归并 / 合成 / 多语言 / 校验 / 渲染。不调模型、不花额度、1 秒跑完。改完脚本先跑这个。

**只在 macOS + Node 24 上实测过。** 代码没有平台相关调用，Linux 和更低版本 Node 理论上没问题，但**没验过**。
