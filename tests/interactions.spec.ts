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

for (const beacon of ["返る", "返らない"] as const) {
  for (const tab of ["県内", "全国"] as const) {
    test(`「戻る」と再読み込みで、選んだ指標と地図に戻る(${tab}、計測の応答が${beacon})`, async ({
      page,
    }) => {
      await page.goto("/");
      const select = page.locator("#indicator-select");
      // ブラウザ任せの復元は、値だけが変わって地図が追いつかない
      await expect(select).toHaveAttribute("autocomplete", "off");
      const detail = page.locator("#map-detail-link");
      const registry = JSON.parse(
        (await page.locator("#indicator-registry").textContent()) ?? "[]"
      ) as { key: string; tab: string; datasetId: string }[];
      const national = registry.find((r) => r.tab !== registry[0].tab)!.tab;
      if (tab === "全国") {
        await page.locator(`[data-tab="${national}"]`).click();
      }
      const picked = registry.filter(
        (r) => r.tab === (tab === "全国" ? national : registry[0].tab)
      )[2];
      expect(picked.datasetId).not.toBe(registry[0].datasetId);
      await select.selectOption(picked.key);
      const href = `/datasets/${picked.datasetId}/`;
      await expect(detail).toHaveAttribute("href", href);
      await detail.click();
      await page.waitForURL(`**${href}`);

      // load は計測の応答を待つ。返らない間も、選択欄と地図がそろうこと
      if (beacon === "返らない") {
        await page.route("https://static.cloudflareinsights.com/**", () => {});
      }
      for (const move of ["goBack", "reload"] as const) {
        await page[move]({ waitUntil: "commit" });
        await expect(select).toHaveValue(picked.key);
        await expect(detail).toHaveAttribute("href", href);
        await page.waitForTimeout(500);
        await expect(select).toHaveValue(picked.key);
        await expect(detail).toHaveAttribute("href", href);
        await expect(
          page.locator(`[data-tab="${picked.tab}"]`)
        ).toHaveAttribute("aria-pressed", "true");
      }
    });
  }
}

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
    await page.goto("/datasets/futoko-ijime-todofuken/");
    const read = () =>
      page.evaluate(() =>
        [
          "body > header",
          ".table-scroll thead th",
          ".table-scroll tbody th",
        ].map((s) => getComputedStyle(document.querySelector(s)!).position)
      );
    expect(await read()).toEqual(["sticky", "sticky", "sticky"]);
    await page.emulateMedia({ media: "print" });
    expect(await read()).toEqual(["static", "static", "static"]);
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

