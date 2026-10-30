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

import { fingerprintMutationPayload } from "@cantiara/api/mutation-and-undo";

import {
  createImportApply,
  type ImportApplyPorts,
  type ImportFinalRow,
  type ImportFinalSet,
} from "./data-import-apply";
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
  /** Idempotency key of the Apply Import that claimed this file. */
  applyingKey?: string | null;
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
  /** Claims the file for one Apply Import key; false when another key holds it. */
  claim: (accountId: string, id: string, key: string) => Promise<boolean>;
  get: (accountId: string, id: string) => Promise<StagedImport | null>;
  purgeExpired: (now: Date) => Promise<number>;
  put: (staged: StagedImport) => Promise<void>;
  /** Drops the claim after a refusal or a rollback so the file can be retried. */
  release: (accountId: string, id: string) => Promise<void>;
  /**
   * Deletes the staged file. Without `force` a file already claimed by an
   * Apply Import stays: that import is past the point where Cancel exists.
   */
  remove: (
    accountId: string,
    id: string,
    options: { force: boolean },
  ) => Promise<"claimed" | "missing" | "removed">;
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
  /** Apply Import: the Mutation Contract import-origin slice and receipts. */
  apply: ImportApplyPorts;
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
  /** Untruncated mapped values per row number: what Apply writes. */
  fullValues: Map<number, Record<string, string>>;
  originColumn: string | null;
  /** Living record ids of the rows that match an earlier origin. */
  recordIds: Map<number, string>;
  rows: ImportRowPreview[];
}

