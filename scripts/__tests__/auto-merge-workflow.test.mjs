// dependabot-auto-merge.yml の待機ロジックが「落ちるべきときに落ちる」ことを固定する。
//
// このワークフローは main への唯一の自動書き込み経路。branch protection が止めるのは
// required の check(Build site と Playwright E2E)だけなので、判定を 1 つ間違えると、
// VRT などが赤い依存更新が誰にも見られずに main へ入り、そのまま本番へデプロイされる。
//
// それでいて、壊れても**静かに**壊れる。実際 #83 で a11y.yml を e2e.yml に
// 置き換えたとき、待つ check の名前が古いまま残り、8/9 以降の Dependabot PR は
// 30 分沈黙してから CANCELLED になっていた(#94 で修正)。CI は緑のまま、
// 気づいたのは PR が 2 本溜まってからだった。
//
// シェルスクリプトなので、写しではなく**ワークフローに埋まっている本体**を
// 取り出して走らせる。gh と sleep はスタブに差し替え、check-runs API の応答を
// こちらで与えて exit code と挙動を見る。

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mergeKeyPaths,
  parseWorkflow,
  replaceOnce,
  triggerNames,
} from "./workflow-yaml.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS = path.join(HERE, "..", "..", ".github", "workflows");
const WORKFLOW = path.join(WORKFLOWS, "dependabot-auto-merge.yml");

/**
 * run: ブロック内のスカラー代入（MAX=60 など）を取り出す。
 * **テスト側に数値を写さない。** 写すと、ワークフローの予算を変えたときに
 * ここだけ古くなり、しかも「60 !== 45」という形でしか気づけない。
 */
function shellNumber(name) {
  const m = extractRunBlock(WORKFLOW).match(new RegExp(`^${name}=(\\d+)`, "m"));
  assert.ok(m, `${name} の定義が見つからない`);
  return Number(m[1]);
}

/**
 * run: ブロック内の配列リテラル（ANCHORS=("a" "b")）を取り出す。
 *
 * **囲みを `[^)]*` で取らない。** job 名は任意の文字列で、`)` を含みうる
 * （姉妹リポの 1 つが "axe (all pages)" を錨にしていた。
 * 2026-09 に a11y を e2e へ統合して消えたので、**現存する実例はもう無い**）。
 * 素朴に書くと最初の `)` で切れ、錨が複数あっても 1 本しか検査しないまま緑になる
 * — 実際にあちらへ移した際に踏んだ。行末側の `)` まで貪欲に取り、**引用符で
 * 囲まれた部分を除いた残りが空白だけであること**を不変条件として見る。
 * 読み切れなければ静かに減らさず、その場で落とす。
 */
function shellArray(name) {
  const m = extractRunBlock(WORKFLOW).match(
    new RegExp(`^${name}=\\((.*)\\)`, "m")
  );
  assert.ok(m, `${name} の定義が見つからない`);
  const leftover = m[1].replace(/"[^"]*"/g, "").trim();
  assert.equal(leftover, "", `${name} を読み切れていない（残り: ${leftover}）`);
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]);
}

/**
 * ワークフロー 1 本から「pull_request で無条件に走るか」と job 名の一覧を読む。
 * パース結果で読む(#229)。字面だと `pull_request: # c` や、`on:` の中の列 0 のコメントの
 * 後ろにある `paths:` が見えず、その workflow の job が照合から外れうる。マージキーは
 * GitHub が展開しないのに yaml が展開する形(`!!merge`)があり、読みが食い違うので落とす。
 *
 * **読み切れない書き方に出会ったら、静かに 0 件にせず落とす。** ここが取りこぼすと
 * 下の「PR で必ず走る job は、すべて ANCHORS に入っている」が空集合を照合して
 * 緑になる＝不変条件を宣言しているだけの状態になる。実際に次の 3 通りで素通りしていた:
 *   - `name:` を持たない job（check 名は job id になるので実在する）
 *   - `on: pull_request` のフロー形式（**このリポの auto-merge 自身がこの書き方**）
 *   - `paths-ignore`（`paths` と同じく「起動しない PR がある」のに素通りしていた）
 */
function parseWorkflowFile(src, file) {
  assert.deepEqual(mergeKeyPaths(src), [], `${file}: マージキーを使っている`);
  const wf = parseWorkflow(src);
  assert.ok(
    wf?.jobs !== null &&
      typeof wf?.jobs === "object" &&
      Object.keys(wf.jobs).length > 0,
    `${file}: jobs: を読めない`
  );
  // job 名は `name:` があればそれ、無ければ job id がそのまま check 名になる。
  const jobNames = Object.entries(wf.jobs).map(([id, job]) =>
    typeof job?.name === "string" && job.name.trim() ? job.name.trim() : id
  );

  const triggers = triggerNames(wf.on);
  assert.ok(triggers, `${file}: on: を読めない`);
  // paths / paths-ignore のどちらでも「起動しない PR がある」。1 行形と列はフィルタを持てない。
  const pr =
    wf.on !== null && typeof wf.on === "object" && !Array.isArray(wf.on)
      ? wf.on.pull_request
      : null;
  const runsOnEveryPr =
    triggers.includes("pull_request") &&
    !(
      pr !== null &&
      typeof pr === "object" &&
      (Object.hasOwn(pr, "paths") || Object.hasOwn(pr, "paths-ignore"))
    );

  return { jobNames, runsOnEveryPr };
}

