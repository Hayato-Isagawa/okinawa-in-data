# データでみる沖縄

沖縄県の公的データを、一次出典への恒久リンクと解説付き可視化とともに「読める形」で提供するオープンデータサイトです。第1弾は教育×子どもの貧困。

公式の [OKINAWA DPF](https://odcs.bodik.jp/okinawa-dpf/)(データカタログ)を置き換えるものではありません。本サイトの役割は次の4点です。

1. PDF に散在するデータの構造化(CSV / JSON)
2. 分野横断の結合(教育×貧困など)
3. 一次出典への恒久リンク管理(取得日・URL 変更リスクの明示)
4. 解説付き可視化(チャート+等価なデータテーブル)

このリポジトリは 2026-11 に非公開のリポジトリから移しました。文書やコメント中のリポジトリ名の付かない `#番号`・コミット SHA・`rule N` は移行前の環境のもので、第三者はたどれず、このリポジトリの PR / issue とも対応しません。

## 技術スタック

- [Astro](https://astro.build/) (SSG) + React + Tailwind CSS + TypeScript
- Cloudflare Workers (static assets)
- 可視化: Observable Plot(ビルド時に静的 SVG 生成)

## セットアップ

```bash
npm install
npm run prepare   # Git フックを有効化(clone ごとに 1 回)
npm run dev
```

`.githooks/` の pre-commit / pre-push が、`main` への直接コミット・直接 push・force push・削除を拒否します。`.npmrc` の `ignore-scripts=true` により `npm install` / `npm ci` は `prepare` を走らせないため、`npm run prepare`(`core.hooksPath` を設定する)を clone ごとに 1 回実行してください。`git config core.hooksPath` で `.githooks` と表示されれば有効です。

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバ |
| `npm run build` | 本番ビルド(`dist/`) |
| `npm run lint` | oxlint(correctness ルール。warning でも止める) |
| `npm run format` | oxfmt で整形(`.astro` / `.md` / `.yml` / `.css` / `data/datasets` / `src/data/geo` は対象外) |
| `npm run format:check` | 同上の差分検査(CI はこちら) |
| `npm run check` | 型チェック(astro check) |
| `npm run check:data` | データセットのスキーマ+整合性検証 |
| `npm run build:json` | `data.csv` から `data.json` を再生成 |

## データの信頼性

- 数値は一次資料(`curl` + `pdftotext -layout` の生テキスト)と逐語照合してから公開ステータスにします
- 変換スクリプトと pdftotext の生テキストをリポジトリに同梱し、再現可能にしています(出典の規約で本文を再配布できない、または再配布できるか確認できていないものは、生テキストを入れず、各データセットの `raw/README.md` に理由と原本の取得先を書いています)
- 変換時の判断(セル結合の解釈・欠損の扱い)は各データセットの `notes.md` に記録します

## ライセンス

- コード: MIT([LICENSE](LICENSE))
- `data/` 配下の各データセット: それぞれの `meta.json` の `license` に従います(出典元の利用規約を個別に確認・記載)
