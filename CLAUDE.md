# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ 這個 repo 一律用台灣正體中文

上游是簡體中文專案（見下方「fork 關係」），**這個 fork 已經全面轉成台灣正體**。
不管是文件、程式碼註解、commit message、CLI 訊息、還是你回覆使用者的話，**一律台灣正體中文**。

**不是把簡體換個字形就好，用詞也要換：**

| 別寫 | 要寫 |
| --- | --- |
| 软件、硬件、网络、程序 | 軟體、硬體、網路、程式 |
| 视频、质量、信息、数据 | 影片、品質、資訊、資料 |
| 默认、通过、支持、屏幕 | 預設、透過、支援、螢幕 |
| 打印、分辨率、缺省 | 列印、解析度、預設 |
| 性格、水准、计划 | 個性、水準、計畫 |
| 搜索、出图、反向提示词 | 搜尋、生圖、負向提示詞 |

**一簡對多繁的字最容易翻錯**，角色外貌描寫幾乎必踩：

| 簡 | 看語境選 | 例 |
| --- | --- | --- |
| 发 | 髮／發 | 頭**髮**、一**頭**長**髮**；**發**現 |
| 干 | 乾／幹／干 | **乾**淨、**乾**瘦；**幹**活 |
| 里 | 裡／里 | 眼**裡**、**裡**面；公**里** |
| 松 | 鬆／松 | **鬆**垮、**鬆**弛；**松**樹 |
| 丑 | 醜／丑 | **醜**陋；**丑**角 |
| 面 | 面／麵 | **面**容；**麵**條 |
| 只 | 只／隻 | **只**是；一**隻**手 |
| 复 | 復／複／覆 | 恢**復**；**複**雜；答**覆** |
| 系 | 係／系／繫 | 關**係**；**系**統；維**繫** |
| 表 | 表／錶 | **表**格；手**錶** |
| 板 | 板／闆 | 木**板**；老**闆** |

引號用「」『』，不要 `""`。

### 唯一的例外：`STRINGS.zh`

`skills/novel-characters/scripts/novel-characters.mjs` 的 `STRINGS` 表裡，**`zh` 那一整套必須維持簡體**——那是 `--lang zh` 這個功能本身，不是待翻譯的內容。改了簡體報告就廢了，自測也會擋下來。

同理，`selftest.mjs` 裡拿簡體字串做斷言的那幾行（驗證 `--lang zh` 輸出）也不能動。

## 常用指令

所有指令都零依賴，只要 `node` >= 18，沒有 npm 套件、沒有 build 步驟。

```bash
cd skills/novel-characters

node scripts/selftest.mjs                              # 全部自測（264 項，不呼叫模型，約一秒）

node scripts/novel-characters.mjs                      # 印出用法
node scripts/novel-characters.mjs chunk book.txt /tmp/wk       # 切塊
node scripts/novel-characters.mjs merge /tmp/wk                # 歸併 roster-*.json
node scripts/novel-characters.mjs validate cast.json book.txt  # 校驗，有違規 exit 1
node scripts/novel-characters.mjs render cast.json --html      # 輸出到 stdout
node scripts/novel-characters.mjs styles [id]                  # 印出畫風預設完整內容
node scripts/novel-characters.mjs ui-template <lang>           # 印出介面文案骨架
node scripts/novel-characters.mjs slug "胡二爺"                 # 安全檔名
```

**沒有測試框架，`selftest.mjs` 是一支從頭跑到尾的腳本**，用 `node:assert`。第一個失敗的斷言就整支中止，不會跑完全部。要單獨跑某一段就把其他段註解掉，或另寫一支小腳本 import `novel-characters.mjs` 的具名匯出——所有函式都是 `export` 的，可以直接單獨測。

改完腳本一定要跑自測。改完版面或提示詞，再拿 `examples/渡口.txt` 端到端跑一次。

安裝到 agent 的 skills 目錄（軟連結，`git pull` 後立即生效）：

```bash
./scripts/install.sh              # 裝全部，裝到偵測到的所有 agent
./scripts/install.sh --claude     # 只裝到 Claude Code
./scripts/install.sh --uninstall
```

## 架構

### 這個 repo 是什麼

一個 skill 集合，目前只有 `novel-characters`。**Claude Code 和 codex 都能跑**，差別只在生圖那一步。

一個 skill = 一個目錄 + 一份 `SKILL.md`。`install.sh` 認的就是 `SKILL.md` 存不存在。

### 職責切分：模型做判斷，腳本做檢查

這是整個專案的核心設計，改東西前要先理解：

- **`SKILL.md` + `references/*.md`** —— 給 agent 讀的工作流與提示詞。所有需要判斷的事（誰是角色、長什麼樣、聲音如何）都在這裡，由模型做
- **`scripts/novel-characters.mjs`** —— 純確定性工具。切塊、歸併、校驗、渲染。**一次模型都不呼叫**

