/**
 * 検査対象が本サイトであることを確認する globalSetup。
 *
 * playwright.config.ts の reuseExistingServer により、同じポートで動いている
 * 別プロジェクトの dev サーバーがあるとそのサイトを検査してしまう。その場合は
 * 全ページが「見つからない/構造が違う」で落ち、原因が分かりにくいため、
 * 走らせる前に落として理由を示す。
 *
 * 判定は <title> で行う。本文の文字列だと、このサイトを紹介している別サイト
 * (制作者のポートフォリオなど)を本サイトと誤認する。
 */
import type { FullConfig } from "@playwright/test";

const TITLE_MARKER = "データでみる沖縄";

export default async function assertTargetSite(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) throw new Error("baseURL が設定されていません");

  const html = await (await fetch(baseURL)).text();
  const title =
    /<title[^>]*>([^<]*)<\/title>/.exec(html)?.[1]?.trim() ?? "(title なし)";
  if (!title.includes(TITLE_MARKER)) {
    throw new Error(
      [
        `${baseURL} は「データでみる沖縄」ではありません(title: ${title})。`,
        "別のプロジェクトの dev / preview サーバーが同じポートを使っている可能性があります。",
        "別ポートで実行する場合: PREVIEW_PORT=4399 npm run test:a11y",
      ].join("\n")
    );
  }
}
