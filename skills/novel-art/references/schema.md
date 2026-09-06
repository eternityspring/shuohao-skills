# art.json 结构

美术设定集（场景 + 叙事道具）的载体。**模型只填设计字段**，场景与道具的出现集、承载爽点都由 `seed` 从 outline.json 搬运；大纲没有 `props` 时道具表留空，由模型按 `prop-pass.md` 从原文提取。Markdown 和报告由 `render` 渲染。

```json
{
  "source": "渡口",
  "style": "realistic",
  "scenes": [{
    "id": "S01", "name": "渡船船舱", "primary": true,
    "summary": "设计意图：这个空间讲什么故事……",
    "anchors": [{ "name": "补丁船篷", "desc": "……" }],
    "lighting": [{ "state": "晨雾", "prompt": "dense white morning fog ..." }],
    "image": { "prompt": "…", "negativePrompt": "…", "sheet": "…", "tags": [] },
    "variantOf": "S02", "changes": "换背板 + 芦苇前景",
    "usage": { "episodes": [1, 6], "beats": ["悬念钩"] }
  }],
  "props": [{
    "id": "P01", "name": "旧皮箱", "scale": "手持级",
    "summary": "戏剧功能：全剧悬念核心……",
    "anchors": [{ "name": "绿锈铜扣", "desc": "……" }],
    "states": [{ "state": "合上", "prompt": "the suitcase closed ..." }],
    "relatedScenes": ["S01"], "carriedBy": ["沈知微"],
    "image": { "prompt": "…", "negativePrompt": "…", "sheet": "…", "tags": [] },
    "usage": { "episodes": [1, 6], "beats": ["悬念钩"] }
  }]
}
```

## 顶层

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `source` | 是 | 剧名/书名 |
| `style` | 是 | `realistic` / `ghibli` / `cel90`，与 novel-characters 的画风同名对齐（内容是环境版，不带皮肤毛孔那套） |
| `scenes` | 是 | 场景数组 |
| `props` | 否 | **叙事道具**数组——只收有特写、跨集、承载剧情的（3–8 件为宜），场景陈设归场景锚点。选法见 `prop-pass.md` |

## 单个场景（以校验器为准）

| 字段 | 必填 | 语言 | 说明 |
| --- | --- | --- | --- |
| `id` | 是 | — | `S01` 格式，全局唯一。用 seed 时沿用 outline 的场景 id |
| `name` | 是 | 中文 | 场景名 |
| `primary` | 是 | — | 是不是主场景 |
| `summary` | 是 | 中文 | **设计意图**：这个空间讲什么故事、要什么感觉，不是户型说明 |
| `anchors` | 3–5 个 | 中文 | **一致性锚点** `{name, desc}`：每次生成都必须出现的可辨识特征。认场景靠它，QC 生成镜头也靠它 |
| `lighting` | ≥1 个 | state 中文 / prompt 英文 | **光照状态**：AI 换时段是重新生成不是重新打灯，每个状态必须落成完整提示词 |
| `image.prompt` | 是 | **英文** | 主视角单图提示词，**必须写明空景无人** |
| `image.negativePrompt` | 是 | **英文** | **必须禁人**（people/figure/…），这是空景的硬保证 |
| `image.sheet` | 是 | **英文** | 环境设定图完整版面指令（见 `sheet.md`），必须整段包含当前风格的渲染句 |
| `image.tags` | 是 | 英文 | 风格标签数组 |
| `variantOf` | 否 | — | 变体的母场景 id。AI 生成一个新景很便宜，但**变体复用母场景资产更一致**——outline 里带 reusePlan 的场景优先做成变体 |
| `changes` | variantOf 时必填 | 中文 | 相对母场景改了什么（换时段/换天气/换前景/删道具） |
| `usage` | 否 | — | `{episodes, beats}`，seed 自动填，手写也行 |

## 单件道具（以校验器为准）

| 字段 | 必填 | 语言 | 说明 |
| --- | --- | --- | --- |
| `id` | 是 | — | `P01` 格式，全局唯一 |
| `name` | 是 | 中文 | 道具名 |
| `scale` | 是 | 枚举 | `手持级` / `桌面级` / `家具级`，对应英文短语必须出现在提示词里 |
| `summary` | 是 | 中文 | **戏剧功能**：这件道具承载什么剧情 |
| `anchors` | 3–5 个 | 中文 | 经得起特写的细节特征（铜扣的新划痕、墨池的月牙磨痕） |
| `states` | ≥1 个 | state 中文 / prompt 英文 | **状态变体**：合上/打开、藏着/摊开——每个状态一张参考 |
| `relatedScenes` | 否 | — | 主要出现的场景 id，必须存在 |
| `carriedBy` | 否 | 中文 | 谁带着它，自由文本 |
| `image.prompt` | 是 | **英文** | 白底主视角，**必须带尺度短语、无人无手** |
| `image.negativePrompt` | 是 | **英文** | **必须禁人且禁手**（hands/fingers） |
| `image.sheet` | 是 | **英文** | 设定图版面指令，**必须写明 pure white background** + 当前风格渲染句 |
| `usage` | 否 | — | `{episodes, beats}` |

## 硬规则（11 道质量门，全是代码）

1. 锚点 3–5 个——少了认不出，多了核对不过来
2. 光照状态 ≥1 且都有英文提示词
3. **空景**：反向提示词必须禁人。环境和角色是两层资产，混在一张图里一致性全毁
4. 出图提示词（主图/反向/设定图/光照）全部英文
5. 提示词不含角色名（`validate --cast cast.json` 才查，不给就明说跳过）
6. 变体引用完整：`variantOf` 指向存在的场景且带 `changes`
7. 风格与反向词匹配：`realistic` 不禁 photorealistic、`ghibli` / `cel90` 必须禁；`sheet` 必须含渲染句

道具专属四道：

8. 状态 ≥1 且都有英文提示词
9. 尺度参照写进提示词（scale 枚举对应的英文短语）
10. 反向提示词禁手——拿着道具的手是最常见污染
11. 设定图纯白背景可抠

## 校验

```bash
node scripts/novel-art.mjs validate art.json --cast cast.json
node scripts/novel-art.mjs checkup art.json               # 只打印 11 道门 ✓/✗
```
