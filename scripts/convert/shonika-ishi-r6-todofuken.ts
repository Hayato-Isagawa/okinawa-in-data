/**
 * 医師・歯科医師・薬剤師統計(令和6年)の都道府県別 小児科医師数の変換スクリプト。
 *
 * 入力:
 *   raw/r6_estat_35_ishi_todofuken_shinryoka.csv(e-Stat 第35表・実数。Shift_JIS)
 *   raw/r6_mhlw_toukeihyo.xlsx(概況の統計表。シート「統計表11」= 15歳未満人口10万対、
 *                              シート「付表」= 人口10万対比率の算出に用いた人口)
 * 出力: data.csv(47都道府県+全国、48行)
 *
 * 実数と率は同じ表に載っていないため 2 ファイルから組み立てる:
 * - 実数(小児科医師数)は e-Stat 第35表にしかない
 * - 15歳未満人口10万対は概況の統計表11 にしかない(e-Stat 第36表は総人口10万対)
 *
 * 抽出規則:
 * - 第35表は「医療施設従事」「病院」「診療所」の3ブロック構造。都道府県の行は
 *   col0 が "医療施設従事" かつ col1 が全角2桁コード始まりの行に限る
 *   (col1 が空または「指定都市・特別区（再掲）」等の行を混ぜると二重計上になる)
 * - 都道府県名の表記が 3 通り揺れている(第35表「４７沖縄」/ 統計表11「沖縄」/
 *   付表「沖縄県　　　　」)。コード列を持つのは第35表だけなので、コード順の位置と
 *   PREFECTURES との前方一致で 3 ファイルの行を突き合わせる
 * - 統計表11 のセルは浮動小数点表現の揺れを含む(130.19999999999999・50)ため
 *   小数第1位に丸め直す
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { parseCsv, toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/shonika-ishi-r6-todofuken"
);
const raw = (file: string) => path.join(datasetDir, "raw", file);

/** 全角スペースを含めて前後の空白を落とす(付表の名称は全角スペース埋め) */
const trim = (v: unknown): string =>
  String(v ?? "").replace(/^[\s　]+|[\s　]+$/g, "");

/** 第35表: 指定したブロックの47都道府県行(コード順)と全国行を返す */
function readTable35(block: string): { prefs: string[][]; national: string[] } {
  const text = new TextDecoder("shift_jis").decode(
    fs.readFileSync(raw("r6_estat_35_ishi_todofuken_shinryoka.csv"))
  );
  const rows = parseCsv(text).filter((r) => trim(r[0]) === block);
  if (rows.length === 0)
    throw new Error(`第35表: ブロック "${block}" がありません`);

  const prefs = rows.filter((r) => /^[０-９]{2}/.test(trim(r[1])));
  if (prefs.length !== 47) {
    throw new Error(
      `第35表(${block}): 都道府県行が ${prefs.length} 行(47 でない)`
    );
  }
  prefs.forEach((row, i) => {
    const cell = trim(row[1]);
    const code = cell
      .slice(0, 2)
      .replace(/[０-９]/g, (c) =>
        String.fromCharCode(c.charCodeAt(0) - 0xfee0)
      );
    if (Number(code) !== i + 1) {
      throw new Error(`第35表(${block}): ${i + 1} 番目の行のコードが ${code}`);
    }
    // 第35表の名称は接尾辞なし(「沖縄」「東京」)。正式名称との前方一致で確認する
    const name = cell.slice(2);
    if (!PREFECTURES[i].startsWith(name)) {
      throw new Error(
        `第35表(${block}): コード ${code} の名称 "${name}" ≠ ${PREFECTURES[i]}`
      );
    }
  });

  const national = rows.find((r) => trim(r[2]) === "全国");
  if (!national) throw new Error(`第35表(${block}): 全国行がありません`);
  return { prefs, national };
}

/** 概況の統計表(xlsx)を行配列で読む */
function readSheet(sheetName: string): unknown[][] {
  const wb = XLSX.read(fs.readFileSync(raw("r6_mhlw_toukeihyo.xlsx")));
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`概況統計表: シート "${sheetName}" がありません`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
}

function asCount(v: unknown, label: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0)
    throw new Error(`${label}: 整数でない値 ${String(v)}`);
  return n;
}

/** 浮動小数点表現の揺れ(130.19999999999999・50)を小数第1位に丸め直す */
function asRate(v: unknown, label: string): string {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
    throw new Error(`${label}: 率が数値でないか範囲外 ${String(v)}`);
  }
  return (Math.round(v * 10) / 10).toFixed(1);
}

const SHONIKA_COL = 17; // 第35表の「小児科」列(主たる診療科)
const ijuu = readTable35("医療施設従事");
const byoin = readTable35("病院");
const shinryojo = readTable35("診療所");

