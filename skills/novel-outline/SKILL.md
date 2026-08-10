---
name: novel-outline
version: 1.0.0
description: |
  把一本小說改編成短劇大綱五件套：改編說明、人物表、爽點表、分集梗概、資產清單，
  產出 outline.json + Markdown + 單頁評審報告（KPI 帶、關鍵決策、爽點時間軸、排程矩陣、場景概覽、品質門）。
  13 道品質門全部由程式確定性檢查（角色分檔上限、主場景上限隨集數動態、爽點間隔≤3集、每集鉤子懸念必填……），不靠模型自覺；
  支援體檢模式：貼一份現成大綱進來，只跑品質門給診斷。
  零相依、零 API key，用目前工作階段額度。
  Use when asked to 改編大綱、短劇大綱、拆大綱、小說轉短劇、adaptation outline。
allowed-tools:
  - Read
  - Write
  - Bash
  - Task
  - Glob
triggers:
  - novel-outline
  - 改編大綱
  - 短劇大綱
  - 拆大綱
  - 小說轉短劇
  - 大綱體檢
  - adaptation outline
metadata:
  license: Apache-2.0
  requires:
    bins:
      - node          # >= 18，只用標準庫，無 npm 相依
  runtimes:
    - claude-code
    - codex
---

## novel-outline

輸入一本小說 + 目標參數，輸出短劇改編大綱五件套。**四件模型寫、一件程式算**（資產清單從分集資料自動彙總）。

`{baseDir}` = 本檔案所在目錄。程式 `{baseDir}/scripts/novel-outline.mjs`，零相依，`node` 直接跑。

**邊界（不做的事）**：不寫劇本臺詞、不做分鏡、不生圖像/TTS 提示詞。梗概是敘述體，出現引號對白就是越界——`validate` 會攔。想從小說拆角色設定（側寫/形象提示詞/設定圖），那是 `novel-characters` 的活。

---

### Step 0 — 收參數 ⛔ 缺了不開工

一次問完，別輪流盤問。兩件必問 + 兩件給預設值待確認：

| 參數 | 處理 |
| --- | --- |
| **總集數 × 單集時長** | **必問**，沒有合理預設 |
| **題材** | **必問**，決定爽點型別，猜錯整份廢 |
| 改編幅度 | 預設**抽核**（忠實 / 抽核 / 借殼），告知即可 |
| 已有偏好 | 預設無（想保哪個角色、哪場戲） |

平臺閾值不同可以帶上 `params.thresholds` 覆蓋（預設：主角組 ≤ 5、重要配角 ≤ 10、功能性角色 ≤ 10、爽點間隔 ≤ 3 集）。**主場景上限不用配，隨集數自動算**：4 + ⌈集數/10⌉，夾在 5–15（60 集 → 10）。這是 AI 短劇的數——場景是生成的沒有搭景錢，放寬換觀賞性；顯式給 `maxPrimaryScenes` 才覆蓋。**短篇（20–30 集）建議收緊角色檔的閾值**，預設值是按 60 集以上給的。

**如果使用者有 novel-characters 的產出（cast.json）**，直接拿來當人物原料——角色、別名、關係都是現成的，不用重拆原文。分檔按 `importance` 對映：protagonist/major → `lead`，supporting → `support`，minor → `functional`。

### Step 1 — 定位輸入

材料優先順序，寫死：

1. 使用者點名的**精讀章節**
2. **章節目錄 + 簡介**
3. 全文**分卷摘要**（Step 2）

**禁止憑書名腦補內容**——一切判斷基於給到的文字。落地手段：`adaptation.keep` 的關鍵取捨要附 `evidence`（原文逐字片段）。

直接粘正文的先落成 .txt。輸出目錄：使用者指定就用，沒指定用原書同級目錄。

### Step 2 — 分卷摘要（長文字才需要）

**這一步是腳手架，不是交付物**——分卷摘要是給沒讀過原文的模型壓縮用的。兩種情況直接跳到 Step 3：

- 短篇，單卷裝得下
- **目前工作階段已經通讀過原文**（比如剛跑完 novel-characters 的分塊掃描）——不用再壓縮一遍，也不用事後補檔

長篇且沒讀過原文：

```bash
node {baseDir}/scripts/novel-outline.mjs chunk <book.txt> <workdir>
```

按章節標題分卷（預設每卷 15 章，`--per-volume` 可調），辨識不出章節就按字數切。輸出 `{"volumes": N, ...}`；`truncated: true` 就明確告訴使用者尾部沒掃到，別悶著。

