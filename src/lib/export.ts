/**
 * Client-side CSV / JSON export helpers.
 * Streams data through a Blob download — no server round-trip.
 */

function download(filename: string, mime: string, content: BlobPart) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: (keyof T)[],
) {
  if (rows.length === 0) {
    download(filename, "text/csv", "");
    return;
  }
  const cols = (columns ?? (Object.keys(rows[0]) as (keyof T)[])) as string[];
  const header = cols.join(",");
  const body = rows
    .map((r) => cols.map((c) => csvEscape((r as Record<string, unknown>)[c])).join(","))
    .join("\n");
  download(filename, "text/csv;charset=utf-8", `${header}\n${body}\n`);
}

export function exportJson(filename: string, data: unknown) {
  download(filename, "application/json", JSON.stringify(data, null, 2));
}

export function timestampedName(base: string, ext: "csv" | "json"): string {
  const d = new Date();
  const stamp = d.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `${base}_${stamp}.${ext}`;
}
