---
id: match-cut-motion
kind: recipe
name: 动接动
name_en: Motion match cut
one_line: 上一格的动势接下一格的动势
one_line_en: The momentum of one cut lands in the next
category: transition
applies_to: [drama, product, vlog]
energy: 3
seconds: [2, 4]
cuts: [2, 2]
sizes: [medium, close]
cameras: [Static Shot, Tracking Shot]
must_phrases: [motion continues across the cut, same movement direction]
must_phrases_zh: [动势跨过切点继续, 前后同一个运动方向]
tags: [转场, 两格, 段内连贯, 切点选在动作中间]
example_frames: []
---

## 意图

两格之间不靠淡入淡出、不靠黑场，靠**动势**焊住：上一格里有个东西正在往右走，下一格里另一个东西接着往右走，观众的眼睛还没落地，画面已经换了。

核心纪律只有一条，而且违反它的代价立刻可见：**切点选在动作进行中，不是动作完成后**。手伸出去、停住、再切——动势已经衰减完了，接起来就是两段各自独立的画面；手伸到一半就切，动势被下一格接住，两格才焊得死。

生成式做这件事有个天然优势：一格里的动作本来就是模型自己补出来的，只要在提示词里说清「切的时候还在动」，它不会去做那个「收势」的收尾。

## 提示词骨架

固定两格，两格都要写，缺一格就不成立。

**第 1 格**（动势出）：

```
medium shot, 动势主体正在做的那个动作（一只手伸向箱子 / 一扇门被推开）,
travelling from left to right（运动方向写死，两格必须是同一个）,
still travelling when the cut comes（切点到来时动作仍在进行，不许收势）,
motion continues across the cut, the same movement direction carries into the next shot,
机位固定不动
```

**第 2 格**（动势入）：

```
close-up, 承接动势的主体（另一只手按上同一口箱子）,
already in motion（从与第 1 格相同的一侧入画，入画时已经在动）,
picked up mid-way rather than restarted（动作从中途被接住，不是重新起手）,
motion continues across the cut, the same movement direction as the previous shot,
机位固定不动
```

- **第 1 格结尾不许收势**：写 `still travelling`，不写 `comes to rest`、不写 `pauses`
- **第 2 格开头不许重启**：写 `already in motion`、`picked up mid-way rather than restarted`。第 2 格从静止起手，动势就断了一次，前面白写
- **两格方向必须一致**：都向右、或者都向下。方向本身随意，一反就读作两件事，动接动直接失效
- 两格景别可以跳（medium → close），**方向不能跳**
- 运镜默认两格都 `Static Shot`——动势由主体给就够了。使用 `Tracking Shot` 时，两格的镜头移动方向也要与主体同向

## 参数表

| 旋钮 | 默认 | 区间 | 调节手感 |
| --- | --- | --- | --- |
| 每格秒数 | 2 秒 | 2–4 秒 | 动接动靠动势不靠时长。给到 4 秒，动作在格内就走完了，切点又被推回「完成后」 |
| 格数 | 2 格 | 2 格 | 没有区间：三格就不是动接动，是一段动作戏 |
| 切点位置 | 动作走到六七成 | 五成–八成 | 越早切越猛，越像被人扯了一把；过了八成动势衰减，接起来发钝 |
| 运动方向 | 从左向右 | 任意，但是两格必须同一个 | 方向选哪个都行，两格不一致就是两件事 |
| 景别落差 | medium → close | 一档–两档 | 差一档最稳；差两档（wide → close）要靠同一个物件把观众锚住 |
| 动作幅度 | 中 | 中–大 | 幅度太小的动作（眨眼、点头）撑不起动势，接点看不出来 |
| 运镜 | Static Shot | Static Shot / Tracking Shot | 主体在动就不必让镜头再动；两个都动，动势方向容易互相打架 |

## 参考图约束

- **两格挂同一个物件的设定图**（被伸向的箱子、被推开的门、被递出去的杯子）——动接动是靠物件把两格对齐的，物件一换观众立刻看出这是两个地方
- **第 1 格出来之后挂给第 2 格**：手的位置、袖口、桌面高度、光比全靠它对齐
- 提示词只写方向与「动作走到哪一步」，长相与服装交给参考图
- 跨空间的动接动（这屋里伸手 → 另一处被按住），两格还要各挂各自的场景设定图，只有物件是共用的

## 已知坑

| 病 | 症状 | 治法 |
| --- | --- | --- |
| 晚切 | 第 1 格动作做完停住才切，两格接起来像两段 | 第 1 格结尾写 `still travelling`，把「停」这个词从提示词里删干净 |
| 反向 | 一格向右一格向左，观众读成两件事 | 两格都写 `same movement direction`，并且把方向写死（left to right） |
| 重启 | 第 2 格从静止开始做同一个动作，动势断了一次 | 第 2 格写 `already in motion` 与 `picked up mid-way rather than restarted` |
| 速差 | 一格慢一格快，接点上有顿挫 | 两格秒数写成一样，动作幅度也压到同一档 |
| 变形 | 两格里箱子换了颜色，或者把手长在另一边 | 物件设定图两格都挂，并且第 1 格当第 2 格的参考图 |

## 示例

《回信》里没有动接动。样片唯一的两格转场是 R33/R34 的甩镜过桥（`whip-blur-bridge`），两者不要混淆：甩镜靠运动模糊焊住两个空间，动的是机位；动接动靠画面里主体的动势焊住两格，机位可以完全不动。两张卡只有「方向必须一致」这一条重合。甩镜换的是空间，动接动多数时候不换空间，它只是把一段连续的戏切碎了，还让它读着不断。

最接近的一处是 R19 → R20：儿子的手停在半空，下一格那封信正被推过桌面。可惜接不成动接动——R19 结尾那只手是**停住的**，动势已经衰减完，本卡第一条纪律「切点选在动作进行中」在这里就没了。真要把这两格改写成动接动，R19 的手在切点上必须仍然在往前伸（`still travelling when the cut comes`），R20 的信要从同一侧入画、从中途被接住（`picked up mid-way rather than restarted`），并且两格的运动方向逐字写成同一个。

示例帧未生成。