function mappedValues(
  row: ParsedRow,
  targets: ReadonlyMap<string, string | null>,
  shorten: boolean,
) {
  const values: Record<string, string> = {};
  for (const [column, target] of targets) {
    const cell = row.cells[column]?.trim() ?? "";
    if (target && target !== "origin" && cell !== "") {
      values[target] = shorten ? truncate(cell) : cell;
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
  excludedRows: ReadonlySet<number>,
): PlannedRows {
  const originColumn =
    [...targets.entries()].find(([, target]) => target === "origin")?.[0] ??
    null;
  const mappedFields = new Set(
    [...targets.values()].filter((target): target is string => Boolean(target)),
  );
  const seenOrigins = new Set<string>();
  const fullValues = new Map<number, Record<string, string>>();
  const recordIds = new Map<number, string>();
  const rows = parsed.rows.map((row): ImportRowPreview => {
    const values = mappedValues(row, targets, true);
    fullValues.set(row.rowNumber, mappedValues(row, targets, false));
    const problems = [
      ...row.problems,
      ...missingRequired(requiredFields, mappedFields, values),
    ];
    const originKey = originColumn
      ? row.cells[originColumn]?.trim() || undefined
      : undefined;
    const excluded = excludedRows.has(row.rowNumber);
    if (!excluded) {
      if (originKey && seenOrigins.has(originKey)) {
        problems.push(`Origin key "${originKey}" appears twice in the file.`);
      }
      if (originKey) {
        seenOrigins.add(originKey);
      }
    }
    const known = originKey ? origins.get(originKey) : undefined;
    if (known?.state === "living") {
      recordIds.set(row.rowNumber, known.recordId);
    }
    const classified = classifyRow(
      { originKey, problems, rowNumber: row.rowNumber, values },
      known,
      choices?.[rowKeyOf(row)],
    );
    return excluded ? { ...classified, excluded: true } : classified;
  });
  return { fullValues, originColumn, recordIds, rows };
}

function countRows(rows: readonly ImportRowPreview[]) {
  const counts = {
    create: 0,
    excluded: 0,
    invalid: 0,
    skip: 0,
    total: rows.length,
    updateExisting: 0,
  };
  for (const row of rows) {
    if (row.excluded) {
      counts.excluded += 1;
    } else if (row.action === "invalid") {
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

const RELATIONS_NOTE =
  " Relations: this file type carries none, so none are written; an earlier record's relations are never revived for a new identity.";

function originNote(
  originColumn: string | null,
  provenance: string,
  parsed: ParsedFile,
) {
  const base = originNoteBase(originColumn, provenance, parsed);
  return { ...base, note: `${base.note}${RELATIONS_NOTE}` };
}

function originNoteBase(
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

export interface AnalyzedImport {
  body: Omit<ImportPreview, "expiresAt" | "stagingId">;
  final: ImportFinalSet;
}

function finalRow(row: ImportRowPreview, planned: PlannedRows): ImportFinalRow {
  return {
    originKey: row.originKey ?? null,
    recordId: planned.recordIds.get(row.rowNumber) ?? null,
    rowNumber: row.rowNumber,
    values: planned.fullValues.get(row.rowNumber) ?? {},
  };
}

/** Splits the previewed rows into the exact set Apply Import would write. */
function selectFinalRows(planned: PlannedRows) {
  const creates: ImportFinalRow[] = [];
  const updates: ImportFinalRow[] = [];
  let conflicts = 0;
  let skipped = 0;
  for (const row of planned.rows) {
    if (row.excluded || row.action === "invalid") {
      continue;
    }
    if (row.action === "create") {
      creates.push(finalRow(row, planned));
    } else if (row.choice === "skip") {
      skipped += 1;
    } else if (row.choice === "resolve conflict") {
      conflicts += 1;
    } else {
      updates.push(finalRow(row, planned));
    }
  }
  return { conflicts, creates, skipped, updates };
}

async function analyze(
  accountId: string,
  request: StagedImportRequest,
  content: string,
  ports: DataImportPorts,
): Promise<AnalyzedImport> {
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
    new Set(request.excludedRows ?? []),
  );
  const invalid = planned.rows.filter(
    (row) => row.action === "invalid" && !row.excluded,
  );
  const selected = selectFinalRows(planned);
  const provenance = planned.originColumn ? parsed.provider : null;
  const counts = countRows(planned.rows);
  const fingerprint = await fingerprintMutationPayload({
    catalogType: parsed.catalogType,
    creates: selected.creates.map((row) => ({ ...row })),
    family: parsed.family,
    fileName: request.fileName,
    provenance,
    scope: request.scope,
    skipped: selected.skipped,
    updates: selected.updates.map((row) => ({ ...row })),
  });
  return {
    body: {
      catalogType: parsed.catalogType,
      counts,
      family: parsed.family,
      fileName: request.fileName,
      finalSetFingerprint: fingerprint,
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
    },
    final: {
      catalogType: parsed.catalogType,
      conflicts: selected.conflicts,
      counts: {
        created: selected.creates.length,
        excluded: counts.excluded,
        skipped: selected.skipped,
        updated: selected.updates.length,
      },
      creates: selected.creates,
      family: parsed.family,
      fileName: request.fileName,
      fingerprint,
      invalid: invalid.length,
      mappedFields: [
        ...new Set(
          [...mapping.targets.values()].filter(
            (target): target is string =>
              Boolean(target) && target !== "origin",
          ),
        ),
      ],
      provenance,
      scope: request.scope,
      scopeLabel: facts.label,
      updates: selected.updates,
    },
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

  async function openStaged(accountId: string, stagingId: string, now: Date) {
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
    return {
      analysis: await analyze(accountId, staged.request, content, ports),
      staged,
    };
  }

  const applier = createImportApply({
    openStaged,
    ports: { apply: ports.apply, scopes: ports.scopes, staging: ports.staging },
  });

  return {
    ...applier,
    async preview(accountId, rawInput, now = new Date()) {
      const input = previewImportInputSchema.parse(rawInput);
      const { content, ...request } = input;
      const { body } = await analyze(accountId, request, content, ports);
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
      const { analysis, staged } = await openStaged(accountId, stagingId, now);
      return {
        ...analysis.body,
        expiresAt: staged.expiresAt.toISOString(),
        stagingId,
      };
    },
  };
}
