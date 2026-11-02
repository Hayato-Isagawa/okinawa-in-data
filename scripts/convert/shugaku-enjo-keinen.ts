/**
 * 就学援助率(小中学校計)の経年 — 沖縄県・全国(合計)の変換スクリプト。
 *
 * 入力: raw/shugaku-r2jisshi.txt 〜 raw/shugaku-r5jisshi.txt
 *   (文部科学省「就学援助実施状況等調査」各年度結果 PDF の pdftotext -layout 出力。
 *    shugaku-r5jisshi.txt は shugaku-enjo-r4-todofuken と同一資料)
 * 出力: data.csv(平成30〜令和4年度の5行)
 *
 * 抽出規則:
 * - 各 PDF には「<年度>要保護及び準要保護児童生徒数について(学用品費等)」の表が
 *   年度ごとに 3 つ(小中学校計→小→中)並ぶ。年度表題の最初の出現から次の表題までを
 *   小中学校計の表とみなし、その範囲の 沖縄県・合計 行(区分名+10数値)を採用する
 * - 率は 認定者計(C)/児童生徒総数(F) 列(第9トークン)を原文表記のまま収録
 * - ビンテージ: 令和元年度は令和3年度実施 PDF の修正値(令和3年12月23日修正)、
 *   令和2年度は令和4年度実施 PDF の再掲値を採用(=各年度とも入手可能な最終改定値)。
 *   平成30年度は令和2年度実施 PDF の再掲値のみが raw にあるためそれを採用
 * - 整合検証: 要保護(A)+準要保護(B)=認定者計(C) を対象行で assert。
 *   令和4年度の値は既存データセット shugaku-enjo-r4-todofuken の値と一致することを assert
 * - 令和5年度率(令和6年度実施)は公表 PDF のフォント埋め込み問題により機械抽出・
 *   照合ができないため未収録(caveats 参照)
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { parseCsv } from "../lib/csv";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/shugaku-enjo-keinen"
);

const TITLE_FRAGMENT = "要保護及び準要保護児童生徒数について";

const SOURCES: Array<{ year: string; file: string; titleYear: string }> = [
  {
    year: "平成30年度",
    file: "shugaku-r2jisshi.txt",
    titleYear: "平成３０年度",
  },
  { year: "令和元年度", file: "shugaku-r3jisshi.txt", titleYear: "令和元年度" },
  { year: "令和2年度", file: "shugaku-r4jisshi.txt", titleYear: "令和２年度" },
  { year: "令和3年度", file: "shugaku-r4jisshi.txt", titleYear: "令和３年度" },
  { year: "令和4年度", file: "shugaku-r5jisshi.txt", titleYear: "令和４年度" },
];

function extractRates(
  file: string,
  titleYear: string
): { okinawa: string; national: string } {
  const lines = fs
    .readFileSync(path.join(datasetDir, "raw", file), "utf-8")
    .split("\n");
  const anchor = lines.findIndex((l) => l.includes(titleYear + TITLE_FRAGMENT));
  if (anchor === -1)
    throw new Error(`${file}: 表題 "${titleYear}…" が見つかりません`);
  let end = lines.length;
  for (let i = anchor + 1; i < lines.length; i++) {
    if (lines[i].includes(TITLE_FRAGMENT)) {
      end = i;
      break;
    }
  }

  const pick = (name: string): string => {
    for (let i = anchor + 1; i < end; i++) {
      const tokens = lines[i].trim().split(/\s+/);
      if (tokens[0] !== name || tokens.length !== 11) continue;
      const num = (s: string) => Number(s.replaceAll(",", ""));
      const [a, b, c] = [num(tokens[1]), num(tokens[2]), num(tokens[3])];
      if (a + b !== c) {
        throw new Error(
          `${file} ${titleYear} ${name}: 要保護+準要保護≠認定者計 (${a}+${b}≠${c})`
        );
      }
      return tokens[9]; // 就学援助率(C/F)、原文表記のまま
    }
    throw new Error(
      `${file} ${titleYear}: 行 "${name}" が小中学校計の表に見つかりません`
    );
  };

  return { okinawa: pick("沖縄県"), national: pick("合計") };
}

const header = ["年度", "沖縄県", "全国"];
const out = SOURCES.map((s) => {
  const { okinawa, national } = extractRates(s.file, s.titleYear);
  return [s.year, okinawa, national];
});

// 令和4年度は既存の単年データセットと同一資料。値の一致をデータセット間で検証する
const r4csv = parseCsv(
  fs.readFileSync(
    path.resolve(
      process.cwd(),
      "data/datasets/shugaku-enjo-r4-todofuken/data.csv"
    ),
    "utf-8"
  )
);
const [r4header, ...r4rows] = r4csv;
const rateIdx = r4header.indexOf("就学援助率");
const nameIdx = r4header.indexOf("区分");
const refOkinawa = r4rows.find((r) => r[nameIdx] === "沖縄県")?.[rateIdx];
const refNational = r4rows.find((r) => r[nameIdx] === "合計")?.[rateIdx];
const r4out = out.find((r) => r[0] === "令和4年度")!;
if (r4out[1] !== refOkinawa || r4out[2] !== refNational) {
  throw new Error(
    `令和4年度の値が既存データセットと不一致: 沖縄 ${r4out[1]}≠${refOkinawa} / 全国 ${r4out[2]}≠${refNational}`
  );
}

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
for (const row of out)
  console.log(`  ${row[0]}: 沖縄 ${row[1]} / 全国 ${row[2]}`);
