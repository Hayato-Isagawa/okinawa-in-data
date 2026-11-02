# 0004. lint と整形に oxlint / oxfmt を採用する(edu-evidence ADR 0037 ミラー)

日付: 2026-09-12
状態: 採用
関連: edu-evidence ADR 0037(原本。edu-evidence の同名 PR で採用)

## 背景

このリポには linter も formatter も無かった。検査はデータセットのスキーマ（`check:data`）と変換ライブラリ（`test:lib`）に寄っていて、
`scripts/` `tests/` の JS / TS と `.astro` の frontmatter は型検査（`astro check`）以外に見るものが
無い。ファミリーで開発ツールを VoidZero（Vite / Rolldown / Oxc）に揃える方針に沿い、Oxc の oxlint と oxfmt を入れる。
バンドラは Astro 7 経由で Vite 8（内部は Rolldown）を既に使っている。

一次資料（oxc.rs のドキュメント）と実機（oxlint 1.82.0 / oxfmt 0.67.0）で確かめた前提:

- oxlint は `.astro` の frontmatter と `<script>` を lint する（`debugger` を両方で検出）。既定は `correctness`
  カテゴリで、warning でも exit 0
- **oxfmt は `.astro` を扱えない**（対応言語表に無く、Prettier プラグインは Not supported。実機でも対象外）
- 両方とも postinstall を持たず、プラットフォーム別バイナリは optionalDependencies で入る

## 検討した選択肢

1. **oxlint + oxfmt**（採用）。`.astro` の整形は諦める
2. eslint + prettier + prettier-plugin-astro。`.astro` も整形できるが、ファミリーの方針と逆で、速度も劣る
3. lint だけ入れて formatter は入れない。整形の揺れが残る

## 決定

### oxlint

- `.oxlintrc.json`: 既定カテゴリ（correctness）。`no-irregular-whitespace` は `skipComments: true`（コメント内の
  全角空白は `scripts/convert/*` と `scripts/lib/*-excel.ts` の日本語ラベル説明で 18 件あり、全部コメント内）。
  `ignorePatterns` は `data/datasets/**` と `src/data/geo/**`（`.md` / `.yml` / `.css` は oxlint の対象外なので、oxfmt 側の
  除外は要らない）
- 導入時の warning は 20 件。18 件は上の全角空白で `skipComments` で消えた。残り 2 件（`new Array(n).fill(false)` →
  `Array.from`、テンプレートリテラルへの `|| "/"` は常に偽側に落ちないので削除）は挙動を変えずに直した
- `npm run lint` = `oxlint --deny-warnings`。warning で止めないと CI で意味を持たない

### oxfmt

- `.oxfmtrc.json`: `printWidth 80` / `semi` / ダブルクォート / `tabWidth 2` / `trailingComma es5`（姉妹サイトの
  prettier 設定と同じ値）。`sortPackageJson: false`（既定 true は `package.json` のキー順を
  並べ替える。prettier に無い挙動で、`overrides` の並びが動く）
- **対象は oxfmt が検出する言語のうち、次を除いたもの**（`ignorePatterns`）:
  - `**/*.md` — docs と `data/` 配下の取得・変換の記録。CJK の表パディングは見た目が揃わない
  - `**/*.yml` `**/*.yaml` — workflow のガードテスト（`vrt-baseline.test.mjs` 等）が字面で検査している
  - `**/*.css` `**/*.scss` — **整形が本番 CSS を変える。** edu-evidence で `global.css` の `color-mix(...)` を
    複数行に折ると Lightning CSS の出力が `#0059861a` から `oklab(…/.1)` に変わった（同じ色の別表記だが byte 同一
    ではない）。Tailwind の `@theme` CSS は整形の対象にしない
  - `**/*.html` — `data/datasets/*/raw/` の取得物（Shift_JIS があり、oxfmt が読めずに非 0 で落ちる）
  - `wrangler.jsonc` — 配信設定を 1 バイトも触らない（`routes` 配列の折り返しが変わる）
  - `data/datasets/**` — データセット本体と取得・変換の記録。整形の対象ではない（`data/schema/dataset-meta.ts` は
    Zod スキーマの TS ソースなので lint / 整形の対象に含める）
  - `src/data/geo/**` — 地図の境界データ。整形すると 1 行の geojson / topojson が数千行になる
- `npm run format` = `oxfmt`、`npm run format:check` = `oxfmt --check`（CI）
- 初回整形は同じ PR の別コミット（`style: format with oxfmt`）。整形前後で `npm run build` の `dist` は
  `design-tokens.json`（`generatedAt`）を除き byte 一致

### CI

`build.yml`（required check「Build site」）に `Lint (oxlint)` と `Format check (oxfmt)` を足す。required check の集合は
変えない。`auto-merge-workflow.test.mjs` が 2 つの step の配線と `--deny-warnings` を固定する（`test:workflows` の下限
82 → 83）。`check:all` にも足した。

## 帰結

- `.astro` のテンプレート部は整形されない。oxfmt が Astro を載せたら見直す
- oxfmt は 0.x。minor bump で整形規則が変わると `format:check` が赤になる。このリポの auto-merge は SHA に現れた check を
  全部待つので、その Dependabot PR はマージされない。`npm run format` を当てて commit する
- `check:all` は手元用で、CI は同じ script を個別 step で呼ぶ

## 撤回 / 再検討の条件

- oxfmt が `.astro` を扱えるようになったら、対象に含めるかを判断する
- Tailwind / Lightning CSS の出力が整形に依存しなくなったら、CSS を対象に戻す
