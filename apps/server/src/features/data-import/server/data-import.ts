import { randomUUID } from "node:crypto";

import {
  type DataImportAccess,
  IMPORT_FIELDS,
  IMPORT_PREVIEW_INVALID_LIMIT,
  IMPORT_PREVIEW_ROW_LIMIT,
  IMPORT_STAGING_TTL_MS,
  type ImportCatalogType,
  type ImportPreview,
  type ImportRowChoice,
  type ImportRowPreview,
  ImportScopeNotFoundError,
  ImportStagingExpiredError,
  type PreviewImportInput,
  previewImportInputSchema,
  reopenImportPreviewInputSchema,
} from "@cantiara/api/data-import";

import type { ImportSealer, SealedImport } from "./data-import-envelope";
import {
  checkScope,
  type ParsedFile,
  type ParsedRow,
  parseImportFile,
  planMapping,
} from "./data-import-file";

const VALUE_PREVIEW_LENGTH = 200;
const UPDATE_CHOICES: readonly ImportRowChoice[] = [
  "update existing",
  "skip",
  "resolve conflict",
];

/** The request without the file bytes: what a reopened preview needs again. */
export type StagedImportRequest = Omit<
  ReturnType<typeof previewImportInputSchema.parse>,
  "content"
>;

export interface StagedImport {
  accountId: string;
  byteSize: number;
  createdAt: Date;
  expiresAt: Date;
  id: string;
  request: StagedImportRequest;
  rowCount: number;
  sealed: SealedImport;
}

/**
 * Encrypted staging: the only thing a preview writes. It holds the file for at
 * most 24 hours and is not part of any primary store or search index.
 */
export interface ImportStagingStore {
  get: (accountId: string, id: string) => Promise<StagedImport | null>;
  purgeExpired: (now: Date) => Promise<number>;
  put: (staged: StagedImport) => Promise<void>;
}

export interface ImportScopeFacts {
  /** Names of the Project's living custom fields; empty outside a Project. */
  customFieldNames: readonly string[];
  label: string;
}

export type ImportOriginState =
  | { recordId: string; state: "living"; title: string }
  | { state: "permanently deleted" }
  | { state: "retired" };

export interface ImportOriginQuery {
  catalogType: ImportCatalogType | "Document";
  keys: readonly string[];
  /** Provider/file scope the keys were read under. */
  provenance: string;
  scopeLabel: string;
}

export interface DataImportPorts {
  newId?: () => string;
  /** Earlier import origins for exact-match diff; read only. */
  origins: (
    accountId: string,
    scope: PreviewImportInput["scope"],
    query: ImportOriginQuery,
  ) => Promise<ReadonlyMap<string, ImportOriginState>>;
  /** Resolves a scope the account owns; null when it is not found. */
  scopes: (
    accountId: string,
    scope: PreviewImportInput["scope"],
  ) => Promise<ImportScopeFacts | null>;
  sealer: ImportSealer;
  staging: ImportStagingStore;
}

function aad(accountId: string, id: string) {
  return `data-import:${accountId}:${id}`;
}

function truncate(value: string) {
  return value.length > VALUE_PREVIEW_LENGTH
    ? `${value.slice(0, VALUE_PREVIEW_LENGTH)}…`
    : value;
}

function rowKeyOf(row: ParsedRow) {
  return String(row.rowNumber);
}

interface PlannedRows {
  originColumn: string | null;
  rows: ImportRowPreview[];
}

function mappedValues(
  row: ParsedRow,
  targets: ReadonlyMap<string, string | null>,
) {
  const values: Record<string, string> = {};
  for (const [column, target] of targets) {
    const cell = row.cells[column]?.trim() ?? "";
    if (target && target !== "origin" && cell !== "") {
      values[target] = truncate(cell);
    }
  }
  return values;
}

