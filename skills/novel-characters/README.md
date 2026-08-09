**中文** · [English](README.en.md)

# novel-characters

丟一本小說或一篇短故事進去，輸出每個角色的完整設定：

- **角色表** — 誰出場了，主角還是龍套，跨章節的不同稱呼歸併到同一個人
- **人物側寫** — 性別、年齡、身份、外貌、性情、動機、人物弧光、關係網，每條附**原文逐字引文**
- **形象提示詞** — 半寫實厚塗路線，雙語生圖 prompt + negative prompt + 風格標籤，直接喂 Midjourney / SD / GPT-Image
- **音色提示詞** — 音色、音高、語速、口音、情緒，雙語 voice-design prompt，直接喂 Qwen3-TTS / ElevenLabs Voice Design
- **角色設定圖** — 一張 16:9 圖分三區：左側約 34% 證件照式半身像（面部基準）、右上全身三視圖、右下關鍵細節特寫條。**畫風可選**：預設半寫實厚塗，也可以出吉卜力動畫風或擬真實拍。白底方便去背，走 codex 內建生圖（可選）

產出 `cast.json` + Markdown + 一個雙擊就能開的 `report.html`。

**報告語言可指定**，預設台灣正體中文（`zh-TW`）：

```
/novel-characters ./book.txt --lang en
/novel-characters ./book.txt --lang ja
```

內建 **正體中文 / 簡體中文 / English / 日本語** 四套介面文案。**其他語言一樣支援**——skill 會現場把介面文案翻譯成目標語言，存進 `cast.json` 的 `ui` 欄位，渲染時合並進去。所以法語、韓語、西班牙語都能出完整報告，不會露出英文介面。

想自己準備翻譯：

```bash
node scripts/novel-characters.mjs ui-template fr   # 印出待翻譯的骨架
```

![report.html](assets/report.png)

角色設定圖（自帶樣例《渡口》的沈知微）：

![角色設定圖](assets/sheet.jpg)

## 用

安裝見[倉庫根 README](../../README.md)。裝好後：

```
/novel-characters ./你的小說.txt
```

或者直接說「幫我拆一下這本書的角色」並給出路徑。

### 報告語言

預設台灣正體中文（`zh-TW`）。用 `--lang`，或者直接說「用英文」「日本語で」：

```
/novel-characters ./book.txt --lang zh     # 簡體中文
/novel-characters ./book.txt --lang en
/novel-characters ./book.txt --lang ja
```

內建 **正體中文 / 簡體中文 / English / 日本語** 四套介面文案。**其他語言一樣支援**——skill 會現場把介面文案翻譯成目標語言，存進 `cast.json` 的 `ui` 欄位，渲染時合併。法語、韓語、西班牙語都能出完整報告，不會露出英文介面。

`zh-TW` 不只是換字形：介面用「搜尋」「負向提示詞」「生圖」，角色卡內容也照台灣慣用詞寫，
一簡對多繁的字（頭**髮**、**乾**淨、眼**裡**）由 `SKILL.md` 的用語規範約束。

兩條不跟隨語言：**生圖和 TTS 提示詞永遠英文**（引擎吃英文最穩）；**原文引文永遠保持原文語言**（翻譯了就不是證據了）。

### 生圖風格

預設 `realistic`（半寫實厚塗）。想要動畫質感或真人選角感：

```
/novel-characters ./book.txt --style ghibli
/novel-characters ./book.txt --style photoreal
```

| id | 說明 |
| --- | --- |
| `realistic` | 半寫實厚塗，皮膚有毛孔和肌理，布料有織紋磨損。預設 |
| `ghibli` | 吉卜力式手繪賽璐璐，等寬墨線、單層柔和陰影、平塗色塊 |
| `photoreal` | 擬真實拍，劇組試裝定妝照：真人、50–85mm 鏡頭、中性暖灰背景、不修圖的皮膚 |

和語言可以組合：`--lang zh-TW --style photoreal`。

```bash
node scripts/novel-characters.mjs styles          # 看所有預設
node scripts/novel-characters.mjs styles ghibli   # 看某一個的完整內容
```

**換風格是整套換**，不是只換一句畫風——每個預設自帶渲染方式、表面處理、光照、負向提示詞、標籤五塊。詳見 [`references/style-presets.md`](references/style-presets.md)。

## 它是怎麼工作的

長文字一次性塞進上下文會丟角色，所以拆成兩趟：