test.describe("強制カラー", () => {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`地図の凡例の色と、選ばれているタブが区別できる(${colorScheme})`, async ({
      page,
    }) => {
      // 地図のカードが現れる動きの途中だと、下のスクリーンショットが別の場所を撮る
      await page.emulateMedia({
        forcedColors: "active",
        colorScheme,
        reducedMotion: "reduce",
      });
      await page.goto("/");
      const swatches = await page
        .locator("#map-stage div > span > span")
        .evaluateAll((els) =>
          els.map((el) => getComputedStyle(el).backgroundColor)
        );
      expect(swatches.length).toBeGreaterThan(2);
      expect(new Set(swatches).size).toBe(swatches.length);
      // 透けている背景は、地の色として比べる
      const tabs = await page.locator("[data-tab]").evaluateAll((els) =>
        els.map((el) => {
          const color = getComputedStyle(el).backgroundColor;
          const probe = document.createElement("span");
          probe.style.backgroundColor = "Canvas";
          document.body.append(probe);
          const canvas = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return color.endsWith(", 0)") ? canvas : color;
        })
      );
      expect(tabs).toHaveLength(2);
      const luminance = (color: string) => {
        const [r, g, b] = color
          .match(/[\d.]+/g)!
          .slice(0, 3)
          .map((v) => {
            const c = Number(v) / 255;
            return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const [high, low] = tabs.map(luminance).sort((a, b) => b - a);
      expect((high + 0.05) / (low + 0.05)).toBeGreaterThanOrEqual(3);

      // 選ばれているタブの文字は読めて(forced-color-adjust: none を外すと、文字の後ろに
      // 地の色の板が敷かれて HighlightText の文字が消える)、フォーカスの輪郭はシステムの色
      const selected = page.locator('[data-tab][aria-pressed="true"]');
      await selected.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      const look = await selected.evaluate((el) => {
        const system = (name: string) => {
          const probe = document.createElement("span");
          probe.style.color = name;
          document.body.append(probe);
          const value = getComputedStyle(probe).color;
          probe.remove();
          return value;
        };
        const range = document.createRange();
        range.selectNodeContents(el);
        const text = range.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return {
          focused: el.matches(":focus-visible"),
          outline: getComputedStyle(el).outlineColor,
          outlineStyle: getComputedStyle(el).outlineStyle,
          outlineWidth: parseFloat(getComputedStyle(el).outlineWidth),
          canvasText: system("CanvasText"),
          highlight: system("Highlight"),
          canvas: system("Canvas"),
          text: {
            x: text.left - box.left,
            y: text.top - box.top,
            width: text.width,
            height: text.height,
          },
        };
      });
      expect(look.focused).toBe(true);
      expect(look.outline).toBe(look.canvasText);
      expect(look.outlineStyle).not.toBe("none");
      expect(look.outlineWidth).toBeGreaterThanOrEqual(2);
      // 文字の矩形の中に、地の色(Highlight)の画素と文字の画素が両方あり、
      // 地の色と最もかけ離れた画素が 4.5:1 以上(文字の色を Highlight にすると 1.5:1 前後)
      const shot = (await selected.screenshot()).toString("base64");
      const share = await page.evaluate(
        async ({ shot, text, highlight, canvasColor }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${shot}`;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = image.width;
          canvas.height = image.height;
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          const at = (x: number, y: number) =>
            context.getImageData(Math.round(x), Math.round(y), 1, 1).data;
          const ground = at(4, image.height / 2);
          // 撮った地の色が、Canvas の上に重ねた Highlight であること(撮る場所の取り違えを防ぐ)
          const [h, c] = [highlight, canvasColor].map((v) =>
            (v.match(/[\d.]+/g) ?? []).map(Number)
          );
          const alpha = h[3] ?? 1;
          const groundGap = [0, 1, 2].reduce(
            (sum, i) =>
              sum + Math.abs(ground[i] - (h[i] * alpha + c[i] * (1 - alpha))),
            0
          );
          const area = context.getImageData(
            Math.round(text.x),
            Math.round(text.y),
            Math.round(text.width),
            Math.round(text.height)
          ).data;
          const luminance = (p: ArrayLike<number>, i: number) =>
            [0.2126, 0.7152, 0.0722].reduce((sum, weight, c) => {
              const v = p[i + c] / 255;
              return (
                sum +
                weight *
                  (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
              );
            }, 0);
          const groundLuminance = luminance(ground, 0);
          let near = 0;
          let contrast = 1;
          for (let i = 0; i < area.length; i += 4) {
            const d = [0, 1, 2].reduce(
              (sum, c) => sum + Math.abs(area[i + c] - ground[c]),
              0
            );
            if (d < 40) near++;
            const [a, b] = [luminance(area, i), groundLuminance].sort(
              (x, y) => y - x
            );
            contrast = Math.max(contrast, (a + 0.05) / (b + 0.05));
          }
          return { groundGap, share: near / (area.length / 4), contrast };
        },
        {
          shot,
          text: look.text,
          highlight: look.highlight,
          canvasColor: look.canvas,
        }
      );
      expect(share.groundGap).toBeLessThan(12);
      expect(share.share).toBeGreaterThan(0.2);
      expect(share.share).toBeLessThan(0.95);
      expect(share.contrast).toBeGreaterThanOrEqual(4.5);
    });
  }

  test("ヘッダーとメニューの現在地が、色以外でも分かる", async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await page.goto("/datasets/");
    for (const nav of ["メインナビゲーション", "モバイルナビゲーション"]) {
      const lines = await page
        .locator(`nav[aria-label="${nav}"] a`)
        .evaluateAll((els) =>
          els.map((el) => [
            el.hasAttribute("aria-current"),
            getComputedStyle(el).textDecorationLine,
          ])
        );
      expect(lines.length).toBeGreaterThan(3);
      for (const [current, line] of lines) {
        expect(line).toBe(current ? "underline" : "none");
      }
    }
  });
});

test("トップの地図の出典リンクにも、平常時の下線が付く", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#map-detail-link")).toHaveCSS(
    "border-bottom-width",
    "1px"
  );
});

test("指標の選択欄は 16px 以上(iOS で拡大されない)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const size = await page
    .locator("#indicator-select")
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
});

test("計測の応答が返らなくても、地図の操作が出る", async ({ page }) => {
  await page.route("https://static.cloudflareinsights.com/**", () => {});
  await page.goto("/", { waitUntil: "commit" });
  await expect(page.locator("[data-explorer-controls]")).toBeVisible({
    timeout: 5000,
  });
});

test("トップの背景は動かない", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const hero = page.locator(".hero-ocean").first();
  await expect(hero).toHaveCSS("animation-name", "none");
  await expect(hero).toHaveCSS("background-size", /^auto/);
});

test.describe("ヘッダーの現在地", () => {
  for (const [path, href, value] of [
    ["/datasets/", "/datasets/", "page"],
    [DATASET, "/datasets/", "true"],
    ["/about/", "/about/", "page"],
    ["/", null, null],
  ] as const) {
    test(`${path} では ${href ?? "どの項目も"} ${value ?? "印を付けない"}`, async ({
      page,
    }) => {
      await page.goto(path);
      for (const nav of ["メインナビゲーション", "モバイルナビゲーション"]) {
        const current = await page
          .locator(`nav[aria-label="${nav}"] [aria-current]`)
          .evaluateAll((els) =>
            els.map((el) => [
              el.getAttribute("href"),
              el.getAttribute("aria-current"),
            ])
          );
        expect(current).toEqual(href === null ? [] : [[href, value]]);
      }
      // 色だけで示さない
      const sizes = await page
        .locator('nav[aria-label="メインナビゲーション"] a')
        .evaluateAll((els) =>
          els.map((el) => [
            el.hasAttribute("aria-current"),
            getComputedStyle(el).backgroundSize,
          ])
        );
      const marks = await page
        .locator('nav[aria-label="モバイルナビゲーション"] a')
        .evaluateAll((els) =>
          els.map((el) => [
            el.hasAttribute("aria-current"),
            getComputedStyle(el).boxShadow !== "none",
          ])
        );
      expect(marks.length).toBeGreaterThan(3);
      for (const [current, mark] of marks) expect(mark).toBe(current);
      expect(sizes.length).toBeGreaterThan(3);
      for (const [current, size] of sizes) {
        expect(size).toMatch(current ? /^100% 2px$/ : /^0(%|px) 1px$/);
      }
    });
  }
});

test("トップは、地図を左右に広げる幅の手前(1024〜1119px)でも横にはみ出さない", async ({
  page,
}) => {
  for (const width of [1024, 1060, 1100, 1119, 1120, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - innerWidth
      ),
      `${width}px`
    ).toBeLessThanOrEqual(0);
  }
});

test.describe("データセットのカード", () => {
  test("カードのどこを押しても詳細へ、テーマの札はテーマへ移る", async ({
    page,
  }) => {
    await page.goto("/datasets/");
    const card = page.locator("article.card-lift").filter({
      has: page.locator('a[href^="/themes/"]'),
    });
    const href = await card.first().locator("h2 a, h3 a").getAttribute("href");
    // 説明文の上。リンクの ::after が覆うので、要素ではなく座標を押す
    const text = card.first().locator("p").first();
    await text.scrollIntoViewIfNeeded();
    const box = (await text.boundingBox())!;
    await page.mouse.click(box.x + 20, box.y + 10);
    await page.waitForURL(`**${href}`);

    await page.goto("/datasets/");
    const tag = card.first().locator('a[href^="/themes/"]').first();
    const theme = await tag.getAttribute("href");
    await tag.click();
    await page.waitForURL(`**${theme}`);
  });

  test("どのカードも、押せる範囲が自分の中に収まる", async ({ page }) => {
    await page.goto("/datasets/");
    const bad = await page.locator("article.card-lift").evaluateAll((cards) =>
      cards
        .filter((card) => {
          card.scrollIntoView({ block: "center", behavior: "instant" });
          const box = card.getBoundingClientRect();
          const link = card.querySelector("h2 a, h3 a");
          return [
            [box.left + 6, box.bottom - 6],
            [box.right - 6, box.bottom - 6],
            [box.right - 6, box.top + 6],
          ].some(([x, y]) => document.elementFromPoint(x, y) !== link);
        })
        .map((card) => card.textContent!.trim().slice(0, 30))
    );
    expect(await page.locator("article.card-lift").count()).toBeGreaterThan(5);
    expect(bad).toEqual([]);
  });

  test("フォーカスの輪郭は、カード全体に付く", async ({ page }) => {
    await page.goto("/datasets/");
    const link = page
      .locator("article.card-lift")
      .first()
      .locator("h2 a, h3 a");
    await link.focus();
    const outline = await link.evaluate((el) => [
      getComputedStyle(el).outlineStyle,
      getComputedStyle(el, "::after").outlineStyle,
      getComputedStyle(el, "::after").outlineWidth,
    ]);
    expect(outline).toEqual(["none", "solid", "2px"]);
    // 輪郭はカードの角丸に沿う
    const radii = await link.evaluate((el) => [
      getComputedStyle(el, "::after").borderRadius,
      getComputedStyle(el.closest("article")!).borderRadius,
    ]);
    expect(radii[0]).not.toBe("0px");
    expect(radii[0]).toBe(radii[1]);
  });
});

test.describe("横に長い表", () => {
  const WIDE = "/datasets/futoko-ijime-todofuken/";
  const scrolled = (page: import("@playwright/test").Page, path: string) =>
    page.goto(path).then(() =>
      page.locator(".table-scroll").evaluate((box) => {
        box.scrollIntoView({ block: "center", behavior: "instant" });
        box.scrollLeft = 120;
        box.scrollTop = 80;
        const edge = box.getBoundingClientRect().left + box.clientLeft;
        const at = (selector: string) =>
          Math.round(
            box.querySelector(selector)!.getBoundingClientRect().left - edge
          );
        const first = box.querySelector("thead th")!.getBoundingClientRect();
        return {
          scrollable: box.scrollLeft,
          row: at("tbody tr:nth-child(5) th"),
          corner: at("thead th"),
          cornerOnTop:
            document.elementFromPoint(
              first.left + 4,
              first.top + first.height / 2
            ) === box.querySelector("thead th"),
          headOverRow: [...box.querySelectorAll("tbody th")].every(
            (th) =>
              Number(getComputedStyle(th).zIndex) <
              Number(
                getComputedStyle(box.querySelector("thead th:nth-child(2)")!)
                  .zIndex
              )
          ),
        };
      })
    );

  test("横にスクロールしても、行見出しと左上の見出しが残る", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await scrolled(page, WIDE);
    expect(state.scrollable).toBe(120);
    expect(state.row).toBe(0);
    expect(state.corner).toBe(0);
    expect(state.cornerOnTop).toBe(true);
    expect(state.headOverRow).toBe(true);
  });

  test("行見出しは下の数値を透かさず、右に罫線を持つ", async ({ page }) => {
    await page.goto(WIDE);
    const rows = await page
      .locator(".table-scroll tbody tr:not([data-row-role]) th")
      .evaluateAll((els) =>
        els.map((el) => {
          const style = getComputedStyle(el);
          return `${style.backgroundColor} ${style.borderRightWidth}`;
        })
      );
    expect(rows.length).toBeGreaterThan(10);
    expect(new Set(rows)).toEqual(new Set(["rgb(255, 255, 255) 1px"]));
    // 固定したセルの罫線は、つなげたままだと置いていかれる
    await expect(page.locator(".table-scroll table")).toHaveCSS(
      "border-collapse",
      "separate"
    );
  });

  test("固定するのは 8 列から", async ({ page }) => {
    for (const [path, wide] of [
      ["/datasets/gakko-hoken-keinen/", 1],
      ["/datasets/seikatsu-shukan-r7-todofuken/", 0],
    ] as const) {
      await page.goto(path);
      const columns = await page.locator(".table-scroll thead th").count();
      expect(columns).toBe(wide ? 8 : 7);
      await expect(page.locator(".table-scroll[data-wide]")).toHaveCount(wide);
    }
  });

  test("印刷では、固定のための見た目を付けない", async ({ page }) => {
    await page.emulateMedia({ media: "print" });
    await page.goto(WIDE);
    const head = page.locator(".table-scroll tbody th").first();
    await expect(head).toHaveCSS("position", "static");
    await expect(head).toHaveCSS("border-right-width", "0px");
    await expect(page.locator(".table-scroll table")).toHaveCSS(
      "border-collapse",
      "collapse"
    );
  });

  test("列の少ない表では固定しない", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto("/datasets/kodomo-chosa-konkyu-keinen/");
    await expect(page.locator(".table-scroll tbody th").first()).toHaveCSS(
      "position",
      "static"
    );
  });

  test("固定しても、沖縄県と全国の行の背景は変わらない", async ({ page }) => {
    let checked = 0;
    for (const path of [
      "/datasets/futoko-ijime-todofuken/",
      "/datasets/katei-zosho-r7-todofuken/",
    ]) {
      await page.goto(path);
      const rows = await page
        .locator(".table-scroll[data-wide] tr[data-row-role]")
        .evaluateAll((trs) =>
          trs.map((tr) => [
            getComputedStyle(tr.querySelector("th")!).backgroundColor,
            getComputedStyle(tr.querySelector("td")!).backgroundColor,
          ])
        );
      checked += rows.length;
      for (const [head, cell] of rows) expect(head).toBe(cell);
    }
    expect(checked).toBeGreaterThan(1);
  });
});

test.describe("図の文字", () => {
  test("390px の画面でも、図の文字は 11px 以上、凡例は 13px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let checked = 0;
    let legends = 0;
    for (const path of [
      "/themes/education-poverty/",
      "/datasets/jido-fuyo-teate-keinen/",
      "/datasets/shugaku-enjo-r4-todofuken/",
    ]) {
      await page.goto(path);
      const charts = await page.locator(".chart-switch").evaluateAll((els) =>
        els.map((el) => {
          const svg = [...el.querySelectorAll("svg")].find(
            (s) => s.viewBox.baseVal.width > 100 && s.clientWidth > 0
          )!;
          const scale = svg.clientWidth / svg.viewBox.baseVal.width;
          const text = svg.querySelector("text")!;
          const legend = [...el.querySelectorAll("[class*='-swatches']")].find(
            (l) => (l as HTMLElement).offsetWidth > 0
          );
          return {
            font: parseFloat(getComputedStyle(text).fontSize) * scale,
            legend: legend
              ? parseFloat(getComputedStyle(legend).fontSize)
              : null,
          };
        })
      );
      for (const { font, legend } of charts) {
        expect(font, path).toBeGreaterThanOrEqual(11);
        if (legend !== null) {
          expect(legend, path).toBeGreaterThanOrEqual(13);
          legends += 1;
        }
      }
      checked += charts.length;
    }
    expect(checked).toBeGreaterThanOrEqual(4);
    // 凡例はテーマページの 2 図と児童扶養手当の図にある。凡例の部品が見つからなく
    // なったとき(Plot のクラス名が変わったときなど)に、検査が空回りして通らないようにする
    expect(legends).toBeGreaterThanOrEqual(3);
  });

  test("狭い画面で開いてから印刷しても、折れ線が描きかけにならない", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/themes/education-poverty/");
    await page.emulateMedia({ media: "print", reducedMotion: "no-preference" });
    // A4 縦の印字幅(余白 1cm)。画面で隠れていた幅 640 の図が現れる
    await page.setViewportSize({ width: 718, height: 1000 });
    const lines = await page
      .locator(".draw-line path")
      .evaluateAll((paths) =>
        paths
          .filter((p) => p.getBoundingClientRect().width > 0)
          .map((p) => getComputedStyle(p).strokeDasharray)
      );
    expect(lines.length).toBeGreaterThan(0);
    for (const dash of lines) expect(dash).toBe("none");
  });
});
