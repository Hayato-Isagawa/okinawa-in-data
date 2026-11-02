/**
 * 統計でみる市区町村のすがた2026 C経済基盤から課税対象所得(市町村別)を抽出。
 *
 * 入力: raw/sugata-c.xls(総務省統計局、旧 .xls 形式)
 * 出力: data.csv(41市町村、コード昇順)
 *
 * 列マッピング(ヘッダ10行、実測で確認):
 *   [7]市区町村コード(5桁) [8]市区町村名(全角スペース詰め)
 *   [10]C120110 課税対象所得(百万円、2024年度) [11]C120120 納税義務者数(所得割、人)
 * 導出値: 納税義務者1人当たり課税対象所得(千円)
 *   = 課税対象所得(百万円) × 1000 ÷ 納税義務者数 を整数に四捨五入。
 *   ※「住民1人当たり」ではない。
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import {
  loadOkinawaMunicipalities,
  readSheetRows,
  collectOkinawaRows,
  asInt,
} from "../lib/estat-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/kazei-shotoku-okinawa-shichoson"
);

const rows = readSheetRows(path.join(datasetDir, "raw/sugata-c.xls"));
const byCode = collectOkinawaRows(rows, 7);
const munis = loadOkinawaMunicipalities();

const header = [
  "市町村",
  "団体コード",
  "課税対象所得",
  "納税義務者数",
  "納税義務者1人当たり課税対象所得",
];
const out = munis.map((m) => {
  const r = byCode.get(m.code5)!;
  const income = Number(asInt(r[10], `${m.name} 課税対象所得`));
  const taxpayers = Number(asInt(r[11], `${m.name} 納税義務者数`));
  const perTaxpayer = Math.round((income * 1000) / taxpayers);
  // 導出値の再計算検証: 逆算値が納税義務者数±0.1%以内
  if (
    Math.abs((perTaxpayer * taxpayers) / 1000 - income) >
    income * 0.001 + 1
  ) {
    throw new Error(`${m.name}: 1人当たり所得の導出検証に失敗`);
  }
  return [
    m.name,
    m.code5,
    String(income),
    String(taxpayers),
    String(perTaxpayer),
  ];
});

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
