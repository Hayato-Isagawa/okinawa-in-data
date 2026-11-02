/**
 * 地域別最低賃金 都道府県別(令和8年度)の変換スクリプト。
 *
 * 入力: raw/r8_chiikibetsu_saitei_chingin_zenkoku_ichiran.txt
 *       (「令和8年度 地域別最低賃金 全国一覧」PDF の pdftotext -layout 出力)
 * 出力: data.csv(47都道府県 + 全国加重平均 = 48行)
 *
 * 抽出規則:
 * - 1行 = 都道府県名 / 時間額 / (改定前額) / 引上げ額 / 引上げ率 / 発効日
 * - pdftotext の出力は名称が「青   森」のように分かち書きされるため空白を除去し、
 *   コード順の位置と正式名称との前方一致で確認する(原表に都道府県コードは無い)
 * - 最終行の「全国加重平均」は基準行として最後に置く。適用労働者数による加重平均で、
 *   47都道府県の単純平均ではない(発効日は原表で「-」のため空欄)
 * - 発効日は原表の和暦表記のまま収録する(都道府県ごとに分散しており、
 *   「令和8年度の額」は発効日ではなく改定の回次を指す)
 * - R7 の一覧と違い、時間額の見出しは「答申された改定額」、引上げ率は「5.2%」と % 付き
 * - 答申状況(別紙)の PDF と全 48 行の額・改定前額・引上げ額・発効日を突き合わせる
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/saitei-chingin-r8-todofuken"
);

const NATIONAL = "全国加重平均";
const text = fs.readFileSync(
  path.join(
    datasetDir,
    "raw",
    "r8_chiikibetsu_saitei_chingin_zenkoku_ichiran.txt"
  ),
  "utf8"
);

if (!text.includes("令和8年度 地域別最低賃金 全国一覧")) {
  throw new Error("表題が「令和8年度 地域別最低賃金 全国一覧」ではありません");
}

const num = (s: string) => Number(s.replace(/,/g, ""));
/** 「青   森」「全国加重平均」→ 空白を除いた名称 */
const squash = (s: string) => s.replace(/[\s　]+/g, "");

type Row = {
  name: string;
  amount: number;
  before: number;
  raise: number;
  rate: string;
  effective: string;
};

const parsed: Row[] = [];
for (const line of text.split(/\r?\n/)) {
  const m =
    /^\s*(\S[^0-9]*?)\s+([\d,]+)\s+[（(]\s*([\d,]+)\s*[)）]\s+([\d,]+)\s+([\d.]+)%?\s+(\S+)\s*$/.exec(
      line
    );
  if (!m) continue;
  parsed.push({
    name: squash(m[1]),
    amount: num(m[2]),
    before: num(m[3]),
    raise: num(m[4]),
    rate: m[5],
    effective: m[6] === "-" ? "" : m[6],
  });
}

const prefs = parsed.filter((r) => r.name !== NATIONAL);
const national = parsed.find((r) => r.name === NATIONAL);
if (!national) throw new Error(`${NATIONAL} の行がありません`);
if (prefs.length !== 47)
  throw new Error(`都道府県が ${prefs.length} 行(47 でない)`);

prefs.forEach((r, i) => {
  // 原表の名称は接尾辞なし(「沖縄」「東京」)。正式名称との前方一致で確認する
  if (!PREFECTURES[i].startsWith(r.name)) {
    throw new Error(`${i + 1} 番目の名称 "${r.name}" ≠ ${PREFECTURES[i]}`);
  }
});

for (const r of [...prefs, national]) {
  // 引上げ額 = 時間額 − 改定前額
  if (r.amount - r.before !== r.raise) {
    throw new Error(
      `${r.name}: ${r.amount} − ${r.before} ≠ 引上げ額 ${r.raise}`
    );
  }
  // 引上げ率 = 引上げ額 ÷ 改定前額 × 100(小数第1位)
  const recomputed = (Math.round((r.raise / r.before) * 1000) / 10).toFixed(1);
  if (recomputed !== r.rate) {
    throw new Error(
      `${r.name}: 引上げ率の再計算 ${recomputed} ≠ 公表値 ${r.rate}`
    );
  }
}

