import {
  EXPORT_MAX_BYTES,
  EXPORT_MAX_CONCURRENT,
  EXPORT_MAX_ROWS,
  EXPORT_NATURE_NOTE,
  EXPORT_PDF_LIMITATION,
  EXPORT_RECORD_TYPES,
  EXPORT_RESIDENCY_NOTE,
  EXPORT_SCHEMA_VERSION,
  type ExportArtifact,
  type ExportCustomFieldDefinition,
  type ExportDataset,
  type ExportDatasetRecord,
  ExportError,
  type ExportField,
  type ExportFormat,
  type ExportFormatProducer,
  type ExportLoss,
  type ExportPreview,
  type ExportProduceInput,
  type ExportProjectScope,
  type ExportRecordExtras,
  type ExportRecordType,
  type ExportRelationPreview,
  type ExportRequest,
  type ExportView,
  exportFamilyOf,
  exportProduceInputSchema,
  exportRequestSchema,
  exportScopeProjectIds,
  isExportRecordType,
  isSecretKey,
  type SelectedExportAccess,
  stripSecrets,
} from "@cantiara/api/data-export";

import { buildCsvTable } from "./csv-export-producer";
import {
  type ExportViewVerifier,
  verifyExportView,
} from "./export-view-verification";

export type { ExportViewVerifier } from "./export-view-verification";

/** One record as a source reader hands it over, before the seam closes the world. */
export interface ExportSourceRecord extends ExportRecordExtras {
  id: string;
  label: string;
  values: Record<string, unknown>;
}

export interface ExportSourceRead {
  /**
   * Fields this account may read. A field missing here is omitted silently:
   * the output never shows an empty or placeholder column for it.
   */
  accessibleFields?: readonly string[];
  /** Definitions of the selected scope that apply to the record type. */
  customFieldDefinitions?: ExportCustomFieldDefinition[];
  records: ExportSourceRecord[];
  relations: ExportRelationPreview[];
}

/**
 * Access-checked, read-only source of one record type. It returns only what the
 * account can read, at most `limit` records, and must never write. Secrets are
 * stripped by the seam, so an adapter cannot bypass the rule by forgetting it.
 */
export interface ExportSourceReader {
  fields: (recordType: ExportRecordType) => ExportField[];
  /** `null` when the scope is not accessible to the account. */
  read: (input: {
    accountId: string;
    filters: Record<string, string>;
    limit: number;
    recordIds?: readonly string[];
    recordType: ExportRecordType;
    scope: ExportProjectScope;
  }) => Promise<ExportSourceRead | null>;
}

export type ExportSources = Partial<
  Record<ExportRecordType, ExportSourceReader>
>;