// 統計表11: 行5 が全国、行6〜52 が47都道府県(コード順)。列3 = 小児科(15歳未満人口10万対)
const t11 = readSheet("統計表11");
// 付表: 行4 が全国、行5〜51 が47都道府県。列3 = 15歳未満人口(千人)
const futai = readSheet("付表");

type Row = { name: string; doctors: number; pop: number; rate: string };

const build = (i: number | "national"): Row => {
  const national = i === "national";
  const name = national ? "全国" : PREFECTURES[i];
  const label = name;

  if (!national) {
    // 統計表11・付表の行位置が都道府県コード順であることを名称で確認する
    const t11Name = trim(t11[6 + i]?.[1]);
    if (!PREFECTURES[i].startsWith(t11Name)) {
      throw new Error(
        `統計表11: ${i + 1} 行目の名称 "${t11Name}" ≠ ${PREFECTURES[i]}`
      );
    }
    const futaiName = trim(futai[5 + i]?.[1]);
    if (futaiName !== PREFECTURES[i]) {
      throw new Error(
        `付表: ${i + 1} 行目の名称 "${futaiName}" ≠ ${PREFECTURES[i]}`
      );
    }
  } else {
    if (trim(t11[5]?.[1]) !== "全国")
      throw new Error("統計表11: 全国行が想定位置にありません");
    if (trim(futai[4]?.[1]) !== "全国")
      throw new Error("付表: 全国行が想定位置にありません");
  }

  const doctors = asCount(
    (national ? ijuu.national : ijuu.prefs[i])[SHONIKA_COL],
    `${label} 小児科医師数`
  );
  const pop = asCount(
    (national ? futai[4] : futai[5 + i])[3],
    `${label} 15歳未満人口`
  );
  const rate = asRate(
    (national ? t11[5] : t11[6 + i])[3],
    `${label} 15歳未満人口10万対`
  );

  // 病院 + 診療所 = 医療施設従事(第35表のブロック間の整合)
  const b = asCount(
    (national ? byoin.national : byoin.prefs[i])[SHONIKA_COL],
    `${label} 病院`
  );
  const s = asCount(
    (national ? shinryojo.national : shinryojo.prefs[i])[SHONIKA_COL],
    `${label} 診療所`
  );
  if (b + s !== doctors) {
    throw new Error(
      `${label}: 病院 ${b} + 診療所 ${s} ≠ 医療施設従事 ${doctors}`
    );
  }

  // 実数 ÷ 分母 が公表の率と一致すること(実数=e-Stat、率=概況 の突合)
  const recomputed = (
    Math.round((doctors / (pop * 1000)) * 100000 * 10) / 10
  ).toFixed(1);
  if (recomputed !== rate) {
    throw new Error(`${label}: 率の再計算 ${recomputed} ≠ 公表値 ${rate}`);
  }

  return { name, doctors, pop, rate };
};

const prefRows = PREFECTURES.map((_, i) => build(i));
const nationalRow = build("national");

// 47都道府県の小児科医師数の合計が全国と一致すること(「主たる診療科」= 重複計上なしの裏づけ)
const sumDoctors = prefRows.reduce((a, r) => a + r.doctors, 0);
if (sumDoctors !== nationalRow.doctors) {
  throw new Error(
    `小児科医師数: 47都道府県の合計 ${sumDoctors} ≠ 全国 ${nationalRow.doctors}`
  );
}
// 分母は千人単位に丸められているため合計は全国と一致しない。丸め誤差(最大 47×0.5=23.5千人)の範囲内であることだけ確認する
const sumPop = prefRows.reduce((a, r) => a + r.pop, 0);
if (Math.abs(sumPop - nationalRow.pop) > 24) {
  throw new Error(
    `15歳未満人口: 47都道府県の合計 ${sumPop} と全国 ${nationalRow.pop} の差が丸め誤差を超えています`
  );
}

const header = [
  "都道府県",
  "小児科医師数",
  "15歳未満人口",
  "15歳未満人口10万対小児科医師数",
];
const out = [...prefRows, nationalRow].map((r) => [
  r.name,
  String(r.doctors),
  String(r.pop),
  r.rate,
]);

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(`✓ data.csv (${out.length} rows)`);
const okinawa = prefRows[46];
console.log(
  `  沖縄県: ${okinawa.doctors}人 / 15歳未満 ${okinawa.pop}千人 → ${okinawa.rate}`
);
console.log(
  `  全国:   ${nationalRow.doctors}人 / 15歳未満 ${nationalRow.pop}千人 → ${nationalRow.rate}`
);
console.log(
  `  分母の千人丸めによる差: 47都道府県計 ${sumPop} vs 全国 ${nationalRow.pop} 千人`
);
