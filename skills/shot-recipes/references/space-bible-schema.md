# 空间圣经 JSON 字段标准（通用，机器可读）

> **状态说明**：本文件是**字段契约规范**，不是本 skill 已发布的 CLI 能力。按此契约读取/校验/编译的桥接脚本、空间检查脚本目前只在 `DJ-demo` 项目内实现为样例，尚未进入任何 skill 的命令行；本仓库正式 schema（novel-art / novel-storyboard）当前也不含 `spaceId / cameraId / spaceVisibility / blockingState` 等字段。要用，需在自己项目里实现消费方脚本。
>
> 配套机制：`references/space-consistency-mechanism.md`（方法论，含状态说明）。
> 本文件定义「空间圣经」这一单一事实源的**通用字段契约**。它不绑定任何具体项目的人物、座位编号或尺寸——那些是实例数据，由项目自己填。桥接脚本（项目侧实现）按本契约读取、校验、编译，注入到文生图/图生视频提示词。

---

## 1. 文件组织

- 每个固定场景一份 JSON，建议命名 `<scene_id>.json`（如 `ferry-cabin.json`）。
- 同目录放 `manifest.json` 做 `scene_id → 文件名` 映射，便于多场景项目：

```json
{ "S01": "ferry-cabin.json", "S02": "inn-room.json" }
```

桥接脚本通过 `manifest[scene_id]` 定位文件，不写死文件名。

---

## 2. 顶层字段

| 字段 | 必填 | 类型 | 说明 |
|---|---|---|---|
| `scene_id` | ✅ | string | 场景唯一码，如 `S01`；与 manifest 键一致 |
| `scene_name` | ✅ | string | 中文场景名（给人读） |
| `scene_name_en` | ✅ | string | 英文场景名，**注入 H3 稳定句用**，避免中英混杂影响模型 |
| `version` | ✅ | string | 语义化版本，如 `0.1.0-draft`；派生提示词带 `space_version` 戳 |
| `status` | ✅ | enum | `draft` / `confirmed`；见第 11 节升级条件 |
| `source` | ⚪ | string | 来源作品名 |
| `validation_required` | ⚪ | string[] | draft 阶段待走位/尺寸验证的清单，转 confirmed 前逐项消除 |
| `dimensions` | ⚪ | object | 尺寸（见第 3 节） |
| `orientation` | ✅ | object | 朝向与入口（见第 4 节） |
| `structure` | ✅ | object | 结构件（见第 5 节） |
| `fixed_anchors` | ✅ | object | 固定锚点（见第 6 节） |
| `camera_positions` | ✅ | object | 真实机位枚举（见第 7 节） |
| `space_visibility` | ✅ | object | 空间可见度分级（见第 8 节） |
| `seating_topology` | ✅ | object | 座位/物体拓扑（见第 9 节） |
| `blocking` | ✅ | object | 基础席位 + 分状态走位（见第 10 节） |

> ✅ 必填 / ⚪ 可选。所有字段在 `draft` 阶段都允许存在；`confirmed` 阶段不允许残留 `draft`/`proposed`/`待验证` 等字样（校验应拦截）。

---

## 3. `dimensions`（可选，draft 阶段多为推定值）

```json
"dimensions": {
  "status": "draft",
  "hull_length_m": 8.5,
  "cabin_usable_length_m": 5,
  "cabin_width_m": 2.2,
  "central_aisle_width_m": 0.65,
  "canopy_height_m": 1.9,
  "bench_spacing_m": 0.8,
  "note": "以上为推定值，待 validation_required 全部走通后改为 confirmed"
}
```
字段语义自定，关键是 **`status` 标 draft/confirmed**，且尺寸一旦 confirmed 即成为不可在提示词里改动的硬约束。

---

## 4. `orientation`（必填）

```json
"orientation": {
  "status": "draft",
  "_entry_status": "APPROVED_BY_PLOT_CONTINUITY",
  "bow": "船头（竹篙撑船端；老周撑篙工作位在船头中部偏左）",
  "stern": "船尾（最远离登船口的一端）",
  "port": "左舷（从船尾看向船头时的左侧）",
  "starboard": "右舷",
  "entry": "登船口位于船头右舷侧（非正中央）；跳板接右舷登船缺口；客舱入口在棚前端直连中央过道",
  "cabin_entrance": "客舱入口在棚前端，正对中央过道起点；P1/S1 紧接舱口之后",
  "gangplank": "跳板接右舷登船缺口，不侵占撑篙工作位与铜铃"
}
```

- 方向词（bow/stern/port/starboard）是**锚点坐标**，所有 seat / anchor 位置都相对它们描述。
- `entry` / `cabin_entrance` / `gangplank` 描述登船动线与舱口关系；一旦剧情连续性确认，用 `_entry_status` 之类旁路字段标记「已审批」，但整文件仍可保持 `draft`（尺寸等其他项未确认）。
- 具体位置文字是**实例数据**，本契约不规定值，只规定必须有 bow/stern/port/starboard/entry 五个键。

---

## 5. `structure`（必填）

