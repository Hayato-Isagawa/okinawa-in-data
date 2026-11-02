/**
 * 別の窓で開くリンクがすべて `rel="noopener noreferrer"` を持つこと(AGENTS.md「セキュリティ」)。
 *
 * ブラウザは使わず、ビルド済みの dist/ を linkedom で DOM にして見る。正規表現で開始タグを
 * 切り出すと、`data-rel` への誤一致・属性値の中の `>`・改行を挟むタグ・`rel` の重複で
 * 黙って通るため。見るのは dist の全 HTML と、MapExplorer が fetch して innerHTML に
 * 入れる `maps/*.svg`(中身は HTML の断片)。
 *
 * 境界: `<template>` の中身・`iframe` の `srcdoc`・ボタンの `formtarget` は見ない(2026-10-08 時点の
 * dist にはどれも無い)。ビルド時に存在しないリンク(Pagefind UI が検索結果として実行時に作るもの、
 * MapExplorer がビルド成果物以外から組むもの)は見ない。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { parseHTML } from "linkedom";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = path.join(ROOT, "dist");

// 0 件で緑にしないための下限。2026-10-08 の実測は 234 件(うち SourceCard 以外が約 53 件)。
// SourceCard が target を出さなくなれば割る値で、データセットの取り下げ程度では割らない
const MIN_TARGETED = 100;

// opener を引き継がずに今の窓・枠で開く値。これ以外(_blank や名前付きの窓)は rel を要求する
const SAME_CONTEXT = new Set(["_self", "_parent", "_top"]);

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    if (entry.name.endsWith(".html")) return [full];
    if (entry.name.endsWith(".svg") && path.basename(dir) === "maps")
      return [full];
    return [];
  });
}

// HTML の属性名は大小を区別しないが、linkedom は `TARGET` を `target` にそろえないので、
// セレクタや getAttribute に任せず名前を小文字にして探す
function attr(el: Element, name: string): string | null {
  for (const a of Array.from(el.attributes)) {
    if (a.name.toLowerCase() === name) return a.value;
  }
  return null;
}

function relTokens(el: Element): Set<string> {
  return new Set(
    (attr(el, "rel") ?? "")
      .toLowerCase()
      .split(/[\t\n\f\r ]+/)
      .filter(Boolean)
  );
}

test("別の窓で開くリンクは rel に noopener と noreferrer を持つ", () => {
  const files = listFiles(DIST);
  const htmlCount = files.filter((f) => f.endsWith(".html")).length;
  const svgCount = files.length - htmlCount;
  expect(htmlCount, "dist に HTML が無い(先に npm run build)").toBeGreaterThan(
    0
  );
  // 地図の断片は今は target 付きの要素を持たないので、件数の下限では守れない。
  // 置き場所が変わって走査から外れたら落とす
  expect(
    svgCount,
    "dist/maps/*.svg が無い(置き場所が変わった?)"
  ).toBeGreaterThan(0);

  const offenders: string[] = [];
  let targeted = 0;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const { document } = parseHTML(
      file.endsWith(".svg")
        ? `<!doctype html><html><body>${text}</body></html>`
        : text
    );
    const where = path.relative(DIST, file);

    for (const el of Array.from(document.querySelectorAll("*"))) {
      const target = attr(el, "target");
      if (target === null) continue;
      if (SAME_CONTEXT.has(target.toLowerCase())) continue;
      if (el.tagName.toLowerCase() === "base") {
        offenders.push(`${where}: ${el.outerHTML}`);
        continue;
      }
      targeted++;
      const tokens = relTokens(el);
      if (!tokens.has("noopener") || !tokens.has("noreferrer")) {
        offenders.push(`${where}: ${el.outerHTML.slice(0, 200)}`);
      }
    }
  }

  expect(offenders).toEqual([]);
  expect(
    targeted,
    `target 付きの要素が ${targeted} 件しかない(走査が壊れていないか)`
  ).toBeGreaterThanOrEqual(MIN_TARGETED);
});
