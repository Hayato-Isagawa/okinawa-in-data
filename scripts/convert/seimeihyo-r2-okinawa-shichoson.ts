/**
 * 令和2年市区町村別生命表(厚生労働省)から沖縄県 41 市町村の平均寿命を抽出。
 *
 * 入力(いずれも e-Stat 掲載の統計表):
 *   raw/estat_ckts20_sankou2020_junni.xls  参考表(1行1市区町村・平均寿命+全国順位)
 *   raw/estat_ckts20_lifetable2020.xlsx    生命表本体(独立読み取りの照合用)
 * 出力: data.csv(41市町村、団体コード昇順)
 *
 * 列マッピング(参考表・ヘッダ4行、実測で確認):
 *   [0]番号(=団体コード) [1]都道府県 [2]市郡 [3]区町村
 *   [4]男 平均寿命 [5]男 順位 [6]女 平均寿命 [7]女 順位
 * 郡のない市は [3] に数値 0 が入るため、市町村名は [3] が文字列ならそれ、
 * そうでなければ [2] を採る。
 *
 * 平均寿命は小数第1位まで(原本は末尾ゼロが落ちて 81 のような整数になる)。
 * 順位は表示桁より下の値で決まっているため再計算せず原本の値をそのまま使う。
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";
import {
  loadOkinawaMunicipalities,
  readSheetRows,
  collectOkinawaRows,
} from "../lib/estat-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/seimeihyo-r2-okinawa-shichoson"
);

/** 生命表本体から「表<コード>」ブロックの 0 歳の平均余命(ex)を男女別に読む */
function readLifeExpectancyAnchors(): Map<
  string,
  { male: number; female: number }
> {
  const wb = XLSX.read(
    fs.readFileSync(
      path.join(datasetDir, "raw/estat_ckts20_lifetable2020.xlsx")
    )
  );
  const result = new Map<string, { male: number; female: number }>();
  for (const sheetName of wb.SheetNames.filter((s) => s.startsWith("生命表"))) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
    });
    for (let i = 0; i < rows.length; i++) {
      const code = /^表(\d{5})$/.exec(String(rows[i][0] ?? ""))?.[1];
      if (!code) continue;
      const ex: Record<string, number> = {};
      for (let j = i + 1; j < rows.length; j++) {
        const cell = String(rows[j][0] ?? "").trim();
        if (/^表\d{5}$/.test(cell)) break;
        if (cell !== "男" && cell !== "女") continue;
        const ageRow = rows[j + 1];
        if (ageRow?.[0] !== 0) {
          throw new Error(
            `${code}: ${cell}ブロックの先頭が 0 歳の行ではありません`
          );
        }
        ex[cell] = Number(ageRow[6]);
      }
      if (ex["男"] === undefined || ex["女"] === undefined) {
        throw new Error(`${code}: 男女いずれかの 0 歳平均余命が読めません`);
      }
      result.set(code, { male: ex["男"], female: ex["女"] });
    }
  }
  return result;
}

const rows = readSheetRows(
  path.join(datasetDir, "raw/estat_ckts20_sankou2020_junni.xls")
);
const byCode = collectOkinawaRows(rows, 0);
const munis = loadOkinawaMunicipalities();
const anchors = readLifeExpectancyAnchors();

/** 平均寿命セル: 数値であることと小数第1位までであることを確かめて 1 桁固定に整形 */
function asLifeExpectancy(value: unknown, label: string): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} が数値でありません: ${String(value)}`);
  }
  if (Math.round(value * 10) !== value * 10) {
    throw new Error(`${label} の小数桁が想定(1桁)と異なります: ${value}`);
  }
  return value.toFixed(1);
}

/** 順位セル: 1〜1887(対象市区町村数)の整数 */
function asRank(value: unknown, label: string): string {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 1887
  ) {
    throw new Error(`${label} が 1〜1887 の整数でありません: ${String(value)}`);
  }
  return String(value);
}

const header = [
  "市町村",
  "団体コード",
  "男性の平均寿命",
  "女性の平均寿命",
  "男性の全国順位",
  "女性の全国順位",
];
const out = munis.map((m) => {
  const r = byCode.get(m.code5)!;
  const name =
    typeof r[3] === "string" && r[3].trim() !== ""
      ? r[3].trim()
      : String(r[2]).trim();
  if (name !== m.name)
    throw new Error(`${m.code5}: 名称不一致 ${name} ≠ ${m.name}`);

  const male = asLifeExpectancy(r[4], `${m.name} 男性の平均寿命`);
  const female = asLifeExpectancy(r[6], `${m.name} 女性の平均寿命`);

  // 独立読み取りの照合: 生命表本体の 0 歳平均余命と一致すること
  const anchor = anchors.get(m.code5);
  if (!anchor)
    throw new Error(
      `${m.name}(${m.code5}): 生命表本体に該当ブロックがありません`
    );
  if (anchor.male.toFixed(1) !== male || anchor.female.toFixed(1) !== female) {
    throw new Error(
      `${m.name}: 参考表と生命表本体が不一致(参考表 男${male}/女${female}、生命表 男${anchor.male}/女${anchor.female})`
    );
  }

  return [
    m.name,
    m.code5,
    male,
    female,
    asRank(r[5], `${m.name} 男性の全国順位`),
    asRank(r[7], `${m.name} 女性の全国順位`),
  ];
});

// 全国・沖縄県は市区町村別生命表の「参考値」として同じ表に載る(順位は
// 1887 市区町村の中の順位なので参考値には無い)。表の先頭に基準行として置く。
// 塗り分け・リード文の集計には混ぜない(41 市町村に限定して集計する)
const referenceRows = (
  [
    ["00000", "全国"],
    ["47000", "沖縄県"],
  ] as const
).map(([code, label]) => {
  const a = anchors.get(code)!;
  return [label, code, a.male.toFixed(1), a.female.toFixed(1), "", ""];
});

fs.writeFileSync(
  path.join(datasetDir, "data.csv"),
  toCsv([header, ...referenceRows, ...out])
);
console.log(
  `✓ data.csv (${out.length} 市町村 + 参考値 ${referenceRows.length} 行)`
);
for (const r of referenceRows)
  console.log(`  参考値 ${r[0]}: 男 ${r[2]} / 女 ${r[3]}`);