每卷一個子代理（支援併發就**同一條訊息裡全部發出**）：讀 `{baseDir}/references/volume-pass.md`，讀 `<workdir>/vol-NN.txt`，把卷摘要寫到 `<workdir>/summary-NN.json`，只回一句「done NN」。

### Step 3 — 快版骨架 → 使用者拍板 ⛔

讀 `{baseDir}/references/outline-pass.md` 和 `{baseDir}/references/schema.md`，照著做。產出骨架四塊（adaptation / characters / scenes / beats），寫成 `<workdir>/outline.json`。

```bash
node {baseDir}/scripts/novel-outline.mjs validate <workdir>/outline.json --stage beats
```

過了 beats 檔，**把三件事擺給使用者拍板：砍了哪條線、合了哪些人、大爆點落在第幾集**。不點頭不進 Step 4——快版錯了只損失一輪骨架，分集寫完才發現方向錯，全廢。

### Step 4 — 細版骨架

吸收使用者意見改骨架，再過一次 `validate --stage beats`。使用者沒意見就直接進 Step 5。

### Step 5 — 分集梗概（分批）

**每批 ≤ 10 集**，能併發就併發。每個子代理拿到：拍板後的骨架四塊、自己負責的集數區間、區間內的爽點，讀 `{baseDir}/references/episode-pass.md` 照著寫，產出寫到 `<workdir>/eps-NN.json`。

合併時按 ep 排序拼進 outline.json 的 `episodes`。

### Step 6 — 校驗 ⛔ 不能跳

```bash
node {baseDir}/scripts/novel-outline.mjs validate <輸出目錄>/<書名>-outline.json
```

13 道品質門全部是程式碼，不是給你讀的清單：主角組 1–5 人、重要配角 ≤ 10、功能性角色 ≤ 10、主場景不超上限（隨集數動態，60 集 → 10）、一次性場景有規避方案、爽點間隔 ≤ 3 集無真空、第 1 集有鉤子、大爆點不壓最後一集、每集三欄齊全、三人同框有拆解、生成難點進預警、引用完整無失業角色、敘述體無對白。

**有違規逐條修，改完重跑，直到透過。**

### Step 7 — 輸出與回報

```bash
cd <輸出目錄>
node {baseDir}/scripts/novel-outline.mjs render <書名>-outline.json --md   > <書名>-outline.md
node {baseDir}/scripts/novel-outline.mjs render <書名>-outline.json --html > outline-report.html
```

report 裡自帶：KPI 帶、關鍵決策（拍板三件事，大爆點列表和角色位統計自動算）、爽點時間軸（空檔標在軸上，超閾值變紅）、每集排程矩陣、場景概覽卡、資產量折算、品質門（✓/✗ 烘進頁面，未過彈病灶橫幅）、匯出 JSON 按鈕（下載的就是 outline.json 原樣）。

回報一句話說清：幾集、幾個角色幾個場景、爽點分佈、報告路徑；被截斷或有沒過的門要明說。

最終落地：

```
<輸出目錄>/
├── <書名>-outline.json
├── <書名>-outline.md
└── outline-report.html            ← 雙擊就能開
```

---

## 體檢模式

使用者貼一份**已有大綱**只想要診斷：轉成 outline.json（缺的欄位問使用者或標註缺失），然後：

```bash
node {baseDir}/scripts/novel-outline.mjs checkup <outline.json>   # 終端 ✓/✗
node {baseDir}/scripts/novel-outline.mjs render <outline.json> --html > outline-report.html
```

品質門面板就是診斷書。未過的門不阻止渲染——要的就是把病灶擺出來看。

## 聯動更新

使用者改了上游就跑一次 `validate`，報錯會點名下游哪裡斷了：合併人物後哪些集還引用著被刪的 ID、砍場景後哪些集空轉、爽點挪動後哪裡出現真空區。**不要靠記憶提示聯動，靠校驗器。**

## 邊界

- 單次上限 60 卷（每卷 15 章約 900 章）。超了明確報 `truncated`，不靜默截斷
- 閾值是參數不是聖旨：平臺不同就用 `params.thresholds` 覆蓋，別改程式碼
- 報告介面 v1 只有中文
- 五件套的第五件（資產清單）永遠是算出來的，模型手寫必漏

## 自測

```bash
node {baseDir}/scripts/selftest.mjs
```

200 項斷言，不調模型、不花額度。13 道品質門每一道都有擊穿用例——證明它真的會攔。改完程式先跑這個。

## 自帶樣例

`{baseDir}/examples/渡口-outline.json`：把短故事《渡口》（novel-characters 的自帶樣例）改編成 6 集 × 2 分鐘的微型大綱，四角色三場景四爽點，全部品質門透過。當品質基準，也是自測夾具。
