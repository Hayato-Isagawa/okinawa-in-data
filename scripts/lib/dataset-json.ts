import fs from "node:fs";
import path from "node:path";
import type { DatasetMeta } from "../../data/schema/dataset-meta";
import { parseCsv } from "./csv";

export const DATASETS_DIR = path.resolve(process.cwd(), "data/datasets");

export type RecordValue = string | number | null;

export interface DatasetJson {
  id: string;
  title: string;
  description: string;
  /** draft=一次資料との逐語照合が未完了(検証中)。published=照合完了 */
  status: DatasetMeta["status"];
  license: { name: string; url: string };
  sources: Array<{
    publisher: string;
    title: string;
    url: string;
    retrievedAt: string;
  }>;
  temporal: DatasetMeta["temporal"];
  columns: DatasetMeta["files"][number]["columns"];
  caveats: string[];
  readingGuide?: string;
  records: Array<Record<string, RecordValue>>;
}

/** data.csv と meta.json から配布用 data.json の内容を決定的に生成する */
export function buildDatasetJson(
  datasetDir: string,
  meta: DatasetMeta
): DatasetJson {
  const csvFile = meta.files.find((f) => f.format === "csv");
  if (!csvFile) {
    throw new Error(`${meta.id}: files に csv エントリがありません`);
  }
  const csvText = fs.readFileSync(path.join(datasetDir, csvFile.path), "utf-8");
  const rows = parseCsv(csvText);
  const [header, ...body] = rows;
  if (!header) {
    throw new Error(`${meta.id}: ${csvFile.path} が空です`);
  }

  const records = body.map((cells) => {
    const record: Record<string, RecordValue> = {};
    csvFile.columns.forEach((col, idx) => {
      const raw = cells[idx] ?? "";
      if (col.type === "string") {
        record[col.name] = raw;
      } else {
        record[col.name] = raw === "" ? null : Number(raw);
      }
    });
    return record;
  });

  return {
    id: meta.id,
    title: meta.title,
    description: meta.description,
    status: meta.status,
    license: { name: meta.license.name, url: meta.license.url },
    sources: meta.sources.map((s) => ({
      publisher: s.publisher,
      title: s.title,
      url: s.url,
      retrievedAt: s.retrievedAt,
    })),
    temporal: meta.temporal,
    columns: csvFile.columns,
    caveats: meta.caveats,
    // 誤読防止の説明(年度・単位・注意事項)がサイト上にしか無いと、ファイルを
    // 持ち帰った後に読み方が分からなくなるため data.json 自体に同梱する
    readingGuide: meta.readingGuide,
    records,
  };
}

export function serializeDatasetJson(json: DatasetJson): string {
  return JSON.stringify(json, null, 2) + "\n";
}

export function listDatasetDirs(): string[] {
  if (!fs.existsSync(DATASETS_DIR)) return [];
  return fs
    .readdirSync(DATASETS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(DATASETS_DIR, e.name))
    .sort();
}
