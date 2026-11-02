/**
 * 学校基本調査「就職先別県外就職者数」(高等学校 全日制・定時制)の共通パーサ。
 * 計(男女計)のみを扱う。
 *
 * レイアウトは2系統:
 * - 新(令和3年3月卒〜): 2シート構成の1枚目「*(2-1)」に全列。
 *   ヘッダ行: c2=計 / c3=就職者のうち県外に就職した割合 / c4〜c50=就職先47都道府県 /
 *   c51=その他。データ行: 前年計→当年計→男→女→47都道府県(c0=卒業年、c1=区分)。
 * - 旧(平成22〜令和2年3月卒): 4シート構成。「*(4-1)」=計(県外就職者数計・割合・
 *   就職先 北海道〜静岡)、「*(4-2)」=計つづき(就職先 愛知〜沖縄+その他)。
 *   (4-3)/(4-4)=うち男(不使用)。全国行は年ラベル(c1)のみで前年・当年の2行、
 *   都道府県行は c2=県名(「都府県」なしの短縮名)。年ラベルは数値+表示形式のセル
 *   (例: 21→「平成21年3月」)のため表示文字列で判定する。
 *
 * 値は公表 Excel の表示文字列(raw:false)を使用。県外就職者数は桁区切りカンマを
 * 除去した整数文字列、割合は表示どおり小数第1位。「－」は raw 実測で数値0のセルの
 * 表示形式のため合計では0として扱う。自県セルは「…」。
 *
 * 検証(いずれも不一致は throw):
 * - ヘッダ・行ラベル文言の assert(列ズレ・行ズレ検知)
 * - 全行で 県外就職者数計 = Σ就職先(47都道府県+「その他」、自県「…」除外)の恒等式
 * - 割合の表示形式(小数第1位)の assert
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PREFECTURES } from "./prefectures";

export interface KengaiValue {
  kengai: string; // 県外就職者数(整数文字列)
  ritsu: string; // 就職者のうち県外に就職した割合(%、小数第1位)
}

export interface KengaiSheet {
  yearLabel: string; // 当年(例「令和7年3月」)
  prevYearLabel: string; // 前年併記行の年
  national: KengaiValue;
  prevNational: KengaiValue; // 前年併記行(年次間の接続検証用)
  prefectures: Map<string, KengaiValue>; // キーは正式名称(PREFECTURES)
}

const N = (v: unknown): string => String(v ?? "").replace(/\s+/g, "");

/** 旧レイアウトの短縮名(北海道以外は末尾の都府県を除いた形) */
const SHORT_NAMES = PREFECTURES.map((p) =>
  p === "北海道" ? p : p.replace(/[都府県]$/, "")
);

const YEAR_RE = /^(平成|令和)\d+年3月$/;
const RATE_HEADERS = new Set([
  "県外就職率",
  "就職者のうち県外に就職した割合（％）",
  "就職者のうち県外に就職した割合(％)",
]);

function toIntStr(v: unknown, label: string): string {
  const s = N(v).replace(/,/g, "");
  if (!/^\d+$/.test(s))
    throw new Error(`${label}: 整数でない値 "${String(v)}"`);
  return s;
}

function toRateStr(v: unknown, label: string): string {
  const s = N(v);
  if (!/^\d+\.\d$/.test(s))
    throw new Error(`${label}: 割合の表示が小数第1位でない "${String(v)}"`);
  return s;
}

/** 就職先セル群を合算(「…」=自県は除外して数える。「－」と空は0) */
function sumDest(
  row: unknown[],
  from: number,
  to: number,
  label: string
): { sum: number; selfCount: number } {
  let sum = 0;
  let selfCount = 0;
  for (let c = from; c <= to; c++) {
    const s = N((row ?? [])[c]);
    if (s === "…") {
      selfCount++;
      continue;
    }
    if (s === "" || s === "－") continue;
    sum += Number(toIntStr(s, `${label} 就職先列${c}`));
  }
  return { sum, selfCount };
}

