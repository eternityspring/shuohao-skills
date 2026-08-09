# 角色設定圖生圖 · codex `$imagegen`

生圖走 codex 內建的 `$imagegen` 系統 skill。**這條路不需要任何 API key**——用的是本機 codex 登入狀態（訂閱額度）。

**沒有 codex 就跳過整個第 8 步**，只交提示詞，其餘產出照常。這是可選能力，不是硬相依。

## 每個角色一張圖

一張橫構圖，內部左右分欄：

```
┌──────────┬────────────────────────────┐
│          │   正視    側視    背視       │
│  半身像   │                            │
│ （證件照） ├────────────────────────────┤
│  面部基準  │  細節 · 細節 · 細節 · 細節   │
│   ~34%   │                            │
└──────────┴────────────────────────────┘
                    16:9
```

提示詞欄位 `image.sheet`，落到 `./images/<slug>-sheet.png`。

左欄的半身像是**面部設計的基準**，右欄三視圖的臉照著它畫。提示詞裡要明確要求兩邊一致，否則一張圖裡會出現兩個長相。

---

## 情況 A：本 skill 正跑在 codex 裡

直接用 `$imagegen`，**不要再 shell 出去呼叫 `codex exec`**——那是自己套自己。

把 `image.sheet` 的內容作為圖像規格交給 `$imagegen`，產生後把選定的 PNG 複製到 `<輸出目錄>/images/<slug>-sheet.png`。

## 情況 B：跑在 Claude Code 或其他環境裡

shell 呼叫本機 codex。

### 先找對 binary ⚠️

機器上可能裝了多個 codex，**版本不夠新的會直接報錯**「requires a newer version of Codex」。取版本最高的那個：

```bash
find_codex() {
  local best="" best_n=0 c v n
  # command -v 放第一個：尊重使用者的 PATH；後面幾個是常見安裝位置墊底
  for c in "$(command -v codex 2>/dev/null)" \
           "$HOME/.npm-global/bin/codex" \
           "$HOME/.local/bin/codex" \
           "$(npm prefix -g 2>/dev/null)/bin/codex" \
           /opt/homebrew/bin/codex \
           /usr/local/bin/codex; do
    [ -n "$c" ] && [ -x "$c" ] || continue
    v=$("$c" --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    [ -n "$v" ] || continue
    n=$(echo "$v" | awk -F. '{printf "%d%03d%03d", $1, $2, $3}')
    [ "$n" -gt "$best_n" ] && { best_n=$n; best=$c; }
  done
  [ -n "$best" ] && echo "$best"
}
CODEX=$(find_codex)
```

`$CODEX` 為空就跳過生圖。

### 呼叫

**一個角色一次呼叫，絕不批次。** built-in 通路會把 PNG 位元組寫進 rollout，批次會把上下文撐爆——這是官方 `hatch-pet` skill 踩出來的經驗。

```bash
cd <輸出目錄> && mkdir -p images
env -u NODE_OPTIONS "$CODEX" exec --skip-git-repo-check --sandbox workspace-write \
  'Use $imagegen to generate this character model sheet, then copy the final selected PNG to ./images/<slug>-sheet.png in the current working directory. Reply with only the file path — no base64, no markdown image preview.

<image.sheet 的內容>' < /dev/null
```

想讓一批角色畫風統一，就拿第一個角色出好的圖當參考圖餵給後面幾個——**用 `-i` 時 prompt 必須走 stdin**，見下面「變長參數」。

三個參數都是必需的，缺一個就掛：

| 參數 | 為什麼 |
| --- | --- |
| `--skip-git-repo-check` | 輸出目錄不是 git 倉庫時，codex 會拒絕執行 |
| `--sandbox workspace-write` | 不給就沒法往 cwd 寫檔案 |
| `< /dev/null` | 不關 stdin，codex 會一直等輸入 |

---

## 畫風一致性 ⚠️ 已知短板

同一批角色各自獨立生圖，**畫風可能有差異**。早期用「扁平向量卡通」時漂得很厲害——同一批出成動畫感／半寫實／水墨寫實三種，擺在一起不像同一部片子。換成明確的風格預設（見 `style-presets.md`）後好了很多，但不能保證完全一致。

想壓住的話，把**第一個角色的成圖當風格參考**餵給後面幾個（codex 的 `-i/--image` 就是幹這個的）：

**用 `-i` 時 prompt 必須走 stdin**（見下面「變長參數」）：

```bash
printf '%s' "$PROMPT
Match the art style, line weight, shading and colour treatment of the reference
image exactly — these characters must belong to the same production." \
| "$CODEX" exec --skip-git-repo-check --sandbox workspace-write \
    -i ./images/<第一個角色>-sheet.png
```

