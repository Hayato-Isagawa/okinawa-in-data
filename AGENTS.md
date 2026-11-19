# データでみる沖縄 (okinawa-in-data)

沖縄県の公的データ(第1弾: 教育×子どもの貧困)を PDF 散在状態から構造化し、一次出典への恒久リンクと解説付き可視化で「読めるデータ」として提供する独立サイト。公式 OKINAWA DPF(カタログ型)の再カタログ化はしない。

2026-11 に非公開リポから移した。移行前に書いた文書・コメントに残るリポ名の付かない `#番号`・コミット SHA・Actions の run ID・`rule N` は移行前の環境のもので、第三者は辿れない。このリポの PR / issue の番号は移行前の番号と重なるが、別のものを指す。

## スタック

- Astro 7 (SSG) + React 19 + Tailwind CSS 4 + TypeScript / npm / Node 26 (mise)
- ホスティング: Cloudflare Workers static assets(wrangler.jsonc。Pages ではない)
- 可視化: Observable Plot を**ビルド時に静的 SVG 生成**(クライアント JS を増やさない)。チャートには必ず等価なデータテーブルを併設する

**Node の版を上げるときは、Cloudflare 側のビルド変数 `NODE_VERSION` も同じ値に上げる。**(姉妹リポでの決定の記録: Hayato-Isagawa/edu-evidence の ADR 0046 / 0047)Workers Builds は `.tool-versions` を読むが、その版ではビルドしない(2026-11-12 実測: 24.22.2 を指定しても既定の 24.22.1 で走った)。ビルドの版を決めるのは Worker `okinawa-in-data` の `NODE_VERSION` で、`.node-version` より優先される(2026-11-13 実測: `.node-version` に 26.13.1 を置いても `NODE_VERSION` の 24.22.3 で走った)。ダッシュボードのビルド変数は、本番(`main`)とプレビュー(それ以外のブランチ)の 2 つのトリガーに同じ値をまとめて保存する。出たばかりの版は、Workers Builds のツールのインストール段階でビルドが落ちる(2026-11 の 24.22.3 は通るまで 1 日以上かかった)。Workers Builds の npm は `package.json` の `packageManager` でしか変わらず、無ければ既定の 10.9.2 になる。新しい Node に同梱の npm の版(nodejs.org の `dist/index.json` の `npm` 欄)に合わせる。このため次の順で上げる。

1. ダッシュボードで `NODE_VERSION` を新しい版にする(本番とプレビューの両方に入る)
2. `.tool-versions` と、`package.json` の `packageManager` を上げる PR を出し、プレビュービルドのログに `Installing nodejs <新しい版>` が出て、`Detected the following tools from environment:` に `npm@<同梱の版>` が出て、成功するのを確かめる。ツールのインストール段階で落ちたら、`NODE_VERSION` を元の版に戻し、時間を置いてやり直す
3. CI も通ったら PR をマージする

手順 1 から手順 2 の確認までの間に `main` へ入った変更(Dependabot の自動マージを含む)は、そのビルドも新しい版で走り、入らない版なら落ちる(デプロイのコマンドまで進まないので、配信は前のビルドのまま残る)。この間は手で `main` に入れない。

## データ層の鉄則

- `data/` はサイト実装から独立したデータ資産。1データセット = `data/datasets/<id>/`(meta.json + data.csv + data.json + raw/ + notes.md)
- メタデータは `data/schema/dataset-meta.ts` の Zod スキーマが単一ソース。検証は `npm run check:data`
- **数値の転記は一次資料と逐語照合するまで `status: "published"` にしない**。取得は `curl` + `pdftotext -layout`、WebFetch は概要把握のみ(逐語確認に使わない)
- `raw/` には pdftotext の生テキストを監査証跡として保存。変換の判断(セル結合の解釈・欠損の扱い)は notes.md に記録。
  出典の規約で本文を再配布できない、または再配布できるか確認できていないもの(`kodomo-chosa-konkyu-keinen`・`ses-gakuryoku-hogosha-chosa`)は生テキストをリポに入れず、
  `raw/README.md` に理由と原本の取得先を書く(`npm run check:data` は published の `raw/` が空でないことを求める。ADR 0007)
- `data.json` は `npm run build:json` で data.csv から生成する。手編集しない

## 開発

dev サーバはバックグラウンドモードで起動する:

```
astro dev --background
```

管理は `astro dev stop` / `astro dev status` / `astro dev logs`。

