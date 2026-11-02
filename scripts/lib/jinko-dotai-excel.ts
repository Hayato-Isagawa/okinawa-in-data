/**
 * 人口動態統計(確定数)の統計表 Excel から「人口動態総覧(率), 都道府県別」表を読むパーサ。
 *
 * 年により以下がすべて変わるため、位置決め打ちを避けて内容で特定する:
 * - シート名: 「総覧　第３表-２ 」(2005〜2007) / 「第３表-２」「第３表－２ 」(全角・半角ハイフン,
 *   末尾空白の揺れあり) / 「第５表」(令和6年)
 * - 都道府県名の列: 0 列目 または 1 列目
 * - 指標の列位置: 年により 1 列ずれる(早期新生児死亡率の有無など)
 *
 * さらに 2010・2011 年のファイルには「第３表-２ (注釈変更案)」という**前年の値が入った
 * 草案シート**が同梱されている(2010 年ファイルの当該シートは平成21年=2009 年の表)。
 * 取り違えると静かにデータが壊れるため、**表の年次が期待年と一致することを assert** して排除する。
 */
import fs from "node:fs";
import * as XLSX from "xlsx";
import { PREFECTURES } from "./prefectures";

/** 収録対象の指標。キーは正規化後のヘッダ文字列と完全一致する */
export const SORAN_METRICS = [
  "合計特殊出生率",
  "出生率",
  "死亡率",
  "自然増減率",
  "婚姻率",
  "離婚率",
] as const;
export type SoranMetric = (typeof SORAN_METRICS)[number];

/**
 * 列見出しの表記ゆれ。自然増減率は 2000 年代の表では「自然増加率」と表記されている
 * (定義は同じで、負値を取りうることを反映して改称されたもの)。
 */
const METRIC_HEADERS: Record<SoranMetric, string[]> = {
  合計特殊出生率: ["合計特殊出生率"],
  出生率: ["出生率"],
  死亡率: ["死亡率"],
  自然増減率: ["自然増減率", "自然増加率"],
  婚姻率: ["婚姻率"],
  離婚率: ["離婚率"],
};

export interface SoranTable {
  sheetName: string;
  year: number;
  /** 「全国」と 47 都道府県(正式名称)。値は表示文字列(負値は △ を - に正規化) */
  values: Map<string, Record<SoranMetric, string>>;
}

const ZEN_TO_HAN = (s: string): string =>
  s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** 空白・脚注記号・単位の括弧を落として比較用に正規化する */
function normHeader(v: unknown): string {
  return ZEN_TO_HAN(String(v ?? ""))
    .replace(/\s+/g, "")
    .replace(/（[^）]*）/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\d+[)）]/g, "");
}

function normName(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, "")
    .replace(/\d+[)）]/g, "");
}

/** 「平成17年」「令和６年」「(2024)」などから西暦を得る(見つからなければ null) */
function extractYear(text: string): number | null {
  const t = ZEN_TO_HAN(text);
  const wa = t.match(/(明治|大正|昭和|平成|令和)\s*(元|\d+)\s*年/);
  if (wa) {
    const n = wa[2] === "元" ? 1 : Number(wa[2]);
    const base: Record<string, number> = {
      明治: 1867,
      大正: 1911,
      昭和: 1925,
      平成: 1988,
      令和: 2018,
    };
    return base[wa[1]] + n;
  }
  const ad = t.match(/\((\d{4})\)/);
  return ad ? Number(ad[1]) : null;
}

/** 短縮名(「沖 縄」等)を含めて正式名称に解決する。都道府県でなければ null */
const NAME_LOOKUP: Map<string, string> = new Map();
for (const p of PREFECTURES) {
  NAME_LOOKUP.set(p, p);
  NAME_LOOKUP.set(p.replace(/[都道府県]$/, ""), p);
}

/** 「△ 7.6」→「-7.6」、「-」「…」→ ""(欠損)。それ以外は trim した表示文字列 */
function normValue(v: unknown, where: string): string {
  const s = String(v ?? "").replace(/\s+/g, "");
  if (s === "" || s === "-" || s === "…" || s === "－" || s === "・・・")
    return "";
  const m = s.match(/^[△▲](.+)$/);
  const body = m ? `-${m[1]}` : s;
  if (!/^-?\d+(\.\d+)?$/.test(body)) {
    throw new Error(`数値として読めない値: ${where} "${s}"`);
  }
  return body;
}

