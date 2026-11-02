/**
 * 学校基本調査 — 高等学校等進学率・大学等進学率の推移(沖縄県・全国、令和3〜7年3月卒)。
 *
 * 入力(各年の「状況別卒業者数」表、男女計 "(3-1)" シート):
 *   中学校(高等学校等進学率): r3〜r5=表257 / r6〜r7=表259
 *   高等学校(大学等進学率):   r3〜r5=表281 / r6〜r7=表283
 * 出力: data.csv(5行 × 沖縄県・全国の2指標)
 *
 * 抽出規則(既存の単年版 shingaku-ritsu-todofuken と同一ロジック):
 * - 率列は「最深(最下段)ヘッダ」が指標名に一致する列を動的同定。ヘッダ末尾の
 *   「（％）」表記は年により有無が揺れるため除去して一致判定。ちょうど1列に限る
 *   (「通信制課程(本科)への進学者を除く進学率」の変種列は別名のため衝突しない)
 * - 年ラベル(令和N年3月)で当年行に限定(「計」は前年併記行があるため)
 * - セル値は丸め前の生値を、公表 Excel の表示形式(小数第1位)に四捨五入
 * - 収録範囲を令和3〜7年3月卒に限定した理由: 平成28〜令和2年の同表は年ラベル書式・
 *   大学等進学率のヘッダ構造が年ごとに異なり、逐語照合を要するため本版では対象外
 *   (raw を再取得して個別対応する将来拡張。notes 参照)
 * - 整合検証: 令和7年3月卒の値を、検証済みの単年データセット
 *   (shingaku-ritsu-todofuken)の沖縄・全国の値と一致 assert(系列の接続確認)
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/shingaku-ritsu-keinen"
);

interface YearSpec {
  label: string; // CSV の行ラベル(和暦・卒業時点)
  yearLabel: string; // シート内の年ラベル
  chugaku: string;
  koko: string;
}
const YEARS: YearSpec[] = [
  {
    label: "令和3年3月",
    yearLabel: "令和3年3月",
    chugaku: "r3_chugaku_hyo257_jokyobetsu.xlsx",
    koko: "r3_koko_hyo281_jokyobetsu.xlsx",
  },
  {
    label: "令和4年3月",
    yearLabel: "令和4年3月",
    chugaku: "r4_chugaku_hyo257_jokyobetsu.xlsx",
    koko: "r4_koko_hyo281_jokyobetsu.xlsx",
  },
  {
    label: "令和5年3月",
    yearLabel: "令和5年3月",
    chugaku: "r5_chugaku_hyo257_jokyobetsu.xlsx",
    koko: "r5_koko_hyo281_jokyobetsu.xlsx",
  },
  {
    label: "令和6年3月",
    yearLabel: "令和6年3月",
    chugaku: "r6_chugaku_hyo259_jokyobetsu.xlsx",
    koko: "r6_koko_hyo283_jokyobetsu.xlsx",
  },
  {
    label: "令和7年3月",
    yearLabel: "令和7年3月",
    chugaku: "r7_chugaku_hyo259_jokyobetsu.xlsx",
    koko: "r7_koko_hyo283_jokyobetsu.xlsx",
  },
];

const norm = (c: unknown) => String(c ?? "").replace(/\s/g, "");
const stripPct = (s: string) => s.replace(/（％）$/, "");

function totalsSheet(file: string): unknown[][] {
  const wb = XLSX.read(fs.readFileSync(path.join(datasetDir, "raw", file)));
  const name = wb.SheetNames.find((n: string) => n.endsWith("(3-1)"));
  if (!name)
    throw new Error(
      `${file}: "(3-1)" シートがありません(${wb.SheetNames.join(", ")})`
    );
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true });
}

/** 指標名の最深ヘッダ列を同定し、沖縄県・計の率(小数第1位)を返す */
function extract(
  file: string,
  metric: string,
  yearLabel: string
): { okinawa: string; national: string } {
  const rows = totalsSheet(file);
  const lastHeader = new Map<number, string>();
  for (const row of rows.slice(0, 7)) {
    for (let c = 0; c < row.length; c++) {
      if (typeof row[c] !== "string") continue;
      const s = norm(row[c]);
      if (s) lastHeader.set(c, s);
    }
  }
  const matches = [...lastHeader.entries()].filter(
    ([, s]) => stripPct(s) === metric
  );
  if (matches.length !== 1) {
    throw new Error(
      `${file}: 最深ヘッダ "${metric}" の列が ${matches.length} 個`
    );
  }
  const rateCol = matches[0][0];

  let yearCol = -1;
  let nameCol = -1;
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const s = norm(row[c]);
      if (s === yearLabel && yearCol === -1) yearCol = c;
      if (s === "北海道" && nameCol === -1) nameCol = c;
    }
  }
  if (yearCol === -1)
    throw new Error(`${file}: 年ラベル "${yearLabel}" が見つかりません`);
  if (nameCol === -1)
    throw new Error(`${file}: 名称列(北海道)が見つかりません`);

  const pick = (target: string): string => {
    const found = rows.filter(
      (row) => norm(row[yearCol]) === yearLabel && norm(row[nameCol]) === target
    );
    if (found.length !== 1)
      throw new Error(`${file}: "${target}" 行が ${found.length} 個`);
    const v = found[0][rateCol];
    if (typeof v !== "number" || v < 0 || v > 100) {
      throw new Error(`${file}: ${target} の率 ${String(v)} が不正`);
    }
    return (Math.round(v * 10) / 10).toFixed(1);
  };
  return { okinawa: pick("沖縄県"), national: pick("計") };
}

const out = YEARS.map((y) => {
  const hs = extract(y.chugaku, "高等学校等進学率", y.yearLabel);
  const dg = extract(y.koko, "大学等進学率", y.yearLabel);
  return [y.label, hs.okinawa, hs.national, dg.okinawa, dg.national];
});

// 系列の接続確認: 令和7年3月卒の値を検証済み単年データセットと突き合わせる
const single = fs
  .readFileSync(
    path.resolve(
      process.cwd(),
      "data/datasets/shingaku-ritsu-todofuken/data.csv"
    ),
    "utf-8"
  )
  .trim()
  .split("\n")
  .map((l) => l.split(","));
const okiSingle = single.find((r) => r[0] === "沖縄県")!;
const keiSingle = single.find((r) => r[0] === "計")!;
const r7 = out[out.length - 1];
const checks: [string, string, string][] = [
  ["沖縄 高校等", r7[1], okiSingle[1]],
  ["全国 高校等", r7[2], keiSingle[1]],
  ["沖縄 大学等", r7[3], okiSingle[2]],
  ["全国 大学等", r7[4], keiSingle[2]],
];
for (const [name, keinen, singleVal] of checks) {
  if (keinen !== singleVal) {
    throw new Error(
      `系列接続の不一致 ${name}: 経年 ${keinen} ≠ 単年 ${singleVal}`
    );
  }
}

fs.writeFileSync(
  path.join(datasetDir, "data.csv"),
  toCsv([
    [
      "卒業年",
      "高校等進学率_沖縄",
      "高校等進学率_全国",
      "大学等進学率_沖縄",
      "大学等進学率_全国",
    ],
    ...out,
  ])
);
console.log(`書き出し: ${out.length} 行(令和3〜7年3月卒)`);
console.log(
  `R7 接続確認 OK: 沖縄 高${r7[1]}/大${r7[3]}、全国 高${r7[2]}/大${r7[4]}`
);
