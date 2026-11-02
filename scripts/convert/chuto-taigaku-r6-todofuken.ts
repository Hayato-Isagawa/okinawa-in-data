/**
 * 児童生徒の問題行動・不登校等生徒指導上の諸課題に関する調査(令和6年度)
 * 都道府県別の高等学校中途退学の変換スクリプト。
 *
 * 入力:
 *   raw/r6_chuto_taigaku_todofuken_6-8.xlsx(表(6-8) 中途退学者数及び中途退学率、シート「高校中退(6-8)」)
 *   raw/r6_chuto_taigaku_jiyubetsu_todofuken_6-9.xlsx(表(6-9) 事由別中途退学者数、シート「高校中退(6-9)」)
 * 出力: data.csv(47都道府県+全国、48行)
 *
 * 抽出規則(futoko-ijime-todofuken と同じ規則を踏襲):
 * - 行の同定はコード列(01〜47、全国=00)。参考行や空白セルの行はコードが無いため自然に除外
 * - 名称列がコード順に PREFECTURES と一致することを assert(ふりがな混入の検出を兼ねる)
 * - 中途退学率のセルには公表値(小数第1位)が入っているが、一部が浮動小数点表現の都合で
 *   1.1000000000000001 や 1 のような値として保存されているため小数第1位に丸め直す
 *   (例: 長野県 647÷59,595×100=1.0857…% を丸めた 1.1 がセルの値)。人数は整数を assert
 * - 事由別は人数のみ収録(構成比は人数÷中途退学者数で再現できるため列に持たない)
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/chuto-taigaku-r6-todofuken"
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

/** 浮動小数点表現の揺れ(1.1000000000000001・1 など)を小数第1位に丸め直す */
function asRate(v: unknown, label: string): string {
  if (typeof v !== "number" || v < 0 || v > 100) {
    throw new Error(`${label}: 率が数値でないか範囲外 ${String(v)}`);
  }
  return (Math.round(v * 10) / 10).toFixed(1);
}

const main = readRowsByCode(
  "r6_chuto_taigaku_todofuken_6-8.xlsx",
  "高校中退(6-8)"
);
const jiyu = readRowsByCode(
  "r6_chuto_taigaku_jiyubetsu_todofuken_6-9.xlsx",
  "高校中退(6-9)"
);

/** 表(6-9)の事由: 列名(原表の文言のまま)と人数列の位置 */
const REASONS: Array<{ name: string; col: number }> = [
  { name: "学業不振", col: 2 },
  { name: "学校生活・学業不適応", col: 4 },
  { name: "進路変更", col: 6 },
  { name: "病気，けが，死亡", col: 8 },
  { name: "経済的理由", col: 10 },
  { name: "家庭の事情", col: 12 },
  { name: "問題行動等", col: 14 },
  { name: "その他の理由", col: 16 },
];

const header = [
  "都道府県",
  "4月1日現在在籍者数",
  "中途退学者数",
  "中途退学率",
  ...REASONS.map((r) => `中途退学者数(${r.name})`),
];

const codes = [
  ...Array.from({ length: 47 }, (_, i) => String(i + 1).padStart(2, "0")),
  "00",
];
const out = codes.map((code) => {
  const m = main.get(code)!;
  const j = jiyu.get(code)!;
  const name = String(m[1]).trim();

  const enrolled = asCount(m[2], `${name} 在籍者数`);
  const dropouts = asCount(m[3], `${name} 中途退学者数`);
  const rate = asRate(m[4], `${name} 中途退学率`);

  // 導出値の再計算検証: 中途退学者数÷在籍者数×100 が公表の率と一致すること
  const recomputed = (
    Math.round((Number(dropouts) / Number(enrolled)) * 1000) / 10
  ).toFixed(1);
  if (recomputed !== rate) {
    throw new Error(
      `${name}: 中途退学率の再計算が公表値と不一致(${recomputed} ≠ ${rate})`
    );
  }

  // 表(6-9)の中途退学者数(計)が表(6-8)と一致すること(表をまたぐ錨)
  const jiyuTotal = asCount(j[18], `${name} 事由別の計`);
  if (jiyuTotal !== dropouts) {
    throw new Error(
      `${name}: 表6-9の計 ${jiyuTotal} ≠ 表6-8の中途退学者数 ${dropouts}`
    );
  }

  const reasons = REASONS.map((r) => asCount(j[r.col], `${name} ${r.name}`));
  const sum = reasons.reduce((a, b) => a + Number(b), 0);
  if (sum !== Number(dropouts)) {
    throw new Error(
      `${name}: 事由別8項目の合計 ${sum} ≠ 中途退学者数 ${dropouts}`
    );
  }

  return [name, enrolled, dropouts, rate, ...reasons];
});

// 47都道府県の合計が全国行と一致すること(在籍者数・中途退学者数・事由別の各列)
const national = out.find((r) => r[0] === "全国")!;
const prefs = out.filter((r) => r[0] !== "全国");
for (const col of [1, 2, ...REASONS.map((_, i) => 4 + i)]) {
  const sum = prefs.reduce((a, r) => a + Number(r[col]), 0);
  if (sum !== Number(national[col])) {
    throw new Error(
      `${header[col]}: 47都道府県の合計 ${sum} ≠ 全国 ${national[col]}`
    );
  }
}

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
const okinawa = out.find((r) => r[0] === "沖縄県")!;
console.log(
  `  沖縄県: 在籍 ${okinawa[1]} / 中退 ${okinawa[2]}(${okinawa[3]}%)`
);
console.log(
  `  全国:   在籍 ${national[1]} / 中退 ${national[2]}(${national[3]}%)`
);
