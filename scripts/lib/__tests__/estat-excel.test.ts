/**
 * estat-excel.ts の同定・検証テスト。
 *
 * collectOkinawaRows は「41 市町村がすべて揃っていること」を不変条件にしている。
 * ここが緩むと、取り違えや取りこぼしに気づかないまま市町村マップが 1 件欠けた
 * 状態で公開されうる。境界データ(geojson)を実体として使い、揃っていない入力で
 * 実際に落ちることまで確かめる。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  asInt,
  collectOkinawaRows,
  loadOkinawaMunicipalities,
} from "../estat-excel";

const munis = loadOkinawaMunicipalities();

/** code 列を 0 列目に置いた最小の行を作る */
const rowsFor = (codes: string[]): unknown[][] => codes.map((c) => [c, "値"]);

test("境界データから 41 市町村を読む", () => {
  assert.equal(munis.length, 41);
  assert.ok(munis.every((m) => /^\d{5}$/.test(m.code5)));
});

test("41 市町村がすべて揃っていれば全件返す", () => {
  const map = collectOkinawaRows(rowsFor(munis.map((m) => m.code5)), 0);
  assert.equal(map.size, 41);
});

test("6 桁コードでも先頭 5 桁で同定する", () => {
  const map = collectOkinawaRows(rowsFor(munis.map((m) => `${m.code5}1`)), 0);
  assert.equal(map.size, 41);
});

test("沖縄県以外の行は無視する", () => {
  const map = collectOkinawaRows(
    rowsFor([...munis.map((m) => m.code5), "13101", "01100"]),
    0
  );
  assert.equal(map.size, 41);
});

test("1 件でも欠けたら落とす", () => {
  const missing = munis.slice(1).map((m) => m.code5);
  assert.throws(
    () => collectOkinawaRows(rowsFor(missing), 0),
    /行が見つかりません/
  );
});

test("同じ市町村が 2 行あれば落とす", () => {
  const dup = [...munis.map((m) => m.code5), munis[0].code5];
  assert.throws(() => collectOkinawaRows(rowsFor(dup), 0), /重複しています/);
});

test("rowFilter で絞った結果 41 件に満たなければ落とす", () => {
  const all = rowsFor(munis.map((m) => m.code5));
  assert.throws(
    () =>
      collectOkinawaRows(all, 0, (row) => String(row[0]) === munis[0].code5),
    /行が見つかりません/
  );
});

test("整数セルだけを文字列化して通す", () => {
  assert.equal(asInt(1234, "人口"), "1234");
  assert.equal(asInt(0, "人口"), "0");
});

test("整数でないセルは落とす", () => {
  assert.throws(() => asInt(1.5, "人口"), /整数でありません/);
  assert.throws(() => asInt("1234", "人口"), /整数でありません/);
  assert.throws(() => asInt(Number.NaN, "人口"), /整数でありません/);
  assert.throws(() => asInt(null, "人口"), /整数でありません/);
});
