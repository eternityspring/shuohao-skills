**中文** · [English](README.en.md)

> 我建了一個 **AI 短劇交流群**（付費），聊 AI 短劇的工作流、工具和實作。
> 有興趣的加我：**微信 `hao_dev`**，新增時**備註 `github`**。
>
> <img src="assets/wechat.png" alt="爍皓微信QR Code" width="180">

# shuohao-skills

> **這是 fork。** 上游是 [eternityspring/shuohao-skills](https://github.com/eternityspring/shuohao-skills)，
> 原作者微信群等資訊見上方。本 fork 的差異：
>
> - **預設輸出台灣正體中文**（`zh-TW`），用詞照台灣習慣而不只是換字形。要簡體用 `--lang zh`
> - 新增 **`photoreal`** 畫風預設：擬真實拍，劇組試裝定妝照的質感
>
> 詳見 [CHANGELOG](CHANGELOG.md)。


給 AI 編碼 agent 用的 skill 集合。**Claude Code 和 codex 都能跑。**

| Skill | 做什麼 |
| --- | --- |
| [**novel-characters**](skills/novel-characters) | 把一篇小說拆成角色設定集：人物側寫、形象提示詞、音色提示詞、角色設定圖。報告語言與生圖風格可選 |

丟一本小說進去，出這個：

![角色設定集報告](skills/novel-characters/assets/report.png)

## 裝

```bash
git clone https://github.com/eternityspring/shuohao-skills.git
cd shuohao-skills
./scripts/install.sh
```

自動檢測本機裝了 Claude Code 還是 codex，把所有 skill **軟連結**過去——`git pull` 之後立刻生效，不用重灌。

```bash
./scripts/install.sh novel-characters   # 只裝某一個
./scripts/install.sh --codex            # 只裝到 codex
./scripts/install.sh --uninstall        # 取消軟連結
```

不想用腳本就自己鏈：

```bash
ln -s "$PWD/skills/novel-characters" ~/.claude/skills/novel-characters
ln -s "$PWD/skills/novel-characters" ~/.codex/skills/novel-characters
```

## 前置條件

| | 必需？ | 說明 |
| --- | --- | --- |
| **Node** | 必需 | ≥ 18。skill 的腳本只用標準庫，**沒有 npm 相依，不需要 install** |
| **模型額度** | 必需 | 用你當前工作階段的額度，**不需要任何 API key** |
| **codex CLI** | 可選 | 生圖才用得上（走內建 `$imagegen`）。沒有就跳過生圖，其餘產出照常 |

## 倉庫約定

每個 skill 一個目錄，**自包含、可以單獨拷走**：

```
skills/<skill-name>/
├── SKILL.md          給 agent 讀的工作流（必需）
├── README.md         給人讀的說明
├── scripts/
│   ├── <name>.mjs    確定性工具，零相依
│   └── selftest.mjs  自測，不調模型（必需）
├── references/       按需載入的詳細指令
├── examples/         自帶樣例，同時當測試夾具
└── assets/           截圖
```

兩條硬要求：

- 每個 skill 必須有 `SKILL.md`
- 每個 skill 必須有 `scripts/selftest.mjs`，**不呼叫模型、不花額度**，覆蓋全部確定性邏輯

加新 skill 之前，先把全部自測跑一遍：

```bash
for f in skills/*/scripts/selftest.mjs; do node "$f"; done
```

沒有配 CI——自測足夠快（1 秒），本地跑一次比等 CI 更省事。**只在 macOS + Node 24 上驗過**；程式碼沒有平台相關呼叫，Linux 和更低版本 Node 理論上沒問題，但沒驗。


## License

[Apache 2.0](LICENSE)
