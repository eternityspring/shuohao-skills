[![中文](https://img.shields.io/badge/%E4%B8%AD%E6%96%87-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.md)
[![English](https://img.shields.io/badge/English-f2e3e3?style=for-the-badge&labelColor=f2e3e3&color=b07070)](README.en.md)
[![日本語](https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-8b1a1a?style=for-the-badge)](README.ja.md)
[![Xでフォロー](https://img.shields.io/badge/%E3%83%95%E3%82%A9%E3%83%AD%E3%83%BC-%40eternityspring-b07070?style=for-the-badge&labelColor=8b1a1a&logo=x&logoColor=f2e3e3)](https://x.com/eternityspring)

# novel-art

**AIショートドラマ制作**のための美術バイブル：シーン＋物語上の小道具。前提として組み込まれているのは、**撮影ではなく生成する**ということです。ロケハンも、セット建て込みも、小道具の調達もありません。環境と小道具は、何十回も生成し直しても同じものに見えなければならないアセットです。そのため成果物は一貫性の計画になります。

**シーン**：デザイン意図、一貫性アンカー（シーンごとに3〜5個。視聴者はそれで場所を見分け、QCはそれでカットを照合します）、ライティング状態（時間帯の変更は**ライティングの調整ではなく再生成**です）、そしてバリアントの仕組み（`variantOf` + `changes`。親のシートを参照して生成します）。

**小道具**（物語上の小道具のみ。クローズアップされ、エピソードをまたぎ、プロットを担うもの。1作品あたり通常3〜8個）：まず劇的な機能を定め、**状態バリアント**（閉じたスーツケースと開いたスーツケースは2つの参照画像になります）、すべてのプロンプトに書き込む**スケール参照**（AIは手に持つ小道具を家具サイズで描きがちです）、そして**白背景・手なしのホワイトプレート**。小道具の参照画像はカットに合成されるため、小道具を持つ手は典型的な汚染要因です。セット装飾はシーンのアンカーに含め、一度きりの手持ち小道具はカット単位で扱います。どちらにも専用のアセットは作りません。

出力は `art.json`、Markdownレポート、自己完結した `art-report.html` です。レポートはデフォルトで中国語UIでレンダリングされます。`--lang en` を渡すと完全に英語のレポートになります（または art.json のトップレベルに `"lang": "en"` を設定。`--lang` が優先されます）。画像プロンプトはどちらの場合も常に英語です。英語モードでは品質ゲートのラベルも翻訳されます（しきい値は計算されたまま）。失敗したゲートの詳細とすべてのデータは、作成されたままです。

![art-report.html](assets/report.webp)

## 品質ゲートはコードである

他の2つのスキルと同じ立場です：**モデルが自分で採点するチェックリストには価値がありません。** 決定論的なゲートは10個：アンカー3〜5個（シーンと小道具の両方）、ライティング状態はシーンごとに1つ以上、すべてのネガティブで人物を禁止、すべてのプロンプトが英語、キャラクター名を含まない（`--cast` で検査し、指定しない場合はスキップと明示的に報告）、バリアントの参照が完全であること、さらに小道具専用の4つのゲート：**状態が1つ以上**、**プロンプトにスケールの記述がある**、**ネガティブで手を禁止**、**シートが純白背景**。セルフテストは、すべてのゲートを意図的に破ります。

## 3スキルのリレー

```
novel-outline    → outline.json (what: structure & episodes)
novel-characters → cast.json    (who: character assets)
novel-art        → art.json     (where & what they hold: art assets)
```

`seed <outline.json>` はシーン一覧と小道具一覧の両方を決定論的に事前入力し、それぞれが登場するエピソードと担うビートを引き継ぎます。アウトラインに `props` がない場合、小道具一覧は空のままになり、モデルが `prop-pass.md` に従って本文から抽出します。`validate --cast` はプロンプトをキャラクター名簿と照合します。質感の記述は、キャラクタースキルの肌のディテールではなく、環境寄りの表現になっています。レンダリングスタイルはプロンプトにまったく書き込まれず、生成時に呼び出し側が先頭に付け加えます。

## CLI

```bash
node scripts/novel-art.mjs seed outline.json > art.json
node scripts/novel-art.mjs validate art.json --cast cast.json
node scripts/novel-art.mjs checkup art.json
node scripts/novel-art.mjs render art.json --html             # 中国語のレポートUI（デフォルト）
node scripts/novel-art.mjs render art.json --html --lang en   # 英語のレポートUI
```

## シートのレイアウト仕様

**このスキルは画像を生成しません。** 成果物は `image.sheet` です。これは下流で画像を生成するものに向けた
完全なレイアウト指示で、モデル、スタイル、アスペクト比はそこで選ばれます。
この3つはいずれも、この層では答えられません。

シーンごと・小道具ごとに1枚ずつ作り、どちらも**メインビュー＋L字型のディテール枠**のレイアウト
（下端と右端）を使います。シーンのディテール＝アンカーのクローズアップ。小道具のディテール＝アンカーのクローズアップ＋
その他の状態＋側面図。シーンには人物を置きません。小道具はさらに手を禁止し、
きれいに切り抜けるよう純白の背景に置きます。バリアントの指示には、親のシートを参照するよう記載されます。
完全な仕様は `references/sheet.md` にあります。

## セルフテスト

```bash
node scripts/selftest.mjs
```

151個のアサーション：シード、全10ゲートを破るケース、レンダリング（zh/en のレポートUI）、エクスポート。モデル呼び出しはなく、約1秒で実行されます。

**macOS + Node 24 でのみテスト済みです。**
