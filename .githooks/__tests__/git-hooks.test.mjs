// .githooks/ の pre-commit / pre-push が「落ちるべきときに落ちる」ことを固定する。
//
// GitHub 側でも main は ruleset で守っている(PR 必須・force push と削除の禁止)が、
// 止めるのは push の時点。このフックはそれより手前、commit と push を手元で止める。
// フックが壊れても git は黙って先へ進むので、壊れたことに気づく手段が無い。
//
// フックはシェルスクリプトなので、実際に使い捨ての git リポジトリを作り、
// 本物の git から見える状態(ブランチ名・SHA)を与えて exit code を見る。

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOKS = path.join(HERE, "..");
const ZERO = "0".repeat(40);

/** コミットが 2 件ある使い捨てリポジトリ。HEAD と HEAD~1 の実 SHA が要る。 */
function makeRepo() {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "githooks-"))
  );
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();

  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "test");
  git("config", "commit.gpgsign", "false");

  fs.writeFileSync(path.join(dir, "a.txt"), "one\n");
  git("add", "a.txt");
  git("commit", "-q", "-m", "one");
  fs.writeFileSync(path.join(dir, "a.txt"), "two\n");
  git("add", "a.txt");
  git("commit", "-q", "-m", "two");

  return {
    dir,
    git,
    head: git("rev-parse", "HEAD"),
    prev: git("rev-parse", "HEAD~1"),
  };
}

function runHook(name, repo, { stdin = "" } = {}) {
  const res = spawnSync("bash", [path.join(HOOKS, name)], {
    cwd: repo.dir,
    input: stdin,
    encoding: "utf8",
  });
  return { code: res.status, stderr: res.stderr || "" };
}

// --- pre-commit ---------------------------------------------------------

test("pre-commit: main と master ではコミットを拒否する", () => {
  const repo = makeRepo();

  const onMain = runHook("pre-commit", repo);
  assert.equal(onMain.code, 1);
  assert.match(onMain.stderr, /BLOCKED: direct commit on 'main' is forbidden/);

  repo.git("checkout", "-q", "-b", "master");
  const onMaster = runHook("pre-commit", repo);
  assert.equal(onMaster.code, 1);
  assert.match(onMaster.stderr, /direct commit on 'master' is forbidden/);
});

test("pre-commit: フィーチャーブランチでは通す", () => {
  const repo = makeRepo();
  repo.git("checkout", "-q", "-b", "feat/x");
  assert.equal(runHook("pre-commit", repo).code, 0);
});

test("pre-commit: 名前が main で始まるだけのブランチは main ではない", () => {
  const repo = makeRepo();
  repo.git("checkout", "-q", "-b", "main-rewrite");
  assert.equal(runHook("pre-commit", repo).code, 0);
});

test("pre-commit: 迂回手段を案内する(--no-verify)", () => {
  const repo = makeRepo();
  assert.match(runHook("pre-commit", repo).stderr, /--no-verify/);
});

test("pre-commit【既知の穴】コミットが 1 件も無い状態の最初のコミットは止まらない", () => {
  // 理由: 空リポジトリでも `git rev-parse --abbrev-ref HEAD` は **stdout に
  // `HEAD` を出して** exit 128 する。フック側は `|| echo ""` でフォールバック
  // するが、コマンド置換が拾うのは stdout の `HEAD` なので branch="HEAD" となり、
  // `main|master)` に一致しない。
  // (「ブランチ名が空になる」と書いていたのは誤り。2026-08-09 に実測して訂正)
  //
  // ファミリー全リポの pre-commit に共通する挙動で、既に履歴があるリポでは
  // 実害が無いので受容している。挙動を固定して、変わったら気づけるようにする。
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "githooks-empty-"))
  );
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  const res = spawnSync("bash", [path.join(HOOKS, "pre-commit")], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(res.status, 0);
});

