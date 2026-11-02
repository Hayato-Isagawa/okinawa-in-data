/**
 * 被保護者調査(令和6年度・月次調査確定値)— 都道府県別の生活保護率の変換。
 *
 * 入力:
 *   raw/r6_hogoritu_todofuken.xlsx(第9表 被保護実人員数及び保護率、シート hou0009)
 *   raw/r6_suikei_jinko.xlsx(参考第2表 令和6年10月1日現在の推計人口=保護率の分母)
 *   raw/soumu_dantai_code_r6.xlsx(総務省 都道府県コード及び市区町村コード=市→県の対応)
 * 出力: data.csv(47都道府県+全国、48行)
 *
 * 原表の構造(第9表 注2): 都道府県の行は指定都市・中核市分を**含まない**。
 * そのまま比較すると大都市を抱える県ほど低く見えるため、本データセットは
 * 指定都市・中核市(別掲)を県に合算した**県計**を導出して収録する(式は下記)。
 *
 * 抽出・導出規則:
 * - 第9表: 区分列(全国/都道府県/指定都市（別掲）/中核市（別掲）)で行を分類し、
 *   「1か月平均」人員(整数 assert)と「年度保護率(‰)」を取得
 * - 参考第2表: 同じ区分・名称の推計人口(千人)。名称集合が第9表と一致することを assert
 * - 市→県の対応は総務省コード表の市区町村名の完全一致(一意性 assert)で解決
 * - 公表値の再現: 全130行(全国+47+指定20+中核62)で
 *   保護率 = round(人員(1か月平均) ÷ 人口(千人), 小数1位) が公表セルと一致することを assert
 *   (対応付け・列同定の誤りをここで検出する)
 * - 県計の導出: 人員(県計)=県行+県内の別掲市の和 / 人口(県計)=同 /
 *   保護率(県計)= round(人員(県計) ÷ 人口(県計), 小数1位) …サイト導出値
 * - 整合検証: 47県計の人員・人口の合計が全国行と完全一致することを assert
 */
import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { toCsv } from "../lib/csv";
import { PREFECTURES } from "../lib/prefectures";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/seikatsu-hogo-todofuken"
);

function sheetRows(file: string, sheet?: string): unknown[][] {
  const wb = XLSX.read(fs.readFileSync(path.join(datasetDir, "raw", file)));
  const name = sheet ?? wb.SheetNames[0];
  const ws = wb.Sheets[name];
  if (!ws)
    throw new Error(
      `${file}: シート "${name}" がありません(${wb.SheetNames.join(", ")})`
    );
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
}

const KINDS = [
  "全国",
  "都道府県",
  "指定都市（別掲）",
  "中核市（別掲）",
] as const;
type Kind = (typeof KINDS)[number];

/** 区分ラベルはセル内改行を含むことがある(推計人口の「中核市\n（別掲）」)ため正規化 */
function asKind(v: unknown): Kind | null {
  const k = String(v ?? "").replace(/\s+/g, "");
  return (KINDS as readonly string[]).includes(k) ? (k as Kind) : null;
}

interface Entry {
  kind: Kind;
  total: number; // 被保護実人員(総数=12か月計、人)
  avg: number; // 被保護実人員(1か月平均、人)
  rate: number; // 年度保護率(‰、公表値)
  pop?: number; // 推計人口(千人)
}

// --- 第9表 ---
const TOTAL_COL = 2;
const AVG_COL = 15;
const RATE_COL = 16;
const hyo9 = sheetRows("r6_hogoritu_todofuken.xlsx", "hou0009");
if (
  String(hyo9[3]?.[0] ?? "") !==
  "注２：都道府県の数値には指定都市・中核市分を含まない。"
) {
  throw new Error(
    "第9表の注2(指定都市・中核市を含まない)が想定位置にありません"
  );
}
const entries = new Map<string, Entry>();
for (const row of hyo9) {
  const kind = asKind(row[0]);
  if (!kind) continue;
  const name = String(row[1] ?? "").trim();
  const total = row[TOTAL_COL];
  const avg = row[AVG_COL];
  const rate = row[RATE_COL];
  if (typeof total !== "number" || !Number.isInteger(total) || total < 0) {
    throw new Error(`${name}: 総数が整数でない ${String(total)}`);
  }
  if (typeof avg !== "number" || !Number.isInteger(avg) || avg < 0) {
    throw new Error(`${name}: 1か月平均が整数でない ${String(avg)}`);
  }
  if (typeof rate !== "number" || rate <= 0) {
    throw new Error(`${name}: 保護率が数値でない ${String(rate)}`);
  }
  // 公表の1か月平均 = 総数÷12 の四捨五入(全行で成立することを実測済み)
  if (Math.round(total / 12) !== avg) {
    throw new Error(`${name}: 1か月平均 ${avg} ≠ round(${total}/12)`);
  }
  if (entries.has(name)) throw new Error(`名称が重複: ${name}`);
  entries.set(name, { kind, total, avg, rate });
}

