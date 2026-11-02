/**
 * datasets.ts の公開範囲のテスト。
 *
 * データセットを取り下げるときは meta.json を meta.json.hold にリネームし、ローダーが
 * meta.json の無いディレクトリを読まないことでページ・配信ファイル・sitemap から外す。
 * e2e(tests/datasets.spec.ts)はビルド結果を実データと比べるので、取り下げ中の
 * データセットが 1 件も無い間はこの除外を確かめられない。ここでは一時ディレクトリに
 * 取り下げ中と準備中のデータセットを置き、実データの件数に関係なく確かめる。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { readDatasets } from "../datasets";

const REPO = path.resolve(import.meta.dirname, "../../..");
const SAMPLE = path.join(REPO, "data/datasets/gakko-hoken-keinen/meta.json");

test("meta.json の無いデータセットディレクトリは読まない", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datasets-loader-"));
  const meta = JSON.parse(fs.readFileSync(SAMPLE, "utf-8"));

  fs.mkdirSync(path.join(dir, "published"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "published/meta.json"),
    JSON.stringify({ ...meta, id: "published" })
  );
  // 取り下げ中: meta.json.hold にリネームしてある
  fs.mkdirSync(path.join(dir, "held"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "held/meta.json.hold"),
    JSON.stringify({ ...meta, id: "held" })
  );
  // 準備中: raw/ だけ先に置いてある
  fs.mkdirSync(path.join(dir, "draft/raw"), { recursive: true });

  try {
    assert.deepEqual(
      readDatasets(dir).map((d) => d.id),
      ["published"]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
