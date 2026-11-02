/**
 * 令和7年度 全国学力・学習状況調査 都道府県別平均正答率の変換スクリプト。
 *
 * 入力: raw/25p_101.txt, raw/25m_101.txt
 *   (NIER「全国-都道府県(公立)」PDF を `pdftotext -layout` した生テキスト)
 * 出力: data.csv
 *
 * 抽出規則:
 * - 各行の ASCII 括弧 `( NN )` / `( NN.N )` が平均正答率(%)。
 *   小学校は 国語/算数/理科 の3個、中学校は 国語/数学 の2個
 *   (令和7年度の中学校理科は IRT スコア形式のため正答率が存在しない)。
 * - 資料には「都道府県(公立)」「指定都市を除く」「指定都市」の3セクションが
 *   あるが、対象は第1セクションのみ。各区分の**最初の出現だけ**を採用する。
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";

import { PREFECTURES } from "../lib/prefectures";

const ROW_ORDER = ["全国（国公私立）", "全国（公立）", ...PREFECTURES];

/**
 * 生テキストから 区分 → 平均正答率配列 を抽出(最初の出現のみ)。
 * 値は一次資料の表記を保持するため文字列のまま返す(「67.0」を 67 にしない)。
 */
function extractRates(
  rawPath: string,
  expectedCount: number
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const lines = fs.readFileSync(rawPath, "utf-8").split("\n");
  for (const line of lines) {
    const name = line.trim().split(/\s+/)[0];
    if (!name || !ROW_ORDER.includes(name) || result.has(name)) continue;
    const rates = [...line.matchAll(/\(\s*(\d+(?:\.\d+)?)\s*\)/g)].map(
      (m) => m[1]
    );
    if (rates.length < expectedCount) {
      throw new Error(
        `${path.basename(rawPath)} 「${name}」行の正答率が ${rates.length} 個(期待 ${expectedCount} 個以上): ${line.slice(0, 120)}`
      );
    }
    result.set(name, rates.slice(0, expectedCount));
  }
  for (const name of ROW_ORDER) {
    if (!result.has(name)) {
      throw new Error(`${path.basename(rawPath)} に「${name}」行がありません`);
    }
  }
  return result;
}

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/gakuryoku-chosa-r7-todofuken"
);

const elementary = extractRates(path.join(datasetDir, "raw/25p_101.txt"), 3);
const juniorHigh = extractRates(path.join(datasetDir, "raw/25m_101.txt"), 2);

const header = [
  "区分",
  "小学校国語",
  "小学校算数",
  "小学校理科",
  "中学校国語",
  "中学校数学",
];
const rows = ROW_ORDER.map((name) => {
  const p = elementary.get(name)!;
  const m = juniorHigh.get(name)!;
  return [name, ...p, ...m];
});

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...rows]));
console.log(`✓ data.csv (${rows.length} rows)`);