// 全国加重平均は適用労働者数による加重平均であり、47都道府県の単純平均とは一致しない
const simpleMean = prefs.reduce((a, r) => a + r.amount, 0) / prefs.length;
if (Math.round(simpleMean) === national.amount) {
  throw new Error(
    "全国加重平均が単純平均と一致しています(原表の読み違いの可能性)"
  );
}

// 一次資料のアンカー(取得時の独立読み取りと一致すること)
const anchors: Array<[string, number, string]> = [
  ["沖縄県", 1086, "令和8年12月2日"],
  ["東京都", 1280, "令和8年10月1日"],
  [NATIONAL, 1177, ""],
];
for (const [name, amount, effective] of anchors) {
  const row = [...prefs, national].find((r, i) =>
    name === NATIONAL ? r.name === NATIONAL : PREFECTURES[i] === name
  );
  if (!row || row.amount !== amount || row.effective !== effective) {
    throw new Error(`${name}: アンカー不一致 ${JSON.stringify(row)}`);
  }
}

// 答申状況(別紙。ランク・目安額・目安差額つき)と全行を突き合わせる
const jokyo = fs.readFileSync(
  path.join(
    datasetDir,
    "raw",
    "r8_chiikibetsu_saitei_chingin_toushin_jokyo.txt"
  ),
  "utf8"
);
const jokyoRows = new Map<string, [number, number, number, string]>();
for (const line of jokyo.split(/\r?\n/)) {
  const m =
    /^\s*(\S[^0-9A-Z]*?)\s+(?:[ABC]\s+\d+\s+)?([\d,]+)\s+[（(]\s*([\d,]+)\s*[)）]\s+([\d,]+)\s+(?:\S+\s+)?(令和\S+|-)\s*$/.exec(
      line
    );
  if (!m) continue;
  jokyoRows.set(squash(m[1]), [
    num(m[2]),
    num(m[3]),
    num(m[4]),
    m[5] === "-" ? "" : m[5],
  ]);
}
for (const r of [...prefs, national]) {
  const j = jokyoRows.get(r.name);
  if (!j) throw new Error(`答申状況に ${r.name} の行がありません`);
  const [amount, before, raise, effective] = j;
  if (
    amount !== r.amount ||
    before !== r.before ||
    raise !== r.raise ||
    effective !== r.effective
  ) {
    throw new Error(
      `${r.name}: 一覧 ${JSON.stringify(r)} ≠ 答申状況 ${JSON.stringify(j)}`
    );
  }
}
if (jokyoRows.size !== 48) {
  throw new Error(`答申状況の行数が ${jokyoRows.size}(48 でない)`);
}

const header = [
  "都道府県",
  "最低賃金(時間額)",
  "改定前の額",
  "引上げ額",
  "引上げ率",
  "発効日",
];
const out = [
  ...prefs.map((r, i) => [
    PREFECTURES[i],
    String(r.amount),
    String(r.before),
    String(r.raise),
    r.rate,
    r.effective,
  ]),
  [
    NATIONAL,
    String(national.amount),
    String(national.before),
    String(national.raise),
    national.rate,
    "",
  ],
];

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
const okinawa = out.find((r) => r[0] === "沖縄県")!;
const min = Math.min(...prefs.map((r) => r.amount));
const lowest = prefs
  .map((r, i) => [PREFECTURES[i], r.amount] as const)
  .filter(([, a]) => a === min);
console.log(
  `  沖縄県: ${okinawa[1]}円(改定前 ${okinawa[2]}円・${okinawa[4]}%・${okinawa[5]})`
);
console.log(
  `  全国加重平均: ${national.amount}円 / 47都道府県の単純平均: ${simpleMean.toFixed(2)}円`
);
console.log(`  最低額 ${min}円: ${lowest.map(([n]) => n).join("・")}`);
const dates = [...new Set(prefs.map((r) => r.effective))];
console.log(`  発効日 ${dates.length} 種類 / 答申状況と 48 行一致`);
