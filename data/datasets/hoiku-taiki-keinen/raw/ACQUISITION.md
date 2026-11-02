# ACQUISITION — 保育所等待機児童(保育所等関連状況取りまとめ)

- 取得日: 2026-07-23
- 取得者: gather subagent(curl 実取得。WebSearch は URL 当たり付けのみに使用)
- 対象: こども家庭庁(R5〜R7)・厚生労働省(〜R4、WARP 退避)「保育所等関連状況取りまとめ」(各年4月1日時点)
- 最新公表年: **令和7年4月1日時点**(公表 2025-08-28、こども家庭庁)

## 1. 取得元 URL

### 公表ページ
| 年 | 公表ページ |
|---|---|
| R7 | https://www.cfa.go.jp/policies/hoiku/torimatome/r7 |
| R6 | https://www.cfa.go.jp/policies/hoiku/torimatome/r6 |
| R5 | https://www.cfa.go.jp/policies/hoiku/torimatome/r5 |
| R4 | WARP: https://warp.da.ndl.go.jp/info:ndljp/pid/12862028/www.mhlw.go.jp/stf/newpage_27446.html(実体= https://warp.da.ndl.go.jp/20230423/20230403154716/www.mhlw.go.jp/stf/newpage_27446.html ) |
| R3 | 同上 pid、newpage_20600.html(実体 timestamp=20230404180254) |
| R2 | newpage_13237.html(実体 timestamp=20230404180459) |
| H31 | houdou/0000176137_00009.html(実体 timestamp=20230404180622) |
| H30 | houdou/0000176137_00002.html(実体 timestamp=20230404180750) |
| H29 | houdou/0000176137.html(実体 timestamp=20230404180942) |
| H28 | houdou/0000135392.html(実体 timestamp=20230404193932) |

- 年度インデックス: https://www.cfa.go.jp/policies/hoiku/torimatome (H20〜R7 の 4/1 時点リンク+旧 10/1 時点リンクを掲載)
- **厚労省本体の原 URL は 404 確認済**(2026-07-23 実測: `www.mhlw.go.jp/stf/newpage_27446.html`=404、`/content/11922000/000979606.pdf`=404)。〜R4 の一次入手経路は WARP のみ。
- WARP の実体 URL 形式: `https://warp.da.ndl.go.jp/<retrieval>/<timestamp>/<原URL>`(info:ndljp シェルページの iframe src から抽出)

### ファイル直リンク(取得済)
- R7(cfa assets 配下、prefix= `https://www.cfa.go.jp/assets/contents/node/basic_page/field_ref_resources/b0a8057b-34bf-4c20-84fb-ae592708ca9b/`)
  - 全体版 PDF: `c853cacb/20250828_policies_hoiku_torimatome_r7_01.pdf`
  - 資料1〜6 Excel: `1a728dcc/20250828_policies_hoiku_torimatome_r7_02.xlsx`
  - 定員・申込者の状況 Excel: `1aa96453/20250828_policies_hoiku_torimatome_r7_04.xlsx`
- R6(prefix= `.../4ddf7d00-3f9a-4435-93a4-8e6c204db16c/`): `82ad22fe/..._r6_02.pdf`(全体版) / `ccac221b/..._r6_03.xlsx`(資料1〜7) / `3b8b7af2/20250122_..._r6_07.xlsx`(申込者)
- R5(prefix= `.../f699fe5b-bf3d-46b1-8028-c5f450718d1a/`): `7803b525/..._r5_02.pdf` / `b9103863/..._r5_03.xlsx` / `e28c52c6/..._r5_04.xlsx`
- R4(WARP 20230403154716): mhlw content/11922000/ `000979606.pdf` / `000979641.xlsx` / `000981430.xlsx`
- R3(WARP 20230404180254): `000821949.pdf` / `000822141.xlsx` / `000821951.xlsx` / 訂正 `000841595.pdf`
- R2(WARP 20230404180459): `000678692.pdf` / `000678694.xlsx` / `000667749.xlsx`
- H31(WARP 20230404180622): content/11907000/ `000544879.pdf` / `000544880.xlsx` / `000544881.xlsx`
- H30(WARP 20230404180750): `000350592.pdf` / `000356832.xlsx` / `000350596.xlsx`
- H29(WARP 20230404180942): file/...Hoikuka/ `0000176121.pdf` / content/11907000/ `000355259.xlsx` / file/ `0000176127.xlsx`
- H28(WARP 20230404193932): file/ `0000098603_2.pdf` / `0000135398.xlsx` / `0000135399.xlsx`
- H27 申込者のみ(H28 ページに併載、WARP 20230404193932): file/ `0000135400.xlsx`

