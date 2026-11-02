/**
 * 学校保健統計調査 表8/表9「都道府県別 年齢別 疾病・異常被患率等(各年齢ごと)」の
 * 12歳・計(男女計)シート共通パーサ。
 *
 * レイアウトは2系統(いずれも 12歳・計 は 8 番目「(39-8)」シート):
 * - 新(令和3〜7年度): タイトル=列0(行1〜2で揺れる)、ラベル列0(「全国」「沖縄県」)。
 *   列: 裸眼視力1.0未満計=10 / むし歯（う歯）計=19・処置完了者=20・未処置歯のある者=21 /
 *   永久歯の1人当り平均むし歯（う歯）等数 計=27
 * - 旧(平成24〜令和2年度): タイトル=行2列1、ラベル列1(「全　　　国」など全角空白入り)。
 *   列: 裸眼=12 / むし歯=21〜23 / 平均むし歯等数 計=29
 *
 * 列位置は固定値だが、読み出し前にヘッダ文言を assert して列ズレを検知する。
 * 値は公表 Excel の表示文字列(raw:false)をそのまま保持する(全国=小数第2位・
 * 都道府県=第1位という原表の桁数を含めて逐語)。
 * 記号(令和7年度「調査の概要」の規約): 「X」=標本サイズが小さい等で非公表、
 * 「－」=計数がない場合。いずれも空文字で返し、sheet.specials に記録する。
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

export interface Hoken12Row {
  raganKei: string; // 裸眼視力1.0未満 計(%)
  mushibaKei: string; // むし歯（う歯）計(%)
  shochi: string; // むし歯（う歯）処置完了者(%)
  mishochi: string; // むし歯（う歯）未処置歯のある者(%)
  dmfKei: string; // 永久歯の1人当り平均むし歯（う歯）等数 計(本)
}

interface Layout {
  labelCol: number;
  cols: {
    ragan: number;
    mushiba: number;
    shochi: number;
    mishochi: number;
    dmf: number;
  };
}

export interface Hoken12Sheet {
  file: string;
  rows: unknown[][];
  layout: Layout;
  /** 空欄化した記号セルの記録(例 "秋田県 裸眼視力1.0未満=X") */
  specials: string[];
}

const norm = (v: unknown) => String(v ?? "").replace(/\s+/g, "");

export function load12SaiKei(filePath: string): Hoken12Sheet {
  const file = path.basename(filePath);
  const wb = XLSX.read(fs.readFileSync(filePath));
  const name = wb.SheetNames[7]; // 39シート中8番目 = (39-8) = 12歳・計
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
    header: 1,
    raw: false,
  }) as unknown[][];

  // タイトルで 12歳・計 を確認。
  // 新レイアウト: 列0にタイトル(位置が年により行1〜2で揺れるため動的に探す)
  // 旧レイアウト: 行2列1(h24 のみ「１ 計 (８) 12歳」の語順)
  let newTitleRow = -1;
  for (let r = 0; r <= 4; r++) {
    if (norm(rows[r]?.[0]).includes("12歳")) {
      newTitleRow = r;
      break;
    }
  }
  const isNew = newTitleRow !== -1;
  const title = isNew ? norm(rows[newTitleRow][0]) : norm(rows[2]?.[1]);
  if (!title.includes("12歳") || !title.includes("計") || /男|女/.test(title)) {
    throw new Error(
      `${file}: シート ${name} が 12歳・計 でありません(タイトル: ${title})`
    );
  }
  const layout: Layout = isNew
    ? {
        labelCol: 0,
        cols: { ragan: 10, mushiba: 19, shochi: 20, mishochi: 21, dmf: 27 },
      }
    : {
        labelCol: 1,
        cols: { ragan: 12, mushiba: 21, shochi: 22, mishochi: 23, dmf: 29 },
      };

  const expect = (
    r: number,
    c: number,
    test: (s: string) => boolean,
    desc: string
  ) => {
    const s = norm(rows[r]?.[c]);
    if (!test(s))
      throw new Error(`${file}: ヘッダ不一致 ${desc}(row${r},col${c}="${s}")`);
  };
  if (isNew) {
    // ヘッダ3段はタイトル行の +2/+3/+4 行。令和3・4年度は「1.0未満」の中間
    // 見出しセルがなく、DMF 計に「（本）」が付く変種(列位置は同一)
    const h1 = newTitleRow + 2;
    const h2 = newTitleRow + 3;
    const h3 = newTitleRow + 4;
    expect(h1, layout.cols.ragan, (s) => s === "裸眼視力", "裸眼視力(区分)");
    expect(
      h2,
      layout.cols.ragan,
      (s) => s === "1.0未満" || s === "計",
      "裸眼視力1.0未満"
    );
    expect(h3, layout.cols.ragan, (s) => s === "計", "裸眼視力1.0未満・計");
    expect(
      h3,
      layout.cols.ragan + 1,
      (s) => s === "0.7以上1.0未満",
      "1.0未満ブロックの内訳"
    );
    expect(
      h2,
      layout.cols.mushiba,
      (s) => s === "むし歯（う歯）",
      "むし歯（う歯）"
    );
    expect(h3, layout.cols.mushiba, (s) => s === "計", "むし歯（う歯）・計");
    expect(h3, layout.cols.shochi, (s) => s === "処置完了者", "処置完了者");
    expect(
      h3,
      layout.cols.mishochi,
      (s) => s === "未処置歯のある者",
      "未処置歯のある者"
    );
    expect(h1, layout.cols.dmf, (s) => s.includes("永久歯"), "平均むし歯等数");
    expect(
      h3,
      layout.cols.dmf,
      (s) => s === "計" || s === "計（本）",
      "平均むし歯等数・計"
    );
  } else {
    expect(
      3,
      layout.cols.ragan,
      (s) => s === "裸眼視力",
      "裸眼視力(1.0未満ブロック)"
    );
    expect(6, layout.cols.ragan, (s) => s === "計", "裸眼視力1.0未満・計");
    expect(
      4,
      layout.cols.mushiba,
      (s) => s.startsWith("むし歯"),
      "むし歯（う歯）"
    );
    expect(5, layout.cols.mushiba, (s) => s === "計", "むし歯（う歯）・計");
    expect(
      5,
      layout.cols.shochi,
      (s) => s.includes("処置") && s.includes("完了"),
      "処置完了者"
    );
    expect(
      5,
      layout.cols.mishochi,
      (s) => s.includes("未処置歯"),
      "未処置歯のある者"
    );
    expect(3, layout.cols.dmf, (s) => s.includes("永久歯"), "平均むし歯等数");
    expect(6, layout.cols.dmf, (s) => s === "計", "平均むし歯等数・計");
  }
  return { file, rows, layout, specials: [] };
}

