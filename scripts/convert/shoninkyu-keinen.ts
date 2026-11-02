/**
 * 新規学卒者の初任給の推移 沖縄県・全国(賃金構造基本統計調査 平成22〜令和7年)の変換。
 *
 * 系列は令和2年調査を境に2つ(定義・把握方法が異なり接続不可。raw/ACQUISITION.md §4):
 * - 旧系列(平成22〜令和元年): 「初任給額」= 通勤手当を除く確定初任給(事業所票)。
 *   参考表「都道府県、性、学歴別初任給額及び格差」から沖縄・全国計を抽出。
 * - 新系列(令和2〜7年): 「所定内給与額」= 通勤手当を含む6月分所定内給与(個人票)。
 *   都道府県別第4表から沖縄・全国を抽出。
 * 出力の data.csv は系列ごとに別列とし、他方の系列の年は空欄にする。
 *
 * 検証(不一致は throw):
 * - 全年で全国値を全国第1表(学歴別シート)の同区分値と突合(16年×2学歴=32組)
 * - 取得時に独立読み取りした錨(旧2年+新6年)と一致することを assert
 * - 令和7年の値が単年データセット shoninkyu-r7-todofuken の data.csv と一致
 *   することを assert(系列の接続確認。両 raw の同名ファイルはバイト同一を assert)
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv, toCsv } from "../lib/csv";
import { readHyo4, readSanko1, readZenkokuHyo1 } from "../lib/shoninkyu-excel";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/shoninkyu-keinen"
);
const raw = (f: string) => path.join(datasetDir, "raw", f);

interface YearSpec {
  label: string; // 調査年(和暦)
  kyu: boolean; // 旧系列(〜令和元年)
  pref: string; // 都道府県別ファイル(旧=sanko1/新=表4)
  zenkoku: string; // 全国第1表ファイル
}

const YEARS: YearSpec[] = [
  {
    label: "平成22年",
    kyu: true,
    pref: "chingin_h22_todofuken_sanko1_000008283874.xls",
    zenkoku: "chingin_h22_zenkoku_hyo1_000008278756.xls",
  },
  {
    label: "平成23年",
    kyu: true,
    pref: "chingin_h23_todofuken_sanko1_000012738833.xls",
    zenkoku: "chingin_h23_zenkoku_hyo1_000012738830.xls",
  },
  {
    label: "平成24年",
    kyu: true,
    pref: "chingin_h24_todofuken_sanko1_000016359330.xls",
    zenkoku: "chingin_h24_zenkoku_hyo1_000016359327.xls",
  },
  {
    label: "平成25年",
    kyu: true,
    pref: "chingin_h25_todofuken_sanko1_000023602741.xls",
    zenkoku: "chingin_h25_zenkoku_hyo1_000023602738.xls",
  },
  {
    label: "平成26年",
    kyu: true,
    pref: "chingin_h26_todofuken_sanko1_000026309111.xls",
    zenkoku: "chingin_h26_zenkoku_hyo1_000026309108.xls",
  },
  {
    label: "平成27年",
    kyu: true,
    pref: "chingin_h27_todofuken_sanko1_000029008231.xls",
    zenkoku: "chingin_h27_zenkoku_hyo1_000029008228.xls",
  },
  {
    label: "平成28年",
    kyu: true,
    pref: "chingin_h28_todofuken_sanko1_000031229227.xls",
    zenkoku: "chingin_h28_zenkoku_hyo1_000031229224.xls",
  },
  {
    label: "平成29年",
    kyu: true,
    pref: "chingin_h29_todofuken_sanko1_000031559921.xls",
    zenkoku: "chingin_h29_zenkoku_hyo1_000031559918.xls",
  },
  {
    label: "平成30年",
    kyu: true,
    pref: "chingin_h30_todofuken_sanko1_000031683222.xls",
    zenkoku: "chingin_h30_zenkoku_hyo1_000031683219.xls",
  },
  {
    label: "令和元年",
    kyu: true,
    pref: "chingin_r1_todofuken_sanko1_000031919937.xls",
    zenkoku: "chingin_r1_zenkoku_hyo1_000031919934.xls",
  },
  {
    label: "令和2年",
    kyu: false,
    pref: "chingin_r2_todofuken_hyo4_000032069533.xls",
    zenkoku: "chingin_r2_zenkoku_hyo1_000032069485.xls",
  },
  {
    label: "令和3年",
    kyu: false,
    pref: "chingin_r3_todofuken_hyo4_000032183054.xlsx",
    zenkoku: "chingin_r3_zenkoku_hyo1_000032183006.xlsx",
  },
  {
    label: "令和4年",
    kyu: false,
    pref: "chingin_r4_todofuken_hyo4_000040029283.xlsx",
    zenkoku: "chingin_r4_zenkoku_hyo1_000040029235.xlsx",
  },
  {
    label: "令和5年",
    kyu: false,
    pref: "chingin_r5_todofuken_hyo4_000040163843.xlsx",
    zenkoku: "chingin_r5_zenkoku_hyo1_000040163795.xlsx",
  },
  {
    label: "令和6年",
    kyu: false,
    pref: "chingin_r6_todofuken_hyo4_000040247956.xlsx",
    zenkoku: "chingin_r6_zenkoku_hyo1_000040247908.xlsx",
  },
  {
    label: "令和7年",
    kyu: false,
    pref: "chingin_r7_todofuken_hyo4_000040421199.xlsx",
    zenkoku: "chingin_r7_zenkoku_hyo1_000040420917.xlsx",
  },
];

const KYU_NOTE =
  "旧系列(初任給額=通勤手当を除く確定初任給)。令和2年調査から定義・把握方法が変更されたため令和2年以降の値と接続不可";

interface YearValues {
  koko_oki: string;
  koko_zen: string;
  daigaku_oki: string;
  daigaku_zen: string;
}

const byYear = new Map<string, YearValues>();
let crossChecked = 0;
for (const y of YEARS) {
  let v: YearValues;
  if (y.kyu) {
    const { values } = readSanko1(raw(y.pref));
    v = {
      koko_oki: values.get("沖縄県")!.高校卒,
      koko_zen: values.get("全国")!.高校卒,
      daigaku_oki: values.get("沖縄県")!.大学卒,
      daigaku_zen: values.get("全国")!.大学卒,
    };
    // 全国第1表(高校卒・大学卒シート)との突合
    for (const [sheet, got] of [
      ["高校卒", v.koko_zen],
      ["大学卒", v.daigaku_zen],
    ] as const) {
      const want = readZenkokuHyo1(raw(y.zenkoku), sheet, true);
      if (got !== want)
        throw new Error(
          `${y.label} 全国第1表突合不一致: ${sheet} 参考表=${got} ≠ 第1表=${want}`
        );
      crossChecked++;
    }
  } else {
    const { values } = readHyo4(raw(y.pref));
    v = {
      koko_oki: values.get("沖縄県")!.高校,
      koko_zen: values.get("全国")!.高校,
      daigaku_oki: values.get("沖縄県")!.大学,
      daigaku_zen: values.get("全国")!.大学,
    };
    for (const [sheet, got] of [
      ["高校", v.koko_zen],
      ["大学", v.daigaku_zen],
    ] as const) {
      const want = readZenkokuHyo1(raw(y.zenkoku), sheet, false);
      if (got !== want)
        throw new Error(
          `${y.label} 全国第1表突合不一致: ${sheet} 表4=${got} ≠ 第1表=${want}`
        );
      crossChecked++;
    }
  }
  for (const [k, s] of Object.entries(v)) {
    if (s === "-")
      throw new Error(`${y.label} ${k}: 欠損「-」は想定外(全年で値があるはず)`);
  }
  byYear.set(y.label, v);
}
if (crossChecked !== YEARS.length * 2) {
  throw new Error(`全国第1表の突合件数 ${crossChecked} ≠ ${YEARS.length * 2}`);
}

// スポット錨(取得時の独立読み取り値、raw/ACQUISITION.md §5)
// [年, 全国大学, 沖縄大学, 全国高校, 沖縄高校]
const anchors: Array<[string, string, string, string, string]> = [
  ["令和7年", "262.3", "231.4", "207.3", "185.5"],
  ["令和6年", "248.3", "222.8", "197.5", "173.6"],
  ["令和5年", "237.3", "234.6", "186.8", "164.9"],
  ["令和4年", "228.5", "196.9", "181.2", "179.0"],
  ["令和3年", "225.4", "214.0", "179.7", "166.0"],
  ["令和2年", "226.0", "185.4", "177.7", "171.8"],
  ["令和元年", "210.2", "175.0", "167.4", "145.2"],
  ["平成22年", "197.4", "165.7", "157.8", "124.3"],
];
for (const [label, dz, doki, kz, koki] of anchors) {
  const v = byYear.get(label)!;
  const got = [v.daigaku_zen, v.daigaku_oki, v.koko_zen, v.koko_oki].join(",");
  const want = [dz, doki, kz, koki].join(",");
  if (got !== want) throw new Error(`錨不一致: ${label} [${got}] ≠ [${want}]`);
}

// 単年データセット shoninkyu-r7-todofuken との接続検証
const tanenDir = path.resolve(
  process.cwd(),
  "data/datasets/shoninkyu-r7-todofuken"
);
const sameFile = "chingin_r7_todofuken_hyo4_000040421199.xlsx";
if (
  !fs
    .readFileSync(raw(sameFile))
    .equals(fs.readFileSync(path.join(tanenDir, "raw", sameFile)))
) {
  throw new Error(`raw の ${sameFile} が単年データセット側とバイト不一致`);
}
const tanen = parseCsv(
  fs.readFileSync(path.join(tanenDir, "data.csv"), "utf-8")
);
const tHeader = tanen[0];
const tCol = (name: string) => {
  const c = tHeader.indexOf(name);
  if (c < 0) throw new Error(`単年 data.csv に列 "${name}" がありません`);
  return c;
};
const r7 = byYear.get("令和7年")!;
for (const [area, koko, daigaku] of [
  ["全国", r7.koko_zen, r7.daigaku_zen],
  ["沖縄県", r7.koko_oki, r7.daigaku_oki],
] as const) {
  const row = tanen.find((r) => r[0] === area);
  if (!row) throw new Error(`単年 data.csv に ${area} 行がありません`);
  if (row[tCol("高校")] !== koko || row[tCol("大学")] !== daigaku) {
    throw new Error(
      `単年データセットとの接続不一致: ${area} 高校=${koko}/大学=${daigaku} ≠ 単年 ${row[tCol("高校")]}/${row[tCol("大学")]}`
    );
  }
}

const header = [
  "調査年",
  "初任給額_高校卒_沖縄",
  "初任給額_高校卒_全国",
  "初任給額_大学卒_沖縄",
  "初任給額_大学卒_全国",
  "所定内給与額_高校_沖縄",
  "所定内給与額_高校_全国",
  "所定内給与額_大学_沖縄",
  "所定内給与額_大学_全国",
  "備考",
];
const out: string[][] = YEARS.map((y) => {
  const v = byYear.get(y.label)!;
  return y.kyu
    ? [
        y.label,
        v.koko_oki,
        v.koko_zen,
        v.daigaku_oki,
        v.daigaku_zen,
        "",
        "",
        "",
        "",
        KYU_NOTE,
      ]
    : [
        y.label,
        "",
        "",
        "",
        "",
        v.koko_oki,
        v.koko_zen,
        v.daigaku_oki,
        v.daigaku_zen,
        "",
      ];
});

fs.writeFileSync(path.join(datasetDir, "data.csv"), toCsv([header, ...out]));
console.log(
  `書き出し: ${out.length} 行(平成22〜令和7年)。全国第1表突合 ${crossChecked}/32、錨 ${anchors.length} 年、単年接続 OK`
);
console.log(
  `旧系列末(令和元年): 沖縄 大学卒${byYear.get("令和元年")!.daigaku_oki} / 新系列末(令和7年): 沖縄 大学${r7.daigaku_oki}`
);
