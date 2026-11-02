/**
 * 学校保健統計調査 — 12歳のむし歯・裸眼視力の推移(沖縄県・全国、平成24〜令和7年度)。
 *
 * 入力: raw/ の各年度 表8/表9(都道府県別 年齢別 疾病・異常被患率等)Excel 14ファイル
 * 出力: data.csv(14行 × 沖縄県・全国の3指標 + 備考)
 *
 * 抽出規則:
 * - 12歳・計(男女計)シートのみ(都道府県別は年齢別のみの公表)。12歳は
 *   永久歯の1人当り平均むし歯（う歯）等数が公表される唯一の年齢
 * - 値は公表 Excel の表示文字列をそのまま保持(全国=小数第2位・県=第1位)
 * - 令和2〜5年度は「調査時期の異なる数値を含んでいる影響があるため、他の
 *   年度の数値と比較はできない」(令和7年度公表資料の注記)→ user 決定
 *   (2026-07-20)により全年収録した上で備考列に明示する
 * 検証:
 * - ヘッダ文言 assert で新旧レイアウトの列ズレを検知(lib/gakko-hoken-excel)
 * - 各年・各行で 処置完了者+未処置歯のある者 ≒ むし歯計(独立丸め許容差)
 * - 沖縄・全国の6値がすべて非空(秘匿 X が現れたら throw で気づく)
 * - 令和7年度の値を単年データセット gakko-hoken-r7-todofuken の data.csv と
 *   一致 assert(系列の接続確認)
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import {
  assertMushibaIdentity,
  extractRow,
  load12SaiKei,
  type Hoken12Row,
} from "../lib/gakko-hoken-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/gakko-hoken-keinen"
);

const GAP_NOTE = "調査時期の影響により他年度と比較不可(文部科学省注記)";
const YEARS: Array<{ label: string; file: string; gap: boolean }> = [
  { label: "平成24年度", file: "h24_hyo9_pref_shippei.xls", gap: false },
  { label: "平成25年度", file: "h25_hyo9_pref_shippei.xlsx", gap: false },
  { label: "平成26年度", file: "h26_hyo9_pref_shippei.xlsx", gap: false },
  { label: "平成27年度", file: "h27_hyo9_pref_shippei.xlsx", gap: false },
  { label: "平成28年度", file: "h28_hyo8_pref_shippei.xlsx", gap: false },
  { label: "平成29年度", file: "h29_hyo8_pref_shippei.xlsx", gap: false },
  { label: "平成30年度", file: "h30_hyo8_pref_shippei.xlsx", gap: false },
  { label: "令和元年度", file: "r1_hyo8_pref_shippei.xlsx", gap: false },
  { label: "令和2年度", file: "r2_hyo8_pref_shippei.xlsx", gap: true },
  { label: "令和3年度", file: "r3_hyo8_pref_shippei.xlsx", gap: true },
  { label: "令和4年度", file: "r4_hyo8_pref_shippei.xlsx", gap: true },
  { label: "令和5年度", file: "r5_hyo8_pref_shippei.xlsx", gap: true },
  { label: "令和6年度", file: "r6_hyo8_pref_shippei.xlsx", gap: false },
  { label: "令和7年度", file: "r7_hyo8_pref_shippei.xlsx", gap: false },
];

const requireAll = (label: string, v: Hoken12Row) => {
  for (const [key, value] of Object.entries(v)) {
    if (value === "") throw new Error(`${label}: ${key} が秘匿/空です`);
  }
};

const out = YEARS.map((y) => {
  const sheet = load12SaiKei(path.join(datasetDir, "raw", y.file));
  const oki = extractRow(sheet, "沖縄県");
  const nat = extractRow(sheet, "全国");
  requireAll(`${y.label} 沖縄県`, oki);
  requireAll(`${y.label} 全国`, nat);
  assertMushibaIdentity(`${y.label} 沖縄県`, oki, 0.151);
  assertMushibaIdentity(`${y.label} 全国`, nat, 0.0151);
  return [
    y.label,
    oki.mushibaKei,
    nat.mushibaKei,
    oki.raganKei,
    nat.raganKei,
    oki.dmfKei,
    nat.dmfKei,
    y.gap ? GAP_NOTE : "",
  ];
});

// 系列の接続確認: 令和7年度の値を単年データセットと突き合わせる
const single = fs
  .readFileSync(
    path.resolve(
      process.cwd(),
      "data/datasets/gakko-hoken-r7-todofuken/data.csv"
    ),
    "utf-8"
  )
  .trim()
  .split("\n")
  .map((l) => l.split(","));
const okiSingle = single.find((r) => r[0] === "沖縄県")!;
const natSingle = single.find((r) => r[0] === "全国")!;
const r7 = out[out.length - 1];
const checks: [string, string, string][] = [
  ["沖縄 むし歯", r7[1], okiSingle[1]],
  ["全国 むし歯", r7[2], natSingle[1]],
  ["沖縄 裸眼", r7[3], okiSingle[5]],
  ["全国 裸眼", r7[4], natSingle[5]],
  ["沖縄 平均むし歯等数", r7[5], okiSingle[4]],
  ["全国 平均むし歯等数", r7[6], natSingle[4]],
];
for (const [name, keinen, singleVal] of checks) {
  if (keinen !== singleVal) {
    throw new Error(
      `系列接続の不一致 ${name}: 経年 ${keinen} ≠ 単年 ${singleVal}`
    );
  }
}

fs.writeFileSync(
  path.join(datasetDir, "data.csv"),
  toCsv([
    [
      "年度",
      "むし歯（う歯）_沖縄",
      "むし歯（う歯）_全国",
      "裸眼視力1.0未満_沖縄",
      "裸眼視力1.0未満_全国",
      "平均むし歯等数_沖縄",
      "平均むし歯等数_全国",
      "備考",
    ],
    ...out,
  ])
);
console.log(
  `書き出し: ${out.length} 行(平成24〜令和7年度、比較不可注記 ${out.filter((r) => r[7] !== "").length} 行)`
);
console.log(
  `平成24: 沖縄むし歯${out[0][1]}/全国${out[0][2]} → 令和7: 沖縄${r7[1]}/全国${r7[2]}`
);
