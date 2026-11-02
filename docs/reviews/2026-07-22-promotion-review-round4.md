# 独立再照合ゲート 第4回 — 学校保健統計2本+高卒県外就職2本の published 昇格(2026-07-22)

対象: 2026-07-20/21 に draft 追加した gakko-hoken-keinen / gakko-hoken-r7-todofuken / kengai-shushoku-keinen / kengai-shushoku-r7-todofuken の4本。検証は独立サブエージェント4体が並列実施し、判定は主コンテキストで行った(rule 29)。

## 方法(全データセット共通・第3回と同一規律)

- 変換スクリプト(`scripts/convert/`・`scripts/lib/`)は不読・不実行、SheetJS 不使用
- .xlsx は python3 標準ライブラリ(zipfile + xml.etree)の自前パーサで独立抽出(表示書式は styles.xml から再現)。旧 .xls(h24 学校保健・2010〜2014 県外就職)のみ xlrd 2.0.x(scratchpad venv)を使用
- シート・行・列はヘッダ/表題の実文言から自力同定(データセット側の設計メモに依存しない)
- data.csv の全行全列を全数照合、恒等式を全行検証、data.json(配布資産)とも突合
- meta.json の数値主張(description/readingGuide/caveats)を CSV/raw から再計算、引用逐語の実在確認
- 来歴検証: meta permalinkNote の statInfId で e-Stat から再取得し、ローカル raw・ACQUISITION.md の md5 錨と一致確認
- sources / license URL の生存確認(HTTP 200)+ e-Stat 利用規約の文言(政府標準利用規約2.0準拠・CC BY 互換)を live 本文で実確認

## 結果一覧(照合不一致 0 件 / 4本)

| データセット | 全数照合 | 恒等式・接続 | 来歴(再取得 md5) | 判定 |
|---|---|---|---|---|
| gakko-hoken-keinen | 98+112セル一致(表示桁の末尾ゼロ含む) | むし歯恒等式28/28。R7=単年と6値一致 | 14/14 一致(+ACQUISITION 錨18件) | PASS |
| gakko-hoken-r7-todofuken | 240セル+data.json 一致。記号=7県の裸眼のみ(X/-) | むし歯恒等式48/48(最大差0.1=許容内) | 1/1 一致 | PASS |
| kengai-shushoku-keinen | 192セル一致(丸め境界0件) | 計=Σ就職先 48/48。前年併記行の接続15/15(区分変更・レイアウト変更境界含む)。R7=単年と4値一致 | 16/16 一致 | PASS |
| kengai-shushoku-r7-todofuken | 96セル+data.json 一致 | 計=Σ就職先 48/48(自県「…」=県行1個・全国行0個) | 1/1 一致 | PASS |

追加確認(昇格時課題): **学校保健統計 R2〜R6 の各年度公表資料**を取得・実見し、調査時期に関する各年度注記(R2〜R5=調査期日延長・前年度以前と単純比較不可、R6=期日復帰+R7 と同文の遡及注記)が R7 の遡及注記と矛盾しないことを確認した。

## ゲートが検出し是正した事項(いずれも表現レベル・データ値の不一致はゼロ)

1. **kengai-shushoku-keinen description**: 「どの年も全国を約10ポイント上回ります」は不正確(実測差 8.0〜20.4pt、平成22年=20.4pt)→「大きく上回ります(差は8〜20ポイント)」に修正
2. **gakko-hoken-keinen readingGuide**: 「どの年度も全国のおおむね1.7倍前後」(実測 1.57〜1.91倍)→「1.6〜1.9倍」、「14年間で」(経過は13年)→「平成24年度の…から令和7年度の…へ」に修正
3. **kengai-shushoku-r7-todofuken の桁区切り記述**: 「桁区切りカンマを除去」はこの表(新レイアウト・書式 `0;\-0;"－"`)には実態がない → 「この表の原表表示に桁区切りはない」に修正(経年側の旧レイアウトには桁区切りがあるため keinen の記述は維持)
4. **gakko-hoken-r7-todofuken caveat の記号表記**: Excel 実セルは半角「X」「-」で、caveat の「－」(全角)は「調査の概要」の規約表記 → 由来を明記
5. **kengai-shushoku-r7-todofuken notes.md**: 就職先上位の列挙が実際の4位(神奈川51人)を欠落 → 追記

## 残課題(昇格ブロッカー外)

- MEXT「県外」の調査の手引き上の逐語定義は未取得のまま(表頭構造(就職先内訳+自県「…」)からの判断。両 kengai notes.md に既記載)
- 表295「その他」列の定義は原表に注記なし(caveats に明記済み)
- gakko-hoken「DMF は12歳のみ公表」の全年齢実証は R7 ファイルのみ(他年度は未実施)
- data.json の number 型による末尾ゼロ落ちは既知設計(原表の桁数は data.csv の文字列が権威)

## 昇格処理(本レビューと同一 PR)

- 4本の status を published へ変更、「検証中」表示解除
- sources に archiveUrl を付与: 掲載ページの Wayback スナップショット(経年型の前例=shingaku-ritsu-keinen と同方式)。00400001=web/20260722014802、00400002=web/20260722014831(いずれも取得時に 200+調査名の掲載を確認)
- changelog 1行追加
