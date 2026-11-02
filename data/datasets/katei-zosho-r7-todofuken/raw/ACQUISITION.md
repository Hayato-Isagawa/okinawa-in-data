# ACQUISITION — 令和7年度 全国学力・学習状況調査「児童生徒質問調査」都道府県別回答結果集計

## 取得情報
- 取得日: 2026-07-31
- 取得者: gather subagent(Claude Code)
- 取得方法: `curl -sL`(リクエスト間 1 秒以上 sleep、nier.go.jp / mext.go.jp への負荷配慮)
- 検証: 各 xlsx は先頭 2 バイト `PK` かつ 10KB 超を確認。94/94 成功・リトライ発生なし・失敗 0

## 出典
- 調査名: 令和7年度 全国学力・学習状況調査(小6・中3、2025年4月実施)
- 実施主体: 文部科学省(調査実施)・国立教育政策研究所(集計・結果公表)
- 公表: 都道府県別調査結果資料は「結果公表③」として 2025-09-30 公表(文科省ページ 1419141_00007.htm で確認)
- 一覧ページ: https://www.nier.go.jp/25chousakekkahoukoku/factsheet/prefecture_city.html
- 各県ページ: `https://www.nier.go.jp/25chousakekkahoukoku/factsheet/NN_<ローマ字県名>/index.html`。URL は一覧ページ→各県ページから実抽出(推定組み立てなし)
- ローマ字表記の注意: 28_hyougo・39_kouchi・44_ohita は一般的なヘボン式(hyogo/kochi/oita)と異なる。北海道は 01_hokkaido のほか 012_hokkaido(政令市除き版)が別に存在し、`NN2_`(政令市除き)・`5NN_`(政令市)は本データセットの対象外

## 取得ファイル一覧

