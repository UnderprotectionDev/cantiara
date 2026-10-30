import {
  EXPORT_MAX_BYTES,
  EXPORT_MAX_CONCURRENT,
  EXPORT_MAX_ROWS,
  EXPORT_NATURE_NOTE,
  EXPORT_RECORD_TYPES,
  EXPORT_RESIDENCY_NOTE,
  EXPORT_SCHEMA_VERSION,
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
  type ExportRecordExtras,
  type ExportRecordType,
  type ExportRelationPreview,
  type ExportRequest,
  type ExportScope,
  exportFamilyOf,
  exportProduceInputSchema,
  exportRequestSchema,
  isExportRecordType,
  isSecretKey,
  type SelectedExportAccess,
  stripSecrets,
} from "@cantiara/api/data-export";

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
    scope: ExportScope;
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

function byteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
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
  ],
  JSON: [],
};

interface ClosedWorld {
  dataset: ExportDataset;
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
    const reader = options.sources[recordType];
    if (!reader) {
      throw new ExportError("source_unavailable");
    }
    const release = capacity.acquire();
    if (!release) {
      throw new ExportError("capacity_exceeded");
    }
    try {
      const read = await reader.read({
        accountId,
        filters: parsed.filters,
        limit: EXPORT_MAX_ROWS + 1,
        recordIds: parsed.recordIds,
        recordType,
        scope: parsed.scope,
      });
      if (!read) {
        throw new ExportError("source_unavailable");
      }
      if (read.records.length > EXPORT_MAX_ROWS) {
        throw new ExportError("limit_exceeded");
      }
      return shape(parsed, recordType, reader, read);
    } finally {
      release();
    }
  }

  function shape(
    parsed: ReturnType<typeof exportRequestSchema.parse>,
    recordType: ExportRecordType,
    reader: ExportSourceReader,
    read: ExportSourceRead,
  ): ClosedWorld {
    const secrets = new Set<string>();
    const accessible = read.accessibleFields
      ? new Set(read.accessibleFields)
      : null;
    const known: ExportField[] = [];
    for (const field of reader.fields(recordType)) {
      if (isSecretKey(field.key)) {
        secrets.add(field.key);
      } else if (!accessible || accessible.has(field.key)) {
        known.push(field);
      }
    }
    const wanted = parsed.visibleFields ? new Set(parsed.visibleFields) : null;
    const fields = known.filter((field) => !wanted || wanted.has(field.key));
    const hiddenFields = known.filter(
      (field) => wanted && !wanted.has(field.key),
    );
    const visibleKeys = fields.map((field) => field.key);

    const requested = parsed.recordIds ? new Set(parsed.recordIds) : null;
    const selected = read.records.filter(
      (record) => !requested || requested.has(record.id),
    );
    const selectedIds = new Set(selected.map((record) => record.id));
    const records = selected.map((record): ExportDatasetRecord => {
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
    });
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

    const estimatedBytes = byteLength({
      customFieldDefinitions,
      records,
      relations,
    });
    if (estimatedBytes > EXPORT_MAX_BYTES) {
      throw new ExportError("limit_exceeded");
    }

    const manifest = {
      filters: parsed.filters,
      format: parsed.format,
      producedAt: now().toISOString(),
      recordCount: records.length,
      recordType,
      schemaVersion: EXPORT_SCHEMA_VERSION,
      scope: parsed.scope,
      visibleFields: visibleKeys,
    } satisfies ExportDataset["manifest"];
    return {
      dataset: {
        customFieldDefinitions,
        fields,
        manifest,
        records,
        relations,
      },
      preview: {
        estimatedBytes,
        fields,
        filters: parsed.filters,
        format: parsed.format,
        hiddenFields,
        limits: { maxBytes: EXPORT_MAX_BYTES, maxRows: EXPORT_MAX_ROWS },
        lost: LOSSES[parsed.format],
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
        fingerprint: await fingerprint(world),
        formatAvailable: Boolean(producers[world.preview.format]),
      };
    },

    async produce(accountId: string, input: ExportProduceInput) {
      const { previewFingerprint, ...request } =
        exportProduceInputSchema.parse(input);
      const world = await closeWorld(accountId, request);
      // No artifact exists before the founder confirmed this exact preview.
      if ((await fingerprint(world)) !== previewFingerprint) {
        throw new ExportError("preview_required");
      }
      const producer = producers[world.dataset.manifest.format];
      if (!producer) {
        throw new ExportError("format_unavailable");
      }
      const artifact = producer.produce(world.dataset);
      // The 25 MB cap holds for the finished bytes too, not only the estimate.
      if (
        new TextEncoder().encode(artifact.bytes).byteLength > EXPORT_MAX_BYTES
      ) {
        throw new ExportError("limit_exceeded");
      }
      return artifact;
    },
  };
}
