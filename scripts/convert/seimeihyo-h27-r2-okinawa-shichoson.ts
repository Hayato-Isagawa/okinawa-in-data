/**
 * 市区町村別生命表 平均寿命の2時点比較(平成27年 → 令和2年)の変換スクリプト。
 *
 * 入力:
 *   raw/mhlw_ckts20_07_sankou_h27_saikeisan.xlsx
 *     (参考)平成27年市区町村別生命表を令和2年と同じ方法で再算出したもの。1シート・フラット
 *   ../seimeihyo-r2-okinawa-shichoson/data.csv
 *     令和2年の値。同一出典から収録済み・独立再照合ゲート通過済みのため、こちらを参照して
 *     2つのデータセットの間で数値が食い違わないようにする(公表当時の平成27年版は使わない。
 *     算定方法の変更だけで女は最大0.8年動くため、方法をそろえた再算出版でなければ比較にならない)
 * 出力: data.csv(全国・沖縄県の基準行2件 + 41市町村 = 43行)
 *
 * 抽出規則:
 * - H27 の名称は1列で「沖縄県　国頭郡　大宜味村」形式(全角スペース区切り・郡を含む)。
 *   末尾の要素を市町村名として取り、令和2年側の名称と突き合わせる
 * - 変化は 令和2年 − 平成27年 を小数第1位で算出。公表値がどちらも小数第1位のため、
 *   差には最大 ±0.2 年の丸め由来の幅が乗る(その旨は meta の caveats に明記)
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parseCsv, toCsv } from "../lib/csv";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/seimeihyo-h27-r2-okinawa-shichoson"
);
const r2Csv = path.resolve(
  process.cwd(),
  "data/datasets/seimeihyo-r2-okinawa-shichoson/data.csv"
);

/** 全角スペースを含めて前後の空白を落とす */
const trim = (v: unknown): string =>
  String(v ?? "").replace(/^[\s　]+|[\s　]+$/g, "");

function asYears(v: unknown, label: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 60 || v > 100) {
    throw new Error(`${label}: 平均寿命が数値でないか範囲外 ${String(v)}`);
  }
  const rounded = Math.round(v * 10) / 10;
  if (Math.abs(v - rounded) > 1e-9) {
    throw new Error(`${label}: 公表値は小数第1位のはずが ${String(v)}`);
  }
  return rounded;
}

// --- 平成27年(再算出版) ---
const wb = XLSX.read(
  fs.readFileSync(
    path.join(datasetDir, "raw", "mhlw_ckts20_07_sankou_h27_saikeisan.xlsx")
  )
);
const sheet = wb.Sheets["平均寿命"];
if (!sheet) throw new Error("シート「平均寿命」がありません");
const h27Rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  raw: true,
});

const title = trim(h27Rows[0]?.[0]);
if (!title.includes("令和２年と同様の方法で算出")) {
  throw new Error(`再算出版ではない可能性があります(表題: ${title})`);
}

/** 「沖縄県　国頭郡　大宜味村」→ 大宜味村 / 「沖縄県」→ 沖縄県 / 「全国」→ 全国 */
const h27 = new Map<string, { male: number; female: number; raw: string }>();
for (const row of h27Rows) {
  const name = trim(row[0]);
  if (!name || typeof row[1] !== "number") continue;
  const parts = name.split(/[\s　]+/);
  if (name !== "全国" && parts[0] !== "沖縄県") continue;
  const key =
    name === "全国"
      ? "全国"
      : parts.length === 1
        ? "沖縄県"
        : parts[parts.length - 1];
  if (h27.has(key)) throw new Error(`平成27年: キー ${key} が重複(${name})`);
  h27.set(key, {
    male: asYears(row[1], `${name} 男(H27)`),
    female: asYears(row[2], `${name} 女(H27)`),
    raw: name,
  });
}

// --- 令和2年(収録済みデータセット) ---
const r2 = parseCsv(fs.readFileSync(r2Csv, "utf8").trim());
const r2Header = r2[0];
const iMale = r2Header.indexOf("男性の平均寿命");
const iFemale = r2Header.indexOf("女性の平均寿命");
if (iMale < 0 || iFemale < 0)
  throw new Error("令和2年の data.csv に平均寿命の列がありません");

const header = [
  "市町村",
  "平成27年の平均寿命(男性)",
  "令和2年の平均寿命(男性)",
  "平均寿命の変化(男性)",
  "平成27年の平均寿命(女性)",
  "令和2年の平均寿命(女性)",
  "平均寿命の変化(女性)",
];

const out = r2.slice(1).map((row) => {
  const name = row[0];
  const past = h27.get(name);
  if (!past) throw new Error(`平成27年に ${name} がありません`);
  const male = asYears(Number(row[iMale]), `${name} 男(R2)`);
  const female = asYears(Number(row[iFemale]), `${name} 女(R2)`);
  const diff = (now: number, before: number) =>
    (Math.round((now - before) * 10) / 10).toFixed(1);
  return [
    name,
    past.male.toFixed(1),
    male.toFixed(1),
    diff(male, past.male),
    past.female.toFixed(1),
    female.toFixed(1),
    diff(female, past.female),
  ];
});

if (out.length !== 43)
  throw new Error(`43行(全国+沖縄県+41市町村)のはずが ${out.length} 行`);

// 一次資料のアンカー(取得時の独立読み取りと一致すること)
const anchors: Array<[string, number, number, number, number]> = [
  ["全国", 80.8, 87.0, 81.5, 87.6],
  ["沖縄県", 80.3, 87.4, 80.7, 87.9],
  ["北中城村", 81.0, 88.2, 81.3, 88.7],
];
for (const [name, hm, hf, rm, rf] of anchors) {
  const row = out.find((r) => r[0] === name);
  if (!row) throw new Error(`アンカー行 ${name} がありません`);
  const got = [Number(row[1]), Number(row[4]), Number(row[2]), Number(row[5])];
  if (got[0] !== hm || got[1] !== hf || got[2] !== rm || got[3] !== rf) {
    throw new Error(
      `${name}: アンカー不一致 ${JSON.stringify(got)} ≠ ${[hm, hf, rm, rf]}`
    );
  }
}

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
const muni = out.filter((r) => r[0] !== "全国" && r[0] !== "沖縄県");
const stat = (col: number) => {
  const v = muni.map((r) => Number(r[col])).sort((a, b) => a - b);
  return `min ${v[0]} / 中央 ${v[20]} / max ${v[40]} / 減少 ${v.filter((x) => x < 0).length}件`;
};
console.log(`  男性の変化: ${stat(3)}`);
console.log(`  女性の変化: ${stat(6)}`);
