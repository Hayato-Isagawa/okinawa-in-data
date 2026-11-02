import type { APIRoute } from "astro";
// ?raw で CSS をそのまま文字列として取り込む。fs で読むとビルド後の
// バンドル位置を指してしまい、ソースの global.css に届かない。
import css from "../styles/global.css?raw";

/**
 * デザイントークンを機械可読な形で公開する。
 *
 * 値は `src/styles/global.css` から抽出する。ここに数値を書き写すと実装と
 * ずれるため、CSS を唯一の真実として毎ビルド読み直す。
 *
 * ポートフォリオ(hayato-isagawa.work)のデザインハブが、この出力を集めて
 * 横断比較する。別オリジンからは getComputedStyle で測れないため、
 * 各サイトが自分で公開する形にしている。
 *
 * 姉妹サイト(edu-evidence / edu-watch / edu-law)との違い:
 *   - トークンは `@theme` ではなく `:root` にある
 *   - ダークモードを持たない。すべて light のみ
 *   - 色以外にグラデーションと影のトークンがある
 */

/** `--name: value;` を拾う。value 内の `;` は使っていない前提。 */
function parseDeclarations(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim().replace(/\s+/g, " ");
  }
  return out;
}

/**
 * コメントを取り除く。日本語コメント中にセレクタと同じ文字列があると、
 * ブロック抽出の正規表現が別の範囲を拾う事故が起きる(姉妹サイトで実際に発生)。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** 対応する `}` までを取り出す(ネストは想定しない)。 */
function extractBlock(source: string, opener: RegExp): string[] {
  const blocks: string[] = [];
  for (const m of source.matchAll(opener)) {
    const start = source.indexOf("{", m.index ?? 0);
    if (start < 0) continue;
    const end = source.indexOf("}", start);
    if (end < 0) continue;
    blocks.push(source.slice(start + 1, end));
  }
  return blocks;
}

function categorise(name: string): string {
  if (name.startsWith("--color-")) return "color";
  if (name.startsWith("--grad-")) return "gradient";
  if (name.startsWith("--shadow-")) return "shadow";
  return "other";
}

export const GET: APIRoute = () => {
  const source = stripComments(css);

  const light: Record<string, string> = {};
  for (const block of extractBlock(source, /(^|\})\s*:root\s*\{/g)) {
    Object.assign(light, parseDeclarations(block));
  }

  const tokens: Record<
    string,
    Record<string, { light: string; dark?: string }>
  > = {};
  for (const [name, value] of Object.entries(light)) {
    const cat = categorise(name);
    tokens[cat] ??= {};
    tokens[cat][name] = { light: value };
  }

  const body = {
    $schema: "https://hayato-isagawa.work/schemas/design-tokens-v1.json",
    site: {
      id: "okinawa-in-data",
      name: "データでみる沖縄",
      url: "https://okinawa-in-data.org",
      // edu ファミリーの木の部位体系(根・葉・双葉)には属さない別ブランド。
      brandRole: "独立ブランド(沖縄の海)",
      themeAttribute: "なし(ライトのみ)",
    },
    source: "src/styles/global.css",
    generatedAt: new Date().toISOString(),
    tokens,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