### 47都道府県 × 2(児童 p / 生徒 m)= 94 ファイル
| ファイル名 | 対象 | 種別 | URL |
|---|---|---|---|
| 01m_25a.xlsx | 北海道 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/01_hokkaido/01m_25a.xlsx |
| 01p_25a.xlsx | 北海道 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/01_hokkaido/01p_25a.xlsx |
| 02m_25a.xlsx | 青森県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/02_aomori/02m_25a.xlsx |
| 02p_25a.xlsx | 青森県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/02_aomori/02p_25a.xlsx |
| 03m_25a.xlsx | 岩手県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/03_iwate/03m_25a.xlsx |
| 03p_25a.xlsx | 岩手県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/03_iwate/03p_25a.xlsx |
| 04m_25a.xlsx | 宮城県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/04_miyagi/04m_25a.xlsx |
| 04p_25a.xlsx | 宮城県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/04_miyagi/04p_25a.xlsx |
| 05m_25a.xlsx | 秋田県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/05_akita/05m_25a.xlsx |
| 05p_25a.xlsx | 秋田県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/05_akita/05p_25a.xlsx |
| 06m_25a.xlsx | 山形県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/06_yamagata/06m_25a.xlsx |
| 06p_25a.xlsx | 山形県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/06_yamagata/06p_25a.xlsx |
| 07m_25a.xlsx | 福島県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/07_fukushima/07m_25a.xlsx |
| 07p_25a.xlsx | 福島県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/07_fukushima/07p_25a.xlsx |
| 08m_25a.xlsx | 茨城県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/08_ibaraki/08m_25a.xlsx |
| 08p_25a.xlsx | 茨城県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/08_ibaraki/08p_25a.xlsx |
| 09m_25a.xlsx | 栃木県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/09_tochigi/09m_25a.xlsx |
| 09p_25a.xlsx | 栃木県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/09_tochigi/09p_25a.xlsx |
| 10m_25a.xlsx | 群馬県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/10_gunma/10m_25a.xlsx |
| 10p_25a.xlsx | 群馬県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/10_gunma/10p_25a.xlsx |
| 11m_25a.xlsx | 埼玉県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/11_saitama/11m_25a.xlsx |
| 11p_25a.xlsx | 埼玉県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/11_saitama/11p_25a.xlsx |
| 12m_25a.xlsx | 千葉県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/12_chiba/12m_25a.xlsx |
| 12p_25a.xlsx | 千葉県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/12_chiba/12p_25a.xlsx |
| 13m_25a.xlsx | 東京都 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/13_tokyo/13m_25a.xlsx |
| 13p_25a.xlsx | 東京都 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/13_tokyo/13p_25a.xlsx |
| 14m_25a.xlsx | 神奈川県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/14_kanagawa/14m_25a.xlsx |
| 14p_25a.xlsx | 神奈川県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/14_kanagawa/14p_25a.xlsx |
| 15m_25a.xlsx | 新潟県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/15_niigata/15m_25a.xlsx |
| 15p_25a.xlsx | 新潟県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/15_niigata/15p_25a.xlsx |
| 16m_25a.xlsx | 富山県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/16_toyama/16m_25a.xlsx |
| 16p_25a.xlsx | 富山県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/16_toyama/16p_25a.xlsx |
| 17m_25a.xlsx | 石川県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/17_ishikawa/17m_25a.xlsx |
| 17p_25a.xlsx | 石川県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/17_ishikawa/17p_25a.xlsx |
| 18m_25a.xlsx | 福井県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/18_fukui/18m_25a.xlsx |
| 18p_25a.xlsx | 福井県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/18_fukui/18p_25a.xlsx |
| 19m_25a.xlsx | 山梨県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/19_yamanashi/19m_25a.xlsx |
| 19p_25a.xlsx | 山梨県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/19_yamanashi/19p_25a.xlsx |
| 20m_25a.xlsx | 長野県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/20_nagano/20m_25a.xlsx |
| 20p_25a.xlsx | 長野県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/20_nagano/20p_25a.xlsx |
| 21m_25a.xlsx | 岐阜県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/21_gifu/21m_25a.xlsx |
| 21p_25a.xlsx | 岐阜県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/21_gifu/21p_25a.xlsx |
| 22m_25a.xlsx | 静岡県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/22_shizuoka/22m_25a.xlsx |
| 22p_25a.xlsx | 静岡県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/22_shizuoka/22p_25a.xlsx |
| 23m_25a.xlsx | 愛知県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/23_aichi/23m_25a.xlsx |
| 23p_25a.xlsx | 愛知県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/23_aichi/23p_25a.xlsx |
| 24m_25a.xlsx | 三重県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/24_mie/24m_25a.xlsx |
| 24p_25a.xlsx | 三重県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/24_mie/24p_25a.xlsx |
| 25m_25a.xlsx | 滋賀県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/25_shiga/25m_25a.xlsx |
| 25p_25a.xlsx | 滋賀県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/25_shiga/25p_25a.xlsx |
| 26m_25a.xlsx | 京都府 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/26_kyoto/26m_25a.xlsx |
| 26p_25a.xlsx | 京都府 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/26_kyoto/26p_25a.xlsx |
| 27m_25a.xlsx | 大阪府 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/27_osaka/27m_25a.xlsx |
| 27p_25a.xlsx | 大阪府 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/27_osaka/27p_25a.xlsx |
| 28m_25a.xlsx | 兵庫県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/28_hyougo/28m_25a.xlsx |
| 28p_25a.xlsx | 兵庫県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/28_hyougo/28p_25a.xlsx |
| 29m_25a.xlsx | 奈良県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/29_nara/29m_25a.xlsx |
| 29p_25a.xlsx | 奈良県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/29_nara/29p_25a.xlsx |
| 30m_25a.xlsx | 和歌山県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/30_wakayama/30m_25a.xlsx |
| 30p_25a.xlsx | 和歌山県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/30_wakayama/30p_25a.xlsx |
| 31m_25a.xlsx | 鳥取県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/31_tottori/31m_25a.xlsx |
| 31p_25a.xlsx | 鳥取県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/31_tottori/31p_25a.xlsx |
| 32m_25a.xlsx | 島根県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/32_shimane/32m_25a.xlsx |
| 32p_25a.xlsx | 島根県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/32_shimane/32p_25a.xlsx |
| 33m_25a.xlsx | 岡山県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/33_okayama/33m_25a.xlsx |
| 33p_25a.xlsx | 岡山県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/33_okayama/33p_25a.xlsx |
| 34m_25a.xlsx | 広島県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/34_hiroshima/34m_25a.xlsx |
| 34p_25a.xlsx | 広島県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/34_hiroshima/34p_25a.xlsx |
| 35m_25a.xlsx | 山口県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/35_yamaguchi/35m_25a.xlsx |
| 35p_25a.xlsx | 山口県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/35_yamaguchi/35p_25a.xlsx |
| 36m_25a.xlsx | 徳島県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/36_tokushima/36m_25a.xlsx |
| 36p_25a.xlsx | 徳島県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/36_tokushima/36p_25a.xlsx |
| 37m_25a.xlsx | 香川県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/37_kagawa/37m_25a.xlsx |
| 37p_25a.xlsx | 香川県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/37_kagawa/37p_25a.xlsx |
| 38m_25a.xlsx | 愛媛県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/38_ehime/38m_25a.xlsx |
| 38p_25a.xlsx | 愛媛県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/38_ehime/38p_25a.xlsx |
| 39m_25a.xlsx | 高知県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/39_kouchi/39m_25a.xlsx |
| 39p_25a.xlsx | 高知県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/39_kouchi/39p_25a.xlsx |
| 40m_25a.xlsx | 福岡県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/40_fukuoka/40m_25a.xlsx |
| 40p_25a.xlsx | 福岡県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/40_fukuoka/40p_25a.xlsx |
| 41m_25a.xlsx | 佐賀県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/41_saga/41m_25a.xlsx |
| 41p_25a.xlsx | 佐賀県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/41_saga/41p_25a.xlsx |
| 42m_25a.xlsx | 長崎県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/42_nagasaki/42m_25a.xlsx |
| 42p_25a.xlsx | 長崎県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/42_nagasaki/42p_25a.xlsx |
| 43m_25a.xlsx | 熊本県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/43_kumamoto/43m_25a.xlsx |
| 43p_25a.xlsx | 熊本県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/43_kumamoto/43p_25a.xlsx |
| 44m_25a.xlsx | 大分県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/44_ohita/44m_25a.xlsx |
| 44p_25a.xlsx | 大分県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/44_ohita/44p_25a.xlsx |
| 45m_25a.xlsx | 宮崎県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/45_miyazaki/45m_25a.xlsx |
| 45p_25a.xlsx | 宮崎県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/45_miyazaki/45p_25a.xlsx |
| 46m_25a.xlsx | 鹿児島県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/46_kagoshima/46m_25a.xlsx |
| 46p_25a.xlsx | 鹿児島県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/46_kagoshima/46p_25a.xlsx |
| 47m_25a.xlsx | 沖縄県 | 生徒質問(中3) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/47_okinawa/47m_25a.xlsx |
| 47p_25a.xlsx | 沖縄県 | 児童質問(小6) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/47_okinawa/47p_25a.xlsx |
### 全国集計・補足資料(6 ファイル)
| ファイル名 | 内容 | URL |
|---|---|---|
| 25p_402.xlsx | 回答結果集計[児童質問調査]全国−児童(公立)【表】 | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/data/25p_402.xlsx |
| 25m_402.xlsx | 回答結果集計[生徒質問調査]全国−生徒(公立)【表】 | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/data/25m_402.xlsx |
| 25qn.pdf | 令和7年度 全国学力・学習状況調査 報告書【質問調査】(全国結果・経年変化・クロス分析) | https://www.nier.go.jp/25chousakekkahoukoku/report/data/25qn.pdf |
| 25kekkakouhyou_3_point.pdf | 令和7年度 結果公表③について(都道府県別公表のポイント資料) | https://www.nier.go.jp/25chousakekkahoukoku/factsheet/25kekkakouhyou_3_point.pdf |
| mext_r7_jisshi_yoryo.pdf | 令和7年度 全国学力・学習状況調査に関する実施要領(文科省) | https://www.mext.go.jp/content/20241225-mxt_chousa02-000036913.pdf |
| nier_site_riyoukiyaku.html | NIER「著作権、リンクについて」ページ(利用規約の証跡) | https://www.nier.go.jp/11_copyright/index.html |

