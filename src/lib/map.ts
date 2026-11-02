/**
 * 都道府県コロプレス(塗り分け)地図のビルド時 SVG 生成。
 * 境界データ: src/data/geo/prefectures.topojson(出典は同ディレクトリ README 参照)。
 *
 * 設計判断:
 * - 離島はデータから削除せず、表示域(bbox)のクリップで南鳥島などの遠隔島を
 *   画面外にする(沖縄の離島を消さないため)。
 * - 色は5段階の等分ビン(quantize)。連続グラデーションより微差の誇張が少なく、
 *   凡例が読みやすい。数値の参照は等価テーブルが担保する。
 */
import fs from "node:fs";
import path from "node:path";
import * as topojson from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import * as Plot from "@observablehq/plot";
import { renderPlotSvg } from "./chart";

type PrefProps = { N03_001: string };

let cachedFeatures: GeoJSON.Feature<GeoJSON.Geometry, PrefProps>[] | null =
  null;

function getPrefectureFeatures() {
  if (cachedFeatures) return cachedFeatures;
  const topo = JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), "src/data/geo/prefectures.topojson"),
      "utf-8"
    )
  ) as Topology<{ prefectures: GeometryCollection<PrefProps> }>;
  cachedFeatures = topojson.feature(topo, topo.objects.prefectures).features;
  return cachedFeatures;
}

/**
 * 本土〜沖縄を収め、南鳥島・沖ノ鳥島(東京都の遠隔島)を画面外にする表示域。
 * d3-geo の球面ポリゴンは巻き方向で内外を判定するため、
 * 「箱の内側」を意味する時計回り(左下→左上→右上→右下)で定義する。
 */
const VIEW_BBOX: GeoJSON.Polygon = {
  type: "Polygon",
  coordinates: [
    [
      [122.5, 24.0],
      [122.5, 45.8],
      [146.5, 45.8],
      [146.5, 24.0],
      [122.5, 24.0],
    ],
  ],
};

type MuniProps = { name: string; code: string };

let cachedMunicipalities: GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  MuniProps
> | null = null;

function getOkinawaMunicipalities() {
  if (cachedMunicipalities) return cachedMunicipalities;
  cachedMunicipalities = JSON.parse(
    fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/data/geo/okinawa-municipalities.geojson"
      ),
      "utf-8"
    )
  ) as GeoJSON.FeatureCollection<GeoJSON.Geometry, MuniProps>;
  return cachedMunicipalities;
}

/**
 * 「20%未満」等の階級ラベルを数値順に並べる。
 * 値がすべて数値の列(平均寿命・待機児童率など)では数値として比較する。
 * 階級ラベル用の先頭整数の取り出しだと、小数以下しか違わない値や負の値が
 * すべて同順に潰れて、最小・最大が入れ替わるため。
 */
export function sortRateClasses(classes: Iterable<string>): string[] {
  const uniq = [...new Set(classes)];
  if (uniq.every((s) => /^-?\d+(\.\d+)?$/.test(s.trim()))) {
    return uniq.sort((a, b) => Number(a) - Number(b));
  }
  return uniq.sort((a, b) => {
    const num = (s: string) => Number(s.match(/^\d+/)?.[0] ?? 0);
    const kind = (s: string) => (s.includes("以上") ? 1 : 0);
    return num(a) - num(b) || kind(a) - kind(b);
  });
}

