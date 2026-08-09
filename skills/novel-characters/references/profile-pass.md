# 第二趟 · 生成角色卡

你是在為一部動畫改編準備製作素材。給你一個角色的名字、歸併後的全部觀察記錄、以及可引用的原文片段，產出一張完整的角色卡。

**只輸出 JSON，不要任何解釋、不要 markdown 圍欄。** 結構見 `schema.md`。

## 語言

呼叫方會給一個**報告語言** `lang`（預設 `zh-TW`，台灣正體）。欄位分兩類：

| 類別 | 欄位 | 語言 |
| --- | --- | --- |
| **給人讀的** | `oneLiner`、`persona.*`、`voice.timbre/pitch/pace/accent/emotion/referenceHint`、`image.style`、`image.promptLocal`、`voice.promptLocal` | **`lang` 指定的語言** |
| **餵給機器的** | `image.prompt`、`image.negativePrompt`、`image.tags`、`image.sheet`、`voice.prompt` | **永遠英文** |

機器欄位不跟隨 `lang`——圖像模型和 TTS 引擎吃英文最穩，跟報告用什麼語言無關。

`promptLocal` 是對應英文提示詞的本地語言譯文，給人看的。**`lang` 是 `en` 時省略這兩個欄位**，否則就是原樣重複。

`lang` 是 `zh-TW` 時**用台灣慣用詞，不是把簡體換個字形**。外貌描寫裡踩得最多的是
一簡對多繁的字（頭**髮**、**乾**淨、眼**裡**、**鬆**垮、一**隻**手），引號用「」。
完整對照表在 `SKILL.md` 的「`zh-TW` 的用語規範」。

## 硬規則

1. **一切基於觀察記錄。** 為了讓設定可用而不得不補全的部分，要跟原文保持一致，並且**標注出來**——中文報告加「（推斷）」，英文報告加 `(inferred)`，其他語言用該語言的等價說法。**只用一種標記，不要中英都加。**

2. **`persona.evidence` 只能放「可引用原文」區塊裡的字串，逐字照抄。** 不許翻譯、不許裁剪、不許把兩條合併、不許從觀察記錄裡另找。那個區塊是空的就回傳空陣列。**注意：引文永遠保持原文語言，不跟隨 `lang`**——它是證據，翻譯了就不是證據了。

3. **`image.prompt` / `image.promptLocal` / `image.sheet` 裡絕對不許出現角色名、別名、作者名、作品名。** 圖像模型對這些偏見極重，會畫成它記憶裡的角色而不是你的角色。描述這個人，不要叫他的名字。

4. `image.prompt` 是**單張表現性插畫**（不是技術圖，可以放開打光）：四分之三視角半身、純中性背景、柔和方向主光 + 冷調補光、淺景深、面部最實。

   > **先看 `style`。** 下面第 4 條講的質感是 `realistic` 預設的內容。呼叫方指定了
   > 別的風格（`ghibli` / `photoreal`），就跑
   > `node scripts/novel-characters.mjs styles <id>`，把那個預設的 render / surface /
   > lighting / negative / tags **整塊換掉**，不要拿這裡的寫實描述去混搭。
   >
   > `photoreal` 尤其要注意：它跟 `realistic` 一樣**絕不能**禁 `photorealistic`，
   > 但**必須**禁 `illustration` / `painting` / `anime` / `cartoon`——它要的是照片不是畫。

   **畫風走半寫實厚塗，不要寫「扁平向量卡通」。** 實測「扁平向量卡通」這句會讓模型跟自己擰巴——同一批角色出來有的偏動畫、有的偏寫實。用這一檔：
   `Semi-realistic character illustration, painterly rendering with soft blended edges and visible brush texture, anatomically grounded`

   **真實感來自不完美，不是細節量。** 皮膚和五官要寫具體：可見毛孔、膚色不勻、鼻翼耳緣的細微微血管、耳緣透光；眼睛要有濕潤高光、下眼瞼水光、虹膜纖維；**眼瞼和眉毛左右略不對稱**；髮際線有細碎碎髮破開輪廓。老年角色收益最大：老人斑、皮膚鬆弛，**皺紋要順著表情肌走**（法令紋、魚尾紋、抬頭紋），不是隨機刻線。

   **布料決定「像不像真衣服」**：可見織紋、肘部袖口膝蓋的磨損與光澤、布料垂墜有重量、褶皺深處有自陰影。

   `negativePrompt` **不要寫 `photorealistic` / `3d render`**——一邊要真實感一邊禁真實感是自相矛盾的。該禁的是「假」：塑膠蠟質皮膚、過度磨皮、無毛孔娃娃臉、完全對稱的臉、沒有高光的死眼、頭盔狀無碎髮的頭髮、無織紋的平板布料、僵硬的人台姿勢。

