/**
 * 平均睡眠時間の推移 沖縄県・全国(社会生活基本調査、平成13〜令和3年)の変換。
 *
 * 入力(すべて週全体・10歳以上・総平均時間):
 * - 2001: raw/estat_2001_shuyo_13.xls(シート「時間13総」、時.分表記)
 * - 2006: raw/estat_2006_shuyo_13.xls(シート「13表（総数）」、分)
 * - 2011: raw/estat_2011_shuyo_13.xls(同上)
 * - 2016: raw/estat_2016_shuyo_12-1.xls(シート A01201、分)
 * - 2021: raw/estat_2021_shuyo_15-1.xlsx(シート A01501、分)
 * 出力: data.csv(5行 × 年/沖縄/全国/備考)
 *
 * 検証:
 * - 2001 の時.分→分変換は 60進の分部 <60 を assert(hmmToMinutes)
 * - 2016 は地域編 表62-1(曜日×県×男女)と全国・沖縄の両方を突合
 * - 2021 は単年データセット(suimin-jikan-r3-todofuken)の data.csv と接続 assert
 * - 各年値を取得時の独立読み取り錨と突合
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv, toCsv } from "../lib/csv";
import { readSheetRows } from "../lib/estat-excel";
import { normalizeName, hmmToMinutes, asMinutes } from "../lib/suimin-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/suimin-jikan-keinen"
);
const raw = (f: string) => path.join(datasetDir, "raw", f);

/** 表13系(c0=県名・c2=睡眠)から 全国・沖縄県 の値を取る */
function fromHyo13(
  file: string,
  sheet: string,
  toMinutes: (v: unknown, label: string) => number
): { okinawa: number; zenkoku: number } {
  const rows = readSheetRows(raw(file), sheet);
  let okinawa: number | null = null;
  let zenkoku: number | null = null;
  let prefCount = 0;
  for (const row of rows) {
    const name = normalizeName(row[0]);
    if (name === "全国") {
      if (zenkoku !== null) throw new Error(`${file}: 全国行が重複`);
      zenkoku = toMinutes(row[2], `${file} 全国`);
    } else if (name !== "都道府県" && /^(北海道|.+[都道府県])$/.test(name)) {
      prefCount++;
      if (name === "沖縄県") {
        if (okinawa !== null) throw new Error(`${file}: 沖縄県行が重複`);
        okinawa = toMinutes(row[2], `${file} 沖縄県`);
      }
    }
  }
  if (okinawa === null || zenkoku === null || prefCount !== 47) {
    throw new Error(`${file}: 行の同定に失敗(都道府県 ${prefCount} 行)`);
  }
  return { okinawa, zenkoku };
}

const y2001 = fromHyo13("estat_2001_shuyo_13.xls", "時間13総", hmmToMinutes);
const y2006 = fromHyo13("estat_2006_shuyo_13.xls", "13表（総数）", asMinutes);
const y2011 = fromHyo13("estat_2011_shuyo_13.xls", "13表（総数）", asMinutes);

// 2016: 主要統計表12-1(c7=「全国」/c8=県名・c12=睡眠)
const y2016 = ((): { okinawa: number; zenkoku: number } => {
  const rows = readSheetRows(raw("estat_2016_shuyo_12-1.xls"), "A01201");
  let okinawa: number | null = null;
  let zenkoku: number | null = null;
  for (const row of rows) {
    if (normalizeName(row[7]) === "全国")
      zenkoku = asMinutes(row[12], "2016 全国");
    if (normalizeName(row[8]) === "沖縄県")
      okinawa = asMinutes(row[12], "2016 沖縄県");
  }
  if (okinawa === null || zenkoku === null)
    throw new Error("2016: 行の同定に失敗");
  return { okinawa, zenkoku };
})();

