# データでみる沖縄 (okinawa-in-data)

沖縄県の公的データ(第1弾: 教育×子どもの貧困)を PDF 散在状態から構造化し、一次出典への恒久リンクと解説付き可視化で「読めるデータ」として提供する独立サイト。公式 OKINAWA DPF(カタログ型)の再カタログ化はしない。

2026-11 に非公開リポから移した。文書・コメント中のリポ名の付かない `#番号`・コミット SHA・`rule N` は移行前の環境のもので、第三者は辿れず、このリポの PR / issue とも対応しない。

## スタック

- Astro 7 (SSG) + React 19 + Tailwind CSS 4 + TypeScript / npm / Node 24 (mise)
- ホスティング: Cloudflare Workers static assets(wrangler.jsonc。Pages ではない)
- 可視化: Observable Plot を**ビルド時に静的 SVG 生成**(クライアント JS を増やさない)。チャートには必ず等価なデータテーブルを併設する

## データ層の鉄則

- `data/` はサイト実装から独立したデータ資産。1データセット = `data/datasets/<id>/`(meta.json + data.csv + data.json + raw/ + notes.md)
- メタデータは `data/schema/dataset-meta.ts` の Zod スキーマが単一ソース。検証は `npm run check:data`
- **数値の転記は一次資料と逐語照合するまで `status: "published"` にしない**。取得は `curl` + `pdftotext -layout`、WebFetch は概要把握のみ(逐語確認に使わない)
- `raw/` には pdftotext の生テキストを監査証跡として保存。変換の判断(セル結合の解釈・欠損の扱い)は notes.md に記録。
  出典の規約で本文を再配布できない、または再配布できるか確認できていないもの(`kodomo-chosa-konkyu-keinen`・`ses-gakuryoku-hogosha-chosa`)は生テキストをリポに入れず、
  `raw/README.md` に理由と原本の取得先を書く(`npm run check:data` は published の `raw/` が空でないことを求める)
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
  **依存の更新も見た目に効く**ので `package.json` / `package-lock.json` も VRT の起動条件に入れてある
- コミットはユーザーの明示指示または承認を得てから行う
- ユーザー向けの変化がある PR では changelog ページを同時更新する(公開後の運用)

## テスト(`tests/`)

