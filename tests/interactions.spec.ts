import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";

const DATASET = "/datasets/gakuryoku-chosa-r7-todofuken/";

test.describe("地図の切替", () => {
  test("先に選んだ指標の応答が遅れても、最後に選んだ指標の地図になる", async ({
    page,
  }) => {
    await page.goto("/");
    const select = page.locator("#map-explorer select, select").first();
    await expect(select).toBeVisible();
    const registry = JSON.parse(
      (await page.locator("#indicator-registry").textContent()) ?? "[]"
    ) as { key: string; tab: string; datasetId: string }[];
    const tab = registry[0].tab;
    const [slow, fast] = registry.filter((r) => r.tab === tab).slice(1, 3);

    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/maps/${slow.key}.svg`, async (route) => {
      await gate;
      await route.continue();
    });

    await select.selectOption(slow.key);
    await select.selectOption(fast.key);
    const detail = page.locator("#map-detail-link");
    await expect(detail).toHaveAttribute(
      "href",
      `/datasets/${fast.datasetId}/`
    );
    const shown = await page.locator("#map-stage").innerHTML();

    const late = page.waitForResponse(`**/maps/${slow.key}.svg`);
    release();
    await (await late).finished();
    await page.waitForTimeout(300);

    await expect(select).toHaveValue(fast.key);
    await expect(detail).toHaveAttribute(
      "href",
      `/datasets/${fast.datasetId}/`
    );
    expect(await page.locator("#map-stage").innerHTML()).toBe(shown);
    await expect(page.locator("#map-stage")).not.toHaveAttribute("aria-busy");
    // 2 つの指標の SVG が同じ中身なら、この検査は何も見ていない
    expect(readFileSync(`dist/maps/${slow.key}.svg`, "utf8")).not.toBe(
      readFileSync(`dist/maps/${fast.key}.svg`, "utf8")
    );
  });
});

test.describe("モバイルメニュー", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Tab でメニューの外へ出たら閉じる", async ({ page }) => {
    await page.goto("/about/");
    const toggle = page.locator("#menu-toggle");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.locator("#mobile-menu a").last().focus();
    await page.keyboard.press("Tab");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("メニューの中を移動している間は閉じない", async ({ page }) => {
    await page.goto("/about/");
    const toggle = page.locator("#menu-toggle");
    await toggle.click();
    await page.locator("#mobile-menu a").first().focus();
    await page.keyboard.press("Tab");
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});

test.describe("ページ内リンクの着地", () => {
  test("「本文へスキップ」の着地点がヘッダーに隠れない", async ({ page }) => {
    await page.goto(DATASET);
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(700);
    const { header, first } = await page.evaluate(() => ({
      header: document.querySelector("header")!.getBoundingClientRect().bottom,
      first: document
        .querySelector("main nav, main h1")!
        .getBoundingClientRect().top,
    }));
    expect(first).toBeGreaterThanOrEqual(header);
  });

  test("表へのリンクで、表の見出しがヘッダーに隠れない", async ({ page }) => {
    await page.goto(`${DATASET}#data-table`);
    await page.waitForTimeout(700);
    const { header, caption } = await page.evaluate(() => ({
      header: document.querySelector("header")!.getBoundingClientRect().bottom,
      caption: document
        .querySelector("#data-table caption")!
        .getBoundingClientRect().top,
    }));
    expect(caption).toBeGreaterThanOrEqual(header);
  });
});

test.describe("本文のリンク", () => {
  test("本文・出典のリンクは平常時も下線が付く", async ({ page }) => {
    await page.goto(DATASET);
    const links = page.locator("main p .link-underline");
    expect(await links.count()).toBeGreaterThan(3);
    for (const line of await links.evaluateAll((els) =>
      els.map((el) => getComputedStyle(el).textDecorationLine)
    )) {
      expect(line).toContain("underline");
    }
  });

  test("見出し・パンくず・ナビのリンクには付けない", async ({ page }) => {
    await page.goto("/datasets/");
    for (const selector of [
      "main h2 .link-underline, main h3 .link-underline",
      "header .link-underline",
      "main nav .link-underline",
    ]) {
      for (const line of await page
        .locator(selector)
        .evaluateAll((els) =>
          els.map((el) => getComputedStyle(el).textDecorationLine)
        )) {
        expect(line).toBe("none");
      }
    }
  });

  test("CSV ボタンは白文字と 4.5:1 以上の単色", async ({ page }) => {
    await page.goto(DATASET);
    const style = await page.locator(".btn-ocean").evaluate((el) => {
      const s = getComputedStyle(el);
      return { image: s.backgroundImage, color: s.backgroundColor };
    });
    expect(style.image).toBe("none");
    const [r, g, b] = style.color.match(/\d+/g)!.map((v) => {
      const c = Number(v) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(1.05 / (luminance + 0.05)).toBeGreaterThanOrEqual(4.5);
  });
});

test.describe("出典表記のコピー", () => {
  test("失敗したら失敗と言い、成功したら読み上げにも伝わる", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      let fail = true;
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: () => {
            const result = fail
              ? Promise.reject(new Error("denied"))
              : Promise.resolve();
            fail = false;
            return result;
          },
        },
      });
    });
    await page.goto(DATASET);
    const button = page.locator("#citation-copy");
    const status = page.locator("#citation-copy-status");
    await button.click();
    await expect(status).toContainText("コピーできませんでした");
    await button.click();
    await expect(status).toContainText("コピーしました");
  });
});

test.describe("印刷", () => {
  test("表が途中で切れない", async ({ page }) => {
    await page.emulateMedia({ media: "print" });
    for (const path of [
      DATASET,
      "/datasets/boshi-fushi-setai-okinawa-shichoson/",
      "/datasets/futoko-ijime-todofuken/",
      "/datasets/shingaku-ritsu-keinen/",
    ]) {
      // A4 縦の印字幅(余白 1cm)
      await page.setViewportSize({ width: 718, height: 1000 });
      await page.goto(path);
      const boxes = await page
        .locator('[role="region"]:has(table)')
        .evaluateAll((els) =>
          els.map((el) => [
            el.scrollHeight - el.clientHeight,
            el.scrollWidth - el.clientWidth,
          ])
        );
      expect(boxes.length).toBeGreaterThan(0);
      for (const [y, x] of boxes) {
        expect(y, `${path} 縦`).toBeLessThanOrEqual(1);
        expect(x, `${path} 横`).toBeLessThanOrEqual(1);
      }
      // 収めるために地名や数値を途中で折らない(縦 1 文字ずつになる)
      const wraps = await page
        .locator(".table-scroll tbody th, .table-scroll td.num")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).whiteSpace));
      expect(new Set(wraps)).toEqual(new Set(["nowrap"]));
    }
  });
});