- clone 後に 1 回 `npm run prepare` で `.githooks/` を有効にする(`.npmrc` の `ignore-scripts=true` で `npm install` / `npm ci` は `prepare` を走らせない。README「セットアップ」)
- コミット前チェック: `npm run lint`(oxlint)+ `npm run format:check`(oxfmt。.astro / .md / .yml / .css / data/datasets / src/data/geo は対象外。ADR 0004)+ `npm run check`(astro check)+ `npm run check:data` + `npm run build`
- 見た目に効く変更(`src/layouts` / `components` / `styles` / `pages` / `lib` / `data`)は `npm run vrt` も回す。
  **依存の更新も見た目に効く**ので `package.json` / `package-lock.json` も VRT の起動条件に入れてある(ADR 0003)
- コミットはユーザーの明示指示または承認を得てから行う
- ユーザー向けの変化がある PR では changelog ページを同時更新する(公開後の運用)

## テスト(`tests/`)

`.github/workflows/e2e.yml` が PR ごとに `npx playwright test` で全部回す。手元では `npm run test:e2e`
(a11y だけなら `npm run test:a11y`)。**先に `npm run build` が要る** — a11y と search は読み込み時に `dist/` を走査し(無ければ ENOENT で落ちる)、
external-links はテストの中で `dist/` を走査する。datasets は `data/` から対象を作り、公開範囲のテストは `dist/datasets/`・`dist/data/`・sitemap も走査する。external-links 以外は `scripts/serve-dist.mjs` が配る `dist/` をブラウザで開く(同じポートに残っているサーバーは使わず、ポートが埋まっていれば起動の時点で止まる)。spec が読むパスはリポのルートから解決するので、別のディレクトリから `-c playwright.config.ts` で起動しても同じ対象を見る(config を渡さないと webServer・globalSetup・`forbidOnly` が効かない)。
CI では `test.only` が混ざると落ちる(`forbidOnly`)。

- **`a11y.spec.ts`** — dist の全ページを axe にかける
- **`datasets.spec.ts`** — データセットページが「サイトの約束」を守っているか。
  `npm run check:data` は meta.json のスキーマを見るが、**それが実際にページへ出ているかは
  見ていない**。ここがその隙間を埋める:
  - meta.json の **出典 URL がすべてリンクとして描画されている**(このサイトが提供して
    いるのは数字ではなく一次出典への恒久リンクなので、出典が出ていないページは
    情報が欠けているのではなく前提が崩れている)
  - **図があるページには表もある**(「チャートには必ず等価なデータテーブルを併設する」)
  - **meta.json を持たないデータセットはページ・配信ファイル・sitemap に出ない**(取り下げは
    `meta.json.hold` へのリネームで止める。ADR 0007)。`dist/datasets/` と `dist/data/` のディレクトリ、
    sitemap のデータセット URL のそれぞれが、meta.json を持つ id の集合と一致するかで見る。
    meta.json があるのに欠けたものと余計なものはいつでも落ちるが、**取り下げたものが外れているかを
    ここで見られるのは、取り下げ中のデータセットが実在するときだけ**。ローダーの除外そのものは
    `src/lib/__tests__/` が一時ディレクトリで見ている(以前は取り下げた実例を 1 件ずつ 404 で引き、
    実例が 1 件以上あることも求めていたので、唯一の実例を戻したとき(`data/datasets/kodomo-chosa-konkyu-keinen/notes.md`「公開再開」)に落ちた)
- **`navigation.spec.ts`** — 主要導線と 404
- **`external-links.spec.ts`** — 別の窓で開くリンク(`target` が `_self` / `_parent` / `_top` 以外)が
  すべて `rel="noopener noreferrer"` を持つか。dist の全 HTML と `maps/*.svg`(MapExplorer が
  innerHTML に入れる断片)を linkedom で DOM にして見る。`<base target>` も見る。
  **0 件で緑にならないよう下限(100 件)を置いている**。実行時に JS が作るリンクは見ない
- **`search.spec.ts`** — サイト内検索(Pagefind、ADR 0005)が本番と同じ CSP の下で動くか。
  E2E の配信(`scripts/serve-dist.mjs`)は `public/_headers` を適用しないので、そこから読んだ CSP を同一オリジンの
  **全レスポンス**に付けて配る(Pagefind は WASM を Worker で動かし、Worker の CSP は Worker
  スクリプト自身のレスポンスで決まるため、HTML だけに付けると `'wasm-unsafe-eval'` を外しても通る)。
  索引から外したページ(更新履歴・検索・404)が、それぞれの本文にだけある語の結果に出ないことも
  見る — `data-pagefind-body` が 1 つも無いと Pagefind は全ページの body を索引するので、その後退も
  これで落ちる。市町村ページの `data-pagefind-ignore`(数値カード・順位の注記・指標の表・出典リスト)が
  外れると全市町村ページが結果に出る語でも引く。データセットとテーマのページの表(`DataTable.astro`)の
  `data-pagefind-ignore` の外れは見ていない

