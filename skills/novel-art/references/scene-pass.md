# 场景设定 · 怎么填

给你一个场景的骨架（seed 预填了 id/名称/主场景标记/出现集/承载爽点）+ 原文或大纲里关于这个空间的全部信息，产出完整的场景设定。**只输出 JSON，不要解释、不要围栏。**结构见 `schema.md`。

## 先想清楚：这是 AI 短剧，不是实拍

场景不是「找个地方拍」，是**要被生成几十次还得长一样的环境资产**。你写的每个字段都在为一致性服务：

| 字段 | 它在解决什么 |
| --- | --- |
| 锚点 | 观众靠什么认出「又回到这里了」；QC 靠什么判断生成的镜头没漂 |
| 光照状态 | 换时段 = 换提示词重新生成，不是现场重新打灯 |
| 空景 | 人是另一层资产（novel-characters 管），环境参考图里有人，一致性全毁 |
| 朝代 | 建筑形制、家具、器物、纹样共用的那个基准；不定它，每个场景各挑一个世纪 |

## 硬规则

1. **先定朝代，再写场景。**整部剧**一个**具体的真实朝代或年代，写进文档级的 `dynasty`：`明`、`北宋`、`民国`、`唐`。

   **不许写「古代」「古装」「某朝」「架空」这类词。**它们在画面上没有任何对应物——模型读到「古代府邸」只能自己挑一个，于是庭院出成宋、书房出成明、道具出成清，摆在一起不像同一部戏。这跟不许写「架空」是同一条：关于设定的话进不了画面，设定本身才进。

   原文没明说就按线索推断，**推断出一个具体的，不要因为不确定就写含糊的**：官职名、服制、器物、货币、称谓、建筑形制、节令风俗、度量衡都是线索。原著是架空设定时，写它**像**哪个朝代——`明代风格`——而不是写它是架空的。

   定好之后，`image.prompt`、`image.sheet`、锚点描述、光照状态全部按这个朝代写：斗拱样式、家具腿型、窗棂纹样、灯具形制、地面铺装，都有朝代差别。

2. **`summary` 写设计意图，不写户型说明。**「小到人与人躲不开视线的审讯室」是设计意图；「约十平米，六排坐板」只是测量数据。空间要为戏服务，先说它为哪场戏存在。

3. **锚点要「可画、可认、可核对」。**好锚点：补丁船篷、断裂的第七块桥板、绿锈铜铃——生成图里一眼找得到，缺了立刻发现。坏锚点：「陈旧的氛围」「岁月的痕迹」——没法核对的不是锚点是形容词。每个锚点 `name` 短到能进核对表，`desc` 写清位置和特征。

4. **光照状态从分集反推。**这个场景在出现的那些集里经历了什么时段和天气，就写哪些状态。别凭空写一套「白天/夜晚/黄昏」全家桶——用不上的状态是维护负担。

5. **提示词永远英文，永远空景。**`image.prompt` 里明写 empty scene / no people，`negativePrompt` 必须禁人。**绝不出现角色名、作者名、作品名**——图像模型会把它认识的东西画进去。

6. **提示词里不写渲染风格，只写这个地方的状态。**不要出现 `Semi-realistic environment concept art` / `painterly rendering` 这类句子，也不要给 `image.tags` 打 `semi-realistic`、`painterly` 这种风格标。画风是出图那一刻才定的，整批共用一段风格指令由调用方附加——写进每条提示词只会跟当时选的风格打架，而且换风格要逐条改。

   要整段带上的是**表面处理**，它讲的是这个空间被谁在用、用了多久，换任何画风都成立。
   **三档二选一，按这个空间的实际保养水平选**——不是三种画风，是三种事实：

   **A · 普通使用·保持整洁（默认档）**（仍在正常使用的民居、客栈、宿舍、铺面——绝大多数日常空间都是这一档）：
   ```
   Modest, well-cared-for materials: clean and tidy surfaces, intact finishes, only faint traces of everyday use; the space is properly looked after, neat, clean and orderly. Atmospheric depth with haze or volumetric light where the space allows
   ```

   **B · 持续维护**（宫殿、官署、显贵府邸的前厅、新建或刚整修的空间）：
   ```
   Well-kept, actively maintained materials: sound lacquer with an even sheen, swept stone and timber, polished metal fittings, tight joinery, no peeling paint and no water staining; wear confined to the traffic a space like this really takes — thresholds, handrails, the stone directly inside a doorway. Atmospheric depth with haze or volumetric light where the space allows
   ```

   **C · 失修**（确属久无人修的废宅、废墟、烂尾空间才用——是少数例外，不是常态）：
   ```
   Weathered, lived-in materials: chipped paint, water stains, patina on metal, worn wood grain, dust in corners and light shafts; fabric and paper props show creases and age; nothing looks factory-new. Atmospheric depth with haze or volumetric light where the space allows
   ```

   **默认选 A，别顺手写 C。**年代早 ≠ 脏破：物质不丰富的年代，在用的空间也是天天打扫、物见本色的，只有些擦不掉的使用痕迹。C 档的掉漆、水渍、积灰是「这地方已经没人管了」的视觉声明，选它必须能从剧情里说出来为什么失修。反例教训：1998 年的宾馆客房和大学宿舍全上 C，出来的图满墙霉斑、被褥拖地——直接被用户打回。金銮殿同理，那要选 B。这跟「每条提示词必须逐字包含同一句画风」是同一个错误：把一个该按对象决定的事实，写成了一句对谁都成立的常量。

   选了 A 或 B 仍然可以写磨损，只是**磨在该磨的地方**：门槛正中、栏杆扶手、台阶踏面、桌沿——人手和人流量磨出来的，不是年久失修出来的；剧情锚点要求的特定痕迹（烫痕、划痕、裂口）照写，但它是局部的一处，不是全屋的底色。

   负向提示词打底里已有 `sterile showroom cleanliness` 防止矫枉过正变成样板间；对 A 档空间，负向再追加 `heavy grime, dirt and filth, rust everywhere, decay, mould, garbage, messy clutter, filthy surfaces` 把脏破方向压住。

   反向提示词打底（按场景再补）：
   ```
   people, human figures, characters, crowds, silhouettes of people, oversaturated colours, sterile showroom cleanliness, warped perspective, melted geometry, floating objects, text, watermark, signature
   ```

   `image.tags` 打底：`environment sheet`、`cinematic`，再按所选表面处理档位补一个状态标（A→`well-cared-for materials`、B→`actively maintained`、C→`weathered materials`）——描述这是什么图、什么状态，不描述它用什么笔法画。

   **反向提示词里绝不能禁画风词**（`photorealistic`、`3d render`、`anime` 这些）——出图时选的就可能正是它，禁掉等于自己跟自己打架。

7. **能做变体就别开新景。**AI 生成一个新环境很便宜，但**每多一个独立环境就多一份一致性维护**。outline 里带复用方案的场景（seedNote 会提示），用 `variantOf` + `changes` 挂到母场景上：改时段、换天气、换前景、删道具，桥板细节这类资产直接复用。

8. **不要把角色 skill 的表面处理带进来。**毛孔、皮下散射是皮肤的事；环境的可信度来自**材质与保养状态**——按上面三档选一档照抄，别自造磨损句子。

## 输入格式

```
Scene: S01 渡船船舱（主场景）
出现集：1–6　承载爽点：悬念钩、身份揭破、反转、收束

原文/大纲里关于这个空间的信息：
- ……
- ……

同批其他场景：S02 渡口栈桥、S03 对岸芦苇滩
```

同批其他场景要知道名字——空间气质要能区分开，别把每个景都写成同一种「破旧」。
