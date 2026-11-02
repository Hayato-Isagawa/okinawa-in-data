/**
 * gakko-hoken-excel.ts の行同定・セル検証・恒等式テスト。
 *
 * assertMushibaIdentity は「処置完了者 + 未処置歯 = むし歯計」という内訳の
 * 恒等式で列の取り違えを捕まえる検算。検算が効かなくなっても出力は出てしまう
 * ので、成立しない値で実際に落ちることを確かめる。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertMushibaIdentity,
  extractRow,
  findRow,
  type Hoken12Row,
  type Hoken12Sheet,
} from "../gakko-hoken-excel";

/** 列配置は labelCol=0、値は 1..5 列に置いた最小シート */
const sheetOf = (rows: unknown[][]): Hoken12Sheet => ({
  file: "test.xlsx",
  rows,
  layout: {
    labelCol: 0,
    cols: { ragan: 1, mushiba: 2, shochi: 3, mishochi: 4, dmf: 5 },
  },
  specials: [],
});

test("ラベル列から行を 1 つ特定する", () => {
  const sheet = sheetOf([["東京都"], ["沖縄県"], ["全国"]]);
  assert.equal(findRow(sheet, "沖縄県"), 1);
});

test("空白詰めのラベルも同一視する", () => {
  const sheet = sheetOf([["沖　　　縄"]]);
  assert.equal(findRow(sheet, "沖縄県"), 0);
});

test("該当が無ければ落とす", () => {
  assert.throws(
    () => findRow(sheetOf([["東京都"]]), "沖縄県"),
    /"沖縄県" が 0 個/
  );
});

test("該当が複数あれば落とす(取り違えの疑い)", () => {
  assert.throws(
    () => findRow(sheetOf([["沖縄県"], ["沖縄県"]]), "沖縄県"),
    /"沖縄県" が 2 個/
  );
});

test("行の 5 項目を表示文字列のまま取り出す", () => {
  const sheet = sheetOf([["沖縄県", "30.5", "50.0", "25.0", "25.0", "1.2"]]);
  assert.deepEqual(extractRow(sheet, "沖縄県"), {
    raganKei: "30.5",
    mushibaKei: "50.0",
    shochi: "25.0",
    mishochi: "25.0",
    dmfKei: "1.2",
  });
});

test("非公表記号は空文字にして記録する", () => {
  const sheet = sheetOf([["沖縄県", "X", "50.0", "25.0", "25.0", "－"]]);
  const row = extractRow(sheet, "沖縄県");
  assert.equal(row.raganKei, "");
  assert.equal(row.dmfKei, "");
  assert.deepEqual(sheet.specials, [
    "沖縄県 裸眼視力1.0未満=X",
    "沖縄県 平均むし歯等数=－",
  ]);
});

test("率として有り得ない値は落とす(列ズレの検知)", () => {
  const sheet = sheetOf([["沖縄県", "130.0", "50.0", "25.0", "25.0", "1.2"]]);
  assert.throws(() => extractRow(sheet, "沖縄県"), /が不正/);
});

test("数値でないセルは落とす", () => {
  const sheet = sheetOf([["沖縄県", "約30", "50.0", "25.0", "25.0", "1.2"]]);
  assert.throws(() => extractRow(sheet, "沖縄県"), /が不正/);
});

const rowOf = (
  mushiba: string,
  shochi: string,
  mishochi: string
): Hoken12Row => ({
  raganKei: "30.0",
  mushibaKei: mushiba,
  shochi,
  mishochi,
  dmfKei: "1.0",
});

test("内訳の恒等式が成り立てば通す", () => {
  assert.doesNotThrow(() =>
    assertMushibaIdentity("沖縄県", rowOf("50.0", "25.0", "25.0"), 0.0151)
  );
});

test("丸め誤差の範囲は許容する", () => {
  assert.doesNotThrow(() =>
    assertMushibaIdentity("沖縄県", rowOf("50.0", "25.0", "25.01"), 0.0151)
  );
});

test("恒等式が成り立たなければ落とす", () => {
  assert.throws(
    () =>
      assertMushibaIdentity("沖縄県", rowOf("50.0", "25.0", "30.0"), 0.0151),
    /恒等式不成立/
  );
});

test("許容差を超えた分だけ落とす", () => {
  assert.throws(
    () =>
      assertMushibaIdentity("沖縄県", rowOf("50.0", "25.0", "25.1"), 0.0151),
    /恒等式不成立/
  );
  assert.doesNotThrow(() =>
    assertMushibaIdentity("沖縄県", rowOf("50.0", "25.0", "25.1"), 0.151)
  );
});

test("秘匿されている行は検証しない", () => {
  assert.doesNotThrow(() =>
    assertMushibaIdentity("沖縄県", rowOf("", "25.0", "25.0"), 0.0151)
  );
});
