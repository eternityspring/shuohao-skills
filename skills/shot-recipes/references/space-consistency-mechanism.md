# 固定场景空间一致性机制（方法论文档）

> **状态说明（读前必看）**：本文是**方法论**，不是本 skill 已发布的 CLI 能力。文中「桥接脚本必须读取-校验-编译-注入」「自动检查」等描述，是**建议机制**；对应的 loader / bridge / 空间检查脚本目前只在 `DJ-demo` 项目内实现为样例，**尚未进入 `shot-recipes` 或任何 skill 的命令行**。本仓库的正式校验器（novel-art / novel-storyboard 等）当前不识别 `spaceId / cameraId / spaceVisibility / blockingState` 等字段。要用，需在自己项目里实现消费方脚本。
>
> 适用：任何有「固定场景 + 多集多镜头 + 文生图/图生视频」的短剧。
> 机器可读的字段契约见同目录 **`space-bible-schema.md`**（本文件只讲机制与纪律，不重复字段定义）。

---

## 1. 一句话结论

**空间一致性 = 单一空间事实源（空间圣经 JSON）+ 机器读取/校验/编译机制 + 所有提示词从中派生 + 母版优先派生镜头 + 自动检查约束落地。** 只在文档写"引用"不会自动生效；不在桥接脚本里读取并注入，就仍然是在多处手改。

---

## 2. 漂移根因模型

| 层级 | 表现 | 责任 |
|---|---|---|
| 场景原始设定缺失精确结构 | 只有模糊文字（如「六排坐板」） | 主因 |
| 提示词未重复空间硬约束 | 每图只写当前人物动作 | 主因 |
| 多参考图稀释空间 | 同时塞 4–5 张人物图，场景参考被淹没 | 显著 |
| 模型不能 3D 锁结构 | 换机位重补全不可见空间 | 客观限制，只能绕 |
| **桥接脚本未读空间源** | 派生脚本只从 JSON 取 frame，不注入空间前缀 | **机制缺口（最该修）** |
| 流程缺母版与验收 | 无俯视图/母版/逐张空间验收 | 流程缺口 |
| **检查「总数相等但分类错位」假绿** | 只数「是否带约束」，不按分级逐项断言 | **机制缺口（最该修）** |

---

## 3. 机制层（必实现）

### 3.1 单一事实源 = 空间圣经 JSON
每个固定场景一份结构化 JSON（尺寸/拓扑/朝向/锚点/blocking）。**它不是给人看的文档，是给脚本读的源。**

### 3.2 读取—校验—编译（fail-closed，建议机制）
> 以下是一套**建议的桥接机制**，DJ-demo 项目已按此实现为样例脚本；它不是本 skill 当前发布的 CLI 能力，仅作方法参考。

桥接脚本（建议在具体项目里实现）应：
1. **读取**：加载空间圣经 JSON（通过 `manifest.json` 映射 `scene_id→文件`）。
2. **校验**：版本号存在、必填字段齐全、座位编号自洽（P1-P3/S1-S3 都存在）、`blocking_states` 引用的 seat id 都在拓扑内、**真实机位枚举 `camera_positions` 存在且 `cut.cameraId` 必在其中**、双人占同座冲突（同一 blocking_state 内一个座位被多人占用即报错）。校验失败 → 脚本 exit 1，**不生成任何派生文件**。
3. **编译**：把空间硬约束编译成不同用途的前缀/片段，注入到派生提示词（见第 5 节）。
4. **版本戳**：派生提示词带 `space_version` 字段，便于过期标记。

### 3.3 注入依据必须来自源 JSON 的结构化字段，禁止关键词推断
> 本节描述**建议的数据契约**；`spaceIds / cameraId / spaceVisibility / blockingState / spaceId` 这些字段目前不在本仓库正式 schema 里，需在项目侧自行扩展。

- 错误做法：用 `frame.includes("cabin")` 判断"是不是船舱镜头"——漏检/误检会让约束悄悄丢失（false-green）。
- 正确做法：权威源里显式声明，bridge 只消费声明：
  - storyboard 每段加 `spaceIds: ["S01"]`；每 cut 加 `cameraId`（真实机位枚举）、`spaceVisibility`、`blockingState`（引用空间圣经 `blocking_states` 的 key）。
  - art 场景对象及其 `lighting` 变体加 `spaceId`（光照变体另加 `spaceVisibility`）。
  - bridge 据此注入，**不扫描 frame 文本猜 cabin**。

### 3.4 空间可见度分级（`space_visibility`，与 `camera_id` 独立维度）
决定注入约束的强度，写在空间圣经枚举、由每个 cut 的 `spaceVisibility` 声明：

