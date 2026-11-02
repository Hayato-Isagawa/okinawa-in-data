# raw/ — gakureki-okinawa-shichoson

## 原本(gitignore・再取得して convert を再実行)
- `c11_02_gakureki_shikuchoson_statInfId000032201217.xlsx`(約12MB)
  - 令和2年国勢調査 就業状態等基本集計 第11-2表(全国・都道府県・市区町村)
  - e-Stat statInfId `000032201217`(fileKind=0)
  - 取得: `curl -L "https://www.e-stat.go.jp/stat-search/file-download?statInfId=000032201217&fileKind=0" -o c11_02_gakureki_shikuchoson_statInfId000032201217.xlsx`
  - 全国 135,595 行を含み容量が大きいため履歴に載せない(沖縄は 47xxx の42行のみ使用)。抽出値・恒等式・照合は data.csv と notes.md、変換は scripts/convert/gakureki-okinawa-shichoson.ts を参照
  - 照合済み原本の同一性錨: md5 `b83913e608a84bfad02e0c6f4c1bd331` / 12,144,704 bytes(2026-07-12 再取得で一致確認。statInfId は集計更新で変わり得るため、再取得物はまずこの md5 と照合する)
