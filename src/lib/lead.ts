/**
 * データセット詳細ページの「このデータのポイント」リード文を
 * ビルド時にデータから自動生成する(Data USA 方式)。
 * 数値・順位・傾向はすべて CSV から導出し、手書きの数値を置かない。
 * 形が合わないデータセットでは null を返し、何も表示しない。
 */
import type { DatasetMeta } from "../../data/schema/dataset-meta";
import { PREFECTURES } from "../../scripts/lib/prefectures";
import { getAreas } from "./areas";
import { sortRateClasses } from "./map";

/**
 * 全国基準行の探索順。データセットごとに全国行の呼称が違う(統計の原表記に合わせている)ため
 * 候補を並べて先に見つかったものを使う。**この配列が単一ソース**で、FV の読み取り行
 * (indicators.ts)とデータセットページのランキング(datasets/[id]/index.astro)も同じものを使う。
 * かつて lead.ts だけが 2 件しか見ておらず、同じデータで全国比較が出るページと出ないページが
 * 生まれていた
 */
export const REFERENCE_ROW_NAMES = [
  "全国（公立）",
  "全国",
  "全国加重平均",
  "全県計",
  "合計",
  "計",
] as const;

/** 行の集合から全国基準行を探す(REFERENCE_ROW_NAMES の順で最初に一致したもの) */
export function findReferenceRow(rows: string[][]): string[] | undefined {
  for (const name of REFERENCE_ROW_NAMES) {
    const row = rows.find((r) => r[0] === name);
    if (row) return row;
  }
  return undefined;
}

export function generateLead(
  meta: DatasetMeta,
  header: string[],
  rows: string[][]
): string | null {
  if (meta.lead === false) return null;
  // spatial.level は「都道府県」「都道府県・全国」のように表記に幅がある自由文のため、
  // 完全一致で分岐すると取りこぼす(かつて「都道府県・全国」の 13 本にリード文が出ず、
  // trendLead は該当レベルが 1 本も無いまま呼ばれていなかった)
  const level = meta.spatial.level;
  if (meta.map) {
    if (level.startsWith("市町村")) return municipalLead(meta, header, rows);
    if (level.startsWith("都道府県")) return prefectureLead(meta, header, rows);
    return null;
  }
  // 地図を持たない経年データセット(先頭列が年・年度)は推移を要約する
  if (/^(年|年度|調査年|卒業年)$/.test(header[0])) {
    return trendLead(meta, header, rows);
  }
  return null;
}

/** 都道府県データ: 沖縄の値・全国比・47都道府県中の位置 */
function prefectureLead(
  meta: DatasetMeta,
  header: string[],
  rows: string[][]
): string | null {
  const col = meta.map!.column;
  const colIdx = header.indexOf(col);
  const unit = unitOf(meta, col);
  // 列名が「週全体_総数」「令和4年度」のように単独で意味の通らないデータセットは
  // meta.map.label を文中の呼び名に使う
  const label = meta.map!.label ?? col;
  const okinawa = rows.find((r) => r[0] === "沖縄県");
  const reference = findReferenceRow(rows);
  if (!okinawa || colIdx === -1) return null;

  const prefSet = new Set<string>(PREFECTURES);
  const values = rows
    .filter((r) => prefSet.has(r[0]) && r[colIdx] !== "")
    .map((r) => Number(r[colIdx]))
    .sort((a, b) => b - a);
  const rank = values.indexOf(Number(okinawa[colIdx])) + 1;

  const parts = [
    `沖縄県の${label}は${okinawa[colIdx]}${unit}`,
    reference ? `(${refLabel(reference[0])}は${reference[colIdx]}${unit})` : "",
    `で、47都道府県の中で高い方から${rank}番目です。`,
  ];

  // 数値列すべてで沖縄が基準(全国)を同方向に上回る/下回る場合は一言添える
  if (reference) {
    const numericCols = numericColumns(meta);
    const compare = numericCols.map((c) => {
      const i = header.indexOf(c);
      return Number(okinawa[i]) - Number(reference[i]);
    });
    if (numericCols.length > 1 && compare.every((d) => d < 0)) {
      parts.push(
        `収録した${numericCols.length}指標すべてで${refLabel(reference[0])}を下回っています。`
      );
    } else if (numericCols.length > 1 && compare.every((d) => d > 0)) {
      parts.push(
        `収録した${numericCols.length}指標すべてで${refLabel(reference[0])}を上回っています。`
      );
    }
  }
  return parts.filter(Boolean).join("");
}

