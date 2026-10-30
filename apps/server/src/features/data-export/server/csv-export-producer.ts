import {
  EXPORT_ESCAPE_REPORT_CELLS,
  type ExportDataset,
  type ExportEscapeReport,
  type ExportFormatProducer,
} from "@cantiara/api/data-export";
import Papa from "papaparse";

/** Prefixes a spreadsheet may read as a formula: `=`, `+`, `-`, `@`, tab, CR. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function flatten(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(flatten).join("; ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Spreadsheet-safe cell: a leading formula character gets a single quote so
 * the cell is data, not a formula. The product rule lives here; Papa Parse only
 * serializes the finished table.
 */
export function escapeFormulaCell(text: string): {
  escaped: boolean;
  text: string;
} {
  return FORMULA_PREFIX.test(text)
    ? { escaped: true, text: `'${text}` }
    : { escaped: false, text };
}

export interface CsvTable {
  escapes: ExportEscapeReport;
  header: string[];
  rows: string[][];
}

/** Flat, lossy table of the dataset's visible columns, in column order. */
export function buildCsvTable(dataset: ExportDataset): CsvTable {
  const escapes: ExportEscapeReport = { cells: [], count: 0 };
  const rows = dataset.records.map((record) =>
    dataset.fields.map((field) => {
      const cell = escapeFormulaCell(flatten(record.values[field.key]));
      if (cell.escaped) {
        escapes.count += 1;
        if (escapes.cells.length < EXPORT_ESCAPE_REPORT_CELLS) {
          escapes.cells.push({ field: field.key, recordId: record.id });
        }
      }
      return cell.text;
    }),
  );
  return {
    escapes,
    header: dataset.fields.map((field) => field.label),
    rows,
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Elektronik tablo güvenli CSV: a flat, lossy convenience of the current view.
 * Relations, field types, stable identities and nested structure are not
 * carried (the preview reports that). The dataset is already secret-free.
 */
export const csvExportProducer: ExportFormatProducer = {
  format: "CSV",
  produce(dataset: ExportDataset) {
    const { manifest } = dataset;
    const table = buildCsvTable(dataset);
    const bytes = Papa.unparse(
      { data: table.rows, fields: table.header },
      { newline: "\r\n" },
    );
    return {
      bytes: `${bytes}\r\n`,
      fileName: `cantiara-${slug(manifest.view?.name ?? manifest.recordType)}-${manifest.producedAt.slice(0, 10)}.csv`,
      manifest: { ...manifest, escapes: table.escapes },
      mediaType: "text/csv",
    };
  },
};
