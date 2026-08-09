---
name: novel-characters
version: 1.5.0
description: |
  從小說或短故事裡拆出角色表、人物側寫、造型提示詞、音色提示詞，
  並給主要角色出角色設定圖（左半身像 + 右全身三視圖 + 細節條），產出 JSON + Markdown + 可互動的 report.html。
  報告語言可指定（--lang），預設台灣正體中文（zh-TW），任意語言都支援；
  生圖風格可指定（--style），預設半寫實，也可以出吉卜力動畫風或擬真實拍。
  零相依、零 API key，用當前工作階段額度；生圖走 codex 內建 $imagegen（可選）。
  Use when asked to 拆小說角色、分析人物、產生角色卡、character sheets from a novel。
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-characters
  - 拆角色
  - 拆書角色
  - 拆书角色
  - 小說角色
  - 小说角色
  - 人物側寫
  - 人物画像
  - 角色卡
  - 三視圖
  - 三视图
  - character sheet from novel
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18，只用標準庫，無 npm 相依
    optional:
      - codex         # 有才出設定圖；沒有就只交提示詞，其餘照常
  runtimes:
    - claude-code
    - codex
---

## novel-characters

輸入一篇小說/短故事，輸出每個角色的：人物側寫、造型提示詞、音色提示詞、角色設定圖。

`{baseDir}` = 本檔案所在目錄。腳本 `{baseDir}/scripts/novel-characters.mjs`，零相依，`node` 直接跑。

**執行環境**：Claude Code 和 codex 都能跑。差別只在第 8 步生圖——見 `references/sheet.md`。

---

### Step 0 — 確定報告語言

使用者可以指定語言，比如「用英文」「--lang en」「日本語で」。**沒說就是台灣正體中文（`zh-TW`）。**

想要簡體中文得明確說，用 `--lang zh`。

這個 `lang` 會一路傳下去：第二趟產生角色卡時決定人類可讀欄位用什麼語言，`validate` 和 `render` 也都要帶上。

**介面文案分兩種情況：**

- `zh-TW` / `zh` / `en` / `ja` —— 內建，不用管
- **其他任何語言** —— 你要現場翻一份。跑

  ```bash
  node {baseDir}/scripts/novel-characters.mjs ui-template <lang>
  ```

  它印出一份英文骨架，把每個值翻譯成目標語言，整塊放進 `cast.json` 頂層的 `ui` 欄位。渲染時會合併進內建表。

  **不給 `ui` 的話 `validate` 會直接報錯**——否則報告會是「角色內容是法文、介面標籤是英文」的半吊子狀態。

支援的語言不受內建表限制，法文韓文西班牙文都能出完整報告。

#### `zh-TW` 的用語規範

介面文案腳本管了，**角色卡內容是你寫的，得你自己守**。寫 `persona`、`voice` 的人類可讀欄位時：

**用台灣慣用詞，不是簡體詞換字形。** 直接換字形會寫出一眼看得出的翻譯腔：

| 別寫 | 要寫 |
| --- | --- |
| 性格、气质 | 個性、氣質 |
| 视频、图片 | 影片、圖片 |
| 质量 | 品質 |
| 信息、数据 | 資訊、資料 |
| 默认、通过、支持 | 預設、透過、支援 |
| 水准、计划 | 水準、計畫 |
| 软件、程序、网络 | 軟體、程式、網路 |

**一簡對多繁的字最容易翻錯**，外貌描寫裡幾乎必踩：

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

**引號用「」『』**，不要 `""`。

**不受影響的**：`image.prompt` / `image.negativePrompt` / `image.tags` / `image.sheet` / `voice.prompt` 這些機器欄位永遠是英文，`validate` 會攔中文字元。

**`persona.evidence` 也不受影響**：引文逐字照抄原文，原文是簡體就是簡體。它是證據，動了就不是證據。

### Step 0.5 — 確定畫風

使用者可以指定生圖風格，**預設 `realistic`**：

| id | 說明 | 什麼時候用 |
| --- | --- | --- |
| `realistic` | 半寫實厚塗。預設 | 一般設定集 |
| `ghibli` | 吉卜力式手繪賽璐璐 | 想要動畫質感 |
| `photoreal` | 擬真實拍，劇組試裝定妝照 | 要真人選角感、歷史劇質感 |

```bash
node {baseDir}/scripts/novel-characters.mjs styles   # 印出預設的完整內容
```

讀 `{baseDir}/references/style-presets.md`。**換風格是整套換**——每個預設自帶 render / surface / lighting / negative / tags 五塊，整塊取用，不要混搭。

最容易搞反的是負向提示詞，三個預設的立場兩兩不同：

- `realistic` / `photoreal` **絕不能**禁 `photorealistic`
- `ghibli` **必須**禁
- `photoreal` 另外**必須**禁 `illustration` / `painting` / `anime` / `cartoon`——它要的是照片不是畫，漏了模型很容易交一張插畫

`validate` 三條都會攔。

版面規則（16:9 三區、比例、細節讓位）**不隨風格變**，變的只有渲染質感。

### Step 1 — 定位輸入

使用者給檔案路徑就直接用。直接貼正文的，**先落到一個暫存 .txt**——後面校驗「引文是否逐字」要拿原文比對，沒有原文檔案這步就沒法做。

確定輸出目錄：使用者指定就用；沒指定就用原書同層目錄。

