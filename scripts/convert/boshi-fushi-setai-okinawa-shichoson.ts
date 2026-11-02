/**
 * 令和2年国勢調査 人口等基本集計 — 沖縄県内市町村の母子世帯・父子世帯の変換。
 *
 * 入力:
 *   raw/b36_01_boshi_setai_shikuchoson_statInfId000032142682.xlsx(第36-1表 母子世帯)
 *   raw/b39_01_fushi_setai_shikuchoson_statInfId000032142690.xlsx(第39-1表 父子世帯)
 *   raw/b10_kazoku_ruikei_ippan_setai_shikuchoson_statInfId000032142501.xlsx(第10表 一般世帯数=分母)
 * 出力: data.csv(41市町村、コード昇順)
 *
 * 抽出規則:
 * - 地域は地域名列の「47xxx_名称」形式から団体コード5桁で同定(47000=県は集計検証にのみ使用)。
 *   境界データの41市町村と完全一致することを assert
 * - 母子・父子とも「1_(狭義: 親と未婚20歳未満の子のみ)」と
 *   「2_(他の世帯員がいる世帯を含む)」の両区分を収録
 * - 一般世帯数は第10表の世帯人員「0_総数」行の総数列
 * - 「-」(該当数字がないもの)は 0 として収録(notes 参照)
 * - 母子世帯割合(%)= 母子世帯数(狭義)÷一般世帯数×100 を小数第2位で四捨五入(サイト導出値)
 * - 整合検証: 41市町村の合計が同表の沖縄県(47000)の値と一致することを全列で assert
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";
import { loadOkinawaMunicipalities } from "../lib/estat-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/boshi-fushi-setai-okinawa-shichoson"
);

function sheetRows(file: string, sheet: string): unknown[][] {
  const wb = XLSX.read(fs.readFileSync(path.join(datasetDir, "raw", file)));
  const ws = wb.Sheets[sheet];
  if (!ws)
    throw new Error(
      `${file}: シート "${sheet}" がありません(${wb.SheetNames.join(", ")})`
    );
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
}

/** 「-」(該当数字がないもの)= 0。それ以外は非負整数を要求 */
function asCount(v: unknown, label: string): number {
  if (v === "-") return 0;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
    throw new Error(`${label}: 整数でない値 ${String(v)}`);
  }
  return v;
}

const AREA = /^(47\d{3})_(.+)$/;

/** b36/b39: code5 → {kind1, kind2}(列A=区分、列D=地域名、列E=総数) */
function extractParentChild(
  file: string,
  sheet: string,
  kindWord: string
): {
  byCode: Map<string, { k1: number; k2: number }>;
  pref: { k1: number; k2: number };
} {
  const rows = sheetRows(file, sheet);
  const byCode = new Map<string, { k1: number; k2: number }>();
  const pref = { k1: -1, k2: -1 };
  for (const row of rows) {
    const kind = String(row[0] ?? "").trim();
    const m = AREA.exec(String(row[3] ?? "").trim());
    if (!m) continue;
    const isK1 = kind === `1_${kindWord}`;
    const isK2 = kind === `2_${kindWord}（他の世帯員がいる世帯を含む）`;
    if (!isK1 && !isK2) continue;
    const v = asCount(row[4], `${file} ${m[0]}`);
    if (m[1] === "47000") {
      if (isK1) pref.k1 = v;
      else pref.k2 = v;
      continue;
    }
    const cur = byCode.get(m[1]) ?? { k1: -1, k2: -1 };
    if (isK1) cur.k1 = v;
    else cur.k2 = v;
    byCode.set(m[1], cur);
  }
  if (pref.k1 < 0 || pref.k2 < 0)
    throw new Error(`${file}: 沖縄県(47000)行がありません`);
  return { byCode, pref };
}

/** b10: code5 → 一般世帯数(世帯人員 0_総数 の行の総数列) */
function extractHouseholds(): { byCode: Map<string, number>; pref: number } {
  const rows = sheetRows(
    "b10_kazoku_ruikei_ippan_setai_shikuchoson_statInfId000032142501.xlsx",
    "b10"
  );
  const byCode = new Map<string, number>();
  let pref = -1;
  for (const row of rows) {
    if (String(row[3] ?? "").trim() !== "0_総数") continue;
    const m = AREA.exec(String(row[2] ?? "").trim());
    if (!m) continue;
    const v = asCount(row[4], `b10 ${m[0]}`);
    if (m[1] === "47000") {
      pref = v;
      continue;
    }
    if (byCode.has(m[1])) throw new Error(`b10: ${m[1]} が重複`);
    byCode.set(m[1], v);
  }
  if (pref < 0) throw new Error("b10: 沖縄県(47000)行がありません");
  return { byCode, pref };
}

const boshi = extractParentChild(
  "b36_01_boshi_setai_shikuchoson_statInfId000032142682.xlsx",
  "b36_01",
  "母子世帯"
);
const fushi = extractParentChild(
  "b39_01_fushi_setai_shikuchoson_statInfId000032142690.xlsx",
  "b39_01",
  "父子世帯"
);
const setai = extractHouseholds();

const munis = loadOkinawaMunicipalities();

const header = [
  "市町村",
  "団体コード",
  "母子世帯数",
  "父子世帯数",
  "母子世帯数(他の世帯員がいる世帯を含む)",
  "父子世帯数(他の世帯員がいる世帯を含む)",
  "一般世帯数",
  "母子世帯割合",
];

const sums = { b1: 0, b2: 0, f1: 0, f2: 0, h: 0 };
const out = munis.map((m) => {
  const b = boshi.byCode.get(m.code5);
  const f = fushi.byCode.get(m.code5);
  const h = setai.byCode.get(m.code5);
  if (
    !b ||
    b.k1 < 0 ||
    b.k2 < 0 ||
    !f ||
    f.k1 < 0 ||
    f.k2 < 0 ||
    h === undefined
  ) {
    throw new Error(`${m.code5} ${m.name}: いずれかの表に行がありません`);
  }
  sums.b1 += b.k1;
  sums.b2 += b.k2;
  sums.f1 += f.k1;
  sums.f2 += f.k2;
  sums.h += h;
  const ratio = (Math.round((b.k1 / h) * 100 * 100) / 100).toFixed(2);
  return [
    m.name,
    m.code5,
    String(b.k1),
    String(f.k1),
    String(b.k2),
    String(f.k2),
    String(h),
    ratio,
  ];
});

// 41市町村の合計 = 県値(47000)を全列で検証(網羅性と転記の同時検証)
const checks: Array<[string, number, number]> = [
  ["母子(狭義)", sums.b1, boshi.pref.k1],
  ["母子(含む)", sums.b2, boshi.pref.k2],
  ["父子(狭義)", sums.f1, fushi.pref.k1],
  ["父子(含む)", sums.f2, fushi.pref.k2],
  ["一般世帯", sums.h, setai.pref],
];
for (const [label, sum, ref] of checks) {
  if (sum !== ref) throw new Error(`${label}: 市町村計 ${sum} ≠ 県値 ${ref}`);
}

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
const naha = out.find((r) => r[0] === "那覇市")!;
console.log(
  `  那覇市: 母子 ${naha[2]} / 父子 ${naha[3]} / 一般世帯 ${naha[6]} / 割合 ${naha[7]}%`
);
console.log(
  `  県計検証: 母子 ${sums.b1}=${boshi.pref.k1} / 父子 ${sums.f1}=${fushi.pref.k1} / 世帯 ${sums.h}=${setai.pref}`
);
