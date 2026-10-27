# AGENTS.md

## 行为规则

- 中文文案（README、SKILL.md、报告界面标签）不用单字词：「保留/砍掉/合并」不写成「保/砍/合」，「安装」不写成「装」，「使用」不写成「用」。章节标题同样适用。
- skill 必须自包含、可单独拷走：不依赖任何第三方 skill（包括官方 skill）。外部方法论学习后内化成本仓库自己的 references 文档，注明学习来源。
- **样例数据先定故事，再定分镜。** 反过来做会把自己焊死：画面一旦写实（「桌上摆着一封信，父亲按着不给」），之后每次「换故事」都只是给同一个动作换一个动机，三版听起来是同一版。故事没定之前不要写分镜、更不要出图。
- **每个 skill 的样例数据必须是它自己的**，不借用兄弟 skill 的样例。借来的样例既是断链（skill 要能整个拷走），也只能展示别人那一种题材。
- 渲染产物（`gallery.html`、`*-report.html`）不进版本控制，它们每次 `render` 都能重新生成。
- **门失败累积（`.gates.jsonl` + `stats`）目前只在 novel-storyboard 上。** 这是有意的：先在真实项目里用一段时间，确认 `stats` 出来的东西真的指向了该改的规则，再决定要不要推广到其余五个。**如果长期没人打开它，说明这个功能不该做，推广只会把错误复制五份。** 不要主动再提推广。

## 项目流水线（preview/pipeline）

- `preview/pipeline/project.mjs` 是**编排器**，不是新 skill：它只复制样本、跑各 skill 的 validate/render/export、把分镜合成视频，不写任何 skill 的业务逻辑。skill 改渲染，这里自动跟上。
- `projects/` 是生成物，进 `.gitignore`，不入版本控制。
- 新项目从剧本走：`new --script`（md/txt/json）→ `from-text` 生成 script.json 草稿 → 六个 skill 逐个 validate → `render` → `video`。
- `frames/` 为空时视频用文字卡代替分镜图，并在输出里明说「仍是 placeholder」——不要把它当成分镜图已出。

## Studio（web 粘贴剧本 → 自动拆分）

```bash
node preview/pipeline/studio.mjs          # http://127.0.0.1:4321/ （只监听本机）
node preview/pipeline/selftest.mjs        # 拆分器 + API + 无头浏览器，全部不出网
```

- `split.mjs` 是**确定性拆分器**：认影片名 / 题材 / 集数 / 单集秒数、`- C01 名字 (别名)`、`## Tập N`（或 `第 N 集`）、`Bối cảnh:` 里的 `S01`、编号行、`名字: 台词`。它不调用模型。
- 拆分结果 `split.json` 与草稿 `outline.json` / `script.json` 只是**草稿**；`project.json` 的 `stages` 标成 `draft`，必须由 `.kilo/command/new-project-from-script.md` 的流程补写并过门。
- `book.mjs` 把粘贴的 `kichban.md` 转成 `book.txt`（每句台词一行），这样 `persona.evidence` 可以逐字引用原文又保持越南语语序。
- 名字没有声调（如 `A Minh`）的说话人标签只有在角色表里声明过才算台词，否则算动作句——避免 `Ngoài cửa:` 这类误判。
- **production manifest**（`schema_version: 1.0`，字段 `project/story/entities/voices/scenes/shots`，可包在 `{script:{…}}` 里）由 `import-manifest.mjs` 转成 outline / cast / art / script 四层：一个场景 = 一个「集」，`shots[]` 的 `dialogue` 拆成 ≤35 字的句子（切点记录在 `delivery · slot Ns`），道具/地点来自 entities，prompt 会剔除 `AN`/`MAI` 这类实体 id。storyboard **不自动生成**——manifest 的 shot 是 4–11 秒，H3 要求 2–5 秒/切，必须由 agent 重排。
- 上传支持**一次多个文件**：`POST /api/assemble {files:[{name,content}], slug}` 把 outline/script/cast/art/staging/storyboard 中任意组合写成一个项目（`buildFromFiles`），缺哪层就在 `project.json` 标 `none`；`/api/upload` 单文件返回 `kind`（outline|script|cast|art|staging|storyboard|text|txt|md），UI 据此把文件排进对应层。
- 剧本可以**粘贴**也可以**上传文件**（`.txt` / `.md` / `.json`，≤2 MB）：`POST /api/upload?name=<tên file>` body 是原始字节。`.txt/.md` 原样读（自动去 BOM、`\r\n`→`\n`、UTF‑16LE、HTML 去标签）；`.json` 认 script.json（转成文本走同一拆分器）或 `{script|text|content}`；其他后缀 400 并列出支持的格式。实现在 `upload.mjs`。`outline.json` 会转成「每集 synopsis 一行」的草案；`script.json` 转成「Tập / Bối cảnh / 编号 + Tên: lời thoại」再走同一个拆分器；散文剧本（`PHẦN I`、`Q01 | 00:00–00:05`、`TÊN: “…台词…”`）也能读，`PHẦN … HỒ SƠ/THÔNG SỐ` 段自动跳过。
- 界面语言：studio 由服务端注入 `/language.js` + `/translations.json`（与报告同一份），`?lang=vi|en|zh` 切换。新增界面文案要同时补 `web/translations.json` 并复制到 `preview/`，否则英文/中文界面会漏那句。
- Studio 只服务 `projects/` 下的文件（含视频 Range），拒绝 `..`；写操作只在新项目目录内。
- **前端是 hash router，不是多页**：`#/` 介绍页、`#/projects` 项目列表、`#/new` 粘贴建项、`#/project/<slug>/<stage>` 某一层、`#/report/<slug>/<file>` 报告（iframe 内嵌，左侧切换）。新增页面就加一条路由分支 + 面包屑，**不要用 `target=_blank` 把人甩出应用**。`<a href="#/...">` 保留原生行为以便浏览器前进后退，只有 `button[data-nav]` 才走 `preventDefault`。
- **只有一个端口**：`node preview/pipeline/studio.mjs` → http://127.0.0.1:8765/ 。同一进程既提供 studio（`/`、`#/…`），又提供 `preview/` 里的静态报告（`/report.html`、`/staging.html` …），不要再起 `python -m http.server`。`/` 是介绍页，`#/projects` 才是列表。
- 每层有一个数据视图（脚本层是台词表、分镜层是段/切、美术层是场景与道具……），不用读 JSON 也能过一遍；报告仍可看原文渲染。
