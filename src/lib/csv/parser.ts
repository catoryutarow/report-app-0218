import Papa from "papaparse";

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
};

export function parseCsvFile(file: File): Promise<ParsedCsv> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "UTF-8",
      complete: (results) => {
        resolve({
          headers: results.meta.fields ?? [],
          rows: results.data,
          errors: results.errors.map(
            (e) => `行${e.row != null ? e.row + 2 : "?"}: ${e.message}`
          ),
        });
      },
      error: (err) => {
        resolve({ headers: [], rows: [], errors: [err.message] });
      },
    });
  });
}

/**
 * Parse a duration string in H:MM:SS or M:SS or HH:MM:SS format to total seconds.
 * Examples: "0:04:11" → 251, "1:23:45" → 5025, "0:30" → 30
 */
export function parseDurationToSeconds(value: string): number | null {
  const trimmed = value.trim();
  // Match patterns like 0:04:11 or 1:23:45 or 0:30
  const parts = trimmed.split(":");
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const s = parseInt(parts[2], 10);
    if (!isNaN(h) && !isNaN(m) && !isNaN(s)) {
      return h * 3600 + m * 60 + s;
    }
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10);
    const s = parseInt(parts[1], 10);
    if (!isNaN(m) && !isNaN(s)) {
      return m * 60 + s;
    }
  }
  return null;
}

/**
 * Parse a raw CSV cell value into a number based on the metric type.
 * Handles:
 * - duration_sec: "0:04:11" → 251
 * - comma-separated numbers: "1,234" → 1234
 * - percentage symbols: "4.39%" → 4.39
 * - currency symbols: "¥1,234" → 1234
 */
export function parseCsvValue(
  rawValue: string,
  metricType: "integer" | "float" | "duration_sec" | "currency"
): number | null {
  if (rawValue == null || rawValue === "") return null;

  const trimmed = String(rawValue).trim();

  // Duration type: try H:MM:SS first
  if (metricType === "duration_sec") {
    const seconds = parseDurationToSeconds(trimmed);
    if (seconds != null) return seconds;
    // Fall through to number parsing (might be raw seconds)
  }

  // Strip common non-numeric prefixes/suffixes
  const cleaned = trimmed
    .replace(/^[¥$€£]/, "")  // currency symbols
    .replace(/%$/, "")        // trailing %
    .replace(/,/g, "");       // thousand separators

  const num = parseFloat(cleaned);
  if (isNaN(num)) return null;

  // For integer type, round to nearest integer
  if (metricType === "integer") return Math.round(num);

  return num;
}