`.github/workflows/e2e.yml` が PR ごとに `npx playwright test` で全部回す。手元では `npm run test:e2e`
(a11y だけなら `npm run test:a11y`)。**先に `npm run build` が要る** — a11y と search は読み込み時に `dist/` を走査し(無ければ ENOENT で落ちる)、
external-links はテストの中で `dist/` を走査する。datasets は `data/` から対象を作り、公開範囲のテストは `dist/datasets/`・`dist/data/`・sitemap も走査する。external-links 以外は preview が配る `dist/` をブラウザで開く。spec が読むパスはリポのルートから解決するので、別のディレクトリから `-c playwright.config.ts` で起動しても同じ対象を見る(config を渡さないと webServer・globalSetup・`forbidOnly` が効かない)。
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
    `meta.json.hold` へのリネームで止める)。`dist/datasets/` と `dist/data/` のディレクトリ、
    sitemap のデータセット URL のそれぞれが、meta.json を持つ id の集合と一致するかで見る。
    meta.json があるのに欠けたものと余計なものはいつでも落ちるが、**取り下げたものが外れているかを
    ここで見られるのは、取り下げ中のデータセットが実在するときだけ**。ローダーの除外そのものは
    `src/lib/__tests__/` が一時ディレクトリで見ている(以前は取り下げた実例を 1 件ずつ 404 で引き、
    実例が 1 件以上あることも求めていたので、唯一の実例を戻した #235 で落ちた)
- **`navigation.spec.ts`** — 主要導線と 404
- **`external-links.spec.ts`** — 別の窓で開くリンク(`target` が `_self` / `_parent` / `_top` 以外)が
  すべて `rel="noopener noreferrer"` を持つか。dist の全 HTML と `maps/*.svg`(MapExplorer が
  innerHTML に入れる断片)を linkedom で DOM にして見る。`<base target>` も見る。
  **0 件で緑にならないよう下限(100 件)を置いている**。実行時に JS が作るリンクは見ない
- **`search.spec.ts`** — サイト内検索(Pagefind、ADR 0005)が本番と同じ CSP の下で動くか。
  `astro preview` は `public/_headers` を適用しないので、そこから読んだ CSP を同一オリジンの
  **全レスポンス**に付けて配る(Pagefind は WASM を Worker で動かし、Worker の CSP は Worker
  スクリプト自身のレスポンスで決まるため、HTML だけに付けると `'wasm-unsafe-eval'` を外しても通る)。
  索引から外したページ(更新履歴・検索・404)が、それぞれの本文にだけある語の結果に出ないことも
  見る — `data-pagefind-body` が 1 つも無いと Pagefind は全ページの body を索引するので、その後退も
  これで落ちる。市町村ページの `data-pagefind-ignore`(数値カード・順位の注記・指標の表・出典リスト)が
  外れると全市町村ページが結果に出る語でも引く。データセットとテーマのページの表(`DataTable.astro`)の
  `data-pagefind-ignore` の外れは見ていない

**CI は PR でだけ回る。`main` への push では回さない**(2026-09-01)。マージ後の再検証は
PR で見たものと同じ内容で、実測でも push[main] だけが捕まえた失敗は 0 件だった。
Actions の無料枠が月末に尽きて private 全リポの CI が 10 日間止まった事故を受けている。
**代わりに `e2e.yml` が週 1 で `main` を回す** — PR が作った Playwright キャッシュは他の PR から
見えず、`refs/heads/main` の run が作ったものだけが全 PR から引けるため。

Playwright ではないテストが 3 つある。いずれも `npm run check:all` と `build.yml` に入っている。

- **`scripts/lib/__tests__/`・`src/lib/__tests__/`**(`npm run test:lib`) — Excel → CSV の変換ヘルパーと、
  データセットのローダーが meta.json の無いディレクトリを読まないこと
- **`.githooks/__tests__/`**(`npm run test:githooks`) — pre-commit / pre-push
- **`scripts/__tests__/`**(`npm run test:workflows`) — ワークフローに埋め込まれた判定ロジックと、VRT が使う配信スクリプト。
  auto-merge・link-check・ci-summary の 3 本はワークフローから `run:` ブロックを取り出し、`gh`(auto-merge は
  `sleep` も)をスタブして走らせる。**写しを置かないので、ワークフロー側を変えるとテスト対象も変わる**
  — 数値や条件をテストに書き写さない。4 本目の `vrt-baseline.test.mjs` は `vrt.yml` を静的に走査する
  (下記)。5 本目の `serve-dist.test.mjs` は `scripts/serve-dist.mjs` を起動してリクエストする。
  6 本目の `zizmor-workflow.test.mjs` は `zizmor.yml` を `yaml` でパースして読む。
  **6 本とも壊れ方が静かで、CI は緑のまま結果だけが変わる**:
  - `dependabot-auto-merge.yml` の待機ロジック — **main への唯一の自動書き込み経路**。
    #83 の job 名変更で 30 分沈黙 → CANCELLED に化け、PR が 2 本溜まるまで
    気づけなかった(#94)
  - `link-check.yml` の通知分岐 — open な Issue があると検出を捨てていたため、
    2026-08-17 に見つかった 404 が 2 日間どこにも出なかった(404 自体の修正は #105、
    通知の穴を塞いだのは #107)。既存 Issue の**探し方**(ラベル・状態)と**扱い方**
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
    あることは、`yaml` でパースした結果で見る(#218)。**env / with の値は、そのステップの `env:` /
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
    workflow の `name:`」と一致することも見る。重複防止の印は github-actions[bot] のコメントからだけ拾う。権限の置き場所・job と step の `if:`・notify の
    `if:` の式・通知ステップの env の値・`concurrency`(job には置かない)・テストが走らせる本文が
    notify の `run` そのものであることは、字面ではなく `yaml` でパースした結果で見る
    (`"permissions":` や `? permissions` のような等価な書き方を素通りさせない。#148 / #218)。
    規則ごとに発火することは fixture で確かめている
  - `scripts/serve-dist.mjs`(VRT の webServer) — VRT は main 側も PR 側も PR のスクリプトで配るので、
    サーバーが壊れても両側が同じに壊れて差分 0 で通る(全部 404 でも `page.goto` は throw しない)。
    Content-Type・index.html と 301・root の外の 403 と、NUL を含むパス・読めないファイル・
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
- **依存の更新でも起動する**(`package.json` / `package-lock.json`)。astro や tailwind の
  minor は生成される HTML と CSS を変えうるのに、以前は Dependabot PR で誰も見ていなかった。
  ローカルで撮り比べるときは `main` と PR の 2 ビルドを用意し、`VRT_DIST` を差し替えて
  2 回走らせる。**`CI=1` を付けること** — 手元は `reuseExistingServer: true` なので、
  ポート 4179 を**別のプロセスが掴んでいる**とそれをそのまま使い、別物を撮って
  差分 0 で通る(Playwright は run の終わりに自分のサーバーを落とすので、
  2 回目が 1 回目のを引き継ぐわけではない。危ないのは居座っているプロセスの方)

## セキュリティ

- 静的優先。クライアント JS は必要な island に限定
- CSP は `public/_headers` で管理。script-src を緩める変更は理由を ADR に残す
- 主要な意思決定は `docs/decisions/`(ADR、連番 4 桁・原則改変しない)に記録する。運用方針と索引は同ディレクトリの README を参照
- 外部リンクは `rel="noopener noreferrer"`。`set:html` を使う場合はエスケープを確認