/**
 * ラベル列が target に一致する行をちょうど1つ見つける(空白は無視して比較)。
 * 平成24年度の表側は「沖　　　縄」のように接尾辞(県)なしのため、県を落とした
 * 表記も同一視する。
 */
export function findRow(sheet: Hoken12Sheet, target: string): number {
  const accepts = new Set([target, target.replace(/県$/, "")]);
  const hits: number[] = [];
  sheet.rows.forEach((row, i) => {
    if (accepts.has(norm(row?.[sheet.layout.labelCol]))) hits.push(i);
  });
  if (hits.length !== 1) {
    throw new Error(`${sheet.file}: 行 "${target}" が ${hits.length} 個`);
  }
  return hits[0];
}

/**
 * セル値(表示文字列)を検証して返す。記号「X」(非公表)・「－」(計数がない)は
 * specials に記録して空文字、その他の非数値は throw。
 */
function cellValue(
  sheet: Hoken12Sheet,
  r: number,
  c: number,
  label: string,
  max: number
): string {
  const s = String(sheet.rows[r]?.[c] ?? "").trim();
  if (s === "X" || /^[-－‐−]$/.test(s)) {
    sheet.specials.push(`${label}=${s === "X" ? "X" : "－"}`);
    return "";
  }
  if (!/^\d+(\.\d+)?$/.test(s) || Number(s) < 0 || Number(s) > max) {
    throw new Error(
      `${sheet.file}: ${label} の値 "${s}" が不正(row${r},col${c})`
    );
  }
  return s;
}

export function extractRow(sheet: Hoken12Sheet, target: string): Hoken12Row {
  const r = findRow(sheet, target);
  const { cols } = sheet.layout;
  return {
    raganKei: cellValue(sheet, r, cols.ragan, `${target} 裸眼視力1.0未満`, 100),
    mushibaKei: cellValue(sheet, r, cols.mushiba, `${target} むし歯計`, 100),
    shochi: cellValue(sheet, r, cols.shochi, `${target} 処置完了者`, 100),
    mishochi: cellValue(
      sheet,
      r,
      cols.mishochi,
      `${target} 未処置歯のある者`,
      100
    ),
    dmfKei: cellValue(sheet, r, cols.dmf, `${target} 平均むし歯等数`, 20),
  };
}

/**
 * 内訳恒等式: 処置完了者 + 未処置歯のある者 = むし歯（う歯）計。
 * 3値が独立に丸められているため、許容差は桁数に応じて渡す(2位=0.0151 / 1位=0.151)。
 */
export function assertMushibaIdentity(
  label: string,
  v: Hoken12Row,
  tolerance: number
): void {
  if (v.mushibaKei === "" || v.shochi === "" || v.mishochi === "") return; // 秘匿時は検証不能
  const diff = Math.abs(
    Number(v.shochi) + Number(v.mishochi) - Number(v.mushibaKei)
  );
  if (diff > tolerance) {
    throw new Error(
      `${label}: むし歯内訳の恒等式不成立 ${v.shochi}+${v.mishochi}≠${v.mushibaKei}(差${diff.toFixed(3)})`
    );
  }
}
