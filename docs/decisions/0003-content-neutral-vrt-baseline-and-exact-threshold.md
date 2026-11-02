# 0003. VRT のベースラインを「main のコード × PR のコンテンツ」で撮り、判定を `threshold: 0` にする

日付: 2026-09-11
状態: 採用

## 背景

このリポの VRT は 2026-08 に導入した(ADR 無し。経緯は `.github/workflows/vrt.yml` 冒頭と `AGENTS.md`「VRT」)。
CI 内で main と PR を両方ビルドして同一環境で撮り比べる形(ファミリー共通の「案A」)で、テンプレート代表
13 本 × desktop / mobile を撮る。

2 つの穴が姉妹リポで実測されている。

**ベースライン側**: PR が main との間にコンテンツの追加・修正を挟むと、それがページの描画に波及して
視覚回帰ではない赤が出る。edu-evidence は ADR 0034 で「ベースラインを main のコード × PR のコンテンツで
撮る」形に変え、過去 PR の再現で 5 赤 → 1 赤(残った 1 赤はテンプレートを触った本物)を実測した。
このリポのコンテンツは `src/` の外の `data/`(`data/datasets/` を `src/lib/datasets.ts` が `process.cwd()`
から fs で読む。スキーマは `data/schema/`)にあり、`paths` に無いのでデータセットだけの PR では VRT は
起動しないが、`src/pages` 等を触る PR には同じ波及が乗る。

**判定側**(edu-law が実測): `maxDiffPixelRatio` の許容量は総ピクセル数 × 比率なので長いページほど甘く
(0.001 の許容が短いページと長いページで約 15 倍開いた)、Playwright が pixelmatch に渡す `threshold`(既定 0.2)
未満の色差は比率を下げても数えられない。

## 決定

1. **ベースラインを「main のコード × PR のコンテンツ」で撮る。** `Build baseline (main code x PR content)`
   ステップが main の worktree に PR の `data/` を `rsync -a --delete` で運んでからビルドする。schema は
   `data/` ごと運ばれる(別々にすると PR の `meta.json` を main の zod が弾く)。main のコードで PR の
   `data/` をビルドできなければ、main 自身の `data/` で撮り直す(degraded。summary と artifact 名
   `vrt-report-<mode>` に出す)。`workflow_dispatch` の `neutral: false` で素の main と撮り比べる逃がしも持つ
2. **`src/data/geo` は運ばず `paths` で監視する。** 地図の境界データは描画の入力で、変更頻度が低く
   コンテンツ増加のノイズも無い。運ぶと差し替えの視覚変化が永久に見えなくなる。以前は `paths` に無く
   誰も監視していなかった
3. **判定を `threshold: 0` + `maxDiffPixels: 500` にする。** `maxDiffPixelRatio` はやめる。500 はノイズの実測から置いた(下記)

`package.json` / `package-lock.json` は運ばない(依存の視覚影響は VRT が見るべきもので、`paths` に載せて
起動させている。edu-evidence ADR 0035 と同じ判断)。`public/` も運ばない(ブランド資産と配信設定)。
なおこのリポの `dependabot-auto-merge.yml` は「SHA に現れた check」を全部待つので、依存 bump で走った VRT は
Dependabot PR の gate になる(public な姉妹リポでは required しか待たないので事後の記録止まり)。
`threshold: 0` で赤が増えれば、その分マージが止まる。

### ガード

運ぶ素材の allowlist は手書きなので、`scripts/__tests__/vrt-baseline.test.mjs` が固定する: `data/` を
`--delete` 付きでビルドより前に運ぶこと・`data/datasets/` だけを運ぶ形に変わっていないこと・`src/` の各
ディレクトリが「運ぶ・`paths` で監視する・描画に入らないと明言する」のどれかに割り当てられていること・
`src/data` が `paths` にあること・`id: baseline`・degraded の失敗許容がビルド 1 つに閉じていること・
artifact 名。`test:workflows` の下限は 68 → 82。

### ノイズ測定(2026-09-11)

`threshold: 0` は撮影の安定化ループの収束条件でもあるので、CI で測ってから置く。この PR は描画を変えないので、
PR 自身の VRT run が「同一 dist の撮り比べ」になる。

**完全一致(`maxDiffPixels: 0`)では通らなかった。** `workflow_dispatch` で本ブランチの VRT を 3 回まわした
(run 34583221009 / 34583525415 / 34583795847。3 回とも `MODE: neutral`、baseline `0efaf06` で不変、収束失敗 0)ところ、
run 2 で mobile `area-aguni` が 370 px、run 3 で mobile `area-naha` が 350 px の差分(run 1 は 26 / 26 全通過)。
diff 画像を実見すると、市町村ページの用語リンク(`.term-link`、`text-decoration: underline dotted`)4 か所の
点線の位相が撮影ごとにずれている。desktop では出ない。

`maxDiffPixels` はその実測から **500** に置いた(370 の約 1.4 倍)。代償として 500 px 未満の本物の差分(短いラベル
1 個程度)は通る。比率に戻さないのは、許容が長さに比例しないため(那覇のページは mobile で高さ 3779 px、
0.001 なら許容 1474 px と 3 倍緩い)。点線下線をやめれば 0 に戻せるが、サイトの見た目を変えるので別件。
置いた後の 3 run(34584774909 / 34585050327 / 34585308903)は 3 回とも neutral・baseline `0efaf06`・26 / 26 全通過・収束失敗 0。

## 帰結

### 利点

- 他ファイルのデータセット追加・修正が波及しただけの赤が構造的に消える
- 色だけの変更・長いページの小さな差分が捕まる
- geo の差し替えが VRT の対象になる

### コスト・受け入れた死角

- degraded ではベースラインを 2 回ビルドする
- **`data/schema/dataset-meta.ts` の `THEME_LABELS` は描画側(`DatasetCard.astro` / `datasets/[id]/index.astro`)が import する。** `data/`
  ごと運ぶので、その変更は VRT から見えない。ラベルをコード側へ移せば見えるようになる
- **`src/lib` が `scripts/lib/{csv,prefectures}` を import している**(`datasets.ts` / `indicators.ts` /
  `lead.ts` / `DataTable.astro` / `datasets/[id]/index.astro`)。`scripts/lib` は `paths` にも運ぶ素材にも無く、ガードの三択走査は `src/`
  しか見ない。本 ADR 以前からの穴で、本 ADR では触らない
- `.astro` に直接書かれた散文(`changelog.astro` の `entries` 等)は中立化されない
- `threshold: 0` はバイト完全一致ではない。pixelmatch の `includeAA` でアンチエイリアスと判定された画素は
  数えない。加えて `maxDiffPixels: 500` の分だけ小さな差分は通る
- `AGENTS.md` の「`h2` の `letter-spacing` 実験で 0.001 では 12 件」は比率時代の記録として残す

## 撤回 / 再検討の条件

- CI で収束失敗("Failed to take two consecutive stable screenshots")が繰り返し出るなら、`maxDiffPixels` を
  ノイズの実測値に置き直す(比率には戻さない)
- degraded が常態化するなら、運ぶ素材の形(`data/schema` のロジック)を見直す
