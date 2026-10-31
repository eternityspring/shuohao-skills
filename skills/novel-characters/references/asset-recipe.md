# 设定资产出图配方（角色）

本 skill 的脚本不产生图片，但报告里的图位有固定约定。**当前环境有出图能力（ImageGen / 其他）时，照这份配方出；出完重跑一次 `render`，图就嵌进报告。**

---

## 为什么是"三件套"

| 文件 | 规格 | 落在报告的哪里 | 为什么不能省 |
| --- | --- | --- | --- |
| `<slug>-bust.png` | 2:3 竖版，1024×1536 | 不进报告 | 它只干一件事：**锁脸**。竖版半身像最容易一次出对，成本最低，后面两张都拿它当参考图 |
| `<slug>-sheet.png` | 16:9 横版，1536×1024 | 右侧大图（外形设定） | 版面指令在 `cast.json` 的 `image.sheet` 里，左半身像 + 右上三视图 + 右下细节 |
| `<slug>-avatar.png` | 1:1 方形，1024×1024 | 左列 76×76 缩略图 | 方形缩略图**整张铺满**，脸正好占满一格。没有它就只能从 16:9 设定图上切左栏，切出来是半身、脸偏小 |

**顺序不能颠倒**：bust 定脸 → 用 bust 出 sheet → 用 bust 出 avatar。反过来做，先出的那张脸没有经过确认，后面两张会把它放大成"标准脸"。

三张都对不上脸时，重做 bust，不要单独修 avatar——单修只会越修越不像。

---

## 命名与落位

- 目录：`<输出目录>/images/`（或 `--images` 指向的任意目录）
- 文件名：`<角色名>-bust.png` / `<角色名>-sheet.png` / `<角色名>-avatar.png`
- 角色名用 `cast.json` 里的 `name` 原文（中文就写中文），脚本按 `slug(name)` 去找，只清特殊字符、保留中文
- **文件名一改报告就得重渲染**；只换图内容、文件名不动，刷新页面即可

---

## bust（打样 + 锁脸）

提示词要点（英文，出图引擎吃英文最稳）：

- 身份：年龄 + 性别 + 身高体型 + 脸型骨相 + 发型 + 皮肤质感 + **一个可复用的识别特征**（疤、痣、鬓角碎发、秃顶的几缕）
- 服装：年代准确的 2–4 件，带磨损细节（旧夹克袖口、磨白的鞋跟）
- 构图：three-quarter view, half-length, plain neutral background, soft directional key light from upper left, shallow depth of field
- 收尾：`1990s Chinese film photography look, natural skin texture, no retouching`
- 负向：`baby-faced, oversized anime eyes, over-smoothed skin, perfectly symmetrical face, dead eyes without catchlights, helmet hair, stiff mannequin pose, text, watermark, logo`

**一次只打样 1–2 张**，确认风格与年代感对上了再批量铺——批量之后再改风格，全部重来。

## sheet（报告大图）

**直接取 `cast.json` 的 `image.sheet` 字段，不要自己重写。** 那串版面指令里压着三个最容易崩的点：

- 一张图两个长相 → 写死"one single consistent face across the entire sheet"
- 为塞细节把人压扁 → 写死"the detail studies give way, not the figures"
- 左栏收口 → 写死 left zone 占 34%、底边齐平（缩略图切片就靠这个比例）

出图时把 bust 当参考图传进去：`image1=<slug>-bust.png`，`input_fidelity: high`。

## avatar（列表头像）

模板（把方括号里换成该角色的事实）：

```
Square 1:1 headshot of the SAME person as the reference image, keep exactly the same face, age, hairstyle and clothing.
Head and shoulders only, face centred, the head filling about 62% of the frame height, a small even margin above the hair,
chin clear of the bottom edge, both shoulders complete. [眼神与表情一句话] .
Plain seamless light grey studio background, soft directional key light from upper left with gentle fill,
catchlights in both eyes, sharpest focus on the eyes, shallow depth of field.
1990s Chinese film photography look, natural skin texture, no retouching.
Avoid: different person, cropped forehead, cropped chin, head too small in frame, baby-faced,
oversized anime eyes, over-smoothed skin, dead eyes, helmet hair, tilted head, text, watermark, logo.
```

三条容易翻车的：**脸占 62%**（少了就成半身像，多了切头顶）、**头顶留边**、**下巴不进底边**。参考图用 bust，`input_fidelity: high`。

---

## 出完必做的三件事

1. **逐张看**：一张脸一个人、手指数量、裁切是否切到脸、年代道具是否穿帮（智能手机、现代灯箱）
2. **去水印**：ImageGen 会在右下角压 "AI生成 WORKBUDDY"，用 `buddy-image-processing` 的 `image-edit --operation erase`（prompt 写 `Remove the watermark text in the lower-right corner`）逐张清。批量时注意临时凭证约 15 分钟过期，中途要重新获取
3. **重渲染**：`render ... --images <目录>`，然后数一下 `<img>` 数量对不对得上——数量不对说明命名没对上

---

## 按集推进，不要一次铺全剧

先出**当前这一集要用的角色**（`cast.json` 里该集出场的人），跑通分镜再补下一集。全剧一次铺完的风险是：风格在第 5 个角色才定型，前面 4 个全废。

报告和图都没出全时，缺的图位是空的，不用假装齐了——下游看报告就知道还差谁。
