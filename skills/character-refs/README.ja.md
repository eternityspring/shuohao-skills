[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.md)
[![English](https://img.shields.io/badge/English-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.en.md)
[![日本語](https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-8b1a1a?style=for-the-badge)](README.ja.md)
[![Xでフォロー](https://img.shields.io/badge/%E3%83%95%E3%82%A9%E3%83%AD%E3%83%BC-%40eternityspring-b07070?style=for-the-badge&labelColor=8b1a1a&logo=x&logoColor=f2e3e3)](https://x.com/eternityspring)

# character-refs

あらゆる物語のキャラクター参考画像を**実際に生成**します — 小説の脚色でも、自分のオリジナルの物語でも、単発のキャラクターでも構いません。原作テキストは不要です。キャラクターを1通のメッセージで説明するだけで、動画モデル（H3 / Wan / Seedance）にそのまま添付できる参考画像一式が得られます。

![キャラクター参考画像のレポート](assets/report.webp)

**各セットの根は1つだけです**：正面全身のアンカー画像です。テキストから画像を生成するのはこの1枚だけで、顔アップ、横向き、背面、ディテールはすべてこのアンカーだけを参照し、互いに参照し合うことはありません — そのため、出来の悪い画像があってもそれだけを再生成でき、ほかの画像を巻き込みません。

## ティア — 既定はティア2

| ティア | 内容 | 生成するタイミング |
| --- | --- | --- |
| 1 | 正面全身（アンカー） | 常に、最初に |
| 2（既定） | 正面の顔アップ、90°横向き、背面 | 既定で生成 |
| 3 | ディテール：ユーザーが指定したもの、またはそのキャラクターの最も特徴的な部分。指定がなければ髪／装飾品、襟元、袖口、靴 | 装飾品や衣服のディテールのクローズアップ |
| 4（既定はオフ） | 45°の顔アップ | 依頼されたときのみ |

H3 でのテストに基づいています：全身のアンカーだけを添付した場合、衣装と背面は正しく出るものの顔がぶれます。顔アップを加えると、顔が最も近くなります。そのためティア2を既定で生成し、ディテールと45°の顔アップは必要に応じて追加します。

## 一度で入力

記入するフォームはありません。メッセージ1通で十分です — エージェントがそれを身元、顔、髪、体格、肌、上衣、下衣、ディテールの各項目に分解し、不足分を補い、各項目の出所（明示／推測／既定）をタグ付けして確認用の表を出力します。質問するのは、年齢・性別・時代が推測できない場合だけです。

## モデル

4つの選択肢があり、初回利用時に選んだものがその後も使われます：

| | 備考 |
| --- | --- |
| `qwen` | 自前の ComfyUI 上の Qwen Image 2.1。1枚あたり25〜50秒、サイズは正確、サブスクリプションの利用枠は不要 |
| `codex` | ローカルの codex 内蔵の画像生成（GPT）。APIキーは不要ですが、ChatGPT プランの利用枠を使用します（Plus では約25枚で上限に達します） |
| `openai` | OpenAI Images API。既定は gpt-image-2、従量課金 |
| `custom:<name>` | 自前のコマンド。`{prompt_file}` `{refs}` `{out}` `{width}` `{height}` でテンプレート化します |

**アンカーと派生画像には別々のモデルを使えますし、どの画像も1枚単位で別のモデルで再生成できます。** 一貫性は1つのモデルではなく、1つのアンカーを共有することで生まれます — Qwen のアンカー＋GPT の派生画像、GPT のアンカー＋Qwen の派生画像、さらに1セット内で両方を混在させる場合も、テストではいずれも破綻しませんでした。各画像には使ったモデルが記録され、混在させても注意が表示されるだけです。

## スタイル

2つのプリセットを内蔵しており、中国語名と英語名があります：

```bash
node scripts/character-refs.mjs new 阿禾-intake.json --out out/                  # 既定はアニメ調。写真風にするには --look realistic
node scripts/character-refs.mjs looks                                             # すべてのプリセットを一覧表示
```

| プリセット | 名前 | テスト状況 |
| --- | --- | --- |
| アニメ調（既定） | `anime` / `cartoon` / `动漫` | Qwen、4つのティアすべてで合格 |
| 写実的な写真 | `realistic` / `写实` | Qwen と GPT、複数のキャラクター |

独自のスタイルを使うには：`look-template anime > my-look.json` で書き出して編集し、`--look my-look.json` を指定します。既存のキャラクターのスタイルを変えるには `restyle` を使います。すべての画像が古い扱いになり、アンカーから再生成します。スタイルとキャラクターは別々のレイヤーで、キャラクターの説明にスタイルを表す語を入れると弾かれます — 同じキャラクターを別のプリセットで描けば、単に別の画風で描かれるだけです。

## ラベルと再生成

すべての画像には `character/outfit/view/version` 形式のラベル（例：`阿禾/default/face-front/v2`）が付き、ファイル名、`asset.json`、PNGのメタデータに記録されます。

```bash
node scripts/character-refs.mjs gen 阿禾/asset.json detail-neck --model codex   # 1枚を新しいバージョンとして再生成
```

古いバージョンが上書きされることはありません。固定されるのは3つだけです：アンカーのファイル、スタイルのスナップショット、テキストの説明。いずれかが変わると、それに依存するものが古い扱いになります：アンカーが新しくなればほかのすべてが、顔アップが新しくなれば髪／襟元のディテールが、説明を編集すればすべてが古い扱いになります。古くなった画像には印が付くだけで、削除はされません。

## 品質ゲート

コードでチェックされ、失敗すると `check` は終了コード1を返します：辺の長さ300〜5760 px、アスペクト比0.4〜2.5、ビューごとの目標比率（2:3 / 4:5 / 1:1）、20 MB以下（H3 / Wan / Seedance の参考画像の制限の共通部分）、白背景（全身ビューは四辺すべて、顔アップは上辺と左右の上部のみ、ディテールは明示的にスキップ）、そして古くなっていないか。**ゲートでは、似ているかどうか、角度、フレーミングは判定できません** — 画像は自分の目で確認してください。

## レポート

`render` は自己完結したHTMLページを書き出します：ティア1では1枚のカード、ティア2からはキャラクターシートのレイアウト（左に顔アップ、右上に正面／横向き／背面、右下にディテールの帯）になり、ディテールは既定で非表示、ワンクリックで表示を切り替えられます。古くなった画像には赤い枠が付き、上部の凡例でその意味が説明されます。画像にマウスを重ねると理由が表示されます。レイアウトは1枚の合成画像として生成するのではなく、コードで組んでいます — 合成画像を参考画像に使うと、モデルが人物を小さく描いてしまうためです。レポートのUIは中国語・英語・日本語を同梱しており（`render --lang en`）、そのほかの言語ではエージェントがその場でUIの文言を翻訳します。キャラクターの説明は書いたままで、画像のプロンプトは常に英語です。

## コマンドライン

```bash
node scripts/character-refs.mjs config --model qwen --confirm-anchor yes --qwen-env-file ~/comfy.env
node scripts/character-refs.mjs intake-check examples/阿禾-intake.json
node scripts/character-refs.mjs new examples/阿禾-intake.json --out out/
node scripts/character-refs.mjs gen out/阿禾/asset.json          # アンカーを生成し、確認のため停止
node scripts/character-refs.mjs confirm out/阿禾/asset.json
node scripts/character-refs.mjs gen out/阿禾/asset.json          # ティア2を補完：顔アップ、横向き、背面
node scripts/character-refs.mjs gen out/阿禾/asset.json --tier 3 --reason "hair accessory close-up in E03"
node scripts/character-refs.mjs check out/阿禾/asset.json
node scripts/character-refs.mjs render out/阿禾/asset.json --out out/character-refs.html
```

## セルフテスト

```bash
node scripts/selftest.mjs
```

233個のアサーション、モデル呼び出しなし、利用枠の消費なし。Qwen と GPT Image のアダプターはローカルのモックサーバーに対してチェックし、パイプライン全体は真っ白な画像を出力するカスタムコマンドを使ってエンドツーエンドで実行します。

## 既知の制限

- テスト済みなのは写実調とアニメ調のスタイルのみです。また、アニメ調の45°の顔アップは回転が足りません（Qwen で約20〜30°）
- 小さな傷跡は新しい傷のように見えがちです。ダブルのボタンのような大きめのディテールは、フレーミングが広くなりすぎます
- Qwen では襟元のディテールで粗い綿がベルベットのような光沢になります。その1枚は codex で再生成してください
- `openai` アダプターはリクエスト形式をチェックしただけで、実際のキーでは実行していません
- **動作確認はmacOS＋Node 24のみ**