## Excel の表構造(実開封で確認)
全 94 ファイル同一構造(機械照合済み)。シート 1 枚のみ(児童=「児童質問 回答結果集計表」/ 生徒=「生徒質問 回答結果集計表」)。

- r1-r2: タイトル(令和7年度全国学力・学習状況調査 / 回答結果集計[児童質問] 等)
- r3(B列): 「〈県名〉－児童(公立)」等。**94 ファイル全てで JIS 県コード・ファイル名と一致することを機械照合済み(不一致 0)**
- r5-r8: 注記と回答者数(質問群別の児童生徒数・学校数。①質問番号(1)〜(71)、②国語、③算数/数学、④理科で母数が異なる)
- r10-r11: 列ヘッダ(B=質問番号、C=質問事項、G〜=選択肢1〜、AA=その他、AB=無回答)
- r12 以降: 質問ごとに 4 行 1 ブロック
  - 1 段目: 県の回答人数
  - 2 段目: 県の割合(%)
  - 3 段目: 空行
  - 4 段目: 全国(公立)の割合(%)(47p の 4 段目値が 25p_402 の全国 2 段目値と一致することを実測確認)
- 質問ブロック数: **小学校 86** / **中学校 76**(47 県すべて同数)
  - 小学校: (1)〜(71)のうち(29)は(29-1)〜(29-4)、(30)は(30-1)〜(30-7)に分割 → 番号付き 80 ブロック+教科関連 6((国1)(国2)(算1)(算2)(理1)(理2))
  - 中学校: (1)〜(70)((29)は(29-1)〜(29-4)に分割・**(30)は県別ファイルに存在しない**)→ 番号付き 72 ブロック+教科関連 4((国1)(国2)(数1)(数2))

