# outline.json 結構

五件套的載體。**模型只管填這份 JSON**，Markdown 和 report.html 由 `render` 渲染出來，資產清單由程式彙總——五件套是四件模型寫 + 一件算出來的。

```json
{
  "source": "書名",
  "lang": "zh",
  "params": { "episodes": 60, "minutesPerEpisode": 2, "genre": "女頻逆襲", "adaptMode": "抽核", "preferences": [] },
  "adaptation": { "core": "…", "keep": [], "cut": [], "merge": [], "risks": [] },
  "characters": [ { "id": "C01", "name": "…", "role": "…", "arc": "…", "from": ["原著…", "合併：…"] } ],
  "scenes": [ { "id": "S01", "name": "…", "primary": true, "reusePlan": "…" } ],
  "beats": [ { "id": "B01", "type": "打臉", "weight": "major", "episode": 3, "setup": "…", "payoff": "…" } ],
  "episodes": [ { "ep": 1, "synopsis": "…", "hook": "…", "suspense": "…", "sceneIds": ["S01"], "characterIds": ["C01"], "crowdPlan": "…", "warnings": [] } ]
}
```

## params

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `episodes` | 是 | 總集數，正整數。分集數量必須與它一致 |
| `minutesPerEpisode` | 是 | 單集時長（分鐘） |
| `genre` | 是 | 題材，**決定爽點型別**，不許缺。投放平臺的差異不單設欄位，直接體現在 `thresholds` 上 |
| `adaptMode` | 是 | `忠實` / `抽核` / `借殼`，只能這三個 |
| `preferences` | 否 | 使用者點名要保的角色、戲 |
| `thresholds` | 否 | 逐項覆蓋品質門閾值：`maxLeads`(5) / `maxSupport`(10) / `maxFunctional`(10) / `maxBeatGap`(3) / `maxPrimaryScenes`（預設不是常數，**隨集數動態**：4 + ⌈集數/10⌉ 夾在 5–15，60 集 → 10。按 AI 短劇定的——場景是生成的，上限守的是一致性資產不是搭景錢）。短篇建議收緊角色檔 |

## adaptation 改編說明

`core` 一句話核心，必填。`keep` / `cut` / `merge` 每條 `{what, why}`，`keep` 至少一條；**`adaptMode` 不是忠即時 `cut` 不能為空**。`keep` 可帶 `evidence`——**原文逐字片段**，禁止憑書名腦補的對策就在這：關鍵取捨要能指回原文。`risks` 每條 `{what, plan}`。

兩個可選的**決策補註**，報告的「關鍵決策」區塊會展示：

- `cutNote` — 砍線的結論句（「這意味著：全劇終點是……原著後 30 章基本不用」這種），說清砍完之後故事的終點變成了什麼
- `mergeNote` — 合人的補註，通常寫主角組入選理由（誰有完整轉變弧）

給了就不能是空字串，`validate` 會攔。大爆點落點列表**不用寫**——報告從 `beats` 裡自動算。

## characters 人物表

每個欄位都以校驗器為準，一個不多一個不少：

| 欄位 | 必填 | 說明 |
| --- | --- | --- |
| `id` | 是 | `C01` 格式，全域性唯一，分集靠它引用 |
| `name` | 是 | 姓名；功能性角色用稱呼標籤（「急診醫生」） |
| `role` | 是 | 定位一句話：女主 / 攪局配角 / 渡口的報時人…… |
| `tier` | 是 | 三檔之一，見下表 |
| `arc` | lead / support 必填 | 人物弧；functional 可省——醫生就是來縫針的 |
| `from` | 是 | **← 改動記錄**，非空陣列：原著對應誰、合併了誰、純原創寫 `["原創"]` |

- `tier` 只能三檔——一刀切的角色上限混淆了「觀眾要記住誰」和「製作要維護多少張臉」，分檔把它拆開：

  | tier | 是誰 | 上限 | 規則 |
  | --- | --- | --- | --- |
  | `lead` | 主角組（男女主 + 主反派） | 1–5 人 | `arc` 必填 |
  | `support` | 有名字的重要配角（親屬、閨蜜、副反派） | ≤ 10 | `arc` 必填 |
  | `functional` | 功能性角色（醫生、秘書、店員） | ≤ 10 | **佔臉不佔名**：`name` 用稱呼標籤（「急診醫生」）；`arc` 可省——醫生就是來縫針的 |

  無名背景人不進表、不追蹤、不限量。從 novel-characters 的 cast.json 對映：protagonist/major → `lead`，supporting → `support`，minor → `functional`

## scenes

- `id` 格式 `S01`，全域性唯一；`name` 必填；`primary` 必填布林（主場景上限隨集數動態，見 `thresholds`）
- **在全劇只出現一次的場景必須帶 `reusePlan`**（規避方案：複用哪個現有環境資產、換什麼時段天氣改出來）

## beats 爽點表

- `id` 格式 `B01`；`type` 自由文字（打臉/揭破/反轉…）；`weight` 只能 `major` / `minor`（預設算 minor）
- `episode` 是**唯一資料來源**——分集不再列 beatIds，節奏條和資產清單都從這裡算
- 硬規則：相鄰爽點間隔 ≤ `maxBeatGap`，開頭結尾無真空；**至少一個 major，且最早的 major 不能落在最後一集**

## episodes 分集梗概

- `ep` 從 1 連續編號，總數等於 `params.episodes`
- `synopsis` / `hook` / `suspense` 三欄**都必填**——【鉤子】【懸念】空了視為未完成
- **敘述體**：三欄裡出現 `「」『』“”` 引號對白就是在寫劇本，越界，validate 會攔
- `sceneIds` / `characterIds` 必填且必須指向已登記的 id；每個角色至少出現一集、每個場景至少用一次
- `characterIds` ≥ 3 的集必須寫 `crowdPlan`（同框拆解方案）。**校驗按人數判，是代理指標**——如果這一集三人實際不同框（分處不同場次），把這個事實寫成方案即可：「三人分處兩場，無同框，分場拍」，照樣透過
- `warnings`：梗概裡掃到生成難點關鍵詞（雨戲/肢體接觸/人群/手部特寫）就必須列進來，寧可多報

## 校驗

```bash
node scripts/novel-outline.mjs validate outline.json --stage skeleton|beats|full
node scripts/novel-outline.mjs checkup outline.json   # 只輸出 13 道品質門 ✓/✗
```

stage 就是流程門：骨架拍板前過 `skeleton`，**寫分集之前必須過 `beats`**（爽點間隔和 major 時機錯了，分集寫完全廢），交付前過 `full`。