const readWorkflow = (file) =>
  parseWorkflowFile(fs.readFileSync(path.join(WORKFLOWS, file), "utf8"), file);

// ---- parseWorkflowFile の fixture(字面で読むと取りこぼす形を含む)----

const WF_JOBS =
  "jobs:\n  build:\n    name: Build site\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n";

for (const [label, on, runsOnEveryPr] of [
  ["1 行形", "on: pull_request\n", true],
  ["列", "on: [push, pull_request]\n", true],
  ["pull_request: の行末にコメント", "on:\n  pull_request: # PR ごと\n", true],
  ["paths で絞る", "on:\n  pull_request:\n    paths: [src/**]\n", false],
  [
    "列 0 のコメントの後ろの paths",
    "on:\n  pull_request:\n# 描画に効くパスだけ\n    paths: [src/**]\n",
    false,
  ],
  [
    "paths-ignore で絞る",
    "on:\n  pull_request:\n    paths-ignore: [docs/**]\n",
    false,
  ],
  ["pull_request を含まない", "on: [push]\n", false],
]) {
  test(`fixture: parseWorkflowFile は ${label} を読む`, () => {
    const r = parseWorkflowFile(`name: Build\n${on}${WF_JOBS}`, "fixture");
    assert.equal(r.runsOnEveryPr, runsOnEveryPr);
    assert.deepEqual(r.jobNames, ["Build site"]);
  });
}

test("fixture: parseWorkflowFile は name: の無い job を job id で数える", () => {
  const r = parseWorkflowFile(
    `name: Build\non: pull_request\n${WF_JOBS.replace("    name: Build site\n", "")}`,
    "fixture"
  );
  assert.deepEqual(r.jobNames, ["build"]);
});

test("fixture: parseWorkflowFile は on: を読めないと落とす(%YAML 1.1 の下)", () => {
  assert.throws(
    () =>
      parseWorkflowFile(
        `%YAML 1.1\n---\nname: Build\non: pull_request\n${WF_JOBS}`,
        "fixture"
      ),
    /on: を読めない/
  );
});

test("fixture: parseWorkflowFile はマージキーを使った workflow を落とす(!!merge は yaml だけが展開する)", () => {
  assert.throws(
    () =>
      parseWorkflowFile(
        `name: Build\non:\n  pull_request:\n    !!merge <<: {paths: [src/**]}\n${WF_JOBS}`,
        "fixture"
      ),
    /マージキーを使っている/
  );
});

/**
 * "Wait for CI, then merge" ステップの run: ブロックをそのまま取り出す。
 * テストしたいのは出荷される本体であって、その写しではない。
 */
function extractRunBlock(yamlPath) {
  const lines = fs.readFileSync(yamlPath, "utf8").split("\n");
  const start = lines.findIndex((l) => /^\s+run: \|\s*$/.test(l));
  assert.notEqual(start, -1, "run: | ブロックが見つからない");

  const body = lines.slice(start + 1);
  const indent = body[0].length - body[0].trimStart().length;
  const out = [];
  for (const line of body) {
    const isBlank = line.trim() === "";
    if (!isBlank && line.length - line.trimStart().length < indent) break;
    out.push(line.slice(indent));
  }
  return out.join("\n");
}

/** name/status/conclusion の組を check-runs API の応答の形にする。 */
function checkRuns(...runs) {
  return JSON.stringify({
    check_runs: runs.map(
      ({
        name,
        status = "completed",
        conclusion = "success",
        startedAt = "2026-01-01T00:00:00Z",
      }) => ({
        name,
        status,
        conclusion: status === "completed" ? conclusion : null,
        started_at: startedAt,
      })
    ),
  });
}

const API_ERROR = Symbol("api error");

/**
 * 待機ループを 1 回走らせる。
 *
 * @param responses 1 回目・2 回目…の check-runs 応答。足りなくなったら最後のものを繰り返す。
 *                  API_ERROR を混ぜると gh api が失敗する。
 * @param anchors   ANCHORS を差し替える。名前の照合規則そのものを試すときだけ使う。
 */
