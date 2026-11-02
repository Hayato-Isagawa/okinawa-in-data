/**
 * 賃金構造基本統計調査「新規学卒者の初任給」関係表の共通パーサ。
 * 男女計・産業計・企業規模計(10人以上)のみを扱う。
 *
 * 系列は令和2年調査を境に2つ(定義・把握方法が異なり接続不可):
 * - 新系列(令和2年〜): 都道府県別第4表「都道府県、新規学卒者の学歴別所定内給与額」
 *   (1シート、学歴7区分、通勤手当を含む6月分所定内給与額)+全国第1表(学歴別シート)。
 *   令和2年のみ旧 .xls で全体が1列右にずれるため、学歴ヘッダ行の内容で列位置を特定する。
 * - 旧系列(〜令和元年): 参考表「都道府県、性、学歴別初任給額及び格差」(学歴4区分、
 *   通勤手当を除く確定初任給額)+第1表「新規学卒者の初任給額」(学歴別シート)。
 *
 * 値は公表 Excel の表示文字列(raw:false)を保持(千円・小数第1位)。「-」=該当
 * サンプルなし(令和7年 利用上の一般的注意13(1))。行・列とも固定座標に依存せず、
 * ヘッダ文言・都道府県コード/名称の assert で特定する(不一致は throw)。
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PREFECTURES } from "./prefectures";

/** 新系列の学歴7区分(表4の列順) */
export const GAKUREKI_SHIN = [
  "学歴計",
  "中学",
  "高校",
  "専門学校",
  "高専・短大",
  "大学",
  "大学院",
] as const;
export type GakurekiShin = (typeof GAKUREKI_SHIN)[number];

/** 全角・半角空白と改行を除去 */
const N = (v: unknown): string => String(v ?? "").replace(/[\s　]+/g, "");

/** 短縮名(表内表記)→正式名称。北海道以外は末尾の都府県を除いた形 */
const SHORT_TO_FULL = new Map<string, string>(
  PREFECTURES.map((p) => [p === "北海道" ? p : p.replace(/[都府県]$/, ""), p])
);

/** 表示文字列が千円値(整数または小数)か欠損「-」であることを検証して返す */
function asKiloYen(v: unknown, label: string): string {
  const s = String(v ?? "").trim();
  if (s === "-") return "-";
  if (!/^\d+(\.\d+)?$/.test(s)) {
    throw new Error(`${label}: 千円値でない表示文字列 "${String(v)}"`);
  }
  return s;
}

function readRows(filePath: string, sheetName: string): unknown[][] {
  const wb = XLSX.read(fs.readFileSync(filePath));
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error(
      `${path.basename(filePath)}: シート "${sheetName}" がありません(存在: ${wb.SheetNames.join(", ")})`
    );
  }
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
}

export interface Hyo4Result {
  /** 地域(「全国」または正式都道府県名)→ 学歴7区分の表示文字列("-"含む) */
  values: Map<string, Record<GakurekiShin, string>>;
}

/**
 * 新系列 都道府県別第4表(男女計・産業計ブロックのみ)。
 * 学歴ヘッダ行の並びで基準列を特定し、表頭分割01=産業計であることを assert。
 */
export function readHyo4(filePath: string): Hyo4Result {
  const base = path.basename(filePath);
  const rows = readRows(filePath, "男女計、男、女");

  // 学歴ヘッダ行: 学歴計〜大学院が連続する最初の行・列
  let headerRow = -1;
  let blockCol = -1;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      if (GAKUREKI_SHIN.every((g, k) => N(row[c + k]) === g)) {
        headerRow = r;
        blockCol = c;
        break;
      }
    }
    if (headerRow >= 0) break;
  }
  if (headerRow < 0) throw new Error(`${base}: 学歴ヘッダ行が見つかりません`);

  // ブロック検証: 表頭分割01・産業計・企業規模計(10人以上)
  const colAt = (label: string, want: string) => {
    const hit = rows
      .slice(0, headerRow)
      .find((row) => (row ?? []).some((v) => N(v) === label));
    if (!hit || N(hit[blockCol]) !== N(want)) {
      throw new Error(`${base}: ${label} 行の基準列が「${want}」でありません`);
    }
  };
  colAt("表頭分割", "01");
  colAt("区分", "産業計");
  colAt("企業規模", "企業規模計（10人以上）");

  const values = new Map<string, Record<GakurekiShin, string>>();
  const readGakureki = (
    row: unknown[],
    label: string
  ): Record<GakurekiShin, string> =>
    Object.fromEntries(
      GAKUREKI_SHIN.map((g, k) => [
        g,
        asKiloYen(row[blockCol + k], `${base} ${label} ${g}`),
      ])
    ) as Record<GakurekiShin, string>;

  // 全国行(男女計)と続く47都道府県行
  const zenkokuIdx = rows.findIndex((row) =>
    (row ?? []).some((v) => N(v) === "男女計全国")
  );
  if (zenkokuIdx < 0)
    throw new Error(`${base}: 男女計・全国行が見つかりません`);
  values.set("全国", readGakureki(rows[zenkokuIdx], "全国"));

  const labelCol = rows[zenkokuIdx].findIndex((v) => N(v) === "男女計全国");
  for (let i = 0; i < PREFECTURES.length; i++) {
    const row = rows[zenkokuIdx + 1 + i] ?? [];
    const code = N(row[labelCol - 1]).padStart(2, "0");
    const name = SHORT_TO_FULL.get(N(row[labelCol]));
    if (code !== String(i + 1).padStart(2, "0") || name !== PREFECTURES[i]) {
      throw new Error(
        `${base}: 都道府県行のずれ(期待 ${PREFECTURES[i]}、実際 code="${code}" name="${String(row[labelCol])}")`
      );
    }
    values.set(name, readGakureki(row, name));
  }
  return { values };
}

