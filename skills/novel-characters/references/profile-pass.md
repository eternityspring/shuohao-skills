# 第二趟 · 生成角色卡

你是在为一部动画改编准备制作素材。给你一个角色的名字、归并后的全部观察记录、以及可引用的原文片段，产出一张完整的角色卡。

**只输出 JSON，不要任何解释、不要 markdown 围栏。** 结构见 `schema.md`。

## 语言

调用方会给一个**报告语言** `lang`（默认 `zh-TW`，台湾正体）。字段分两类：

| 类别 | 字段 | 语言 |
| --- | --- | --- |
| **给人读的** | `oneLiner`、`persona.*`、`voice.timbre/pitch/pace/accent/emotion/referenceHint`、`image.style`、`image.promptLocal`、`voice.promptLocal` | **`lang` 指定的语言** |
| **喂给机器的** | `image.prompt`、`image.negativePrompt`、`image.tags`、`image.sheet`、`voice.prompt` | **永远英文** |

机器字段不跟随 `lang`——图像模型和 TTS 引擎吃英文最稳，跟报告用什么语言无关。

`promptLocal` 是对应英文提示词的本地语言译文，给人看的。**`lang` 是 `en` 时省略这两个字段**，否则就是原样重复。

`lang` 是 `zh-TW` 时**用台湾惯用词，不是把简体换个字形**。外貌描写里踩得最多的是
一简对多繁的字（頭**髮**、**乾**淨、眼**裡**、**鬆**垮、一**隻**手），引号用「」。
完整对照表在 `SKILL.md` 的「`zh-TW` 的用语规范」。

## 硬规则

1. **一切基于观察记录。** 为了让设定可用而不得不补全的部分，要跟原文保持一致，并且**标注出来**——中文报告加「（推断）」，英文报告加 `(inferred)`，其他语言用该语言的等价说法。**只用一种标记，不要中英都加。**

2. **`persona.evidence` 只能放「可引用原文」区块里的字符串，逐字照抄。** 不许翻译、不许裁剪、不许把两条合并、不许从观察记录里另找。那个区块是空的就返回空数组。**注意：引文永远保持原文语言，不跟随 `lang`**——它是证据，翻译了就不是证据了。

3. **`image.prompt` / `image.promptLocal` / `image.sheet` 里绝对不许出现角色名、别名、作者名、作品名。** 图像模型对这些偏见极重，会画成它记忆里的角色而不是你的角色。描述这个人，不要叫他的名字。

4. `image.prompt` 是**单张表现性插画**（不是技术图，可以放开打光）：四分之三视角半身、纯中性背景、柔和方向主光 + 冷调补光、浅景深、面部最实。

   > **先看 `style`。** 下面第 4 条讲的质感是 `realistic` 预设的内容。调用方指定了
   > 别的风格（`ghibli` / `photoreal`），就跑
   > `node scripts/novel-characters.mjs styles <id>`，把那个预设的 render / surface /
   > lighting / negative / tags **整块换掉**，不要拿这里的写实描述去混搭。
   >
   > `photoreal` 尤其要注意：它跟 `realistic` 一样**绝不能**禁 `photorealistic`，
   > 但**必须**禁 `illustration` / `painting` / `anime` / `cartoon`——它要的是照片不是画。

   **画风走半写实厚涂，不要写「扁平矢量卡通」。** 实测「扁平矢量卡通」这句会让模型跟自己拧巴——同一批角色出来有的偏动画、有的偏写实。用这一档：
   `Semi-realistic character illustration, painterly rendering with soft blended edges and visible brush texture, anatomically grounded`

   **真实感来自不完美，不是细节量。** 皮肤和五官要写具体：可见毛孔、肤色不匀、鼻翼耳缘的细微毛细血管、耳缘透光；眼睛要有湿润高光、下眼睑水光、虹膜纤维；**眼睑和眉毛左右略不对称**；发际线有细碎碎发破开轮廓。老年角色收益最大：老年斑、皮肤松弛，**皱纹要顺着表情肌走**（法令纹、鱼尾纹、抬头纹），不是随机刻线。

   **布料决定「像不像真衣服」**：可见织纹、肘部袖口膝盖的磨损与光泽、布料垂坠有重量、褶皱深处有自阴影。

   `negativePrompt` **不要写 `photorealistic` / `3d render`**——一边要真实感一边禁真实感是自相矛盾的。该禁的是「假」：塑料蜡质皮肤、过度磨皮、无毛孔娃娃脸、完全对称的脸、没有高光的死眼、头盔状无碎发的头发、无织纹的平板布料、僵硬的人台姿势。

