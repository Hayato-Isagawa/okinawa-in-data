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

// スキーマを通る最小の meta.json。実在のデータセットを写すと、その取り下げや改名で
// このテストが無関係に落ちるので、ここに置く
const meta = {
  id: "sample",
  title: "サンプル",
  description: "ローダーのテスト用",
  themes: ["education"],
  sources: [
    {
      publisher: "テスト",
      title: "テスト資料",
      url: "https://example.com/source.pdf",
      retrievedAt: "2026-01-01",
      format: "pdf",
    },
  ],
  license: {
    name: "テスト用",
    url: "https://example.com/terms",
    confirmedAt: "2026-01-01",
  },
  conversion: {
    method: "テスト",
    script: "scripts/convert/sample.ts",
    verification: "テスト",
    convertedAt: "2026-01-01",
  },
  temporal: { coverageStart: "2025", coverageEnd: "2025", granularity: "年" },
  spatial: { level: "都道府県" },
  updateFrequency: "年1回",
  files: [
    {
      path: "data.csv",
      format: "csv",
      rowCount: 1,
      columns: [{ name: "値", type: "number", description: "テスト" }],
    },
  ],
  changelog: [{ date: "2026-01-01", description: "初版" }],
  status: "published",
};

test("meta.json の無いデータセットディレクトリは読まない", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "datasets-loader-"));

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
