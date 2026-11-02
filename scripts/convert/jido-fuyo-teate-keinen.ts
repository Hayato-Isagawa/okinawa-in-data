/**
 * 福祉行政報告例(年度報)「児童扶養手当受給者数」 — 沖縄県・全国の推移
 * (平成25〜令和6年度・各年度末現在の12年分)。
 *
 * 入力: raw/ の各年度 CSV 12ファイル(e-Stat 提供、CP932。表番号は年度により第55〜59表)
 * 出力: data.csv(12行 × 受給者数・全部支給・一部支給 × 沖縄県計/全国)
 *
 * 抽出規則:
 * - 原表の都道府県行は指定都市・中核市(別掲)分を含まない(排他)ため、
 *   沖縄県計 = 「沖縄県」行 + 「那覇市」行(中核市、2013-04 移行)の合算で導出する
 * - レイアウトは3世代: g1=平成25〜令和元(地域名1列・全角スペース詰め)、
 *   g2=令和2〜4(都道府県列+市列)、g3=令和5〜6(支給対象者ブロック列が先頭に追加)。
 *   g3 は「総数」ブロックのみ使用(「国支給対象者」は全行「-」を assert)
 * - 列位置は固定せず、ヘッダ行の「総数」「全部支給」「一部支給」ラベルから特定する
 *   (「養育費受領者数（再掲）」列は除外)
 * 検証(全年度):
 * - 全部支給 + 一部支給 = 総数(全国・沖縄県行・那覇市行)
 * - 全国 = 47都道府県 + 指定都市・中核市(別掲)の総和(総数・全部・一部の3列とも)
 *   → 都道府県行が市分を含まないこと(=県+那覇市合算の根拠)の機械検証
 * - 沖縄県の市行が那覇市のみであること(g2/g3 は直接、g1 は市名リストで防御)
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv, toCsv } from "../lib/csv";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/jido-fuyo-teate-keinen"
);

type Gen = "g1" | "g2" | "g3";
const YEARS: Array<{
  label: string;
  file: string;
  gen: Gen;
  endLabel: string;
}> = [
  {
    label: "平成25年度",
    file: "h25_hyo55_jifu_setai.csv",
    gen: "g1",
    endLabel: "平成２５年度末現在",
  },
  {
    label: "平成26年度",
    file: "h26_hyo55_jifu_setai.csv",
    gen: "g1",
    endLabel: "平成２６年度末現在",
  },
  {
    label: "平成27年度",
    file: "h27_hyo56_jifu_setai.csv",
    gen: "g1",
    endLabel: "平成２７年度末現在",
  },
  {
    label: "平成28年度",
    file: "h28_hyo59_jifu_setai.csv",
    gen: "g1",
    endLabel: "平成２８年度末現在",
  },
  {
    label: "平成29年度",
    file: "h29_hyo59_jifu_setai.csv",
    gen: "g1",
    endLabel: "平成２９年度末現在",
  },
  {
    label: "平成30年度",
    file: "h30_hyo57_jifu_setai.csv",
    gen: "g1",
    endLabel: "平成３０年度末現在",
  },
  {
    label: "令和元年度",
    file: "r1_hyo56_jifu_setai.csv",
    gen: "g1",
    endLabel: "令和元年度末現在",
  },
  {
    label: "令和2年度",
    file: "r2_hyo55_jifu_setai.csv",
    gen: "g2",
    endLabel: "令和２年度（2020年度）末現在",
  },
  {
    label: "令和3年度",
    file: "r3_hyo55_jifu_setai.csv",
    gen: "g2",
    endLabel: "令和３年度（2021年度）末現在",
  },
  {
    label: "令和4年度",
    file: "r4_hyo56_jifu_setai.csv",
    gen: "g2",
    endLabel: "令和４年度（2022年度）末現在",
  },
  {
    label: "令和5年度",
    file: "r5_hyo56_jifu_setai.csv",
    gen: "g3",
    endLabel: "令和５年度（2023年度）末現在",
  },
  {
    label: "令和6年度",
    file: "r6_hyo56_jifu_setai.csv",
    gen: "g3",
    endLabel: "令和６年度（2024年度）末現在",
  },
];

// g1 の市行に沖縄県内の市が那覇市以外に現れないことの防御(中核市は那覇市のみが公式事実。
// g2/g3 は県列で直接 assert できるが、g1 は地域名しか無いため市名リストで検証する)
const OKINAWA_CITIES_EXCEPT_NAHA = [
  "沖縄市",
  "うるま市",
  "宜野湾市",
  "浦添市",
  "名護市",
  "糸満市",
  "豊見城市",
  "宮古島市",
  "石垣市",
  "南城市",
];

const norm = (s: string): string => s.replace(/[\s　]+/g, "");

function toInt(cell: string, ctx: string): number {
  const t = cell.replace(/,/g, "").trim();
  if (!/^\d+$/.test(t)) throw new Error(`${ctx}: 数値でないセル "${cell}"`);
  return Number(t);
}

interface Region {
  total: number;
  zenbu: number;
  ichibu: number;
}

interface YearData {
  national: Region;
  okiPref: Region;
  naha: Region;
}

function findColumns(
  rows: string[][],
  headerRange: [number, number],
  file: string
) {
  const [h0, h1] = headerRange;
  const isSaikei = (c: number): boolean => {
    for (let r = h0; r <= h1; r++) {
      if (norm(rows[r]?.[c] ?? "") === "養育費受領者数（再掲）") return true;
    }
    return false;
  };
  const findUnique = (label: string, excludeSaikei: boolean): number => {
    const hits: number[] = [];
    for (let r = h0; r <= h1; r++) {
      for (let c = 0; c < (rows[r]?.length ?? 0); c++) {
        if (norm(rows[r][c]) === label && !(excludeSaikei && isSaikei(c)))
          hits.push(c);
      }
    }
    const uniq = [...new Set(hits)];
    if (uniq.length !== 1)
      throw new Error(
        `${file}: 「${label}」列の特定に失敗(候補 ${uniq.join(",")})`
      );
    return uniq[0];
  };
  return {
    total: findUnique("総数", false),
    zenbu: findUnique("全部支給", true),
    ichibu: findUnique("一部支給", true),
  };
}

function loadYear(y: (typeof YEARS)[number]): YearData {
  const buf = fs.readFileSync(path.join(datasetDir, "raw", y.file));
  const rows = parseCsv(new TextDecoder("shift_jis").decode(buf));

  // 断面(年度末現在)と報告表の同定
  const head = rows.slice(0, 4).flat().join("");
  if (!head.includes(y.endLabel))
    throw new Error(`${y.file}: 「${y.endLabel}」が見出しに無い`);
  if (!norm(head).includes("児童扶養手当受給者数"))
    throw new Error(`${y.file}: 表題不一致`);
  if (!norm(head).includes("（報告表６１）"))
    throw new Error(`${y.file}: 報告表61でない`);

  const headerRange: [number, number] = y.gen === "g1" ? [4, 7] : [5, 9];
  const dataStart = y.gen === "g1" ? 8 : 10;
  const col = findColumns(rows, headerRange, y.file);
  const readRegion = (row: string[], ctx: string): Region => {
    const region = {
      total: toInt(row[col.total], `${ctx} 総数`),
      zenbu: toInt(row[col.zenbu], `${ctx} 全部支給`),
      ichibu: toInt(row[col.ichibu], `${ctx} 一部支給`),
    };
    if (region.zenbu + region.ichibu !== region.total) {
      throw new Error(
        `${ctx}: 全部${region.zenbu}+一部${region.ichibu}≠総数${region.total}`
      );
    }
    return region;
  };

  let national: Region | null = null;
  let okiPref: Region | null = null;
  let naha: Region | null = null;
  const prefs: Array<{ name: string; r: Region }> = [];
  const cities: Array<{ name: string; r: Region }> = [];

  if (y.gen === "g1") {
    // 地域名1列。全国 → 47都道府県 → 「指定都市（別掲）」「中核市（別掲）」区切りで市
    let section: "pref" | "city" = "pref";
    for (let i = dataStart; i < rows.length; i++) {
      const name = norm(rows[i][0] ?? "");
      if (name === "指定都市（別掲）" || name === "中核市（別掲）") {
        section = "city";
        continue;
      }
      if (!/^\d/.test((rows[i][col.total] ?? "").replace(/,/g, "").trim()))
        continue;
      const r = readRegion(rows[i], `${y.file} ${name}`);
      if (name === "全国") {
        if (national) throw new Error(`${y.file}: 全国行が重複`);
        national = r;
      } else if (section === "pref") {
        prefs.push({ name, r });
        if (name === "沖縄県") okiPref = r;
      } else {
        cities.push({ name, r });
        if (name === "那覇市") {
          if (naha) throw new Error(`${y.file}: 那覇市行が重複`);
          naha = r;
        }
        if (OKINAWA_CITIES_EXCEPT_NAHA.includes(name)) {
          throw new Error(`${y.file}: 沖縄県内の想定外の市行 ${name}`);
        }
      }
    }
  } else {
    // g2: col0=都道府県名, col1=市名 / g3: col0=支給対象者ブロック, col1=県, col2=市
    const off = y.gen === "g3" ? 1 : 0;
    for (let i = dataStart; i < rows.length; i++) {
      const row = rows[i];
      if (y.gen === "g3" && (row[0] ?? "") !== "総数") continue;
      if (!/^\d/.test((row[col.total] ?? "").replace(/,/g, "").trim()))
        continue;
      const pref = (row[off] ?? "").trim();
      const city = (row[off + 1] ?? "").trim();
      const r = readRegion(row, `${y.file} ${pref}${city}`);
      if (pref === "全国") {
        if (national) throw new Error(`${y.file}: 全国行が重複`);
        national = r;
      } else if (city === "") {
        prefs.push({ name: pref, r });
        if (pref === "沖縄県") okiPref = r;
      } else {
        cities.push({ name: city, r });
        if (pref === "沖縄県") {
          if (city !== "那覇市" || naha)
            throw new Error(
              `${y.file}: 沖縄県の市行が那覇市のみでない(${city})`
            );
          naha = r;
        }
      }
    }
    // g3: 「国支給対象者」ブロックが実数を持たない(=総数ブロックが経年連続)ことを確認
    if (y.gen === "g3") {
      const kuni = rows.filter((row) => (row[0] ?? "") === "国支給対象者");
      if (kuni.length === 0)
        throw new Error(`${y.file}: 国支給対象者ブロックが見つからない`);
      for (const row of kuni) {
        if ((row[col.total] ?? "").trim() !== "-") {
          throw new Error(
            `${y.file}: 国支給対象者に実数がある(${row[1]}${row[2]}: ${row[col.total]})`
          );
        }
      }
    }
  }

  if (!national || !okiPref || !naha) {
    throw new Error(`${y.file}: 全国/沖縄県/那覇市の行が揃わない`);
  }
  if (prefs.length !== 47)
    throw new Error(`${y.file}: 都道府県行が ${prefs.length} 行(47でない)`);

  // 分割恒等式: 全国 = 47都道府県 + 指定都市・中核市(別掲)の総和
  for (const key of ["total", "zenbu", "ichibu"] as const) {
    const sum =
      prefs.reduce((a, p) => a + p.r[key], 0) +
      cities.reduce((a, c) => a + c.r[key], 0);
    if (sum !== national[key]) {
      throw new Error(
        `${y.file}: ${key} の分割恒等式不成立 47県+市=${sum} ≠ 全国=${national[key]}`
      );
    }
  }
  return { national, okiPref, naha };
}

const out = YEARS.map((y) => {
  const d = loadYear(y);
  return [
    y.label,
    String(d.okiPref.total + d.naha.total),
    String(d.okiPref.zenbu + d.naha.zenbu),
    String(d.okiPref.ichibu + d.naha.ichibu),
    String(d.national.total),
    String(d.national.zenbu),
    String(d.national.ichibu),
  ];
});

fs.writeFileSync(
  path.join(datasetDir, "data.csv"),
  toCsv([
    [
      "年度",
      "受給者数_沖縄",
      "全部支給_沖縄",
      "一部支給_沖縄",
      "受給者数_全国",
      "全部支給_全国",
      "一部支給_全国",
    ],
    ...out,
  ])
);
console.log(`書き出し: ${out.length} 行(平成25〜令和6年度・各年度末現在)`);
for (const r of out) {
  console.log(
    `${r[0]}: 沖縄計${r[1]}(全部${r[2]}/一部${r[3]}) 全国${r[4]}(全部${r[5]}/一部${r[6]})`
  );
}
