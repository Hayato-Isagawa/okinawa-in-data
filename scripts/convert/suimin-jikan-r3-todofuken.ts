/**
 * 平均睡眠時間 都道府県別(令和3年社会生活基本調査)の変換。
 *
 * 入力: raw/estat_2021_chiiki_68-1.xlsx(地域編 表68-1、曜日4×地域48×
 *       人口集中地区区分3×男女3、総平均時間・分)
 * 出力: data.csv(全国+47都道府県の48行 × 曜日4×男女3=12列)
 *
 * 抽出規則:
 * - 人口集中地区区分は「0_総数」の行のみ使用
 * - 地域は「00_全国」+「01_北海道」〜「47_沖縄県」。コード順に PREFECTURES と
 *   一致することを assert
 * - 全セルが分単位の正の整数であることを assert(表章記号は本表に出現しない)
 * - 週全体×男女3の全48行(=144値)を主要統計表15-1/15-2/15-3 と全数突合
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";
import { readSheetRows } from "../lib/estat-excel";
import { normalizeName, asMinutes } from "../lib/suimin-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/suimin-jikan-r3-todofuken"
);

const DAYS = ["1_週全体", "2_平日", "3_土曜日", "4_日曜日"] as const;
const SEXES = ["0_総数", "1_男", "2_女"] as const;
const DAY_LABELS = {
  "1_週全体": "週全体",
  "2_平日": "平日",
  "3_土曜日": "土曜日",
  "4_日曜日": "日曜日",
} as const;
const SEX_LABELS = { "0_総数": "総数", "1_男": "男", "2_女": "女" } as const;
const AREAS = [
  "00_全国",
  ...PREFECTURES.map((name, i) => `${String(i + 1).padStart(2, "0")}_${name}`),
];
const SLEEP_COL = 5; // c0=曜日 c1=地域 c2=人口集中地区区分 c3=男女 c4=推定人口 c5=01_睡眠

const rows = readSheetRows(
  path.join(datasetDir, "raw", "estat_2021_chiiki_68-1.xlsx"),
  "a068_1"
);

// 曜日×地域×男女(人口集中地区区分=総数)→ 分 の索引を構築
const sleep = new Map<string, number>();
for (const row of rows) {
  const day = String(row[0] ?? "");
  const area = String(row[1] ?? "");
  const did = String(row[2] ?? "");
  const sex = String(row[3] ?? "");
  if (!DAYS.includes(day as (typeof DAYS)[number])) continue;
  if (did !== "0_総数") continue;
  if (!SEXES.includes(sex as (typeof SEXES)[number])) continue;
  if (!AREAS.includes(area)) {
    throw new Error(`未知の地域区分ラベル: ${area}`);
  }
  const key = `${area}|${day}|${sex}`;
  if (sleep.has(key)) throw new Error(`重複行: ${key}`);
  sleep.set(key, asMinutes(row[SLEEP_COL], key));
}
const expected = AREAS.length * DAYS.length * SEXES.length;
if (sleep.size !== expected) {
  throw new Error(`セル数不一致: ${sleep.size} ≠ ${expected}`);
}

// 主要統計表15-1(総数)/15-2(男)/15-3(女)と週全体×48行を全数突合
const SHUYO = [
  { file: "estat_2021_shuyo_15-1.xlsx", sheet: "A01501", sex: "0_総数" },
  { file: "estat_2021_shuyo_15-2.xlsx", sheet: "A01502", sex: "1_男" },
  { file: "estat_2021_shuyo_15-3.xlsx", sheet: "A01503", sex: "2_女" },
] as const;
let crossChecked = 0;
for (const { file, sheet, sex } of SHUYO) {
  const sRows = readSheetRows(path.join(datasetDir, "raw", file), sheet);
  for (const row of sRows) {
    const name =
      normalizeName(row[7]) === "全国" ? "全国" : normalizeName(row[8]);
    if (
      name !== "全国" &&
      !PREFECTURES.includes(name as (typeof PREFECTURES)[number])
    )
      continue;
    const area =
      name === "全国"
        ? "00_全国"
        : AREAS[PREFECTURES.indexOf(name as (typeof PREFECTURES)[number]) + 1];
    const got = sleep.get(`${area}|1_週全体|${sex}`);
    const want = asMinutes(row[11], `${file} ${name}`);
    if (got !== want) {
      throw new Error(
        `主要統計表突合不一致: ${name} ${sex} 68-1=${got} ≠ ${file}=${want}`
      );
    }
    crossChecked++;
  }
}
if (crossChecked !== 48 * 3) {
  throw new Error(`主要統計表の突合件数 ${crossChecked} ≠ 144`);
}

// スポット錨(取得時の独立読み取り値)
const anchors: Array<[string, string, string, number]> = [
  ["00_全国", "1_週全体", "0_総数", 474],
  ["00_全国", "1_週全体", "1_男", 478],
  ["00_全国", "1_週全体", "2_女", 469],
  ["00_全国", "2_平日", "0_総数", 462],
  ["00_全国", "3_土曜日", "0_総数", 493],
  ["00_全国", "4_日曜日", "0_総数", 512],
  ["47_沖縄県", "1_週全体", "0_総数", 481],
  ["47_沖縄県", "1_週全体", "1_男", 484],
  ["47_沖縄県", "1_週全体", "2_女", 478],
  ["47_沖縄県", "2_平日", "0_総数", 470],
  ["47_沖縄県", "3_土曜日", "0_総数", 498],
  ["47_沖縄県", "4_日曜日", "0_総数", 522],
];
for (const [area, day, sex, want] of anchors) {
  const got = sleep.get(`${area}|${day}|${sex}`);
  if (got !== want)
    throw new Error(`錨不一致: ${area} ${day} ${sex} ${got} ≠ ${want}`);
}

const header = [
  "都道府県",
  ...DAYS.flatMap((d) => SEXES.map((s) => `${DAY_LABELS[d]}_${SEX_LABELS[s]}`)),
];
const out: string[][] = AREAS.map((area) => [
  area === "00_全国" ? "全国" : area.slice(3),
  ...DAYS.flatMap((d) =>
    SEXES.map((s) => String(sleep.get(`${area}|${d}|${s}`)!))
  ),
]);

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(
  `書き出し: ${out.length} 行(全国+47都道府県)× ${header.length - 1} 列`
);
console.log(
  `沖縄県: 週全体_総数=${sleep.get("47_沖縄県|1_週全体|0_総数")} / 全国=${sleep.get("00_全国|1_週全体|0_総数")}(主要統計表突合 ${crossChecked}/144)`
);
