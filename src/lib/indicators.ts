/**
 * FV 地図エクスプローラーの指標レジストリ。
 * 静的 SVG エンドポイント(src/pages/maps/[key].svg.ts)と
 * MapExplorer コンポーネントの単一ソース。
 */
import { getDataset, getDatasetRows } from "./datasets";
import { areaHrefByName } from "./areas";
import { municipalTooltipBaseInfo } from "./profile";
import { renderPrefectureMapSvg, renderOkinawaMunicipalityMapSvg } from "./map";
import { decimalsOf, renderLineChartSvg } from "./chart";
import { REFERENCE_ROW_NAMES, refLabel } from "./lead";
import { PREFECTURES } from "../../scripts/lib/prefectures";

export interface Indicator {
  /** URL セーフなキー(/maps/<key>.svg) */
  key: string;
  /** プルダウンに出す表示名 */
  label: string;
  tab: "okinawa" | "national";
  datasetId: string;
  column: string;
  /** 読み方の注記(出典由来の階級表記の説明など)。県内タブは凡例の下、全国タブは読み取り行の下に置く */
  legendNote?: string;
  /** 「全国と比べる」の地図の下に添える経年折れ線(経年データセットがある指標のみ) */
  trend?: {
    datasetId: string;
    xColumn: string;
    yColumns: string[];
    /** 系列の断層(区分変更・調査時期変更など)がある場合の読み方の注記 */
    note?: string;
  };
}

