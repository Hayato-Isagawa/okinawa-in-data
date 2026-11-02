/**
 * サイト共通 OG 画像(public/og-default.png、1200×630)の生成。
 * ブランド(深海グラデーション+ゴシック)を SVG で組み、sharp(libvips)で
 * PNG 化する。実行: node scripts/generate-og.mjs
 *
 * フォントは実行環境のシステムフォント(Hiragino 系)に依存するため、
 * 生成物の PNG をリポジトリにコミットして配布する(ビルド時生成にしない)。
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const W = 1200;
const H = 630;

const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0369a1"/>
      <stop offset="1" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#22d3ee"/>
      <stop offset="0.45" stop-color="#0284c7"/>
      <stop offset="1" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="10" fill="url(#bar)"/>
  <circle cx="1050" cy="520" r="260" fill="#0ea5e9" opacity="0.12"/>
  <circle cx="1130" cy="180" r="150" fill="#22d3ee" opacity="0.10"/>
  <text x="96" y="232" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif" font-size="30" letter-spacing="10" fill="#7dd3fc">OKINAWA IN DATA</text>
  <text x="90" y="352" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif" font-size="98" font-weight="700" fill="#ffffff">データでみる沖縄</text>
  <text x="94" y="432" font-family="Hiragino Sans, Hiragino Kaku Gothic ProN, sans-serif" font-size="34" fill="#cfe9f7">沖縄の公的データを、一次出典つきで読める形に。</text>
  <text x="96" y="556" font-family="Menlo, monospace" font-size="26" letter-spacing="2" fill="#93c5fd">okinawa-in-data.org</text>
</svg>`;

const out = path.resolve(process.cwd(), "public/og-default.png");
await sharp(Buffer.from(svg)).png().toFile(out);
const size = fs.statSync(out).size;
console.log(`generated ${out} (${(size / 1024).toFixed(1)} KB)`);
