/**
 * 学校保健統計調査(令和7年度) 表8 12歳・計 — 都道府県別 むし歯・裸眼視力。
 *
 * 入力: raw/r7_hyo8_pref_shippei.xlsx(e-Stat statInfId 000040409514)
 * 出力: data.csv(48行 = 全国 + 47都道府県、JIS コード順)
 *
 * 抽出規則:
 * - 12歳・計(男女計)シートのみ収録(都道府県別は年齢別のみの公表で、
 *   小学校計・中学校計といった学校段階別の県値は存在しない)
 * - 値は公表 Excel の表示文字列をそのまま保持(全国=小数第2位・県=第1位)
 * - 記号セルは空欄化: 裸眼視力1.0未満は 秋田・富山・三重・兵庫・長崎=「X」
 *   (非公表)、神奈川・滋賀=「－」(計数がない)の7県(raw 実見で全裸眼列が
 *   記号であることを確認済み)。歯科系4列は全県数値あり。この7件だけという
 *   既知の状態を assert で固定する
 * 検証:
 * - ヘッダ文言 assert で列ズレを検知(lib/gakko-hoken-excel)
 * - 各行で 処置完了者+未処置歯のある者 ≒ むし歯計(独立丸めの許容差
 *   全国=0.0151 / 県=0.151)
 */
import fs from "node:fs";
import path from "node:path";
import { toCsv } from "../lib/csv";
import {
  assertMushibaIdentity,
  extractRow,
  load12SaiKei,
} from "../lib/gakko-hoken-excel";
import { PREFECTURES } from "../lib/prefectures";

const datasetDir = path.resolve(
  process.cwd(),
  "data/datasets/gakko-hoken-r7-todofuken"
);
const sheet = load12SaiKei(
  path.join(datasetDir, "raw", "r7_hyo8_pref_shippei.xlsx")
);

const out = ["全国", ...PREFECTURES].map((target) => {
  const v = extractRow(sheet, target);
  assertMushibaIdentity(target, v, target === "全国" ? 0.0151 : 0.151);
  return [target, v.mushibaKei, v.shochi, v.mishochi, v.dmfKei, v.raganKei];
});

// 記号セルはこの raw では7県の裸眼視力のみ(変われば気づけるよう固定)
const expectedSpecials = [
  "秋田県 裸眼視力1.0未満=X",
  "神奈川県 裸眼視力1.0未満=－",
  "富山県 裸眼視力1.0未満=X",
  "三重県 裸眼視力1.0未満=X",
  "滋賀県 裸眼視力1.0未満=－",
  "兵庫県 裸眼視力1.0未満=X",
  "長崎県 裸眼視力1.0未満=X",
];
if (JSON.stringify(sheet.specials) !== JSON.stringify(expectedSpecials)) {
  throw new Error(`記号セルが想定と不一致: ${JSON.stringify(sheet.specials)}`);
}

fs.writeFileSync(
  path.join(datasetDir, "data.csv"),
  toCsv([
    [
      "区分",
      "むし歯（う歯）",
      "処置完了者",
      "未処置歯のある者",
      "平均むし歯等数",
      "裸眼視力1.0未満",
    ],
    ...out,
  ])
);
const zenkoku = out[0];
const okinawa = out[out.length - 1];
console.log(
  `書き出し: ${out.length} 行(全国+47都道府県)、記号→空欄 ${sheet.specials.length} セル`
);
console.log(`全国: むし歯${zenkoku[1]} 平均${zenkoku[4]}本 裸眼${zenkoku[5]}`);
console.log(`沖縄: むし歯${okinawa[1]} 平均${okinawa[4]}本 裸眼${okinawa[5]}`);
