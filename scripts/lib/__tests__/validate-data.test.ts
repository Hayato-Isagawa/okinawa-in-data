/**
 * check:data(scripts/validate-data.ts)の relatedDatasets の照合のテスト。
 *
 * サイトに出るのは meta.json を持つデータセットだけなので(ADR 0007)、取り下げ中
 * (meta.json.hold)や準備中(raw/ だけ)のデータセットを relatedDatasets で指すと、関連
 * データセットのリンクが 404 になる。check:data はそれをエラーにする。実データには取り下げ中の
 * データセットが無い間があり、その間は照合をディレクトリ名すべてに戻しても check:data も CI も
 * 緑のまま通るので、ここで一時ディレクトリに置いて確かめる。
 *
 * validate-data.ts は読み込んだ時点で走って process.exit するので、子プロセスで回す。
 * データセットの置き場は cwd の data/datasets/ なので、cwd を一時ディレクトリにする。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(
  new URL("../../validate-data.ts", import.meta.url)
);
const TSX = import.meta.resolve("tsx");

// スキーマを通る最小の meta.json(src/lib/__tests__/datasets.test.ts と同じ形)。実在の
// データセットを写すと、その取り下げや改名でこのテストが無関係に落ちるので、ここに置く
const meta = {
  id: "sample",
  title: "サンプル",
  description: "check:data のテスト用",
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
  status: "draft",
};

/**
 * pointer が target を relatedDatasets で指す一時ディレクトリを作り、check:data を回す。
 * target は meta.json を持つ(published)・meta.json.hold にした(held)・raw/ だけ(draft)の 3 通り。
 * pointer には data.csv などが無いので別のエラーも出て exit code は 1 になる。そのため exit code では
 * なく、relatedDatasets の行がエラーの印(✗)で出ているかで見る(警告や通常の出力に落とすと通ってしまう)。
 */
function runCheck(target: "published" | "held" | "draft") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "check-data-related-"));
  const datasets = path.join(root, "data/datasets");
  try {
    fs.mkdirSync(path.join(datasets, "pointer"), { recursive: true });
    fs.writeFileSync(
      path.join(datasets, "pointer/meta.json"),
      JSON.stringify({ ...meta, id: "pointer", relatedDatasets: [target] })
    );
    if (target === "draft") {
      fs.mkdirSync(path.join(datasets, "draft/raw"), { recursive: true });
    } else {
      fs.mkdirSync(path.join(datasets, target), { recursive: true });
      fs.writeFileSync(
        path.join(
          datasets,
          target,
          target === "held" ? "meta.json.hold" : "meta.json"
        ),
        JSON.stringify({ ...meta, id: target })
      );
    }
    const r = spawnSync(process.execPath, ["--import", TSX, SCRIPT], {
      cwd: root,
      encoding: "utf-8",
    });
    assert.equal(r.error, undefined);
    const out = `${r.stdout}${r.stderr}`;
    // 起動に失敗して何も出さなかった回を「relatedDatasets のエラーなし」と読まない
    assert.match(out, /datasets: \d+ \/ 準備中: \d+/);
    return {
      status: r.status,
      related: out.split("\n").filter((l) => l.includes("relatedDatasets")),
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("relatedDatasets が meta.json を持つデータセットを指すなら、その照合ではエラーにしない", () => {
  const r = runCheck("published");
  assert.deepEqual(r.related, []);
});

test("relatedDatasets が meta.json.hold にした(取り下げ中の)データセットを指すとエラーにする", () => {
  const r = runCheck("held");
  assert.equal(r.related.length, 1);
  assert.match(
    r.related[0],
    /^✗ pointer: relatedDatasets "held" が存在しません/
  );
  assert.equal(r.status, 1);
});

test("relatedDatasets が raw/ だけの(準備中の)データセットを指すとエラーにする", () => {
  const r = runCheck("draft");
  assert.equal(r.related.length, 1);
  assert.match(
    r.related[0],
    /^✗ pointer: relatedDatasets "draft" が存在しません/
  );
  assert.equal(r.status, 1);
});
