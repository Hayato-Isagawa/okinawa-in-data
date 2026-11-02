/**
 * data/datasets/ の表示層ローダ。ビルド時(SSG)に fs で読み、Zod で検証する。
 * スキーマ不適合はビルド失敗にする(不正データを静かに公開しない)。
 */
import fs from "node:fs";
import path from "node:path";
import {
  datasetMetaSchema,
  type DatasetMeta,
} from "../../data/schema/dataset-meta";
import { parseCsv } from "../../scripts/lib/csv";

const DATASETS_DIR = path.resolve(process.cwd(), "data/datasets");

let cache: DatasetMeta[] | null = null;

export function getAllDatasets(): DatasetMeta[] {
  if (cache) return cache;
  cache = readDatasets(DATASETS_DIR);
  return cache;
}

/** dir 直下のデータセットを読む。テストが一時ディレクトリを渡せるよう分けてある */
export function readDatasets(dir: string): DatasetMeta[] {
  if (!fs.existsSync(dir)) return [];
  return (
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      // raw/ だけ先に置いた準備中ディレクトリは meta.json ができるまでサイトの対象外
      .filter((e) => fs.existsSync(path.join(dir, e.name, "meta.json")))
      .map((e) =>
        datasetMetaSchema.parse(
          JSON.parse(
            fs.readFileSync(path.join(dir, e.name, "meta.json"), "utf-8")
          )
        )
      )
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

export function getDataset(id: string): DatasetMeta {
  const meta = getAllDatasets().find((d) => d.id === id);
  if (!meta) throw new Error(`dataset not found: ${id}`);
  return meta;
}

/** data.csv をヘッダ行+データ行に分けて返す(テーブル描画・チャート用) */
export function getDatasetRows(id: string): {
  header: string[];
  rows: string[][];
} {
  const meta = getDataset(id);
  const csvFile = meta.files.find((f) => f.format === "csv");
  if (!csvFile) throw new Error(`${id}: csv ファイルがありません`);
  const parsed = parseCsv(
    fs.readFileSync(path.join(DATASETS_DIR, id, csvFile.path), "utf-8")
  );
  const [header, ...rows] = parsed;
  return { header: header ?? [], rows };
}

/** DL エンドポイント用: 配布ファイルの生テキスト */
export function readDistributionFile(id: string, filename: string): string {
  if (!/^[a-z0-9.-]+$/.test(filename) || filename.includes("..")) {
    throw new Error(`invalid filename: ${filename}`);
  }
  return fs.readFileSync(path.join(DATASETS_DIR, id, filename), "utf-8");
}

/** 各データセットが配布するファイル名(CSV + 自動生成 JSON + メタデータ) */
export function getDistributionFilenames(meta: DatasetMeta): string[] {
  const csv = meta.files.filter((f) => f.format === "csv").map((f) => f.path);
  return [...csv, "data.json", "meta.json"];
}

export function formatDatasetUpdatedAt(meta: DatasetMeta): string {
  const last = meta.changelog[meta.changelog.length - 1];
  return last?.date ?? meta.conversion.convertedAt;
}
