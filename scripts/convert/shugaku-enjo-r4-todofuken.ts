/**
 * 令和4年度 就学援助 都道府県別実施状況(小中学校計)の変換スクリプト。
 *
 * 入力: raw/shugaku-r5jisshi.txt
 *   (文部科学省「令和5年度に実施した就学援助実施状況等調査」結果 PDF を
 *    `pdftotext -layout` した生テキスト)
 * 出力: data.csv
 *
 * 抽出規則:
 * - 資料には小中学校計/小学校/中学校の3つの都道府県表があり、いずれも
 *   表題は「令和４年度要保護及び準要保護児童生徒数について(学用品費等)」。
 *   小中学校計の表が最初に現れるため、各区分の**最初の出現行**のみ採用する。
 * - 各行は 区分名 + 10数値: (a)要保護 (b)準要保護 (c)=a+b (d)被災 (e)=c+d
 *   (f)公立小中児童生徒総数 の6実数 + 率4列(a/f, b/f, c/f, e/f)。
 *   収録は a, b, c, f と就学援助率(c/f)。被災分(d, e)と e/f は対象外。
 * - 人数のカンマ区切りは除去して整数化(表記正規化)。率は原文表記のまま。
 * - 整合検証: a + b = c を全行で assert。
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";

const ROW_ORDER = [...PREFECTURES, "合計"];

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/shugaku-enjo-r4-todofuken"
);

const lines = fs
  .readFileSync(path.join(datasetDir, "raw/shugaku-r5jisshi.txt"), "utf-8")
  .split("\n");

const anchorIdx = lines.findIndex((l) =>
  l.includes("令和４年度要保護及び準要保護児童生徒数について")
);
if (anchorIdx === -1) throw new Error("表題アンカー行が見つかりません");

const result = new Map<string, string[]>();
for (let i = anchorIdx + 1; i < lines.length; i++) {
  const tokens = lines[i].trim().split(/\s+/);
  const name = tokens[0];
  if (!name || !ROW_ORDER.includes(name) || result.has(name)) continue;
  if (tokens.length !== 11) {
    throw new Error(
      `「${name}」行のトークン数が ${tokens.length}(期待 11): ${lines[i].trim()}`
    );
  }
  const toInt = (s: string) => s.replaceAll(",", "");
  const [a, b, c, , , f] = tokens.slice(1, 7).map(toInt);
  const rate = tokens[9]; // c/f = 就学援助率
  if (Number(a) + Number(b) !== Number(c)) {
    throw new Error(`「${name}」行で 要保護+準要保護 ≠ 計 (${a}+${b}≠${c})`);
  }
  result.set(name, [name, a, b, c, f, rate]);
  if (result.size === ROW_ORDER.length) break;
}

for (const name of ROW_ORDER) {
  if (!result.has(name)) throw new Error(`「${name}」行がありません`);
}

const header = [
  "区分",
  "要保護児童生徒数",
  "準要保護児童生徒数",
  "認定者計",
  "公立小中学校児童生徒総数",
  "就学援助率",
];
const rows = ROW_ORDER.map((name) => result.get(name)!);
fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...rows]));
console.log(`✓ data.csv (${rows.length} rows)`);
