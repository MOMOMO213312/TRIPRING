// ── Amadeus screen paste parser ─────────────────────────────────────────
// Turns raw text copied straight off an Amadeus AN (availability) or ACW
// (availability + fare) GDS screen into row objects with the exact same
// shape `parseDealImportRows` already expects (see lib/agency.ts) — so
// once this is filled in, the paste flow gets the same preview/validation
// safety net as the Excel import and the quick-entry grid, for free.
//
// STATUS: not implemented yet. This is intentionally a stub so the "لصق من
// أماديوس" button has somewhere real to live in the UI while we build and
// validate the actual AN/ACW line parsing against a real screen sample.
// Returning an empty row list (instead of guessing at a format) means a
// bad parse fails loudly in the UI instead of silently creating wrong deals.

export type AmadeusScreenType = "AN" | "ACW" | "unknown";

export type AmadeusParseResult = {
  screenType: AmadeusScreenType;
  rows: Record<string, string>[];
  /** Lines that were read but not understood, kept for the user to see. */
  unparsedLines: string[];
  /** Set when the parser can't do anything useful with the input yet. */
  notImplemented: boolean;
};

function detectScreenType(raw: string): AmadeusScreenType {
  const firstLine = raw.trim().split("\n")[0] ?? "";
  if (/ADT\s+[A-Z]\s+\d/.test(raw)) return "ACW"; // fare-per-class lines present
  if (/^\d+\s+[A-Z0-9]{2}\s?\d{2,4}/.test(firstLine)) return "AN";
  return "unknown";
}

export function parseAmadeusScreenText(raw: string): AmadeusParseResult {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  return {
    screenType: detectScreenType(raw),
    rows: [],
    unparsedLines: lines,
    notImplemented: true,
  };
}
