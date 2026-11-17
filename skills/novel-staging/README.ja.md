[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.md)
[![English](https://img.shields.io/badge/English-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.en.md)
[![日本語](https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-8b1a1a?style=for-the-badge)](README.ja.md)
[![Xでフォロー](https://img.shields.io/badge/%E3%83%95%E3%82%A9%E3%83%AD%E3%83%BC-%40eternityspring-b07070?style=for-the-badge&labelColor=8b1a1a&logo=x&logoColor=f2e3e3)](https://x.com/eternityspring)

# novel-staging

AIショートドラマの各シーンの冒頭ステージング：シーンが始まる時点で、そこにいる各人物がどの物のそばに立つか座るか、座っているか立っているか、どちらを向いているかを決めます。

**なぜ独立したステップにするのか**：ショートドラマの各セグメントは個別に生成され、誰がどこに座るかをそれぞれが勝手に決めてしまいます。長テーブルを6人で囲む場面なのに、1つ目のセグメントでは名もない客が5人増え、3つ目では主人公の服を着た誰かが酒を注いでいる、といった具合です。ストーリーボードはブロッキングをセグメントからセグメントへ一字一句そのまま引き継ぎますが、各シーンの**最初の**セグメントのその一文は、でっち上げられたものでした。そこでストーリーボードの前に、各シーンにステージングを用意し、ストーリーボードはそれをコピーします。

- **まず画像を読む** — 人物がそばに立ったり上に座ったりする物を、シーン画像のメインビューから読み取り（4〜20個）、俯瞰図に配置します。人物は画像に本当に描かれている物のそばにしか立ちません。プロンプトには書かれているのに画像には描かれなかった壇があると、クリップごとに違う形で誰かがそこに立たされてしまいます
- **次に人物を配置する** — シーン開始時に誰がいて、誰が後から入ってくるか。脚本どおりに座るか立つか。年長者は上座に、敵対する者はテーブルの向かいに、疎まれる者は末席に。脚本が群衆を指定しない限り、エキストラは置きません
- **ブロッキングの一文はプログラムが書く** — 「胡二爷は3列目のベンチに座り、北を向いている。ほかの席はすべて空いており、ほかには誰もいない。」シーンのストーリーボード最初のセグメントがこれをコピーします
- **レポートは編集できる** — シーンごとの俯瞰図で、人物をドラッグし、クリックして座る・立つと向きを設定し、結果を新しい staging.json としてエクスポートできます

**デフォルトの成果物は、インタラクティブなツールレポート `staging-report.html` です。** ブラウザで開き、人物をドラッグし、姿勢と向きを調整して、編集後のJSONをエクスポートします。`staging.json` も作業データとして保存されます。Markdown は任意の `--md` エクスポートです。レポートUIのデフォルトは中国語で、`render --lang en` で英語UIになります（その場合、ブロッキングの一文には画像を読み取る際に付けた英語名が使われます）。

![英語UIの staging-report.html](assets/report-en.jpg)

## 品質ゲート：8項目、すべてコード

| ゲート | ルール |
| --- | --- |
| 画像の読み取り | 場所ごとに4〜20個の物 |
| 物の整合性 | 名前が一意。俯瞰図のボックスが有効。画像から読み取った場合は画像上のボックスがある |
| 場所の解決 | すべてのシーンの場所が読み取り済み（art.json が与えられた場合はそれと照合） |
| キャスト | 各人物がちょうど1回ずつ。script.json が与えられた場合はそれと照合し、**与えられない場合はその旨を明示する** |
| いるかいないか | 全員について冒頭にいるかいないかが指定されている。少なくとも1人はいる |
| **場所から読み取った物のそばにいる** | 人物は読み取った物のそばに立つ。「上に」をとれるのは座れる・立てる物だけ。辺・姿勢・向きが有効 |
| 同じ位置に重ならない | 同じ物の同じ辺にいる2人は、その辺に沿って散らされる |
| エキストラ | 整数であること。いる場合はどこにいるかが書かれている |

すべてのゲートに、それを破るテストケースがあります。

## レポート：ドラッグできる俯瞰図

- 人物を平面図上の好きな場所へドラッグできます。離すと、最寄りの物の最寄りの辺に、それが座席であればその上に着地します。別の辺へ移すと、その物のほうを向きます
- 平面図の下には、冒頭にいない人物のトレイがあります。ドラッグして入れると登場させ、ドラッグして戻すと退場させます
- 人物をクリックすると、座る・立つと8方向の向きのいずれかを設定できます
- エキストラの増減とその位置を設定でき、ブロッキングの一文とシーンのチェックがリアルタイムに更新されます
- シーン画像がある場合、物にカーソルを合わせると画像上のそのボックスが強調表示されます
- 変更はブラウザに保存され、再読み込みしても残ります。「Export JSON」で編集後の staging.json をダウンロードでき、`validate` はそれをそのまま受け付けます

このページはコマンドラインと同じコードで動いています。着地位置、平面図上の座標、文章、チェックはすべて、丸ごと埋め込まれた `stagingCore()` から得られます。

## パイプライン内の位置

```
novel-outline    → outline.json  (names)
novel-art        → art.json      (places + scene pictures)
novel-script     → script.json   (who is in each scene, what happens)
novel-staging    → staging.json  (who is where when each scene opens)
novel-storyboard → storyboard.json
```

- `seed <script.json> --art <art.json> --outline <outline.json>` は、場所・シーン・キャストを決定論的に埋めます
- novel-storyboard はまだ staging.json を自分では読みません。`blocking` が、ストーリーボードのシーン最初のセグメント用に、各シーンの冒頭の一文を出力します

## コマンドライン

```bash
node scripts/novel-staging.mjs seed script.json --art art.json --outline outline.json > staging.json
node scripts/novel-staging.mjs validate staging.json --script script.json --art art.json
node scripts/novel-staging.mjs checkup staging.json                 # ゲートのみ
node scripts/novel-staging.mjs render staging.json > staging-report.html  # デフォルトは HTML
node scripts/novel-staging.mjs render staging.json --lang en > staging-report.html # 英語UI
node scripts/novel-staging.mjs render staging.json --md > staging.md # 任意のテキストエクスポート
node scripts/novel-staging.mjs blocking staging.json --lang en       # 各シーンの冒頭ブロッキング
```

## セルフテスト

```bash
node scripts/selftest.mjs
```

99件のアサーション：俯瞰図のジオメトリ、着地位置、文章、seed、8つのゲートを1つずつ破るテスト、レンダリング（両方のUI、エスケープ、画像）、そして埋め込みコードを自身のソースから再ビルドしてコマンドラインと一致するかの確認。モデル呼び出しはなく、1秒未満で終わります。

**macOS + Node 24 でのみテスト済みです。** コードにプラットフォーム固有の部分はありませんが、Linux や古い Node では**検証していません**。
