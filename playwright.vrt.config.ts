import { defineConfig } from "@playwright/test";

// VRT_DIST で撮影対象のビルドを差し替える。CI は main と PR の 2 つを
// ビルドして同じ設定で撮り比べる(vrt/pages.spec.ts 冒頭を参照)。
const dist = process.env.VRT_DIST ?? "dist";

// ポートはファミリー各リポで固定する(evi 4173 / watch 4174 / law の VRT 4175 /
// このリポの a11y preview 4176 / 別の姉妹リポの VRT 4177 / law の e2e 4178)。
// 別プロジェクトのサーバーに当たると、別サイトを撮って差分無しで通ってしまう。
const PORT = 4179;

export default defineConfig({
  testDir: "./vrt",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // リトライしない。同一ビルド同士の撮り比べで差分が 0 になることを実測して
  // いるので、落ちたのは基本的に本物である。リトライを入れると、間欠的に出る
  // 問題を握り潰す。
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  snapshotPathTemplate: "vrt/__screenshots__/{projectName}/{arg}{ext}",
  expect: {
    timeout: 30000,
    toHaveScreenshot: {
      // 比率(maxDiffPixelRatio)はやめた(ADR 0003)。許容量 = 総ピクセル数 × 比率
      // なのでページの長さに比例し、長いページほど甘い(edu-law の実測では
      // 0.001 の許容が短いページと長いページで約 15 倍開いた)。0.01 → 0.001 に
      // 下げた経緯と実測値は AGENTS.md の VRT 節が正典。
      //
      // 色差: Playwright が pixelmatch に渡す threshold(既定 0.2)未満の色差は
      // 差分として数えられないので、比率をいくら下げても色だけの変更は捕まらない
      // (edu-law #160 で省庁バッジの色変更を取り逃がした実例)。
      //
      // threshold と maxDiffPixels は最終判定だけでなく、撮影の安定化ループ
      // (連続 2 枚が一致するまで撮り直す)の収束条件でもある。収束しないと
      // expect.timeout に達して "Failed to take two consecutive stable
      // screenshots" で落ちる。CI(Linux)のノイズは PR 自身の run を 3 回まわして
      // 測った(ADR 0003)。
      threshold: 0,
      // threshold: 0 はバイト完全一致ではない。pixelmatch の includeAA(既定
      // false・Playwright は上書きしない)により、アンチエイリアスと判定された
      // 画素は差分に数えない。エッジだけが変わる変更は残る盲点。
      //
      // 完全一致(0)は CI で通らなかった。市町村ページの用語リンク(.term-link、
      // text-decoration: underline dotted)の点の位相が撮影ごとにずれ、3 run 中
      // 2 run で mobile の 1 ページ(毎回違う)に 350〜370 px の差分が出た(ADR 0003)。
      // 上限はその実測から置く — 370 の約 1.4 倍。代償として、この値未満の本物の
      // 差分(短いラベル 1 個程度)は通る。長さに比例しないので比率より狭い。
      maxDiffPixels: 500,
      animations: "disabled",
      caret: "hide",
    },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    // .anim-rise は最大 0.45s 遅延 + 0.7s。animations: "disabled" は撮影時に
    // CSS アニメーションを止めるが、静止状態で撮ることを明示しておく。
    contextOptions: { reducedMotion: "reduce" },
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    // 依存を持たない自前の静的サーバー(serve を外した理由はスクリプト冒頭)
    command: `node scripts/serve-dist.mjs ${dist} ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
