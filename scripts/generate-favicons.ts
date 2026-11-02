/**
 * サイトロゴ(3島嶼群の結節マーク)から favicon 一式を生成する。
 *
 * 出力:
 * - public/favicon.svg        32×32 相当。海色グラデの角丸地に白のロゴマーク
 * - public/favicon.ico        32×32 PNG(モダンブラウザは PNG 中身の .ico を解釈する)
 * - public/apple-touch-icon.png 180×180。iOS が角丸を付けるため地は正方形・不透明
 *
 * マークの座標は src/components/Logo.astro と同じ(点=宮古/八重山・本島・大東、
 * 実際の位置関係に対応)。小サイズでの視認性のため白単色にし、地に
 * --grad-ocean-deep(#0369a1→#1e3a8a)を敷く。
 *
 * 使い方: npx tsx scripts/generate-favicons.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function markSvg(size: number, rounded: boolean): string {
  const rx = rounded ? 7 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0369a1"/>
      <stop offset="1" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="${rx}" fill="url(#bg)"/>
  <path d="M8 22.5 L15.5 12.5 L24.5 18.5" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <circle cx="8" cy="22.5" r="2.9" fill="#ffffff"/>
  <circle cx="15.5" cy="12.5" r="4.4" fill="#ffffff"/>
  <circle cx="24.5" cy="18.5" r="2.3" fill="#ffffff"/>
</svg>`;
}

const publicDir = path.resolve(process.cwd(), "public");

fs.writeFileSync(path.join(publicDir, "favicon.svg"), markSvg(32, true) + "\n");
console.log("✓ public/favicon.svg");

const browser = await chromium.launch();
const page = await browser.newPage();

async function renderPng(size: number, rounded: boolean, outFile: string) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>*{margin:0;padding:0}</style>${markSvg(size, rounded)}`
  );
  const buf = await page.locator("svg").screenshot({
    omitBackground: rounded,
  });
  fs.writeFileSync(path.join(publicDir, outFile), buf);
  console.log(`✓ public/${outFile}`);
}

await renderPng(32, true, "favicon.ico");
await renderPng(180, false, "apple-touch-icon.png");
await browser.close();