代價是第一張的畫風就定了全片基調，出得不好就得重來。使用者在意統一性就上參考圖，只是要幾張草圖就不必。

## ⚠️ 先清掉 NODE_OPTIONS

codex 自己也是個 Node CLI，**會繼承父行程的 `NODE_OPTIONS`**。如果呼叫方環境裡設了 `--require` 之類的預載入，而那個檔案不在了（暫存目錄被清理是常見情況），codex 會在啟動階段就崩掉，報的是 `Cannot find module .../restore-node-options.cjs`，跟生圖毫無關係，很難聯想。

所有 codex 呼叫都套一層 `env -u NODE_OPTIONS`：

```bash
env -u NODE_OPTIONS "$CODEX" exec --skip-git-repo-check --sandbox workspace-write ...
```

## ⚠️ 變長參數會吞掉 prompt

`--disallowed-tools <tools...>` 和 `-i/--image <FILE>...` 都是變長的，**後面跟的位置參數會被它們當成自己的值吃掉**，報錯是莫名其妙的 `No prompt provided via stdin`。

兩條規矩：

- 只要用了任何變長參數，**prompt 一律用 `printf '%s' "$P" | codex exec ...` 走 stdin**
- 不用變長參數時才可以把 prompt 當位置參數傳，並且要 `< /dev/null` 關掉 stdin

## 背景：白底

設定圖一律**純白背景**。理由有三個：去背乾淨、印出來是設定表該有的樣子、在深色報告裡也能讀。

### 分區光照

設定表要平光（去背、量比例），寫實要方向光（體積感）。兩者矛盾，所以**分區解決**：左欄半身像給柔和方向主光 + 環境遮蔽，右側三視圖和細節條保持平光正交。提示詞裡是兩句獨立的 `LIGHTING IN THE LEFT ZONE ONLY` / `LIGHTING IN THE RIGHT ZONES`，不要合併成一句全域光照。

### 比例 ⚠️

這個版面最容易崩的就是比例——模型為了把細節條塞進去，會把三個全身像壓扁或拉長。提示詞裡已經寫死了 `PROPORTIONS ARE CRITICAL`、`no stretching, squashing or foreshortening`、`the detail studies give way, not the figures`。**拿到圖先量一眼三個全身像是不是等高、頭身比正不正常。**

### 左欄的收口 ⚠️

模型預設會把半身像的兩側肩膀裁掉、底邊做成圓角或漸隱暈影，看著很彆扭。提示詞裡必須顯式禁掉：肩膀完整、兩側留空、底邊齊平直切。這條不寫就一定會出問題。

### 面部一致性 ⚠️

一張圖裡出現兩個長相是這個版面最容易出的問題——左欄畫一個人、右欄畫另一個人。提示詞裡必須寫死 `must match the bust portrait exactly — same features, same hairstyle, same expression`。拿到圖先掃一眼兩邊是不是同一個人，不是就重新產生。`image.sheet` 的提示詞裡已經寫死了 `plain pure white background`，不要改成灰底或場景背景。

### 想要真透明背景

`$imagegen` 的 built-in 通路（`gpt-image-2`）**不支援** `background=transparent`。官方給的路子是：提示詞裡要一塊平整的 chroma-key 底色，產生後用本機腳本去掉：

```bash
python3 "$CODEX_HOME/skills/.system/imagegen/scripts/remove_chroma_key.py" <in.png> <out.png>
```

真·原生透明只有 CLI fallback 的 `gpt-image-1.5 --background transparent` 能做，**那條路要 `OPENAI_API_KEY`**，本 skill 不走。使用者明確要透明就告訴他這個取捨，別自己決定。

## 必須顯式指定目標路徑

`$imagegen` 預設把圖落在 `$CODEX_HOME/generated_images/<session>/`。官方規則明確要求：**專案資產不能只留在預設路徑**。所以提示詞裡一定要寫「copy to ./images/xxx.png」，讓 codex 自己搬過來。

## 其他約束

- worker **只回檔案路徑**，不要 base64、不要 markdown 圖片預覽
- **不要逐張打開**產生的 PNG 看——只看最終 report.html
- **不碰 CLI fallback**（`scripts/image_gen.py`，要 `OPENAI_API_KEY`）。built-in 不可用就據實回報，不要靜默降級
- 生圖失敗**不阻斷**整個流程：跳過這個角色，最後彙總說明哪些沒出成

## 檔名

用 `node scripts/novel-characters.mjs slug "<角色名>"` 產生安全檔名（中文會保留）。`render` 會自動去 `images/<slug>-sheet.png` 找圖，找到就嵌進 report.html——所以**先生圖，再 render**。