function missingRequired(
  requiredFields: readonly string[],
  mappedFields: ReadonlySet<string>,
  values: Record<string, string>,
) {
  const problems: string[] = [];
  for (const field of requiredFields) {
    if (!mappedFields.has(field)) {
      problems.push(`No column is mapped to ${field}.`);
    } else if (!values[field]) {
      problems.push(`${field} is empty.`);
    }
  }
  return problems;
}

function classifyRow(
  base: Pick<
    ImportRowPreview,
    "originKey" | "problems" | "rowNumber" | "values"
  >,
  known: ImportOriginState | undefined,
  choice: ImportRowChoice | undefined,
): ImportRowPreview {
  if (base.problems.length > 0) {
    return { ...base, action: "invalid" };
  }
  if (known?.state === "living") {
    return {
      ...base,
      action: "update existing",
      choice: choice ?? "update existing",
      choices: UPDATE_CHOICES,
    };
  }
  if (known && base.originKey) {
    return {
      ...base,
      action: "create",
      newIdentity: { previousOrigin: base.originKey, reason: known.state },
    };
  }
  return { ...base, action: "create" };
}

function buildRows(
  parsed: ParsedFile,
  targets: ReadonlyMap<string, string | null>,
  requiredFields: readonly string[],
  origins: ReadonlyMap<string, ImportOriginState>,
  choices: Record<string, ImportRowChoice> | undefined,
): PlannedRows {
  const originColumn =
    [...targets.entries()].find(([, target]) => target === "origin")?.[0] ??
    null;
  const mappedFields = new Set(
    [...targets.values()].filter((target): target is string => Boolean(target)),
  );
  const seenOrigins = new Set<string>();
  const rows = parsed.rows.map((row): ImportRowPreview => {
    const values = mappedValues(row, targets);
    const problems = [
      ...row.problems,
      ...missingRequired(requiredFields, mappedFields, values),
    ];
    const originKey = originColumn
      ? row.cells[originColumn]?.trim() || undefined
      : undefined;
    if (originKey && seenOrigins.has(originKey)) {
      problems.push(`Origin key "${originKey}" appears twice in the file.`);
    }
    if (originKey) {
      seenOrigins.add(originKey);
    }
    return classifyRow(
      { originKey, problems, rowNumber: row.rowNumber, values },
      originKey ? origins.get(originKey) : undefined,
      choices?.[rowKeyOf(row)],
    );
  });
  return { originColumn, rows };
}

function countRows(rows: readonly ImportRowPreview[]) {
  const counts = {
    create: 0,
    invalid: 0,
    skip: 0,
    total: rows.length,
    updateExisting: 0,
  };
  for (const row of rows) {
    if (row.action === "invalid") {
      counts.invalid += 1;
    } else if (row.action === "create") {
      counts.create += 1;
    } else if (row.choice === "skip") {
      counts.skip += 1;
    } else {
      counts.updateExisting += 1;
    }
  }
  return counts;
}

function originNote(
  originColumn: string | null,
  provenance: string,
  parsed: ParsedFile,
) {
  if (!originColumn) {
    return {
      column: null,
      note:
        parsed.family === "Document"
          ? "This file has no stable origin key. It is created as a new Document; nothing is matched by guess."
          : "This file has no stable origin key. Rows are created as new records; no matching is guessed without your approval.",
      provenance: null,
    };
  }
  return {
    column: originColumn,
    note: `Column "${originColumn}" is kept as the origin under ${provenance}. It identifies the source row only; it never restores a product id.`,
    provenance,
  };
}