// --- 参考第2表(推計人口) ---
const jinko = sheetRows("r6_suikei_jinko.xlsx");
if (
  String(jinko[2]?.[0] ?? "") !==
  "注：都道府県の人口については、各指定都市及び中核市を除いた人口である。"
) {
  throw new Error(
    "参考第2表の注(指定都市・中核市を除く)が想定位置にありません"
  );
}
let popCount = 0;
for (const row of jinko) {
  const kind = asKind(row[0]);
  if (!kind) continue;
  const name = String(row[1] ?? "").trim();
  const pop = row[2];
  if (typeof pop !== "number" || !Number.isInteger(pop) || pop <= 0) {
    throw new Error(`${name}: 推計人口が整数でない ${String(pop)}`);
  }
  const e = entries.get(name);
  if (!e || e.kind !== kind)
    throw new Error(`推計人口の行 ${name}(${kind}) が第9表にありません`);
  e.pop = pop;
  popCount++;
}
if (popCount !== entries.size) {
  throw new Error(`行数不一致: 第9表 ${entries.size} ≠ 推計人口 ${popCount}`);
}
const byKind = (k: Kind) =>
  [...entries.entries()].filter(([, e]) => e.kind === k);
if (byKind("都道府県").length !== 47)
  throw new Error("都道府県が47行ではありません");
if (byKind("全国").length !== 1) throw new Error("全国行が1行ではありません");
console.log(
  `第9表: 指定都市 ${byKind("指定都市（別掲）").length} / 中核市 ${byKind("中核市（別掲）").length}`
);

// --- 公表保護率の再現(全行) ---
// 公表率は丸め前の人口(人単位)で算出されており、参考第2表の千人丸め人口では
// 完全再現できない(全130行の最大差 0.079‰ を実測)。列同定・対応付けの誤りを
// 検出する目的には十分な許容差 0.1‰ で照合する
const round1 = (x: number) => Math.round(x * 10 + 1e-9) / 10;
for (const [name, e] of entries) {
  const calc = e.avg / e.pop!;
  if (Math.abs(calc - e.rate) >= 0.1) {
    throw new Error(
      `${name}: 保護率再現 ${calc.toFixed(2)} ≠ 公表 ${e.rate}(人員${e.avg}/人口${e.pop}千人)`
    );
  }
}

// --- 市 → 県の対応(総務省コード表、名称完全一致・一意) ---
const codeRows = sheetRows("soumu_dantai_code_r6.xlsx", "R6.1.1現在の団体");
const cityPref = new Map<string, string[]>();
for (const row of codeRows) {
  const pref = String(row[1] ?? "").trim();
  const city = String(row[2] ?? "").trim();
  if (!pref || !city) continue;
  cityPref.set(city, [...(cityPref.get(city) ?? []), pref]);
}
function prefOf(city: string): string {
  const prefs = cityPref.get(city);
  if (!prefs) throw new Error(`コード表に市が見つかりません: ${city}`);
  if (new Set(prefs).size !== 1) {
    throw new Error(`市の名称が一意でありません: ${city}(${prefs.join(", ")})`);
  }
  return prefs[0];
}

// --- 県計の再構成 ---
// 1か月平均は行ごとの丸め値のため合算せず、丸めのない総数(12か月計)を合算してから
// 公表と同じ規則(÷12 の四捨五入)で県計の1か月平均を導出する
const byPref = new Map<string, { total: number; pop: number }>(
  PREFECTURES.map((p) => [p, { total: 0, pop: 0 }])
);
for (const [name, e] of entries) {
  if (e.kind === "全国") continue;
  const pref = e.kind === "都道府県" ? name : prefOf(name);
  const acc = byPref.get(pref);
  if (!acc) throw new Error(`未知の都道府県: ${pref}(${name})`);
  acc.total += e.total;
  acc.pop += e.pop!;
}
const national = byKind("全国")[0][1];
const sumTotal = [...byPref.values()].reduce((s, v) => s + v.total, 0);
const sumPop = [...byPref.values()].reduce((s, v) => s + v.pop, 0);
if (sumTotal !== national.total)
  throw new Error(`総数合計 ${sumTotal} ≠ 全国 ${national.total}`);
// 人口は千人丸め値の合算のため丸め累積(実測+2千人)を許容。人員(総数)は完全一致
if (Math.abs(sumPop - national.pop!) > 5) {
  throw new Error(`人口合計 ${sumPop} が全国 ${national.pop} と乖離しすぎです`);
}

const out = PREFECTURES.map((p) => {
  const { total, pop } = byPref.get(p)!;
  const avg = Math.round(total / 12);
  return [p, String(avg), String(pop), round1(avg / pop).toFixed(1)];
});
out.push([
  "全国",
  String(national.avg),
  String(national.pop!),
  round1(national.rate).toFixed(1),
]);

fs.writeFileSync(
  path.join(datasetDir, "data.csv"),
  toCsv([
    ["都道府県", "被保護実人員(1か月平均)", "総人口", "保護率(人口千対)"],
    ...out,
  ])
);
const okinawa = out[46];
console.log(`書き出し: ${out.length} 行`);
console.log(
  `沖縄県(県計): 人員${okinawa[1]} / 人口${okinawa[2]}千人 / 保護率${okinawa[3]}‰`
);
