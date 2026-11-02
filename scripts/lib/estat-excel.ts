/**
 * e-Stat 公表 Excel(住基台帳・統計でみる市区町村のすがた)の共通パーサ。
 * 市町村の同定は名称マッチではなく団体コード先頭5桁で行い、
 * 境界データ(41市町村)のコード集合と完全一致することを assert する。
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

export interface OkinawaMunicipality {
  code5: string;
  name: string;
}

/** 境界データから 41 市町村の code5/name を読む(コード昇順) */
export function loadOkinawaMunicipalities(): OkinawaMunicipality[] {
  const geo = JSON.parse(
    fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/data/geo/okinawa-municipalities.geojson"
      ),
      "utf-8"
    )
  ) as { features: Array<{ properties: { name: string; code: string } }> };
  return geo.features
    .map((f) => ({ code5: f.properties.code, name: f.properties.name }))
    .sort((a, b) => a.code5.localeCompare(b.code5));
}

/** シートを 2 次元配列で返す(raw 値)。sheetName 省略時は先頭シート */
export function readSheetRows(
  filePath: string,
  sheetName?: string
): unknown[][] {
  const wb = XLSX.read(fs.readFileSync(filePath));
  const name = sheetName ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws) {
    throw new Error(
      `${path.basename(filePath)}: シート "${name}" がありません(存在: ${wb.SheetNames.join(", ")})`
    );
  }
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
}

/**
 * code 列(6桁 or 5桁、空白パディングあり)から先頭5桁を取り出し、
 * 41市町村の行を code5 → 行 の Map で返す。欠けがあれば throw。
 * 同一 code の複数行(住基25-04 の 計/男/女 など)は rowFilter で絞る。
 */
export function collectOkinawaRows(
  rows: unknown[][],
  codeColIdx: number,
  rowFilter: (row: unknown[]) => boolean = () => true
): Map<string, unknown[]> {
  const munis = loadOkinawaMunicipalities();
  const codeSet = new Set(munis.map((m) => m.code5));
  const result = new Map<string, unknown[]>();
  for (const row of rows) {
    const code5 = String(row[codeColIdx] ?? "")
      .trim()
      .slice(0, 5);
    if (!codeSet.has(code5) || !rowFilter(row)) continue;
    if (result.has(code5)) {
      throw new Error(`code ${code5} が重複しています(rowFilter を確認)`);
    }
    result.set(code5, row);
  }
  for (const m of munis) {
    if (!result.has(m.code5)) {
      throw new Error(`${m.name}(${m.code5})の行が見つかりません`);
    }
  }
  return result;
}

/** セル値を検証付きで整数文字列化(カンマなし前提の raw 値) */
export function asInt(value: unknown, label: string): string {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    throw new Error(`${label} が整数でありません: ${String(value)}`);
  }
  return String(value);
}
