import { defineConfig } from "@playwright/test";

// reuseExistingServer が有効だと、他プロジェクトの dev サーバーが同じポートを
// 使っていた場合にそのサイトを検査してしまう(2026-08-02 に実際に起き、無関係な
// 83 件の失敗として現れた)。ポートを差し替えられるようにし、globalSetup で
// 検査対象が本サイトであることを確認してから走らせる。
const port = Number(process.env.PREVIEW_PORT ?? 4176);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/assert-target-site.ts",
  fullyParallel: true,
  // test.only の混入で他の spec が黙って飛ばないよう、CI では止める(playwright.vrt.config.ts と同じ)
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL,
  },
  webServer: {
    command: `npm run preview -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
