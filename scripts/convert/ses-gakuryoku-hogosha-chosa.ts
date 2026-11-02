/**
 * 令和3年度 全国学力・学習状況調査 保護者調査の委託分析(お茶の水女子大学)—
 * 社会経済的背景(SES)四分位別の平均正答率(全国)の変換。
 *
 * 入力: raw/ocha_r3_hogosha_honpen1.txt(本編その1 PDF の pdftotext -layout。配布していない。取得方法は raw/README.md)
 *   - 図表2-1「社会経済的背景と学力(小6)」(報告書 p.26)
 *   - 図表2-3「社会経済的背景別学力(中3)」(報告書 p.28)
 * 出力: data.csv(SES 四分位4行 × 小6/中3の教科別・平均の6列)
 *
 * 抽出規則:
 * - 図表タイトル行(「社会経済的背景と学力（小６）」等)から次図表タイトルまでを
 *   ブロックとして切り出し、その中の「正答率_国語/正答率_算数/正答率_数学/平均正答率」
 *   +数値4個の行だけを対象にする(凡例行は数値が無いため自然に除外)
 * - 値は txt の文字列をそのまま収録(丸めなし。「60.0」の末尾ゼロも保持)
 * - 検証: 各行4値・0〜100の範囲・小数第1位表記、および恒等式
 *   平均正答率 = (国語+算数or数学)/2 を小数第1位への丸め(四捨五入)で全列 assert
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/ses-gakuryoku-hogosha-chosa"
);

const text = fs.readFileSync(
  path.join(datasetDir, "raw", "ocha_r3_hogosha_honpen1.txt"),
  "utf-8"
);
const lines = text.split("\n");

/** タイトル行 start(含む)〜 stop(含まず)の行ブロックを返す */
function block(startTitle: string, stopTitle: string): string[] {
  const start = lines.findIndex((l) => l.includes(startTitle));
  if (start < 0) throw new Error(`図表タイトルが見つかりません: ${startTitle}`);
  const stop = lines.findIndex((l, i) => i > start && l.includes(stopTitle));
  if (stop < 0) throw new Error(`終端タイトルが見つかりません: ${stopTitle}`);
  return lines.slice(start, stop);
}

const ROW =
  /^\s*(正答率_国語|正答率_算数|正答率_数学|平均正答率)\s+(\d{1,2}\.\d)\s+(\d{1,2}\.\d)\s+(\d{1,2}\.\d)\s+(\d{1,2}\.\d)\s*$/;

/** ブロックから 教科ラベル → 四分位4値(文字列) を抽出 */
function extract(
  blockLines: string[],
  expected: string[]
): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const line of blockLines) {
    const m = ROW.exec(line);
    if (!m) continue;
    if (found.has(m[1])) throw new Error(`行が重複: ${m[1]}`);
    found.set(m[1], [m[2], m[3], m[4], m[5]]);
  }
  for (const label of expected) {
    if (!found.has(label)) throw new Error(`行が見つかりません: ${label}`);
    for (const v of found.get(label)!) {
      const n = Number(v);
      if (!(n > 0 && n < 100)) throw new Error(`${label}: 範囲外の値 ${v}`);
    }
  }
  if (found.size !== expected.length) {
    throw new Error(`想定外の行が混入: ${[...found.keys()].join(", ")}`);
  }
  return found;
}

/** 恒等式: 平均正答率 = (a+b)/2 を小数第1位に四捨五入 */
function assertAverage(a: string[], b: string[], avg: string[], label: string) {
  for (let i = 0; i < 4; i++) {
    const mean = (Number(a[i]) + Number(b[i])) / 2;
    const rounded = (Math.round(mean * 10 + 1e-9) / 10).toFixed(1);
    if (rounded !== avg[i]) {
      throw new Error(
        `${label} 第${i + 1}四分位: 平均 ${avg[i]} ≠ round((${a[i]}+${b[i]})/2)=${rounded}`
      );
    }
  }
}

const sho = extract(
  block("社会経済的背景と学力（小６）", "授業外平日学習時間と学力（小６）"),
  ["正答率_国語", "正答率_算数", "平均正答率"]
);
const chu = extract(
  block("社会経済的背景別学力（中３）", "授業外学習時間別にみた学力"),
  ["正答率_国語", "正答率_数学", "平均正答率"]
);
assertAverage(
  sho.get("正答率_国語")!,
  sho.get("正答率_算数")!,
  sho.get("平均正答率")!,
  "小6"
);
assertAverage(
  chu.get("正答率_国語")!,
  chu.get("正答率_数学")!,
  chu.get("平均正答率")!,
  "中3"
);

// SES 四分位の名称は報告書 序章 p.2 の定義(第1〜第4四分位)に従う
const QUARTILES = [
  "Lowest SES",
  "Lower Middle SES",
  "Upper Middle SES",
  "Highest SES",
];

const header = [
  "SES区分",
  "小6 国語",
  "小6 算数",
  "小6 平均",
  "中3 国語",
  "中3 数学",
  "中3 平均",
];
const out = QUARTILES.map((q, i) => [
  q,
  sho.get("正答率_国語")![i],
  sho.get("正答率_算数")![i],
  sho.get("平均正答率")![i],
  chu.get("正答率_国語")![i],
  chu.get("正答率_数学")![i],
  chu.get("平均正答率")![i],
]);

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`書き出し: ${out.length} 行(SES 四分位)`);
console.log(
  `小6平均: ${out[0][3]}(Lowest)〜${out[3][3]}(Highest) / 中3平均: ${out[0][6]}〜${out[3][6]}`
);
