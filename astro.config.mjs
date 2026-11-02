// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // 本番ドメインは公開直前に決定(プロジェクト方針)。決定後にこの値を差し替える
  site: "https://okinawa-in-data.org",
  // dev サーバーのポートはリポジトリごとに固定する。既定の 4321 だと、
  // 別リポの dev サーバーが先に取っていた場合に Astro が黙って番号を繰り上げ、
  // 「起動したつもりのポートに別プロジェクトが居る」状態になる。
  // 4321 は設定を持たないプロジェクト用に空けてある。
  server: { port: 4326 },
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    // CSP を script-src 'self' で維持するため、小さなスクリプトの
    // インライン化(<script type="module"> 直書き)を無効にする
    build: { assetsInlineLimit: 0 },
  },
});