/** 市町村データ: 値(または階級)の幅と、同じ値が最も多い市町村数 */
function municipalLead(
  meta: DatasetMeta,
  header: string[],
  rows: string[][]
): string | null {
  const col = meta.map!.column;
  const colIdx = header.indexOf(col);
  if (colIdx === -1) return null;
  // 全国・県の基準行を含むデータセットがあるため、市町村数と値の集計からは除く
  const names = new Set(getAreas().map((a) => a.name));
  rows = rows.filter((r) => names.has(r[0]));
  const values = rows.map((r) => r[colIdx]).filter((v) => v !== "");
  if (values.length === 0) return null;
  const order = sortRateClasses(values);
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const [mode, modeCount] = [...counts.entries()].sort(
    (a, b) => b[1] - a[1]
  )[0];
  const lo = order[0];
  const hi = order[order.length - 1];
  const tail = "県全体の一つの数字では見えない、県内の違いが分かります。";

  // 階級ラベル(「20%未満」等)の列と、実数の列とで言い回しを分ける。
  // 実数の列に「回答」「階級」を使うと、調査の回答区分のように読めてしまう
  // (平均寿命や課税対象所得は回答ではない)
  if (!values.every((v) => /^-?\d+(\.\d+)?$/.test(v))) {
    return `${rows.length}市町村は「${lo}」から「${hi}」までの階級に分かれ、最も多いのは「${mode}」(${modeCount}市町村)です。${tail}`;
  }
  const unit = unitOf(meta, col);
  // 同じ値が1市町村ずつしかない列(課税対象所得など)では最頻値に意味がない
  const modePart =
    modeCount > 1 ? `、最も多いのは${mode}${unit}(${modeCount}市町村)` : "";
  return `${rows.length}市町村の${col}は${lo}${unit}から${hi}${unit}まで幅があり${modePart}です。${tail}`;
}

/** 県単位の経年データ: 最初と最後の比較 */
function trendLead(
  meta: DatasetMeta,
  header: string[],
  rows: string[][]
): string | null {
  const numericCols = numericColumns(meta);
  if (numericCols.length === 0 || rows.length < 2) return null;
  // 経年データセットの数値列は「<指標>_沖縄」の規則で並ぶ。沖縄の系列を主語にする
  const OKINAWA_SUFFIX = /_(沖縄県|沖縄)$/;
  const col = numericCols.find((c) => OKINAWA_SUFFIX.test(c)) ?? numericCols[0];
  const subject = OKINAWA_SUFFIX.test(col)
    ? `沖縄県の${col.replace(OKINAWA_SUFFIX, "")}`
    : col;
  const colIdx = header.indexOf(col);
  const unit = unitOf(meta, col);
  // 系列に欠けている年がある場合は推移を語らせない。初任給のように定義変更で
  // 旧系列・新系列に分かれるデータセットでは、旧系列の最後の年が空欄になり
  // 「令和7年の千円へ」のような壊れた文になる
  if (rows.some((r) => r[colIdx] === "")) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const diff = Number(last[colIdx]) - Number(first[colIdx]);
  const direction = diff < 0 ? "低下" : diff > 0 ? "上昇" : "横ばい";
  const yearize = (s: string) => (/^\d{4}$/.test(s) ? `${s}年` : s);
  return `${subject}は${yearize(first[0])}の${first[colIdx]}${unit}から${yearize(last[0])}の${last[colIdx]}${unit}へと${direction}しています。比較にあたっての注意は「利用上の注意」を参照してください。`;
}

function numericColumns(meta: DatasetMeta): string[] {
  const csv = meta.files.find((f) => f.format === "csv");
  return (
    csv?.columns
      .filter((c) => c.type === "number" || c.type === "integer")
      .map((c) => c.name) ?? []
  );
}

function unitOf(meta: DatasetMeta, column: string): string {
  const csv = meta.files.find((f) => f.format === "csv");
  return csv?.columns.find((c) => c.name === column)?.unit ?? "";
}

/** 全国基準行の表示名: 通例の「全国平均」表記に統一する(値は単純平均でなく
 *  全国集計値。原文ラベルは CSV に保持)。学テは公立限定の値のため限定を残す */
export function refLabel(raw: string): string {
  if (raw === "全国（公立）") return "全国平均(公立)";
  // 県民経済計算の全国値は原典呼称が「全県計」(国民経済計算の国値とは別概念)のため併記する
  if (raw === "全県計") return "全国平均(全県計)";
  if (raw === "全国" || raw === "合計" || raw === "計") return "全国平均";
  return raw.replaceAll("（", "(").replaceAll("）", ")");
}
