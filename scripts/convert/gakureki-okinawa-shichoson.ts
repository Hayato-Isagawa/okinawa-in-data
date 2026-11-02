/**
 * 令和2年国勢調査 就業状態等基本集計 — 沖縄県内市町村の最終学歴の変換。
 *
 * 入力: raw/c11_02_gakureki_shikuchoson_statInfId000032201217.xlsx
 *   (第11-2表 男女、年齢(5歳階級)、在学か否かの別・最終卒業学校の種類別人口(15歳以上)
 *    — 全国、都道府県、市区町村。シート c11_02)
 * 出力: data.csv(41市町村、コード昇順)
 *
 * 抽出規則:
 * - 行の絞り込み: 男女「0_総数」× 年齢「00_総数」× 地域名が「47xxx_名称」形式
 *   (47000=沖縄県は集計検証にのみ使用)。境界データの41市町村と完全一致を assert
 * - 列ヘッダ行(カテゴリコード付き)が期待と完全一致することを assert
 * - 「-」(該当数字がないもの)は 0 として収録(北大東村の大学院など。notes 参照)
 * - 恒等式を全行 assert:
 *   15歳以上人口 = 卒業者 + 在学者 + 未就学者 + 在学か否かの別不詳
 *   卒業者 = 小学校+中学校+高校・旧中+短大・高専+大学+大学院+卒業者内不詳
 * - 大学・大学院卒割合(%) = (大学+大学院) ÷ (卒業者 − 卒業者内不詳) × 100 を
 *   小数第2位で四捨五入(サイト導出値。不詳を分母から除く理由は notes 参照)
 * - 卒業学校不詳率(%) = 卒業者内不詳 ÷ 卒業者 × 100(データ品質の透明化。2020年国勢調査
 *   は学歴不詳が市町村で 0〜35% と大きくばらつくため、割合の市町村間比較の解釈に必須)
 * - 整合検証: 41市町村の合計が沖縄県(47000)の値と一致することを全列で assert
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";
import { loadOkinawaMunicipalities } from "../lib/estat-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/gakureki-okinawa-shichoson"
);

const HEADER_ROW = 7;
const AXIS_ROW = 9;
const DATA_COL_START = 5;
const EXPECTED_HEADER = [
  "0_総数",
  "1_卒業者",
  "11_（卒業者）小学校",
  "12_（卒業者）中学校",
  "13_（卒業者）高校・旧中",
  "14_（卒業者）短大・高専",
  "15_（卒業者）大学",
  "16_（卒業者）大学院",
  "17_（卒業者）不詳",
  "2_在学者",
  "3_未就学者",
  "4_在学か否かの別「不詳」",
];

const wb = XLSX.read(
  fs.readFileSync(
    path.join(
      datasetDir,
      "raw",
      "c11_02_gakureki_shikuchoson_statInfId000032201217.xlsx"
    )
  )
);
const ws = wb.Sheets["c11_02"];
if (!ws)
  throw new Error(`シート c11_02 がありません(${wb.SheetNames.join(", ")})`);
const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  raw: true,
});

// ヘッダ検証
EXPECTED_HEADER.forEach((label, i) => {
  const got = String(rows[HEADER_ROW][DATA_COL_START + i] ?? "").trim();
  if (got !== label) throw new Error(`列ヘッダ不一致: "${got}" ≠ "${label}"`);
});
const axis = rows[AXIS_ROW].slice(0, 5).map((v) => String(v ?? "").trim());
if (axis.join(",") !== "地域識別コード,都道府県,地域名,男女,年齢") {
  throw new Error(`軸名行が想定と異なります: ${axis.join(",")}`);
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
const byCode = new Map<string, number[]>();
let pref: number[] | null = null;
for (let i = AXIS_ROW + 1; i < rows.length; i++) {
  const row = rows[i];
  if (String(row[3] ?? "").trim() !== "0_総数") continue;
  if (String(row[4] ?? "").trim() !== "00_総数") continue;
  const m = AREA.exec(String(row[2] ?? "").trim());
  if (!m) continue;
  const values = EXPECTED_HEADER.map((label, j) =>
    asCount(row[DATA_COL_START + j], `${m[0]} ${label}`)
  );
  if (m[1] === "47000") {
    if (pref) throw new Error("沖縄県(47000)の行が重複");
    pref = values;
    continue;
  }
  if (byCode.has(m[1])) throw new Error(`コード ${m[1]} が重複`);
  byCode.set(m[1], values);
}
if (!pref) throw new Error("沖縄県(47000)の行がありません");

const munis = loadOkinawaMunicipalities();
if (byCode.size !== munis.length) {
  throw new Error(`市町村行 ${byCode.size} ≠ 境界データ ${munis.length}`);
}

// 恒等式(全行)+ 県合計との一致(全列)
const IDX = Object.fromEntries(EXPECTED_HEADER.map((h, i) => [h, i]));
function assertIdentity(name: string, v: number[]) {
  const sotsu =
    v[IDX["11_（卒業者）小学校"]] +
    v[IDX["12_（卒業者）中学校"]] +
    v[IDX["13_（卒業者）高校・旧中"]] +
    v[IDX["14_（卒業者）短大・高専"]] +
    v[IDX["15_（卒業者）大学"]] +
    v[IDX["16_（卒業者）大学院"]] +
    v[IDX["17_（卒業者）不詳"]];
  if (sotsu !== v[IDX["1_卒業者"]]) {
    throw new Error(
      `${name}: 卒業者内訳の和 ${sotsu} ≠ 卒業者 ${v[IDX["1_卒業者"]]}`
    );
  }
  const total =
    v[IDX["1_卒業者"]] +
    v[IDX["2_在学者"]] +
    v[IDX["3_未就学者"]] +
    v[IDX["4_在学か否かの別「不詳」"]];
  if (total !== v[IDX["0_総数"]]) {
    throw new Error(`${name}: 区分の和 ${total} ≠ 総数 ${v[IDX["0_総数"]]}`);
  }
}
assertIdentity("沖縄県", pref);
for (const m of munis) {
  const v = byCode.get(m.code5);
  if (!v) throw new Error(`${m.name}(${m.code5})の行がありません`);
  assertIdentity(m.name, v);
}
EXPECTED_HEADER.forEach((label, j) => {
  const sum = munis.reduce((s, m) => s + byCode.get(m.code5)![j], 0);
  if (sum !== pref![j]) {
    throw new Error(`${label}: 41市町村の和 ${sum} ≠ 沖縄県 ${pref![j]}`);
  }
});

const header = [
  "市町村",
  "15歳以上人口",
  "卒業者",
  "小学校卒",
  "中学校卒",
  "高校・旧中卒",
  "短大・高専卒",
  "大学卒",
  "大学院卒",
  "卒業学校不詳",
  "在学者",
  "未就学者",
  "在学か否か不詳",
  "大学・大学院卒割合",
  "卒業学校不詳率",
];
const out = munis.map((m) => {
  const v = byCode.get(m.code5)!;
  const sotsu = v[IDX["1_卒業者"]];
  const fushou = v[IDX["17_（卒業者）不詳"]];
  const known = sotsu - fushou;
  const daigaku = v[IDX["15_（卒業者）大学"]] + v[IDX["16_（卒業者）大学院"]];
  const share = (Math.round((daigaku / known) * 100 * 100) / 100).toFixed(2);
  const fushouRate = (Math.round((fushou / sotsu) * 100 * 100) / 100).toFixed(
    2
  );
  return [
    m.name,
    String(v[IDX["0_総数"]]),
    String(sotsu),
    String(v[IDX["11_（卒業者）小学校"]]),
    String(v[IDX["12_（卒業者）中学校"]]),
    String(v[IDX["13_（卒業者）高校・旧中"]]),
    String(v[IDX["14_（卒業者）短大・高専"]]),
    String(v[IDX["15_（卒業者）大学"]]),
    String(v[IDX["16_（卒業者）大学院"]]),
    String(fushou),
    String(v[IDX["2_在学者"]]),
    String(v[IDX["3_未就学者"]]),
    String(v[IDX["4_在学か否かの別「不詳」"]]),
    share,
    fushouRate,
  ];
});

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`書き出し: ${out.length} 行`);
const naha = out.find((r) => r[0] === "那覇市")!;
console.log(
  `那覇市: 15歳以上 ${naha[1]} / 大学卒 ${naha[7]} / 大学・大学院卒割合 ${naha[13]}% / 不詳率 ${naha[14]}%`
);
