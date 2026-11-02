/**
 * 地域別最低賃金の推移(沖縄県・全国加重平均、平成14年度〜令和8年度)の変換スクリプト。
 *
 * 入力: raw/h14_r8_chiikibetsu_saitei_chingin_kaitei_jokyo.xlsx
 *       (厚生労働省「地域別最低賃金の全国一覧」の改定状況。1シート・横持ち)
 * 出力: data.csv(25行)
 *
 * 抽出規則:
 * - 原表は年度が列方向に並ぶ横持ち(1年度あたり「改定額(円)」「発効年月日」の2列)。
 *   改定額の列だけを拾い、沖縄県の行と全国加重平均額の行を縦持ちに変換する
 * - 名称は「沖　縄」のように分かち書きされるため空白を除去して同定する
 * - 全国加重平均額は平成29年度だけ 847.7195325314912 のような小数で入っているため
 *   整数に丸める(公表値は 848 円)。都道府県の額は整数を assert
 * - 平成14年度から始めるのは、この年度に時間額単独方式へ移行したため(日額との
 *   併用だった年度とは接続しない)
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/saitei-chingin-keinen"
);
const squash = (v: unknown) => String(v ?? "").replace(/[\s　]+/g, "");

const wb = XLSX.read(
  fs.readFileSync(
    path.join(
      datasetDir,
      "raw",
      "h14_r8_chiikibetsu_saitei_chingin_kaitei_jokyo.xlsx"
    )
  )
);
const rows: unknown[][] = XLSX.utils.sheet_to_json(
  wb.Sheets[wb.SheetNames[0]],
  {
    header: 1,
    raw: true,
  }
);

// 1列目は見出し「年度」なので除く。以降は「改定額(円)」「発効年月日」の2列組
const years = rows[0]
  .map((v, i) => ({ col: i, label: squash(v) }))
  .filter(
    (y) => y.col > 0 && /^(平成|令和)/.test(y.label) && y.label.endsWith("年度")
  );
if (years.length !== 25)
  throw new Error(`年度が ${years.length} 件(25 でない)`);
if (
  years[0].label !== "平成14年度" ||
  years[years.length - 1].label !== "令和８年度"
) {
  throw new Error(
    `年度の範囲が想定と異なります(${years[0].label}〜${years[years.length - 1].label})`
  );
}

const findRow = (name: string) => {
  const idx = rows.findIndex((r) => squash(r?.[0]) === name);
  if (idx === -1) throw new Error(`行 "${name}" がありません`);
  return rows[idx];
};
const okinawa = findRow("沖縄");
const national = findRow("全国加重平均額");

function asYen(v: unknown, label: string, allowRounding = false): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 100 || v > 3000) {
    throw new Error(`${label}: 金額が数値でないか範囲外 ${String(v)}`);
  }
  if (!Number.isInteger(v)) {
    if (!allowRounding) throw new Error(`${label}: 整数でない値 ${String(v)}`);
    return Math.round(v);
  }
  return v;
}

const header = ["年度", "最低賃金_沖縄県", "最低賃金_全国加重平均"];
const out = years.map((y) => [
  y.label,
  String(asYen(okinawa[y.col], `${y.label} 沖縄県`)),
  // 全国加重平均は平成29年度だけ小数で保存されている(公表値は整数)
  String(asYen(national[y.col], `${y.label} 全国加重平均`, true)),
]);

// 最新年度が都道府県別データセットと一致すること(2つのページで数字が食い違わないように)
const latest = out[out.length - 1];
if (latest[1] !== "1086" || latest[2] !== "1177") {
  throw new Error(
    `令和8年度のアンカー不一致(沖縄 ${latest[1]} / 全国 ${latest[2]})`
  );
}
// 起点のアンカー
if (out[0][1] !== "604" || out[0][2] !== "663") {
  throw new Error(
    `平成14年度のアンカー不一致(沖縄 ${out[0][1]} / 全国 ${out[0][2]})`
  );
}
// 沖縄は全期間で全国加重平均を下回る(下回らない年があれば読み違いを疑う)
for (const r of out) {
  if (Number(r[1]) >= Number(r[2])) {
    throw new Error(
      `${r[0]}: 沖縄 ${r[1]} が全国加重平均 ${r[2]} を下回っていません`
    );
  }
}

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
const ratio = out.map((r) => ({
  y: r[0],
  v: (Number(r[1]) / Number(r[2])) * 100,
}));
const low = ratio.reduce((a, b) => (b.v < a.v ? b : a));
console.log(
  `  沖縄/全国: ${ratio[0].y} ${ratio[0].v.toFixed(1)}% → 最低 ${low.y} ${low.v.toFixed(1)}% → ${ratio.at(-1)!.y} ${ratio.at(-1)!.v.toFixed(1)}%`
);
console.log(
  `  額: 沖縄 ${out[0][1]}→${latest[1]}円 / 全国 ${out[0][2]}→${latest[2]}円`
);
