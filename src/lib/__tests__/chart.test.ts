/**
 * chart.ts の系列の見分け方のテスト。
 *
 * 折れ線の系列は色と点の形の両方で見分ける(色だけに頼らない)。沖縄と全国の系列が
 * 1 本ずつの図では、その 2 本をどの図でも同じ色にする。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHTML } from "linkedom";
import {
  NATIONAL_COLOR,
  OKINAWA_COLOR,
  SERIES_COLORS,
  renderLineChartSvg,
  seriesStyles,
} from "../chart";

test("沖縄と全国は列の順によらず決まった色になる", () => {
  const a = seriesStyles(["平均睡眠時間_沖縄", "平均睡眠時間_全国"]);
  const b = seriesStyles(["全国", "沖縄県"]);
  assert.equal(a.colors[0], b.colors[1]);
  assert.equal(a.colors[1], b.colors[0]);
  assert.notEqual(a.colors[0], a.colors[1]);
  const c = seriesStyles(["その他", "全国", "沖縄県"]);
  assert.deepEqual(c.colors, [SERIES_COLORS[2], NATIONAL_COLOR, OKINAWA_COLOR]);
});

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

test("系列の色はどれも白(カードの背景)とも黒(強制カラーの暗い配色の背景)とも 3:1 以上", () => {
  // 強制カラーでもカードの背景は変わるが、SVG の線と点の色はそのまま残る
  for (const color of SERIES_COLORS) {
    const onWhite = (1 + 0.05) / (luminance(color) + 0.05);
    const onBlack = (luminance(color) + 0.05) / 0.05;
    assert.ok(onWhite >= 3, `${color} の白との比は ${onWhite.toFixed(2)}:1`);
    assert.ok(onBlack >= 3, `${color} の黒との比は ${onBlack.toFixed(2)}:1`);
  }
});

/** 凡例の見本を [系列名, 色, 形] で返す */
function legendOf(yColumns: string[]): Array<[string, string, string]> {
  const svg = renderLineChartSvg({
    header: ["年", ...yColumns],
    rows: [
      ["2020", ...yColumns.map(() => "1")],
      ["2021", ...yColumns.map(() => "2")],
    ],
    xColumn: "年",
    yColumns,
  });
  const { document } = parseHTML(`<body>${svg}</body>`);
  return [...document.querySelectorAll("[class$='-swatch']")].map((s) => [
    s.textContent ?? "",
    s.querySelector("svg")?.getAttribute("fill") ?? "",
    s.querySelector("path")?.getAttribute("d") ?? "",
  ]);
}

test("複数系列の折れ線は、凡例に色と形の両方を出し、沖縄の形は図によらない", () => {
  const legend = legendOf(["値_沖縄", "値_全国"]);
  assert.deepEqual(
    legend.map(([name, fill]) => [name, fill]),
    [
      ["値_沖縄", OKINAWA_COLOR],
      ["値_全国", NATIONAL_COLOR],
    ]
  );
  assert.notEqual(legend[0][2], legend[1][2]);
  const reversed = legendOf(["値_全国", "値_沖縄"]);
  assert.equal(reversed[1][2], legend[0][2]);
});
