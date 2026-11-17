[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-8b1a1a?style=for-the-badge)](README.md)
[![English](https://img.shields.io/badge/English-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.en.md)
[![日本語](https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.ja.md)
[![关注作者 X](https://img.shields.io/badge/%E5%85%B3%E6%B3%A8%E4%BD%9C%E8%80%85-%40eternityspring-b07070?style=for-the-badge&labelColor=8b1a1a&logo=x&logoColor=f2e3e3)](https://x.com/eternityspring)

# novel-script

给 AI 短剧写**剧本**：把 novel-outline 的分集梗概落成场次和台词。前提刻在骨子里：**剧本管戏，分镜管拍**——「爽不爽」和「怎么拍」是两种迭代节奏，台词要反复推翻重写，绑上镜头分解每改一句都得重排镜头。所以这层没有镜号、没有首帧提示词，那些是下一层分镜 skill 的活。

但守住一条底线：**台词是结构化数据，不是散文**。

- **节拍流** — 每场戏是动作节拍与台词行的交替序列：动作一拍一件事（叙述体），台词逐句带说话人与语气。台词直接对接 TTS 逐句生成，动作节拍就是画面要发生的事
- **逐集时长预算** — 台词按语速折算（默认 4.5 字/秒）、动作按节拍估时（默认 2.5 秒/拍），每集必须落在目标 ±15% 内。**一集三分钟就是三分钟**，写超写欠当场拦下，不流到生成环节才发现
- **开场钩子 + 结尾悬念** — 每集都要落在纸面；**钩子不是标签是第一拍**：`hookBeat` 认领具象位置，必须在全集前 3 拍内冷开场兑现；认领的大纲爽点必须有戏扛
- **画外音记号** — `VO` 统一标心声与旁白，谁的心声写在语气栏里，台词本里单独成组

产出 `script.json` + Markdown + 一个双击就能开的 `script-report.html`：

![script-report.html](assets/report.webp)

## 质量门：10 道，全是代码

与仓库里另外三个 skill 同一主张：**checklist 交给模型自觉是靠不住的**。

| 门 | 规则 |
| --- | --- |
| **每集时长** | 预估落在 `targetSeconds` ±15% 内（语速、节拍秒数、容差都在 `params` 里可调） |
| 单句台词长度 | ≤ 35 字——一口气说不完的台词也生成不了 |
| 说话人合法 | speaker 必须在本场人物里，或明确标 `VO` |
| 钩子悬念落纸 | 每集 `hook` / `cliff` 必填 |
| **钩子前 3 拍兑现** | `hookBeat` 认领钩子具象的位置，必须落在全集前 3 拍内——冷开场是门不是自觉，钩子和开场从此衔接得上 |
| **每场至少一个动作节拍** | 纯对白的场是广播剧，AI 生成时没有画面可写 |
| 动作叙述体 | 动作里不许出现引号台词——台词只能进 dialogue 字段 |
| 爽点认领 | 大纲说这集有的爆点，剧本必须认领（给 `--outline` 才查，不给**明说跳过**） |
| 角色对账 | 出场角色都在大纲角色表里（给 `--outline` 才查） |
| 场景对账 | 场景存在、**光照状态是美术设定里登记过的**、道具存在（给 `--art` 才查） |

自测里每道门都有**击穿用例**——证明它真的会拦。

## 报告长什么样

业内评审用的单页报告，页宽 1600。界面默认中文，render 加 `--lang en` 输出全英文界面： 英文界面下质量门标签同样翻译（阈值原样），门的失败详情与数据内容保持原文。

- **KPI 带**：集数 / 预估总时长 vs 目标 / 台词句数 / 台词占比 / 平均每场——换景次数只是统计不设门，AI 换景不要钱
- **时长仪表**：每集一行条形图，台词与动作堆叠，打在目标区间的绿带上；超时欠时红字点名差几秒
- **分集剧本**：主体，**一排两集**。集头（预估/钩子/悬念/爽点章）永远可见，场次信息默认最多 300px 渐隐截断，点开看全部、再点收起；台词行悬停可单句复制
- **场次总表**：全部场次 × 场景 × 光照 × 人物 × 估秒，自动汇总，模型不写
- **台词本**：**一排两个**，按角色聚合全部台词，列表最多 6 行高可滚动，带集/场引用和「复制全部台词」；给了 `--cast` 每个角色组头还带**音色提示词**按钮——台词和音色一页配齐，直接跑 TTS
- **质量门**面板 + 页眉徽章 + **导出 JSON**（下载的就是 `script.json` 原样，改完能直接喂回 `render` / `validate`）
- 全部图形是内联 CSS/SVG，零外部依赖，离线双击能开

## 跟另外三个 skill 的接力

```
novel-outline    → outline.json （什么：结构与分集）
novel-characters → cast.json    （谁：角色资产）
novel-art        → art.json     （哪里 + 手里拿的：美术资产）
novel-script     → script.json  （戏：场次、节拍、台词）
```

- `seed <outline.json> --eps 1-3` 确定性预填每集骨架：目标秒数、钩子、悬念、爽点认领、候选场景人物
- `validate --outline --art` 三向对账：角色、爽点、场景/光照/道具。剧本里写了美术没登记的光照状态，当场报——去 art.json 补状态，不是绕过门
- `render --outline --art` 把报告里的 `C01` / `S01` 显示成人名和场景名——**数据里存编号，界面上看名字**

往下一层是分镜 skill：镜号、单镜头时长、首帧提示词、生成批次单都在那边。

## 命令行直接用

```bash
node scripts/novel-script.mjs seed outline.json --eps 1-3        # 预填骨架
node scripts/novel-script.mjs validate script.json \
     --outline outline.json --art art.json                       # 校验
node scripts/novel-script.mjs checkup script.json                # 只跑质量门
node scripts/novel-script.mjs render script.json --html \
     --outline outline.json --art art.json \
     --cast cast.json > script-report.html                       # 出报告（--cast 带音色提示词）
node scripts/novel-script.mjs render script.json --html --lang en \
     --outline outline.json --art art.json > script-report.html  # 英文界面报告（默认中文）
node scripts/novel-script.mjs slug "渡口"                         # 安全文件名
```

## 边界

- 不分镜头、无镜号、不写画面生成提示词、不出图——分镜层的活一件不碰
- 时长是**估算不是秒表**，容差 ±15% 就是为此留的；配音语速不同就调 `params.charsPerSecond`
- 报告界面内置中英：render 加 `--lang en` 输出全英文界面（默认中文，或跟 script.json 顶层的 `lang` 字段）；台词语言跟剧走
- 一次建议写 ≤ 3 集——剧本是全管线改得最凶的一层，小批量出、快拍板、再往下写

## 文件

```
SKILL.md                 给 agent 读的工作流
scripts/
  novel-script.mjs       seed / validate / checkup / render / slug
  selftest.mjs           154 项断言，不调模型
references/
  schema.md              script.json 结构 + 时长折算规则
  script-pass.md         写戏：硬规则、手感规则、常见病
  report-style.md        报告的设计约定
examples/
  渡口-script.json        《渡口》全 6 集完整剧本（每集冷开场兑现钩子），全部质量门通过，也是自测夹具
assets/
  report.webp            报告截图
```

## 自测

```bash
node scripts/selftest.mjs
```

154 项断言，覆盖时长引擎 / 统计 / 质量门逐项击穿 / seed / 渲染（含英文界面）/ 导出。不调模型、不花额度、1 秒跑完。改完脚本先跑这个。

**只在 macOS + Node 24 上实测过。** 代码没有平台相关调用，Linux 和更低版本 Node 理论上没问题，但**没验过**。
