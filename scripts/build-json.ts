/**
 * 全データセットの data.json を data.csv + meta.json から再生成する(npm run build:json)。
 * 出力は決定的(タイムスタンプを含めない)。data.json は手編集しない。
 */
import fs from "node:fs";
import path from "node:path";
import { datasetMetaSchema } from "../data/schema/dataset-meta";
import {
  buildDatasetJson,
  serializeDatasetJson,
  listDatasetDirs,
} from "./lib/dataset-json";

for (const dir of listDatasetDirs()) {
  const dirname = path.basename(dir);
  // raw/ だけ先に置いた準備中ディレクトリは meta.json ができるまでスキップ(黙殺せず通知)
  if (!fs.existsSync(path.join(dir, "meta.json"))) {
    console.log(`… ${dirname}: 準備中(meta.json 未作成)のためスキップ`);
    continue;
  }
  const meta = datasetMetaSchema.parse(
    JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf-8"))
  );
  const jsonPath = path.join(dir, "data.json");
  fs.writeFileSync(jsonPath, serializeDatasetJson(buildDatasetJson(dir, meta)));
  console.log(`✓ ${dirname}/data.json`);
}
