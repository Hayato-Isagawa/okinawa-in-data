/**
 * 住民基本台帳 年齢階級別人口(市区町村別)【総計】から年少人口(0〜14歳)を集計。
 *
 * 入力: raw/juki-2504.xlsx(総務省 表25-04、令和7年1月1日現在)
 * 出力: data.csv(41市町村、コード昇順)
 *
 * 列マッピング(ヘッダ3行、実測で確認):
 *   [0]団体コード(6桁) [2]市区町村名 [3]性別(計/男/女)
 *   [4]総数 [5]0〜4歳 [6]5〜9歳 [7]10〜14歳
 * 年少人口 = 0〜4 + 5〜9 + 10〜14(性別=計 の行のみ使用)。
 * 年少人口割合(%) = 年少人口 ÷ 総数 × 100 を小数第1位で四捨五入(導出値)。
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
  "data/datasets/nenshojinko-okinawa-shichoson"
);

const rows = readSheetRows(path.join(datasetDir, "raw/juki-2504.xlsx"));
const byCode = collectOkinawaRows(rows, 0, (r) => String(r[3]).trim() === "計");
const munis = loadOkinawaMunicipalities();

const header = ["市町村", "団体コード", "年少人口", "総人口", "年少人口割合"];
const out = munis.map((m) => {
  const r = byCode.get(m.code5)!;
  const name = String(r[2])
    .trim()
    .replace(/^.+?郡/, "");
  if (name !== m.name)
    throw new Error(`${m.code5}: 名称不一致 ${name} ≠ ${m.name}`);
  const young =
    Number(asInt(r[5], "0-4歳")) +
    Number(asInt(r[6], "5-9歳")) +
    Number(asInt(r[7], "10-14歳"));
  const total = Number(asInt(r[4], "総数"));
  const ratio = Math.round((young / total) * 1000) / 10;
  // 導出値の再計算検証: 割合から逆算した年少人口が ±0.05% 幅に収まること
  if (Math.abs((ratio / 100) * total - young) > total * 0.0005 + 1) {
    throw new Error(`${m.name}: 年少人口割合の導出検証に失敗`);
  }
  return [m.name, m.code5, String(young), String(total), ratio.toFixed(1)];
});

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
