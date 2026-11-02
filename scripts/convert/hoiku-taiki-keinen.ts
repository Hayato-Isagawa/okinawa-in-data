/**
 * 保育所等関連状況取りまとめ — 待機児童数の推移 沖縄県・全国(平成27〜令和7年・各年4月1日時点)。
 *
 * 入力: raw/ の各年「（参考）申込者の状況」Excel 11ファイル
 *   (令和5年〜=こども家庭庁、〜令和4年=厚生労働省・国立国会図書館 WARP 保存)
 * 出力: data.csv(11行 × 待機児童数 沖縄県計/全国 + 備考)
 *
 * 抽出規則:
 * - 沖縄県計 = 県内41市町村行の合算(このシートは全市区町村を列挙するため合算=県全体。
 *   集約表の資料3は都道府県行が指定都市・中核市を除く県分のため使わない)
 * - 全国 = 「計」行
 * - 平成27・28年の行に備考「調査要領改正前の数値」(平成29年調査から待機児童の定義が
 *   広くなる見直し=断層)を付す
 * 検証(全年):
 * - lib/hoiku-taiki-excel が全市区町村行で恒等式 申込者数=Σ(内訳)+待機児童 を assert
 * - 全国値を令和7年公表 PDF p.6「待機児童数の推移」表と全11年突合
 * - 沖縄県計を各年公表 PDF の都道府県別表と全11年突合(平成27年は平成27年公表 PDF、
 *   令和2・5年は翌年 PDF の前年列)
 * - 那覇市を独立取得時の読み取り値と突合
 * - 令和7年は単年データセット(hoiku-taiki-r7-okinawa-shichoson)の data.csv と接続 assert
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv, toCsv } from "../lib/csv";
import { loadOkinawaMunicipalities } from "../lib/estat-excel";
import { loadMoushikomi } from "../lib/hoiku-taiki-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/hoiku-taiki-keinen"
);

// anchorOki/anchorNational は各年公表 PDF の逐語値(notes.md に出典行を記録)、
// anchorNaha は取得時の独立読み取り値
const KAISEI_NOTE =
  "調査要領改正前の数値(平成29年調査から待機児童の定義が広くなる見直し)";
const YEARS = [
  {
    label: "平成27年",
    file: "mhlw_h27_moshikomi.xlsx",
    title: "平成27年4月1日",
    oki: 2591,
    national: 23167,
    naha: 539,
    note: KAISEI_NOTE,
  },
  {
    label: "平成28年",
    file: "mhlw_h28_moshikomi.xlsx",
    title: "平成28年4月1日",
    oki: 2536,
    national: 23553,
    naha: 559,
    note: KAISEI_NOTE,
  },
  {
    label: "平成29年",
    file: "mhlw_h29_moshikomi.xlsx",
    title: "平成29年4月1日",
    oki: 2247,
    national: 26081,
    naha: 200,
    note: "",
  },
  {
    label: "平成30年",
    file: "mhlw_h30_moshikomi.xlsx",
    title: "平成30年4月1日",
    oki: 1870,
    national: 19895,
    naha: 138,
    note: "",
  },
  {
    label: "平成31年",
    file: "mhlw_h31_moshikomi.xlsx",
    title: "平成31年4月1日",
    oki: 1702,
    national: 16772,
    naha: 250,
    note: "",
  },
  {
    label: "令和2年",
    file: "mhlw_r2_moshikomi.xlsx",
    title: "令和2年4月1日",
    oki: 1365,
    national: 12439,
    naha: 153,
    note: "",
  },
  {
    label: "令和3年",
    file: "mhlw_r3_moshikomi.xlsx",
    title: "令和3年4月1日",
    oki: 564,
    national: 5634,
    naha: 37,
    note: "",
  },
  {
    label: "令和4年",
    file: "mhlw_r4_moshikomi.xlsx",
    title: "令和4年4月1日",
    oki: 439,
    national: 2944,
    naha: 23,
    note: "",
  },
  {
    label: "令和5年",
    file: "cfa_r5_moshikomi.xlsx",
    title: "令和5年4月1日",
    oki: 411,
    national: 2680,
    naha: 48,
    note: "",
  },
  {
    label: "令和6年",
    file: "cfa_r6_moshikomi.xlsx",
    title: "令和6年4月1日",
    oki: 356,
    national: 2567,
    naha: 18,
    note: "",
  },
  {
    label: "令和7年",
    file: "cfa_r7_teiin_moshikomi.xlsx",
    title: "令和7年4月1日",
    oki: 171,
    national: 2254,
    naha: 17,
    note: "",
  },
];

const muniNames = new Set(loadOkinawaMunicipalities().map((m) => m.name));

const out = YEARS.map((y) => {
  const sheet = loadMoushikomi(path.join(datasetDir, "raw", y.file));
  if (!sheet.title.includes(y.title)) {
    throw new Error(
      `${y.file}: タイトルに「${y.title}」が無い(${sheet.title})`
    );
  }
  const taikiIdx = sheet.headerLabels.length - 1;
  const okiSum = sheet.okinawa.reduce((a, r) => a + r.block[taikiIdx], 0);
  const national = sheet.national[taikiIdx];
  const naha = sheet.okinawa.find((r) => r.muni === "那覇市")?.block[taikiIdx];
  if (okiSum !== y.oki)
    throw new Error(`${y.file}: 沖縄県計 ${okiSum} ≠ PDF錨 ${y.oki}`);
  if (national !== y.national)
    throw new Error(`${y.file}: 全国 ${national} ≠ PDF推移表 ${y.national}`);
  if (naha !== y.naha)
    throw new Error(`${y.file}: 那覇市 ${naha} ≠ 独立読み取り ${y.naha}`);
  for (const r of sheet.okinawa) {
    if (!muniNames.has(r.muni))
      throw new Error(`${y.file}: 想定外の市町村名 ${r.muni}`);
  }
  return [y.label, String(okiSum), String(national), y.note];
});

// 経年⇔単年の接続: 令和7年の沖縄県計 = 単年データセットの41市町村合算
const tanenCsv = parseCsv(
  fs.readFileSync(
    path.resolve(
      process.cwd(),
      "data/datasets/hoiku-taiki-r7-okinawa-shichoson/data.csv"
    ),
    "utf-8"
  )
);
const taikiCol = tanenCsv[0].indexOf("待機児童");
if (taikiCol === -1) throw new Error("単年 data.csv に待機児童列が無い");
const tanenSum = tanenCsv.slice(1).reduce((a, r) => a + Number(r[taikiCol]), 0);
const r7 = out[out.length - 1];
if (tanenSum !== Number(r7[1])) {
  throw new Error(
    `接続 assert 失敗: 単年合算 ${tanenSum} ≠ 経年 令和7年 ${r7[1]}`
  );
}

fs.writeFileSync(
  path.join(datasetDir, "data.csv"),
  toCsv([["年", "待機児童数_沖縄", "待機児童数_全国", "備考"], ...out])
);
console.log(`書き出し: ${out.length} 行(平成27〜令和7年・各年4月1日時点)`);
for (const r of out) {
  console.log(`${r[0]}: 沖縄${r[1]} 全国${r[2]}${r[3] ? " ※" + r[3] : ""}`);
}