/** 総覧(率)の都道府県別表を 1 枚だけ特定して読む */
export function readSoranRitsu(
  filePath: string,
  expectedYear: number
): SoranTable {
  const wb = XLSX.read(fs.readFileSync(filePath));
  const hits: Array<{ name: string; rows: unknown[][]; nameCol: number }> = [];

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      raw: false,
    }) as unknown[][];
    const band = rows.slice(0, 8);
    const headText = band.flat().map(normHeader).join("|");
    if (!headText.includes("合計特殊") || !headText.includes("離婚率"))
      continue;

    // 表の年次が期待年と一致すること(前年の草案シート「(注釈変更案)」を排除する)
    const titleText = rows
      .slice(0, 5)
      .flat()
      .map((c) => String(c ?? ""))
      .join(" ");
    if (extractYear(titleText) !== expectedYear) continue;

    // 都道府県名の列(全国と沖縄の両方が現れる列)を探す
    let nameCol = -1;
    for (let c = 0; c <= 3 && nameCol === -1; c++) {
      const col = rows.map((r) => normName(r?.[c]));
      if (
        col.includes("全国") &&
        (col.includes("沖縄") || col.includes("沖縄県"))
      )
        nameCol = c;
    }
    if (nameCol === -1) continue;

    hits.push({ name, rows, nameCol });
  }

  if (hits.length !== 1) {
    throw new Error(
      `総覧(率)都道府県別表の特定に失敗(${hits.length}件): ${filePath} 期待年=${expectedYear} 候補=${hits
        .map((h) => h.name)
        .join(",")}`
    );
  }
  const { name: sheetName, rows, nameCol } = hits[0];

  // 列見出しは 2〜3 行に分割される(例: 「合計特殊6)」+「出生率」)。列ごとに連結して完全一致で引く。
  // 帯は「全国」行の手前まで。さらに表題行・年次行(「令和６年(2024)」)は非空セルが 1〜2 個しか
  // なく、年次セルが合計特殊出生率と同じ列に置かれる年があるため、非空 3 セル以上の行に絞る
  const firstDataRow = rows.findIndex((r) => normName(r?.[nameCol]) === "全国");
  if (firstDataRow < 1)
    throw new Error(`全国行の位置が想定外: ${filePath}/${sheetName}`);
  const headerBand = rows
    .slice(0, firstDataRow)
    .filter(
      (r) => (r ?? []).filter((c) => String(c ?? "").trim() !== "").length >= 3
    );
  const width = Math.max(...headerBand.map((r) => (r ? r.length : 0)));
  const colHeader: string[] = [];
  for (let c = 0; c < width; c++) {
    colHeader[c] = headerBand.map((r) => normHeader(r?.[c])).join("");
  }
  const metricCol = {} as Record<SoranMetric, number>;
  for (const m of SORAN_METRICS) {
    const accepted = METRIC_HEADERS[m];
    const idx = colHeader.findIndex((h) => accepted.includes(h));
    if (idx === -1)
      throw new Error(
        `指標の列が見つからない: ${filePath}/${sheetName} "${m}"`
      );
    metricCol[m] = idx;
  }

  const values: SoranTable["values"] = new Map();
  const seenPrefs: string[] = [];
  for (const row of rows) {
    const raw = normName(row?.[nameCol]);
    if (!raw) continue;
    const canonical = raw === "全国" ? "全国" : NAME_LOOKUP.get(raw);
    if (!canonical) continue; // 大都市再掲(札幌市 等)や注記行
    if (values.has(canonical)) continue; // 表頭再掲(右端の都道府県名列)対策
    const rec = {} as Record<SoranMetric, string>;
    for (const m of SORAN_METRICS) {
      rec[m] = normValue(
        row?.[metricCol[m]],
        `${filePath}/${sheetName} ${canonical} ${m}`
      );
    }
    values.set(canonical, rec);
    if (canonical !== "全国") seenPrefs.push(canonical);
  }

  if (seenPrefs.join(",") !== PREFECTURES.join(",")) {
    throw new Error(
      `都道府県の並びが想定外: ${filePath}/${sheetName} (${seenPrefs.length}件) 先頭=${seenPrefs.slice(0, 3)}`
    );
  }
  if (!values.has("全国"))
    throw new Error(`全国行が無い: ${filePath}/${sheetName}`);

  return { sheetName, year: expectedYear, values };
}
