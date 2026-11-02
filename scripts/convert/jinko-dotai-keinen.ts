/**
 * 合計特殊出生率と離婚率の推移(沖縄県 vs 全国、2005〜2024年)の変換。
 *
 * 入力: raw/mhlw_toukeihyo_2005.xls 〜 2023.xlsx + raw/mhlw_r06_toukeihyo.xlsx(2024)
 *       各年の「人口動態総覧(率), 都道府県別」表(シート名・列位置は年により異なる)
 * 出力: data.csv(20年 × 沖縄/全国 × 合計特殊出生率・離婚率 + 備考)
 *
 * 検証:
 * - 合計特殊出生率の全 40 値(20年 × 2地域)を e-Stat 表4-5(再集計反映済み)と全数突合
 * - 2024 年の 4 値が単年データセット jinko-dotai-r6-todofuken の同年値と一致(系列接続)
 * - 各年の表が期待年であることをパーサが assert(2010・2011 に前年の値が入った
 *   「(注釈変更案)」シートが同梱されているため)
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv, toCsv } from "../lib/csv";
import { readSoranRitsu } from "../lib/jinko-dotai-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/jinko-dotai-keinen"
);
// raw は姉妹データセット jinko-dotai-r6-todofuken と共有(raw/README.md 参照)
const rawDir = path.resolve(
  process.cwd(),
  "data/datasets/jinko-dotai-r6-todofuken/raw"
);

const START = 2005;
const END = 2024;

/** 人口動態統計の年次表記(2019 年は令和元年) */
function wareki(year: number): string {
  if (year <= 2018) return `平成${year - 1988}年`;
  if (year === 2019) return "令和元年";
  return `令和${year - 2018}年`;
}

/**
 * 都道府県の合計特殊出生率の算出に用いた分母(e-Stat 表4-5「データセットの概要」および
 * 各年統計表の注記より)。離婚率など人口千対の率は全年とも日本人人口で一貫しているため、
 * 備考は合計特殊出生率についてのみ記す。
 */
function tfrNote(year: number): string {
  const censusYear = year % 5 === 0;
  if (censusYear && year <= 2010)
    return "5歳階級別の日本人女性人口(国勢調査年)";
  if (censusYear) return "各歳別の日本人女性人口(国勢調査年)";
  if (year <= 2014) return "5歳階級別の女性の総人口";
  return "5歳階級別の日本人女性人口";
}

// e-Stat 表4-5 の全国・沖縄県(raw/estat_4-5_tfr_crosscheck.md の転記)
const ESTAT_TFR: Record<number, { 全国: string; 沖縄県: string }> = {
  2024: { 全国: "1.15", 沖縄県: "1.54" },
  2023: { 全国: "1.20", 沖縄県: "1.60" },
  2022: { 全国: "1.26", 沖縄県: "1.70" },
  2021: { 全国: "1.30", 沖縄県: "1.80" },
  2020: { 全国: "1.33", 沖縄県: "1.83" },
  2019: { 全国: "1.36", 沖縄県: "1.82" },
  2018: { 全国: "1.42", 沖縄県: "1.89" },
  2017: { 全国: "1.43", 沖縄県: "1.94" },
  2016: { 全国: "1.44", 沖縄県: "1.95" },
  2015: { 全国: "1.45", 沖縄県: "1.96" },
  2014: { 全国: "1.42", 沖縄県: "1.86" },
  2013: { 全国: "1.43", 沖縄県: "1.94" },
  2012: { 全国: "1.41", 沖縄県: "1.90" },
  2011: { 全国: "1.39", 沖縄県: "1.86" },
  2010: { 全国: "1.39", 沖縄県: "1.87" },
  2009: { 全国: "1.37", 沖縄県: "1.79" },
  2008: { 全国: "1.37", 沖縄県: "1.78" },
  2007: { 全国: "1.34", 沖縄県: "1.75" },
  2006: { 全国: "1.32", 沖縄県: "1.74" },
  2005: { 全国: "1.26", 沖縄県: "1.72" },
};

const rows: string[][] = [];
let crosschecked = 0;

for (let year = START; year <= END; year++) {
  const file =
    year === END
      ? "mhlw_r06_toukeihyo.xlsx"
      : (fs
          .readdirSync(rawDir)
          .find((n) => n.startsWith(`mhlw_toukeihyo_${year}.`)) ??
        (() => {
          throw new Error(`原本が見つからない: ${year}`);
        })());
  const table = readSoranRitsu(path.join(rawDir, file), year);
  const oki = table.values.get("沖縄県")!;
  const zen = table.values.get("全国")!;

  // e-Stat 表4-5 との突合(合計特殊出生率)
  const want = ESTAT_TFR[year];
  for (const [area, got] of [
    ["全国", zen.合計特殊出生率],
    ["沖縄県", oki.合計特殊出生率],
  ] as const) {
    const expected = want[area as "全国" | "沖縄県"];
    if (got !== expected) {
      throw new Error(
        `e-Stat 4-5 突合不一致: ${year} ${area} 統計表=${got} ≠ e-Stat=${expected}`
      );
    }
    crosschecked++;
  }

  rows.push([
    wareki(year),
    oki.合計特殊出生率,
    zen.合計特殊出生率,
    oki.離婚率,
    zen.離婚率,
    tfrNote(year),
  ]);
}

// 単年データセットとの系列接続(2024 年)
const singleYear = parseCsv(
  fs.readFileSync(
    path.resolve(
      process.cwd(),
      "data/datasets/jinko-dotai-r6-todofuken/data.csv"
    ),
    "utf-8"
  )
);
const syHeader = singleYear[0];
const syRow = (area: string) => singleYear.find((r) => r[0] === area)!;
const syGet = (area: string, col: string) => syRow(area)[syHeader.indexOf(col)];
const last = rows[rows.length - 1];
const connections: Array<[string, string, string]> = [
  ["沖縄県 合計特殊出生率", last[1], syGet("沖縄県", "合計特殊出生率")],
  ["全国 合計特殊出生率", last[2], syGet("全国", "合計特殊出生率")],
  ["沖縄県 離婚率", last[3], syGet("沖縄県", "離婚率")],
  ["全国 離婚率", last[4], syGet("全国", "離婚率")],
];
for (const [label, keinen, single] of connections) {
  if (keinen !== single) {
    throw new Error(
      `単年データセットとの接続不一致: ${label} 経年=${keinen} ≠ 単年=${single}`
    );
  }
}

const header = [
  "年",
  "合計特殊出生率_沖縄",
  "合計特殊出生率_全国",
  "離婚率_沖縄",
  "離婚率_全国",
  "備考",
];
fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...rows]));
console.log(`書き出し: ${rows.length} 行(${wareki(START)}〜${wareki(END)})`);
console.log(
  `e-Stat 4-5 突合: ${crosschecked} 値一致(合計特殊出生率・20年 × 2地域)`
);
console.log(`単年データセットとの接続: ${connections.length}/4 一致`);
console.log(
  `沖縄 合計特殊出生率 ${rows[0][1]}(${rows[0][0]})→ ${last[1]}(${last[0]})/ 全国 ${rows[0][2]} → ${last[2]}`
);
console.log(
  `沖縄 離婚率 ${rows[0][3]} → ${last[3]}/ 全国 ${rows[0][4]} → ${last[4]}`
);
