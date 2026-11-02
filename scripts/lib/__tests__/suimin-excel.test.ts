/**
 * suimin-excel.ts の変換テスト。
 *
 * 「時.分」表記(60進)の変換は、Excel 浮動小数の桁落ちで 7.45 が 7.4499… に
 * なると 7時間44分 に化ける。実装は toFixed(2) を経由してこれを避けているが、
 * 壊れても例外にならず「もっともらしい別の数値」になる種類の欠陥なので、
 * 変換結果そのものを固定する。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { asMinutes, hmmToMinutes, normalizeName } from "../suimin-excel";

test("半角空白で詰められた県名を正規化する", () => {
  assert.equal(normalizeName("沖 縄 県"), "沖縄県");
});

test("全角空白で詰められた県名を正規化する", () => {
  assert.equal(normalizeName("沖　縄　県"), "沖縄県");
});

test("値が無い場合は空文字にする", () => {
  assert.equal(normalizeName(null), "");
  assert.equal(normalizeName(undefined), "");
});

test("時.分表記を分に直す", () => {
  assert.equal(hmmToMinutes(7.45, "睡眠"), 7 * 60 + 45);
  assert.equal(hmmToMinutes(7.4, "睡眠"), 7 * 60 + 40);
  assert.equal(hmmToMinutes(8.05, "睡眠"), 8 * 60 + 5);
});

test("末尾のゼロを落とさない", () => {
  // 実測: String(7.4).split(".")[1] は "4"。小数第2位まで固定せずに分を取ると
  // 40 分が 4 分になる。例外にならず「もっともらしい別の数値」になるため、
  // 変換結果そのものを固定しておく。
  assert.equal(hmmToMinutes(7.4, "睡眠"), 460);
  assert.notEqual(hmmToMinutes(7.4, "睡眠"), 7 * 60 + 4);
  assert.equal(hmmToMinutes(8.05, "睡眠"), 485);
});

test("分部が 60 以上なら列の取り違えとして落とす", () => {
  // 実測: String(7.6).split(".")[1] は "6"。小数第2位まで固定しないと
  // このガードごとすり抜けて 7 時間 6 分になる。
  assert.throws(() => hmmToMinutes(7.6, "睡眠"), /分部が60以上/);
});

test("数値でない値は落とす", () => {
  assert.throws(
    () => hmmToMinutes("7.45", "睡眠"),
    /時.分表記の数値でありません/
  );
  assert.throws(() => hmmToMinutes(0, "睡眠"), /時.分表記の数値でありません/);
  assert.throws(
    () => hmmToMinutes(Number.NaN, "睡眠"),
    /時.分表記の数値でありません/
  );
});

test("分単位の正の整数だけを通す", () => {
  assert.equal(asMinutes(465, "睡眠"), 465);
  assert.throws(() => asMinutes(465.5, "睡眠"), /正の整数でありません/);
  assert.throws(() => asMinutes(-1, "睡眠"), /正の整数でありません/);
  assert.throws(() => asMinutes("X", "睡眠"), /正の整数でありません/);
});