```json
"structure": {
  "status": "draft",
  "canopy": "old canvas awning (NOT solid wood roof); patched at rear-right corner leaking one thin seam of cool white light",
  "posts": "canopy support posts: 4 total, 2 per side (bow port, bow starboard, stern port, stern starboard)",
  "deck": "weathered wood planks, dark water-stain line along deck seams",
  "patch": "patched corner of canopy at rear-right (starboard stern) position",
  "water_stain": "dark water-stain line along deck seams, fixed position"
}
```
结构件描述要带**可锁定材质/位置**，便于提示词复用与图片验收。「非实木顶棚」「4 立柱」之类是硬事实，confirmed 后不可改。

---

## 6. `fixed_anchors`（必填）

```json
"fixed_anchors": {
  "status": "draft",
  "bronze_bell": "verdigris bronze bell, fist-sized, hangs on STARBOARD BOW first post, rope knot; NOT movable",
  "worn_bench_mark": "P2 bench top polished pale from 40 years of passengers; faint wet footprint texture"
}
```
锚点 = 在全部镜头里**位置固定、不可移动**的关键道具/痕迹。用「相对哪个方向/座位」描述位置。

---

## 7. `camera_positions`（必填，真实机位枚举）

```json
"camera_positions": {
  "_doc": "真实机位枚举（与 shot size / 景别无关）。cut.cameraId 必须取下列 key 之一。",
  "BOW_TO_STERN": "机位在船头，镜头朝船尾方向（看向舱内纵深）",
  "STERN_TO_BOW": "机位在船尾，镜头朝船头方向",
  "PORT_TO_STARBOARD": "机位在左舷，镜头朝右舷方向（左右舷正反打）",
  "STARBOARD_TO_PORT": "机位在右舷，镜头朝左舷方向",
  "BOW_EXTERIOR": "船头外景，拍撑篙（非舱内座位区）",
  "BOW_STARBOARD_ENTRY": "机位在船头右舷登船口，拍登船与船头工作位",
  "FOREDECK_TO_CABIN": "机位在船头甲板，镜头朝客舱前端入口"
}
```

- `camera_id` = **真实摄影位置**，与景别（medium/wide/close）严格分离。
- 母版级（场景主图/光照变体）特例用 `SCENE_MASTER`（无具体机位）。
- 桥接脚本校验：cut.cameraId 必须命中本枚举，否则 fail。

---

## 8. `space_visibility`（必填，注入强度分级）

```json
"space_visibility": {
  "_doc": "空间可见度等级（与 camera_positions 独立维度），决定 bridge 注入船舱约束的强度。",
  "full": "完整舱内：六凳全拓扑 + 锚点 + occupancy",
  "inside": "同 full（舱内可见，需完整拓扑）",
  "cabin-opening": "只可见舱口框景 + 方向，不强制六凳全部可见",
  "cabin-entry": "同 cabin-opening 等级（登船/舱口框景，可见舱内但不强制六凳全现）",
  "partial": "同 cabin-opening",
  "incidental": "只锁船体 + 帆布棚 + 可见锚点（人物不在舱内座位区）",
  "exterior": "外景（河面/船头外），不注入舱内前缀",
  "mid-river-exterior": "河面外景（同 exterior）",
  "bow-exterior": "船头外景（同 exterior）",
  "none": "不注入任何空间约束"
}
```

**关键分级映射**（桥接编译时）：`full`/`inside` → `full` 级（注入六凳全拓扑）；`cabin-opening`/`partial`/`cabin-entry` → `opening` 级（只注入舱口框景，不强制六凳）；`incidental` → 仅船体/锚点；`exterior`/`*-exterior`/`none` → 不注入。

> ⚠️ `cabin-entry` 必须映射到 `opening` 级并纳入「应注入集合」——漏掉会导致检查报告按等级求和时把它静默吞掉（假绿）。

---

## 9. `seating_topology`（必填，座位/物体拓扑）

```json
"seating_topology": {
  "status": "draft",
  "ambiguity_note": "原文「六排坐板」有歧义，本草案采用「左右舷各三张短木凳」",
  "bench_type": "short wooden bench (NOT full-width)",
  "benches_per_side": 3,
  "total_benches": 6,
  "central_aisle": "fixed aisle between port and starboard benches, ~65cm, runs bow-to-stern",
  "english_phrase": "six short benches total, three per side (port P1-P3, starboard S1-S3), with a central aisle",
  "english_anti_pattern": "禁止写成 'six short benches port and starboard'（会被理解为左右各六张）",
  "bench_ids": {
    "port": ["P1", "P2", "P3"],
    "starboard": ["S1", "S2", "S3"],
    "order": "编号从船头(bow)到船尾(stern)：P1/S1 最靠近船头，P3/S3 最靠近船尾"
  }
}
```

- 座位必须**稳定编号**（不要只写「第二排」「中间凳」）。容量/拓扑自洽：port 数 == starboard 数 == benches_per_side；总数 == total_benches。
- `bench_ids` 是所有合法 seat 的集合，桥接/检查据此校验 blocking_states 里的座位引用与图片占用。
- 物体（货担、皮箱）走 `blocking` 的占用描述，不需单独拓扑键。

---

