/**
 * 全国学力・学習状況調査 児童生徒質問調査「回答結果集計」Excel の共通パーサ。
 *
 * 都道府県版(NN[p|m]_25a.xlsx)は質問ごとに
 *   1段目=児童生徒数 / 2段目=都道府県(公立)の割合 / 空行 / 4段目=全国(公立)の割合
 * の4行ブロック、全国版(25[p|m]_402.xlsx)は
 *   1段目=児童生徒数 / 2段目=割合
 * の2行ブロック。割合は表示文字列(小数第1位・末尾空白付き)で保持する。
 * 選択肢は列6〜25、その他=列26・無回答=列27 の固定グリッド。
 */
import fs from "node:fs";
import * as XLSX from "xlsx";

export interface QuestionBlock {
  /** 質問番号の表示(全角、例「（２２）」) */
  number: string;
  /** 質問事項(空白除去済み) */
  text: string;
  /** 割合の表示文字列(選択肢1..n)。都道府県版は都道府県(公立)、全国版は全国(公立) */
  pct: string[];
  otherPct: string;
  noAnswerPct: string;
  /** 都道府県版のみ: 4段目の全国(公立)の割合 */
  nationalPct?: string[];
  nationalOtherPct?: string;
  nationalNoAnswerPct?: string;
}

export interface ShitsumonFile {
  /** 「沖縄県」等。全国版は「全国」 */
  area: string;
  grade: "小学校" | "中学校";
  blocks: QuestionBlock[];
}

const norm = (v: unknown): string => String(v ?? "").replace(/\s+/g, "");

const PCT_RE = /^\d{1,3}\.\d$/;

/** 割合セル列(6..25 が選択肢、26=その他、27=無回答)を読み取る */
function readPctRow(
  row: unknown[],
  where: string
): { pct: string[]; other: string; noAnswer: string } {
  const pct: string[] = [];
  for (let c = 6; c <= 25; c++) {
    const v = row[c];
    if (v === null || v === undefined || String(v).trim() === "") {
      // 選択肢は列6から連続して並ぶ。以降に値が現れたら構造想定が崩れている
      for (let d = c + 1; d <= 25; d++) {
        if (
          row[d] !== null &&
          row[d] !== undefined &&
          String(row[d]).trim() !== ""
        ) {
          throw new Error(`選択肢列が非連続: ${where} 列${d}`);
        }
      }
      break;
    }
    const s = String(v).trim();
    if (!PCT_RE.test(s))
      throw new Error(`割合の表示形式が想定外: ${where} 列${c} "${s}"`);
    pct.push(s);
  }
  if (pct.length === 0) throw new Error(`選択肢の割合が空: ${where}`);
  const other = String(row[26] ?? "").trim();
  const noAnswer = String(row[27] ?? "").trim();
  if (!PCT_RE.test(other) || !PCT_RE.test(noAnswer)) {
    throw new Error(
      `その他/無回答の表示形式が想定外: ${where} "${other}" "${noAnswer}"`
    );
  }
  return { pct, other, noAnswer };
}

function isEmptyPctArea(row: unknown[] | undefined): boolean {
  if (!row) return true;
  for (let c = 6; c <= 27; c++) {
    if (row[c] !== null && row[c] !== undefined && String(row[c]).trim() !== "")
      return false;
  }
  return true;
}

export function readShitsumonFile(
  filePath: string,
  kind: "pref" | "national"
): ShitsumonFile {
  const wb = XLSX.read(fs.readFileSync(filePath));
  const sheetName = wb.SheetNames[0];
  if (!/回答結果集計表/.test(norm(sheetName))) {
    throw new Error(`シート名が想定外: ${filePath} "${sheetName}"`);
  }
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    raw: false,
  }) as unknown[][];

  // 見出し(B3)から対象地域と学年を同定する
  const heading = norm(rows[2]?.[1]);
  const m = heading.match(/^(.+)－(児童|生徒)（公立）$/);
  if (!m) throw new Error(`見出しが想定外: ${filePath} "${heading}"`);
  const area = m[1];
  const grade = m[2] === "児童" ? "小学校" : "中学校";
  if (kind === "national" && area !== "全国") {
    throw new Error(`全国版の見出しが想定外: ${filePath} "${heading}"`);
  }
  if (kind === "pref") {
    // 都道府県版は B8 にも「<県名>（公立）」の見出しがある
    const sub = norm(rows[7]?.[1]);
    if (sub !== `${area}（公立）`) {
      throw new Error(
        `B8 見出し不一致: ${filePath} "${sub}" ≠ "${area}（公立）"`
      );
    }
  }

  const blocks: QuestionBlock[] = [];
  for (let i = 0; i < rows.length; i++) {
    const number = norm(rows[i]?.[1]);
    const text = norm(rows[i]?.[2]);
    if (!/^（.+）$/.test(number) || text === "") continue;

    const where = `${filePath} ${number}`;
    const own = readPctRow(rows[i + 1] ?? [], `${where} 2段目`);
    const block: QuestionBlock = {
      number,
      text,
      pct: own.pct,
      otherPct: own.other,
      noAnswerPct: own.noAnswer,
    };
    if (kind === "pref") {
      if (!isEmptyPctArea(rows[i + 2]))
        throw new Error(`3段目が空でない: ${where}`);
      const nat = readPctRow(rows[i + 3] ?? [], `${where} 4段目(全国)`);
      if (nat.pct.length !== own.pct.length) {
        throw new Error(
          `全国行の選択肢数不一致: ${where} ${own.pct.length} ≠ ${nat.pct.length}`
        );
      }
      block.nationalPct = nat.pct;
      block.nationalOtherPct = nat.other;
      block.nationalNoAnswerPct = nat.noAnswer;
    }
    blocks.push(block);
  }
  if (blocks.length === 0)
    throw new Error(`質問ブロックが見つからない: ${filePath}`);
  return { area, grade, blocks };
}

/** 質問事項の前方一致で質問ブロックを1件特定する(0件・複数件は例外) */
export function findQuestion(
  file: ShitsumonFile,
  textPrefix: string
): QuestionBlock {
  const key = norm(textPrefix);
  const hits = file.blocks.filter((b) => b.text.startsWith(key));
  if (hits.length !== 1) {
    throw new Error(
      `質問の特定に失敗(${hits.length}件): ${file.area} ${file.grade} "${textPrefix}"`
    );
  }
  return hits[0];
}

/** 選択肢+その他+無回答の合計が 100% 近傍(四捨五入誤差内)であることを検算する */
export function assertPctSum(block: QuestionBlock, where: string): void {
  const seqs: Array<[string[], string, string]> = [
    [block.pct, block.otherPct, block.noAnswerPct],
  ];
  if (block.nationalPct) {
    seqs.push([
      block.nationalPct,
      block.nationalOtherPct!,
      block.nationalNoAnswerPct!,
    ]);
  }
  for (const [pct, other, noAnswer] of seqs) {
    const sum = [...pct, other, noAnswer].reduce((a, v) => a + Number(v), 0);
    if (sum < 99.5 || sum > 100.5) {
      throw new Error(
        `割合合計が想定外: ${where} ${block.number} sum=${sum.toFixed(1)}`
      );
    }
  }
}
