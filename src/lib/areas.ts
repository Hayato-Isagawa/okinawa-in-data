/**
 * 市町村プロファイルページのレジストリ。
 * slug は手書き(ヘボン式)だが、名称は境界データ(41市町村)との
 * 完全一致をビルド時に assert するため、抜け・重複はビルド失敗で検出される。
 */
import fs from "node:fs";
import path from "node:path";

const SLUGS: Array<[name: string, slug: string]> = [
  ["那覇市", "naha"],
  ["宜野湾市", "ginowan"],
  ["石垣市", "ishigaki"],
  ["浦添市", "urasoe"],
  ["名護市", "nago"],
  ["糸満市", "itoman"],
  ["沖縄市", "okinawa-shi"],
  ["豊見城市", "tomigusuku"],
  ["うるま市", "uruma"],
  ["宮古島市", "miyakojima"],
  ["南城市", "nanjo"],
  ["国頭村", "kunigami"],
  ["大宜味村", "ogimi"],
  ["東村", "higashi"],
  ["今帰仁村", "nakijin"],
  ["本部町", "motobu"],
  ["恩納村", "onna"],
  ["宜野座村", "ginoza"],
  ["金武町", "kin"],
  ["伊江村", "ie"],
  ["読谷村", "yomitan"],
  ["嘉手納町", "kadena"],
  ["北谷町", "chatan"],
  ["北中城村", "kitanakagusuku"],
  ["中城村", "nakagusuku"],
  ["西原町", "nishihara"],
  ["与那原町", "yonabaru"],
  ["南風原町", "haebaru"],
  ["渡嘉敷村", "tokashiki"],
  ["座間味村", "zamami"],
  ["粟国村", "aguni"],
  ["渡名喜村", "tonaki"],
  ["南大東村", "minamidaito"],
  ["北大東村", "kitadaito"],
  ["伊平屋村", "iheya"],
  ["伊是名村", "izena"],
  ["久米島町", "kumejima"],
  ["八重瀬町", "yaese"],
  ["多良間村", "tarama"],
  ["竹富町", "taketomi"],
  ["与那国町", "yonaguni"],
];

export interface Area {
  name: string;
  slug: string;
  code5: string;
  /** 市 / 町 / 村 */
  kind: string;
}

let cache: Area[] | null = null;

export function getAreas(): Area[] {
  if (cache) return cache;
  const geo = JSON.parse(
    fs.readFileSync(
      path.resolve(
        process.cwd(),
        "src/data/geo/okinawa-municipalities.geojson"
      ),
      "utf-8"
    )
  ) as { features: Array<{ properties: { name: string; code: string } }> };
  const codeByName = new Map(
    geo.features.map((f) => [f.properties.name, f.properties.code])
  );

  const slugSet = new Set(SLUGS.map(([, s]) => s));
  if (slugSet.size !== SLUGS.length) throw new Error("slug が重複しています");
  if (SLUGS.length !== codeByName.size) {
    throw new Error(
      `レジストリ ${SLUGS.length} 件 ≠ 境界データ ${codeByName.size} 件`
    );
  }
  cache = SLUGS.map(([name, slug]) => {
    const code5 = codeByName.get(name);
    if (!code5) throw new Error(`境界データに存在しない市町村名: ${name}`);
    return { name, slug, code5, kind: name.slice(-1) };
  });
  return cache;
}

export function getAreaBySlug(slug: string): Area {
  const area = getAreas().find((a) => a.slug === slug);
  if (!area) throw new Error(`unknown area slug: ${slug}`);
  return area;
}

export function areaHrefByName(): Map<string, string> {
  return new Map(getAreas().map((a) => [a.name, `/area/${a.slug}/`]));
}