### 利用規約
- こども家庭庁 コピーライトポリシー: https://www.cfa.go.jp/copyright-policy → `cfa_copyright_policy.html`
- こども家庭庁 サイトポリシー: https://www.cfa.go.jp/site-policy → `cfa_site_policy.html`
- 厚労省 著作権・利用規約: https://www.mhlw.go.jp/chosakuken/index.html → `mhlw_chosakuken.html`

## 2. md5 一覧(`md5 -q`、2026-07-23)

```
e04d2e05f34db3692f60729678549808  cfa_copyright_policy.html
bb01919918ffa52dad5cb398eb017abe  cfa_r5_moshikomi.xlsx
ffd977b22a5374d1a37379e8d135aa79  cfa_r5_shiryo1-7.xlsx
8e06b8913a77870aa5fcf0fa3c879e35  cfa_r5_torimatome_zentai.pdf
7a7f731fd16d41da944ccadf115e5c47  cfa_r5_torimatome_zentai.txt
077eb53bf3eecb072fa82c6469156aa0  cfa_r6_moshikomi.xlsx
92eb1995515c54b9d1f2c1c3a9def3dc  cfa_r6_shiryo1-7.xlsx
5972d07b4d9e4bfd7b284281a2d848b8  cfa_r6_torimatome_zentai.pdf
253886c4ab770c60c5011715580d827d  cfa_r6_torimatome_zentai.txt
ba0f7cfd2d1a3d09fa556be62e5e16af  cfa_r7_shiryo1-6.xlsx
1a748a46cb0f5d048ab05efb7373a3c5  cfa_r7_teiin_moshikomi.xlsx
537bbd4c77d2e33ed0cab4d8ae7b7967  cfa_r7_torimatome_zentai.pdf
ca8892c63b6c29cb987f9f54e7c7e1c4  cfa_r7_torimatome_zentai.txt
ea9584de929d07dec6c3811a4bdd5946  cfa_site_policy.html
866a979eb0bdf8f286bb6d3e0bf6519a  mhlw_chosakuken.html
752dd85a4f3bc0dbade7c5cf0c48f4c0  mhlw_h27_moshikomi.xlsx
238eb5bbc079af2a02942f48e12b32b6  mhlw_h28_moshikomi.xlsx
6cf03ac49c4f5e359b958037a6f995c9  mhlw_h28_shiryo1-7.xlsx
1fb98dbe8dcef160dd2edb35d820dddc  mhlw_h28_torimatome_zentai.pdf
9690cd39767bd15703b93c9955f842ed  mhlw_h28_torimatome_zentai.txt
7468aa493687ab97b2e912c7c6cddd4f  mhlw_h29_moshikomi.xlsx
726e7e352538b74f6d213fb55674204a  mhlw_h29_shiryo1-6.xlsx
6ada934566118c77c55d4ba8bf2769c7  mhlw_h29_torimatome_zentai.pdf
fc9dcb9ebb801b07c4dab07283e53a6e  mhlw_h29_torimatome_zentai.txt
cac3793a318030b11b88fc7544126e03  mhlw_h30_moshikomi.xlsx
c5f1725c561818059e0bdb1ca2e2d2b9  mhlw_h30_shiryo1-7.xlsx
43a4a664ff502d3b7c5ec0ddc233c24c  mhlw_h30_torimatome_zentai.pdf
727a960aed9a871c27712283ecdc4f60  mhlw_h30_torimatome_zentai.txt
a57386277a103ed0d001b28ee783bfb6  mhlw_h31_moshikomi.xlsx
d97f9986070bd42705505185fb7bad73  mhlw_h31_shiryo1-7.xlsx
8d2025bc27ce41a9825f97017dbd3bf9  mhlw_h31_torimatome_zentai.pdf
88225bb0dde4a7891e60d830ffaeed70  mhlw_h31_torimatome_zentai.txt
a8246c54658d6ad5c2eaa765bae1662a  mhlw_r2_moshikomi.xlsx
8d0e8ba7b5f967c7c9276c805f07716c  mhlw_r2_shiryo1-7.xlsx
0b015b2a051501fa7ef52a2cd316c50d  mhlw_r2_torimatome_zentai.pdf
0d23f8da473e47a19ac1fde9075fdb35  mhlw_r2_torimatome_zentai.txt
9656b52b5ae4267ac22c1d1b24a64495  mhlw_r3_moshikomi.xlsx
739a4e7370a2f4074d9d19d6d385c205  mhlw_r3_shiryo_teisei.pdf
484fa45db0ffd35b98bd0881717be9fc  mhlw_r3_shiryo_teisei.txt
19492dbdf31128b1beae9f7c75f9c05f  mhlw_r3_shiryo1-7.xlsx
0cac7daf8da6e09dff3e152416b685e4  mhlw_r3_torimatome_zentai.pdf
63949fc4b09b2ee568535c77440f3a86  mhlw_r3_torimatome_zentai.txt
d93a56c8f20a0a3ffdae7f3cd2f48a9e  mhlw_r4_moshikomi.xlsx
71bc497b1dfbb328b74807676dc05acf  mhlw_r4_shiryo1-7.xlsx
f12a657ac2cb75b522287919bc7f2fb3  mhlw_r4_torimatome_zentai.pdf
25855de539baa4111ba678d60ee9ccad  mhlw_r4_torimatome_zentai.txt
```