**CI は PR でだけ回る。`main` への push では回さない**(2026-09-01。ADR 0006)。実測で push[main] だけが
捕まえた失敗は 0 件だった。2026-08-21 に Actions の月の枠が尽きて private 全リポの CI が 10 日間止まった
事故を受けている。マージ後の `main` では Workers Builds がビルドし、E2E は下の週 1 回の run で回るが、lint・整形・型・
`test:*` は回らない(反対意見と、公開後に枠の制約が当てはまらなくなったことは ADR 0006)。
**代わりに `e2e.yml` が週 1 で `main` を回す** — PR が作った Playwright キャッシュは他の PR から
見えず、`refs/heads/main` の run が作ったものだけが全 PR から引けるため。

Playwright ではないテストが 3 つある。いずれも `npm run check:all` と `build.yml` に入っている。

- **`scripts/lib/__tests__/`・`src/lib/__tests__/`**(`npm run test:lib`) — Excel → CSV の変換ヘルパーと、
  データセットのローダーが meta.json の無いディレクトリを読まないこと
- **`.githooks/__tests__/`**(`npm run test:githooks`) — pre-commit / pre-push
- **`scripts/__tests__/`**(`npm run test:workflows`) — ワークフローに埋め込まれた判定ロジックと、VRT と E2E が使う配信スクリプト。
  auto-merge・link-check・ci-summary の 3 本はワークフローから `run:` ブロックを取り出し、`gh`(auto-merge は
  `sleep` も)をスタブして走らせる。**写しを置かないので、ワークフロー側を変えるとテスト対象も変わる**
  — 数値や条件をテストに書き写さない(例外として書き写して固定しているものは、下の各項目に書く。ci-summary の印の取得と照合・workflow 全体など)。4 本目の `vrt-baseline.test.mjs` は `vrt.yml` を静的に走査する
  (下記)。5 本目の `serve-dist.test.mjs` は `scripts/serve-dist.mjs` を起動してリクエストする。
  6 本目の `zizmor-workflow.test.mjs` は `zizmor.yml` を `yaml` でパースして読む(全部の workflow に当てる `ambiguousYaml` の判定も、ここに置いている)。
  **6 本とも壊れ方が静かで、CI は緑のまま結果だけが変わる**:
  - `dependabot-auto-merge.yml` の待機ロジック — **main への唯一の自動書き込み経路**。
    2026-08-09 に a11y.yml を e2e.yml に置き換えて job 名が変わったとき、30 分沈黙 → CANCELLED に
    化け、PR が 2 本溜まるまで気づけなかった(2026-08-11 に修正)
  - `link-check.yml` の通知分岐 — open な Issue があると検出を捨てていたため、
    2026-08-17 に見つかった 404 が 2 日間どこにも出なかった(404 自体は 2026-08-19 に直し、
    通知の穴は 2026-08-20 に塞いだ)。既存 Issue の**探し方**(ラベル・状態)と**扱い方**
    (コメントか新規か)、`gh` 失敗時に赤くなることを固定している。
    **lychee が完走しなかった回も、1 本もリンクを見なかった回も通知する** — 何が切れたかは
    分からなくても、分からないこと自体を届ける。判定は「レポートが空か」ではなく
    **`# Summary` を含むか**で見る。pin した action は出力先を `mktemp` で先に作るため、
    lychee が panic してもフッタ 1 行だけの非空ファイルが残るので、空判定では取りこぼす。
    **0 件の回は `exit_code` では拾えない** — `failIfEmpty`(既定 true)は lychee の終了コードを
    0 のまま残して action だけが exit 1 するので(`entrypoint.sh:61-62`)、`continue-on-error`
    と合わさって job も緑になる＝週次チェックが恒久的に no-op になる。`steps.lychee.outcome`
    は continue-on-error 適用**前**の結果なので、そこで拾う。
    タイトルは 3 分岐(`found problems` / `could not produce a report` /
    `found no links to check`)。**シェルからは見えない YAML の配線も固定している**:
    通知ステップにも、その job にも `continue-on-error` が無いこと、
    `failIfEmpty: true` が明示されていること、`lychee-action` が読解した SHA に pin されて
    いること(**上げるときは `entrypoint.sh` を読み直す**)、lychee の `id: lychee` と
    `continue-on-error: true`、job の `issues: write`、`Upload report` が job を落とさないこと。
    通知ステップ・lychee・権限の 3 つと、テストが走らせる本文が通知ステップの `run` そのもので
    あることは、`yaml` でパースした結果で見る。**env / with の値は、そのステップの `env:` /
    `with:` の中で探す** — ファイル全体で探すと、別のステップへ移しても緑のままになる。
    **lychee には job より短い `timeout-minutes` を置いている** — job の制限に当たると GitHub は
    job を取り消し、通知ステップの暗黙の `success()` が偽になって Issue が立たない。ステップの
    制限なら runner は Failed として扱い、`continue-on-error` が job を続けるので「could not
    produce a report」で届く。前後のステップと kill が job の制限の内側に収まるよう、**差は 5 分以上**を
    テストが見る(`<` だけだと 29 / 30 でも通る)。**`npm ci` / build が固まった回と、手動・`concurrency` で
    取り消された回は、今も通知されない**(run の結果に残るだけ)
  - `vrt.yml` のベースライン配線(ADR 0003) — 運ぶ素材(`data/`)を 1 つ落としても VRT は走り、
    多くのページは通る。運ぶ・`paths` で監視する・描画に入らないと明言する、の三択と、運ぶのが
    ビルドより前であることを固定している
  - `ci-summary.yml` の通知判定 — PR の Actions が全部成功したときだけ PR に @メンション付き
    コメントを 1 件付ける(GitHub Mobile の通知を 1 回にまとめる)。失敗時に何もしない設計なので、
    判定が崩れて通知が消えても exit 0 のまま。`--jq` のフィルタは**実 jq に通す** —
    `.app.slug == "github-actions"` の絞り込みが無いと Cloudflare の check-run(`workflow_run` を
    起こさない)を待ち続けて通知が消える。`workflows:` の列挙が「`on:` に `pull_request` を持つ
    workflow の `name:`」と一致することも見る。重複防止の印は github-actions[bot] のコメントからだけ拾う。
    印を探す取得と照合の 3 行は、写しを置かない原則の例外として書き写して完全一致で固定する。gh のスタブが
    記録した呼び出しからも、check-runs の取得と投稿を除くとコメント一覧の取得 1 回(`--jq` は同じ式)だけが
    残ることを見る(fixture に例を並べるだけでは、fixture に無い項目や組み合わせで絞り込みを緩める・狭める
    書き換えを塞ぎきれない)。ただしこの 2 つは経路を写すだけなので、gh を通らない取得(`curl` など)・
    回していない条件(コメントの長さ・`GITHUB_EVENT_NAME` など)の分岐に足した照合・固定した 3 行を死んだコードにして
    別の変数で照合し直す形は塞げない(Hayato-Isagawa/edu-law#401)。ステップの外でも、workflow や job の
    `env`(`BASH_ENV`・`SHELLOPTS`)・`defaults.run.shell`・`on.workflow_run` の `types` / `branches`・`needs` で
    待たせる別の job などで、ステップを変えずに通知を黙って止められる。そこで同じく写しを置き、パースした
    workflow 全体を `zizmor-workflow.test.mjs` と同じ形で固定する。run だけは
    `scripts/__tests__/fixtures/ci-summary/notify-run.sh`(写し)と 1 文字ずつ比べ、テストが走らせる本文も
    同じ写しと比べる。これで上の形はどれも赤になる。**`ci-summary.yml` を変えるとき(`workflows:` の列挙に
    足すときも)はテストの期待値を直し、run を変えたら fixture もコピーで直す**。権限の置き場所・job と step の `if:`・notify の
    `if:` の式・通知ステップの env の値・`concurrency`(job には置かない)・テストが走らせる本文が
    notify の `run` そのものであることは、字面ではなく `yaml` でパースした結果で見る
    (`"permissions":` や `? permissions` のような等価な書き方を素通りさせない)。
    規則ごとに発火することは fixture で確かめている
  - `scripts/serve-dist.mjs`(VRT と E2E の webServer) — VRT は main 側も PR 側も PR のスクリプトで配るので、
    サーバーが壊れても両側が同じに壊れて差分 0 で通る(全部 404 でも `page.goto` は throw しない)。
    Content-Type・index.html と 301・無いパスへの 404.html(status 404)・root の外の 403 と、NUL を含むパス・読めないファイル・
    読めないディレクトリの配下・長すぎるパスで落ちないことを見る。長すぎるパスは 404、それ以外の
    I/O の失敗は 500 にして stderr に出す(VRT は status を見ないので、ログが唯一の手がかり)
  - `zizmor.yml` の検査を黙って無効にできる設定 — どれが崩れても job は緑のまま検査だけが効かなくなる。
    zizmor-action に渡すのが `advanced-security: false`・CI 用の空の設定(`rules: {}`)を指す `config:`・
    `collect: all` の 3 つだけであること、その設定を action の前の step で書くこと、トリガーが `pull_request`・
    週 1 回の `schedule`・`workflow_dispatch` であること、マージキーを使っていないこと、そして workflow 全体が
    決まった形であること(`env` の `ZIZMOR_OFFLINE`・`continue-on-error`・`if`・Checkout の中身も足せない)。
    `uses:` は Dependabot が上げるので形だけを見る(同じ action の古い SHA への差し替えは通る)

YAML をパースして見る検査(ci-summary・link-check・auto-merge の build.yml 配線と各 workflow のトリガー・zizmor-workflow)は、共通の
`scripts/__tests__/workflow-yaml.mjs` を使う。**マージキー(`<<:`)は、使っていること自体を
違反にする** — GitHub Actions は展開しないので、`merge: true` で読むと
GitHub では効かない値が「ある」と見え、「あること」を求める検査が緩む。`!!merge <<:` と
`%YAML 1.1` の下の `<<:` は `merge: false` でも yaml が展開するので、マージキーは
展開後の値ではなく文書の木で探している。

共通ファイルには、手元の yaml と GitHub の runner で読みが食い違いうる書き方を拾う **`ambiguousYaml`** もある
(2026-11 時点で姉妹リポと同じ中身)。拾うのは、行区切りに使われうる単独の CR・U+0085・U+2028・U+2029、タブ・LF・CR
以外の制御文字(C0・DEL・C1。行区切りとして読まれる U+0085 を除くと、読みが食い違うのは NUL で、ほかは workflow で使わないので一緒に落とす)、yaml の警告(未知のタグ・
未知のディレクティブなど)、明示したタグ、`%YAML` のディレクティブ、`!!` 以外のハンドルを宣言するか `!!` の接頭辞を
差し替える `%TAG`(`!!` を既定と同じ `tag:yaml.org,2002:` で宣言し直す形は拾わない)、マップや列をキーにした形(`[x]: 1`)、
文字列でないキー(null・数値・真偽値。runner はキーを .NET の書式で文字列にしてから重複を判定するので、`null:` と `"":`
のような組が食い違う)、エイリアスをキーにした形(yaml はエイリアスで書いたキー(`&k t: 99` と `*k : 5`)の重複を検出
せず後に書いた値で読み、runner はアンカーを拒むか、読み直したうえで重複として拒む)、文字列のキーの重複(runner は大文字小文字を区別
せずに重複を判定するので、大文字小文字をそろえて比べる)。どれも yaml はエラーにせず読むので、同じ値に読めればパース結果で
比べる全体の固定(ci-summary・zizmor)を素通りする(Hayato-Isagawa/edu-evidence#868。このリポでも
`runs-on: !foo ubuntu-latest` が素通りした)。yaml のエラー(yaml が検出するキーの重複など)も拾うが、こちらは
`parseWorkflow` が例外を投げるので、全部の workflow を読む auto-merge・ci-summary のテストでも赤になる。
GitHub 側で読みが変わって挙動が変わるかは、actions/runner と YamlDotNet 5.3.0 のソースを読んで確かめただけで、
実行はしていない。
**判定は `.github/workflows/` の全部の workflow に当てる**(テストが読む workflow だけに当てると漏れる。以前は行区切りの
文字を ci-summary と zizmor の 2 本でしか見ていなかった)。判定自体が no-op に落ちていないことは、書き方ごとの fixture で
確かめる。マージキーの判定(`mergeKeyPaths`)は、auto-merge・ci-summary・link-check のテストの fixture でも条件を外すと赤に
なるが、判定そのものの書き方ごとの発火も fixture にまとめて確かめる(`!!merge` のタグの条件だけは、yaml 2.9.1 では Symbol の条件と重なって単独では固定できない)。3 本とも
`zizmor-workflow.test.mjs` の末尾にある。

`test:lib`・`test:githooks`・`test:workflows` は `assert-test-files.mjs` / `assert-test-results.mjs` を
通している。`node --test` は「glob が 0 件」「中身が空」「全件 skip」のどれでも exit 0 で
終わるので、守っているつもりのガードが no-op に落ちても気づけないため。下限 pass 数を
割ったら落ちる。**テストを足したら下限も上げること**(`package.json` の数値)。
`test:lib` は拡張子なしの import を tsx で解決するので、`--import tsx` を `assert-test-results.mjs` の
引数で渡し、`node --test` のフラグにしている。**`NODE_OPTIONS` で渡さない** — esbuild の worker にまで
引き継がれ、テストが chdir した後に初めての変換が起きると(chdir より前に読み込むモジュールがすべて
キャッシュにあり、chdir 先から tsx が見つからないとき)、worker が tsx を cwd から探して落ち、本体は時間制限なしで止まる
(test:lib が 7 分以上止まった実例がある)。引数なら worker には届かない。

## ビジュアルリグレッションテスト(VRT)

CI 内で `main` と PR の両方をビルドし、同一環境で撮り比べる(ファミリーと同じ「案A + コンテンツ中立」)。
ベースライン PNG はコミットしない(`vrt/__screenshots__/` は gitignore)。手元では `npm run vrt`。

- **main 側は「main のコード × PR のコンテンツ」でビルドする**(ADR 0003)。`data/`(datasets と
  schema)を PR 側から main の worktree へ `rsync --delete` で運んでからビルドするので、他ファイルの
  データセット追加・修正が波及しただけの赤は出ない。main のコードで PR の `data/` をビルドできなければ
  main 自身の `data/` で撮り直す(degraded。summary と artifact 名に出る)。運ぶ素材の allowlist と
  degraded 経路は `scripts/__tests__/vrt-baseline.test.mjs` が固定している(`test:workflows` の口)。
  `src/data/geo` は運ばず `paths` で監視する(描画の入力なので)。
  逃がし: Actions から `workflow_dispatch` で `neutral: false` にすると素の main と撮り比べる

- **対象は全ページではなくテンプレートの代表**。データセットは市町村(地図あり) /
  都道府県 / 経年の 3 型があるので 1 本ずつ。テンプレートを増やしたら
  `vrt/pages.spec.ts` に 1 行足す
- **`/changelog/` は撮らない**。PR ごとに 1 行増えるので、撮ると内容の追加だけで必ず差分が出て
  本当の崩れが埋もれる
- **判定は `threshold: 0` + `maxDiffPixels: 500`、`retries: 0`**(ADR 0003。500 は点線下線のノイズ実測 350〜370 px から)。同一ビルド同士の撮り比べは
  差分 0(当時の 13 本 × 2 幅=26 件が閾値 0 で全通過)。一方 `h2` の `letter-spacing` を 0.06em 変える実験では、
  ファミリー既定だった 0.01 だと 26 件中 2 件しか落ちない(0.001 では 12 件)。その後比率そのものを
  やめた — 許容量がページの長さに比例して長いページほど甘く、pixelmatch の既定 `threshold: 0.2`
  未満の色差は比率を下げても数えられないため(edu-law の実測)
- このリポは**テーマ切替も hydration も無く、チャートと地図はビルド時の静的 SVG**(ADR 0001)
  なので、撮るたびに変わる要素が構造的に無い
- **依存の更新でも起動する**(`package.json` / `package-lock.json`。ADR 0003)。astro や tailwind の
  minor は生成される HTML と CSS を変えうるのに、以前は Dependabot PR で誰も見ていなかった。
  ローカルで撮り比べるときは `main` と PR の 2 ビルドを用意し、`VRT_DIST` を差し替えて
  2 回走らせる。`reuseExistingServer` は切ってあるので、ポート 4179 を**別のプロセスが
  掴んでいる**と起動の時点で止まる(以前は手元だけ再利用が有効で、居座っているプロセスを
  そのまま使い、別物を撮って差分 0 で通った)

## セキュリティ

- 静的優先。クライアント JS は必要な island に限定
- CSP は `public/_headers` で管理。script-src を緩める変更は理由を ADR に残す
- 主要な意思決定は `docs/decisions/`(ADR、連番 4 桁・原則改変しない)に記録する。運用方針と索引は同ディレクトリの README を参照
- 外部リンクは `rel="noopener noreferrer"`。`set:html` を使う場合はエスケープを確認
