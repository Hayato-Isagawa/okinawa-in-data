/**
 * Observable Plot によるビルド時 SVG 生成(ADR 0001)。
 * linkedom の document を渡してサーバーサイドで描画し、静的 SVG 文字列を返す。
 * クライアントには JS を送らない。
 */
import * as Plot from "@observablehq/plot";
import { parseHTML } from "linkedom";

type PlotOptions = Parameters<typeof Plot.plot>[0];

export function renderPlotSvg(options: PlotOptions): string {
  const { document } = parseHTML("<!doctype html><html><body></body></html>");
  const element = Plot.plot({ ...options, document });
  // Plot.plot は svg 単体または figure(svg+凡例)を返す。
  // Plot は <g aria-label="bar"> のように role のない要素へ aria-label を
  // 付与するが、これは ARIA 仕様違反(axe: aria-prohibited-attr)。
  // チャートは ChartFigure 側で role="img"+等価テーブルとして提供するため、
  // <g> と svg ルートの aria-label は除去する(リンク <a> 等には触れない)。
  for (const g of element.querySelectorAll("g[aria-label], svg[aria-label]")) {
    g.removeAttribute("aria-label");
  }
  if (element.hasAttribute("aria-label")) {
    element.removeAttribute("aria-label");
  }
  return element.outerHTML;
}

/** 折れ線の y 軸の目盛り数の目安(プロット高さ 300px 前後に対する値) */
const Y_TICKS = 8;

/**
 * 汎用の折れ線チャート: x 列(年度など)に対して複数の数値系列を描く。
 * rows は CSV の生文字列行。空欄(欠損)は点を打たない。
 */
export function renderLineChartSvg(params: {
  header: string[];
  rows: string[][];
  xColumn: string;
  yColumns: string[];
  yLabel?: string;
  width?: number;
}): string {
  const { header, rows, xColumn, yColumns, yLabel, width } = params;
  const xIdx = header.indexOf(xColumn);
  if (xIdx === -1) throw new Error(`x 列が見つかりません: ${xColumn}`);

  const points: Array<{ x: string; series: string; y: number }> = [];
  for (const row of rows) {
    for (const yCol of yColumns) {
      const yIdx = header.indexOf(yCol);
      if (yIdx === -1) throw new Error(`y 列が見つかりません: ${yCol}`);
      const raw = row[yIdx];
      if (raw === "" || raw === undefined) continue;
      points.push({ x: row[xIdx], series: yCol, y: Number(raw) });
    }
  }

  // 和暦ラベルは 1 つ 5〜7 文字あり、10 個を超えると横書きでは隣と重なる。
  // 重なる図だけ縦書きにし、その分の下余白と軸ラベル位置を確保する
  // (5 ラベル程度の図は横書きで読めるため従来のまま)
  const xDomain = [...new Set(rows.map((r) => r[xIdx]))];
  const rotateTicks = xDomain.length >= 10;
  const tickSpace = rotateTicks
    ? Math.max(...xDomain.map((v) => v.length)) * 13 + 16
    : 0;
  // 横書きのままの図でも、Plot 既定の labelOffset(27)では軸ラベル(「調査年」など)が
  // 中央の目盛りラベルと重なる。どちらの図も軸ラベルを目盛りの下へ逃がす
  const labelOffset = rotateTicks ? tickSpace + 20 : 40;
  const marginBottom = rotateTicks ? tickSpace + 40 : 44;

  return renderPlotSvg({
    width: width ?? 640,
    // 余白でプロット領域が潰れないよう、図全体を余白の増分(上 10 + 下)だけ縦に伸ばす
    height: 370 + (rotateTicks ? tickSpace : 14),
    marginLeft: 56,
    // y 軸の単位ラベル(「↑ 人」など)は Plot 既定の marginTop 20 では最上位の目盛りと重なる
    marginTop: 30,
    marginBottom,
    style: { fontSize: "13px", background: "transparent" },
    // band 軸の既定は辞書順ソート。和暦ラベル(平成/令和混在)が崩れるため行順を明示する
    x: { label: xColumn, type: "band", domain: xDomain },
    // 既定の domain はデータの min/max そのもので、目盛りはその内側にしか立たない
    // (=最上位・最下位の目盛りの外側に線が描かれる)。nice で目盛り値まで domain を広げる。
    // nice と目盛り描画で tick 数が違うと domain 上端と最上位目盛りがずれて同じ問題が残るため、
    // 両方に同じ数を渡して上端・下端の目盛りを domain の端に一致させる
    y: { label: yLabel ?? "", grid: true, nice: Y_TICKS, ticks: Y_TICKS },
    color: yColumns.length > 1 ? { legend: true } : undefined,
    marks: [
      // labelOffset は scale 側では軸に伝わらないため、軸 mark を明示する
      Plot.axisX({ labelOffset, ...(rotateTicks ? { tickRotate: -90 } : {}) }),
      Plot.line(points, {
        x: "x",
        y: "y",
        stroke: yColumns.length > 1 ? "series" : "#0e7490",
        strokeWidth: 2,
        className: "draw-line",
      }),
      Plot.dot(points, {
        x: "x",
        y: "y",
        fill: yColumns.length > 1 ? "series" : "#0e7490",
        r: 3,
      }),
    ],
  });
}