5. **`image.sheet` 是角色设定图——一张 16:9 横构图，内部分三个区。** 这是给出图模型的完整版面指令，比例要写死，不能让它自由发挥：

   ```
   ┌──────────┬────────────────────────────┐
   │          │   正视    侧视    背视       │
   │  半身像   │                            │
   │ （证件照） ├────────────────────────────┤
   │          │  细节 · 细节 · 细节 · 细节   │
   │   ~34%   │                            │
   └──────────┴────────────────────────────┘
              16:9
   ```

   | 区 | 内容 |
   | --- | --- |
   | **左** 约 34% | **半身像**：头肩，正面，居中，像证件照。脸画全、画细，这是面部设计的基准。**两侧肩膀完整**，底边**齐平直切** |
   | **右上** | **全身三视图**：正视 / 侧视 / 背视并排，共用一条地平线 |
   | **右下** | **细节条**：4–5 个关键细节的小特写，等距排一行，明显小于全身像 |

   三个区之间用**细线**分隔。整张纯白背景、四周留白均匀。

   **光照要分区写**，这是设定表和写实的矛盾点：
   - **左栏半身像**：左上方柔和方向主光、衰减自然，下巴下方 / 眼窝 / 领口与脖颈交界处有环境遮蔽——脸要有体积
   - **右侧两区**：平光正交、无方向主光、无投影——**抠图和量比例全靠它**

   写死成 `LIGHTING IN THE LEFT ZONE ONLY: ...` 和 `LIGHTING IN THE RIGHT ZONES: flat even orthographic lighting ...`。全图统一平光会让整张显得「插画感」，全图统一打光又没法抠图。

   **比例是这个版面最容易崩的地方。** 提示词里必须写死：三个全身像等高、头身比一致、四肢长度和头身比正确、双脚踩在同一条地平线上、头顶和脚下都留出空隙，**绝不能为了塞下别的东西把人物拉伸或压扁**。

   **细节放不下怎么办**：底部一行排不下就沿画布右缘往下延伸成一竖列。**但永远是细节让位，不是人物让位**——提示词里要明说 `the detail studies give way, not the figures`。

   **一张图里只能有一个长相。** 三视图的面部与左栏半身像一致——同样的五官、发型、表情。左栏是基准，右栏照着它画。

   提示词里必须逐条写明：`ONE 16:9 landscape canvas`、`LEFT ZONE ... about 34% of the canvas width`、`RIGHT-TOP ZONE`、`RIGHT-BOTTOM ZONE`、`thin hairline rules`、`PROPORTIONS ARE CRITICAL`、`the detail studies give way, not the figures`。

6. `voice.prompt` 是给 TTS 音色设计引擎的：描述**乐器本身**，不是某一句台词的演绎。性别、听感年龄、音色、音高区间、共鸣、气声、语速、节奏、口音、能量、默认情绪。

7. **同一批角色之间要能区分开。** 会给你同批其他角色的名字，别把他们的长相和声线做成一个样。

## 输入格式

```
Language: zh
Character: 老周
Also referred to as: 老伯、摆渡人
Other characters in this cast: 沈知微、陆行远、胡二爷

Observations gathered from the source text:
1. ...
2. ...

Verbatim quotes — the ONLY strings allowed in `persona.evidence`:
- ...
- ...
```
