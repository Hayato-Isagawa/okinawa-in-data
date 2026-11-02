/**
 * 大東2村(南大東村・北大東村)の境界ジオメトリを高精細化する。
 *
 * 背景: okinawa-municipalities.geojson は japan-topography の s0010(簡素化1%)
 * 由来で、大東の主要2島が22〜27頂点しかなく、市町村ページの拡大表示で輪郭が
 * 粗く見える。上流リポジトリに s0010 より高精細な市区町村版は無いため、
 * 元データの国土数値情報 N03(行政区域データ、未簡素化)から2村のジオメトリを
 * 取り直し、表示に十分な精度まで Douglas-Peucker で簡素化して差し替える。
 *
 * 入力: 国土数値情報 行政区域データ N03-2021 沖縄県 GeoJSON
 *   https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2021/N03-20210101_47_GML.zip
 *   (zip 内 N03-21_47_210101.geojson。既存データと同じ2021年版・同ライセンス)
 * 出力: src/data/geo/okinawa-municipalities.geojson の2村の geometry を置換
 *
 * 生成規則(再現可能性のため明記):
 * - 簡素化許容誤差 0.0002度(市町村ページの表示 460px で約0.4px 相当)
 * - 外周 bbox が 0.002度(約2〜4px)未満のポリゴン(沿岸の岩礁)は表示上
 *   サブピクセルになるため除外する。沖大東島(約0.02度)は残る
 * - リングの巻き方向は既存データ(topojson-client 出力)に合わせる
 *   (d3-geo は球面巻き方向で内外を判定するため逆巻きだと塗りが反転する)
 *
 * 使い方:
 *   curl -sL -o /tmp/N03-20210101_47_GML.zip \
 *     https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2021/N03-20210101_47_GML.zip
 *   (zip 内の N03-21_47_210101.geojson を取り出して渡す)
 *   npx tsx scripts/geo/refine-daito-geometry.ts /tmp/N03-21_47_210101.geojson
 */
import fs from "node:fs";
import path from "node:path";

const TARGETS = ["南大東村", "北大東村"] as const;
const SIMPLIFY_TOLERANCE = 0.0002;
const MIN_RING_EXTENT = 0.002;

const inputPath = process.argv[2];
if (!inputPath)
  throw new Error("引数に N03 沖縄県 GeoJSON のパスを指定してください");

type Ring = [number, number][];
type N03Props = { N03_004: string | null; N03_007: string | null };

// Douglas-Peucker(閉リングは端点を固定して開いた線として処理)
function simplifyRing(ring: Ring, tolerance: number): Ring {
  const closed =
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1];
  const pts = closed ? ring.slice(0, -1) : ring.slice();
  const keep = Array.from({ length: pts.length }, () => false);
  keep[0] = keep[pts.length - 1] = true;
  const stack: Array<[number, number]> = [[0, pts.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let maxIdx = -1;
    const [x1, y1] = pts[start];
    const [x2, y2] = pts[end];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    for (let i = start + 1; i < end; i++) {
      const [px, py] = pts[i];
      const dist =
        len === 0
          ? Math.hypot(px - x1, py - y1)
          : Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / len;
      if (dist > maxDist) {
        maxDist = dist;
        maxIdx = i;
      }
    }
    if (maxDist > tolerance && maxIdx >= 0) {
      keep[maxIdx] = true;
      stack.push([start, maxIdx], [maxIdx, end]);
    }
  }
  const out = pts.filter((_, i) => keep[i]);
  out.push([out[0][0], out[0][1]]);
  return out as Ring;
}

function ringExtent(ring: Ring): number {
  const lons = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return Math.max(
    Math.max(...lons) - Math.min(...lons),
    Math.max(...lats) - Math.min(...lats)
  );
}

// 平面近似の符号付き面積(巻き方向の判定・整合に使う)
function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return sum / 2;
}

function matchWinding(ring: Ring, wantPositive: boolean): Ring {
  const positive = signedArea(ring) > 0;
  return positive === wantPositive ? ring : (ring.slice().reverse() as Ring);
}

function countVertices(coords: unknown): number {
  if (Array.isArray(coords) && typeof coords[0] === "number") return 1;
  return (coords as unknown[]).reduce<number>(
    (sum, c) => sum + countVertices(c),
    0
  );
}

const input = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as {
  features: Array<{
    properties: N03Props;
    geometry: { type: string; coordinates: Ring[] };
  }>;
};

const outPath = path.resolve(
  process.cwd(),
  "src/data/geo/okinawa-municipalities.geojson"
);
const current = JSON.parse(fs.readFileSync(outPath, "utf-8")) as {
  features: Array<{
    properties: { name: string; code: string };
    geometry: { type: string; coordinates: unknown };
  }>;
};

// 既存データの外周リングの巻き方向を基準にする
const reference = current.features.find(
  (f) => f.properties.name === "南大東村"
);
if (!reference) throw new Error("既存データに南大東村がありません");
const refRing = (
  reference.geometry.type === "Polygon"
    ? (reference.geometry.coordinates as Ring[])[0]
    : (reference.geometry.coordinates as Ring[][])[0][0]
) as Ring;
const exteriorPositive = signedArea(refRing) > 0;

for (const name of TARGETS) {
  const sources = input.features.filter((f) => f.properties.N03_004 === name);
  if (sources.length === 0) throw new Error(`${name} が入力にありません`);
  for (const f of sources) {
    if (f.geometry.type !== "Polygon") {
      throw new Error(`${name} に想定外のジオメトリ型: ${f.geometry.type}`);
    }
  }

  const polygons: Ring[][] = [];
  for (const f of sources) {
    const [exterior, ...holes] = f.geometry.coordinates;
    const simplified = simplifyRing(exterior, SIMPLIFY_TOLERANCE);
    if (ringExtent(simplified) < MIN_RING_EXTENT) continue;
    const rings = [matchWinding(simplified, exteriorPositive)];
    for (const hole of holes) {
      const simplifiedHole = simplifyRing(hole, SIMPLIFY_TOLERANCE);
      if (ringExtent(simplifiedHole) < MIN_RING_EXTENT) continue;
      rings.push(matchWinding(simplifiedHole, !exteriorPositive));
    }
    polygons.push(rings);
  }
  if (polygons.length === 0)
    throw new Error(`${name} のポリゴンが全て除外されました`);

  const target = current.features.find((f) => f.properties.name === name);
  if (!target) throw new Error(`既存データに ${name} がありません`);
  const before = countVertices(target.geometry.coordinates);
  target.geometry =
    polygons.length === 1
      ? { type: "Polygon", coordinates: polygons[0] }
      : { type: "MultiPolygon", coordinates: polygons };
  const after = countVertices(target.geometry.coordinates);
  console.log(
    `${name}: ${sources.length}ポリゴン→${polygons.length}ポリゴン(岩礁除外)、頂点 ${before}→${after}`
  );
}

if (current.features.length !== 41) {
  throw new Error(`市町村が ${current.features.length} 件(期待 41 件)`);
}
fs.writeFileSync(outPath, JSON.stringify(current) + "\n");
console.log(`✓ ${outPath} を更新`);
