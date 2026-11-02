/**
 * 新規学卒者の学歴別初任給 都道府県別(令和7年賃金構造基本統計調査)の変換。
 *
 * 入力: raw/chingin_r7_todofuken_hyo4_000040421199.xlsx(都道府県別第4表、
 *       男女計・産業計・企業規模計10人以上ブロック)
 * 出力: data.csv(全国+47都道府県の48行 × 学歴7区分)
 *
 * 検証:
 * - 全国行の7学歴すべてを全国第1表(学歴別7シート)の同区分値と全数突合
 * - 取得時に独立読み取りした錨(全国・沖縄の全学歴)と一致することを assert
 * - 値は公表 Excel の表示文字列(千円・小数第1位)。「-」(該当サンプルなし)は空欄
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";
import {
  GAKUREKI_SHIN,
  readHyo4,
  readZenkokuHyo1,
} from "../lib/shoninkyu-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/shoninkyu-r7-todofuken"
);

const { values } = readHyo4(
  path.join(datasetDir, "raw", "chingin_r7_todofuken_hyo4_000040421199.xlsx")
);

// 全国第1表(7シート)との全数突合
const hyo1Path = path.join(
  datasetDir,
  "raw",
  "chingin_r7_zenkoku_hyo1_000040420917.xlsx"
);
for (const g of GAKUREKI_SHIN) {
  const want = readZenkokuHyo1(hyo1Path, g, false);
  const got = values.get("全国")![g];
  if (got !== want) {
    throw new Error(`全国第1表突合不一致: ${g} 表4=${got} ≠ 第1表=${want}`);
  }
}

// スポット錨(取得時の独立読み取り値、raw/ACQUISITION.md §5)
const anchors: Array<
  [string, Partial<Record<(typeof GAKUREKI_SHIN)[number], string>>]
> = [
  [
    "全国",
    {
      学歴計: "248.3",
      高校: "207.3",
      専門学校: "230.7",
      "高専・短大": "235.5",
      大学: "262.3",
      大学院: "299.0",
    },
  ],
  [
    "沖縄県",
    {
      学歴計: "219.9",
      中学: "-",
      高校: "185.5",
      専門学校: "206.2",
      "高専・短大": "234.5",
      大学: "231.4",
      大学院: "299.8",
    },
  ],
];
for (const [area, expected] of anchors) {
  for (const [g, want] of Object.entries(expected)) {
    const got = values.get(area)![g as (typeof GAKUREKI_SHIN)[number]];
    if (got !== want)
      throw new Error(`錨不一致: ${area} ${g} ${got} ≠ ${want}`);
  }
}

// 大学の沖縄の順位(競技方式・値の大きい順、参考出力)
const daigaku = PREFECTURES.map((p) => ({ p, v: values.get(p)!.大学 })).filter(
  (e) => e.v !== "-"
);
const okinawa = Number(values.get("沖縄県")!.大学);
const rank = 1 + daigaku.filter((e) => Number(e.v) > okinawa).length;
const ties = daigaku.filter((e) => Number(e.v) === okinawa).length;

const header = ["都道府県", ...GAKUREKI_SHIN];
const out: string[][] = ["全国", ...PREFECTURES].map((area) => [
  area,
  ...GAKUREKI_SHIN.map((g) => {
    const v = values.get(area)![g];
    return v === "-" ? "" : v;
  }),
]);

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(
  `書き出し: ${out.length} 行(全国+47都道府県)× ${GAKUREKI_SHIN.length} 列`
);
console.log(
  `沖縄県 大学=${okinawa}(値の大きい順 ${rank}位${ties > 1 ? `タイ(${ties}県同値)` : ""}、掲載 ${daigaku.length} 県)/ 全国=${values.get("全国")!.大学}`
);
