# 変換メモ — nenshojinko-okinawa-shichoson

作成: 2026-07-05。詳細な列マッピング・導出式は変換スクリプト(scripts/convert/nenshojinko-okinawa-shichoson.ts)冒頭のコメント参照。

## 共通の判断
- raw/ には e-Stat 公表の元 Excel をそのままコミット(監査証跡。e-Stat 利用規約で再配布可)
- 市町村の同定は名称でなく団体コード先頭5桁で行い、境界データ(41市町村)との完全一致を変換時に assert
- 住基台帳系の市区町村名は「国頭郡国頭村」形式のため、名称照合は郡プレフィックスを除去して実施

## 逐語照合の記録
- 那覇市・北大東村ほかを元 Excel と照合し一致(2026-07-05、詳細は meta.json の verification)
