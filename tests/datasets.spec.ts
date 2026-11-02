import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

/**
 * データセットページが「サイトの約束」を守っていることを見る。
 *
 * このサイトが提供しているのは数字そのものではなく、**一次出典への恒久リンクと
 * 解説付きの可視化**(README / AGENTS.md「データ層の鉄則」)。つまり出典が
 * 描画されていないページは、単に情報が欠けているのではなく、サイトの前提が
 * 崩れている状態になる。
 *
 * `npm run check:data` は meta.json のスキーマを見るが、**それが実際にページへ
 * 出ているかは見ていない**。ここはその隙間を埋める。
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DATA_DIR = path.join(ROOT, "data/datasets");
// astro.config の `site`。頭を固定しないと /themes/x/datasets/y/ のような将来のページも拾う
// (site を変えたらここが赤になるので、写しが古びても黙って通ることはない)
const SITE = "https://okinawa-in-data.org";
const DATASET_LOC = new RegExp(
  `<loc>${SITE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/datasets/([^/<]+)/</loc>`,
  "g"
);

interface Source {
  publisher: string;
  title: string;
  url: string;
  archiveUrl?: string;
}
interface Meta {
  id: string;
  title: string;
  sources: Source[];
  status: string;
}

// meta.json を持つものだけがサイトに出る。取り下げるデータセットは
// meta.json.hold にリネームして止める。
const entries = fs
  .readdirSync(DATA_DIR, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name);

const withMeta = entries.filter((id) =>
  fs.existsSync(path.join(DATA_DIR, id, "meta.json"))
);

const metas: Meta[] = withMeta.map((id) =>
  JSON.parse(fs.readFileSync(path.join(DATA_DIR, id, "meta.json"), "utf8"))
);

test("データセットを列挙できている", () => {
  // 0 件のまま緑で終わると「検査した」と読めてしまうので、ここで落とす
  expect(metas.length).toBeGreaterThan(20);
});

// 取り下げたものの 404 を 1 件ずつ引くのではなく、ビルド結果に出ているデータセットの集合
// そのものを meta.json を持つ id の集合と比べる。meta.json があるのに欠けたものと、
// データセットでない余計なものはいつでも落ちる。meta.json の無いデータセットが出たら落ちる、が
// ここで検査になるのは取り下げ中のデータセット(meta.json.hold)が実在するときだけなので、
// ローダーの除外そのものは src/lib/__tests__/datasets.test.ts が実データと無関係に見ている
const builtDirs = (sub: string) =>
  fs
    .readdirSync(path.join(ROOT, "dist", sub), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

test.describe("公開範囲", () => {
  test("ページがあるのは meta.json を持つデータセットだけ", () => {
    expect(builtDirs("datasets")).toEqual([...withMeta].sort());
  });

  test("配信ファイルがあるのは meta.json を持つデータセットだけ", () => {
    expect(builtDirs("data")).toEqual([...withMeta].sort());
  });

  test("sitemap に載るのは meta.json を持つデータセットだけ", () => {
    const sitemaps = fs
      .readdirSync(path.join(ROOT, "dist"))
      .filter((f) => /^sitemap-\d+\.xml$/.test(f));
    expect(sitemaps.length, "dist に sitemap が無い").toBeGreaterThan(0);

    const ids = sitemaps
      .flatMap((f) => [
        ...fs
          .readFileSync(path.join(ROOT, "dist", f), "utf8")
          .matchAll(DATASET_LOC),
      ])
      .map((m) => m[1])
      .sort();
    expect(ids).toEqual([...withMeta].sort());
  });

  test("公開されているのは status: published のものだけ", () => {
    const notPublished = metas.filter((m) => m.status !== "published");
    expect(notPublished.map((m) => `${m.id} (${m.status})`)).toEqual([]);
  });
});

test.describe("一次出典が実際にページへ出ている", () => {
  for (const meta of metas) {
    test(`${meta.id} — meta.json の出典 URL がすべてリンクになっている`, async ({
      page,
    }) => {
      await page.goto(`/datasets/${meta.id}/`);

      const hrefs = await page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).map(
          (a) => a.href
        )
      );

      const missing = meta.sources
        .map((s) => s.url)
        .filter((url) => !hrefs.some((h) => h === url || h === `${url}/`));

      expect(missing).toEqual([]);
    });
  }
});

test.describe("図には等価な表が併設されている", () => {
  // AGENTS.md の規約:「チャートには必ず等価なデータテーブルを併設する」。
  // 図だけのページは、読み上げ環境と数値の再利用の両方で使えない。
  for (const meta of metas) {
    test(`${meta.id} — 図があるなら表もある`, async ({ page }) => {
      await page.goto(`/datasets/${meta.id}/`);

      const figures = await page.locator("figure.map-figure").count();
      if (figures === 0) test.skip();

      expect(await page.locator("table").count()).toBeGreaterThan(0);
    });
  }
});