export function renderPrefectureMapSvg(params: {
  /** 都道府県名 → 値(全国行などは含めない) */
  values: Map<string, number>;
  /** 凡例ラベル(例: "就学援助率(%)") */
  label: string;
  /** 枠線で強調する都道府県 */
  highlight?: string;
}): string {
  const { values, label, highlight = "沖縄県" } = params;
  const features = getPrefectureFeatures();
  const highlightFeature = features.filter(
    (f) => f.properties.N03_001 === highlight
  );
  // ホバー時のネイティブツールチップ(svg <title>、JS 不要・支援技術にも読まれる)
  const unit =
    label.match(/（([^（）]+)）\s*$/)?.[1] ??
    label.match(/\(([^()]+)\)\s*$/)?.[1] ??
    "";
  const tooltip = (name: string) => {
    const v = values.get(name);
    return v === undefined
      ? name
      : `${name}: ${v.toLocaleString("ja-JP")}${unit}`;
  };

  return renderPlotSvg({
    width: 720,
    height: 640,
    projection: { type: "mercator", domain: VIEW_BBOX },
    style: { fontSize: "13px", background: "transparent" },
    color: {
      type: "quantize",
      n: 5,
      scheme: "blues",
      label,
      legend: true,
    },
    marks: [
      Plot.geo(features, {
        fill: (f) => values.get(f.properties.N03_001),
        stroke: "#ffffff",
        strokeWidth: 0.5,
        clip: true,
        title: (f: (typeof features)[number]) => tooltip(f.properties.N03_001),
      }),
      Plot.geo(highlightFeature, {
        stroke: "#b45309",
        strokeWidth: 2,
        fill: "none",
        clip: true,
      }),
    ],
  });
}

/** d3 schemeBlues[9](Plot の "blues" と同系)。fill と凡例で同じ色を共有する */
const BLUES9 = [
  "#f7fbff",
  "#deebf7",
  "#c6dbef",
  "#9ecae1",
  "#6baed6",
  "#4292c6",
  "#2171b5",
  "#08519c",
  "#08306b",
];

function bluesRamp(n: number): string[] {
  if (n <= 1) return [BLUES9[4]];
  return Array.from(
    { length: n },
    (_, i) => BLUES9[Math.round((i * (BLUES9.length - 1)) / (n - 1))]
  );
}

/** HTML 属性値のエスケープ(値はデータ由来のため機械的に無害化する) */
function escapeAttr(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function legendHtml(
  label: string,
  classOrder: string[],
  colors: string[],
  note?: string
): string {
  // classOrder は CSV のセル、label は meta.json の単位、note は指標定義から来る。
  // どれもリポ内のデータだが、出所が変わったときに気づけないので機械的に通す
  const items = classOrder
    .map(
      (c, i) =>
        `<span style="white-space:nowrap;"><span style="display:inline-block; width:0.9em; height:0.9em; background:${escapeAttr(colors[i])}; border:1px solid #dde4e5; margin-right:0.3em; vertical-align:-0.1em;"></span>${escapeAttr(c)}</span>`
    )
    .join("");
  // note は flex-basis:100% で凡例の下の行に折り返す(「0%未満」など出典由来の表記の説明用)
  const noteHtml = note
    ? `<span style="flex-basis:100%; font-weight:400; color:#4a6572;">${escapeAttr(note)}</span>`
    : "";
  return `<div style="display:flex; flex-wrap:wrap; gap:0.4rem 0.9rem; font-size:0.75rem; margin-bottom:0.75rem;"><span style="font-weight:600;">${escapeAttr(label)}:</span>${items}${noteHtml}</div>`;
}

/** 各拡大パネルの実際の位置を県域全体図に示すロケーターミニマップ */
function renderLocatorSvg(
  fc: GeoJSON.FeatureCollection<GeoJSON.Geometry, MuniProps>,
  extents: Array<{ label: string; bbox: [number, number, number, number] }>
): string {
  const clockwise = ([w, s, e, n]: [
    number,
    number,
    number,
    number,
  ]): GeoJSON.Polygon => ({
    type: "Polygon",
    coordinates: [
      [
        [w, s],
        [w, n],
        [e, n],
        [e, s],
        [w, s],
      ],
    ],
  });
  const labels = extents.map((ex) => ({
    lon: (ex.bbox[0] + ex.bbox[2]) / 2,
    lat: ex.bbox[3],
    label: ex.label,
  }));
  return renderPlotSvg({
    width: 340,
    height: 170,
    projection: {
      type: "mercator",
      domain: clockwise([122.0, 23.6, 131.9, 27.6]),
      inset: 4,
    },
    style: { fontSize: "11px", background: "transparent" },
    marks: [
      Plot.geo(fc.features, {
        fill: "#c9dce4",
        stroke: "#ffffff",
        strokeWidth: 0.3,
        clip: true,
      }),
      Plot.geo(
        extents.map((ex) => clockwise(ex.bbox)),
        { stroke: "#0284c7", strokeWidth: 1.2, clip: true }
      ),
      Plot.text(labels, {
        x: "lon",
        y: "lat",
        text: "label",
        dy: -7,
        fill: "#0c4a6e",
        clip: false,
      }),
    ],
  });
}

/** 数値を5等分ビンに割り当て、色関数と凡例ラベルを返す */
function quantizeScale(values: number[], n = 5) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const step = (max - min) / n || 1;
  const colors = bluesRamp(n);
  const isInt = values.every((v) => Number.isInteger(v));
  const fmt = (v: number) =>
    isInt
      ? Math.round(v).toLocaleString("ja-JP")
      : (Math.round(v * 10) / 10).toLocaleString("ja-JP");
  const labels = Array.from(
    { length: n },
    (_, i) => `${fmt(min + step * i)}〜${fmt(min + step * (i + 1))}`
  );
  const colorFor = (v: number) =>
    colors[Math.min(n - 1, Math.floor((v - min) / step))];
  return { colors, labels, colorFor };
}

