/**
 * 統計でみる市区町村のすがた2026 E教育から学校数・児童生徒数(市町村別)を抽出。
 *
 * 入力: raw/sugata-e.xls(総務省統計局、旧 .xls 形式)
 * 出力: data.csv(41市町村、コード昇順)
 *
 * 列マッピング(ヘッダ10行、実測で確認):
 *   [7]市区町村コード(5桁) [8]市区町村名
 *   [12]E2101 小学校数 [14]E2501 小学校児童数
 *   [15]E3101 中学校数 [17]E3501 中学校生徒数(いずれも 2024 年)
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
  "data/datasets/gakko-jido-okinawa-shichoson"
);

const rows = readSheetRows(path.join(datasetDir, "raw/sugata-e.xls"));
const byCode = collectOkinawaRows(rows, 7);
const munis = loadOkinawaMunicipalities();

const header = [
  "市町村",
  "団体コード",
  "小学校数",
  "小学校児童数",
  "中学校数",
  "中学校生徒数",
];
const out = munis.map((m) => {
  const r = byCode.get(m.code5)!;
  return [
    m.name,
    m.code5,
    asInt(r[12], `${m.name} 小学校数`),
    asInt(r[14], `${m.name} 小学校児童数`),
    asInt(r[15], `${m.name} 中学校数`),
    asInt(r[17], `${m.name} 中学校生徒数`),
  ];
});

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