## 全国集計の所在
- 独立 Excel あり: `25p_402.xlsx` / `25m_402.xlsx` = 全国−児童/生徒(公立)。県ファイルの比較基準(4 段目「全国(公立)」)と同じ母集団
- 全国版はブロック構成が県版と異なる点に注意:
  - 小学校: 県版と同一の 86 ブロック
  - 中学校: **96 ブロック**。県版にない (30-1)〜(30-7)・(71-1)〜(71-4)・(72-1)〜(72-5)・(理1-1)〜(理1-4) の 20 ブロックを含む(中3 理科 CBT 関連等は全国集計のみ公表)
- 全国版は 2 段構成(1 段目=人数・2 段目=割合)で県版の 4 段構成と異なる
- 国・公・私立ベースの全国集計は別ファイル `25p_401.xlsx` / `25m_401.xlsx`(未取得。報告書 25qn.pdf p.134〜 の全国表も国・公・私立ベースで、県ファイルの 4 段目(公立)とは母集団が異なる)
- 全国 Excel の掲載ページ: https://www.nier.go.jp/25chousakekkahoukoku/factsheet/primary.html / middle.html

## 利用規約(nier_site_riyoukiyaku.html)
- NIER「著作権、リンクについて」: 「当ホームページのコンテンツを利用する場合は、『文部科学省ウェブサイト利用規約』に従って、御利用ください」
- 文科省ウェブサイト利用規約は出典記載を条件に複製・編集・加工等を認める(CC BY 4.0 互換)。既収録 gakuryoku-chosa-r7-todofuken でも確認済み
- 収録時の出典表記例: 「文部科学省・国立教育政策研究所『令和7年度全国学力・学習状況調査』を加工して作成」

## 取得失敗・欠落
- なし(94/94+補足 6/6 成功。リトライ発生なし)

## 収録時の注意
- 質問番号と質問文の対応は**年度固有**。他年度と接続する場合は質問文ベースで照合すること((1)朝食・(2)就寝時刻・(3)起床時刻…の並びは R7 固有)
- 各質問に「その他」(AA 列)・「無回答」(AB 列)列があり、選択肢割合の合計は 100% にならないことがある(四捨五入含む)
- 選択肢数は質問により異なる(最大 8 以上。G 列から可変長)
- 中3 の県別ファイルには質問(30)・(71)・(72)・理科関連質問が存在しない(全国版 25m_402 のみ)。県別収録の設計は県版 76 ブロックを基準にすること
- 質問群(①〜④)で回答者母数が異なる(r8 の児童生徒数参照)。割合の分母に注意
- 都道府県値は政令市を含む全県値(`NN_` 版)。政令市除き(`NN2_`)・政令市単独(`5NN_`)は未取得

## 収録先と raw の配置(2026-07-31 追記)

- 取得時の仮ディレクトリ `gakuryoku-shitsumon-r7-todofuken` は、収録設計の確定(user 決定 2026-07-31: 2 データセット構成)に伴い `katei-zosho-r7-todofuken` に改名した。
- 本 raw/ は 2 データセットで共有する:
  - `katei-zosho-r7-todofuken` — 質問(22)蔵書量(小6・中3×6区分)
  - `seikatsu-shukan-r7-todofuken` — 質問(1)(2)(3)朝食・就寝・起床の「している」割合(小6・中3)。同ディレクトリ raw/README.md から本ファイルを参照
- PDF 3 本の監査痕跡として pdftotext -layout の抽出テキストを同梱した(25qn.txt / 25kekkakouhyou_3_point.txt / mext_r7_jisshi_yoryo.txt)。
- リポジトリには沖縄(47p/47m)・全国(25p_402/25m_402)の Excel・抽出テキスト・本記録・checksums.md5 のみを追跡し、他 92 県分 Excel と PDF 原本は .gitignore で履歴に載せない(URL 規則+md5 で再取得・同一性検証が可能)。
