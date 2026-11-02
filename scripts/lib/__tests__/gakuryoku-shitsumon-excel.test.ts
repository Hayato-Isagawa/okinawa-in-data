/**
 * gakuryoku-shitsumon-excel.ts の質問特定・合計検算テスト。
 *
 * assertPctSum は選択肢の割合合計が 100% 近傍であることの検算。都道府県版は
 * 県と全国の 2 系列を持ち、両方を検算しないと片側の列ズレを見逃す。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertPctSum,
  findQuestion,
  type QuestionBlock,
  type ShitsumonFile,
} from "../gakuryoku-shitsumon-excel";

const blockOf = (over: Partial<QuestionBlock> = {}): QuestionBlock => ({
  number: "（２２）",
  text: "自分には、よいところがあると思いますか",
  pct: ["40.0", "35.0", "15.0"],
  otherPct: "5.0",
  noAnswerPct: "5.0",
  ...over,
});

const fileOf = (blocks: QuestionBlock[]): ShitsumonFile => ({
  area: "沖縄県",
  grade: "小学校",
  blocks,
});

test("質問事項の前方一致で 1 件特定する", () => {
  const target = blockOf();
  const file = fileOf([blockOf({ text: "朝食を毎日食べていますか" }), target]);
  assert.equal(findQuestion(file, "自分には、よいところ"), target);
});

test("空白の入った検索語でも一致させる", () => {
  const target = blockOf();
  assert.equal(findQuestion(fileOf([target]), "自分には、 よいところ"), target);
});

test("該当が無ければ落とす", () => {
  assert.throws(
    () => findQuestion(fileOf([blockOf()]), "存在しない質問"),
    /特定に失敗\(0件\)/
  );
});

test("該当が複数あれば落とす", () => {
  assert.throws(
    () => findQuestion(fileOf([blockOf(), blockOf()]), "自分には"),
    /特定に失敗\(2件\)/
  );
});

test("合計が 100% 近傍なら通す", () => {
  assert.doesNotThrow(() => assertPctSum(blockOf(), "沖縄県 小学校"));
});

test("四捨五入の揺れは許容する", () => {
  assert.doesNotThrow(() =>
    assertPctSum(blockOf({ noAnswerPct: "5.4" }), "沖縄県 小学校")
  );
  assert.doesNotThrow(() =>
    assertPctSum(blockOf({ noAnswerPct: "4.6" }), "沖縄県 小学校")
  );
});

test("合計が足りなければ落とす", () => {
  assert.throws(
    () => assertPctSum(blockOf({ noAnswerPct: "0.0" }), "沖縄県 小学校"),
    /割合合計が想定外/
  );
});

test("合計が多すぎれば落とす", () => {
  assert.throws(
    () => assertPctSum(blockOf({ noAnswerPct: "9.0" }), "沖縄県 小学校"),
    /割合合計が想定外/
  );
});

test("全国系列も検算する(県だけ見て通さない)", () => {
  const block = blockOf({
    nationalPct: ["40.0", "35.0", "15.0"],
    nationalOtherPct: "5.0",
    nationalNoAnswerPct: "0.0", // 県側は 100.0 で正しく、全国側だけ 95.0
  });
  assert.throws(() => assertPctSum(block, "沖縄県 小学校"), /割合合計が想定外/);
});

test("両系列とも正しければ通す", () => {
  const block = blockOf({
    nationalPct: ["40.0", "35.0", "15.0"],
    nationalOtherPct: "5.0",
    nationalNoAnswerPct: "5.0",
  });
  assert.doesNotThrow(() => assertPctSum(block, "沖縄県 小学校"));
});
