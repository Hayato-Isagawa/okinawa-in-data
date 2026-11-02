/**
 * 児童生徒の問題行動・不登校等生徒指導上の諸課題に関する調査(令和6年度)
 * 都道府県別の不登校・いじめ認知の変換スクリプト。
 *
 * 入力:
 *   raw/r6_futoko_todofuken.xlsx(表(4-15) 都道府県別 不登校児童生徒数、シート「小中長欠(4-15-1)」)
 *   raw/r6_ijime_ninchi_todofuken.xlsx(表(2-12) 都道府県別 いじめの認知件数、シート「いじめ(2-12-1)」)
 * 出力: data.csv(47都道府県+全国、48行)
 *
 * 抽出規則:
 * - 行の同定はコード列(01〜47、全国=00)。参考行(令和5年度)はコードが無いため自然に除外
 * - 名称列がコード順に PREFECTURES と一致することを assert(ふりがな混入の検出を兼ねる)
 * - 1,000人当たり・実施率のセルには公表値(小数第1位)が入っているが、一部が浮動小数点
 *   表現の都合で末尾に誤差を含むため小数第1位に丸め直す。件数・人数は整数であることを assert
 * - いじめの「1,000人当たり認知件数」は小・中・高・特別支援の計(国公私立)のみ公表。
 *   アンケート実施状況の列は本データセットの対象外
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/futoko-ijime-todofuken"
);

function readRowsByCode(
  file: string,
  sheetName: string
): Map<string, unknown[]> {
  const wb = XLSX.read(fs.readFileSync(path.join(datasetDir, "raw", file)));
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`${file}: シート "${sheetName}" がありません`);
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: true,
  });
  const byCode = new Map<string, unknown[]>();
  for (const row of rows) {
    const code = String(row[0] ?? "").trim();
    if (!/^\d{2}$/.test(code)) continue;
    if (byCode.has(code)) throw new Error(`${file}: コード ${code} が重複`);
    byCode.set(code, row);
  }
  // 01〜47 + 00(全国)が揃い、名称がコード順に一致することを検証
  for (let i = 1; i <= 47; i++) {
    const code = String(i).padStart(2, "0");
    const row = byCode.get(code);
    if (!row) throw new Error(`${file}: コード ${code} がありません`);
    const name = String(row[1] ?? "").trim();
    if (name !== PREFECTURES[i - 1]) {
      throw new Error(
        `${file}: コード ${code} の名称 "${name}" ≠ ${PREFECTURES[i - 1]}`
      );
    }
  }
  const national = byCode.get("00");
  if (!national || String(national[1]).trim() !== "全国") {
    throw new Error(`${file}: 全国行(コード00)が見つかりません`);
  }
  return byCode;
}

function asCount(v: unknown, label: string): string {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new Error(`${label}: 整数でない値 ${String(v)}`);
  }
  return String(v);
}

/** 浮動小数点表現の揺れを含む公表値を小数第1位に丸め直す */
function asRate(v: unknown, label: string): string {
  if (typeof v !== "number" || v < 0 || v > 1000) {
    throw new Error(`${label}: 率が数値でないか範囲外 ${String(v)}`);
  }
  return (Math.round(v * 10) / 10).toFixed(1);
}

const futoko = readRowsByCode("r6_futoko_todofuken.xlsx", "小中長欠(4-15-1)");
const ijime = readRowsByCode(
  "r6_ijime_ninchi_todofuken.xlsx",
  "いじめ(2-12-1)"
);

const header = [
  "都道府県",
  "不登校児童数(小学校)",
  "1000人当たり不登校児童数(小学校)",
  "不登校生徒数(中学校)",
  "1000人当たり不登校生徒数(中学校)",
  "不登校児童生徒数(小中計)",
  "1000人当たり不登校児童生徒数(小中計)",
  "いじめ認知件数(小中高特支計)",
  "1000人当たりいじめ認知件数(小中高特支計)",
];

const codes = [
  ...Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, "0")),
  "00",
];
const out = codes.map((code) => {
  const f = futoko.get(code)!;
  const j = ijime.get(code)!;
  const name = String(f[1]).trim();
  return [
    name,
    asCount(f[2], `${name} 不登校小`),
    asRate(f[3], `${name} 不登校小率`),
    asCount(f[4], `${name} 不登校中`),
    asRate(f[5], `${name} 不登校中率`),
    asCount(f[6], `${name} 不登校小中計`),
    asRate(f[7], `${name} 不登校小中率`),
    asCount(j[6], `${name} いじめ計`),
    asRate(j[7], `${name} いじめ率`),
  ];
});

// 小+中=小中計 を全行で検証
for (const row of out) {
  const [name, sho, , chu, , kei] = row;
  if (Number(sho) + Number(chu) !== Number(kei)) {
    throw new Error(`${name}: 不登校 小+中≠小中計 (${sho}+${chu}≠${kei})`);
  }
}

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
const okinawa = out.find((r) => r[0] === "沖縄県")!;
const national = out.find((r) => r[0] === "全国")!;
console.log(
  `  沖縄県: 不登校小中 ${okinawa[5]}(${okinawa[6]}) / いじめ ${okinawa[7]}(${okinawa[8]})`
);
console.log(
  `  全国:   不登校小中 ${national[5]}(${national[6]}) / いじめ ${national[7]}(${national[8]})`
);
