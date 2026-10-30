import type {
  ExportDataset,
  ExportFormatProducer,
} from "@cantiara/api/data-export";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * JSON dışa aktarma şeması (ADR-0005): the canonical structured round-trip
 * format. The envelope names its schema version first so an importer can
 * refuse an unknown version before reading anything else. Values are raw and
 * unescaped (CSV escaping never applies here); ordinary record history and the
 * live EU placement are not carried. The dataset is already secret-free.
 */
export const jsonExportProducer: ExportFormatProducer = {
  format: "JSON",
  produce(dataset: ExportDataset) {
    const { manifest } = dataset;
    const document = {
      schemaVersion: manifest.schemaVersion,
      manifest,
      fields: dataset.fields,
      customFieldDefinitions: dataset.customFieldDefinitions,
      records: dataset.records,
      relations: dataset.relations,
    };
    return {
      bytes: `${JSON.stringify(document, null, 2)}\n`,
      fileName: `cantiara-${slug(manifest.recordType)}-${manifest.producedAt.slice(0, 10)}.json`,
      manifest,
      mediaType: "application/json",
    };
  },
};
