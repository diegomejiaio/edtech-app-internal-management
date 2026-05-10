/**
 * SUNAT etiqueta code → description mapping.
 * Backend stores only the code in `labels[]`, frontend maps to text.
 */
export const ETIQUETA_MAP: Record<string, string> = {
  "18": "INSPECCIÓN NO INTRUSIVA",
  "16": "AVISOS",
  "15": "NOTIFICACIONES ANTERIORES",
  "14": "RESOLUCIONES DE FISCALIZACIÓN",
  "13": "RESOLUCIONES NO CONTENCIOSAS",
  "12": "RESOLUCIONES DE FRACCIONAMIENTO",
  "11": "RESOLUCIONES DE COBRANZA",
  "10": "VALORES",
  "00": "SIN ETIQUETA",
};

/** Short labels for compact display in table cells. */
export const ETIQUETA_SHORT: Record<string, string> = {
  "18": "Inspecc.",
  "16": "Aviso",
  "15": "Anterior",
  "14": "Fiscaliz.",
  "13": "No Cont.",
  "12": "Fracc.",
  "11": "Cobranza",
  "10": "Valores",
  "00": "—",
};
