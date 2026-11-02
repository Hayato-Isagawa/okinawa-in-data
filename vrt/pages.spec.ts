import { test, expect } from "@playwright/test";

/**
 * ビジュアルリグレッションテスト。
 *
 * 比較方式はファミリーと同じ「案A + コンテンツ中立」で、CI 内で main と PR の両方を
 * ビルドし、同一 Linux 環境で撮影して比べる。ベースライン PNG はコミットしない
 * (`vrt/__screenshots__/` は gitignore)。システムフォント描画の
 * macOS↔Linux 差を避けるため。
 *
 * デザイントークンは姉妹リポの sync-family-tokens.yml がファミリー横断で
 * 同期しているのに、視覚回帰を見ているのは evi / law / watch の 3 本だけだった。
 * トークンが動いてもこのリポでは誰も見ていない状態だったので入れる。
 *
 * ## このリポは撮りやすい
 *
 * テーマ切替が無く(localStorage も prefers-color-scheme も見ていない)、
 * `client:` の hydration も無い。チャートと地図はビルド時に静的 SVG として
 * 焼かれる(ADR 0001)。つまり撮るたびに変わる要素が構造的に無い。
 *
 * ## 撮らないページ
 *
 * `/changelog/` は PR ごとに 1 行増えるので、撮ると内容の追加だけで必ず差分が
 * 出て本当の崩れが埋もれる(edu-evidence #428 で確認済み)。
 */

interface Target {
  name: string;
  path: string;
}

// 全ページは撮らない。テンプレートの代表を選ぶ。
// データセットは市町村(地図あり) / 都道府県 / 経年の 3 型があるので 1 本ずつ。
const pages: Target[] = [
  { name: "home", path: "/" },
  { name: "about", path: "/about/" },
  { name: "glossary", path: "/glossary/" },
  { name: "methodology", path: "/methodology/" },
  { name: "theme-education-poverty", path: "/themes/education-poverty/" },
  { name: "datasets-index", path: "/datasets/" },
  { name: "dataset-shichoson", path: "/datasets/gakureki-okinawa-shichoson/" },
  {
    name: "dataset-todofuken",
    path: "/datasets/gakuryoku-chosa-r7-todofuken/",
  },
  { name: "dataset-keinen", path: "/datasets/shingaku-ritsu-keinen/" },
  { name: "area-index", path: "/area/" },
  { name: "area-naha", path: "/area/naha/" },
  // 人口の小さい村。データ欠損時の描き分けが崩れていないかを見る
  { name: "area-aguni", path: "/area/aguni/" },
  // 検索 UI はクライアントで描く。初期表示(入力欄のみ)を撮る
  { name: "search", path: "/search/" },
  { name: "not-found", path: "/404.html" },
];

for (const p of pages) {
  test(p.name, async ({ page }) => {
    await page.goto(p.path, { waitUntil: "networkidle" });

    // 遅延画像があれば読み込ませてから撮る。スクロールに頼ると、読み込みを
    // 開始していない lazy 画像がビューポートから遠ざかって以後読み込まれない
    // (姉妹リポで実測)。lazy を降ろして完了を待つ。
    await page.evaluate(() => {
      for (const img of Array.from(document.images)) img.loading = "eager";
    });
    await page.waitForFunction(() =>
      Array.from(document.images).every(
        (img) => img.complete && img.naturalWidth > 0
      )
    );

    await expect(page).toHaveScreenshot(`${p.name}.png`, { fullPage: true });
  });
}
