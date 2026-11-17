[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-8b1a1a?style=for-the-badge)](README.md)
[![English](https://img.shields.io/badge/English-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.en.md)
[![日本語](https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.ja.md)
[![关注作者 X](https://img.shields.io/badge/%E5%85%B3%E6%B3%A8%E4%BD%9C%E8%80%85-%40eternityspring-b07070?style=for-the-badge&labelColor=8b1a1a&logo=x&logoColor=f2e3e3)](https://x.com/eternityspring)

# novel-staging

给 AI 短剧的每一场排**开场站位**：这一场一开始，每个出场的人在哪件东西旁、坐还是站、面朝哪。

**为什么要单独排**：短剧的每一段视频是一次独立生成，各段自己决定谁坐哪。群戏里六个人围一张长桌，第一段桌边多出五个没名字的宾客，第三段端酒坐着的人穿着主角的衣服。分镜的走位句一段接一段地交接，可每一场**第一段**的那一句是分镜自己编的。所以在分镜之前，每场先定一份站位，分镜照抄。

- **先认图** — 从场景图的主视角里认出人会站在旁边、坐在上面的东西（4–20 件），推算到俯视平面上。站位只落在图上真有的东西旁：提示词里写了、图上没画的高台，人坐上去，每段视频都不一样
- **再排站位** — 谁开场就在、谁后来才进；坐还是站跟着剧本；长辈坐主位、对立的两方隔桌相对、被孤立的坐末位；剧本没写有别人就没有群演
- **走位句由程序写** — 「胡二爷坐在第三排坐板上，面朝北；其余座位空着，没有其他人。」分镜这一场第一段照抄它
- **报告能调整** — 每场一张俯视平面，人可以拖动，点一下调整坐站和朝向，改完导出就是新的 staging.json

**默认交付 `staging-report.html` HTML 工具报告**：双击打开，拖动调整人物位置、坐站和朝向，在页面内导出修改后的 JSON。`staging.json` 同时作为工作数据保存，Markdown 仅在需要文本版时通过 `--md` 导出。报告界面默认中文；render 加 `--lang en` 输出英文界面（走位句改用认图时写的英文名字）。

![staging-report.html](assets/report.webp)

## 质量门：8 道，全是代码

| 门 | 规则 |
| --- | --- |
| 认了图 | 每个地点 4–20 件东西 |
| 东西的写法 | 名字不重复；平面位置是合法的框；按图认的必须有图上的框 |
| 地点有着落 | 每一场的地点都有认图结果（给了 art.json 还核对地点编号） |
| 出场人物 | 每个人正好一条，不多不少；给了 script.json 还核对跟剧本一致，不给就**明说没核对** |
| 在不在场 | 每个人都定了开场在不在，至少一个人在场 |
| **落在认出来的东西上** | 在场的人站的东西必须在认图结果里；只有能坐能站的东西才能写「在它上面」；方位、坐站、朝向合法 |
| 不叠人 | 同一件东西同一侧的两个人沿这一侧拉开 |
| 群演 | 人数是整数；有群演写明在哪，没有就不写 |

自测里每道门都有**击穿用例**——证明它真的会拦。

## 报告：能拖动的俯视平面

- 按住一个人拖到平面上别处，松手时落在最近那件东西最近的一侧；落在能坐的东西里面就坐在它上面。换了一侧，人自动转过去面朝那件东西
- 平面下面是「开场不在场」的托盘：拖进平面就是在场，拖回托盘就是不在
- 点一下一个人，调整坐着／站着、八个方位的朝向
- 群演加减、写在哪；开场走位句和这一场的检查跟着实时更新
- 有场景图时，鼠标移到一件东西上，图上它的框亮起来，对着图核对
- 改动存在浏览器里，刷新不丢；「导出 JSON」下载改过的 staging.json，喂回 `validate` 照样能用

页面上的算法跟命令行是同一份：拖动落点、平面上的点、走位句、检查规则都由 `stagingCore()` 算，整个嵌进页面。

## 在管线里的位置

```
novel-outline    → outline.json （人物名字）
novel-art        → art.json     （地点 + 场景图）
novel-script     → script.json  （每一场谁出场、怎么演）
novel-staging    → staging.json （每一场开场谁在哪）
novel-storyboard → storyboard.json
```

- `seed <script.json> --art <art.json> --outline <outline.json>` 确定性预填地点、场次、出场人物
- novel-storyboard 目前不自动读 staging.json：`blocking` 命令打出每一场的开场走位句，写进分镜每场第一段的 `blocking`

## 命令行直接使用

```bash
node scripts/novel-staging.mjs seed script.json --art art.json --outline outline.json > staging.json
node scripts/novel-staging.mjs validate staging.json --script script.json --art art.json
node scripts/novel-staging.mjs checkup staging.json                 # 只跑质量门
node scripts/novel-staging.mjs render staging.json > staging-report.html  # 默认 HTML 工具报告
node scripts/novel-staging.mjs render staging.json --lang en > staging-report.html # 英文界面报告
node scripts/novel-staging.mjs render staging.json --md > staging.md # 按需导出文本版
node scripts/novel-staging.mjs blocking staging.json                 # 每场的开场走位句
```

## 文件

```
SKILL.md                 给 agent 读的工作流
scripts/
  novel-staging.mjs      seed / validate / checkup / blocking / render / slug
  selftest.mjs           99 项断言，不调模型
references/
  schema.md              staging.json 结构 + 坐标系
  read-pass.md           怎么从场景图里认东西（没有图时怎么推算）
  staging-pass.md        怎么排开场站位、怎么按一句话调整
  report-style.md        报告和拖动画布的设计约定
  test-fixtures/upstream/  上游样例的拷贝，只给自测使用
examples/
  渡口-staging.json       《渡口》三个地点、九场的开场站位，全部质量门通过
assets/
  report.webp            报告截图
```

## 自测

```bash
node scripts/selftest.mjs
```

99 项断言，覆盖平面几何 / 拖动落点 / 走位句 / seed / 8 道门逐项击穿 / 渲染（中英界面、转义、嵌图），还会单独拿嵌进页面的那份算法的源码重建一份核对。不调模型、不花额度、1 秒跑完。改完脚本先跑这个。

**只在 macOS + Node 24 上实测过。** 代码没有平台相关调用，Linux 和更低版本 Node 理论上没问题，但**没验过**。
