/**
 * csv.ts の変換テスト。
 *
 * data.csv はサイトが配信する数値そのものなので、パーサの取りこぼしは
 * 「壊れて落ちる」ではなく「静かに違う数値を配信する」形で出る。
 * 引用符・埋め込み改行・CRLF の扱いを固定する。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, toCsv } from "../csv";

test("素の行を列に分解する", () => {
  assert.deepEqual(parseCsv("a,b\nc,d\n"), [
    ["a", "b"],
    ["c", "d"],
  ]);
});

test("末尾に改行が無くても最終行を落とさない", () => {
  assert.deepEqual(parseCsv("a,b"), [["a", "b"]]);
});

test("空文字は 0 行(空行 1 件にしない)", () => {
  assert.deepEqual(parseCsv(""), []);
});

test("空セルを保つ", () => {
  assert.deepEqual(parseCsv("a,,b\n"), [["a", "", "b"]]);
});

test("引用符の中のカンマは区切りにしない", () => {
  assert.deepEqual(parseCsv('"a,b",c\n'), [["a,b", "c"]]);
});

test("二重引用符はリテラルの引用符に戻す", () => {
  assert.deepEqual(parseCsv('"a""b",c\n'), [['a"b', "c"]]);
});

test("引用符の中の改行で行を切らない", () => {
  assert.deepEqual(parseCsv('"a\nb",c\n'), [["a\nb", "c"]]);
});

test("CRLF を 1 つの改行として扱う", () => {
  assert.deepEqual(parseCsv("a,b\r\nc,d\r\n"), [
    ["a", "b"],
    ["c", "d"],
  ]);
});

test("引用符で囲んだ空セルを空文字として読む", () => {
  assert.deepEqual(parseCsv('"",a\n'), [["", "a"]]);
});

test("特殊文字を含むセルだけ引用符で囲む", () => {
  assert.equal(
    toCsv([["a,b", 'c"d', "e\nf", "plain"]]),
    '"a,b","c""d","e\nf",plain\n'
  );
});

test("行末は改行で終える", () => {
  assert.equal(toCsv([["a"], ["b"]]), "a\nb\n");
});

test("書き出して読み直すと元に戻る", () => {
  const rows = [
    ["県名", "値", "備考"],
    ["沖縄県", "1234", 'カンマ, と "引用符" と\n改行'],
    ["東京都", "", "空セル"],
  ];
  assert.deepEqual(parseCsv(toCsv(rows)), rows);
});
