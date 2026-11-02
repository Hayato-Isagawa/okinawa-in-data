/**
 * 沖縄こども調査(小中学生調査)困窮世帯の割合(経年)の変換スクリプト。
 *
 * 入力: raw/gaiyou-r6-kodomo-excerpt.txt(県の規約により配布していない。取得方法は raw/README.md)
 *   (沖縄県「令和6年度 沖縄こども調査 報告書 概要版」PDF を `pdftotext -layout` した生テキスト)
 * 出力: data.csv
 *
 * 抽出規則:
 * - アンカー行「参考 【保護者（全体）】等価可処分所得による分類」の直後から
 *   軸行(0% 20% ...)までを対象範囲とする。概要版には「20XX沖縄（n=...）」形式の
 *   行が多数(学年別・世帯類型別など)あるため、範囲限定が必須。
 * - 各行 `20XX沖縄（n=NNNN）  XX.X%  XX.X%` から 調査年 / n / 困窮層 / 非困窮層 を抽出。
 * - 出力は調査年の昇順。値は一次資料の表記のまま(文字列保持)。
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/kodomo-chosa-konkyu-keinen"
);

const lines = fs
  .readFileSync(
    path.join(datasetDir, "raw/gaiyou-r6-kodomo-excerpt.txt"),
    "utf-8"
  )
  .split("\n");

const anchorIdx = lines.findIndex(
  (l) =>
    l.includes("参考") &&
    l.includes("【保護者（全体）】等価可処分所得による分類")
);
if (anchorIdx === -1) {
  throw new Error(
    "アンカー行(参考【保護者(全体)】等価可処分所得による分類)が見つかりません"
  );
}

const rows: Array<[string, string, string, string]> = [];
for (let i = anchorIdx + 1; i < lines.length; i++) {
  const line = lines[i];
  if (/0%\s+20%/.test(line)) break; // 図の軸行 = 範囲の終わり
  const m = line.match(
    /^\s*(\d{4})沖縄（n=(\d+)）\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*$/
  );
  if (m) {
    rows.push([m[1], m[3], m[4], m[2]]); // 調査年, 困窮層, 非困窮層, n
  }
}

if (rows.length !== 4) {
  throw new Error(
    `経年データが ${rows.length} 行(期待 4 行: 2015/2018/2021/2024)`
  );
}
rows.sort((a, b) => a[0].localeCompare(b[0]));

const header = ["調査年", "困窮層", "非困窮層", "回答世帯数"];
fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...rows]));
console.log(`✓ data.csv (${rows.length} rows)`);