**第一趟 · 掃描**（便宜）
按段落切成 14k 字元的重疊塊，每塊併發抽「角色名 + 別名 + 該塊裡的具體描寫 + 逐字引文」。重疊是為了讓卡在切口上的角色兩邊都能看見。

**歸併**
按名字和別名建索引，`陸行遠` / `陸` / `姑娘` 這類跨塊的不同叫法收斂成同一個人。按出現塊數當戲份權重排序。

**第二趟 · 出卡**
只對戲份最重的 N 位，把歸併後的全部描寫喂進去，一次生成完整角色卡。同批角色互相知道對方的名字，避免長相和聲線撞車。

**校驗**（這步不能跳）
四類硬規則，全部由腳本確定性檢查，不靠模型自覺：

| 規則 | 為什麼 |
| --- | --- |
| `evidence` 必須是原文**逐字連續**片段 | 防編造。被「他說」斷開的對白不許拼接 |
| 生圖 prompt **不許出現人名** | 圖像模型對人名偏見極重，會畫成它記憶裡的角色 |
| 欄位**語言分工** | 人類欄位跟隨 `--lang`、生圖和 TTS 提示詞永遠英文，模型會漂 |
| **風格與負向提示詞匹配** | `realistic` / `photoreal` 不能禁 `photorealistic`、`ghibli` 必須禁；`photoreal` 另外必須禁 `illustration`／`anime`。搞反整批圖就廢 |
| 結構 + 列舉 | `importance` 只能是那四個值 |

這四條不是拍腦袋定的——是模型輸出真的違反過、被校驗腳本當場抓住才立起來的。

## 命令列直接用

腳本本身不需要 agent 也能跑，只有兩趟模型呼叫需要：

```bash
node scripts/novel-characters.mjs chunk book.txt /tmp/wk        # 切塊
node scripts/novel-characters.mjs merge /tmp/wk                 # 歸併 roster-*.json
node scripts/novel-characters.mjs validate cast.json book.txt   # 校驗
node scripts/novel-characters.mjs render cast.json --html       # 出 report.html
node scripts/novel-characters.mjs slug "胡二爺"                  # 安全檔名
```

## 邊界

- 單次上限 24 塊（約 33 萬字元）。超了會明確報 `truncated`，**不靜默截斷**
- 人類可讀欄位跟隨 `--lang`；生圖和 TTS 提示詞**永遠英文**，那些引擎吃英文最穩，跟報告語言無關
- **簡繁之分腳本判不了**。`validate` 只查「是不是中文」，寫成簡體它攔不住——靠 `SKILL.md` 的用語規範約束生成階段
- 設定圖只自動給 `protagonist` 和 `major`，其餘只給提示詞
- **同一批角色的畫風可能有差異**——各自獨立生圖。早期用「扁平向量卡通」時漂得很厲害（同批出成動畫感／半寫實／水墨寫實三種），換成明確的風格預設後好了很多，但不能保證完全一致。在意的話拿第一張當參考圖壓一壓，見 `references/sheet.md`

> ⚠️ **機器上裝了多個 codex 要注意版本。** 舊版本會直接報 `requires a newer version of Codex` 而不是降級。skill 裡帶了自動挑最高版本的探測邏輯，整體太舊就 `npm i -g @openai/codex`。

## 檔案

```
SKILL.md                 給 agent 讀的工作流
scripts/
  novel-characters.mjs   chunk / merge / validate / render / slug
  selftest.mjs           260 餘項斷言，不調模型
references/
  roster-pass.md         第一趟：掃描角色
  profile-pass.md        第二趟：生成角色卡（8 條硬規則）
  schema.md              角色卡結構 + 欄位語言歸屬
  sheet.md               角色設定圖生圖的 codex 呼叫契約
  report-style.md        report.html 的設計約定
  style-presets.md       生圖風格預設（realistic / ghibli / photoreal）
examples/
  渡口.txt                自帶短故事，4 個角色
  渡口-cast.json          產出，同時是校驗自檢夾具
  渡口-cast.md            渲染結果，品質基準
```

`examples/渡口.txt` 裡貨郎全程只有綽號、船夫只被叫過「老伯」——專門用來驗別名歸併。

## 自測

```bash
node scripts/selftest.mjs
```

220 項斷言，覆蓋分塊 / 別名歸併 / 多語言 / 校驗 / 渲染。不調模型、不花額度、1 秒跑完。改完腳本先跑這個。

**只在 macOS + Node 24 上實測過。** 程式碼沒有平台相關呼叫，Linux 和更低版本 Node 理論上沒問題，但**沒驗過**。