/**
 * 沖縄県内市町村のコロプレス。離島を省略しないためマルチパネル構成。
 * classes(階級=文字列)または values(数値、5等分ビン)のどちらかを渡す。
 * 構成はトップ・詳細ページ共通: 本島(全幅)→[宮古・八重山+大東+位置関係]。
 * hrefByName を渡すと各市町村ポリゴンがリンクになる。
 */
export function renderOkinawaMunicipalityMapSvg(params: {
  classes?: Map<string, string>;
  values?: Map<string, number>;
  label: string;
  hrefByName?: Map<string, string>;
  /** ツールチップの2行目に出す基礎情報(例: 「人口 313,424人」) */
  baseInfoByName?: Map<string, string>;
  /** 凡例の下に添える注記(出典由来の階級表記の説明など) */
  legendNote?: string;
}): string {
  const { classes, values, label, hrefByName, baseInfoByName, legendNote } =
    params;
  const fc = getOkinawaMunicipalities();

  // ホバー時のツールチップ(svg <title>)。「那覇市: 25%未満\n人口 …」形式
  const tooltipUnit =
    label.match(/（([^（）]+)）\s*$/)?.[1] ??
    label.match(/\(([^()]+)\)\s*$/)?.[1] ??
    "";
  const tooltipFor = (name: string): string => {
    let line = name;
    if (classes) {
      const c = classes.get(name);
      if (c !== undefined) line = `${name}: ${c}`;
    } else {
      const v = values?.get(name);
      if (v !== undefined)
        line = `${name}: ${v.toLocaleString("ja-JP")}${tooltipUnit}`;
    }
    const base = baseInfoByName?.get(name);
    return base ? `${line}\n${base}` : line;
  };

  let legendLabels: string[];
  let legendColors: string[];
  let colorFor: (name: string) => string;
  if (classes) {
    const classOrder = sortRateClasses(classes.values());
    const colors = bluesRamp(classOrder.length);
    legendLabels = classOrder;
    legendColors = colors;
    colorFor = (name) =>
      colors[classOrder.indexOf(classes.get(name) ?? "")] ?? "#e8eef1";
  } else if (values) {
    const scale = quantizeScale([...values.values()]);
    legendLabels = scale.labels;
    legendColors = scale.colors;
    colorFor = (name) =>
      values.has(name) ? scale.colorFor(values.get(name)!) : "#e8eef1";
  } else {
    throw new Error("classes か values のどちらかが必要です");
  }

  const PANELS: Array<{
    title: string;
    names?: string[];
    width: number;
    height: number;
    /** 明示表示域(時計回り bbox)。無指定ならパネル内の地物にフィット */
    domain?: GeoJSON.Polygon;
  }> = [
    {
      // 久米島町には硫黄鳥島(北緯27.9)が含まれ、フィットさせると北に間延び
      // するため表示域を明示する(硫黄鳥島は表示域外。データからは削除しない)
      title: "沖縄本島・周辺離島",
      width: 990,
      height: 700,
      domain: {
        type: "Polygon",
        coordinates: [
          [
            [126.55, 25.95],
            [126.55, 27.15],
            [128.45, 27.15],
            [128.45, 25.95],
            [126.55, 25.95],
          ],
        ],
      },
    },
    {
      // 石垣市には尖閣諸島(北緯25.7超)が含まれ、フィットさせると北に間延びして
      // 海面が支配的になるため表示域を明示する(尖閣諸島は表示域外。データからは
      // 削除しない)。範囲はロケーターの「宮古・八重山」枠と同一に保つ
      title: "宮古・八重山",
      names: ["宮古島市", "多良間村", "石垣市", "竹富町", "与那国町"],
      width: 640,
      height: 290,
      domain: {
        type: "Polygon",
        coordinates: [
          [
            [122.8, 23.95],
            [122.8, 25.1],
            [125.6, 25.1],
            [125.6, 23.95],
            [122.8, 23.95],
          ],
        ],
      },
    },
    {
      // 北大東村には沖大東島(北緯24.5)が含まれ、フィットさせると南北大東島が
      // 潰れるため表示域を明示する(沖大東島は表示域外。データからは削除しない)
      title: "大東諸島",
      names: ["南大東村", "北大東村"],
      width: 260,
      height: 245,
      domain: {
        type: "Polygon",
        coordinates: [
          [
            [131.13, 25.78],
            [131.13, 25.99],
            [131.35, 25.99],
            [131.35, 25.78],
            [131.13, 25.78],
          ],
        ],
      },
    },
  ];
  const assigned = new Set(PANELS.flatMap((p) => p.names ?? []));

  const panels = PANELS.map((panel) => {
    const features = fc.features.filter((f) =>
      panel.names
        ? panel.names.includes(f.properties.name)
        : !assigned.has(f.properties.name)
    );
    const domain: GeoJSON.GeoJSON = panel.domain ?? {
      type: "FeatureCollection",
      features,
    };
    let svg = renderPlotSvg({
      width: panel.width,
      height: panel.height,
      projection: { type: "mercator", domain, inset: 6 },
      style: { fontSize: "13px", background: "transparent" },
      marks: [
        Plot.geo(features, {
          fill: (f: (typeof features)[number]) => colorFor(f.properties.name),
          stroke: "#5f6b6d",
          strokeWidth: 0.5,
          clip: true,
          href: hrefByName
            ? (f: (typeof features)[number]) =>
                hrefByName.get(f.properties.name)
            : undefined,
          title: (f: (typeof features)[number]) =>
            tooltipFor(f.properties.name),
        }),
      ],
    });
    // リンク化した <a> にアクセシブルネームを与える。ツールチップと同じ値を含め、
    // ホバーできないキーボード・スクリーンリーダー利用者も値に到達できるようにする
    if (hrefByName) {
      for (const [name, href] of hrefByName) {
        const accessibleName = `${tooltipFor(name).replace(/\n/g, "、")}。詳細ページへ`;
        svg = svg.replaceAll(
          `<a href="${href}"`,
          `<a href="${href}" aria-label="${escapeAttr(accessibleName)}"`
        );
      }
    }
    // 先島・大東は「別枠拡大」であることを実線の細枠で明示(地図のインセット作法)
    const frame = panel.names
      ? " border:1px solid #9fc3d4; border-radius:0.5rem; padding:0.4rem 0.5rem;"
      : "";
    return `<div style="${frame}"><p style="margin:0 0 0.25rem; font-size:0.8rem; color:#4a6572;">${panel.title}${panel.names ? "(拡大)" : ""}</p>${svg}</div>`;
  });

  // 位置関係のロケーター(各パネルの範囲を県域全体図に示す)
  const locator = renderLocatorSvg(fc, [
    { label: "本島", bbox: [126.55, 25.9, 128.45, 27.15] },
    { label: "宮古・八重山", bbox: [122.8, 23.95, 125.6, 25.1] },
    { label: "大東", bbox: [131.05, 25.7, 131.45, 26.05] },
  ]);
  const locatorPanel = `<div><p style="margin:0 0 0.25rem; font-size:0.8rem; color:#4a6572;">位置関係(枠=各図の範囲)</p>${locator}</div>`;

  const legend = legendHtml(label, legendLabels, legendColors, legendNote);
  // 本島(全幅)→[宮古・八重山+大東+位置関係](横並び・幅不足時は折返し)の2段。
  // トップ・詳細ページ共通
  return (
    legend +
    `<div style="display:flex; flex-direction:column; gap:1.25rem;">` +
    `<div>${panels[0]}</div>` +
    `<div style="display:flex; flex-wrap:wrap; gap:1.25rem; align-items:flex-end;">${panels[1]}${panels[2]}${locatorPanel}</div>` +
    `</div>`
  );
}