export const INDICATORS: Indicator[] = [
  {
    key: "okinawa-shugaku-enjo",
    label: "就学援助率(令和5年度・階級)",
    tab: "okinawa",
    datasetId: "shugaku-enjo-r5-okinawa-shichoson",
    column: "就学援助率階級",
    legendNote:
      "階級は一次資料の回答表記のまま(「0%未満」を含む)。読み方は下の「出典・表・ダウンロード」参照。",
  },
  {
    key: "okinawa-nensho-ratio",
    label: "年少人口割合(令和7年1月)",
    tab: "okinawa",
    datasetId: "nenshojinko-okinawa-shichoson",
    column: "年少人口割合",
  },
  {
    key: "okinawa-shotoku",
    label: "1人当たり課税対象所得(2024年度・納税者)",
    tab: "okinawa",
    datasetId: "kazei-shotoku-okinawa-shichoson",
    column: "納税義務者1人当たり課税対象所得",
  },
  {
    key: "okinawa-boshi-setai",
    label: "母子世帯割合(2020年国勢調査)",
    tab: "okinawa",
    datasetId: "boshi-fushi-setai-okinawa-shichoson",
    column: "母子世帯割合",
  },
  {
    key: "okinawa-kanzen-shitsugyo",
    label: "完全失業率(2020年国勢調査)",
    tab: "okinawa",
    datasetId: "roudoryoku-okinawa-shichoson",
    column: "完全失業率",
    legendNote:
      "人口の小さい町村は対象人数が少なく率が大きく動くため、順位でなく傾向として読んでください。",
  },
  {
    key: "okinawa-hoiku-taiki",
    label: "待機児童率(令和7年4月)",
    tab: "okinawa",
    datasetId: "hoiku-taiki-r7-okinawa-shichoson",
    column: "待機児童率",
    legendNote:
      "申込者数の少ない町村では数人の違いで率が大きく動くため、実数(待機児童数)と合わせて読んでください。渡名喜村は申込者数0のため塗り分け対象外です。",
  },
  {
    key: "okinawa-heikin-jumyo-male",
    label: "平均寿命 男性(令和2年)",
    tab: "okinawa",
    datasetId: "seimeihyo-r2-okinawa-shichoson",
    column: "男性の平均寿命",
    legendNote:
      "人口の小さい町村ほど、その町村だけの実測というより県全体の傾向に引き寄せられた推定値です(ベイズ推定)。塗り分けは41市町村の値の範囲を5等分したもので、全国・沖縄県の参考値は含みません。",
  },
  {
    key: "okinawa-heikin-jumyo-female",
    label: "平均寿命 女性(令和2年)",
    tab: "okinawa",
    datasetId: "seimeihyo-r2-okinawa-shichoson",
    column: "女性の平均寿命",
    legendNote:
      "人口の小さい町村ほど、その町村だけの実測というより県全体の傾向に引き寄せられた推定値です(ベイズ推定)。塗り分けは41市町村の値の範囲を5等分したもので、全国・沖縄県の参考値は含みません。",
  },
  {
    key: "national-shugaku-enjo",
    label: "就学援助率(令和4年度)",
    tab: "national",
    datasetId: "shugaku-enjo-r4-todofuken",
    column: "就学援助率",
    trend: {
      datasetId: "shugaku-enjo-keinen",
      xColumn: "年度",
      yColumns: ["沖縄県", "全国"],
    },
  },
  {
    key: "national-gakute-sho-kokugo",
    label: "学力調査 小学校国語(令和7年度)",
    tab: "national",
    datasetId: "gakuryoku-chosa-r7-todofuken",
    column: "小学校国語",
  },
  {
    key: "national-gakute-sho-sansu",
    label: "学力調査 小学校算数(令和7年度)",
    tab: "national",
    datasetId: "gakuryoku-chosa-r7-todofuken",
    column: "小学校算数",
  },
  {
    key: "national-gakute-sho-rika",
    label: "学力調査 小学校理科(令和7年度)",
    tab: "national",
    datasetId: "gakuryoku-chosa-r7-todofuken",
    column: "小学校理科",
  },
  {
    key: "national-gakute-chu-kokugo",
    label: "学力調査 中学校国語(令和7年度)",
    tab: "national",
    datasetId: "gakuryoku-chosa-r7-todofuken",
    column: "中学校国語",
  },
  {
    key: "national-gakute-chu-sugaku",
    label: "学力調査 中学校数学(令和7年度)",
    tab: "national",
    datasetId: "gakuryoku-chosa-r7-todofuken",
    column: "中学校数学",
  },
  {
    key: "national-shingaku-koko",
    label: "高等学校等進学率(令和7年3月卒)",
    tab: "national",
    datasetId: "shingaku-ritsu-todofuken",
    column: "高等学校等進学率",
    trend: {
      datasetId: "shingaku-ritsu-keinen",
      xColumn: "卒業年",
      yColumns: ["高校等進学率_沖縄", "高校等進学率_全国"],
    },
  },
  {
    key: "national-shingaku-daigaku",
    label: "大学等進学率(令和7年3月卒)",
    tab: "national",
    datasetId: "shingaku-ritsu-todofuken",
    column: "大学等進学率",
    trend: {
      datasetId: "shingaku-ritsu-keinen",
      xColumn: "卒業年",
      yColumns: ["大学等進学率_沖縄", "大学等進学率_全国"],
    },
  },
  {
    key: "national-futoko",
    label: "不登校 小中1,000人当たり(令和6年度)",
    tab: "national",
    datasetId: "futoko-ijime-todofuken",
    column: "1000人当たり不登校児童生徒数(小中計)",
  },
  {
    key: "national-seikatsu-hogo",
    label: "生活保護 保護率(令和6年度)",
    tab: "national",
    datasetId: "seikatsu-hogo-todofuken",
    column: "保護率(人口千対)",
  },
  {
    key: "national-kengai-shushoku",
    label: "高卒の県外就職割合(令和7年3月卒)",
    tab: "national",
    datasetId: "kengai-shushoku-r7-todofuken",
    column: "県外就職割合",
    trend: {
      datasetId: "kengai-shushoku-keinen",
      xColumn: "卒業年",
      yColumns: ["県外就職割合_沖縄", "県外就職割合_全国"],
      note: "令和2年3月卒から「就職者」の統計上の区分が変更されたため、平成31年3月卒以前の値とは単純に比較できません。",
    },
  },
  {
    key: "national-mushiba",
    label: "むし歯 12歳(令和7年度)",
    tab: "national",
    datasetId: "gakko-hoken-r7-todofuken",
    column: "むし歯（う歯）",
    trend: {
      datasetId: "gakko-hoken-keinen",
      xColumn: "年度",
      yColumns: ["むし歯（う歯）_沖縄", "むし歯（う歯）_全国"],
      note: "令和2〜5年度は調査時期が他の年度と異なるため、この4年の値は前後の年度と比較できません。",
    },
  },
  {
    key: "national-suimin",
    label: "平均睡眠時間(令和3年・週全体)",
    tab: "national",
    datasetId: "suimin-jikan-r3-todofuken",
    column: "週全体_総数",
    trend: {
      datasetId: "suimin-jikan-keinen",
      xColumn: "年",
      yColumns: ["平均睡眠時間_沖縄", "平均睡眠時間_全国"],
      note: "令和3年は新型コロナウイルス感染症の緊急事態宣言等の解除直後の調査で、増加分にはその影響が含まれるとみられます。平成23年・28年は災害の影響で一部地域を除いて調査されています。",
    },
  },
  {
    key: "national-shoninkyu-daigaku",
    label: "大卒の初任給(令和7年)",
    tab: "national",
    datasetId: "shoninkyu-r7-todofuken",
    column: "大学",
    legendNote:
      "都道府県×学歴のセルは標本が小さく年による変動が大きいため、単年の順位や差は幅をもって読んでください。",
    trend: {
      datasetId: "shoninkyu-keinen",
      xColumn: "調査年",
      yColumns: [
        "初任給額_大学卒_沖縄",
        "初任給額_大学卒_全国",
        "所定内給与額_大学_沖縄",
        "所定内給与額_大学_全国",
      ],
      note: "令和2年調査から定義・把握方法が変更された(令和元年までは通勤手当を除く確定初任給、令和2年からは通勤手当を含む6月分の所定内給与額)ため、旧系列(平成22〜令和元年)と新系列(令和2年以降)は別の線に分けており、両者は接続できません。沖縄県の値は標本が小さく年による変動が大きいため、単年の増減でなく数年の幅で読んでください。",
    },
  },
  {
    key: "national-shussho-ritsu",
    label: "合計特殊出生率(令和6年)",
    tab: "national",
    datasetId: "jinko-dotai-r6-todofuken",
    column: "合計特殊出生率",
    trend: {
      datasetId: "jinko-dotai-keinen",
      xColumn: "年",
      yColumns: ["合計特殊出生率_沖縄", "合計特殊出生率_全国"],
      note: "合計特殊出生率は分母に用いる女性人口が年により異なります(2014年までの国勢調査年以外は女性の総人口、2016年以降は日本人女性人口、2015年・2020年は各歳別)。折れ線には算出方法の違いが含まれるため、年ごとの算出方法は出典の表の備考列で確認してください。",
    },
  },
  {
    key: "national-saitei-chingin",
    label: "地域別最低賃金(令和8年度)",
    tab: "national",
    datasetId: "saitei-chingin-r8-todofuken",
    column: "最低賃金(時間額)",
    legendNote:
      "統計調査の結果ではなく、最低賃金審議会の調査審議を経て都道府県労働局長が決定する額です。発効日は都道府県ごとに異なり、令和8年10月1日から令和8年12月2日までの間に順次発効します(沖縄県は令和8年12月2日で、それまでは令和7年度の1,023円)。全国加重平均は適用労働者数で重みを付けた平均で、47都道府県の単純平均(1,125円)とは異なります。",
    trend: {
      datasetId: "saitei-chingin-keinen",
      xColumn: "年度",
      yColumns: ["最低賃金_沖縄県", "最低賃金_全国加重平均"],
      note: "平成14年度に最低賃金が時間額のみで定められる方式に移行したため、そこを起点にしています。全国加重平均の対前年度引上げ額のうち、平成28年度と令和5年度には算定に用いる労働者数の更新による影響分(各+1円)が含まれます。令和2年度は新型コロナウイルス感染症の影響で有額の目安が示されず、引上げは1円にとどまりました。",
    },
  },
  {
    key: "national-shonika-ishi",
    label: "小児科医師数 15歳未満人口10万対(令和6年)",
    tab: "national",
    datasetId: "shonika-ishi-r6-todofuken",
    column: "15歳未満人口10万対小児科医師数",
    legendNote:
      "主たる診療科を小児科として届け出た、医療施設(病院・診療所)に従事する医師の数です。同じ統計で沖縄県の産婦人科・産科は15〜49歳女性人口10万対56.9人と全国の50.0人を上回っており、全診療科を合わせた医療施設従事医師も総人口10万対267.2人で全国の267.4人とほぼ同じです。小児科の値だけから医療全体の手薄さを読み取ることはできません。",
  },
  // 1人当たり県民所得は東京都が突出し、等分ビンの塗り分けでは残り46県が
  // 最下位2ビンに潰れて地図単独では差が読めない。データセットページの
  // ランキング(上位10+沖縄)で見せる方が適切なため、エクスプローラーには載せない
];

