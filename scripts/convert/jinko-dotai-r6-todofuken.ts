/**
 * 人口動態総覧(率) 47都道府県(令和6年人口動態統計 確定数)の変換。
 *
 * 入力: raw/mhlw_r06_toukeihyo.xlsx(第５表「人口動態総覧(率), 都道府県別」)
 * 出力: data.csv(全国+47都道府県の48行 × 6指標)
 *
 * 検証:
 * - 合計特殊出生率の全 48 値を、e-Stat 表4-5(再集計反映済みの権威ある系列)の
 *   2024 年列と全数突合(raw/estat_4-5_tfr_crosscheck.md の転記)
 * - 主コンテキストで独立読み取りした錨(全国・沖縄県の全6指標)と一致することを assert
 * - 都道府県の並びと指標の列見出しはパーサ側で assert(scripts/lib/jinko-dotai-excel.ts)
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";
import { readSoranRitsu, SORAN_METRICS } from "../lib/jinko-dotai-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/jinko-dotai-r6-todofuken"
);
const YEAR = 2024;

const table = readSoranRitsu(
  path.join(datasetDir, "raw", "mhlw_r06_toukeihyo.xlsx"),
  YEAR
);

// e-Stat 表4-5「都道府県別にみた年次別合計特殊出生率」2024年列(raw/estat_4-5_tfr_crosscheck.md)
const ESTAT_TFR_2024: Record<string, string> = {
  全国: "1.15",
  北海道: "1.01",
  青森県: "1.14",
  岩手県: "1.09",
  宮城県: "1.00",
  秋田県: "1.04",
  山形県: "1.17",
  福島県: "1.15",
  茨城県: "1.16",
  栃木県: "1.15",
  群馬県: "1.20",
  埼玉県: "1.09",
  千葉県: "1.09",
  東京都: "0.96",
  神奈川県: "1.08",
  新潟県: "1.14",
  富山県: "1.29",
  石川県: "1.23",
  福井県: "1.46",
  山梨県: "1.26",
  長野県: "1.30",
  岐阜県: "1.27",
  静岡県: "1.19",
  愛知県: "1.22",
  三重県: "1.24",
  滋賀県: "1.32",
  京都府: "1.05",
  大阪府: "1.14",
  兵庫県: "1.23",
  奈良県: "1.19",
  和歌山県: "1.24",
  鳥取県: "1.43",
  島根県: "1.43",
  岡山県: "1.27",
  広島県: "1.29",
  山口県: "1.36",
  徳島県: "1.32",
  香川県: "1.36",
  愛媛県: "1.28",
  高知県: "1.25",
  福岡県: "1.22",
  佐賀県: "1.41",
  長崎県: "1.39",
  熊本県: "1.39",
  大分県: "1.37",
  宮崎県: "1.43",
  鹿児島県: "1.38",
  沖縄県: "1.54",
};

let crosschecked = 0;
for (const [area, want] of Object.entries(ESTAT_TFR_2024)) {
  const got = table.values.get(area)!.合計特殊出生率;
  if (got !== want) {
    throw new Error(
      `e-Stat 4-5 突合不一致: ${area} 統計表=${got} ≠ e-Stat=${want}`
    );
  }
  crosschecked++;
}

// 主コンテキストでの独立読み取り錨(2026-08-01、第５表を別コードで読んだ値)
const ANCHORS: Record<string, Record<string, string>> = {
  全国: {
    出生率: "5.7",
    死亡率: "13.3",
    自然増減率: "-7.6",
    婚姻率: "4.0",
    離婚率: "1.55",
    合計特殊出生率: "1.15",
  },
  沖縄県: {
    出生率: "8.2",
    死亡率: "10.8",
    自然増減率: "-2.6",
    婚姻率: "4.4",
    離婚率: "2.24",
    合計特殊出生率: "1.54",
  },
};
for (const [area, expected] of Object.entries(ANCHORS)) {
  for (const [m, want] of Object.entries(expected)) {
    const got = table.values.get(area)![m as (typeof SORAN_METRICS)[number]];
    if (got !== want)
      throw new Error(`錨不一致: ${area} ${m} ${got} ≠ ${want}`);
  }
}

/** 競技方式の順位(値の大きい順) */
function rankOf(metric: (typeof SORAN_METRICS)[number]): {
  rank: number;
  ties: number;
  value: number;
} {
  const okinawa = Number(table.values.get("沖縄県")![metric]);
  const all = PREFECTURES.map((p) => Number(table.values.get(p)![metric]));
  return {
    rank: 1 + all.filter((v) => v > okinawa).length,
    ties: all.filter((v) => v === okinawa).length,
    value: okinawa,
  };
}

const header = ["都道府県", ...SORAN_METRICS];
const out: string[][] = ["全国", ...PREFECTURES].map((area) => [
  area,
  ...SORAN_METRICS.map((m) => table.values.get(area)![m]),
]);

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(
  `書き出し: ${out.length} 行(全国+47都道府県)× ${SORAN_METRICS.length} 指標(シート ${table.sheetName})`
);
console.log(
  `e-Stat 4-5 突合: ${crosschecked} 値一致(合計特殊出生率・全 48 area)`
);
for (const m of ["合計特殊出生率", "出生率", "離婚率"] as const) {
  const r = rankOf(m);
  console.log(
    `沖縄県 ${m}=${r.value}(値の大きい順 ${r.rank}位${r.ties > 1 ? `タイ(${r.ties}県同値)` : ""})/ 全国=${table.values.get("全国")![m]}`
  );
}
