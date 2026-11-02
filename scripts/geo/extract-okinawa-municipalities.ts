/**
 * 全国市区町村 TopoJSON から沖縄県の市町村境界 GeoJSON を抽出する。
 *
 * 入力: smartnews-smri/japan-topography の
 *   data/municipality/topojson/s0010/N03-21_210101.json(全国・簡素化1%)
 *   ※ s0001(0.1%)は座間味村・粟国村・渡名喜村が簡素化で消えるため使わない
 * 出力: src/data/geo/okinawa-municipalities.geojson(41市町村)
 *
 * 使い方:
 *   curl -sL -o /tmp/N03-21_210101.json \
 *     https://raw.githubusercontent.com/smartnews-smri/japan-topography/main/data/municipality/topojson/s0010/N03-21_210101.json
 *   npx tsx scripts/geo/extract-okinawa-municipalities.ts /tmp/N03-21_210101.json
 */
import fs from "node:fs";
import path from "node:path";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

const inputPath = process.argv[2];
if (!inputPath)
  throw new Error("引数に全国市区町村 TopoJSON のパスを指定してください");

type Props = {
  N03_001: string;
  N03_004: string | null;
  N03_007: string | null;
};

const topo = JSON.parse(fs.readFileSync(inputPath, "utf-8")) as Topology<
  Record<string, GeometryCollection<Props>>
>;
const objectKey = Object.keys(topo.objects)[0];
const fc = topojson.feature(topo, topo.objects[objectKey]);

const features = fc.features.filter(
  (f) =>
    f.properties.N03_001 === "沖縄県" && f.properties.N03_004 !== "所属未定地"
);

if (features.length !== 41) {
  throw new Error(`沖縄県の市町村が ${features.length} 件(期待 41 件)`);
}

const out = {
  type: "FeatureCollection" as const,
  features: features.map((f) => ({
    type: "Feature" as const,
    properties: { name: f.properties.N03_004, code: f.properties.N03_007 },
    geometry: f.geometry,
  })),
};

const outPath = path.resolve(
  process.cwd(),
  "src/data/geo/okinawa-municipalities.geojson"
);
fs.writeFileSync(outPath, JSON.stringify(out) + "\n");
console.log(`✓ ${outPath} (${features.length} features)`);