5. **`image.sheet` 是角色設定圖——一張 16:9 橫構圖，內部分三個區。** 這是給生圖模型的完整版面指令，比例要寫死，不能讓它自由發揮：

   ```
   ┌──────────┬────────────────────────────┐
   │          │   正視    側視    背視       │
   │  半身像   │                            │
   │ （證件照） ├────────────────────────────┤
   │          │  細節 · 細節 · 細節 · 細節   │
   │   ~34%   │                            │
   └──────────┴────────────────────────────┘
              16:9
   ```

   | 區 | 內容 |
   | --- | --- |
   | **左** 約 34% | **半身像**：頭肩，正面，置中，像證件照。臉畫全、畫細，這是面部設計的基準。**兩側肩膀完整**，底邊**齊平直切** |
   | **右上** | **全身三視圖**：正視 / 側視 / 背視並排，共用一條地平線 |
   | **右下** | **細節條**：4–5 個關鍵細節的小特寫，等距排一行，明顯小於全身像 |

   三個區之間用**細線**分隔。整張純白背景、四周留白均勻。

   **光照要分區寫**，這是設定表和寫實的矛盾點：
   - **左欄半身像**：左上方柔和方向主光、衰減自然，下巴下方 / 眼窩 / 領口與脖頸交界處有環境遮蔽——臉要有體積
   - **右側兩區**：平光正交、無方向主光、無投影——**去背和量比例全靠它**

   寫死成 `LIGHTING IN THE LEFT ZONE ONLY: ...` 和 `LIGHTING IN THE RIGHT ZONES: flat even orthographic lighting ...`。全圖統一平光會讓整張顯得「插畫感」，全圖統一打光又沒法去背。

   **比例是這個版面最容易崩的地方。** 提示詞裡必須寫死：三個全身像等高、頭身比一致、四肢長度和頭身比正確、雙腳踩在同一條地平線上、頭頂和腳下都留出空隙，**絕不能為了塞下別的東西把人物拉伸或壓扁**。

   **細節放不下怎麼辦**：底部一行排不下就沿畫布右緣往下延伸成一豎列。**但永遠是細節讓位，不是人物讓位**——提示詞裡要明說 `the detail studies give way, not the figures`。

   **一張圖裡只能有一個長相。** 三視圖的面部與左欄半身像一致——同樣的五官、髮型、表情。左欄是基準，右欄照著它畫。

   提示詞裡必須逐條寫明：`ONE 16:9 landscape canvas`、`LEFT ZONE ... about 34% of the canvas width`、`RIGHT-TOP ZONE`、`RIGHT-BOTTOM ZONE`、`thin hairline rules`、`PROPORTIONS ARE CRITICAL`、`the detail studies give way, not the figures`。

6. `voice.prompt` 是給 TTS 音色設計引擎的：描述**樂器本身**，不是某一句台詞的演繹。性別、聽感年齡、音色、音高區間、共鳴、氣聲、語速、節奏、口音、能量、預設情緒。

7. **同一批角色之間要能區分開。** 會給你同批其他角色的名字，別把他們的長相和聲線做成一個樣。

## 輸入格式

```
Language: zh-TW
Character: 老周
Also referred to as: 老伯、擺渡人
Other characters in this cast: 沈知微、陸行遠、胡二爺

Observations gathered from the source text:
1. ...
2. ...

Verbatim quotes — the ONLY strings allowed in `persona.evidence`:
- ...
- ...
```
