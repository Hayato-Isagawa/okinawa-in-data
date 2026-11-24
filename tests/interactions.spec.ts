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

test("地図の応答が 15 秒返らなければ、失敗と言って元の指標に戻す", async ({
  page,
}) => {
  // AbortSignal.timeout は page.clock では進まないので、渡した時間を記録し、2 回目はすぐ切れるものに替える。
  // 1 回目は通して先頭以外の指標にしておく(先頭だと、選び直しを外しても元に戻って見える)
  await page.addInitScript(() => {
    const asked: number[] = [];
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    Object.assign(window, { asked });
    AbortSignal.timeout = (ms) => {
      asked.push(ms);
      return asked.length === 1
        ? timeout(ms)
        : AbortSignal.abort(new DOMException("timeout", "TimeoutError"));
    };
  });
  await page.goto("/");
  const select = page.locator("#map-explorer select, select").first();
  const [, before, other] = await select
    .locator("option")
    .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
  const stage = page.locator("#map-stage");
  const initial = await stage.innerHTML();
  await select.selectOption(before);
  await expect.poll(() => stage.innerHTML()).not.toBe(initial);
  const shown = await stage.innerHTML();
  await select.selectOption(other);
  await expect(page.locator("#map-error")).toBeVisible();
  await expect(select).toHaveValue(before);
  await expect(stage).not.toHaveAttribute("aria-busy");
  expect(await stage.innerHTML()).toBe(shown);
  expect(
    await page.evaluate(() => (window as unknown as { asked: number[] }).asked)
  ).toEqual([15_000, 15_000]);
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
  for (const path of [
    DATASET,
    "/about/",
    "/glossary/",
    "/themes/education-poverty/",
    "/datasets/kodomo-chosa-konkyu-keinen/",
  ]) {
    test(`本文・出典のリンクは地の文と色が違い、平常時も下線が付く: ${path}`, async ({
      page,
    }) => {
      await page.goto(path);
      const links = await page
        .locator("main p .link-underline")
        .evaluateAll((els) =>
          els.map((el) => ({
            text: el.textContent!.trim().slice(0, 20),
            line: getComputedStyle(el).borderBottomWidth,
            color: getComputedStyle(el).color,
            around: getComputedStyle(el.parentElement!).color,
          }))
        );
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link.line, link.text).toBe("1px");
        expect(link.color, link.text).not.toBe(link.around);
      }
    });
  }

  // 色を直接書いていないリンクは、公開中のページには今のところ出ない(検証中のデータの注記だけ)
  test("色の指定が無い本文リンクもアクセント色になる", async ({ page }) => {
    await page.goto("/about/");
    const { color, accent } = await page.evaluate(() => {
      const p = document.createElement("p");
      p.innerHTML = '<a href="/" class="link-underline">リンク</a><i></i>';
      document.querySelector("main")!.append(p);
      const probe = p.querySelector("i")!;
      probe.style.color = "var(--color-accent)";
      return {
        color: getComputedStyle(p.querySelector("a")!).color,
        accent: getComputedStyle(probe).color,
      };
    });
    expect(color).toBe(accent);
  });

  // ページごとに置いてある部品が違うので、0 件で緑にならないよう 1 つずつ数える
  for (const [path, selector] of [
    ["/datasets/", "main :is(h2, h3) .link-underline"],
    ["/datasets/", "body > header .link-underline"],
    ["/datasets/", "body > footer .link-underline"],
    [DATASET, "main nav .link-underline"],
    ["/glossary/", "main nav .link-underline"],
  ] as const) {
    test(`見出し・パンくず・ナビのリンクには付けない: ${path} ${selector}`, async ({
      page,
    }) => {
      await page.goto(path);
      const lines = await page.locator(selector).evaluateAll((els) =>
        els.map((el) => {
          const c = getComputedStyle(el);
          return `${c.textDecorationLine} ${c.borderBottomWidth}`;
        })
      );
      expect(lines.length).toBeGreaterThan(0);
      expect(new Set(lines)).toEqual(new Set(["none 0px"]));
    });
  }

  for (const selector of [
    "main figcaption .link-underline",
    "main dd .link-underline",
    "main li:not(nav li) > .link-underline",
  ]) {
    test(`図の説明・定義・箇条書きのリンクにも付く: ${selector}`, async ({
      page,
    }) => {
      await page.goto(DATASET);
      const lines = await page.locator(selector).evaluateAll((els) =>
        els.map((el) => {
          const c = getComputedStyle(el);
          return `${c.textDecorationLine} ${c.borderBottomWidth}`;
        })
      );
      expect(lines.length).toBeGreaterThan(0);
      expect(new Set(lines)).toEqual(new Set(["none 1px"]));
    });
  }

  test("引用の中のリンクにも付く", async ({ page }) => {
    await page.goto("/about/");
    const line = await page.evaluate(() => {
      const quote = document.createElement("blockquote");
      quote.innerHTML = '<a href="/" class="link-underline">リンク</a>';
      document.querySelector("main")!.append(quote);
      return getComputedStyle(quote.firstElementChild!).borderBottomWidth;
    });
    expect(line).toBe("1px");
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
    await expect(status).toHaveRole("status");
    await button.click();
    await expect(status).toContainText("コピーできませんでした");
    await button.click();
    await expect(status).toContainText("コピーしました");
  });
});

