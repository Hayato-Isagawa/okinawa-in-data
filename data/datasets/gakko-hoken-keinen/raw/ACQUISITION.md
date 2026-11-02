# 学校保健統計調査 一次データ取得記録(2026-07-20、収録前の準備中メモ)

取得 subagent の報告の転記。変換・逐語照合は未実施(このディレクトリは meta.json 未作成の準備中=ビルド対象外)。

## 出典

- 統計: 学校保健統計調査(文部科学省、統計コード 00400002)
- **最新は令和7年度(2025年度)調査。2026-02-13 確報公表**(調査期日: 令和7年4月1日〜6月30日)
- 取得元: e-Stat 統計表ファイル(`https://www.e-stat.go.jp/stat-search/file-download?statInfId=...&fileKind=0`)。CSV(fileKind=1)は無応答で取得不能・一覧のファイル形式も EXCEL のみ=統計表としての CSV 提供なし(実測)。e-Stat DB は 2019年度分(2020-03-23 公開)で更新停止のため、経年は年度別 Excel が唯一の経路

## ファイルと statInfId(都道府県別 疾病・異常被患率等、表8/表9)

| ファイル | statInfId | 年度 |
|---|---|---|
| r7_hyo8_pref_shippei.xlsx | 000040409514 | 2025(令和7) |
| r6_hyo8_pref_shippei.xlsx | 000040248436 | 2024(令和6) |
| r5_hyo8_pref_shippei.xlsx | 000040228017 | 2023(令和5) |
| r4_hyo8_pref_shippei.xlsx | 000040120033 | 2022(令和4) |
| r3_hyo8_pref_shippei.xlsx | 000032258892 | 2021(令和3) |
| r2_hyo8_pref_shippei.xlsx | 000032108460 | 2020(令和2) |
| r1_hyo8_pref_shippei.xlsx | 000031925057 | 2019(令和元) |
| h30_hyo8_pref_shippei.xlsx | 000031812096 | 2018(平成30) |
| h29_hyo8_pref_shippei.xlsx | 000031685245 | 2017(平成29) |
| h28_hyo8_pref_shippei.xlsx | 000031557589 | 2016(平成28) |
| h27_hyo9_pref_shippei.xlsx | 000031399265 | 2015(平成27) |
| h26_hyo9_pref_shippei.xlsx | 000028921339 | 2014(平成26) |
| h25_hyo9_pref_shippei.xlsx | 000023629542 | 2013(平成25) |
| h24_hyo9_pref_shippei.xls | 000020086441 | 2012(平成24、旧 xls) |

全国表(学校段階計のスポット値用): r7_hyo4_national_shippei.xlsx(000040409510)/ r6_hyo4_national_shippei.xlsx(000040248432)「4 年齢別 都市階級別 設置者別 疾病・異常被患率等」

原典注記: mext_r7_kohyo.pdf/.txt(公表資料)、mext_r7_gaiyo.pdf/.txt(調査の概要)、terms_of_use.html(e-Stat 利用規約)

## 表の構造(subagent 報告、変換時に実ファイルで再確認すること)

- 都道府県別表は**年齢別(5〜17歳)であり学校段階別ではない**。39シート=年齢13×性別3(計/男/女)
- 新レイアウト(2021〜2025): ヘッダ行4〜6、行7=「全国」、行8〜54=北海道→沖縄県(JIS順、col1)。主要列: c11=裸眼視力1.0未満計 / c20〜22=むし歯（う歯）計・処置完了者・未処置歯のある者 / c28〜32=永久歯の1人当り平均むし歯（う歯）等数(DMF)系
- 旧レイアウト(2012〜2020): タイトル行3、行12=「全　　　国」(全角空白、col2)、行59=「沖　縄　県」。c13=裸眼 / c22〜24=むし歯 / c30〜34=DMF(h24 の xls は 0 始まりで -1)
- **DMF は 12歳シートのみ**(他年齢は「…」)

## スポット値(subagent がファイルから読み取り。逐語照合はこれから)

