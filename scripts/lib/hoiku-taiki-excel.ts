/**
 * 保育所等関連状況取りまとめ「（参考）申込者の状況」シート共通パーサ。
 *
 * 全国約1,741市区町村×(申込者数〜待機児童)の連続ブロックを持つ毎年公表の Excel。
 * 列位置・ヘッダ行・シート名は年により移動する(平成27・28=ヘッダ行5/待機列13、
 * 平成29=行6/列17、平成30・31=行6/列14、令和2〜7=行5〜7/列15)ため位置は固定せず、
 * 「申込者数」と「待機児童」を含むヘッダ行を動的に特定する。
 *
 * 検証(全行): 申込者数 = Σ(申込者数と待機児童の間の全列) + 待機児童 の恒等式。
 * ブロック構成が年で変わっても(平成29年調査要領改正の除外4類型など)この恒等式は
 * 不変で、列ズレ・拾い漏れを検知する。空セルは 0 として扱い、沖縄県行・計行に
 * 現れた場合は blanks に記録する(渡名喜村など実ゼロの市町村がある)。
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

export interface MoushikomiRegion {
  /** 市区町村名(計行は「計」) */
  muni: string;
  /** 申込者数〜待機児童 の連続ブロック(整数値) */
  block: number[];
}

export interface MoushikomiSheet {
  file: string;
  /** タイトル行の正規化文字列(全角数字→半角、空白除去) */
  title: string;
  /** ブロックの列ラベル(申込者数〜待機児童、正規化済み) */
  headerLabels: string[];
  /** 全国の「計」行 */
  national: number[];
  /** 沖縄県の市町村行(シート出現順) */
  okinawa: MoushikomiRegion[];
  /** 恒等式を検証したデータ行数(全国全市区町村) */
  checkedRows: number;
  /** 沖縄県行・計行のブロック中の空セル(0 扱い)の記録 */
  blanks: string[];
}

const ZEN = "０１２３４５６７８９";
const norm = (v: unknown): string =>
  String(v ?? "")
    .replace(/[\s　]+/g, "")
    .replace(/[０-９]/g, (c) => String(ZEN.indexOf(c)));

function toInt(cell: unknown, ctx: string, blanks: string[] | null): number {
  const t = String(cell ?? "")
    .replace(/,/g, "")
    .trim();
  // 空セルと「-」(計数がない)は 0 扱い(恒等式が全行で成立することを別途検証)
  if (t === "" || t === "-" || t === "－") {
    blanks?.push(`${ctx}="${t}"`);
    return 0;
  }
  if (!/^\d+$/.test(t))
    throw new Error(`${ctx}: 数値でないセル "${String(cell)}"`);
  return Number(t);
}

export function loadMoushikomi(filePath: string): MoushikomiSheet {
  const file = path.basename(filePath);
  const wb = XLSX.read(fs.readFileSync(filePath));
  const sheetName =
    wb.SheetNames.find((n) => n.includes("申込")) ?? wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    raw: false,
  }) as unknown[][];

  // ヘッダ行: 「申込者数」と「待機児童」を含む最初の行
  let hr = -1;
  for (let r = 0; r < 15; r++) {
    const cells = Array.from(rows[r] ?? [], norm);
    if (
      cells.some((c) => c.includes("申込者数")) &&
      cells.some((c) => c.includes("待機児童"))
    ) {
      hr = r;
      break;
    }
  }
  if (hr === -1)
    throw new Error(`${file}: ヘッダ行が見つかりません(シート ${sheetName})`);
  const header = Array.from(rows[hr] ?? [], norm);
  const moushiCol = header.findIndex((c) => c.includes("申込者数"));
  const taikiCol = header.findIndex((c) => c.includes("待機児童"));
  const prefCol = header.findIndex((c) => c === "都道府県");
  const muniCol = header.findIndex((c) => c === "市区町村" || c === "市町村");
  if (
    moushiCol === -1 ||
    taikiCol <= moushiCol ||
    prefCol === -1 ||
    muniCol === -1
  ) {
    throw new Error(
      `${file}: 列特定に失敗(申込=${moushiCol} 待機=${taikiCol} 都道府県=${prefCol} 市区町村=${muniCol})`
    );
  }

  let title = "";
  for (let r = 0; r < hr; r++) {
    const t = Array.from(rows[r] ?? [], norm).join("");
    if (t.includes("申込者の状況")) {
      title = t;
      break;
    }
  }

  const blanks: string[] = [];
  let national: number[] | null = null;
  const okinawa: MoushikomiRegion[] = [];
  let checkedRows = 0;
  for (let i = hr + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const pref = norm(row[prefCol]);
    const muni = norm(row[muniCol]);
    // データ行 = 申込者数セルが数値として読める行(見出し・空行・注記を除外)
    if (
      !/^\d/.test(
        String(row[moushiCol] ?? "")
          .replace(/,/g, "")
          .trim()
      )
    )
      continue;
    const isTracked = pref === "沖縄県" || pref === "計";
    const ctx = `${file} ${pref}${muni}`;
    const block: number[] = [];
    for (let c = moushiCol; c <= taikiCol; c++) {
      block.push(toInt(row[c], `${ctx} col${c}`, isTracked ? blanks : null));
    }
    // 恒等式: 申込者数 = Σ(中間列) + 待機児童
    const mid = block.slice(1, -1).reduce((a, v) => a + v, 0);
    if (block[0] !== mid + block[block.length - 1]) {
      throw new Error(
        `${ctx}: 恒等式不成立 申込${block[0]} ≠ 中間計${mid}+待機${block[block.length - 1]}`
      );
    }
    checkedRows++;
    if (pref === "計") {
      if (national) throw new Error(`${file}: 計行が重複`);
      national = block;
    } else if (pref === "沖縄県") {
      okinawa.push({ muni, block });
    }
  }
  if (!national) throw new Error(`${file}: 計行が見つかりません`);
  if (okinawa.length !== 41)
    throw new Error(`${file}: 沖縄県の行が ${okinawa.length} 行(41でない)`);

  return {
    file,
    title,
    headerLabels: header.slice(moushiCol, taikiCol + 1),
    national,
    okinawa,
    checkedRows,
    blanks,
  };
}
