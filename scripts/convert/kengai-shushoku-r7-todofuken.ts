/**
 * 学校基本調査(令和7年度確定値) 表295「就職先別県外就職者数」 — 都道府県別
 * 高校卒業者の県外就職者数・割合。
 *
 * 入力: raw/mext_kengai_2025_hyo295_000040393948.xlsx(計(男女計)シート「295(2-1)」)
 * 出力: data.csv(48行 = 全国 + 47都道府県、JIS コード順)
 *
 * 抽出規則:
 * - 高等学校(全日制・定時制)卒業の就職者のうち、就職先が学校所在県の外にある者の
 *   数(計)と「就職者のうち県外に就職した割合」を収録
 * - 値は公表 Excel の表示文字列(県外就職者数=桁区切りカンマ除去の整数、
 *   割合=表示どおり小数第1位)
 * 検証: lib/kengai-shushoku-excel(ヘッダ・行ラベル assert、全行で
 * 計=Σ就職先(47都道府県+その他、自県「…」除外)の恒等式、割合表示形式 assert)
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { loadKengai } from "../lib/kengai-shushoku-excel";
import { PREFECTURES } from "../lib/prefectures";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/kengai-shushoku-r7-todofuken"
);
const sheet = loadKengai(
  path.join(datasetDir, "raw", "mext_kengai_2025_hyo295_000040393948.xlsx")
);
if (sheet.yearLabel !== "令和7年3月") {
  throw new Error(`当年が令和7年3月でない: ${sheet.yearLabel}`);
}

const out = [
  ["全国", sheet.national.kengai, sheet.national.ritsu],
  ...PREFECTURES.map((pref) => {
    const v = sheet.prefectures.get(pref)!;
    return [pref, v.kengai, v.ritsu];
  }),
];

fs.writeFileSync(
  path.join(datasetDir, "data.csv"),
  toCsv([["区分", "県外就職者数", "県外就職割合"], ...out])
);

const rank =
  [...sheet.prefectures.entries()]
    .sort((a, b) => Number(b[1].ritsu) - Number(a[1].ritsu))
    .findIndex(([name]) => name === "沖縄県") + 1;
const oki = sheet.prefectures.get("沖縄県")!;
console.log(`書き出し: ${out.length} 行(全国+47都道府県)`);
console.log(`全国: ${sheet.national.kengai}人 / ${sheet.national.ritsu}%`);
console.log(
  `沖縄: ${oki.kengai}人 / ${oki.ritsu}%(割合の大きい順で47都道府県中${rank}位)`
);