/**
 * 市町村プロファイル用: 所属する島嶼群(本島・周辺離島/宮古/八重山/大東)の
 * 表示域で大きく描き、対象市町村を塗りで強調するズーム地図。
 * 石垣市の尖閣諸島・久米島町の硫黄鳥島・北大東村の沖大東島は表示域外に
 * なる(データからは削除しない。トップ地図の各パネルと同じ方針)。
 */
export function renderAreaGroupLocatorSvg(highlightName: string): {
  svg: string;
  groupTitle: string;
} {
  const fc = getOkinawaMunicipalities();
  const target = fc.features.filter((f) => f.properties.name === highlightName);
  if (target.length === 0) throw new Error(`unknown area: ${highlightName}`);

  const rect = ([w, s, e, n]: [
    number,
    number,
    number,
    number,
  ]): GeoJSON.Polygon => ({
    type: "Polygon",
    coordinates: [
      [
        [w, s],
        [w, n],
        [e, n],
        [e, s],
        [w, s],
      ],
    ],
  });

  const GROUPS: Array<{
    title: string;
    names?: string[];
    bbox: [number, number, number, number];
    width: number;
    height: number;
  }> = [
    {
      title: "宮古諸島",
      names: ["宮古島市", "多良間村"],
      bbox: [124.55, 24.55, 125.55, 25.0],
      width: 990,
      height: 490,
    },
    {
      // 石垣市には尖閣諸島(北緯25.9)が含まれ、フィットさせると北に間延び
      // するため表示域を明示する
      title: "八重山諸島",
      names: ["石垣市", "竹富町", "与那国町"],
      bbox: [122.85, 23.98, 124.45, 24.7],
      width: 990,
      height: 490,
    },
    {
      // 2島のみの表示域のため全幅にすると過大。他群より一回り小さく抑える
      title: "大東諸島",
      names: ["南大東村", "北大東村"],
      bbox: [131.13, 25.78, 131.35, 25.99],
      width: 460,
      height: 490,
    },
    {
      // names 無し=上記以外の全市町村(本島と周辺離島)
      title: "沖縄本島・周辺離島",
      bbox: [126.55, 25.95, 128.45, 27.15],
      width: 990,
      height: 700,
    },
  ];
  const group =
    GROUPS.find((g) => g.names?.includes(highlightName)) ??
    GROUPS[GROUPS.length - 1];
  const [w, s, e, n] = group.bbox;

  // 表示域内での対象の描画サイズを見積もり、小さすぎる場合のみリングを重ねる
  const coords = JSON.stringify(target.map((f) => f.geometry))
    .match(/-?\d+\.\d+/g)!
    .map(Number);
  const lons = coords.filter((_, i) => i % 2 === 0);
  const lats = coords.filter((_, i) => i % 2 === 1);
  const pts = lons
    .map((lon, i) => [lon, lats[i]] as const)
    .filter(([lon, lat]) => lon >= w && lon <= e && lat >= s && lat <= n);
  const ptLons = pts.map((p) => p[0]);
  const ptLats = pts.map((p) => p[1]);
  const pxW =
    ((Math.max(...ptLons) - Math.min(...ptLons)) / (e - w)) * group.width;
  const pxH =
    ((Math.max(...ptLats) - Math.min(...ptLats)) / (n - s)) * group.height;
  const needsRing = Math.max(pxW, pxH) < 14;
  const cLon = ptLons.reduce((sum, v) => sum + v, 0) / pts.length;
  const cLat = ptLats.reduce((sum, v) => sum + v, 0) / pts.length;

  const svg = renderPlotSvg({
    width: group.width,
    height: group.height,
    projection: { type: "mercator", domain: rect(group.bbox), inset: 6 },
    style: { fontSize: "11px", background: "#d3e7f0" },
    marks: [
      Plot.geo(fc.features, {
        fill: "#ffffff",
        stroke: "#8fb3c4",
        strokeWidth: 0.75,
        clip: true,
      }),
      Plot.geo(target, {
        fill: "#0284c7",
        stroke: "#0c4a6e",
        strokeWidth: 1.25,
        clip: true,
      }),
      ...(needsRing
        ? [
            Plot.dot([{ lon: cLon, lat: cLat }], {
              x: "lon",
              y: "lat",
              r: 14,
              stroke: "#b45309",
              strokeWidth: 2.5,
              fill: "none",
            }),
          ]
        : []),
    ],
  });
  return { svg, groupTitle: group.title };
}

