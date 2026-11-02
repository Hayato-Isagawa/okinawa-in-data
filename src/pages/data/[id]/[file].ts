/**
 * データ配布エンドポイント(ビルド時に静的生成)。
 * data/ 層を単一ソースとして CSV / JSON をそのまま配信する。
 */
import type { APIRoute } from "astro";
import {
  getAllDatasets,
  getDistributionFilenames,
  readDistributionFile,
} from "../../../lib/datasets";

const CONTENT_TYPES: Record<string, string> = {
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export function getStaticPaths() {
  return getAllDatasets().flatMap((meta) =>
    getDistributionFilenames(meta).map((file) => ({
      params: { id: meta.id, file },
    }))
  );
}

export const GET: APIRoute = ({ params }) => {
  const { id, file } = params as { id: string; file: string };
  const ext = file.slice(file.lastIndexOf("."));
  const body = readDistributionFile(id, file);
  // CSV は BOM を前置して配信する(Windows の Excel が UTF-8 と認識できず
  // 日本語が文字化けするため)。data/ 層の CSV は逐語照合済みの資産なので変更しない
  return new Response(ext === ".csv" ? "\uFEFF" + body : body, {
    headers: {
      "Content-Type": CONTENT_TYPES[ext] ?? "text/plain; charset=utf-8",
    },
  });
};
