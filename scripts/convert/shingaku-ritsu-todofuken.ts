/**
 * 学校基本調査 令和7年度(確報) 都道府県別進学率の変換スクリプト。
 *
 * 入力:
 *   raw/r7_chugakko_hyo259_jokyobetsu_sotsugyoshasu.xlsx
 *     (表259 中学校 状況別卒業者数 —「高等学校等進学率」列)
 *   raw/r7_koko_hyo283_jokyobetsu_sotsugyoshasu.xlsx
 *     (表283 高等学校(全日制・定時制) 状況別卒業者数 —「大学等進学率」列)
 * 出力: data.csv(47都道府県+全国「計」、48行)
 *
 * 抽出規則:
 * - 男女計のシート(名前が "(3-1)" で終わる)を使用
 * - 名称列は「北海道」を含む列、率列はヘッダ文字列(前方一致)で動的同定。
 *   各都道府県はシート内にちょうど1回現れることを assert
 * - セル値は丸め前の生値のため、公表 Excel の表示形式(小数第1位)に合わせて
 *   四捨五入して収録(公表表示の再現)。0〜100 の範囲を全行 assert
 * - 全国行のラベルは原表記「計」のまま収録(行順は 47都道府県 → 計)
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";
import { readSheetRows } from "../lib/estat-excel";
import { PREFECTURES } from "../lib/prefectures";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/shingaku-ritsu-todofuken"
);

/** 収録対象の卒業年(前年(令和6年3月)の「計」行が併記されているため明示する) */
const TARGET_YEAR = "令和7年3月";

function normalize(cell: unknown): string {
  return String(cell ?? "").replace(/\s/g, "");
}

/** 名前が "(3-1)"(男女計)で終わるシートの行列を返す */
function readTotalsSheet(file: string): unknown[][] {
  const wb = XLSX.read(fs.readFileSync(path.join(datasetDir, "raw", file)));
  const name = wb.SheetNames.find((n: string) => n.endsWith("(3-1)"));
  if (!name) {
    throw new Error(
      `${file}: "(3-1)" シートが見つかりません(${wb.SheetNames.join(", ")})`
    );
  }
  return readSheetRows(path.join(datasetDir, "raw", file), name);
}

/** ヘッダ文字列(前方一致)で率列を同定し、行名 → 率(小数第1位) の Map を返す */
function extractRates(file: string, headerPrefix: string): Map<string, string> {
  const rows = readTotalsSheet(file);

  // 結合セルの親ラベルが複数列に展開されるため、列ごとの「最終(最深)ヘッダ」で同定する
  // (例: 表259 は親「高等学校等進学率」の下に「(同)」と「通信制除く」の2列がぶら下がる)。
  // ヘッダ帯はデータ行(行7〜)より上の 0〜6 行、文字列セルのみを対象にする
  const lastHeader = new Map<number, string>();
  for (const row of rows.slice(0, 7)) {
    for (let c = 0; c < row.length; c++) {
      if (typeof row[c] !== "string") continue;
      const s = normalize(row[c]);
      if (s) lastHeader.set(c, s);
    }
  }
  const matches = [...lastHeader.entries()].filter(
    ([, s]) => s === headerPrefix
  );
  if (matches.length !== 1) {
    throw new Error(
      `${file}: 最深ヘッダ "${headerPrefix}" の列が ${matches.length} 個(1個であるべき)`
    );
  }
  const rateCol = matches[0][0];

  // 年ラベル列(令和7年3月)と区分名列(北海道)を動的同定。
  // 「計」行は前年(令和6年3月)との2行が並ぶため、年ラベルで当年に限定する
  let yearCol = -1;
  let nameCol = -1;
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const s = normalize(row[c]);
      if (s === TARGET_YEAR && yearCol === -1) yearCol = c;
      if (s === "北海道" && nameCol === -1) nameCol = c;
    }
  }
  if (yearCol === -1)
    throw new Error(`${file}: 年ラベル "${TARGET_YEAR}" が見つかりません`);
  if (nameCol === -1)
    throw new Error(`${file}: 名称列(北海道)が見つかりません`);

  const result = new Map<string, string>();
  const wanted = new Set<string>([...PREFECTURES, "計"]);
  for (const row of rows) {
    if (normalize(row[yearCol]) !== TARGET_YEAR) continue;
    const name = normalize(row[nameCol]);
    if (!wanted.has(name)) continue;
    const v = row[rateCol];
    if (typeof v !== "number") {
      throw new Error(`${file}: ${name} の率が数値でない: ${String(v)}`);
    }
    if (result.has(name)) {
      throw new Error(`${file}: 行 "${name}" が複数回出現`);
    }
    if (v < 0 || v > 100)
      throw new Error(`${file}: ${name} の率 ${v} が範囲外`);
    // 公表 Excel の表示形式(小数第1位)に合わせて四捨五入
    result.set(name, (Math.round(v * 10) / 10).toFixed(1));
  }
  for (const name of wanted) {
    if (!result.has(name))
      throw new Error(`${file}: 行 "${name}" が見つかりません`);
  }
  return result;
}

const koko = extractRates(
  "r7_chugakko_hyo259_jokyobetsu_sotsugyoshasu.xlsx",
  "高等学校等進学率"
);
const daigaku = extractRates(
  "r7_koko_hyo283_jokyobetsu_sotsugyoshasu.xlsx",
  "大学等進学率"
);

const header = ["都道府県", "高等学校等進学率", "大学等進学率"];
const out = [...PREFECTURES, "計"].map((name) => [
  name,
  koko.get(name)!,
  daigaku.get(name)!,
]);

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
console.log(
  `  沖縄県: 高等学校等 ${koko.get("沖縄県")} / 大学等 ${daigaku.get("沖縄県")}`
);
console.log(
  `  計:     高等学校等 ${koko.get("計")} / 大学等 ${daigaku.get("計")}`
);