test.describe("印刷", () => {
  test("ヘッダーと表の見出しを紙の途中に重ねない", async ({ page }) => {
    await page.goto(DATASET);
    const read = () =>
      page.evaluate(() =>
        ["body > header", ".table-scroll thead th"].map(
          (s) => getComputedStyle(document.querySelector(s)!).position
        )
      );
    expect(await read()).toEqual(["sticky", "sticky"]);
    await page.emulateMedia({ media: "print" });
    expect(await read()).toEqual(["static", "static"]);
  });

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

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`ホバーとフォーカスで、下線が消えて左端から線が引かれる(reduced-motion: ${reducedMotion})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await page.goto("/datasets/gakuryoku-chosa-r7-todofuken/");
    const link = page.locator("main p .link-underline").first();
    await link.scrollIntoViewIfNeeded();
    const read = () =>
      link.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          size: s.backgroundSize,
          line: s.borderBottomWidth,
          color: s.borderBottomColor,
          origin: s.backgroundOrigin,
          position: s.backgroundPosition,
          duration: Math.max(
            ...s.transitionDuration.split(",").map(parseFloat)
          ),
          property: s.transitionProperty,
        };
      });
    const rest = await read();
    expect(rest.size).toMatch(/^0%/);
    expect(rest.line).toBe("1px");
    // 左端から引く。border の箱の下端に置くので、平常時の線と位置がそろう
    expect(rest.position).toMatch(/^0(px|%) 100%$/);
    expect(rest.origin).toBe("border-box");
    expect(rest.color).not.toBe("rgba(0, 0, 0, 0)");
    if (reducedMotion === "reduce") expect(rest.duration).toBe(0);
    else {
      expect(rest.duration).toBeGreaterThan(0);
      expect(rest.property).toContain("background-size");
    }

    await link.hover();
    if (reducedMotion === "reduce") expect((await read()).duration).toBe(0);
    await expect.poll(async () => (await read()).size).toBe("100% 2px");
    await expect
      .poll(async () => (await read()).color)
      .toBe("rgba(0, 0, 0, 0)");

    await page.mouse.move(0, 0);
    await expect.poll(async () => (await read()).size).toMatch(/^0%/);
    await page.keyboard.press("Tab");
    await link.focus();
    await expect.poll(async () => (await read()).size).toBe("100% 2px");
    await context.close();
  });
}

/** 下線(半透明を含む)と背景の比。色の形式と半透明は canvas で重ねて読む */
const underlineRatios = (root: Element) => {
  const canvas = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true })!;
  const pixel = (layers: string[]) => {
    canvas.clearRect(0, 0, 1, 1);
    for (const layer of layers) {
      canvas.fillStyle = layer;
      canvas.fillRect(0, 0, 1, 1);
    }
    return [...canvas.getImageData(0, 0, 1, 1).data].slice(0, 3);
  };
  const lum = (rgb: number[]) => {
    const [r, g, b] = rgb.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  return [...root.querySelectorAll("a[href]")]
    .filter(
      (a) =>
        getComputedStyle(a).display.startsWith("inline") &&
        parseFloat(getComputedStyle(a).borderBottomWidth) >= 1 &&
        getComputedStyle(a).backgroundImage.includes("gradient") &&
        !a.closest("nav, h1, h2, h3, h4, header")
    )
    .map((a) => {
      const layers: string[] = [];
      for (let e: Element | null = a; e; e = e.parentElement) {
        layers.unshift(getComputedStyle(e).backgroundColor);
      }
      const line = getComputedStyle(a).borderBottomColor;
      const [hi, lo] = [lum(pixel(layers)), lum(pixel([...layers, line]))].sort(
        (x, y) => y - x
      );
      const [hi2, lo2] = [
        lum(pixel(layers)),
        lum(pixel([...layers, getComputedStyle(a).color])),
      ].sort((x, y) => y - x);
      return {
        text: a.textContent!.trim().slice(0, 20),
        ratio: (hi + 0.05) / (lo + 0.05),
        full: (hi2 + 0.05) / (lo2 + 0.05),
      };
    });
};

for (const theme of ["light"] as const) {
  for (const path of ["/about/", "/glossary/", DATASET]) {
    test(`平常時の下線は文字より薄く、背景と 3:1 以上(${theme}): ${path}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ colorScheme: theme });
      const page = await context.newPage();
      await page.goto(path);
      const lines = await page.locator("main").evaluate(underlineRatios);
      expect(lines.length).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line.ratio, line.text).toBeGreaterThanOrEqual(3);
        expect(line.ratio, line.text).toBeLessThan(line.full);
      }
      await context.close();
    });
  }
}
