/**
 * サイト内検索(Pagefind、ADR 0005)が、本番と同じ CSP の下で動くか。
 *
 * `astro preview` は public/_headers を適用しないので、そこから読んだ CSP を
 * 同一オリジンの**全レスポンス**に付けて配る。Pagefind は WASM を Worker の中で
 * 動かし、Worker の CSP は Worker スクリプト自身のレスポンスで決まる。HTML に
 * だけ付けると、'wasm-unsafe-eval' を外しても検索は通ってしまう。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const csp = fs
  .readFileSync(path.join(ROOT, "public/_headers"), "utf8")
  .match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];

test.beforeEach(async ({ context, baseURL }) => {
  expect(csp, "public/_headers に CSP が見つからない").toBeTruthy();
  const origin = new URL(baseURL!).origin;
  await context.route(
    (url) => url.origin === origin,
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: { ...response.headers(), "content-security-policy": csp! },
      });
    }
  );
});

function collectCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (msg) => {
    if (msg.text().includes("Content Security Policy"))
      violations.push(msg.text());
  });
  page.on("pageerror", (err) => {
    if (err.message.includes("Content Security Policy"))
      violations.push(err.message);
  });
  return violations;
}

test("?q= の語で検索結果が出る(CSP 下)", async ({ page }) => {
  const violations = collectCspViolations(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/search/?q=那覇");

  await expect(
    page
      .locator('#search a.pagefind-ui__result-link[href^="/area/naha/"]')
      .first()
  ).toBeVisible();
  expect(violations).toEqual([]);

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target.join(" ")),
    }))
  ).toEqual([]);
});

// 索引から外したページ(searchable={false})と、その本文にだけある語。
// どれかのページが索引に入ると、その語の結果にそのページが混ざる。
// data-pagefind-body が 1 つも無いと Pagefind は全ページの body を索引するので、
// その後退もここで落ちる
const excluded = [
  { url: /^\/changelog\//, term: "更新履歴" },
  { url: /^\/search\//, term: "対象外" },
  { url: /^\/404/, term: "削除" },
];

async function searchUrls(page: Page, term: string): Promise<string[]> {
  await page.goto("/search/");
  // ブラウザ側で dist の pagefind.js を読む(文字列リテラルだと tsc が解決しようとする)
  return page.evaluate(
    async ([src, q]) => {
      const pagefind = await import(src);
      const search = await pagefind.search(q);
      const data = await Promise.all(
        search.results.map((r: { data: () => Promise<{ url: string }> }) =>
          r.data()
        )
      );
      return data.map((d) => d.url);
    },
    ["/pagefind/pagefind.js", term]
  );
}

for (const { url, term } of excluded) {
  test(`索引に入れないページは結果に出ない: ${term}`, async ({ page }) => {
    const urls = await searchUrls(page, term);
    expect(urls.filter((u) => url.test(u))).toEqual([]);
  });
}

// 市町村ページの data-pagefind-ignore(数値カード・順位の注記・指標の表・出典リスト)と、
// 各領域を外したときに /area/ の結果に出てくる語。ignore を 1 か所外すと、少なくとも
// 1 語が全市町村ページの結果に出る(2026-10 に 1 か所ずつ外した dist で索引を作って確認)。
// 表と出典リストは複数の語で落ちるので、組を変えるときは外して確かめ直すこと
const areaIgnored = [
  { region: "数値カード", term: "納税者" },
  { region: "順位の注記", term: "順位" },
  { region: "指標の表", term: "出生者数" },
  { region: "出典リスト", term: "父子世帯数" },
];
const areaDir = path.join(ROOT, "dist/area");
const areaHtml = fs
  .readdirSync(areaDir)
  .map((slug) => path.join(areaDir, slug, "index.html"))
  .filter((file) => fs.existsSync(file))
  .map((file) => fs.readFileSync(file, "utf8"));

for (const { region, term } of areaIgnored) {
  test(`市町村ページの${region}は索引に入らない: ${term}`, async ({ page }) => {
    // 語がページから消えると、何も守らずに通るようになる
    expect(areaHtml.filter((html) => html.includes(term)).length).toBe(
      areaHtml.length
    );
    expect(areaHtml.length).toBeGreaterThan(0);

    const urls = await searchUrls(page, term);
    expect(urls.filter((u) => u.startsWith("/area/"))).toEqual([]);
  });
}