| 等级 | 含义 | 注入内容 |
|---|---|---|
| `full` / `inside` | 完整舱内 | 六凳全拓扑 + 锚点 + occupancy（沈已落座、需锁定全部座位布局） |
| `cabin-opening` / `partial` / `cabin-entry` | 只可见舱口框景 / 方向 | 只写舱口框景 + 朝向，**不强制六凳全部可见**（映射为 `opening` 级） |
| `incidental` | 只锁船体 + 帆布棚 + 可见锚点 | 人物不在舱内座位区（如船头单切借位看到船体） |
| `exterior` / `mid-river-exterior` / `bow-exterior` / `none` | 外景 | **不注入**舱内前缀（prefix 为空） |

> 关键防坑：`cabin-entry` 必须映射到 `opening` 级并纳入「应注入集合」，否则会出现「源里出现 1 个 cabin-entry、实际也注入了，但检查报告按等级求和时被静默吞掉」的假绿。

### 3.5 `occupancy` 推导的精确性（重要坑）
由 `blocking_states[stateKey]` 推导占用串（`C0x@Seat`）。**只把「确实落座/处于该座位」的语境算占用**；叙事里 `not yet at P3` / `about to take P3` / `near ... P3` 等「尚未落座」语境里的座位编号**不算占用**，否则桥接会错误注入 `C01@P3`（假绿）。建议实现：

```js
occupancyOf(stateKey) {
  const state = bible.blocking?.blocking_states?.[stateKey];
  if (!state) return [];
  const NEG = /(not yet|not seated|unseated|about to|near|still|will take|to take|toward|hasn't|has not|has no|without sitting)\b/i;
  const out = [];
  for (const [role, desc] of Object.entries(state)) {
    if (role === "note") continue;
    const seats = desc.match(/\b[PS]\d+\b/g) || [];
    for (const s of seats) {
      const idx = desc.indexOf(s);
      const pre = desc.slice(Math.max(0, idx - 18), idx); // 取座位前 18 字符上下文
      if (NEG.test(pre)) continue;       // 仅「已落座/在…」语境才计为占用
      out.push(`${role}@${s}`);
      break;                             // 一个角色只取第一个有效占用座位
    }
  }
  return out;
}
```

### 3.6 `camera_id` = 真实机位，与景别严格分离
- 机位枚举写在空间圣经 `camera_positions`（如 `BOW_TO_STERN` / `PORT_TO_STARBOARD` / `BOW_EXTERIOR`），是物理摄影位置。
- 景别（medium/wide）是构图，不直接等同于机位；bridge 不从景别猜机位，`cameraId` 必须来自 cut 声明且命中枚举。

---

## 4. 母版派生（六张图是验证集，非六张独立概念图）

1. 先制作**确定性**俯视平面图 + 侧视结构图（可手绘/矢量，不依赖文生图），审批尺寸/编号/入口/立柱/铜铃。
2. 生成 1 张**空舱主母版**。
3. 其余正反向大全景 + 左右舷斜视**必须从已批准母版派生或编辑**（非独立文生图）。
4. 最后制作含剧情人物的**走位母版**，人物按 `blocking_states` 落位。
5. ≤3 张参考图是默认策略不是绝对规则；真正原则：① 船舱母版必须存在；② 人物参考按镜头最少化；③ 多人镜头先做一张通过审核的走位母版，再由它派生近景。

---

## 5. 「同源」= 从同一 JSON 编译成不同用途（非同长前缀）

| 用途 | 编译内容 |
|---|---|
| 场景母版 (scene master) | 完整空间结构（无 camera_id，母版本身） |
| 分镜首帧 (frame) | 可见结构 + **真实机位 camera_id** + 人物占用 occupancy（由 blocking_state 推导 `C0x@P2`） |
| 近景 (close-up) | 母版引用 + 当前可见锚点 |
| h3Prompt | 按段 `spaceIds` **+ 段首帧类型**注入稳定句，覆盖**全部舱内段**（不只首帧）。首帧是外景的混合段只强调「同一艘船的船体/材质/铜铃一致、舱内切镜保持批准母版座位布局」，**不把 `first frame` 当所有段的固定模板** |

> H3 稳定句**不重新长篇描述整艘船**（否则视频模型重新解释空间）；只强调「保持稳定、禁止结构增删形变漂移」。
> 分段防冲突：登船过程段不要写「座位与本段首帧完全相同」；允许新人进入的段，只锁已落座角色与结构，显式允许目标角色按分镜移动（避免 "seating exactly" 被理解为不许新人进入）。