/** In-process limiter: a refusal is visible, there is no queue or silent long job. */
export function createExportCapacity(max = EXPORT_MAX_CONCURRENT) {
  let active = 0;
  return {
    acquire(): (() => void) | null {
      if (active >= max) {
        return null;
      }
      active += 1;
      let released = false;
      return () => {
        if (!released) {
          released = true;
          active -= 1;
        }
      };
    },
  };
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

const LOSSES: Record<ExportFormat, ExportLoss[]> = {
  CSV: [
    {
      detail: "Relations between records are not carried; each row is flat.",
      kind: "relations",
    },
    {
      detail:
        "Field types are flattened to text; dates, lists and numbers lose their type.",
      kind: "types",
    },
    {
      detail: "Stable record identities are not a round-trip key in this file.",
      kind: "identities",
    },
    {
      detail:
        "Custom field values, key history, origin and nested components are not carried; only the visible columns are.",
      kind: "structure",
    },
  ],
  JSON: [],
  PDF: [
    {
      detail:
        "The PDF is a static picture of the table: relations, custom field values, key history, origin and nested components are not carried.",
      kind: "structure",
    },
    {
      detail:
        "Values are printed as text, so field types and stable record identities are not a round-trip key in this file.",
      kind: "types",
    },
  ],
};

/**
 * Sorting reads only a visible column. A hidden, inaccessible or secret-named
 * field never orders the output, so the order cannot disclose it.
 */
function sortForView(
  records: ExportSourceRecord[],
  sort: { direction: "asc" | "desc"; field: string } | undefined,
  visibleKeys: readonly string[],
): ExportSourceRecord[] {
  if (!(sort && visibleKeys.includes(sort.field) && !isSecretKey(sort.field))) {
    return records;
  }
  const factor = sort.direction === "asc" ? 1 : -1;
  const text = (record: ExportSourceRecord) => {
    const value = record.values[sort.field];
    return value === null || value === undefined ? "" : String(value);
  };
  return [...records].sort(
    (left, right) =>
      factor * text(left).localeCompare(text(right), "en", { numeric: true }),
  );
}

/** A sort on a column that is not exported is dropped from the view too. */
function exportedView(
  view: ExportView | undefined,
  visibleKeys: readonly string[],
): ExportView | undefined {
  if (!view) {
    return undefined;
  }
  const { sort, ...rest } = view;
  return sort && visibleKeys.includes(sort.field) ? view : rest;
}

function chooseColumns(
  visibleFields: readonly string[] | undefined,
  allFields: readonly ExportField[],
  accessibleFields: readonly string[] | undefined,
  secrets: Set<string>,
): { fields: ExportField[]; hiddenFields: ExportField[] } {
  const accessible = accessibleFields ? new Set(accessibleFields) : null;
  const known: ExportField[] = [];
  for (const field of allFields) {
    if (isSecretKey(field.key)) {
      secrets.add(field.key);
    } else if (!accessible || accessible.has(field.key)) {
      known.push(field);
    }
  }
  if (!visibleFields) {
    return { fields: known, hiddenFields: [] };
  }
  // The caller's order is the column order (exact view).
  const wanted = new Set(visibleFields);
  return {
    fields: visibleFields.flatMap((key) =>
      known.filter((field) => field.key === key),
    ),
    hiddenFields: known.filter((field) => !wanted.has(field.key)),
  };
}

function projectRecord(
  record: ExportSourceRecord,
  visibleKeys: readonly string[],
  secrets: Set<string>,
): ExportDatasetRecord {
  const values: Record<string, unknown> = {};
  for (const key of visibleKeys) {
    if (key in record.values) {
      values[key] = record.values[key];
    }
  }
  const extras = stripSecrets(
    {
      components: record.components,
      customFieldValues: record.customFieldValues,
      keyHistory: record.keyHistory,
      origin: record.origin,
    } satisfies ExportRecordExtras,
    secrets,
  );
  const output: ExportDatasetRecord = {
    id: record.id,
    values: stripSecrets(values, secrets),
  };
  for (const [name, value] of Object.entries(extras)) {
    if (value !== undefined) {
      (output as unknown as Record<string, unknown>)[name] = value;
    }
  }
  return output;
}

/**
 * Reads the selected scope through the per-Project reader. A cross-project
 * scope reads every Project in turn; if any Project is not accessible, the whole
 * export is refused so a partial list never claims the full scope.
 */
async function readScope(
  reader: ExportSourceReader,
  input: {
    accountId: string;
    filters: Record<string, string>;
    recordIds?: readonly string[];
    recordType: ExportRecordType;
    scope: ReturnType<typeof exportRequestSchema.parse>["scope"];
  },
): Promise<ExportSourceRead | null> {
  const merged: ExportSourceRead = { records: [], relations: [] };
  let accessible = null as Set<string> | null;
  const definitions = new Map<string, ExportCustomFieldDefinition>();
  for (const projectId of exportScopeProjectIds(input.scope)) {
    // Projects are read one after the other so the row limit applies to the sum.
    // biome-ignore lint/performance/noAwaitInLoops: sequential by design.
    const read = await reader.read({
      accountId: input.accountId,
      filters: input.filters,
      limit: EXPORT_MAX_ROWS + 1 - merged.records.length,
      recordIds: input.recordIds,
      recordType: input.recordType,
      scope: { kind: "project", projectId },
    });
    if (!read) {
      return null;
    }
    merged.records.push(...read.records);
    merged.relations.push(...read.relations);
    for (const definition of read.customFieldDefinitions ?? []) {
      definitions.set(definition.id, definition);
    }
    if (read.accessibleFields) {
      const fieldsOfProject: Set<string> = new Set(read.accessibleFields);
      accessible = accessible
        ? new Set([...accessible].filter((key) => fieldsOfProject.has(key)))
        : fieldsOfProject;
    }
    if (merged.records.length > EXPORT_MAX_ROWS) {
      throw new ExportError("limit_exceeded");
    }
  }
  merged.customFieldDefinitions = [...definitions.values()];
  if (accessible) {
    merged.accessibleFields = [...accessible];
  }
  return merged;
}

interface ClosedWorld {
  /** The finished artifact, produced inside the capacity window. */
  artifact?: ExportArtifact;
  dataset: ExportDataset;
  fingerprint: string;
  preview: Omit<ExportPreview, "fingerprint" | "formatAvailable">;
}

/**
 * Selected Export: closed-world preview first, then the artifact only for a
 * confirmed preview. Nothing here writes to the Workspace.
 */
export function createSelectedExport(options: {
  capacity?: ReturnType<typeof createExportCapacity>;
  now?: () => Date;
  producers?: Partial<Record<ExportFormat, ExportFormatProducer>>;
  sources: ExportSources;
  /** Resolves stored view definitions; without it a Smart Collection view is refused. */
  viewVerifier?: ExportViewVerifier;
}): SelectedExportAccess {
  const capacity = options.capacity ?? createExportCapacity();
  const now = options.now ?? (() => new Date());
  const producers = options.producers ?? {};

  async function closeWorld(
    accountId: string,
    request: ExportRequest,
  ): Promise<ClosedWorld> {
    const parsed = exportRequestSchema.parse(request);
    if (!isExportRecordType(parsed.recordType)) {
      throw new ExportError("unlisted_family");
    }
    const { recordType } = parsed;
    if (parsed.format === "PDF" && !parsed.view) {
      throw new ExportError(
        "format_unavailable",
        "PDF is only available for an exact-view list.",
      );
    }
    const verified = await verifyExportView({
      accountId,
      parsed,
      recordType,
      verifier: options.viewVerifier,
    });
    const reader = options.sources[recordType];
    if (!reader) {
      throw new ExportError("source_unavailable");
    }
    const release = capacity.acquire();
    if (!release) {
      throw new ExportError("capacity_exceeded");
    }
    try {
      const read = await readScope(reader, {
        accountId,
        filters: verified.readerFilters,
        recordIds: verified.recordIds,
        recordType,
        scope: parsed.scope,
      });
      if (!read) {
        throw new ExportError("source_unavailable");
      }
      if (read.records.length > EXPORT_MAX_ROWS) {
        throw new ExportError("limit_exceeded");
      }
      // Shaping, serialization and hashing stay inside the capacity window.
      const world = shape(parsed, recordType, reader, read, verified);
      world.fingerprint = await fingerprint(world);
      return world;
    } finally {
      release();
    }
  }

  function shape(
    parsed: ReturnType<typeof exportRequestSchema.parse>,
    recordType: ExportRecordType,
    reader: ExportSourceReader,
    read: ExportSourceRead,
    verified: { recordIds?: string[] },
  ): ClosedWorld {
    const secrets = new Set<string>();
    const { fields, hiddenFields } = chooseColumns(
      parsed.visibleFields,
      reader.fields(recordType),
      read.accessibleFields,
      secrets,
    );
    const visibleKeys = fields.map((field) => field.key);

    const requested = verified.recordIds ? new Set(verified.recordIds) : null;
    const view = exportedView(parsed.view, visibleKeys);
    const selected = sortForView(
      read.records.filter((record) => !requested || requested.has(record.id)),
      view?.sort,
      visibleKeys,
    );
    const selectedIds = new Set(selected.map((record) => record.id));
    const records = selected.map((record) =>
      projectRecord(record, visibleKeys, secrets),
    );
    const customFieldDefinitions = stripSecrets(
      read.customFieldDefinitions ?? [],
      secrets,
    );
    const closed = read.relations.filter(
      (relation) =>
        selectedIds.has(relation.fromRecordId) &&
        selectedIds.has(relation.toRecordId),
    );
    const relations = stripSecrets(closed, secrets);

    const manifest: ExportDataset["manifest"] = {
      filters: parsed.filters,
      format: parsed.format,
      producedAt: now().toISOString(),
      recordCount: records.length,
      recordType,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      scope: parsed.scope,
      ...(view ? { view } : {}),
      visibleFields: visibleKeys,
    };
    const dataset: ExportDataset = {
      customFieldDefinitions,
      fields,
      manifest,
      records,
      relations,
    };
    const escapes =
      parsed.format === "CSV" ? buildCsvTable(dataset).escapes : undefined;
    if (escapes) {
      manifest.escapes = escapes;
    }
    // The estimate measures the real artifact (manifest, pretty-printing, CSV
    // quoting), so a passed preview cannot fail later for size.
    const artifact = producers[parsed.format]?.produce(dataset);
    const estimatedBytes = byteLength(
      artifact?.bytes ??
        JSON.stringify({
          customFieldDefinitions,
          manifest,
          records,
          relations,
        }),
    );
    if (estimatedBytes > EXPORT_MAX_BYTES) {
      throw new ExportError("limit_exceeded");
    }
    return {
      artifact,
      dataset,
      fingerprint: "",
      preview: {
        ...(escapes ? { escapes } : {}),
        estimatedBytes,
        fields,
        filters: parsed.filters,
        format: parsed.format,
        hiddenFields,
        limits: { maxBytes: EXPORT_MAX_BYTES, maxRows: EXPORT_MAX_ROWS },
        lost: LOSSES[parsed.format],
        ...(parsed.format === "PDF"
          ? {
              pdfNotice: {
                alternative: "CSV" as const,
                limitation: EXPORT_PDF_LIMITATION,
              },
            }
          : {}),
        nature: EXPORT_NATURE_NOTE,
        recordCount: records.length,
        recordType,
        records: selected.map((record) => ({
          id: record.id,
          label: record.label,
        })),
        relations,
        relationsOmitted: read.relations.length - relations.length,
        residency: EXPORT_RESIDENCY_NOTE,
        scope: parsed.scope,
        secretsExcluded: [...secrets].sort(),
        ...(view ? { view } : {}),
      },
    };
  }

  /** The fingerprint covers what leaves, not the production time. */
  function fingerprint(world: ClosedWorld) {
    const { customFieldDefinitions, manifest, records, relations } =
      world.dataset;
    return sha256(
      JSON.stringify({
        customFieldDefinitions,
        filters: manifest.filters,
        format: manifest.format,
        records,
        recordType: manifest.recordType,
        relations,
        scope: manifest.scope,
        view: manifest.view,
        visibleFields: manifest.visibleFields,
      }),
    );
  }

  return {
    catalog() {
      return EXPORT_RECORD_TYPES.map((recordType) => ({
        available: Boolean(options.sources[recordType]),
        family: exportFamilyOf(recordType),
        recordType,
      }));
    },

    async preview(accountId, request) {
      const world = await closeWorld(accountId, request);
      return {
        ...world.preview,
        fingerprint: world.fingerprint,
        formatAvailable: Boolean(producers[world.preview.format]),
      };
    },

    async produce(accountId: string, input: ExportProduceInput) {
      const { previewFingerprint, ...request } =
        exportProduceInputSchema.parse(input);
      const world = await closeWorld(accountId, request);
      // No artifact exists before the founder confirmed this exact preview.
      if (world.fingerprint !== previewFingerprint) {
        throw new ExportError("preview_required");
      }
      if (!world.artifact) {
        throw new ExportError("format_unavailable");
      }
      const finalize = producers[world.preview.format]?.finalize;
      if (!finalize) {
        return world.artifact;
      }
      // Heavy rendering (PDF) happens only after confirmation, inside capacity.
      const release = capacity.acquire();
      if (!release) {
        throw new ExportError("capacity_exceeded");
      }
      try {
        const finished = await finalize(world.artifact);
        const size =
          finished.encoding === "base64"
            ? Math.ceil((finished.bytes.length * 3) / 4)
            : byteLength(finished.bytes);
        if (size > EXPORT_MAX_BYTES) {
          throw new ExportError("limit_exceeded");
        }
        return finished;
      } finally {
        release();
      }
    },
  };
}
