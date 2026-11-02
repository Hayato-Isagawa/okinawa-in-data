import { z } from "zod";

/**
 * データセットメタデータの単一ソーススキーマ。
 * scripts/validate-data.ts(検証)と src/lib/datasets.ts(表示層ローダ)、
 * 将来の読み取り専用 API の3箇所がこれを共有する。
 */

export const THEMES = [
  "education",
  "poverty",
  "population",
  "economy",
  "health",
] as const;

export const THEME_LABELS: Record<(typeof THEMES)[number], string> = {
  education: "教育",
  poverty: "子どもの貧困",
  population: "人口",
  economy: "経済",
  health: "健康・生活",
};

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "小文字英数字とハイフンの slug 形式");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 形式");

const httpsUrl = z.string().regex(/^https:\/\/\S+$/, "https:// で始まる URL");

export const sourceSchema = z.object({
  publisher: z.string().min(1),
  title: z.string().min(1),
  url: httpsUrl,
  retrievedAt: isoDate,
  format: z.enum(["pdf", "xlsx", "xls", "csv", "html"]),
  archiveUrl: httpsUrl.optional(),
  permalinkNote: z.string().optional(),
});

export const columnSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["string", "number", "integer"]),
  unit: z.string().optional(),
  description: z.string().min(1),
});

export const fileSchema = z.object({
  path: z.string().min(1),
  format: z.enum(["csv", "json"]),
  encoding: z.string().default("UTF-8"),
  rowCount: z.number().int().positive(),
  columns: z.array(columnSchema).min(1),
});

export const datasetMetaSchema = z.object({
  id: slug,
  title: z.string().min(1),
  description: z.string().min(1),
  themes: z.array(z.enum(THEMES)).min(1),
  tags: z.array(z.string()).default([]),
  sources: z.array(sourceSchema).min(1),
  license: z.object({
    name: z.string().min(1),
    url: httpsUrl,
    confirmedAt: isoDate,
    note: z.string().optional(),
  }),
  conversion: z.object({
    method: z.string().min(1),
    script: z
      .string()
      .regex(/^scripts\/convert\//, "scripts/convert/ 配下の相対パス"),
    verification: z.string().min(1),
    convertedAt: isoDate,
  }),
  temporal: z.object({
    coverageStart: z.string().min(1),
    coverageEnd: z.string().min(1),
    granularity: z.string().min(1),
    // schema.org/Dataset の temporalCoverage 用 ISO8601 値(年・日付・区間)。
    // 表示用の coverageStart/End は日本語自由文のため、機械可読の妥当値が
    // ある時だけ設定する。未設定なら JSON-LD から temporalCoverage を省く。
    iso8601: z
      .string()
      .regex(
        /^\d{4}(-\d{2}(-\d{2})?)?(\/\d{4}(-\d{2}(-\d{2})?)?)?$/,
        "ISO8601 の年・日付・区間(例: 2011/2022, 2020-10)"
      )
      .optional(),
  }),
  spatial: z.object({
    level: z.string().min(1),
    area: z.string().default("沖縄県"),
  }),
  updateFrequency: z.string().min(1),
  nextExpectedUpdate: z.string().optional(),
  /** 「この数字の読み方」— 非専門の読者向けの短い読み解きガイド */
  readingGuide: z.string().optional(),
  /**
   * false でリード文の自動生成を止める。最初と最後の値を比べると出典元の求めに反する
   * データセット(同じ列に別の指標が混ざる等)で指定する
   */
  lead: z.literal(false).optional(),
  files: z.array(fileSchema).min(1),
  /** 都道府県コロプレス地図の表示設定(spatial.level が都道府県のデータ向け) */
  map: z
    .object({
      /** 塗り分けに使う数値列(files[0].columns に存在すること) */
      column: z.string().min(1),
      /** 列選択の理由など、キャプションに添える注記 */
      note: z.string().optional(),
      /**
       * リード文で列名の代わりに使う表示名。列名が「週全体_総数」「令和4年度」の
       * ように単独では意味の通らないデータセットで指定する
       */
      label: z.string().min(1).optional(),
    })
    .optional(),
  caveats: z.array(z.string()).default([]),
  changelog: z
    .array(z.object({ date: isoDate, description: z.string().min(1) }))
    .min(1),
  relatedDatasets: z.array(slug).default([]),
  status: z.enum(["draft", "published"]),
});

export type DatasetMeta = z.infer<typeof datasetMetaSchema>;
export type DatasetSource = z.infer<typeof sourceSchema>;
export type DatasetColumn = z.infer<typeof columnSchema>;
export type DatasetFile = z.infer<typeof fileSchema>;
export type Theme = (typeof THEMES)[number];