// 2016 クロスチェック: 地域編 表62-1(c1=行種別 D・c3=曜日・c4=地域・c5=DID・c6=男女・c13=睡眠)
{
  const rows = readSheetRows(raw("estat_2016_chiiki_62-1.xlsx"), "a062_1");
  const pick = (area: string): number => {
    const hit = rows.filter(
      (r) =>
        String(r[1]) === "D" &&
        String(r[3]) === "1_週全体" &&
        String(r[4]) === area &&
        String(r[5]) === "0_総数" &&
        String(r[6]) === "0_総数"
    );
    if (hit.length !== 1)
      throw new Error(`62-1: ${area} の行が ${hit.length} 件`);
    return asMinutes(hit[0][13], `62-1 ${area}`);
  };
  if (
    pick("00_全国") !== y2016.zenkoku ||
    pick("47_沖縄県") !== y2016.okinawa
  ) {
    throw new Error("2016: 主要統計表12-1 と地域編62-1 が不一致");
  }
}

// 2021: 主要統計表15-1(c7=「全国」/c8=県名・c11=睡眠)
const y2021 = ((): { okinawa: number; zenkoku: number } => {
  const rows = readSheetRows(raw("estat_2021_shuyo_15-1.xlsx"), "A01501");
  let okinawa: number | null = null;
  let zenkoku: number | null = null;
  for (const row of rows) {
    if (normalizeName(row[7]) === "全国")
      zenkoku = asMinutes(row[11], "2021 全国");
    if (normalizeName(row[8]) === "沖縄県")
      okinawa = asMinutes(row[11], "2021 沖縄県");
  }
  if (okinawa === null || zenkoku === null)
    throw new Error("2021: 行の同定に失敗");
  return { okinawa, zenkoku };
})();

// 取得時の独立読み取り錨との突合
const anchors: Array<
  [string, { okinawa: number; zenkoku: number }, number, number]
> = [
  ["2001", y2001, 471, 465],
  ["2006", y2006, 472, 462],
  ["2011", y2011, 462, 462],
  ["2016", y2016, 461, 460],
  ["2021", y2021, 481, 474],
];
for (const [year, got, okinawa, zenkoku] of anchors) {
  if (got.okinawa !== okinawa || got.zenkoku !== zenkoku) {
    throw new Error(
      `錨不一致: ${year} 沖縄 ${got.okinawa}≠${okinawa} または 全国 ${got.zenkoku}≠${zenkoku}`
    );
  }
}

// 単年データセットとの接続 assert(2021 週全体_総数)
{
  const csv = parseCsv(
    fs.readFileSync(
      path.resolve(
        process.cwd(),
        "data/datasets/suimin-jikan-r3-todofuken/data.csv"
      ),
      "utf-8"
    )
  );
  const col = csv[0].indexOf("週全体_総数");
  const rowOf = (name: string) => csv.find((r) => r[0] === name);
  if (
    col === -1 ||
    Number(rowOf("沖縄県")![col]) !== y2021.okinawa ||
    Number(rowOf("全国")![col]) !== y2021.zenkoku
  ) {
    throw new Error(
      "単年データセット(suimin-jikan-r3-todofuken)との接続が不一致"
    );
  }
}

const header = ["年", "平均睡眠時間_沖縄", "平均睡眠時間_全国", "備考"];
const out: string[][] = [
  ["平成13年", String(y2001.okinawa), String(y2001.zenkoku), ""],
  ["平成18年", String(y2006.okinawa), String(y2006.zenkoku), ""],
  [
    "平成23年",
    String(y2011.okinawa),
    String(y2011.zenkoku),
    "東日本大震災の影響で岩手・宮城・福島県の一部地域を除いて調査",
  ],
  [
    "平成28年",
    String(y2016.okinawa),
    String(y2016.zenkoku),
    "熊本地震の影響で熊本県の一部地域を除いて調査",
  ],
  [
    "令和3年",
    String(y2021.okinawa),
    String(y2021.zenkoku),
    "新型コロナウイルス感染症の緊急事態宣言等の解除直後(2021年10月)の調査",
  ],
];

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`書き出し: ${out.length} 行(平成13〜令和3年・5時点)`);
console.log(
  `沖縄: ${out.map((r) => r[1]).join("→")} / 全国: ${out.map((r) => r[2]).join("→")}`
);