- R7: 沖縄12歳 むし歯40.0%(全国23.09)/裸眼57.4%(全国53.52)/DMF 1.0本(全国0.47)。6歳むし歯39.5%(全国24.41)
- R6: 沖縄12歳 むし歯45.9%(全国25.11)/裸眼56.3%(全国55.73)/DMF 1.4本(全国0.53)
- 12歳むし歯計%の経年(全国/沖縄): 2012: 42.78/72.0 → 2015: 37.82/62.4 → 2019: 31.76/51.6 → 2025: 23.09/40.0

## 収録設計上の注意(原典逐語)

1. **断層**: R7公表資料に「令和２年度から令和５年度の数値については、いずれの項目も調査時期の異なる数値を含んでいる影響があるため、他の年度の数値と比較はできない」(2箇所)→ **2020〜2023年度の4年分は他年度と経年比較不可**
2. **標本調査**: R7 健康状態の抽出率25.4%。標準誤差×2≒95%区間の説明が「利用上の注意」にあり。表4注記に標準誤差実値(むし歯計: 小0.27・中0.31 等)
3. **秘匿「X」**: 標準誤差5以上・受検者100人未満等は非公表。実例: R7 秋田県の裸眼視力全列X、R7 沖縄17歳裸眼X、R2 北海道裸眼X
4. **学校段階計(小学校・中学校)の都道府県別値は非公表**(全国表4のみ)→ 県比較は 12歳(中1相当)等の年齢軸で行う
5. 平成24年度階層に「参考(岩手・宮城・福島の平成23年度補完推計)」あり=2011年度は3県欠測(補完推計の中身は未確認)

## ライセンス

e-Stat 利用規約=政府標準利用規約(第2.0版)準拠・CC BY 4.0 互換を逐語確認(terms_of_use.html 保存済み)。出典記載+編集・加工した旨の記載が条件。

## md5 錨(2026-07-20 取得時点。Excel/PDF は gitignore のため再取得時にこれと照合する)

```
110cccb95161fb302176889236f1183c r7_hyo8_pref_shippei.xlsx (gakko-hoken-r7-todofuken/raw の同名ファイルも同一)
40e251a4e608cd9150739f737009af97 h29_hyo8_pref_shippei.xlsx
518a2d500c1b38e9d19a08a1aea379b8 mext_r7_gaiyo.pdf
542065839ffa007af5e478f67a0cac16 h27_hyo9_pref_shippei.xlsx
5ccfd58858f0cdc6616a7c2f65c59227 h25_hyo9_pref_shippei.xlsx
6376de3bb9ea8aed38b5d6e7996475e0 r4_hyo8_pref_shippei.xlsx
6a7213da8a168c08299467cd41b33652 r3_hyo8_pref_shippei.xlsx
73c2cabac9393dddcf43a9b96db56102 r7_hyo4_national_shippei.xlsx (r7-todofuken 側も同一)
8689633f7e36abb813adf38379dc5f77 r6_hyo4_national_shippei.xlsx
8e30c431dc45d657217ce637ca09bf7f r6_hyo8_pref_shippei.xlsx
b2e4fe506cc7382ca35db7754171e390 r1_hyo8_pref_shippei.xlsx
cf7bb2376ac8701e842c45a2abf5b1ff h28_hyo8_pref_shippei.xlsx
d71fc3dde7b62f379be333d3bd7062fb h24_hyo9_pref_shippei.xls
decf43248d234f40fc33069d8067bc78 r5_hyo8_pref_shippei.xlsx
e92c794d39aaf97193d4d9e9a8b7feab r2_hyo8_pref_shippei.xlsx
f06a262a1d220d8f2706ef7d6ef87c76 mext_r7_kohyo.pdf
f87c74580de90cb5b921b75673c76da3 h26_hyo9_pref_shippei.xlsx
f926c180204ff246d26042d0d1f0b470 h30_hyo8_pref_shippei.xlsx
```

## 未確認事項

- e-Stat DB の CSV(appId 必須の API 経由)は未取得。DB 収録範囲(2012〜2019)は上記 Excel で代替済み
- R6 以前の各年度公表 PDF の注記は未確認(R2〜R5 断層は R7 公表 PDF でカバー)
- 沖縄 R6 の DMF 内訳(計1.4 / むし計1.3)が丸めで不一致に見える点はファイル記載のまま
