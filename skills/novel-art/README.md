**中文** · [English](README.en.md)

# novel-art

给 AI 短剧出**美术设定集**：场景 + 叙事道具。前提刻在骨子里：**这是 AI 生成，不是实拍**——没有堪景、搭景、置景采买，环境和道具都是要被生成几十次还得长一样的资产。交付物不是置景清单，是一致性方案。

**场景层**：

- **设计意图** — 这个空间为哪场戏存在，不是户型说明
- **一致性锚点**（每景 3–5 个） — 每次生成必现的可辨识特征（补丁船篷、断裂的第七块桥板）。观众靠它认场景，QC 靠它核对生成镜头有没有漂
- **光照时段变体** — AI 换时段是**重新生成不是重新打灯**，每个状态落成完整英文提示词
- **变体机制** — `variantOf` + `changes` 把衍生场景挂在母场景上，出图拿母场景成图当参考

**道具层**（只收**叙事道具**：有特写、跨集、承载剧情，通常 3–8 件）：

- **戏剧功能** — 皮箱是全剧悬念、旧砚是爆点实体——先说它在剧里干什么
- **状态变体** — 合上/打开、藏着/摊开：道具有状态弧，每个状态一张参考图
- **尺度参照** — 手持级/桌面级/家具级，英文短语写死进提示词——AI 把手持道具画成家具尺寸是高频事故
- **白底无手** — 道具图要被贴进各种镜头，必须纯白可抠；拿着道具的手是最常见污染

场景陈设归场景锚点、一次性手部道具镜头级提示词解决——都不单独建资产。

产出 `art.json` + Markdown + 一个双击就能开的 `art-report.html`。报告界面默认中文；render 加 `--lang en` 输出全英文界面（或在 art.json 顶层写 `"lang": "en"`，`--lang` 优先）： 英文界面下质量门标签同样翻译（阈值原样），门的失败详情与数据内容保持原文。

![art-report.html](assets/report.webp)

## 质量门：11 道，全是代码

与仓库里另外两个 skill 同一主张：**checklist 交给模型自觉是靠不住的**。

| 门 | 规则 |
| --- | --- |
| 一致性锚点 | 3–5 个（场景与道具同规） |
| 光照状态 | 每景 ≥1 且落成英文提示词 |
| **无人** | 反向提示词禁人（场景与道具都查） |
| 提示词语言 | 全部英文 |
| 提示词不含角色名 | `validate --cast cast.json` 才查；不给就**明说跳过** |
| 变体引用完整 | `variantOf` 指向存在的场景且带 `changes` |
| 风格与反向词匹配 | `realistic` 不禁 photorealistic、`ghibli` / `cel90` 必须禁 |
| **道具状态** | ≥1 且落成英文提示词 |
| **道具尺度** | scale 枚举对应的英文短语必须出现在提示词里 |
| **道具无手** | 反向提示词禁 hands/fingers |
| **道具白底** | 设定图必须 pure white background |

自测里每道门都有**击穿用例**——证明它真的会拦。

## 跟另外两个 skill 的接力

```
novel-outline    → outline.json （什么：结构与分集）
novel-characters → cast.json    （谁：角色资产）
novel-art        → art.json     （哪里 + 手里拿的：美术资产）
```

- `seed <outline.json>` 确定性预填场景与道具两张清单，连出现集、承载爽点一起搬；大纲没有 `props` 时道具留空，模型按 `prop-pass.md` 从原文提取
- `validate --cast <cast.json>` 用角色表查提示词里有没有混进角色名
- 画风预设与 novel-characters **同名对齐**（realistic / ghibli / cel90）但内容是环境版——真实感来自用旧的材质，不是皮肤毛孔

## 命令行直接用

```bash
node scripts/novel-art.mjs seed outline.json > art.json      # 从大纲预填场景骨架
node scripts/novel-art.mjs validate art.json --cast cast.json
node scripts/novel-art.mjs checkup art.json                  # 只跑质量门
node scripts/novel-art.mjs render art.json --html            # 出报告（界面默认中文）
node scripts/novel-art.mjs render art.json --html --lang en  # 英文界面报告
node scripts/novel-art.mjs styles                            # 看画风预设
```

## 出图（可选）

走 codex 内置 `$imagegen`，零 API key。场景和道具各一张 16:9 设定图，版面都是**主视角大图 + 底部和右侧的 L 形细节边框**：场景细节格放锚点特写，道具细节格放锚点特写 + 其他状态 + 侧面。场景**无人**；道具另加**无手、纯白背景**。变体场景拿母场景成图当参考图。没有 codex 就只交提示词，其余照常。调用契约见 `references/sheet.md`。

## 文件

```
SKILL.md                 给 agent 读的工作流
scripts/
  novel-art.mjs          seed / validate / checkup / render / styles / slug
  selftest.mjs           158 项断言，不调模型
references/
  schema.md              art.json 结构 + 硬规则
  scene-pass.md          怎么填场景设定（AI 短剧的思路）
  prop-pass.md           怎么选、怎么填叙事道具
  sheet.md               设定图出图的 codex 调用契约
  report-style.md        报告的设计约定
examples/
  渡口-art.json           《渡口》三场景 + 两件道具样例，全部质量门通过
assets/
  report.webp            报告截图
```

## 自测

```bash
node scripts/selftest.mjs
```

158 项断言，覆盖 seed / 画风预设 / 11 道门逐项击穿 / 渲染（中英界面）/ 导出。不调模型、不花额度、1 秒跑完。改完脚本先跑这个。

**只在 macOS + Node 24 上实测过。** 代码没有平台相关调用，Linux 和更低版本 Node 理论上没问题，但**没验过**。
