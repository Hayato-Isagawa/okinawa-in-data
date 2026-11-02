/**
 * 令和2年国勢調査 就業状態等基本集計 — 沖縄県内市町村の労働力状態の変換。
 *
 * 入力: raw/c01_02_roudoryoku_shikuchoson_statInfId000032201175.xlsx
 *   (第1-2表 男女、年齢(5歳階級)、労働力状態別人口及び労働力率(15歳以上)
 *    — 全国、都道府県、市区町村。シート c01_02)
 * 出力: data.csv(41市町村、コード昇順)
 *
 * 抽出規則:
 * - 行の絞り込み: 男女「0_総数」× 年齢「00_総数」× 地域「47xxx」(47000=県は集計検証用)
 * - 列ヘッダ行(カテゴリコード付き)が期待と完全一致することを assert
 * - 「-」(該当数字がないもの)は 0 として収録
 * - 恒等式を全行 assert:
 *   労働力人口 = 就業者 + 完全失業者
 *   就業者 = 主に仕事+家事のほか仕事+通学のかたわら仕事+休業者
 *   非労働力人口 = 家事 + 通学 + その他
 *   総数 = 労働力人口 + 非労働力人口 + 労働力状態不詳
 *   労働力率(公表・col18) = 労働力人口 ÷ (総数 − 労働力状態不詳) × 100(許容差1e-3)
 * - 完全失業率(%) = 完全失業者 ÷ 労働力人口 × 100(サイト導出値、小数第2位四捨五入)
 * - 労働力状態不詳率(%) = 労働力状態不詳 ÷ 総数 × 100(データ品質の透明化)
 * - 整合検証: 41市町村の合計が沖縄県(47000)の値と一致することを主要列で assert
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";
import { loadOkinawaMunicipalities } from "../lib/estat-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/roudoryoku-okinawa-shichoson"
);

const HEADER_ROW = 7;
const AXIS_ROW = 9;
const DATA_COL_START = 5;
const RATE_COL = 18; // 労働力率(公表値)
const EXPECTED_HEADER = [
  "0_総数",
  "1_労働力人口",
  "11_就業者",
  "111_（就業者）主に仕事",
  "112_（就業者）家事のほか仕事",
  "113_（就業者）通学のかたわら仕事",
  "114_（就業者）休業者",
  "12_完全失業者",
  "2_非労働力人口",
  "21_家事",
  "22_通学",
  "23_その他",
  "3_労働力状態「不詳」",
];

const wb = XLSX.read(
  fs.readFileSync(
    path.join(
      datasetDir,
      "raw",
      "c01_02_roudoryoku_shikuchoson_statInfId000032201175.xlsx"
    )
  )
);
const ws = wb.Sheets["c01_02"];
if (!ws)
  throw new Error(`シート c01_02 がありません(${wb.SheetNames.join(", ")})`);
const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  raw: true,
});

EXPECTED_HEADER.forEach((label, i) => {
  const got = String(rows[HEADER_ROW][DATA_COL_START + i] ?? "").trim();
  if (got !== label) throw new Error(`列ヘッダ不一致: "${got}" ≠ "${label}"`);
});

function asCount(v: unknown, label: string): number {
  if (v === "-") return 0;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new Error(`${label}: 整数でない値 ${String(v)}`);
  }
  return v;
}

const IDX = Object.fromEntries(EXPECTED_HEADER.map((h, i) => [h, i]));
const AREA = /^(47\d{3})_(.+)$/;
const byCode = new Map<string, { v: number[]; rate: number }>();
let pref: { v: number[]; rate: number } | null = null;
for (let i = AXIS_ROW + 1; i < rows.length; i++) {
  const row = rows[i];
  if (String(row[3] ?? "").trim() !== "0_総数") continue;
  if (String(row[4] ?? "").trim() !== "00_総数") continue;
  const m = AREA.exec(String(row[2] ?? "").trim());
  if (!m) continue;
  const v = EXPECTED_HEADER.map((label, j) =>
    asCount(row[DATA_COL_START + j], `${m[0]} ${label}`)
  );
  const rate = row[RATE_COL];
  if (typeof rate !== "number" || rate < 0 || rate > 100) {
    throw new Error(`${m[0]}: 労働力率が範囲外 ${String(rate)}`);
  }
  const rec = { v, rate };
  if (m[1] === "47000") {
    if (pref) throw new Error("沖縄県(47000)の行が重複");
    pref = rec;
    continue;
  }
  if (byCode.has(m[1])) throw new Error(`コード ${m[1]} が重複`);
  byCode.set(m[1], rec);
}
if (!pref) throw new Error("沖縄県(47000)の行がありません");

function assertIdentity(name: string, v: number[], rate: number) {
  const shugyo =
    v[IDX["111_（就業者）主に仕事"]] +
    v[IDX["112_（就業者）家事のほか仕事"]] +
    v[IDX["113_（就業者）通学のかたわら仕事"]] +
    v[IDX["114_（就業者）休業者"]];
  if (shugyo !== v[IDX["11_就業者"]]) {
    throw new Error(
      `${name}: 就業者内訳の和 ${shugyo} ≠ 就業者 ${v[IDX["11_就業者"]]}`
    );
  }
  const rodoryoku = v[IDX["11_就業者"]] + v[IDX["12_完全失業者"]];
  if (rodoryoku !== v[IDX["1_労働力人口"]]) {
    throw new Error(
      `${name}: 就業者+完全失業者 ${rodoryoku} ≠ 労働力人口 ${v[IDX["1_労働力人口"]]}`
    );
  }
  const hirodo = v[IDX["21_家事"]] + v[IDX["22_通学"]] + v[IDX["23_その他"]];
  if (hirodo !== v[IDX["2_非労働力人口"]]) {
    throw new Error(
      `${name}: 非労働力内訳の和 ${hirodo} ≠ 非労働力人口 ${v[IDX["2_非労働力人口"]]}`
    );
  }
  const total =
    v[IDX["1_労働力人口"]] +
    v[IDX["2_非労働力人口"]] +
    v[IDX["3_労働力状態「不詳」"]];
  if (total !== v[IDX["0_総数"]]) {
    throw new Error(`${name}: 区分の和 ${total} ≠ 総数 ${v[IDX["0_総数"]]}`);
  }
  const denom = v[IDX["0_総数"]] - v[IDX["3_労働力状態「不詳」"]];
  const calcRate = (v[IDX["1_労働力人口"]] / denom) * 100;
  if (Math.abs(calcRate - rate) > 1e-3) {
    throw new Error(
      `${name}: 労働力率再現 ${calcRate.toFixed(4)} ≠ 公表 ${rate}`
    );
  }
}
assertIdentity("沖縄県", pref.v, pref.rate);

const munis = loadOkinawaMunicipalities();
if (byCode.size !== munis.length) {
  throw new Error(`市町村行 ${byCode.size} ≠ 境界データ ${munis.length}`);
}
for (const m of munis) {
  const rec = byCode.get(m.code5);
  if (!rec) throw new Error(`${m.name}(${m.code5})の行がありません`);
  assertIdentity(m.name, rec.v, rec.rate);
}
// 主要列の分割恒等式(41市町村の和 = 県)
for (const key of [
  "0_総数",
  "1_労働力人口",
  "11_就業者",
  "12_完全失業者",
  "2_非労働力人口",
  "3_労働力状態「不詳」",
]) {
  const sum = munis.reduce((s, m) => s + byCode.get(m.code5)!.v[IDX[key]], 0);
  if (sum !== pref.v[IDX[key]]) {
    throw new Error(`${key}: 41市町村の和 ${sum} ≠ 沖縄県 ${pref.v[IDX[key]]}`);
  }
}

const round2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
const header = [
  "市町村",
  "15歳以上人口",
  "労働力人口",
  "就業者",
  "完全失業者",
  "非労働力人口",
  "労働力状態不詳",
  "労働力率",
  "完全失業率",
  "労働力状態不詳率",
];
const out = munis.map((m) => {
  const { v } = byCode.get(m.code5)!;
  const total = v[IDX["0_総数"]];
  const rodoryoku = v[IDX["1_労働力人口"]];
  const shitsugyo = v[IDX["12_完全失業者"]];
  const fushou = v[IDX["3_労働力状態「不詳」"]];
  return [
    m.name,
    String(total),
    String(rodoryoku),
    String(v[IDX["11_就業者"]]),
    String(shitsugyo),
    String(v[IDX["2_非労働力人口"]]),
    String(fushou),
    round2((rodoryoku / (total - fushou)) * 100),
    round2((shitsugyo / rodoryoku) * 100),
    round2((fushou / total) * 100),
  ];
});

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`書き出し: ${out.length} 行`);
const naha = out.find((r) => r[0] === "那覇市")!;
console.log(
  `那覇市: 労働力率 ${naha[7]}% / 完全失業率 ${naha[8]}% / 不詳率 ${naha[9]}%`
);
