import { test, expect } from "@playwright/test";

test.describe("主要導線", () => {
  test("トップからデータセット一覧・詳細まで辿れる", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("link", { name: /データセット/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/datasets\/$/);

    const first = page.locator('a[href^="/datasets/"][href$="/"]').first();
    const href = await first.getAttribute("href");
    await first.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator("h1")).not.toBeEmpty();
  });

  test("エリア一覧から市町村ページへ辿れる", async ({ page }) => {
    await page.goto("/area/");
    const naha = page.locator('a[href="/area/naha/"]').first();
    await naha.click();
    await expect(page).toHaveURL(/\/area\/naha\/$/);
    await expect(page.locator("h1")).toContainText("那覇");
  });
});

test.describe("404", () => {
  test("存在しない URL では 404 ページが出る", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist/");
    expect(res?.status()).toBe(404);
  });

  test("404 ページはトップページではない", async ({ page }) => {
    await page.goto("/this-page-does-not-exist/");
    // トップにしかない導線が出ていたら、404 ではなくトップが返っている
    await expect(page.locator('a[href="/datasets/"]').first()).toBeVisible();
    await expect(page.locator("h1")).not.toContainText("データでみる沖縄");
  });
});
