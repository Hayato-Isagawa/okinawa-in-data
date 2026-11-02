/**
 * 令和5年度 沖縄県内市町村別 就学援助率(階級)の変換スクリプト。
 *
 * 入力: raw/shugaku_r6_okinawa.txt
 *   (文部科学省「令和6年度就学援助の実施状況(市町村別実施状況)」沖縄県分 PDF を
 *    `pdftotext -layout` した生テキスト)
 * 出力: data.csv
 *
 * 抽出規則:
 * - 就学援助率は「20%未満」のような5%刻みの階級での回答であり、実数は
 *   公表されていない。本スクリプトは階級表記をそのまま収録する(「0%未満」含む)。
 * - 対象行は「沖縄県 <市町村名> ...」で始まり、行末トークンが階級
 *   (^[0-9]+%(未満|以上)$)の行のみ。他の設問セクションの行は行末が階級に
 *   ならないため除外される。各市町村の最初の出現のみ採用。
 * - 市町村名の集合は境界データ(src/data/geo/okinawa-municipalities.geojson、
 *   41市町村)と完全一致することを検証する。
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/shugaku-enjo-r5-okinawa-shichoson"
);

const geo = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), "src/data/geo/okinawa-municipalities.geojson"),
    "utf-8"
  )
) as { features: Array<{ properties: { name: string } }> };
const geoNames = new Set(geo.features.map((f) => f.properties.name));

const lines = fs
  .readFileSync(path.join(datasetDir, "raw/shugaku_r6_okinawa.txt"), "utf-8")
  .split("\n");

const result = new Map<string, string>();
for (const line of lines) {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== "沖縄県" || tokens.length < 3) continue;
  const name = tokens[1];
  const last = tokens[tokens.length - 1];
  if (!/^[0-9]+%(未満|以上)$/.test(last)) continue;
  if (result.has(name)) continue;
  result.set(name, last);
}

const resultNames = new Set(result.keys());
for (const name of geoNames) {
  if (!resultNames.has(name))
    throw new Error(`境界データにある「${name}」の率階級が見つかりません`);
}
for (const name of resultNames) {
  if (!geoNames.has(name))
    throw new Error(`「${name}」が境界データ(41市町村)に存在しません`);
}
if (result.size !== 41) {
  throw new Error(`市町村数 ${result.size}(期待 41)`);
}

const header = ["市町村", "就学援助率階級"];
const rows = [...result.entries()].map(([name, cls]) => [name, cls]);
fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...rows]));
console.log(`✓ data.csv (${rows.length} rows)`);
