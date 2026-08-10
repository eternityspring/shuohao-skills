# 角色卡結構

`cast.json` 頂層：

```json
{
  "source": "渡口",
  "lang": "zh-TW",
  "style": "realistic",
  "summary": "民國年間的清晨，一條河的渡口濃霧未散。擺渡四十年的老船夫照常開船，先後上船的是……",
  "characters": [ /* 角色卡 */ ]
}
```

| 頂層欄位 | 必填 | 說明 |
| --- | --- | --- |
| `source` | 是 | 書名/篇名，報告標題用 |
| `lang` | 是 | 報告語言，預設 `zh-TW`（台灣正體）。簡體中文用 `zh` |
| `style` | 是 | 生圖風格，預設 `realistic`；`ghibli` 是吉卜力動畫風，`photoreal` 是擬真實拍。見 `style-presets.md` |
| `ui` | 視情況 | 介面文案翻譯。`lang` 是 `zh-TW`/`zh`/`en`/`ja` 時**不需要**（內建）；其他任何語言**必填**，否則 `validate` 報錯。用 `ui-template <lang>` 產生骨架後翻譯。只覆寫部分鍵也可以，缺的用內建英文墊底 |
| `summary` | 是 | **故事摘要**，中文 3–5 句。交代時空背景、核心情境、人物聚在一起的由頭。報告頂部顯示，讓人不看原文也知道這幾個角色是什麼關係。不要劇透結局，也不要寫成推薦語 |
| `characters` | 是 | 角色卡陣列 |

`summary` 缺失會被 `validate` 判為違規——報告頂部會空著。

單張角色卡：

```json
{
  "name": "老周",
  "aliases": ["老伯"],
  "importance": "major",
  "oneLiner": "在渡口擺渡四十年的老船夫，一隻眼睛是白的。",

  "persona": {
    "gender": "男",
    "ageRange": "約七十歲（推斷）",
    "identity": "渡口船夫",
    "appearance": "背駝得像一張拉滿的弓。左眼被風沙磨得只剩一層白翳。……",
    "personality": ["沉默", "耐性", "老練"],
    "temperament": "開口時嗓子裡像卡著半口江水，含混、發沉。……",
    "motivation": "把船開過去。霧再厚也照常開船。",
    "arc": "靜止。他是這條河的一部分。",
    "relationships": [{ "name": "沈知微", "relation": "向他問路的年輕渡客" }],
    "evidence": ["霧一厚，連自己的手都看不清。"]
  },

  "image": {
    "style": "半寫實厚塗，水墨調色",
    "prompt": "Character design sheet of an elderly Chinese ferryman ...",
    "promptLocal": "角色設定圖：約七十歲的中國老船夫……",
    "negativePrompt": "plastic or waxy skin, poreless doll face, young face, ...",
    "tags": ["semi-realistic", "painterly", "character sheet", "ink wash palette"],
    "sheet": "Single character model sheet on ONE 16:9 landscape canvas ... LEFT ZONE ... about 34% ... one bust portrait ... RIGHT-TOP ZONE ... three FULL-BODY views ... PROPORTIONS ARE CRITICAL ... RIGHT-BOTTOM ZONE ... four to five small isolated close-up studies ..."
  },

  "voice": {
    "timbre": "沙啞低沉的男中低音，喉音重",
    "pitch": "低",
    "pace": "緩慢，字與字之間拖著氣口",
    "accent": "南方水鄉口音，尾音含混",
    "emotion": "疲憊而平靜",
    "referenceHint": "像一個在同一個渡口喊了四十年「開船」的人",
    "prompt": "An elderly male voice, around seventy-five. Low bass-baritone ...",
    "promptLocal": "約七十五歲的老年男聲。低音區男中低聲部……"
  }
}
```

## 語言分工

「本地語言」= 頂層 `lang` 指定的語言，預設台灣正體中文（`zh-TW`）。

| 欄位 | 型別 | 語言 | 說明 |
| --- | --- | --- | --- |
| `name` | string | 原文 | 原文裡用得最多的稱呼 |
| `aliases` | string[] | 原文 | 其他稱謂；職業名詞（如「貨郎」）歸 `identity`，不進這裡 |
| `importance` | enum | — | `protagonist` / `major` / `supporting` / `minor`，**只能這四個** |
| `oneLiner` | string | **本地語言** | 一句話抓住這個人 |
| `persona.*` | — | **本地語言** | `personality` 3–5 個詞 |
| `persona.evidence` | string[] | **原文語言** | **逐字引用**，永遠不翻譯——翻了就不是證據了。沒有就空陣列 |
| `image.style` | string | 本地語言 | 畫風一句話 |
| `image.prompt` | string | **英文** | 單張表現性圖像；**禁止出現人名**；**必須寫明族裔／年代／地域** |
| `image.promptLocal` | string | 本地語言 | 上面那條的譯文；`lang=en` 時省略；**同樣禁止人名** |
| `image.negativePrompt` | string | **英文** | 逗號分隔 |
| `image.tags` | string[] | **英文** | 4–8 個風格標籤 |
| `image.sheet` | string | **英文** | **角色設定圖**，16:9 三區版面：左約 34% 半身像（面部基準）／右上全身三視圖／右下細節條，細線分隔；**禁止出現人名**；**必須寫明族裔／年代／地域** |
| `voice.timbre/pitch/pace/accent/emotion/referenceHint` | string | **本地語言** | 最容易寫漂的地方，注意 |
| `voice.prompt` | string | **英文** | 給 TTS 音色設計引擎 |
| `voice.promptLocal` | string | 本地語言 | 上面那條的譯文；`lang=en` 時省略 |

**英文欄位不跟隨 `lang`。** 圖像模型和 TTS 引擎吃英文最穩，跟報告用什麼語言無關。

`lang` 是 `zh-TW` 時，本地語言欄位要用**台灣慣用詞**，不是把簡體換個字形。
對照表見 `SKILL.md` 的「`zh-TW` 的用語規範」。

## 設定圖的三區版面

16:9 橫構圖，細線分成三塊：

- **左（約 34%）** 半身像當**面部設計基準**，尺寸大、五官畫得細，可以直接拿去做表情設計
- **右上** 三視圖管剪影、比例、服裝，臉照左欄畫
- **右下** 細節條，4–5 個關鍵細節的小特寫（配件、道具、疤痕、鞋履……）

兩個最容易崩的點：**一張圖裡出現兩個長相**，以及**為了塞下細節把人物壓扁**。提示詞裡都要寫死——細節放不下就往右緣延伸，**永遠是細節讓位，不是人物讓位**。

## 校驗

`scripts/novel-characters.mjs validate <cast.json> <book.txt>` 會檢查：結構完整性、`importance` 列舉、**引文逐字**、**生圖提示詞不含人名**、**語言分工**。違規逐條列出並 exit 1。
