/**
 * 家にある本の冊数(蔵書量) 47都道府県(令和7年度 全国学力・学習状況調査 児童生徒質問調査)の変換。
 *
 * 入力: raw/NN[p|m]_25a.xlsx(47都道府県×児童/生徒の回答結果集計)+
 *       raw/25[p|m]_402.xlsx(全国−公立の回答結果集計)
 * 出力: data.csv(全国（公立）+47都道府県の48行 × 小学校/中学校×6区分の12列)
 *
 * 検証:
 * - 各都道府県ファイル4段目の全国(公立)割合を全国版と全数突合(その他・無回答含む)
 * - 主コンテキストで独立読み取りした錨(沖縄・全国×両学年)と一致することを assert
 * - 各行で 選択肢+その他+無回答 の合計が 100% 近傍であることを検算
 * - 県名(B3/B8)とファイル名の都道府県コードの対応を assert
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";
import {
  assertPctSum,
  findQuestion,
  readShitsumonFile,
  type QuestionBlock,
} from "../lib/gakuryoku-shitsumon-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/katei-zosho-r7-todofuken"
);
const rawDir = path.join(datasetDir, "raw");

const QUESTION = "あなたの家には、およそどれくらいの本がありますか";
const CATEGORIES = [
  "0〜10冊",
  "11〜25冊",
  "26〜100冊",
  "101〜200冊",
  "201〜500冊",
  "501冊以上",
];
const GRADES = [
  { label: "小学校", fileCode: "p", nationalFile: "25p_402.xlsx" },
  { label: "中学校", fileCode: "m", nationalFile: "25m_402.xlsx" },
] as const;

// 主コンテキストでの独立読み取り錨(raw: true の数値読みによる別経路、2026-07-31)
const ANCHORS: Record<string, Record<string, string[]>> = {
  小学校: {
    沖縄県: ["23.4", "25.6", "29.7", "12.6", "6.0", "2.7"],
    全国: ["15.1", "21.7", "32.2", "16.4", "10.2", "4.3"],
  },
  中学校: {
    沖縄県: ["27.1", "24.5", "27.7", "10.5", "5.5", "1.7"],
    全国: ["17.4", "21.5", "30.8", "14.8", "9.4", "3.0"],
  },
};

function pickZosho(block: QuestionBlock, where: string): string[] {
  if (block.pct.length !== CATEGORIES.length) {
    throw new Error(`蔵書の選択肢数が想定外: ${where} ${block.pct.length}`);
  }
  assertPctSum(block, where);
  return block.pct;
}

const values = new Map<string, Record<string, string[]>>(); // area -> grade -> 6区分
let matched = 0;

for (const grade of GRADES) {
  // 全国版
  const national = readShitsumonFile(
    path.join(rawDir, grade.nationalFile),
    "national"
  );
  if (national.grade !== grade.label)
    throw new Error(`全国版の学年不一致: ${grade.nationalFile}`);
  const natBlock = findQuestion(national, QUESTION);
  const natPct = pickZosho(natBlock, `${grade.nationalFile}`);
  values.set("全国（公立）", {
    ...values.get("全国（公立）"),
    [grade.label]: natPct,
  });

  // 47都道府県版
  for (let code = 1; code <= 47; code++) {
    const nn = String(code).padStart(2, "0");
    const file = `${nn}${grade.fileCode}_25a.xlsx`;
    const parsed = readShitsumonFile(path.join(rawDir, file), "pref");
    if (parsed.grade !== grade.label) throw new Error(`学年不一致: ${file}`);
    if (parsed.area !== PREFECTURES[code - 1]) {
      throw new Error(
        `県名とコード不一致: ${file} "${parsed.area}" ≠ "${PREFECTURES[code - 1]}"`
      );
    }
    const block = findQuestion(parsed, QUESTION);
    const pct = pickZosho(block, file);

    // 4段目の全国(公立)割合を全国版と突合
    const nat = [
      ...block.nationalPct!,
      block.nationalOtherPct!,
      block.nationalNoAnswerPct!,
    ];
    const want = [...natBlock.pct, natBlock.otherPct, natBlock.noAnswerPct];
    for (let i = 0; i < want.length; i++) {
      if (nat[i] !== want[i]) {
        throw new Error(
          `全国突合不一致: ${file} ${block.number} 列${i + 1} ${nat[i]} ≠ ${want[i]}`
        );
      }
      matched++;
    }

    values.set(parsed.area, { ...values.get(parsed.area), [grade.label]: pct });
  }
}

// 錨との突合
for (const [grade, areas] of Object.entries(ANCHORS)) {
  for (const [area, expected] of Object.entries(areas)) {
    const key = area === "全国" ? "全国（公立）" : area;
    const got = values.get(key)![grade];
    if (got.join(",") !== expected.join(",")) {
      throw new Error(`錨不一致: ${area} ${grade} [${got}] ≠ [${expected}]`);
    }
  }
}

// 小学校 0〜10冊の沖縄の順位(競技方式・値の大きい順、参考出力)
const okinawa = Number(values.get("沖縄県")!.小学校[0]);
const all = PREFECTURES.map((p) => Number(values.get(p)!.小学校[0]));
const rank = 1 + all.filter((v) => v > okinawa).length;
const ties = all.filter((v) => v === okinawa).length;

const header = [
  "都道府県",
  ...GRADES.flatMap((g) => CATEGORIES.map((c) => `${g.label}_${c}`)),
];
const out: string[][] = ["全国（公立）", ...PREFECTURES].map((area) => [
  area,
  ...GRADES.flatMap((g) => values.get(area)![g.label]),
]);

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(
  `書き出し: ${out.length} 行(全国（公立）+47都道府県)× ${header.length - 1} 列`
);
console.log(`全国突合: ${matched} セル一致(47県×2学年×8列)`);
console.log(
  `沖縄県 小学校_0〜10冊=${okinawa}%(値の大きい順 ${rank}位${ties > 1 ? `タイ(${ties}県同値)` : ""})/ 全国=${values.get("全国（公立）")!.小学校[0]}%`
);
