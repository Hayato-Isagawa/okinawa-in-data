/**
 * 朝食・就寝・起床の生活習慣 47都道府県(令和7年度 全国学力・学習状況調査 児童生徒質問調査)の変換。
 *
 * 入力: raw/NN[p|m]_25a.xlsx(47都道府県×児童/生徒の回答結果集計)+
 *       raw/25[p|m]_402.xlsx(全国−公立の回答結果集計)
 * 出力: data.csv(全国（公立）+47都道府県の48行 × 小学校/中学校×3質問の6列)。
 *       値は各質問に「している」(選択肢1)と回答した割合のみ収録
 *
 * 検証:
 * - 各都道府県ファイル4段目の全国(公立)割合を全国版と全数突合(4選択肢+その他・無回答)
 * - 主コンテキストで独立読み取りした錨(沖縄・全国×両学年×3質問)と一致することを assert
 * - 各質問で 選択肢+その他+無回答 の合計が 100% 近傍であることを検算
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
} from "../lib/gakuryoku-shitsumon-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/seikatsu-shukan-r7-todofuken"
);
// raw は姉妹データセット katei-zosho-r7-todofuken と共有(raw/README.md 参照)
const rawDir = path.resolve(
  process.cwd(),
  "data/datasets/katei-zosho-r7-todofuken/raw"
);

const QUESTIONS = [
  { column: "朝食", text: "朝食を毎日食べていますか" },
  { column: "就寝時刻", text: "毎日、同じくらいの時刻に寝ていますか" },
  { column: "起床時刻", text: "毎日、同じくらいの時刻に起きていますか" },
] as const;
const OPTION_COUNT = 4; // している/どちらかといえば、している/あまりしていない/全くしていない
const GRADES = [
  { label: "小学校", fileCode: "p", nationalFile: "25p_402.xlsx" },
  { label: "中学校", fileCode: "m", nationalFile: "25m_402.xlsx" },
] as const;

// 主コンテキストでの独立読み取り錨(raw: true の数値読みによる別経路、2026-07-31)
// [朝食, 就寝時刻, 起床時刻] の「している」割合
const ANCHORS: Record<string, Record<string, string[]>> = {
  小学校: {
    沖縄県: ["81.7", "37.9", "52.6"],
    全国: ["83.3", "38.9", "55.6"],
  },
  中学校: {
    沖縄県: ["79.1", "37.3", "58.3"],
    全国: ["78.7", "34.0", "54.7"],
  },
};

const values = new Map<string, Record<string, string[]>>(); // area -> grade -> 3質問の選択肢1
let matched = 0;

for (const grade of GRADES) {
  const national = readShitsumonFile(
    path.join(rawDir, grade.nationalFile),
    "national"
  );
  if (national.grade !== grade.label)
    throw new Error(`全国版の学年不一致: ${grade.nationalFile}`);
  const natBlocks = QUESTIONS.map((q) => {
    const b = findQuestion(national, q.text);
    if (b.pct.length !== OPTION_COUNT) {
      throw new Error(
        `選択肢数が想定外: ${grade.nationalFile} ${q.column} ${b.pct.length}`
      );
    }
    assertPctSum(b, `${grade.nationalFile} ${q.column}`);
    return b;
  });
  values.set("全国（公立）", {
    ...values.get("全国（公立）"),
    [grade.label]: natBlocks.map((b) => b.pct[0]),
  });

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
    const own: string[] = [];
    QUESTIONS.forEach((q, qi) => {
      const block = findQuestion(parsed, q.text);
      if (block.pct.length !== OPTION_COUNT) {
        throw new Error(
          `選択肢数が想定外: ${file} ${q.column} ${block.pct.length}`
        );
      }
      assertPctSum(block, `${file} ${q.column}`);

      const natBlock = natBlocks[qi];
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
      own.push(block.pct[0]);
    });
    values.set(parsed.area, { ...values.get(parsed.area), [grade.label]: own });
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

// 小学校 起床時刻の沖縄の順位(競技方式・値の大きい順、参考出力)
const okinawa = Number(values.get("沖縄県")!.小学校[2]);
const all = PREFECTURES.map((p) => Number(values.get(p)!.小学校[2]));
const rank = 1 + all.filter((v) => v > okinawa).length;
const ties = all.filter((v) => v === okinawa).length;

const header = [
  "都道府県",
  ...GRADES.flatMap((g) => QUESTIONS.map((q) => `${g.label}_${q.column}`)),
];
const out: string[][] = ["全国（公立）", ...PREFECTURES].map((area) => [
  area,
  ...GRADES.flatMap((g) => values.get(area)![g.label]),
]);

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(
  `書き出し: ${out.length} 行(全国（公立）+47都道府県)× ${header.length - 1} 列`
);
console.log(`全国突合: ${matched} セル一致(47県×2学年×3質問×6列)`);
console.log(
  `沖縄県 小学校_起床時刻=${okinawa}%(値の大きい順 ${rank}位${ties > 1 ? `タイ(${ties}県同値)` : ""})/ 全国=${values.get("全国（公立）")!.小学校[2]}%`
);
