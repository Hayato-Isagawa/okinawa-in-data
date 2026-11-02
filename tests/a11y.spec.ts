/**
 * 全ページの axe アクセシビリティ検査(violations 0 が完了条件)。
 * ページ一覧はビルド済み dist/ から動的に列挙する(ページ追加漏れ防止)。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

function listPages(dir: string, base = ""): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      return listPages(path.join(dir, entry.name), `${base}/${entry.name}`);
    }
    if (entry.name === "index.html") return [`${base}/`];
    if (entry.name === "404.html") return ["/404.html"];
    return [];
  });
}

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const pages = listPages(path.join(ROOT, "dist"));

test.describe("axe a11y", () => {
  for (const pagePath of pages) {
    test(`axe: ${pagePath}`, async ({ page }) => {
      // 登場アニメーション(.anim-rise は最大 0.45s 遅延 + 0.7s)の途中は opacity が
      // 1 未満で、その瞬間に axe が走ると色コントラスト違反として検出される。
      // prefers-reduced-motion: reduce では animation: none になるため、
      // 静止状態のコントラストを安定して検査できる
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(pagePath);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => n.target.join(" ")),
        }))
      ).toEqual([]);
    });
  }
});