/** 断片内のテキスト・属性値のエスケープ(値は自リポジトリのデータ由来だが set:html で挿入するため) */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 指標の地図を含む HTML 断片をビルド時に生成する。
 * 全国タブは地図に加えて沖縄県の値・順位の読み取り行と、
 * 経年データセットがある指標では推移の折れ線を含む。 */
export function renderIndicatorSvg(indicator: Indicator): string {
  const meta = getDataset(indicator.datasetId);
  const { header, rows } = getDatasetRows(indicator.datasetId);
  const colIdx = header.indexOf(indicator.column);
  if (colIdx === -1) {
    throw new Error(`${indicator.key}: 列 "${indicator.column}" がありません`);
  }
  const csvFile = meta.files.find((f) => f.format === "csv")!;
  const unit = csvFile.columns.find((c) => c.name === indicator.column)?.unit;
  const label = unit ? `${indicator.column}(${unit})` : indicator.column;

  if (indicator.tab === "okinawa") {
    const column = csvFile.columns.find((c) => c.name === indicator.column)!;
    const hrefByName = areaHrefByName();
    const baseInfoByName = municipalTooltipBaseInfo();
    // 全国・県の基準行を含むデータセットがあるため、塗り分け(と等分ビンの
    // 範囲)は 41 市町村の行だけから作る(データセットページと同じ扱い)
    const municipalRows = rows.filter((row) => hrefByName.has(row[0]));
    if (column.type === "string") {
      const classes = new Map<string, string>();
      for (const row of municipalRows) {
        if (row[colIdx] !== "") classes.set(row[0], row[colIdx]);
      }
      return renderOkinawaMunicipalityMapSvg({
        classes,
        label,
        hrefByName,
        baseInfoByName,
        legendNote: indicator.legendNote,
      });
    }
    const values = new Map<string, number>();
    for (const row of municipalRows) {
      if (row[colIdx] !== "") values.set(row[0], Number(row[colIdx]));
    }
    return renderOkinawaMunicipalityMapSvg({
      values,
      label,
      hrefByName,
      baseInfoByName,
      legendNote: indicator.legendNote,
    });
  }
  // 全国タブ: 地図(リンクなし)は SR に無名の図になるため role="img" を断片側で与える。
  // 市町村地図(上)は内部リンクを活かすため付けない(ChartFigure と同じ使い分け)
  const prefSet = new Set<string>(PREFECTURES);
  const values = new Map<string, number>();
  for (const row of rows) {
    if (prefSet.has(row[0]) && row[colIdx] !== "") {
      values.set(row[0], Number(row[colIdx]));
    }
  }
  const mapHtml = `<div role="img" aria-label="${escapeHtml(label)}の地図">${renderPrefectureMapSvg({ values, label })}</div>`;

  // 沖縄県の値・順位の読み取り行(地図の塗りだけでは沖縄の値が読めないため)
  let summaryHtml = "";
  const okinawaValue = values.get("沖縄県");
  if (okinawaValue !== undefined) {
    // 順位は競技方式(自分より大きい値の数+1)。同値の県がある場合は「タイ」を付す
    // (分単位丸めの指標などで同値が多発するため、ソート位置ベースだと過大になる)
    const rank =
      [...values.values()].filter((v) => v > okinawaValue).length + 1;
    const tied =
      [...values.values()].filter((v) => v === okinawaValue).length > 1;
    // 桁数は公表値の文字列に合わせる(数値のままだと 40.0 が「40」になり表と食い違う)。
    // 列内で桁数が混在するデータがあるため、値ごとにその表記の桁数を使う
    const fmt = (raw: string) => {
      const d = decimalsOf([raw]);
      return `${Number(raw).toLocaleString("ja-JP", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      })}${unit ?? ""}`;
    };
    const refRow = REFERENCE_ROW_NAMES.map((name) =>
      rows.find((r) => r[0] === name && r[colIdx] !== "")
    ).find(Boolean);
    const okinawaRaw = rows.find((r) => r[0] === "沖縄県")![colIdx];
    const summary = `沖縄県は${fmt(okinawaRaw)}(${values.size}都道府県中、値の大きい順で${rank}位${tied ? "タイ" : ""})。${
      refRow ? `${refLabel(refRow[0])}は${fmt(refRow[colIdx])}。` : ""
    }`;
    summaryHtml = `<p class="mt-3 text-sm font-semibold">${escapeHtml(summary)}</p>`;
  }

  // 全国タブの凡例は Plot 側が描くため、読み方の注記は地図・読み取り行の下に置く
  const noteHtml = indicator.legendNote
    ? `<p class="mt-1 text-xs" style="color: var(--color-sub);">${escapeHtml(indicator.legendNote)}</p>`
    : "";

  // 経年データセットがある指標は推移の折れ線を併記(表は出典リンク先で提供)
  let trendHtml = "";
  if (indicator.trend) {
    const trend = indicator.trend;
    const trendMeta = getDataset(trend.datasetId);
    const { header: tHeader, rows: tRows } = getDatasetRows(trend.datasetId);
    const trendCsv = trendMeta.files.find((f) => f.format === "csv")!;
    const trendUnit = trendCsv.columns.find(
      (c) => c.name === trend.yColumns[0]
    )?.unit;
    const lineSvg = renderLineChartSvg({
      header: tHeader,
      rows: tRows,
      xColumn: trend.xColumn,
      yColumns: trend.yColumns,
      yLabel: trendUnit,
    });
    const draftBadge =
      trendMeta.status === "draft"
        ? ' <span class="ml-1 rounded border px-1.5 py-0.5 text-xs" style="border-color: var(--color-line);">検証中</span>'
        : "";
    trendHtml = [
      `<div class="mt-6 border-t pt-4" style="border-color: var(--color-line);">`,
      `<h3 class="text-sm font-bold">経年でみる</h3>`,
      `<div role="img" aria-label="${escapeHtml(trendMeta.title)}のグラフ" class="mt-2">${lineSvg}</div>`,
      trend.note
        ? `<p class="mt-1 text-xs" style="color: var(--color-sub);">${escapeHtml(trend.note)}</p>`
        : "",
      `<p class="mt-1 text-sm" style="color: var(--color-sub);">出典・表: <a href="/datasets/${trend.datasetId}/" class="link-underline" style="color: var(--color-accent);">${escapeHtml(trendMeta.title)}</a>${draftBadge}</p>`,
      `</div>`,
    ].join("");
  }

  return mapHtml + summaryHtml + noteHtml + trendHtml;
}