/**
 * 全国第1表(新旧共通)の指定学歴シートから男女計・産業計・企業規模計(10人以上)の
 * 金額(新=所定内給与額/旧=初任給額、千円)を返す。
 */
export function readZenkokuHyo1(
  filePath: string,
  sheetName: string,
  kyu: boolean
): string {
  const base = path.basename(filePath);
  const rows = readRows(filePath, sheetName);

  // 企業規模計(10人以上)の列
  const kiboRow = rows.find((row) =>
    (row ?? []).some((v) => N(v).startsWith("企業規模計"))
  );
  if (!kiboRow)
    throw new Error(`${base} ${sheetName}: 企業規模計ヘッダが見つかりません`);
  const valueCol = kiboRow.findIndex((v) => N(v).startsWith("企業規模計"));

  // 金額列ラベル(旧=初任給額/新=所定内給与額)が同じ列にあることを assert
  const amountLabel = kyu ? "初任給額" : "所定内給与額";
  const amountRow = rows.find(
    (row) => N((row ?? [])[valueCol]) === amountLabel
  );
  if (!amountRow) {
    throw new Error(
      `${base} ${sheetName}: 金額列ラベル「${amountLabel}」が見つかりません`
    );
  }

  const dataRow = rows.find((row) => {
    const label = (row ?? []).slice(0, 9).map(N).join("");
    return label.includes("男女計") && label.includes("産業計");
  });
  if (!dataRow)
    throw new Error(`${base} ${sheetName}: 男女計・産業計行が見つかりません`);
  return asKiloYen(dataRow[valueCol], `${base} ${sheetName} 男女計・産業計`);
}

export interface Sanko1Result {
  /** 地域(「全国」または正式都道府県名)→ {大学卒, 高校卒} の表示文字列 */
  values: Map<string, { 大学卒: string; 高校卒: string }>;
}

/**
 * 旧系列 参考表「都道府県、性、学歴別初任給額及び格差」の男女計ブロックから
 * 大学卒・高校卒の初任給額(千円)を返す。値の右隣(注記フラグ列)が空であることを assert。
 */
export function readSanko1(filePath: string): Sanko1Result {
  const base = path.basename(filePath);
  const rows = readRows(filePath, "参考表");

  // 学歴ヘッダ行と男女計ブロックの範囲(2つ目の「都道府県」列まで)
  const headerIdx = rows.findIndex(
    (row) =>
      (row ?? []).some((v) => N(v) === "大学卒") &&
      (row ?? []).some((v) => N(v) === "高校卒")
  );
  if (headerIdx < 0) throw new Error(`${base}: 学歴ヘッダ行が見つかりません`);
  const header = rows[headerIdx];
  const prefCols = header
    .map((v, c) => (N(v) === "都道府県" ? c : -1))
    .filter((c) => c >= 0);
  if (prefCols.length < 2 || prefCols[0] !== 0) {
    throw new Error(`${base}: 都道府県ヘッダ列が想定外(${prefCols.join(",")})`);
  }
  const blockEnd = prefCols[1]; // 男ブロックの開始列
  const colOf = (label: string): number => {
    const c = header.findIndex((v, i) => i < blockEnd && N(v) === label);
    if (c < 0)
      throw new Error(`${base}: 男女計ブロックに「${label}」列がありません`);
    return c;
  };
  const daigakuCol = colOf("大学卒");
  const kokoCol = colOf("高校卒");

  const pick = (
    row: unknown[],
    label: string
  ): { 大学卒: string; 高校卒: string } => {
    for (const c of [daigakuCol, kokoCol]) {
      const flag = String(row[c + 1] ?? "").trim();
      if (flag !== "") {
        throw new Error(
          `${base} ${label}: 値の注記フラグ列が空でない "${flag}"`
        );
      }
    }
    return {
      大学卒: asKiloYen(row[daigakuCol], `${base} ${label} 大学卒`),
      高校卒: asKiloYen(row[kokoCol], `${base} ${label} 高校卒`),
    };
  };

  const values = new Map<string, { 大学卒: string; 高校卒: string }>();
  const seen: string[] = [];
  for (const row of rows.slice(headerIdx + 1)) {
    const label = N((row ?? [])[0]);
    if (label === "全国計") {
      if (values.has("全国")) throw new Error(`${base}: 全国計行が重複`);
      values.set("全国", pick(row, "全国計"));
      continue;
    }
    const m = label.match(/^(\d{2})(.+)$/);
    if (!m) continue;
    const name = SHORT_TO_FULL.get(m[2]);
    if (!name)
      throw new Error(`${base}: 未知の都道府県表記 "${String(row[0])}"`);
    const expected = PREFECTURES[Number(m[1]) - 1];
    if (name !== expected) {
      throw new Error(
        `${base}: コード ${m[1]} と名称 ${name} の不一致(期待 ${expected})`
      );
    }
    seen.push(name);
    values.set(name, pick(row, name));
  }
  if (!values.has("全国") || seen.join("|") !== PREFECTURES.join("|")) {
    throw new Error(
      `${base}: 全国計+47都道府県が揃いません(取得 ${values.size} 地域)`
    );
  }
  return { values };
}