所以「品質」不是靠模型自覺，是靠 `validate` 擋。四類硬規則（見 `SKILL.md` Step 7）都是模型真的違反過、被腳本當場抓住才立起來的。**加規則的正確位置是 `validate`，不是在提示詞裡多寫一句「請注意」。**

### 兩趟流程

```
book.txt
  │ chunk          切成 14k 字元、600 字元重疊的塊（重疊是為了讓卡在切口
  ↓                上的角色兩邊都看得到），上限 24 塊
chunk-NN.txt
  │ 第一趟：每塊一個子代理，照 references/roster-pass.md 掃角色
  ↓                子代理看不到原文，後一趟只看得到它寫的 note
roster-NN.json
  │ merge          按 name + aliases 收斂（陸行遠／陸／姑娘 是同一人），
  ↓                notes 累加、quotes 去重，按出現塊數排戲份
歸併後的 cast
  │ 第二趟：每個角色一個子代理，照 references/profile-pass.md + schema.md 出卡
  ↓
cast.json ──→ validate ──→ 生圖（可選）──→ render ──→ report.html
```

`chunk` / `merge` / `validate` / `render` 是腳本；兩趟是模型。**Step 7 的 validate 不能跳**。

### 三套互相牽制的機制

改任何一套之前先確認另外兩套：

**1. 語言（`lang`）**

`STRINGS` 表內建 `zh-TW` / `zh` / `en` / `ja` 四套介面文案，預設 `zh-TW`。
其他任何語言碼一樣支援：agent 現場翻一份塞進 `cast.json` 頂層的 `ui`，`strings()` 合併進內建表。不給 `ui` 的話 `validate` 會擋，免得出現「角色內容是法文、介面是英文」的半吊子報告。

**欄位分工是硬規則**：人類可讀欄位跟隨 `lang`；`image.prompt` / `negativePrompt` / `tags` / `sheet` / `voice.prompt` **永遠英文**（生圖和 TTS 引擎吃英文最穩）；**原文引文永遠保持原文語言**（翻譯了就不是證據）。

**簡繁之分腳本判不了**——`validate` 只查「是不是中文」。台灣用詞靠 `SKILL.md` 的用語規範約束生成階段。

**2. 畫風預設（`style`）**

`STYLE_PRESETS` 有 `realistic`（預設）/ `ghibli` / `photoreal`，每個自帶 render / surface / lighting / negative / tags **五塊，整塊取用不混搭**。

**最容易搞反的是負向提示詞，三個預設的立場兩兩不同**：

| 預設 | 禁 `photorealistic`？ | 禁 `illustration`／`anime`？ |
| --- | --- | --- |
| `realistic` | 絕不能 | 不禁——它本來就是畫出來的 |
| `ghibli` | 必須 | 不禁 |
| `photoreal` | 絕不能 | 必須 |

`validate` 判斷「該不該禁寫實」是拿**預設自己的 `negative`** 當基準，所以新增預設不用回頭改校驗邏輯——把立場寫進 `negative` 就行。

**版面規則（16:9 三區、34%/66% 比例、細節讓位不是人物讓位）不隨風格變**，變的只有渲染質感。

**3. 報告版面**

樣式全部內聯在 `renderHtml()` 裡，**只改那一處**，不要另起模板。設計約定與「為什麼長這樣」在 `references/report-style.md`——改樣式前先讀，別把它改回通用卡片牆。

尺寸有硬性連動：頁面上限 1800px、卡片 `minmax(460px)`、間距 28px，這三個數決定了「一排最多三個角色」，**改一個要重算另外兩個**，自測有斷言盯著。每個角色 8 個複製按鈕也有斷言盯著。

### `examples/` 同時是三種東西

`渡口.txt` / `渡口-cast.json` / `渡口-cast.md` 是範例、是品質基準、**也是自測夾具**。`selftest.mjs` 直接讀它們跑斷言。

所以動 examples 要特別小心：`cast.json` 的 `persona.evidence` 必須是 `渡口.txt` 的**逐字連續**片段，`validate` 會逐條比對。改了原文就要同步改所有引文。

### Windows 注意

`chunkText()` 內部會把 `\r\n` 正規化成 `\n`。任何拿原文跟切塊結果比對的地方都要先正規化，否則 git 把樣例 checkout 成 CRLF 時會全線失敗，而 macOS／Linux 上看不出來。`selftest.mjs` 讀樣例時已經做了。

## fork 關係

| remote | 指向 |
| --- | --- |
| `origin` | `swanky/shuohao-skills`（這個 fork） |
| `upstream` | `eternityspring/shuohao-skills`（上游，簡體） |

拉上游更新：

```bash
git fetch upstream && git rebase upstream/main
```

**上游是簡體專案，rebase 一定會有簡繁衝突。** 解衝突時一律取正體版本，並把上游新加的簡體內容一併轉成正體再提交。上游新增的功能（新語言、新畫風預設、新校驗規則）要照這份文件的規範補上正體。

本 fork 相對上游的差異記在 `CHANGELOG.md` 的 1.5.0 條目。
