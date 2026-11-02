/**
 * 県民経済計算(内閣府)— 1人当たり県民所得(都道府県別・時系列)の変換。
 *
 * 入力: raw/soukatu7.xlsx(総括表7 1人当たり県民所得、シート「実数」、単位: 千円)
 * 出力: data.csv(47都道府県+全県計、48行 × 平成23〜令和4年度の12列)
 *
 * 抽出規則:
 * - 行の同定はコード列(01〜47)。地域ブロック・政令指定都市の行はコードが無い
 *   (または 47 超でない形式)ため自然に除外される
 * - 名称列がコード順に PREFECTURES と一致することを assert
 * - ヘッダ(行3=和暦年度、行4=西暦)が期待する12年度と一致することを assert
 * - 末尾列にコードが再掲されるため col0 と一致することを assert(行ずれ検出)
 * - 値は千円単位の整数のみ(丸めなし・原表のまま)。非整数は throw
 * - 全県計(コード無し・名称「全県計」)を最終行に収録(原表記のまま)
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";
import { readSheetRows } from "../lib/estat-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/kenmin-shotoku-todofuken"
);

const YEAR_LABELS = [
  "平成23年度",
  "平成24年度",
  "平成25年度",
  "平成26年度",
  "平成27年度",
  "平成28年度",
  "平成29年度",
  "平成30年度",
  "令和元年度",
  "令和2年度",
  "令和3年度",
  "令和4年度",
];
const YEAR_WESTERN = [
  2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022,
];
const DATA_COL_START = 3; // 列0=コード、列1=名称、列2=空

const rows = readSheetRows(
  path.join(datasetDir, "raw", "soukatu7.xlsx"),
  "実数"
);

// ヘッダ検証(行3=和暦、行4=西暦)
const header = rows[3];
const western = rows[4];
if (String(header[0]).trim() !== "都道府県") {
  throw new Error(`ヘッダ行が想定と異なります: ${String(header[0])}`);
}
YEAR_LABELS.forEach((label, i) => {
  const got = String(header[DATA_COL_START + i] ?? "").trim();
  if (got !== label) throw new Error(`年度ヘッダ不一致: ${got} ≠ ${label}`);
  const west = western[DATA_COL_START + i];
  if (west !== YEAR_WESTERN[i]) {
    throw new Error(`西暦ヘッダ不一致: ${String(west)} ≠ ${YEAR_WESTERN[i]}`);
  }
});

function asAmount(v: unknown, label: string): string {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(`${label}: 千円単位の正の整数でない値 ${String(v)}`);
  }
  return String(v);
}

// 都道府県行(コード01〜47)を収集
const byCode = new Map<string, unknown[]>();
let zenkenkei: unknown[] | null = null;
for (const row of rows) {
  const code = String(row[0] ?? "").trim();
  if (/^\d{2}$/.test(code)) {
    if (byCode.has(code)) throw new Error(`コード ${code} が重複`);
    byCode.set(code, row);
    continue;
  }
  if (String(row[1] ?? "").trim() === "全県計") {
    if (zenkenkei) throw new Error("全県計の行が重複");
    zenkenkei = row;
  }
}

const out: string[][] = [];
for (let i = 1; i <= 47; i++) {
  const code = String(i).padStart(2, "0");
  const row = byCode.get(code);
  if (!row) throw new Error(`コード ${code} の行がありません`);
  const name = String(row[1] ?? "").trim();
  if (name !== PREFECTURES[i - 1]) {
    throw new Error(`コード ${code} の名称 "${name}" ≠ ${PREFECTURES[i - 1]}`);
  }
  const tailCode = String(
    row[DATA_COL_START + YEAR_LABELS.length] ?? ""
  ).trim();
  if (tailCode !== code) {
    throw new Error(
      `${name}: 末尾コード再掲 ${tailCode} ≠ ${code}(行ずれの疑い)`
    );
  }
  out.push([
    name,
    ...YEAR_LABELS.map((label, j) =>
      asAmount(row[DATA_COL_START + j], `${name} ${label}`)
    ),
  ]);
}
if (!zenkenkei) throw new Error("全県計の行が見つかりません");
out.push([
  "全県計",
  ...YEAR_LABELS.map((label, j) =>
    asAmount(zenkenkei![DATA_COL_START + j], `全県計 ${label}`)
  ),
]);

const csv = toCsv([["都道府県", ...YEAR_LABELS], ...out]);
fs.writeFileSync(path.join(datasetDir, "data.csv"), csv);
console.log(`書き出し: ${out.length} 行(47都道府県+全県計)`);
const okinawa = out[46];
console.log(
  `沖縄県: ${YEAR_LABELS[0]}=${okinawa[1]} 〜 ${YEAR_LABELS[11]}=${okinawa[12]} 千円`
);