---

## 6. 自动检查（文本层，能验/不能验要分清）

船舱镜头提示词必须满足（脚本可查）：声明 `space_id`、合法 `camera_id`、带 `space_version`、occupancy 座位合法。

**断言式核对，杜绝 false-green**：`check` 从源 JSON 推导"应注入约束的实体数"（场景主图+光照 / 分镜首帧 cut / H3 段），与派生文件实际带 `[space_id=...]` 前缀的行数做**相等断言**。进一步按 visibility 等级**逐项**断言（每级 应=实），并**显示源中出现的每一个等级（含 0 计数）**，任何等级（如 `cabin-entry`）不被静默忽略。还应加**状态语义/时序断言**（直接读源 JSON，不依赖派生文本）：如「某 cut 禁止 ALL_SEATED」「某 cut 禁止 C01@P3」「某 cut 必须包含 C01@P3」。

**文本检查只能验证「提示词是否带了约束」，不能验证「图片里确实有六张凳子」。图片空间检查仍需人工审核。** 自动检查是必要非充分条件。

### 6.1 自测固化（推荐）
把关键防护写成可重复自测（如 `selftest-spatial.mjs`）：在临时副本（沙箱）上跑破坏性/边界用例，断言 exit code，运行完自动清理、不污染真实工程。建议覆盖：
- P9 双人占同座冲突（loader 应拦截）
- 缺失/过期版本戳（check 应拦截）
- 外景误注完整六凳（check 应拦截）
- `cabin-entry` 漏注入（check 应拦截）
- 某 cut 错用 `ALL_SEATED`（语义断言应拦截）
- 内外混合段 H3 首帧类型（正常工程应通过）

---

## 7. 常见失败模式（踩过的坑，沉淀为纪律）

| 失败模式 | 症状 | 治法 |
|---|---|---|
| 只在文档写「引用空间」 | 各图各写结构，换个机位就漂移 | 结构只存在于空间圣经；桥接脚本读取并注入，禁止手改派生 |
| 用关键词推断舱内镜头 | `frame.includes("cabin")` 漏检/误检，约束悄悄丢失 | 注入依据全来自结构化声明（cut.spaceId / spaceVisibility / cameraId / blockingState） |
| 总数相等但分类错位（假绿） | 应注入 22+4=26 看似对，实际漏了某 visibility 级 | 按 visibility 等级**逐项**断言（每级 应=实），并**显示源里出现的每一个等级（含 0 计数）**，无等级被静默忽略 |
| occupancy 误判 | 桥接给「尚未落座」的角色错误注入 `C0x@P3` | occupancy 推导过滤 not-yet/about-to/near 等尚未落座语境（见 schema §10.2） |
| 外景误注完整六凳 | 外景 cut 被注入舱内六凳拓扑 | visibility 分级编译：exterior/none 不注入；检查对「exterior 却含六凳」报错 |
| H3 把 first frame 当固定模板 | 混合内外景段稳定句套用别的段首帧 | 稳定句按**段首帧类型**生成，不跨段套用 |
| 中英混杂进模型 | H3 写「Keep the 渡船船舱 structure」 | 加 `scene_name_en`，H3 稳定句统一用英文 |
| 母版与分镜图互锁失败 | 同一空间出多张互相矛盾的概念图 | 母版优先派生；参考图纪律见 `card-schema.md` 的「参考图约束纪律」 |
| 决策项静默替用户拍板 | 圣经与分镜对同一空间事实矛盾 | 空间冲突整理为明确决策项（A/B + 推荐 + 动线图），待审批后再回填，不静默选边 |

---

## 8. 真实案例（简述）

**渡口（DJ-demo）船舱**：一艘木渡船，左舷 P1-P3 / 右舷 S1-S3 各三张短凳 + 中央过道，铜铃固定在右舷船头立柱，老周在船头撑篙。多集多镜头 + 文生图导致船舱结构漂移。按本机制落地后：空间圣经单一事实源、桥接按分级注入、H3 按段首帧稳定、断言式检查（分等级逐项 + 状态语义断言）+ 可重复自测，全部通过。其完整迭代流水账（P0→P0.2.1 各轮修复与验证记录）保留在 DJ-demo 本地 `docs/`，不进入本 skill 资源。

---

## 9. 相关资源

- 字段契约：`space-bible-schema.md`（必填/可选/仅 draft、occupancy 推导、最小合法 JSON）
- 参考图纪律：`card-schema.md` 的「参考图约束纪律」
- 母版派生、逐张空间验收：见本文件第 4、6 节