async function analyze(
  accountId: string,
  request: StagedImportRequest,
  content: string,
  ports: DataImportPorts,
): Promise<Omit<ImportPreview, "expiresAt" | "stagingId">> {
  const parsed = parseImportFile({
    catalogType: request.catalogType,
    content,
    fileCount: request.fileCount,
    fileName: request.fileName,
  });
  checkScope(parsed, request.scope);
  const facts = await ports.scopes(accountId, request.scope);
  if (!facts) {
    throw new ImportScopeNotFoundError();
  }
  const { losses, mapping } = planMapping(
    parsed,
    facts.customFieldNames,
    request.mapping,
  );
  const originColumn =
    [...mapping.targets.entries()].find(
      ([, target]) => target === "origin",
    )?.[0] ?? null;
  const originKeys = originColumn
    ? parsed.rows
        .map((row) => row.cells[originColumn]?.trim() ?? "")
        .filter((key) => key !== "")
    : [];
  const origins =
    originKeys.length > 0
      ? await ports.origins(accountId, request.scope, {
          catalogType: parsed.catalogType ?? "Document",
          keys: [...new Set(originKeys)],
          provenance: parsed.provider,
          scopeLabel: facts.label,
        })
      : new Map<string, ImportOriginState>();
  const required =
    parsed.family === "Document"
      ? ["title", "body"]
      : requiredFieldsOf(parsed.catalogType);
  const planned = buildRows(
    parsed,
    mapping.targets,
    required,
    origins,
    request.rowChoices,
  );
  const invalid = planned.rows.filter((row) => row.action === "invalid");
  return {
    catalogType: parsed.catalogType,
    counts: countRows(planned.rows),
    family: parsed.family,
    fileName: request.fileName,
    format: parsed.format,
    invalidRows: invalid.slice(0, IMPORT_PREVIEW_INVALID_LIMIT),
    invalidTotal: invalid.length,
    losses: [...parsed.losses, ...losses],
    mapping: mapping.entries,
    mappingTargets: mapping.targetOptions,
    origin: originNote(planned.originColumn, parsed.provider, parsed),
    primaryWrites: "none",
    rows: planned.rows.slice(0, IMPORT_PREVIEW_ROW_LIMIT),
    rowsTruncated: planned.rows.length > IMPORT_PREVIEW_ROW_LIMIT,
    scope: { kind: request.scope.kind, label: facts.label },
  };
}

function requiredFieldsOf(type: ImportCatalogType | null) {
  return type ? IMPORT_FIELDS[type].required : [];
}

/**
 * Standard Import (preview half): reads one file, shows scope, mapping, loss,
 * conflicts and invalid rows, and stages the encrypted bytes. It never changes
 * a primary record, relation or search entry.
 */
export function createDataImport(ports: DataImportPorts): DataImportAccess {
  const newId = ports.newId ?? randomUUID;
  return {
    async preview(accountId, rawInput, now = new Date()) {
      const input = previewImportInputSchema.parse(rawInput);
      const { content, ...request } = input;
      const body = await analyze(accountId, request, content, ports);
      await ports.staging.purgeExpired(now);
      const id = newId();
      const expiresAt = new Date(now.getTime() + IMPORT_STAGING_TTL_MS);
      await ports.staging.put({
        accountId,
        byteSize: Buffer.byteLength(content, "utf8"),
        createdAt: now,
        expiresAt,
        id,
        request,
        rowCount: body.counts.total,
        sealed: ports.sealer.seal(content, aad(accountId, id)),
      });
      return { ...body, expiresAt: expiresAt.toISOString(), stagingId: id };
    },

    async reopen(accountId, rawInput, now = new Date()) {
      const { stagingId } = reopenImportPreviewInputSchema.parse(rawInput);
      const staged = await ports.staging.get(accountId, stagingId);
      if (!staged || staged.expiresAt.getTime() <= now.getTime()) {
        throw new ImportStagingExpiredError();
      }
      let content: string;
      try {
        content = ports.sealer.open(staged.sealed, aad(accountId, stagingId));
      } catch {
        // biome-ignore lint/style/useErrorCause: The cipher error must not travel with the refusal.
        throw new ImportStagingExpiredError();
      }
      const body = await analyze(accountId, staged.request, content, ports);
      return {
        ...body,
        expiresAt: staged.expiresAt.toISOString(),
        stagingId,
      };
    },
  };
}
