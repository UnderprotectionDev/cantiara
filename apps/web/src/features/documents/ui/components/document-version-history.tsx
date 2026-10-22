// biome-ignore-all lint/performance/noJsxPropsBind: Document controls close over the selected record and current editor state.
import type { Document } from "@cantiara/api/documents";
import { Button } from "@cantiara/ui/components/button";
import DocumentVersionCompare from "./document-version-compare";

export default function DocumentVersionHistory({
  versions,
  selectedVersionQuery,
  selectedVersion,
  record,
  setSelectedVersion,
  selectedSnapshot,
  revision,
  restore,
  form,
}: {
  versions: import("@tanstack/react-query").UseQueryResult<
    {
      type: "Persona" | "General" | "PRD" | "Plan" | "Spec" | "Research Note";
      id: string;
      createdAt: string;
      revision: number;
      title: string;
      updatedAt: string;
    }[],
    Error
  >;
  selectedVersionQuery: import("@tanstack/react-query").UseQueryResult<
    Document,
    Error
  >;
  selectedVersion: number | null;
  record: Document;
  setSelectedVersion: import("react").Dispatch<
    import("react").SetStateAction<number | null>
  >;
  selectedSnapshot: Document | undefined;
  revision: number;
  restore: import("@tanstack/react-query").UseMutationResult<
    Document,
    Error,
    number,
    unknown
  >;
  form: {
    getFieldValue: (name: "body") => string;
    state: { isDirty: boolean };
  };
}) {
  return (
    <section
      aria-label="Versions"
      className="space-y-3 border-border border-t pt-5"
    >
      <h3 className="font-semibold">Versions</h3>
      {versions.isError || selectedVersionQuery.isError ? (
        <p role="alert">Versions could not be loaded.</p>
      ) : null}
      {selectedVersion !== null &&
      selectedVersion !== record.revision &&
      selectedVersionQuery.isPending ? (
        <p role="status">Loading…</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {versions.data?.map((version) => (
          <Button
            aria-pressed={selectedVersion === version.revision}
            key={version.revision}
            onClick={() => setSelectedVersion(version.revision)}
            type="button"
            variant={
              selectedVersion === version.revision ? "secondary" : "outline"
            }
          >
            Version {version.revision}
          </Button>
        ))}
      </div>
      {selectedSnapshot ? (
        <DocumentVersionCompare
          current={{ ...record, revision }}
          onRestore={() => restore.mutate(selectedSnapshot.revision)}
          pending={restore.isPending}
          selected={selectedSnapshot}
          unsavedChanges={form.state.isDirty}
        />
      ) : null}
    </section>
  );
}
