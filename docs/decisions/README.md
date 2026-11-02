# Architecture Decision Records (ADR)

本ディレクトリは「データでみる沖縄」の主要な意思決定の不変記録を集めたものです。なぜその決定に至ったか、どの選択肢が却下されたか、何が起きたら見直すかを時系列で残し、半年後・1 年後の自分や新しい貢献者が意思決定の背景を辿れるようにします。

## 運用方針

- 決定が確定したら新規 ADR を追加(連番 4 桁)
- **原則として改変しない**(誤植修正は例外)
- **リポジトリ外の個人メモを指す番号(`rule N` / `memory rule N`)で規範を参照しない。** 番号は第三者が辿れない。規範の内容を本文に書き切るか、リポジトリ内の文書を指す
- 決定を覆す場合は新規 ADR を起こし、旧 ADR の「状態」を `撤回(####で上書き)` に変える
- 対象: データ変換・公開ガバナンス、可視化・技術選定、CSP・セキュリティ、運営方針

## 対象外

以下は ADR ではなく別の場所で管理します。

- 個別データセットの変換判断(セル結合の解釈・欠損の扱い) → `data/datasets/<id>/notes.md`
- 過去の記録に残る番号参照(`docs/reviews/` の検証記録、`data/datasets/*/` の取得・変換記録) → 事後に書き換えない。趣旨はいずれも同じ文に併記済み
- コードの実装方針 → コードコメント / PR 本文
- セッション中の作業状態 → `.claude/state/active.md`

## テンプレート

```markdown
# NNNN. タイトル

- 状態: 採用 / 撤回(####で上書き)
- 日付: YYYY-MM-DD
- 関連 PR: #N, #M

## 背景
## 検討した選択肢
## 決定
## 帰結
## 撤回 / 再検討の条件
```

## 索引

- [0001. 可視化は Observable Plot によるビルド時静的 SVG 生成とする](0001-build-time-svg-visualization.md)
- [0002. Cloudflare Web Analytics を手動スニペット方式で導入し CSP を最小限緩和する](0002-web-analytics-beacon-and-csp.md)
- [0003. VRT のベースラインを「main のコード × PR のコンテンツ」で撮り、判定を `threshold: 0` にする](0003-content-neutral-vrt-baseline-and-exact-threshold.md)
- [0004. lint と整形に oxlint / oxfmt を採用する(edu-evidence ADR 0037 ミラー)](0004-oxlint-and-oxfmt.md)
- [0005. サイト内検索に Pagefind を採用し、CSP に 'wasm-unsafe-eval' を足す](0005-pagefind-site-search-and-wasm-csp.md)