## 10. `blocking`（必填，走位状态机）

```json
"blocking": {
  "status": "draft",
  "principle": "船舱结构固定，人物走位随剧情变化。",
  "base_seats": {
    "角色A_C01": "P2 (port middle) beside crates",
    "角色B_C02": "S3 area / rear starboard wall",
    "角色C_C03": "bow, working (NOT seated)"
  },
  "blocking_states": {
    "STATE_A": {
      "note": "状态说明：谁在哪、在做什么",
      "角色A_C01": "P2 with crates",
      "角色B_C02": "S3 rear starboard",
      "角色C_C03": "bow (coiling rope)"
    },
    "STATE_B": { "...": "..." }
  },
  "allowed_moves": ["角色A: P2 探身/半起身伸手（不挪凳）"],
  "forbidden_changes": ["禁止改变座位数量/拓扑", "禁止移动铜铃"]
}
```

### 10.1 字段
- `base_seats` / `blocking_states` 的 key 形如 `角色名_C0x`（C0x 为角色码）。
- 每个 state 描述「每个角色此刻在哪」；座位用 `P1`/`S3` 等拓扑 id 写明。
- `note` 键是每个 state 的元数据，桥接/检查都**跳过它**。

### 10.2 occupancy 推导规则（桥接/检查共用）
由 `blocking_states[stateKey]` 推导占用串 `C0x@Seat`：
1. 遍历每个角色（跳过 `note`）。
2. 从角色描述里抽取 `[PS]\d+` 座位。
3. **只把「确实落座/处于该座位」的语境算占用**；描述里出现 `not yet` / `not seated` / `about to` / `near` / `still` / `will take` / `to take` / `toward` 等**尚未落座**语境的座位**不算占用**（典型：叙事写 "about to take P3" / "not yet at P3" 不得注入 `C0x@P3`）。
4. 一个角色只取第一个有效占用座位。

> 这条是假绿高发点：朴素正则 `/[PS]\d+/` 会把叙事里的 "not yet at P3" 误判为占用，导致桥接给「尚未落座」的角色错误注入 `C0x@P3`。

### 10.3 冲突校验
- 同一 `blocking_state` 内，一个座位被**两个不同角色**占用 → 报错（双人占同座冲突）。
- `blocking_states` 里引用的 seat id 必须都存在于 `seating_topology.bench_ids`。
- 抽取角色码集合（C0x）时，从 `base_seats` 与所有 `blocking_states` 的 key 里按 `_C\d+$` 推断。

---

## 11. `draft → confirmed` 升级条件

整文件才能从 `draft` 改为 `confirmed`，**全部满足后**：
1. `validation_required` 列出的走位/尺寸验证项全部走通并消除；
2. 尺寸、立柱数、入口位置等已从推定值变为已确认事实；
3. 全文不再残留 `draft` / `proposed` / `待验证` / `推定值` 等字样（校验应拦截）。

`confirmed` 后：空间圣经成为不可在提示词里改动的硬约束；任何派生提示词都必须从它编译，不再手改结构。

---

## 12. 最小合法 JSON 示例

```json
{
  "scene_id": "S01",
  "scene_name": "示例船舱",
  "scene_name_en": "example cabin",
  "version": "0.1.0-draft",
  "status": "draft",
  "orientation": {
    "bow": "船头", "stern": "船尾", "port": "左舷", "starboard": "右舷",
    "entry": "登船口在船头右舷"
  },
  "structure": {
    "canopy": "canvas awning not solid roof",
    "posts": "4 posts, 2 per side"
  },
  "fixed_anchors": {
    "bell": "bronze bell on starboard bow post, NOT movable"
  },
  "camera_positions": {
    "BOW_TO_STERN": "机位船头朝船尾",
    "PORT_TO_STARBOARD": "机位左舷朝右舷"
  },
  "space_visibility": {
    "full": "完整舱内", "inside": "同 full",
    "cabin-opening": "舱口框景", "cabin-entry": "同 cabin-opening",
    "incidental": "仅船体锚点", "exterior": "外景不注入", "none": "不注入"
  },
  "seating_topology": {
    "benches_per_side": 3, "total_benches": 6,
    "bench_ids": { "port": ["P1","P2","P3"], "starboard": ["S1","S2","S3"] }
  },
  "blocking": {
    "base_seats": { "角色A_C01": "P2", "角色B_C02": "S3" },
    "blocking_states": {
      "ALL_SEATED": { "note": "全员落座", "角色A_C01": "P2", "角色B_C02": "S3" }
    }
  }
}
```

---

## 13. 必填 / 可选 / 仅 draft 汇总

- **必填**：`scene_id` `scene_name` `scene_name_en` `version` `status` `orientation`(含 bow/stern/port/starboard/entry) `structure` `fixed_anchors` `camera_positions` `space_visibility` `seating_topology` `blocking`。
- **可选**：`source` `validation_required` `dimensions`（draft 阶段强烈建议，confirmed 后必填）。
- **仅 draft 允许**：`validation_required` 列出的待验证项、`dimensions.status=draft`、正文里 `draft`/`proposed`/`推定值` 等字样。`confirmed` 后这些必须清除。
