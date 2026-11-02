# 都道府県境界データ(prefectures.topojson)

- 取得元: [smartnews-smri/japan-topography](https://github.com/smartnews-smri/japan-topography)
  `data/municipality/topojson/s0001/prefectures.json`(簡素化 0.1% 版、47都道府県)
- 取得日: 2026-07-05
- 元データ: 「国土数値情報(行政区域データ)」(国土交通省) https://nlftp.mlit.go.jp/ksj/
- ライセンス: 国土数値情報ダウンロードサイトコンテンツ利用規約(政府標準利用規約準拠版)。
  CC BY 4.0 互換で、出典記載と編集・加工の明記が条件。
  スマートニュース メディア研究所は加工者クレジット不要と明言(同リポジトリ README)。
- 本サイトでの表記(地図キャプション・データの作り方ページに記載):
  「国土数値情報(行政区域データ)(国土交通省)を加工して作成
  (加工: スマートニュース メディア研究所・当サイト)」
- properties: `N03_001` = 都道府県名(これをキーにデータセットの「区分」列と結合)

# 沖縄県市町村境界データ(okinawa-municipalities.geojson)

- 生成方法: 同リポジトリの全国市区町村版
  `data/municipality/topojson/s0010/N03-21_210101.json`(簡素化 1%)から
  `scripts/geo/extract-okinawa-municipalities.ts` で沖縄県 41 市町村を抽出(2026-07-05)
- **s0001(0.1%)版は使わない**: 座間味村・粟国村・渡名喜村が簡素化で消失する
- 「所属未定地」は除外。properties: `name` = 市町村名、`code` = 団体コード
- 出典・ライセンスは上記(国土数値情報)と同一
- **大東2村(南大東村・北大東村)のみ高精細化済み**(2026-07-06):
  s0010 では主要2島が22〜27頂点で市町村ページの拡大表示に耐えないため、
  国土数値情報 N03-2021 沖縄県 GeoJSON(未簡素化)から
  `scripts/geo/refine-daito-geometry.ts` で取り直して差し替えた
  (Douglas-Peucker 0.0002度、bbox 0.002度未満の岩礁は表示上サブピクセルの
  ため除外、沖大東島は保持)。出典・年版・ライセンスは他の市町村と同一
