/**
 * JSON-LD を <script type="application/ld+json"> へ安全に埋め込むための直列化。
 * "<" をエスケープし、データ由来の文字列による </script> 早期終了を防ぐ。
 */
export function escapeLd(data: object): string {
  return JSON.stringify(data).replaceAll("<", "\\u003c");
}
