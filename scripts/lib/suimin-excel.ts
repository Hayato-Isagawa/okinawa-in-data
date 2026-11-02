/**
 * 社会生活基本調査(総務省統計局)Excel の共通ヘルパー。
 * 県名は年により空白詰め(2016「沖 縄 県」・2001「沖　縄　県」等)のため
 * 空白除去で正規化して同定する。1996・2001 の統計表は「時.分」表記
 * (7.45=7時間45分の60進)で、Excel 浮動小数の桁落ち(7.4=7時間40分)が
 * あるため、小数第2位で丸めた文字列を経由して分に変換する。
 */

export function normalizeName(v: unknown): string {
  return String(v ?? "").replace(/[\s　]+/g, "");
}

/** 「時.分」表記(60進)→分。分部が 60 以上なら列取り違いとして throw */
export function hmmToMinutes(v: unknown, label: string): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
    throw new Error(`${label}: 時.分表記の数値でありません: ${String(v)}`);
  }
  const [h, mm] = v.toFixed(2).split(".");
  const minutes = Number(mm);
  if (minutes >= 60) {
    throw new Error(
      `${label}: 分部が60以上です(${v.toFixed(2)}。列取り違いの疑い)`
    );
  }
  return Number(h) * 60 + minutes;
}

/** 分単位の正の整数セル。それ以外は throw(秘匿記号・列ズレ検知) */
export function asMinutes(v: unknown, label: string): number {
  if (typeof v !== "number" || !Number.isInteger(v) || v <= 0) {
    throw new Error(`${label}: 分単位の正の整数でありません: ${String(v)}`);
  }
  return v;
}