test("pre-commit【既知の穴】detached HEAD でも止まらない", () => {
  // 同じ理由(branch が "HEAD" になる)。rebase / bisect 中の手動コミットは
  // 素通りする。**修正していない** — detached HEAD を一律で拒否すると
  // `git rebase` 中の正当なコミットまで止まるため。挙動を固定するだけにする。
  const repo = makeRepo();
  repo.git("checkout", "-q", "--detach");
  assert.equal(runHook("pre-commit", repo).code, 0);
});

// --- フック自体が壊れていないこと -------------------------------------

test("両フックとも実行ビットが立っている", () => {
  // git は core.hooksPath 配下のフックを **直接 exec** するので、実行ビットが
  // 落ちていると `hint: ... hook was ignored because it's not set as executable.`
  // を出して素通りする。テストは `bash <path>` で起動するためこの経路を通らず、
  // chmod -x しても全件緑のままだった(2026-08-09 の独立レビューで実測)。
  for (const name of ["pre-commit", "pre-push"]) {
    const mode = fs.statSync(path.join(HOOKS, name)).mode;
    assert.ok(mode & 0o111, `${name} に実行ビットが無い(git に無視される)`);
  }
});

test("両フックとも構文エラーにならない", () => {
  for (const name of ["pre-commit", "pre-push"]) {
    const res = spawnSync("bash", ["-n", path.join(HOOKS, name)], {
      encoding: "utf8",
    });
    assert.equal(res.status, 0, `${name}: ${res.stderr}`);
  }
});

// --- pre-push -----------------------------------------------------------
// stdin は 1 行につき "<local_ref> <local_sha> <remote_ref> <remote_sha>"。

test("pre-push: main への通常の push を拒否する", () => {
  const repo = makeRepo();
  const out = runHook("pre-push", repo, {
    stdin: `refs/heads/feat/x ${repo.head} refs/heads/main ${repo.prev}\n`,
  });
  assert.equal(out.code, 1);
  assert.match(out.stderr, /pushing directly to main is forbidden/);
});

test("pre-push: main の削除を拒否する", () => {
  const repo = makeRepo();
  const out = runHook("pre-push", repo, {
    stdin: `refs/heads/feat/x ${ZERO} refs/heads/main ${repo.head}\n`,
  });
  assert.equal(out.code, 1);
  assert.match(out.stderr, /deleting main is forbidden/);
});

test("pre-push: main への non-fast-forward を専用のメッセージで拒否する", () => {
  const repo = makeRepo();
  // local が remote の祖先 = 巻き戻し。
  const out = runHook("pre-push", repo, {
    stdin: `refs/heads/feat/x ${repo.prev} refs/heads/main ${repo.head}\n`,
  });
  assert.equal(out.code, 1);
  assert.match(out.stderr, /non-fast-forward push to main is forbidden/);
});

test("pre-push: main 以外のブランチ宛は通す", () => {
  const repo = makeRepo();
  const out = runHook("pre-push", repo, {
    stdin: `refs/heads/feat/x ${repo.head} refs/heads/feat/x ${repo.prev}\n`,
  });
  assert.equal(out.code, 0);
});

test("pre-push: 複数 ref のうち 2 行目が main でも拒否する", () => {
  const repo = makeRepo();
  const out = runHook("pre-push", repo, {
    stdin:
      `refs/heads/feat/x ${repo.head} refs/heads/feat/x ${repo.prev}\n` +
      `refs/heads/feat/y ${repo.head} refs/heads/main ${repo.prev}\n`,
  });
  assert.equal(out.code, 1);
});

test("pre-push: 何も push しない(空の stdin)なら通す", () => {
  const repo = makeRepo();
  assert.equal(runHook("pre-push", repo, { stdin: "" }).code, 0);
});

test("pre-push: 迂回手段を案内する(--no-verify)", () => {
  const repo = makeRepo();
  const out = runHook("pre-push", repo, {
    stdin: `refs/heads/feat/x ${repo.head} refs/heads/main ${repo.prev}\n`,
  });
  assert.match(out.stderr, /--no-verify/);
});
