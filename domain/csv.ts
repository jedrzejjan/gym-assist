// A small CSV reader for the one-time history import (GYM-25). RFC 4180 quoting: a field in
// double quotes may hold commas, line breaks and doubled quotes (""). The old tool and Excel
// write a BOM and \r\n line endings; both are accepted. Blank lines are skipped.

export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };
  const endRow = () => {
    endField();
    // A blank line parses as one empty field: skip it.
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
  };

  while (i < s.length) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      if (c === '"') quoted = false;
      else field += c;
      i += 1;
      continue;
    }
    if (c === '"' && field === '') quoted = true;
    else if (c === ',') endField();
    else if (c === '\r' && s[i + 1] === '\n') {
      endRow();
      i += 1;
    } else if (c === '\n' || c === '\r') endRow();
    else field += c;
    i += 1;
  }
  if (field !== '' || row.length > 0) endRow();
  return rows;
}