function assertIdentity(
  label: string,
  kengai: string,
  sum: number,
  selfCount: number,
  expectedSelf: number
): void {
  if (selfCount !== expectedSelf) {
    throw new Error(
      `${label}: 自県「…」セルが ${selfCount} 個(期待 ${expectedSelf})`
    );
  }
  if (sum !== Number(kengai)) {
    throw new Error(`${label}: 恒等式不一致 計${kengai} ≠ Σ就職先${sum}`);
  }
}

function readRows(
  wb: XLSX.WorkBook,
  suffix: string,
  file: string
): unknown[][] {
  const name = wb.SheetNames.find((n) => n.endsWith(suffix));
  if (!name) {
    throw new Error(
      `${file}: "${suffix}" シートがありません(存在: ${wb.SheetNames.join(", ")})`
    );
  }
  return XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false });
}

export function loadKengai(filePath: string): KengaiSheet {
  const file = path.basename(filePath);
  const wb = XLSX.read(fs.readFileSync(filePath));
  const isNew = wb.SheetNames[0].endsWith("(2-1)");
  return isNew ? loadNew(wb, file) : loadOld(wb, file);
}

function loadNew(wb: XLSX.WorkBook, file: string): KengaiSheet {
  const rows = readRows(wb, "(2-1)", file);
  const hdr = rows.findIndex((r) => N((r ?? [])[2]) === "計");
  if (hdr === -1) throw new Error(`${file}: ヘッダ行(c2=計)が見つかりません`);
  const h = rows[hdr];
  if (N(h[3]) !== "就職者のうち県外に就職した割合") {
    throw new Error(`${file}: 割合ヘッダ不一致 "${N(h[3])}"`);
  }
  for (const [c, name] of [
    [4, "北海道"],
    [50, "沖縄県"],
    [51, "その他"],
  ] as const) {
    if (N(h[c]) !== name)
      throw new Error(
        `${file}: 就職先ヘッダ c${c} が「${name}」でない: "${N(h[c])}"`
      );
  }
  const labelAt = (offset: number, expected: string) => {
    if (N(rows[hdr + offset][1]) !== expected) {
      throw new Error(
        `${file}: 行ラベル不一致 r${hdr + offset} "${N(rows[hdr + offset][1])}"(期待 ${expected})`
      );
    }
  };
  labelAt(1, "計"); // 前年計
  labelAt(2, "計"); // 当年計
  labelAt(3, "男");
  labelAt(4, "女");

  const prevRow = rows[hdr + 1];
  const curRow = rows[hdr + 2];
  const yearLabel = N(curRow[0]);
  const prevYearLabel = N(prevRow[0]);
  if (!YEAR_RE.test(yearLabel) || !YEAR_RE.test(prevYearLabel)) {
    throw new Error(
      `${file}: 年ラベル不正 当年"${yearLabel}" 前年"${prevYearLabel}"`
    );
  }

  const extract = (
    row: unknown[],
    label: string,
    expectedSelf: number
  ): KengaiValue => {
    const kengai = toIntStr(row[2], `${label} 計`);
    const ritsu = toRateStr(row[3], `${label} 割合`);
    const { sum, selfCount } = sumDest(row, 4, 51, label);
    assertIdentity(label, kengai, sum, selfCount, expectedSelf);
    return { kengai, ritsu };
  };

  const national = extract(curRow, `${file} 全国(当年)`, 0);
  const prevNational = extract(prevRow, `${file} 全国(前年)`, 0);
  const prefectures = new Map<string, KengaiValue>();
  PREFECTURES.forEach((pref, i) => {
    const row = rows[hdr + 5 + i];
    if (N(row?.[1]) !== pref) {
      throw new Error(
        `${file}: 都道府県行の順序不一致 r${hdr + 5 + i} "${N(row?.[1])}"(期待 ${pref})`
      );
    }
    if (N(row[0]) !== yearLabel) {
      throw new Error(
        `${file}: ${pref} 行の年ラベルが当年でない: "${N(row[0])}"`
      );
    }
    prefectures.set(pref, extract(row, `${file} ${pref}`, 1));
  });
  return { yearLabel, prevYearLabel, national, prevNational, prefectures };
}

