// VRT が撮るビルド結果を配る scripts/serve-dist.mjs の挙動を固定する。
//
// CI の VRT は main 側も PR 側も PR のスクリプトで配るので、このサーバーが壊れても
// 両側が同じように壊れて差分 0 で通る(全部 404 でも page.goto は throw しない)。
// VRT からは見えないので、ここで直接リクエストして確かめる。
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.resolve(HERE, "../serve-dist.mjs");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "serve-dist-"));
const root = path.join(tmp, "dist");
const files = {
  "index.html": "<p>home</p>",
  "about/index.html": "<p>about</p>",
  "a.css": "p{}",
  "a.js": "1",
  "b.svg": "<svg/>",
  "f.woff2": "w",
  "x.pf_index": "i",
};
for (const [name, body] of Object.entries(files)) {
  fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
  fs.writeFileSync(path.join(root, name), body);
}
// root の外。dist の兄弟ディレクトリへの前方一致でも漏れないことを見る
fs.writeFileSync(path.join(tmp, "secret.txt"), "secret");
fs.mkdirSync(path.join(tmp, "dist-evil"));
fs.writeFileSync(path.join(tmp, "dist-evil/x.txt"), "evil");

let child;
let base;
let stderr = "";

// node --test の既定 timeout は無限なので、サーバーが応答しない・ログの書式が変わった
// ときに CI の job の制限まで黙って止まらないよう、起動とリクエストに上限を置く
test.before(
  async () => {
    child = spawn(process.execPath, [SCRIPT, root, "0"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stderr.on("data", (chunk) => (stderr += chunk));
    base = await new Promise((resolve, reject) => {
      let out = "";
      child.stdout.on("data", (chunk) => {
        out += chunk;
        const m = out.match(/http:\/\/localhost:(\d+)/);
        if (m) resolve(`http://127.0.0.1:${m[1]}`);
      });
      // stderr は pipe で集めているので、after の kill(SIGTERM)以外で終わったときは
      // 落ちた原因が読めるよう書き出す
      child.on("exit", (code, signal) => {
        if (signal !== "SIGTERM") process.stderr.write(stderr);
        reject(new Error(`exited early: ${code ?? signal}`));
      });
    });
  },
  { timeout: 10_000 }
);

test.after(() => {
  child?.kill();
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** fetch は URL の ../ を畳むので、root の外を狙うパスは呼ぶ側で %2f にエンコードして渡す */
function get(p, init = {}) {
  return fetch(base + p, {
    redirect: "manual",
    signal: AbortSignal.timeout(5_000),
    ...init,
  });
}

/** 子の stderr は応答と別の経路で届くので、少し待ってから判定する */
async function loggedSoon(text) {
  for (let i = 0; i < 50 && !stderr.includes(text); i++) {
    await new Promise((r) => setTimeout(r, 20));
  }
  return stderr.includes(text);
}

test("ディレクトリは末尾スラッシュ付きで index.html を返す", async () => {
  const res = await get("/about/");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(await res.text(), "<p>about</p>");
});

test("末尾スラッシュの無いディレクトリは付けて 301", async () => {
  const res = await get("/about");
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "/about/");
});

test("撮影に効く拡張子は正しい Content-Type で返す", async () => {
  const expected = {
    "/a.css": "text/css; charset=utf-8",
    "/a.js": "text/javascript; charset=utf-8",
    "/b.svg": "image/svg+xml",
    "/f.woff2": "font/woff2",
    "/x.pf_index": "application/octet-stream",
  };
  for (const [p, type] of Object.entries(expected)) {
    const res = await get(p);
    assert.equal(res.status, 200, p);
    assert.equal(res.headers.get("content-type"), type, p);
    await res.arrayBuffer();
  }
});

test("root の外は返さない", async () => {
  for (const p of [
    "/..%2fsecret.txt",
    "/%2e%2e%2fsecret.txt",
    "/about/..%2f..%2fsecret.txt",
    "/..%2fdist-evil/x.txt",
  ]) {
    const res = await get(p);
    assert.equal(res.status, 403, p);
    assert.doesNotMatch(await res.text(), /secret|evil/, p);
  }
});

test("無いパスは 404、不正なエンコードは 400", async () => {
  assert.equal((await get("/nope")).status, 404);
  assert.equal((await get("/%ZZ")).status, 400);
});

test("HEAD は本文を返さず、GET / HEAD 以外は 405", async () => {
  const head = await get("/a.css", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), "3");
  assert.equal(await head.text(), "");
  assert.equal((await get("/", { method: "POST" })).status, 405);
});

test("パスに NUL を含むと 400 で、サーバーは落ちない", async () => {
  assert.equal((await get("/%00")).status, 400);
  assert.equal((await get("/about/")).status, 200);
});

test("読めないファイルは 500 で、サーバーは落ちない", async () => {
  const file = path.join(root, "locked.css");
  fs.writeFileSync(file, "p{}");
  fs.chmodSync(file, 0o000);
  try {
    const res = await get("/locked.css");
    // root はパーミッションを無視して読めるので、skip せずに期待値を分ける
    // (assert-test-results は skip が 1 件でもあると落とす)
    if (process.getuid?.() === 0) {
      assert.equal(res.status, 200);
      assert.equal(await res.text(), "p{}");
    } else {
      assert.equal(res.status, 500);
      await res.arrayBuffer();
      assert.ok(await loggedSoon("EACCES"), stderr);
      assert.ok(stderr.includes("locked.css"), stderr);
    }
  } finally {
    fs.chmodSync(file, 0o644);
  }
  assert.equal((await get("/about/")).status, 200);
});

test("長すぎるパスは 404 で、サーバーは落ちない", async () => {
  // macOS も Linux もファイル名の上限は 255 バイト。超えると stat が ENAMETOOLONG を投げる
  assert.equal((await get(`/${"a".repeat(300)}`)).status, 404);
  assert.equal((await get("/about/")).status, 200);
  // ファイルとして存在しえないだけで、サーバー側の失敗ではないのでログに出さない
  assert.ok(!stderr.includes("ENAMETOOLONG"), stderr);
});

test("読めないディレクトリの配下は 500 で、サーバーは落ちない", async () => {
  const dir = path.join(root, "locked");
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, "a.css"), "p{}");
  fs.chmodSync(dir, 0o000);
  try {
    // root は読めてしまうので、読み取り失敗のテストと同じく期待値を分ける
    const expected = process.getuid?.() === 0 ? 200 : 500;
    assert.equal((await get("/locked/a.css")).status, expected);
    if (expected === 500) {
      assert.ok(await loggedSoon(path.join("locked", "a.css")), stderr);
    }
  } finally {
    fs.chmodSync(dir, 0o755);
  }
  assert.equal((await get("/about/")).status, 200);
});
