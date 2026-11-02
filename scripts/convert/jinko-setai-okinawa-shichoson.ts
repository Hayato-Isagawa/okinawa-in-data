/**
 * 住民基本台帳 人口・世帯数・人口動態(市区町村別)【総計】沖縄県分の変換。
 *
 * 入力: raw/juki-2503.xlsx(総務省 表25-03、令和7年1月1日現在)
 * 出力: data.csv(41市町村、コード昇順)
 *
 * 列マッピング(ヘッダ6行、実測で確認):
 *   [0]団体コード(6桁) [2]市区町村名 [3]男 [4]女 [5]計 [6]世帯数
 *   [10]出生者数 [16]死亡者数(いずれも令和6年 1〜12月)
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
  "data/datasets/jinko-setai-okinawa-shichoson"
);

const rows = readSheetRows(path.join(datasetDir, "raw/juki-2503.xlsx"));
const byCode = collectOkinawaRows(rows, 0);
const munis = loadOkinawaMunicipalities();

const header = [
  "市町村",
  "団体コード",
  "人口",
  "男",
  "女",
  "世帯数",
  "出生者数",
  "死亡者数",
];
const out = munis.map((m) => {
  const r = byCode.get(m.code5)!;
  const name = String(r[2])
    .trim()
    .replace(/^.+?郡/, "");
  if (name !== m.name) {
    throw new Error(`${m.code5}: 名称不一致 ${name} ≠ ${m.name}`);
  }
  return [
    m.name,
    m.code5,
    asInt(r[5], `${m.name} 人口計`),
    asInt(r[3], `${m.name} 男`),
    asInt(r[4], `${m.name} 女`),
    asInt(r[6], `${m.name} 世帯数`),
    asInt(r[10], `${m.name} 出生者数`),
    asInt(r[16], `${m.name} 死亡者数`),
  ];
});

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