function loadOld(wb: XLSX.WorkBook, file: string): KengaiSheet {
  const rows = readRows(wb, "(4-1)", file);
  const rows2 = readRows(wb, "(4-2)", file);
  const hdr = rows.findIndex((r) => N((r ?? [])[5]) === "計");
  if (hdr === -1)
    throw new Error(`${file}: (4-1) ヘッダ行(c5=計)が見つかりません`);
  if (!RATE_HEADERS.has(N(rows[hdr][6]))) {
    throw new Error(`${file}: 割合ヘッダ不一致 "${N(rows[hdr][6])}"`);
  }
  const dest1 = rows[hdr + 1];
  if (N(dest1[7]) !== "北海道" || N(dest1[28]) !== "静岡") {
    throw new Error(
      `${file}: (4-1) 就職先ヘッダ不一致 c7="${N(dest1[7])}" c28="${N(dest1[28])}"`
    );
  }
  const dest2 = rows2.find((r) => N((r ?? [])[5]) === "愛知");
  if (!dest2 || N(dest2[29]) !== "沖縄" || N(dest2[30]) !== "その他") {
    throw new Error(
      `${file}: (4-2) 就職先ヘッダ不一致(c5=愛知/c29=沖縄/c30=その他)`
    );
  }

  // 全国行 = c1 が年ラベルの行(前年・当年の2行)
  const natIdx = rows
    .map((r, i) => [r, i] as const)
    .filter(([r]) => YEAR_RE.test(N((r ?? [])[1])))
    .map(([, i]) => i);
  if (natIdx.length !== 2)
    throw new Error(`${file}: 全国行が ${natIdx.length} 行(期待2)`);
  const [prevIdx, curIdx] = natIdx;

  const extract = (
    rowIdx: number,
    name: string,
    label: string,
    expectedSelf: number
  ): KengaiValue => {
    const row = rows[rowIdx];
    const row2 = rows2[rowIdx];
    // (4-2) 側の行ズレ検知: 行ラベル(全国=年ラベル c1 / 県=短縮名 c2)の一致
    if (expectedSelf === 0) {
      if (N(row2?.[1]) !== N(row[1])) {
        throw new Error(`${label}: (4-2) の年ラベル不一致 "${N(row2?.[1])}"`);
      }
    } else if (N(row2?.[2]) !== name) {
      throw new Error(
        `${label}: (4-2) の県名不一致 "${N(row2?.[2])}"(期待 ${name})`
      );
    }
    const kengai = toIntStr(row[5], `${label} 計`);
    const ritsu = toRateStr(row[6], `${label} 割合`);
    const d1 = sumDest(row, 7, 28, `${label} (4-1)`);
    const d2 = sumDest(row2, 5, 30, `${label} (4-2)`);
    assertIdentity(
      label,
      kengai,
      d1.sum + d2.sum,
      d1.selfCount + d2.selfCount,
      expectedSelf
    );
    return { kengai, ritsu };
  };

  const yearLabel = N(rows[curIdx][1]);
  const prevYearLabel = N(rows[prevIdx][1]);
  const national = extract(curIdx, "", `${file} 全国(当年)`, 0);
  const prevNational = extract(prevIdx, "", `${file} 全国(前年)`, 0);

  // 都道府県行 = c2 が短縮名の行。掲載順が JIS コード順であることも assert
  const prefRows = rows
    .map((r, i) => [r, i] as const)
    .filter(([r]) => SHORT_NAMES.includes(N((r ?? [])[2])));
  if (prefRows.length !== 47)
    throw new Error(`${file}: 都道府県行が ${prefRows.length} 行(期待47)`);
  const prefectures = new Map<string, KengaiValue>();
  prefRows.forEach(([row, rowIdx], i) => {
    const short = SHORT_NAMES[i];
    if (N(row[2]) !== short) {
      throw new Error(
        `${file}: 都道府県行の順序不一致 r${rowIdx} "${N(row[2])}"(期待 ${short})`
      );
    }
    prefectures.set(
      PREFECTURES[i],
      extract(rowIdx, short, `${file} ${PREFECTURES[i]}`, 1)
    );
  });
  return { yearLabel, prevYearLabel, national, prevNational, prefectures };
}
