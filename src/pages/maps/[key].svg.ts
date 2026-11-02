/**
 * 指標別の地図(SVG を含む HTML 断片)の静的配信エンドポイント。
 * FV の MapExplorer が fetch で遅延取得する(トップページ HTML の肥大防止)。
 */
import type { APIRoute } from "astro";
import { INDICATORS, renderIndicatorSvg } from "../../lib/indicators";

export function getStaticPaths() {
  return INDICATORS.map((indicator) => ({
    params: { key: indicator.key },
    props: { indicator },
  }));
}

export const GET: APIRoute = ({ props }) => {
  const { indicator } = props as {
    indicator: (typeof INDICATORS)[number];
  };
  return new Response(renderIndicatorSvg(indicator), {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
};
