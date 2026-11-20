# script.json 结构

一份剧本文件覆盖一个集数区间（通常一批 ≤ 3 集），顶层：

```json
{
  "source": "渡口",
  "params": { "charsPerSecond": 4.5, "actionSeconds": 2.5, "tolerance": 0.15, "maxLineChars": 35 },
  "episodes": [ ... ]
}
```

`params` 可省略，省略就用默认值。四个键都只在需要偏离默认时写。

`maxLineChars` 不只管本层的门：台词到了分镜层要装进 novel-storyboard 的单切里——默认切上限 5 秒，按 4.5 字/秒折算 22.5 字，超过它的台词**任何切法都装不下**（一拍台词不能拆进两切），分镜的 dialogue-fit 门必拦。压短台词，或把两边的 `maxLineChars` / `maxCutSeconds` 一起调大。

## episode

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ep` | int | 集号，正整数，同一文件内不许重复 |
| `targetSeconds` | number | 目标秒数。seed 会从大纲的 `minutesPerEpisode × 60` 算好 |
| `hook` | string | 开场钩子的说明——这一集头几拍靠什么把人摁住。**必填** |
| `cliff` | string | 结尾悬念的说明——最后一拍留什么让人点下一集。**必填** |
| `beatsClaimed` | string[] | 认领的大纲爽点 `type`（如 `"身份揭破"`）。没有就空数组，**字段本身必须在** |
| `hookBeat` | [int, int] | **钩子具象的认领位置** `[场, 拍]`：钩子说皮箱，哪一拍真给了皮箱。必须落在全集前 `hookWindow`（默认 3）拍内——冷开场规则，门查位置 |
| `scenes` | scene[] | 场次，按剧情顺序 |

`hook` / `cliff` 是**说明不是台词**——它们描述开场和结尾要达成的效果，具体的戏写在场次里。说明配合 `hookBeat` 认领：**说明给人读，认领给机器查**——钩子和第一场开头衔接不上，就是缺了认领这一环。

## scene（场次）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sceneId` | string | `S01` 格式，对账 art.json 的场景 |
| `lighting` | string | 该场用的光照状态名，必须是 art.json 里该场景登记过的状态。可省略 |
| `characters` | string[] | 本场出场角色（`C01` 格式，对账 outline.json）。空镜给空数组 |
| `props` | string[] | 本场用到的叙事道具（`P01` 格式，对账 art.json）。可省略 |
| `flow` | beat[] | 节拍流，**动作与台词交替**，按发生顺序 |

## beat（节拍）——二选一

**动作节拍**：

```json
{ "action": "沈知微一把按住箱盖。动作快得不像闺秀，倒像护崽的兽。" }
```

**台词节拍**：

```json
{ "speaker": "C01", "line": "不劳烦。它跟我。", "delivery": "声音很轻，却没商量" }
```

| 字段 | 说明 |
| --- | --- |
| `action` | 叙述体画面描述，一拍一件事。**不许出现引号台词**（「」『』“”都不行）——台词混进动作就没法计秒、没法喂 TTS |
| `speaker` | 本场 `characters` 里的角色 id，或 `"VO"`（画外音/心声——谁的心声写进 delivery） |
| `line` | 台词本体，口语，单句 ≤ 35 字（非空白字符计） |
| `delivery` | 表演提示：语气、动作伴随、潜台词。可省略，建议都写 |

一个节拍不能既有 `action` 又有 `line`；两者都没有也不行。

## 时长折算（确定性）

- 台词秒数 = 非空白字符数 ÷ `charsPerSecond`（标点算时间——停顿也是时间）
- 动作秒数 = 动作节拍数 × `actionSeconds`
- 每集预估 = 全部场次之和，必须落在 `targetSeconds × (1 ± tolerance)` 内

三分钟（180 秒）一集的参考体量：约 45–55 个节拍，其中台词 30 句上下。两分钟（120 秒）约 35 拍、台词 20 句上下。

## ID 纪律

角色用 outline.json 的 `C` 编号（不是 cast.json 的名字），场景道具用 art.json 的 `S` / `P` 编号。报告渲染时给了 `--outline` / `--art` 会自动把编号显示成名字——**数据里存编号，界面上看名字**。
