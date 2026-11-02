/**
 * 学校基本調査「就職先別県外就職者数」 — 高校卒業者の県外就職の推移
 * (沖縄県・全国、平成22〜令和7年3月卒の16年分)。
 *
 * 入力: raw/ の各年 Excel 16ファイル(表237→238→256→284→293→295。
 *       2014年以前=.xls 旧レイアウト4シート、2021年以降=.xlsx 新レイアウト2シート。
 *       2015〜2020 は .xlsx だが旧レイアウト)
 * 出力: data.csv(16行 × 県外就職者数・割合 × 沖縄県/全国 + 備考)
 *
 * 抽出規則:
 * - 計(男女計)の沖縄県・全国行のみ。値は公表 Excel の表示文字列
 *   (県外就職者数=桁区切りカンマ除去の整数、割合=表示どおり小数第1位)
 * - 令和2年3月卒から「就職者」の統計上の区分が変更(旧:「就職者」「一時的な仕事に
 *   就いた者」→ 新:「就職者」「有期雇用労働者(1ヵ月以上1年未満)」「臨時労働者」。
 *   令和7年度公表資料 表3 で実測確認)→ user 決定(2026-07-21)により全年収録した上で
 *   旧区分の平成22〜31年3月卒の行に備考列で明示する
 * 検証:
 * - lib/kengai-shushoku-excel のヘッダ assert と恒等式(計=Σ就職先)を全年で通す
 * - 各年ファイルの前年併記行が前年ファイルの当年値と一致することを assert
 *   (年次間の接続確認。定義変更・レイアウト変更の境界を含む15組)
 * - 令和7年3月卒の値を単年データセット kengai-shushoku-r7-todofuken の data.csv と
 *   一致 assert(系列の接続確認)
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { loadKengai, type KengaiSheet } from "../lib/kengai-shushoku-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/kengai-shushoku-keinen"
);

const GAP_NOTE =
  "就職者の旧区分による数値(令和2年3月卒から区分変更のため以降と単純比較不可)";
const YEARS: Array<{ label: string; file: string; kyu: boolean }> = [
  {
    label: "平成22年3月",
    file: "mext_kengai_2010_hyo237_000008349916.xls",
    kyu: true,
  },
  {
    label: "平成23年3月",
    file: "mext_kengai_2011_hyo237_000012683792.xls",
    kyu: true,
  },
  {
    label: "平成24年3月",
    file: "mext_kengai_2012_hyo238_000018428692.xls",
    kyu: true,
  },
  {
    label: "平成25年3月",
    file: "mext_kengai_2013_hyo238_000023610097.xls",
    kyu: true,
  },
  {
    label: "平成26年3月",
    file: "mext_kengai_2014_hyo238_000027597187.xls",
    kyu: true,
  },
  {
    label: "平成27年3月",
    file: "mext_kengai_2015_hyo256_000031358055.xlsx",
    kyu: true,
  },
  {
    label: "平成28年3月",
    file: "mext_kengai_2016_hyo284_000031504813.xlsx",
    kyu: true,
  },
  {
    label: "平成29年3月",
    file: "mext_kengai_2017_hyo293_000031656923.xlsx",
    kyu: true,
  },
  {
    label: "平成30年3月",
    file: "mext_kengai_2018_hyo293_000031776608.xlsx",
    kyu: true,
  },
  {
    label: "平成31年3月",
    file: "mext_kengai_2019_hyo293_000031893968.xlsx",
    kyu: true,
  },
  {
    label: "令和2年3月",
    file: "mext_kengai_2020_hyo293_000032040676.xlsx",
    kyu: false,
  },
  {
    label: "令和3年3月",
    file: "mext_kengai_2021_hyo293_000032156145.xlsx",
    kyu: false,
  },
  {
    label: "令和4年3月",
    file: "mext_kengai_2022_hyo293_000032264978.xlsx",
    kyu: false,
  },
  {
    label: "令和5年3月",
    file: "mext_kengai_2023_hyo293_000040128464.xlsx",
    kyu: false,
  },
  {
    label: "令和6年3月",
    file: "mext_kengai_2024_hyo295_000040230729.xlsx",
    kyu: false,
  },
  {
    label: "令和7年3月",
    file: "mext_kengai_2025_hyo295_000040393948.xlsx",
    kyu: false,
  },
];

let prev: KengaiSheet | null = null;
const out = YEARS.map((y) => {
  const sheet = loadKengai(path.join(datasetDir, "raw", y.file));
  if (sheet.yearLabel !== y.label) {
    throw new Error(`${y.file}: 当年 ${sheet.yearLabel} ≠ 期待 ${y.label}`);
  }
  // 年次間の接続確認: 当ファイルの前年併記行 = 前年ファイルの当年値
  if (prev) {
    if (sheet.prevYearLabel !== prev.yearLabel) {
      throw new Error(
        `${y.label}: 前年併記行の年 ${sheet.prevYearLabel} ≠ ${prev.yearLabel}`
      );
    }
    if (
      sheet.prevNational.kengai !== prev.national.kengai ||
      sheet.prevNational.ritsu !== prev.national.ritsu
    ) {
      throw new Error(
        `${y.label}: 前年併記行 ${sheet.prevNational.kengai}/${sheet.prevNational.ritsu} ≠ 前年ファイル ${prev.national.kengai}/${prev.national.ritsu}`
      );
    }
  }
  prev = sheet;
  const oki = sheet.prefectures.get("沖縄県")!;
  return [
    y.label,
    oki.kengai,
    sheet.national.kengai,
    oki.ritsu,
    sheet.national.ritsu,
    y.kyu ? GAP_NOTE : "",
  ];
});

// 系列の接続確認: 令和7年3月卒の値を単年データセットと突き合わせる
const single = fs
  .readFileSync(
    path.resolve(
      process.cwd(),
      "data/datasets/kengai-shushoku-r7-todofuken/data.csv"
    ),
    "utf-8"
  )
  .trim()
  .split("\n")
  .map((l) => l.split(","));
const okiSingle = single.find((r) => r[0] === "沖縄県")!;
const natSingle = single.find((r) => r[0] === "全国")!;
const r7 = out[out.length - 1];
const checks: [string, string, string][] = [
  ["沖縄 県外就職者数", r7[1], okiSingle[1]],
  ["全国 県外就職者数", r7[2], natSingle[1]],
  ["沖縄 県外就職割合", r7[3], okiSingle[2]],
  ["全国 県外就職割合", r7[4], natSingle[2]],
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
      "県外就職者数_沖縄",
      "県外就職者数_全国",
      "県外就職割合_沖縄",
      "県外就職割合_全国",
      "備考",
    ],
    ...out,
  ])
);
console.log(
  `書き出し: ${out.length} 行(平成22〜令和7年3月卒、旧区分注記 ${out.filter((r) => r[5] !== "").length} 行)`
);
console.log(
  `平成22: 沖縄${out[0][1]}人/${out[0][3]}% 全国${out[0][4]}% → 令和7: 沖縄${r7[1]}人/${r7[3]}% 全国${r7[4]}%`
);
