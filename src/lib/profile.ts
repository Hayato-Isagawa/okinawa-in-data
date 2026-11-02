/**
 * 市町村プロファイルページ用のデータ集約。
 * 各データセットの CSV から市町村ごとの値を引き、県内順位を計算する。
 * 表示する数値はすべてここ経由でデータセットから取得する(手打ち禁止)。
 */
import { getDatasetRows, getDataset } from "./datasets";
import type { DatasetMeta } from "../../data/schema/dataset-meta";

export interface ProfileValue {
  label: string;
  /** 原値(CSV の文字列表記のまま) */
  raw: string;
  /** 3桁区切り等の表示用文字列 */
  display: string;
  unit: string;
  /** 県内順位(値の大きい順、数値列のみ) */
  rank?: number;
  datasetId: string;
  /** 用語集のアンカー(あればラベルを /glossary/#<id> へリンクする) */
  glossary?: string;
}

interface ColumnSpec {
  datasetId: string;
  column: string;
  label?: string;
  /** 用語集のアンカー id */
  glossary?: string;
}

const cache = new Map<
  string,
  { header: string[]; rows: string[][]; meta: DatasetMeta }
>();

function load(datasetId: string) {
  if (!cache.has(datasetId)) {
    const { header, rows } = getDatasetRows(datasetId);
    cache.set(datasetId, { header, rows, meta: getDataset(datasetId) });
  }
  return cache.get(datasetId)!;
}

export function profileValue(areaName: string, spec: ColumnSpec): ProfileValue {
  const { header, rows, meta } = load(spec.datasetId);
  const colIdx = header.indexOf(spec.column);
  const row = rows.find((r) => r[0] === areaName);
  if (colIdx === -1 || !row) {
    throw new Error(
      `profile: ${spec.datasetId} ${areaName}/${spec.column} が見つかりません`
    );
  }
  const raw = row[colIdx];
  const csv = meta.files.find((f) => f.format === "csv")!;
  const col = csv.columns.find((c) => c.name === spec.column)!;
  const numeric = col.type !== "string" && raw !== "";

  let rank: number | undefined;
  if (numeric) {
    const values = rows
      .filter((r) => r[colIdx] !== "")
      .map((r) => Number(r[colIdx]))
      .sort((a, b) => b - a);
    rank = values.indexOf(Number(raw)) + 1;
  }

  return {
    label: spec.label ?? spec.column,
    raw,
    display: numeric ? Number(raw).toLocaleString("ja-JP") : raw,
    unit: col.unit ?? "",
    rank,
    datasetId: spec.datasetId,
    glossary: spec.glossary,
  };
}

/** プロファイルの各セクション定義(データセット×列) */
export const PROFILE_SECTIONS: Array<{
  title: string;
  datasetId: string;
  specs: ColumnSpec[];
}> = [
  {
    title: "人口・世帯",
    datasetId: "jinko-setai-okinawa-shichoson",
    specs: [
      { datasetId: "jinko-setai-okinawa-shichoson", column: "人口" },
      { datasetId: "jinko-setai-okinawa-shichoson", column: "世帯数" },
      {
        datasetId: "jinko-setai-okinawa-shichoson",
        column: "出生者数",
        label: "出生者数(令和6年)",
      },
      {
        datasetId: "jinko-setai-okinawa-shichoson",
        column: "死亡者数",
        label: "死亡者数(令和6年)",
      },
      {
        datasetId: "nenshojinko-okinawa-shichoson",
        column: "年少人口",
        label: "年少人口(0〜14歳)",
        glossary: "nensho-jinko",
      },
      {
        datasetId: "nenshojinko-okinawa-shichoson",
        column: "年少人口割合",
        glossary: "nensho-jinko",
      },
      {
        datasetId: "boshi-fushi-setai-okinawa-shichoson",
        column: "母子世帯数",
        label: "母子世帯数(2020年国勢調査)",
        glossary: "boshi-fushi-setai",
      },
      {
        datasetId: "boshi-fushi-setai-okinawa-shichoson",
        column: "母子世帯割合",
        label: "母子世帯割合(2020年国勢調査)",
        glossary: "boshi-fushi-setai",
      },
    ],
  },
  {
    title: "経済",
    datasetId: "kazei-shotoku-okinawa-shichoson",
    specs: [
      {
        datasetId: "kazei-shotoku-okinawa-shichoson",
        column: "課税対象所得",
        label: "課税対象所得(2024年度)",
        glossary: "kazei-taisho-shotoku",
      },
      {
        datasetId: "kazei-shotoku-okinawa-shichoson",
        column: "納税義務者数",
        glossary: "nozei-gimusha",
      },
      {
        datasetId: "kazei-shotoku-okinawa-shichoson",
        column: "納税義務者1人当たり課税対象所得",
        glossary: "nozei-gimusha",
      },
    ],
  },
  {
    title: "教育",
    datasetId: "gakko-jido-okinawa-shichoson",
    specs: [
      { datasetId: "gakko-jido-okinawa-shichoson", column: "小学校数" },
      { datasetId: "gakko-jido-okinawa-shichoson", column: "小学校児童数" },
      { datasetId: "gakko-jido-okinawa-shichoson", column: "中学校数" },
      { datasetId: "gakko-jido-okinawa-shichoson", column: "中学校生徒数" },
      {
        datasetId: "shugaku-enjo-r5-okinawa-shichoson",
        column: "就学援助率階級",
        label: "就学援助率(令和5年度・階級)",
        glossary: "shugaku-enjo",
      },
    ],
  },
];

/** 代表数値カード(4枚) */
export const PROFILE_CARDS: ColumnSpec[] = [
  { datasetId: "jinko-setai-okinawa-shichoson", column: "人口" },
  { datasetId: "jinko-setai-okinawa-shichoson", column: "世帯数" },
  {
    datasetId: "nenshojinko-okinawa-shichoson",
    column: "年少人口割合",
    glossary: "nensho-jinko",
  },
  {
    datasetId: "kazei-shotoku-okinawa-shichoson",
    column: "納税義務者1人当たり課税対象所得",
    label: "1人当たり課税対象所得(納税者)",
    glossary: "nozei-gimusha",
  },
];

/** 地図ツールチップ用の基礎情報(市町村名 → 「人口 313,424人」) */
export function municipalTooltipBaseInfo(): Map<string, string> {
  const { header, rows } = load("jinko-setai-okinawa-shichoson");
  const popIdx = header.indexOf("人口");
  return new Map(
    rows.map((r) => [
      r[0],
      `人口 ${Number(r[popIdx]).toLocaleString("ja-JP")}人`,
    ])
  );
}
