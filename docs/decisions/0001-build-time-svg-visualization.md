# 0001. 可視化は Observable Plot によるビルド時静的 SVG 生成とする

- 状態: 採用
- 日付: 2026-07-05

## 文脈

本サイトはデータセット詳細ページとテーマ横断ページでチャートを多用する。対象読者は一般県民・保護者・教員・研究者・行政職員と幅広く、Lighthouse 目標(Performance 90+ / Accessibility 100)と厳格な CSP(`script-src 'self'`、インラインスクリプトなし)を両立させたい。候補は Observable Plot と Chart.js。

## 決定

Observable Plot を採用し、**ビルド時(Astro の SSG パス)に linkedom の document を渡して SVG 文字列を生成**、ページには静的 SVG として埋め込む。Plot と linkedom は devDependencies に置き、クライアントバンドルには含めない。

## 理由

| 観点 | Observable Plot(ビルド時) | Chart.js |
|---|---|---|
| 出力 | SVG(実 DOM、拡大しても劣化しない) | Canvas(ビットマップ) |
| クライアント JS | 0 KB | ランタイム必須(数十 KB+hydration) |
| a11y | SVG 内テキストが DOM に存在。`role="img"` + `aria-labelledby` を付与できる | Canvas は実質ブラックボックスで代替テキスト頼み |
| CSP | 静的 SVG のみで `script-src 'self'` を維持 | ランタイム JS が前提 |

弱点はツールチップ等のインタラクションが不可なこと。本サイトは方針として**チャートと等価なデータテーブルを必ず併設する**ため、詳細値の参照はテーブルが担保する。

## 帰結

- チャート生成は `.astro` フロントマター(ビルド時実行)または共有ヘルパーで行う
- 将来インタラクティブが必要になった箇所のみ、個別に React island 化を検討する(その際は本 ADR を改訂)