/** 競技方式の順位: 自分より大きい値の数 + 1(同値は同順位) */
export function competitionRank(
  entries: Array<{ value: number }>,
  value: number
): number {
  return entries.filter((e) => e.value > value).length + 1;
}

/**
 * 与えた値の文字列に現れる小数桁数(複数あれば最大)。
 * 数値に変換すると 40.0 が 40 になり、公表値をそのまま出す表と食い違うため、
 * 原データの文字列から桁数を取り直すのに使う。列内で桁数が混在するデータが
 * あるので(むし歯は都道府県が小数1桁・全国だけ2桁)、原則1値ずつ渡す。
 */
export function decimalsOf(values: string[]): number {
  let max = 0;
  for (const v of values) {
    const m = /\.(\d+)\s*$/.exec(v);
    if (m) max = Math.max(max, m[1].length);
  }
  return max;
}

/** 同じ値の要素が複数あるか(順位に「タイ」を付すかの判定) */
export function isTied(
  entries: Array<{ value: number }>,
  value: number
): boolean {
  return entries.filter((e) => e.value === value).length > 1;
}

/**
 * 横棒ランキング(値の降順)。highlight の行を強調し、referenceValue が
 * あれば基準線(全国値など)を引く。ビルド時 SVG 生成。
 */
export function renderBarRankingSvg(params: {
  /** display は公表値の文字列(表と同じ桁数で値ラベルを出すため。省略時は数値表現) */
  entries: Array<{ name: string; value: number; display?: string }>;
  highlight: string;
  valueLabel: string;
  reference?: { label: string; value: number };
  /** 上位 N + highlight のみ表示(省略はキャプションで明示すること) */
  topN?: number;
}): string {
  const { entries, highlight, valueLabel, reference, topN } = params;
  // 順位は競技方式(自分より大きい値の数+1)。同値は同じ順位になる
  // (FV の読み取り行と同じ数え方。ソート位置だと同値でも別順位に見えてしまう)
  const ranked = [...entries]
    .sort((a, b) => b.value - a.value)
    .map((e) => ({
      ...e,
      label: `${competitionRank(entries, e.value)}位 ${e.name}`,
    }));
  let sorted = ranked;
  if (topN && ranked.length > topN) {
    sorted = ranked.slice(0, topN);
    const hl = ranked.find((e) => e.name === highlight);
    if (hl && !sorted.includes(hl)) sorted = [...sorted, hl];
  }
  // 軸ラベル用の下余白 14px を加算(labelOffset 40 とプロット領域維持のセット。折れ線と同じ幾何)
  const height = sorted.length * (topN ? 24 : 17) + 60 + 14;

  return renderPlotSvg({
    width: 680,
    height,
    marginLeft: topN ? 118 : 84,
    marginRight: 44,
    marginBottom: 44,
    style: { fontSize: "11.5px", background: "transparent" },
    x: { label: valueLabel, grid: true },
    y: { label: null, domain: sorted.map((d) => d.label) },
    marks: [
      // Plot 既定の labelOffset(27)では長い軸ラベル(列名)が最終目盛りと重なる。
      // 目盛りの下の行へ逃がす(renderLineChartSvg の横書き分岐と同じ値)
      Plot.axisX({ labelOffset: 40 }),
      Plot.barX(sorted, {
        y: "label",
        x: "value",
        fill: (d: { name: string }) =>
          d.name === highlight ? "#0284c7" : "#c9dce4",
      }),
      Plot.text(sorted, {
        y: "label",
        x: "value",
        text: (d: { value: number; display?: string }) =>
          d.display ?? String(d.value),
        textAnchor: "start",
        dx: 4,
        fill: "#4a6572",
      }),
      ...(reference
        ? [
            Plot.ruleX([reference.value], {
              stroke: "#b45309",
              strokeDasharray: "4,3",
              strokeWidth: 1.5,
            }),
          ]
        : []),
      Plot.ruleX([0]),
    ],
  });
}