function runLoop(responses, { anchors } = {}) {
  const dir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), "automerge-"))
  );
  const stubs = path.join(dir, "stubs");
  fs.mkdirSync(stubs);

  responses.forEach((body, i) => {
    fs.writeFileSync(
      path.join(dir, `${i + 1}.json`),
      body === API_ERROR ? "BOOM" : body
    );
  });

  // gh のスタブ。api は連番の応答を順に返し、pr merge は実際にはマージせず印を出す。
  // **渡された引数を全部記録する。** #83 と #94 の事故はどちらも「見に行く先 /
  // 待つ対象が実態からずれる」型だった。exit code と MERGED の有無しか見ないと、
  // 参照する SHA が変わってもマージ方法が変わっても素通りする。
  fs.writeFileSync(
    path.join(stubs, "gh"),
    `#!/usr/bin/env bash
set -uo pipefail
printf '%s\\n' "$*" >> "$DIR/gh-args"
case "$1 \${2:-}" in
  "api "*)
    n=$(cat "$DIR/counter" 2>/dev/null || echo 1)
    echo $((n + 1)) > "$DIR/counter"
    f="$DIR/$n.json"
    [ -f "$f" ] || f="$DIR/${responses.length}.json"
    if [ "$(cat "$f")" = "BOOM" ]; then
      echo "HTTP 403: Resource not accessible by integration" >&2
      exit 1
    fi
    cat "$f"
    ;;
  "pr merge") echo "MERGED" ;;
  *) echo "unexpected gh: $*" >&2; exit 1 ;;
esac
`,
    { mode: 0o755 }
  );

  // 待たない。ポーリング回数だけを再現する。
  fs.writeFileSync(path.join(stubs, "sleep"), "#!/usr/bin/env bash\nexit 0\n", {
    mode: 0o755,
  });

  let body = extractRunBlock(WORKFLOW);
  if (anchors) {
    const replaced = body.replace(
      /^ANCHORS=\(.*\)$/m,
      `ANCHORS=(${anchors.map((a) => `"${a}"`).join(" ")})`
    );
    assert.notEqual(replaced, body, "ANCHORS の定義行が見つからない");
    body = replaced;
  }

  const script = path.join(dir, "wait.sh");
  fs.writeFileSync(script, body);

  const res = spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${stubs}:${process.env.PATH}`,
      DIR: dir,
      GH_TOKEN: "stub",
      REPO: "owner/repo",
      SHA: "deadbeef",
      PR_URL: "https://example.invalid/pr/1",
    },
  });

  const polls =
    Number(fs.readFileSync(path.join(dir, "counter"), "utf8").trim()) - 1;
  const ghArgs = fs
    .readFileSync(path.join(dir, "gh-args"), "utf8")
    .trim()
    .split("\n");
  fs.rmSync(dir, { recursive: true, force: true });

  return { code: res.status, out: `${res.stdout}${res.stderr}`, polls, ghArgs };
}

const ANCHORS_OK = [
  { name: "Build site" },
  { name: "Playwright E2E" },
  { name: "auto-merge", status: "in_progress" },
];

// --- 名前が実態とつながっているか ----------------------------------------
//
// #83 の事故は「a11y.yml を e2e.yml に置き換えて job 名が変わったのに、
// 待つ側の名前が古いまま残った」という**別ファイル間のずれ**だった。
// 待機ロジックをいくら試しても、名前が実在するかは分からない。ここで結ぶ。

test("ANCHORS の名前は、実在する job 名である", () => {
  const files = fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  const all = files.flatMap((f) => readWorkflow(f).jobNames);
  for (const anchor of shellArray("ANCHORS")) {
    assert.ok(
      all.includes(anchor),
      `ANCHORS の "${anchor}" に対応する job 名が無い（実在: ${all.join(" / ")}）`
    );
  }
});

test("ANCHORS の名前は、PR で無条件に走るワークフローのものである", () => {
  // paths 条件付きのワークフローを錨にすると、起動しない PR で猶予判定が
  // 「名前がずれている」と誤判定して落ちる。
  const files = fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  const unconditional = files.flatMap((f) =>
    readWorkflow(f).runsOnEveryPr ? readWorkflow(f).jobNames : []
  );
  for (const anchor of shellArray("ANCHORS")) {
    assert.ok(
      unconditional.includes(anchor),
      `ANCHORS の "${anchor}" は PR で必ず走るわけではない`
    );
  }
});

test("ループ予算は job の timeout より短い", () => {
  // **これが崩れると、事故の本体が戻る。** 予算と timeout-minutes が同値だと job が
  // 先に CANCELLED になり、末尾の「待っても完了しなかった」が一度も出力されない
  // ＝ 30 分沈黙するだけになる（#94 で直したのはまさにここ）。予算を延ばすときに
  // timeout を上げ忘れると再発する。
  //
  // **間隔も写さない。** MAX だけ読んで 20 を写すと、sleep を伸ばしたときに予算だけが
  // 伸びて、このテストは古い値で計算し続ける（このテストが防ぐと宣言した事故を、
  // 緑のまま再現できてしまう）。
  const interval = Number(
    extractRunBlock(WORKFLOW).match(/^ *sleep (\d+)$/m)?.[1]
  );
  assert.ok(Number.isFinite(interval), "sleep の間隔を読めない");
  const budgetSec = shellNumber("MAX") * interval;
  const timeoutSec =
    Number(
      fs
        .readFileSync(WORKFLOW, "utf8")
        .match(/^ {4}timeout-minutes: (\d+)$/m)?.[1]
    ) * 60;
  assert.ok(Number.isFinite(timeoutSec), "timeout-minutes を読めない");
  assert.ok(
    budgetSec < timeoutSec,
    `ループ予算 ${budgetSec / 60} 分が timeout ${timeoutSec / 60} 分以上。失敗メッセージが出ないまま CANCELLED になる`
  );
  // 余裕は gh api の往復ぶん。5 分は実測値ではなく下限として置いている。
  assert.ok(
    timeoutSec - budgetSec >= 5 * 60,
    `余裕が ${(timeoutSec - budgetSec) / 60} 分しかない。API 往復ぶんを見込んで 5 分以上あけること`
  );
});

test("job を絞る 2 つの if: と、その入力が消えていない", () => {
  // **テストは run: ブロックしか走らせない。** そのブロックに入るかどうかを決める
  // 判定は視野の外なので、ここで文字列として固定する。どちらか一方でも落ちると、
  // このリポで唯一の自動書き込み経路が「誰の PR でも」「major でも」通るようになる
  // （ブランチ保護が見るのは required の check だけで、PR の作成者や更新の種類は見ない）。
  const t = fs.readFileSync(WORKFLOW, "utf8");
  assert.match(
    t,
    /^ {4}if: github\.event\.pull_request\.user\.login == 'dependabot\[bot\]' && github\.repository == github\.event\.pull_request\.head\.repo\.full_name && github\.actor == 'dependabot\[bot\]' # zizmor: ignore\[bot-conditions\] \S.*$/m,
    "Dependabot の判定(作成者・head のリポ・actor)と、actor を残す理由つきの抑止が無い"
  );
  assert.match(
    t,
    /^ {8}if: steps\.metadata\.outputs\.update-type != 'version-update:semver-major'$/m,
    "major 除外が無い"
  );
  // 上の major 除外は metadata ステップの出力に依存する。ステップごと消えると
  // update-type が空文字になり、'' != 'version-update:semver-major' が真＝major も通る。
  // 除外の文言だけを見ていると気づけない。
  assert.match(t, /^ {8}id: metadata$/m, "metadata ステップの id が無い");
});

test("check-runs を読む権限と、見に行く SHA が宣言されている", () => {
  // permissions を明示すると列挙しなかった権限は none になる。checks: read が落ちると
  // check を 1 件も取得できない（実行時は取得失敗で落ちるので fail-close だが、
  // 原因が分かる形で固定しておく）。
  const t = fs.readFileSync(WORKFLOW, "utf8");
  assert.match(t, /^ {2}checks: read$/m, "checks: read が無い");
  // 下の「head SHA を見に行く」テストは runLoop が渡した値しか見られない。YAML 側で
  // base.sha 等に差し替わっても気づけないので、ここで束縛を固定する。
  assert.match(
    t,
    /^ {10}SHA: \$\{\{ github\.event\.pull_request\.head\.sha \}\}$/m,
    "SHA が head.sha に束縛されていない"
  );
});

test("PR で必ず走る job は、すべて ANCHORS に入っている", () => {
  // 片方向（ANCHORS ⊆ 無条件 job）だけでは、錨を減らす変更を止められない。錨を 1 本
  // 減らしても既存のテストは全部緑のままで、しかし「その check が走らなかった PR」を
  // 黙って通すようになる。
  const files = fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  const unconditional = files.flatMap((f) =>
    readWorkflow(f).runsOnEveryPr ? readWorkflow(f).jobNames : []
  );
  const covered = [...shellArray("ANCHORS"), ...shellArray("IGNORE_EXACT")];
  const missing = unconditional.filter((j) => !covered.includes(j));
  assert.deepEqual(
    missing,
    [],
    `PR で必ず走る job が ANCHORS に無い: ${missing.join(" / ")}`
  );
});

test("見ないと決めた check は、この 2 つだけ", () => {
  // 除外リストの拡大は、このゲートが静かに死ぬ最短経路。実在の job 名を 1 つ足すだけで、
  // 既存のテストは全部緑のまま赤い check を通せる。増やすときは必ずここも触ることになる
  // ようにしておく。
  assert.deepEqual(shellArray("IGNORE_EXACT"), ["auto-merge"]);
  assert.deepEqual(shellArray("IGNORE_PREFIXES"), ["Workers Builds:"]);
});

const BUILD_YML = path.join(WORKFLOWS, "build.yml");

// build.yml で配線を見る検査のステップ。値は「前段の失敗でも走る(`if: ${{ !cancelled() }}`)」
// ことまで求めるか。Library unit tests は前段(データ検証)が落ちたら走らない置き方なので求めない。
// Workflow tests の `if:` は「この検査自身が PR の CI に配線されている」が見ている(#224)
const BUILD_STEPS = {
  lint: true,
  "format:check": true,
  "test:lib": false,
  "test:githooks": true,
  "test:workflows": false,
};

/**
 * build.yml の検査ステップの配線に反している箇所を返す(例: `lint if`)。
 * `npm run <script>` のステップが少なくとも 1 つあり、そのすべてが、ステップにも job にも
 * continue-on-error を持たないこと(BUILD_STEPS で true のものは前段の失敗でも走ることも)。
 * continue-on-error はステップに付くと赤が job に、job に付くと job の赤が run に伝わらない。
 *
 * パース結果で見る(#218)。字面だと `"continue-on-error":` のような等価な書き方が素通りする。
 * マージキーは、使っていること自体を違反にする(workflow-yaml.mjs)。検査ステップの中にあれば
 * そのステップの違反(`test:lib merge key`)として出し、どのテストが赤くなるかを取り違えない(#224)。
 */
function buildViolations(src) {
  const doc = parseWorkflow(src);
  const found = [];
  const owner = new Map(); // ステップの位置(mergeKeyPaths と同じ書式) → script
  for (const [script, needsIf] of Object.entries(BUILD_STEPS)) {
    const hits = Object.entries(doc?.jobs ?? {}).flatMap(([jobName, job]) =>
      (job?.steps ?? []).flatMap((step, i) =>
        String(step?.run ?? "").trim() === `npm run ${script}`
          ? [{ job, step, at: `jobs.${jobName}.steps[${i}]` }]
          : []
      )
    );
    if (hits.length === 0) found.push(`${script} missing`);
    for (const { job, step, at } of hits) {
      owner.set(at, script);
      if (needsIf && step.if !== "${{ !cancelled() }}")
        found.push(`${script} if`);
      if (Object.hasOwn(step, "continue-on-error"))
        found.push(`${script} continue-on-error`);
      if (Object.hasOwn(job ?? {}, "continue-on-error"))
        found.push(`${script} job continue-on-error`);
    }
  }
  const merges = mergeKeyPaths(src).map((at) => {
    const script = [...owner].find(
      ([step]) => at === step || at.startsWith(`${step}.`)
    )?.[1];
    return script ? `${script} merge key` : `merge key ${at}`;
  });
  return [...merges, ...found];
}

test("oxlint と oxfmt の口が build.yml に配線されている", () => {
  // oxlint は warning でも exit 0、oxfmt --check は差分があれば exit 1。どちらも
  // ワークフローから外れると黙って検査が消える(ADR 0004)。
  assert.deepEqual(
    buildViolations(fs.readFileSync(BUILD_YML, "utf8")).filter(
      (v) => !v.startsWith("test:")
    ),
    []
  );
  const pkg = JSON.parse(
    fs.readFileSync(path.join(WORKFLOWS, "..", "..", "package.json"), "utf8")
  );
  assert.equal(
    pkg.scripts.lint,
    "oxlint --deny-warnings",
    "warning で止まらない形になっている"
  );
  assert.equal(pkg.scripts["format:check"], "oxfmt --check");
});

test("テストのステップの赤が CI に伝わる(continue-on-error が無く、Git hook は前段が落ちても走る)", () => {
  // test:lib / test:githooks / test:workflows は落ちても exit 1 を返すだけなので、
  // continue-on-error が付くと CI は緑のまま、守っているはずの検査が黙って消える。
  // Git hook regression tests は前段のデータ検証が落ちても走らせる(build.yml のコメント)
  assert.deepEqual(
    buildViolations(fs.readFileSync(BUILD_YML, "utf8")).filter((v) =>
      v.startsWith("test:")
    ),
    []
  );
});

// ---- buildViolations の fixture。実際の build.yml の 1 か所だけを書き換える ----

const build = (from, to) =>
  replaceOnce(fs.readFileSync(BUILD_YML, "utf8"), from, to);
const LINT_STEP =
  "      - name: Lint (oxlint)\n        if: ${{ !cancelled() }}\n        run: npm run lint\n";

test("fixture: lint の if: を外すと拾う(前段が落ちると走らなくなる)", () => {
  const src = build(
    LINT_STEP,
    "      - name: Lint (oxlint)\n        run: npm run lint\n"
  );
  assert.deepEqual(buildViolations(src), ["lint if"]);
});

for (const [label, line] of [
  ["そのまま", "        continue-on-error: true\n"],
  ["引用符付きのキー", '        "continue-on-error": true\n'],
  ["明示キー", "        ? continue-on-error\n        : true\n"],
]) {
  test(`fixture: lint のステップに continue-on-error(${label})を足すと拾う`, () => {
    const src = build(LINT_STEP, LINT_STEP + line);
    assert.deepEqual(buildViolations(src), ["lint continue-on-error"]);
  });
}

test("fixture: job に continue-on-error を足すと、すべての口で拾う", () => {
  const src = build(
    "    timeout-minutes: 10\n",
    "    timeout-minutes: 10\n    continue-on-error: true\n"
  );
  assert.deepEqual(
    buildViolations(src),
    Object.keys(BUILD_STEPS).map((script) => `${script} job continue-on-error`)
  );
});

for (const script of ["test:lib", "test:githooks", "test:workflows"]) {
  test(`fixture: ${script} のステップに continue-on-error を足すと拾う`, () => {
    const run = `        run: npm run ${script}\n`;
    const src = build(run, `${run}        continue-on-error: true\n`);
    assert.deepEqual(buildViolations(src), [`${script} continue-on-error`]);
  });
}

test("fixture: if: をマージキーで入れると、無いものとして拾う", () => {
  // merge: true で読むと通ってしまう形(GitHub では if が効かない)
  const src = build(
    LINT_STEP,
    "      - name: Lint (oxlint)\n        <<: {if: '${{ !cancelled() }}'}\n        run: npm run lint\n"
  );
  assert.deepEqual(buildViolations(src), ["lint merge key", "lint if"]);
});

test("fixture: テストのステップに入れたマージキーは、そのステップの違反として出る", () => {
  // lint の口のテストではなく、テストのステップの口のテストを赤くする(#224)
  const run = "        run: npm run test:workflows\n";
  const src = build(run, `${run}        <<: {continue-on-error: true}\n`);
  assert.deepEqual(buildViolations(src), ["test:workflows merge key"]);
});

test("fixture: Git hook regression tests の if: を外すと拾う", () => {
  const src = build(
    "      - name: Git hook regression tests\n        if: ${{ !cancelled() }}\n",
    "      - name: Git hook regression tests\n"
  );
  assert.deepEqual(buildViolations(src), ["test:githooks if"]);
});

test("fixture: format:check のステップを消すと拾う", () => {
  const src = build(
    "      - name: Format check (oxfmt)\n        if: ${{ !cancelled() }}\n        run: npm run format:check\n",
    ""
  );
  assert.deepEqual(buildViolations(src), ["format:check missing"]);
});

test("この検査自身が PR の CI に配線されている", () => {
  // `assert-test-*` は「glob 0 件 / 中身が空 / 全件 skip」を止めるが、その**手前**の
  // 「そもそも CI で走るか」は誰も見ていない。build.yml からステップを 1 行消すと、
  // このファイルのテストは全件緑のまま CI から完全に消える（実測）。
  const b = fs.readFileSync(path.join(WORKFLOWS, "build.yml"), "utf8");
  assert.match(
    b,
    /^ {8}run: npm run test:workflows$/m,
    "build.yml から外れている"
  );
  assert.match(
    b,
    /^ {6}- name: Workflow tests\n {8}if: \$\{\{ !cancelled\(\) \}\}$/m,
    "前段が落ちると走らない形になっている"
  );
  assert.ok(
    readWorkflow("build.yml").runsOnEveryPr,
    "build.yml が PR で必ず走らない"
  );
});

test("IGNORE_EXACT は自分自身の check 名を含む", () => {
  // 自分を除外し損ねると、自分の完了を待って自己デッドロックする。
  // job に name: が無ければ check 名は job id になる。
  const text = fs.readFileSync(WORKFLOW, "utf8");
  const jobId = text.match(/^jobs:\n {2}([\w-]+):/m);
  assert.ok(jobId, "job id を読めない");
  const named = readWorkflow("dependabot-auto-merge.yml").jobNames;
  const own = named.length ? named[0] : jobId[1];
  assert.ok(
    shellArray("IGNORE_EXACT").includes(own),
    `IGNORE_EXACT に自分自身 "${own}" が無い`
  );
});

// --- 錨 -----------------------------------------------------------------

test("錨が 2 件とも成功したらマージする", () => {
  const r = runLoop([checkRuns(...ANCHORS_OK)]);
  assert.equal(r.code, 0);
  assert.match(r.out, /MERGED/);
  assert.equal(r.polls, 1);
});

test("錨が失敗していたらマージせず落ちる", () => {
  const r = runLoop([
    checkRuns(
      { name: "Build site" },
      { name: "Playwright E2E", conclusion: "failure" }
    ),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /CI が通っていないためマージしない/);
  assert.doesNotMatch(r.out, /MERGED/);
});

test("錨がまだ実行中なら待ち、完了してからマージする", () => {
  const pendingRounds = Array.from({ length: 3 }, () =>
    checkRuns({ name: "auto-merge", status: "in_progress" })
  );
  const r = runLoop([...pendingRounds, checkRuns(...ANCHORS_OK)]);
  assert.equal(r.code, 0);
  assert.match(r.out, /MERGED/);
  assert.equal(r.polls, 4);
});

test("錨の名前がずれていたら、待ち続けずに猶予で落ちる", () => {
  // job 名を変えたのにワークフロー側を直し忘れた状態。#83 -> #94 で実際に起きた。
  const r = runLoop([
    checkRuns({ name: "Build site" }, { name: "Playwright a11y" }),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /一度も現れなかった/);
  assert.match(r.out, /Playwright E2E/);
  assert.equal(r.polls, shellNumber("GRACE"), "猶予の回数で落ちる");
});

test("錨の名前が別の錨の一部でも、取り違えずに欠落を見つける", () => {
  // 「現れた」の記録を部分一致で照合すると、"Build site" が現れた時点で
  // "Build" も現れたことになり、名前ずれを 5 分で捕まえる経路が無効になる
  // (MAX 回ポーリングしてタイムアウトするだけになる)。行単位の完全一致で持つ。
  const r = runLoop([checkRuns({ name: "Build site" })], {
    anchors: ["Build", "Build site"],
  });
  assert.equal(r.code, 1);
  assert.match(r.out, /一度も現れなかった/);
  assert.match(r.out, /"Build"/);
  assert.equal(r.polls, shellNumber("GRACE"));
});

// --- 錨以外の check ------------------------------------------------------

test("条件付きで走る check が失敗していたらマージしない", () => {
  // vrt.yml は paths 条件で走るので錨にできない。しかし走った以上は見る。
  const r = runLoop([
    checkRuns(...ANCHORS_OK, {
      name: "Visual Regression",
      conclusion: "failure",
    }),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /Visual Regression=failure/);
  assert.doesNotMatch(r.out, /MERGED/);
});

test("条件付きで走る check が実行中なら、それも待つ", () => {
  const r = runLoop([
    checkRuns(...ANCHORS_OK, {
      name: "Visual Regression",
      status: "in_progress",
    }),
    checkRuns(...ANCHORS_OK, { name: "Visual Regression" }),
  ]);
  assert.equal(r.code, 0);
  assert.match(r.out, /MERGED/);
  assert.equal(r.polls, 2);
});

test("条件付きで走る check が起動しなかった PR は、その分だけ通す", () => {
  // 起動しなかった check は応答に現れない。「無い」を「まだ来ていない」と
  // 読むと永久に待つので、錨以外は現れているものだけを見る。
  const r = runLoop([checkRuns(...ANCHORS_OK)]);
  assert.equal(r.code, 0);
  assert.match(r.out, /MERGED/);
});

test("見ないと決めた check が失敗していてもマージを止めない", () => {
  // Cloudflare のデプロイ側。依存更新の可否は repo 側 CI で判断する。
  const r = runLoop([
    checkRuns(...ANCHORS_OK, {
      name: "Workers Builds: okinawa-in-data",
      conclusion: "failure",
    }),
  ]);
  assert.equal(r.code, 0);
  assert.match(r.out, /MERGED/);
});

test("除外は前方一致で広げない。似た名前の別 check は見る", () => {
  // "auto-merge" を前方一致で除外すると "auto-merge-extra" まで巻き込み、
  // 赤いまま通る。除外の面積は check 名そのものより狭く保つ。
  const r = runLoop([
    checkRuns(...ANCHORS_OK, {
      name: "auto-merge-extra",
      conclusion: "failure",
    }),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /auto-merge-extra=failure/);
  assert.doesNotMatch(r.out, /MERGED/);
});

test("同名の check-run が複数あるなら、決着していない方を優先して待つ", () => {
  // check-runs API は filter=latest で名前ごとに 1 件を返すので本来起きない。
  // 起きた場合に「成功している方」を採ると、走行中の再実行を無視して通る。
  // 迷ったら待つ(そして待ち切れなければ落ちる)側へ倒す。
  const r = runLoop([
    checkRuns(
      ...ANCHORS_OK,
      {
        name: "Visual Regression",
        conclusion: "success",
        startedAt: "2026-01-01T00:05:00Z",
      },
      {
        name: "Visual Regression",
        status: "in_progress",
        startedAt: "2026-01-01T00:00:00Z",
      }
    ),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /待っても CI が完了しなかった/);
  assert.doesNotMatch(r.out, /MERGED/);
});

test("同名の check-run に失敗が混ざっていたら止める", () => {
  const r = runLoop([
    checkRuns(
      ...ANCHORS_OK,
      { name: "Visual Regression", conclusion: "success" },
      { name: "Visual Regression", conclusion: "failure" }
    ),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /Visual Regression=failure/);
});

// --- 誰を見て、どう扱うか ------------------------------------------------

test("check を見に行く先は、この PR の head SHA である", () => {
  // main や既定ブランチを見に行くと、PR の CI が赤くても main が緑なら通る。
  const r = runLoop([checkRuns(...ANCHORS_OK)]);
  const api = r.ghArgs.find((a) => a.startsWith("api "));
  assert.ok(api, "gh api が呼ばれていない");
  assert.match(api, /commits\/deadbeef\/check-runs/);
  // 名前ごとに 1 件返る前提と、1 ページに収まる前提の上に判定が乗っている。
  assert.match(api, /filter=latest/);
  assert.match(api, /per_page=100/);
});

test("check-runs が 1 ページに収まっていなければ、判定せずに落ちる", () => {
  // 見えない check は「無い」のと同じになり、静かにゲートを抜ける。
  const r = runLoop([
    JSON.stringify({
      total_count: 120,
      check_runs: [
        { name: "Build site", status: "completed", conclusion: "success" },
        { name: "Playwright E2E", status: "completed", conclusion: "success" },
      ],
    }),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /1 ページに収まっていない/);
  assert.doesNotMatch(r.out, /MERGED/);
  assert.equal(r.polls, 1);
});

test("check がまだ 1 件も登録されていない瞬間を「全部成功」と読まない", () => {
  // 錨を置いている理由そのもの。空応答で即マージすると全部が無意味になる。
  const r = runLoop([JSON.stringify({ check_runs: [] })]);
  assert.equal(r.code, 1);
  assert.doesNotMatch(r.out, /MERGED/);
  assert.equal(r.polls, shellNumber("GRACE"), "猶予まで待ってから落ちる");
});

test("一度ゲートに載った check が応答から消えても、通したことにしない", () => {
  // 錨は空 state を pending にするので気づくが、錨以外は行ごと消える。
  const r = runLoop([
    checkRuns(...ANCHORS_OK, {
      name: "Visual Regression",
      status: "in_progress",
    }),
    checkRuns(...ANCHORS_OK),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /待っても CI が完了しなかった/);
  assert.doesNotMatch(r.out, /MERGED/);
});

test("マージ時に出す一覧には、見ないと決めた check を混ぜない", () => {
  // 混ぜると、赤い行を並べながら「すべて成功」と言うことになる。
  const r = runLoop([
    checkRuns(...ANCHORS_OK, {
      name: "Workers Builds: okinawa-in-data",
      conclusion: "failure",
    }),
  ]);
  assert.equal(r.code, 0);
  assert.match(r.out, /Build site/);
  assert.doesNotMatch(r.out, /Workers Builds/);
  assert.doesNotMatch(r.out, /auto-merge/);
});

test("錨と同じ接頭辞の別 check は、錨として飛ばさずにゲートする", () => {
  // 錨は二重計上を避けるため 2 周目のループで飛ばす。この照合が前方一致だと
  // "Build site (canary)" のような別 job まで錨扱いで飛ばされ、赤いまま通る。
  const r = runLoop([
    checkRuns(...ANCHORS_OK, {
      name: "Build site (canary)",
      conclusion: "failure",
    }),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /Build site \(canary\)=failure/);
  assert.doesNotMatch(r.out, /MERGED/);
});

test("除外の前方一致は前方一致であって、部分一致ではない", () => {
  // "Workers Builds:" を部分一致にすると、それを名前に含む別 job まで抜ける。
  const r = runLoop([
    checkRuns(...ANCHORS_OK, {
      name: "Verify Workers Builds: staging",
      conclusion: "failure",
    }),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /Verify Workers Builds: staging=failure/);
});

test("マージは squash + ブランチ削除で、対象はこの PR である", () => {
  // rebase や --admin に化けると、履歴の作られ方と保護の扱いが変わる。
  const r = runLoop([checkRuns(...ANCHORS_OK)]);
  const merge = r.ghArgs.find((a) => a.startsWith("pr merge"));
  assert.ok(merge, "gh pr merge が呼ばれていない");
  assert.match(merge, /--squash/);
  assert.match(merge, /--delete-branch/);
  assert.match(merge, /https:\/\/example\.invalid\/pr\/1/);
  assert.doesNotMatch(merge, /--admin|--rebase|--merge\b/);
  // **判定した SHA と、実際にマージする head を一致させる。** ゲートは $SHA を見るが、
  // マージ先は PR の「現在の」head。Dependabot は対象ブランチへの push で衝突したとき
  // (兄弟 PR のマージを含む)や、スケジュール実行・再オープンで変更を見つけたときに
  // PR を rebase し、`@dependabot rebase` のコメントでも head が変わるので、最後の
  // ポーリングからマージまでの間に head が動きうる。これが無いと、検証していない SHA を
  // マージする窓が残る。
  assert.match(merge, /--match-head-commit deadbeef/);
});

test("錨が skipped なら、成功扱いにせず止める", () => {
  // job レベルの `if:` で止めた check は conclusion: skipped として現れる。名前は在るのに
  // 中身は走っていない状態で、錨が満たされたと読むと、保護が黙って狭まる。
  const r = runLoop([
    checkRuns(
      { name: "Build site" },
      { name: "Playwright E2E", conclusion: "skipped" },
      { name: "auto-merge", status: "in_progress" }
    ),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /Playwright E2E=skipped/);
  assert.doesNotMatch(r.out, /MERGED/);
});

test("条件付きで走る check は skipped でも通す", () => {
  // 錨と違い、こちらは「走らなかった」ことに意味がある。錨を厳しくした結果をここまで
  // 広げると、vrt が起動しない PR が全部止まる。
  const r = runLoop([
    checkRuns(...ANCHORS_OK, {
      name: "Visual Regression",
      conclusion: "skipped",
    }),
  ]);
  assert.equal(r.code, 0);
  assert.match(r.out, /MERGED/);
});

// --- 待ち切ったとき / API そのものが読めないとき --------------------------

test("待ち予算を使い切ったらマージせず落ちる", () => {
  // ここが exit 0 に化けると、CI が終わらなかった PR が緑で通ってしまう。
  const r = runLoop([
    checkRuns(
      { name: "Build site" },
      { name: "Playwright E2E", status: "in_progress" }
    ),
  ]);
  assert.equal(r.code, 1);
  assert.match(r.out, /待っても CI が完了しなかった/);
  assert.doesNotMatch(r.out, /MERGED/);
  assert.equal(r.polls, shellNumber("MAX"), "MAX 回ポーリングしてから諦める");
});

test("check-runs を取得できないときは「まだ実行中」と混同せず落ちる", () => {
  const r = runLoop([API_ERROR]);
  assert.equal(r.code, 1);
  assert.match(r.out, /check-runs を取得できない/);
  assert.equal(r.polls, 1);
});

test("check-runs を解釈できないときも、黙って死なずに理由を出して即やめる", () => {
  // jq が落ちると set -e がそのまま殺すので、何が起きたか残らない。
  // 理由を出したうえで**その場で**やめること。空の結果を持って先へ進むと、
  // 「check が 1 件も無い」状態として猶予まで回り、本当の原因が埋もれる。
  const r = runLoop(['{"check_runs": [ this is not json ]']);
  assert.equal(r.code, 1);
  assert.match(r.out, /check-runs を解釈できない/);
  assert.equal(r.polls, 1);
});