## 3. ファイル構造

### 申込者の状況 Excel(市区町村別・毎年 1 シート系)= 市区町村別待機児童の実体
- **全年(H27〜R7)で沖縄 41 市町村を全行収録**(グループ化 grep で 41 行ヒット確認)。全国は約 1,741 市区町村行。
- 年により列構成・ヘッダー行が異なる(0 起点行番号・「待機児童」を含む最初の列):
  | 年 | シート | ヘッダー行 | 待機児童列(合計ブロック) |
  |---|---|---|---|
  | R7 | 「申込者の状況」(「定員の状況」と 2 シート) | 7 | 15(P列相当) |
  | R6 | 同上 2 シート | 7 | 15 |
  | R5 | 単独シート | 5 | 15 |
  | R4/R3/R2 | 単独シート | 6 | 15 |
  | H31/H30 | 単独シート | 6 | 14 |
  | H29 | 単独シート | 6 | 17(列構成が他年と異なる) |
  | H28/H27 | 単独シート | 5 | 13(旧定義・列少) |
- R7 の列構成(合計ブロック): 申込者数/保育所を利用している者/幼保連携型認定こども園.../幼稚園型認定こども園等.../地域型保育事業.../特例保育等.../企業主導型保育事業.../地方単独事業.../育児休業中の者/特定の保育園等のみ希望している者/求職活動を休止している者/**待機児童**。以降 0歳児・1,2歳児・3歳以上児の年齢別ブロックが続く(BM 列まで)。
- 先頭列に「都道府県+市区町村」連結キー(例「沖縄県那覇市」)あり(R6/R7)。
- 注記「＊市区町村からの報告に基づき単純に積み上げた数値である。」(R7)。秘匿記号なし・欠測は 0 または空欄(渡名喜村 申込者 0 など実ゼロ)。

### 資料1〜6/7 Excel(集計表)
- R7 シート: 資料1-1/1-2(定員・利用児童 100 人以上増加自治体)、資料2-1/2-2(都道府県別増減)、**資料3=都道府県・指定都市・中核市別 待機児童数 集約表**(A1:L90。左=47 都道府県〔指定都市・中核市除く県分〕、右=指定都市・中核市 129 市、末尾に都道府県計/指定都市計/中核市計/合計)、資料4(全国待機児童マップ=図)、資料5(待機児童数 30 人以上で待機児童率の高い市区町村)、資料6-1/6-2(待機児童の増減市区町村)。
- **注意: 資料3 の「沖縄県」行は中核市(那覇市)を除いた県分**。沖縄県全体=県分+那覇市。
- R6 の資料3 はシート範囲が 1751 行まであるが 90 行目以降は空(書式残骸)。構成は R7 と同じ。
- H29 の資料2-1 のみ市区町村別 1747 行(定員数の増減)。年により資料番号の中身が入れ替わるため、年ごとのシート名照合が必須。

### 全体版 PDF
- R7(818 行テキスト化): p.6 に全国推移(2013〜2025)、p.14 に H28.4〜R7.4 の申込者数・除外4類型内訳・待機児童数の全国表、p.13 に除外4類型の説明、p.15 以降に都道府県別表(沖縄県行あり)、待機児童率表など。
- R3 は公表後訂正あり(`mhlw_r3_shiryo_teisei.pdf`、令和3年10月11日付「資料の修正について」)。**R3 の数値利用時は正誤表を必ず照合すること**。

## 4. 経年カバレッジ

- 公表系列(4月1日時点)は **H20(2008)〜R7(2025)** まで年度インデックスにリンクあり。所管変更の境界: **〜R4=厚労省(WARP 退避のみ・原本 404)/R5〜=こども家庭庁(直取得可)**。
- 本取得で確保した年: **H28〜R7 の 10 年分(PDF+資料 Excel+申込者 Excel)+H27 申込者 Excel** → 市区町村別待機児童は H27〜R7 の 11 年分が手元にある。
- 全国計の長期系列は R7 PDF p.6 の表で 2013(H25)〜2025(R7) を一括参照可(H25=22,741 → H29=26,081(ピーク) → R7=2,254)。
- 未取得年(URL のみ・WARP シェル、pid=12862028 共通 prefix `https://warp.da.ndl.go.jp/info:ndljp/pid/12862028/www.mhlw.go.jp/`):
  - H27: `stf/houdou/0000098531.html`
  - H26: `stf/houdou/0000057750.html`
  - H25: `stf/houdou/0000022684.html`
  - H24: `stf/houdou/2r9852000002khid.html`
  - H23: `stf/houdou/2r9852000001q77g.html`
  - H22: `stf/houdou/2r9852000000nvsj.html`
  - H21: `houdou/2009/09/h0907-2.html`
  - H20: `houdou/2008/08/h0828-1.html`
- 別系列: 各年 **10月1日時点** の待機児童数公表も存在(インデックス下段、H21〜R2)。未取得。

## 5. 定義変更・断層(一次資料の逐語)

### 断層1: H26↔H27(集計対象の拡大=子ども・子育て支援新制度)
- 出典: `mhlw_h28_torimatome_zentai.pdf`(平成28年公表・冒頭)
> 「昨年度の調査から、従来の保育所に加え、平成 27 年４月に施行した子ども・子育て支援新制度において新たに位置づけられた幼保連携型認定こども園等の特定教育・保育施設と特定地域型保育事業＊（うち２号・３号認定）の数値を含みます。」
- → 定員・利用児童・待機児童の集計対象が「保育所」単独から「保育所等」に拡大。H26 以前と H27 以降は接続しない。

### 断層2: H28↔H29(調査要領改正=新定義。育休中の扱い等)
- 出典1: `mhlw_h29_torimatome_zentai.pdf` 脚注＊3
> 「待機児童数の把握については、平成 29 年 4 月 1 日の保育所等利用待機児童数調査より調査要領を改正」
- 出典2: `cfa_r7_torimatome_zentai.pdf` p.13「（参考）保育所等利用待機児童数調査における除外４類型について」
> 「○ 待機児童とは、保育園等の利用申込者数から、保育園等を実際に利用している者の数及び「除外４類型」（※）を除いた数としている。」
> 「○ この除外４類型については、平成29年３月に、有識者会議の検討を踏まえ、市町村ごとの運用上のばらつきを絞り込む方向に統一・是正し、待機児童の定義が広くなる見直しを行った。」
> 【育児休業中の者】「○ 育児休業中の保護者について、入園できたときに復職することを、入園保留通知発出後や４月１日時点などにおいて継続的に確認し、復職に関する確認ができる場合には、待機児童数に含める。 ただし、それが確認できない場合には、待機児童数に含めない。」
- 除外4類型=特定の保育所等のみ希望/求職活動を休止/育児休業中(復職確認できない場合)/地方単独保育施策利用。
- → H29 で「定義が広くなる」方向の改正(ピーク 26,081 人はこの年)。H28 以前と H29 以降の比較には注記必須。

### 参考(取得範囲外)
- H13(2001)の旧定義→新定義の変更は本取得ファイルの範囲外(逐語未確認)。本 dataset の遡及は H25 or H27 以降を推奨。

## 6. 利用規約の判定

- こども家庭庁(cfa.go.jp): コピーライトポリシーに「掲載・発信している情報（…）は、権利表記の記載がない限り『公共データ利用規約（第1.0版）』（PDL1.0）が適用」と明記 → **PDL1.0**。出典記載で複製・編集利用可。
- 厚労省(mhlw.go.jp): 「特記されていない限り厚生労働省に帰属し、権利表記の記載がない限り『公共データ利用規約（第1.0版）』（PDL1.0）に準拠した利用条件」と明記 → **PDL1.0**。
- WARP 経由取得分もコンテンツ著作権は原機関(厚労省)に帰属。出典表記は「厚生労働省(国立国会図書館 WARP 保存)」形が安全。
- 既存 dataset と同水準(政府標準利用規約系→PDL1.0 移行済)。**サイト収載可**。

## 7. スポット値(独立読み取り・後段照合の錨)

すべて **令和7年4月1日時点**、取得ファイルから直接読み取り:
- **全国計 待機児童数: 2,254 人**(資料3「合計」行=39,975 か所/定員 3,029,282/利用 2,678,417/待機 2,254。申込者の状況シート「計」行の待機児童も 2,254 で一致)
- **沖縄県計 待機児童数: 171 人**(資料3: 県分 154+那覇市〔中核市〕17=171。申込者の状況の沖縄 41 市町村合算も 171 で一致。R7 PDF 都道府県別表も沖縄県 171・待機児童率 0.29%・前年 356・増減▲185)
- **那覇市: 17 人**(申込者の状況・資料3 とも 17。申込者数 10,395)
- **北谷町: 42 人**(資料5 で全国 1 位掲出: 申込者 1,007・対前年+4・待機児童率 4.17%)
- 沖縄県 申込者数計: 59,277 人(41 市町村合算。R7 PDF 都道府県別表 59,277 人と一致)
- 沖縄県内訳(待機児童のいる市町村・R7): 北谷町42/宜野湾市19/那覇市17/南城市16/北中城村16/豊見城市15/沖縄市14/読谷村6/中城村6/西原町6/名護市4/伊平屋村4/糸満市3/与那原町3(計171)
- 参考(機械抽出・再照合用): 那覇市待機児童の経年 H27=539/H28=559/H29=200/H30=138/H31=250/R2=153/R3=37/R4=23/R5=48/R6=18/R7=17(H29 PDF 本文「那覇市（359人減）」と H28→H29 の差 559-200=359 が一致)

## 7b. 追加取得(2026-07-23、変換セッション)

- **H27 全体版 PDF**: `mhlw_h27_torimatome_zentai.pdf`(+pdftotext `.txt`)。沖縄県計 H27=2,591 の外部錨(県別表に「沖縄県 2,591」)として追加取得。
  - 公表ページ(WARP): https://warp.da.ndl.go.jp/info:ndljp/pid/12862028/www.mhlw.go.jp/stf/houdou/0000098531.html(実体 timestamp=20230423040213)
  - PDF 原 URL: `http://www.mhlw.go.jp/file/04-Houdouhappyou-11907000-Koyoukintoujidoukateikyoku-Hoikuka/0000098603.pdf`
  - md5: `655ab5743072f2d78c2038db214ee77c`(pdf)/`85e446b615ab7dd367e1cb5879fd6ae7`(txt)
- 変換時に確定した各年 PDF 錨(申込者 Excel 41市町村合算との突合結果)は `../notes.md` の検証の記録を参照。

## 8. 未解決事項(親の decide 待ち)

1. **dataset 分割**: (a) 沖縄41市町村別スナップショット(R7)+(b) 県計・全国の経年(H27 or H29〜R7)の 2 系列構成が既存レジストリ流儀に合うか。断層 2 箇所(H27/H29)の trend.note 運用(PR #22 で新設した機構)をどちらに載せるか。
2. **経年の起点**: 新定義で揃う H29〜R7 に絞るか、断層注記付きで H27(または全国のみ H25)まで遡るか。
3. R3 数値を使う場合は正誤表(`mhlw_r3_shiryo_teisei.pdf`)との突合を transform 段で必須化。
4. H20〜H26 の未取得年(WARP)と 10/1 時点系列の取得要否。
5. 資料3 の「県分(中核市除く)」と「県全体」の使い分け(サイト表記は県全体=171 を推奨、内訳注記)。
6. 大容量 Excel/PDF の gitignore 運用は既存 dataset に準拠(md5 は本ファイルに固定済)。

## 9. 訂正註(2026-07-23 独立再照合ゲート第6回・取得時の記録は §3 のまま保持)

- §3 の列位置表「待機児童列(合計ブロック)」は H27〜H31 の5年分が実測と 1 ずれている。独立パーサによる実測(0起点): **H27・H28=14 / H29=18 / H30・H31=15**(表の 13/17/14 は記載ズレ。R2〜R7=15 は一致)。ヘッダー行番号は全年一致。H30・H31 は R2〜R4 とシート構造が同一であることからも表側のズレと判断。実データ抽出はヘッダ文言による動的特定のため影響なし(外部錨と全一致)。
- §3 の R7 年齢別ブロックは「0歳児・**1歳児・2歳児**・3歳以上児」の4ブロック(「1,2歳児」統合ブロックは存在しない)。最終列は BM ではなく **BL**(col 63)。R6 も同構成。
- H29 の除外4類型は「新要領」(col 10-13)と「旧要領」(col 14-17)の2ブロック構成で、各市区町村はどちらか一方に記入(他方は「-」)。恒等式は両ブロックを中間列に含めて全行成立(新要領のみでは 113 行不成立)。
