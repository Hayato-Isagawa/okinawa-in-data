/**
 * 保育所等関連状況取りまとめ(令和7年4月1日) — 沖縄県内市町村の申込者・待機児童の変換。
 *
 * 入力: raw/cfa_r7_teiin_moshikomi.xlsx「申込者の状況」シート(全国約1,741市区町村)
 * 出力: data.csv(41市町村、コード昇順)
 *
 * 抽出規則:
 * - 合計(全年齢)ブロックの 申込者数〜待機児童 の12列を公表値のまま転記
 *   (年齢別ブロック 0歳児/1,2歳児/3歳以上児 は収録しない)
 * - 待機児童率(%) = 待機児童 ÷ 申込者数 × 100(サイト導出値、小数第2位四捨五入。
 *   定義は取りまとめ資料の「※待機児童率＝待機児童数／申込者数」。申込者数 0 の
 *   市町村は空欄)
 * 検証:
 * - lib/hoiku-taiki-excel が全市区町村行で恒等式 申込者数=Σ(利用・除外内訳)+待機児童 を assert
 * - 41市町村の合算を公表 PDF の都道府県別表(沖縄県: 申込者59,277・利用児童57,610
 *   〔=保育所+認定こども園2種+地域型の4列〕・待機児童171)と突合
 * - 資料5 掲出値(北谷町 申込者1,007・待機児童42・待機児童率4.17%)と突合
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { loadOkinawaMunicipalities } from "../lib/estat-excel";
import { loadMoushikomi } from "../lib/hoiku-taiki-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/hoiku-taiki-r7-okinawa-shichoson"
);

const EXPECTED_LABELS = [
  "申込者数",
  "保育所を利用している者",
  "幼保連携型認定こども園を利用している者",
  "幼稚園型認定こども園等を利用している者",
  "地域型保育事業を利用している者",
  "特例保育等を利用している者",
  "企業主導型保育事業を利用している者",
  "地方単独事業を利用している者",
  "育児休業中の者",
  "特定の保育園等のみ希望している者",
  "求職活動を休止している者",
  "待機児童",
];

const sheet = loadMoushikomi(
  path.join(datasetDir, "raw", "cfa_r7_teiin_moshikomi.xlsx")
);
if (!sheet.title.includes("令和7年4月1日")) {
  throw new Error(`タイトルが令和7年4月1日でない: ${sheet.title}`);
}
EXPECTED_LABELS.forEach((label, i) => {
  if (sheet.headerLabels[i] !== label) {
    throw new Error(`列ラベル不一致: "${sheet.headerLabels[i]}" ≠ "${label}"`);
  }
});
if (sheet.blanks.length > 0) {
  throw new Error(`沖縄県行・計行に空セル: ${sheet.blanks.join(", ")}`);
}

// 41市町村合算を公表 PDF の都道府県別表・資料5と突合
const IDX = Object.fromEntries(EXPECTED_LABELS.map((l, i) => [l, i]));
const sum = (col: number) =>
  sheet.okinawa.reduce((a, r) => a + r.block[col], 0);
const checks: Array<[string, number, number]> = [
  ["申込者数", sum(IDX["申込者数"]), 59277],
  [
    "利用児童数(保育所+認定こども園2種+地域型)",
    sum(IDX["保育所を利用している者"]) +
      sum(IDX["幼保連携型認定こども園を利用している者"]) +
      sum(IDX["幼稚園型認定こども園等を利用している者"]) +
      sum(IDX["地域型保育事業を利用している者"]),
    57610,
  ],
  ["待機児童", sum(IDX["待機児童"]), 171],
];
for (const [name, got, want] of checks) {
  if (got !== want)
    throw new Error(`沖縄41市町村の${name}合算 ${got} ≠ 公表PDF ${want}`);
}

const byName = new Map(sheet.okinawa.map((r) => [r.muni, r.block]));
if (byName.size !== 41) throw new Error("市町村名が重複しています");
const munis = loadOkinawaMunicipalities();
for (const m of munis) {
  if (!byName.has(m.name)) throw new Error(`${m.name} の行がありません`);
}

const rate = (taiki: number, moushi: number): string =>
  moushi === 0
    ? ""
    : (Math.round((taiki / moushi) * 100 * 100) / 100).toFixed(2);

const chatan = byName.get("北谷町")!;
const chatanRate = rate(chatan[IDX["待機児童"]], chatan[IDX["申込者数"]]);
if (
  chatan[IDX["申込者数"]] !== 1007 ||
  chatan[IDX["待機児童"]] !== 42 ||
  chatanRate !== "4.17"
) {
  throw new Error(
    `北谷町が資料5掲出値と不一致: 申込${chatan[IDX["申込者数"]]} 待機${chatan[IDX["待機児童"]]} 率${chatanRate}`
  );
}

const out = munis.map((m) => {
  const block = byName.get(m.name)!;
  return [
    m.name,
    ...block.map(String),
    rate(block[IDX["待機児童"]], block[IDX["申込者数"]]),
  ];
});

fs.writeFileSync(
  path.join(datasetDir, "data.csv"),
  toCsv([["市町村", ...EXPECTED_LABELS, "待機児童率"], ...out])
);
console.log(`書き出し: ${out.length} 行(恒等式検証 ${sheet.checkedRows} 行)`);
const naha = byName.get("那覇市")!;
console.log(
  `那覇市: 申込${naha[IDX["申込者数"]]} 待機${naha[IDX["待機児童"]]}`
);
console.log(
  `北谷町: 待機${chatan[IDX["待機児童"]]} 率${chatanRate}%(資料5=全国1位)`
);