/** 市町村プロファイル用: 県域全体の中で当該市町村の位置を示す小図 */
export function renderAreaLocatorSvg(highlightName: string): string {
  const fc = getOkinawaMunicipalities();
  const target = fc.features.filter((f) => f.properties.name === highlightName);
  if (target.length === 0) throw new Error(`unknown area: ${highlightName}`);

  // 小離島でも見えるように、対象のおおよその中心にリングを重ねる
  const coords = JSON.stringify(target.map((f) => f.geometry))
    .match(/-?\d+\.\d+/g)!
    .map(Number);
  const lons = coords.filter((_, i) => i % 2 === 0);
  const lats = coords.filter((_, i) => i % 2 === 1);
  // 沖大東島・硫黄鳥島など遠隔属島を除いた表示域内の座標で中心を取る
  const inView = (lon: number, lat: number) =>
    lon >= 122.0 && lon <= 131.9 && lat >= 23.6 && lat <= 27.6;
  const pts = lons
    .map((lon, i) => [lon, lats[i]] as const)
    .filter(([lon, lat]) => inView(lon, lat));
  const cLon = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cLat = pts.reduce((s, p) => s + p[1], 0) / pts.length;

  // 島嶼群ズーム地図の下に全幅で置く県内全域図
  return renderPlotSvg({
    width: 990,
    height: 445,
    projection: {
      type: "mercator",
      domain: {
        type: "Polygon",
        coordinates: [
          [
            [122.0, 23.6],
            [122.0, 27.6],
            [131.9, 27.6],
            [131.9, 23.6],
            [122.0, 23.6],
          ],
        ],
      },
      inset: 6,
    },
    style: { fontSize: "11px", background: "#d3e7f0" },
    marks: [
      Plot.geo(fc.features, {
        fill: "#ffffff",
        stroke: "#7fa8ba",
        strokeWidth: 0.75,
        clip: true,
      }),
      Plot.geo(target, {
        fill: "#0284c7",
        stroke: "#0c4a6e",
        strokeWidth: 1,
        clip: true,
      }),
      Plot.dot([{ lon: cLon, lat: cLat }], {
        x: "lon",
        y: "lat",
        r: 12,
        stroke: "#b45309",
        strokeWidth: 2.5,
        fill: "none",
      }),
    ],
  });
}
