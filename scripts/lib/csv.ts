/**
 * RFC 4180 準拠の最小 CSV パーサ / シリアライザ。
 * 依存を増やさないため自前実装(ダブルクォート・埋め込み改行・CRLF 対応)。
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      pushField();
      i += 1;
    } else if (ch === "\r" && text[i + 1] === "\n") {
      pushRow();
      i += 2;
    } else if (ch === "\n") {
      pushRow();
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  // 最終行(末尾改行なし)
  if (field !== "" || row.length > 0) {
    pushRow();
  }
  return rows;
}

export function toCsv(rows: string[][]): string {
  const escapeField = (value: string): string =>
    /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return rows.map((r) => r.map(escapeField).join(",")).join("\n") + "\n";
}
