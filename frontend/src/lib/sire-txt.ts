/**
 * SIRE TXT generator for Registro de Compras Electrónico (RCE).
 *
 * Generates a SUNAT-compatible 37-field pipe-separated TXT file
 * entirely client-side using voucher data already in cache.
 *
 * Format: ANEXO F - SUNAT SIRE/RCE
 * File name: LE{RUC}{AAAA}{MM}00080400{CC}{O}{I}{M}{G}.txt
 */

import type { Voucher } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Field formatters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formats a number to 2 decimal places.
 * Returns "0.00" for null/undefined values.
 */
export function fmt2(v: number | null | undefined): string {
  return v != null ? v.toFixed(2) : "0.00";
}

/**
 * Formats a number to 3 decimal places.
 * Returns "" for null/undefined values (used for exchange rate — RN-11).
 */
export function fmt3(v: number | null | undefined): string {
  return v != null ? v.toFixed(3) : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// File name generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate the SUNAT-compliant file name for the SIRE/RCE TXT.
 *
 * Structure: LE + RUC(11) + AAAA(4) + MM(2) + 00 + 080400 + 02 + 1 + 1 + 1 + 2 + .txt
 *
 * Example: generateSireFileName("20611404426", "202602") → "LE2061140442620260200080400021112.txt"
 *
 * @param ruc    - Company RUC (11 digits)
 * @param period - Period in YYYYMM format (e.g. "202602")
 */
export function generateSireFileName(ruc: string, period: string): string {
  const year = period.slice(0, 4);
  const month = period.slice(4, 6);
  return `LE${ruc}${year}${month}00080400021112.txt`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SIRE TXT Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate SUNAT SIRE/RCE TXT content for purchase vouchers.
 *
 * Business rules:
 *  - RN-01: Includes vouchers with validation_status === "valido" OR
 *           null/undefined validation_status. Excludes "rechazado" and "observado".
 *  - RN-08: Sort by series ASC, then number ASC (string comparison).
 *  - RN-06/RN-07: Build exactly 37 pipe-separated fields per line.
 *  - RN-11: Exchange rate field ("") if currency=PEN, else fmt3(exchange_rate).
 *
 * Returns lines joined with "\n". Returns empty string if no eligible vouchers.
 *
 * @param vouchers    All vouchers for the company/period
 * @param companyRuc  Company RUC (11 digits) — used in field 01
 * @param companyName Company business name — used in field 02
 * @param period      Period in YYYYMM format — fallback for field 03
 */
export function generateSireTxt(
  vouchers: Voucher[],
  companyRuc: string,
  companyName: string,
  period: string,
): string {
  // RN-01: Filter eligible vouchers
  const eligible = vouchers.filter(
    (v) => !v.validation_status || v.validation_status === "valido",
  );

  if (eligible.length === 0) return "";

  // RN-08: Sort by series ASC, then number ASC
  const sorted = [...eligible].sort((a, b) => {
    const seriesCmp = (a.series ?? "").localeCompare(b.series ?? "");
    if (seriesCmp !== 0) return seriesCmp;
    return (a.number ?? "").localeCompare(b.number ?? "");
  });

  const lines = sorted.map((v) => {
    const currency = v.currency ?? "PEN";
    const isPen = currency === "PEN";

    // Build the 37 fields (RN-06/RN-07/RN-09/RN-10)
    const fields: string[] = [
      /* 01 */ companyRuc,
      /* 02 */ companyName,
      /* 03 */ v.period ?? period,
      /* 04 */ "", // CAR SUNAT — always empty (produces "||" in output)
      /* 05 */ v.emission_date ?? "",
      /* 06 */ v.due_date ?? "",
      /* 07 */ v.voucher_type ?? "",
      /* 08 */ v.series ?? "",
      /* 09 */ "", // issue_year — not stored
      /* 10 */ v.number ?? "",
      /* 11 */ "", // number_end — not stored
      /* 12 */ "6", // supplier_id_type — default RUC
      /* 13 */ v.supplier_ruc ?? "",
      /* 14 */ v.supplier_name ?? "",
      /* 15 */ fmt2(v.taxable_base_dg),
      /* 16 */ fmt2(v.igv_ipm_dg),
      /* 17 */ fmt2(v.taxable_base_dgng),
      /* 18 */ fmt2(v.igv_ipm_dgng),
      /* 19 */ fmt2(v.taxable_base_dng),
      /* 20 */ fmt2(v.igv_ipm_dng),
      /* 21 */ fmt2(v.non_taxed_acq_value),
      /* 22 */ fmt2(v.isc),
      /* 23 */ fmt2(v.icbper),
      /* 24 */ fmt2(v.other_taxes_charges),
      /* 25 */ fmt2(v.total),
      /* 26 */ currency,
      /* 27 */ isPen ? "" : fmt3(v.exchange_rate), // RN-11
      /* 28 */ "", // modified_doc_emission_date — not stored
      /* 29 */ "", // modified_doc_voucher_type — not stored
      /* 30 */ "", // modified_doc_series — not stored
      /* 31 */ "", // COD. DAM — not stored
      /* 32 */ "", // modified_doc_number — not stored
      /* 33 */ "", // always empty
      /* 34 */ "", // always empty
      /* 35 */ "", // always empty
      /* 36 */ "0.00", // IMB — default
      /* 37 */ "", // Estado CP rectificatoria — always empty
    ];

    return fields.join("|");
  });

  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser download helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trigger a browser download of a plain-text file with UTF-8 encoding.
 *
 * @param content  - File content as string
 * @param filename - File name (e.g. "LE2061140442620260200080400021112.txt")
 */
export function downloadTxtFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