### Step 2 — 分塊

```bash
node {baseDir}/scripts/novel-characters.mjs chunk <book.txt> <workdir>
```

印出 `{"chunks": N, ...}`。

- **N == 1**：跳過 Step 3，直接在當前工作階段讀原文做第一趟，結果自己寫成 `<workdir>/roster-00.json`
- **N > 1**：進 Step 3
- `truncated: true`：明確告訴使用者尾部沒掃到，別悶著

### Step 3 — 第一趟掃描（僅 N > 1）

**當前環境支援子代理就並行**（Claude Code 的 Task、codex 的 subagent）：每塊一個子代理，**所有呼叫放在同一條訊息裡**才是真並行。不支援就一塊一塊串行讀，結果一樣，只是慢。

每個子代理的任務：
1. 讀 `{baseDir}/references/roster-pass.md`，照它執行
2. 讀 `<workdir>/chunk-NN.txt`
3. 把 roster JSON 寫到 `<workdir>/roster-NN.json`
4. 只回一句「done NN，抽到 X 個角色」

### Step 4 — 歸併

```bash
node {baseDir}/scripts/novel-characters.mjs merge <workdir>
```

按名字+別名收斂（`陸行遠`/`陸`/`姑娘` 會收斂成一個人），notes 累加、quotes 去重，依出現塊數遞減排序——出現的塊越多戲份越重。

### Step 5 — 選角

取前 N 位。預設 10，使用者說了就聽使用者的。剩下的角色在最後回報裡提一句「還辨識出 X 位沒做側寫」。

### Step 6 — 第二趟出卡

每個角色一份，同樣能並行就並行。

每份任務拿到：
- `{baseDir}/references/profile-pass.md` 和 `{baseDir}/references/schema.md`（讀它們，照著做）
- **報告語言 `lang`**（Step 0 定的）
- 該角色歸併後的 `name` / `aliases` / `notes` / `quotes`
- **同批其他角色的名字**（避免長相聲線撞車）

角色卡 JSON 寫到 `<workdir>/card-<slug>.json`。

**同時寫一段故事摘要**：用 `lang` 指定的語言，3–5 句，交代時空背景、核心情境、這幾個人聚在一起的由頭。短篇直接從原文寫；長篇從各塊的 roster note 歸納。不劇透結局，不寫成推薦語。

合成 `<輸出目錄>/<書名>-cast.json`：

```json
{ "source": "書名", "lang": "zh-TW", "style": "realistic", "summary": "……", "characters": [ ... ] }
```

### Step 7 — 校驗 ⛔ 不能跳

```bash
node {baseDir}/scripts/novel-characters.mjs validate <cast.json> <book.txt>
```

記得帶上 `--lang`（Step 0 定的）。檢查：結構、`importance` 列舉、**引文逐字**、**生圖提示詞不含人名**、**語言分工**（人類欄位跟隨 `lang`、生圖/TTS 提示詞永遠英文）、以及**非內建語言必須帶 `ui`**。

**有違規就按報錯逐條修，改完重跑，直到通過。** 這四類錯模型真的會犯——這套檢查就是被真實輸出打出來的。

### Step 8 — 生圖（可選，只給 protagonist 和 major）

**每個角色一張**，用 `image.sheet`，落到 `./images/<slug>-sheet.png`。一張橫構圖內部左右分欄：

```
┌──────────┬────────────────────────────┐
│  半身像   │   正視    側視    背視       │
│ （證件照） ├────────────────────────────┤
│  面部基準  │  細節 · 細節 · 細節 · 細節   │
│   ~34%   │            16:9            │
└──────────┴────────────────────────────┘
```

左欄半身像是面部設計基準，右上三視圖的臉照它畫，右下是關鍵細節的小特寫。**兩條硬要求**：三視圖的臉必須與半身像一致（否則一張圖兩個長相）；三個全身像的比例必須協調（模型會為了塞下細節把人壓扁）。

讀 `{baseDir}/references/sheet.md`，照它的呼叫契約做。要點：

- **沒有 codex 就整步跳過**，只交提示詞，後面照常走
- 跑在 codex 裡就直接用 `$imagegen`；跑在別處就 shell 呼叫 codex，先按那裡的腳本偵測版本最高的 binary（舊版會直接報錯）
- **一個角色一次呼叫，絕不批次**
- 單個失敗就跳過，不阻斷；最後彙總說明

`supporting` / `minor` 只給提示詞不生圖。使用者明確要求全出就全出。

### Step 9 — 輸出

```bash
cd <輸出目錄>
node {baseDir}/scripts/novel-characters.mjs render <cast.json> --md   > <書名>-cast.md
node {baseDir}/scripts/novel-characters.mjs render <cast.json> --html > report.html
```

語言取 `cast.json` 裡的 `lang`，要臨時覆寫就加 `--lang <code>`。

`render` 會自動去 `images/<slug>-sheet.png` 找圖。所以**先生圖再 render**。

report.html 的樣式約定見 `{baseDir}/references/report-style.md`——要改樣式先讀它，別把它改回通用卡片牆。

最終落地：

```
<輸出目錄>/
├── <書名>-cast.json
├── <書名>-cast.md
├── report.html                    ← 點兩下就能開
└── images/
    └── <slug>-sheet.png           ← 有 codex 才有
```
