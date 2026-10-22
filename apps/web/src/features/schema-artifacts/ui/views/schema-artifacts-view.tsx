// biome-ignore-all lint/performance/noJsxPropsBind: The surface binds its own version selection.
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";

import { ChangeDraft } from "../components/change-draft";
import { DdlPreview } from "../components/ddl-preview";

function DataModelArtifacts({ diagram }: { diagram: TechnicalDiagramSource }) {
  const versions = useQuery(
    orpc.technicalDiagramVersions.queryOptions({
      input: { diagramId: diagram.id },
    }),
  );
  const [versionId, setVersionId] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  return (
    <article className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">{diagram.title}</h3>
      <p className="text-muted-foreground text-sm">
        Choose an exact Diagram Version. The live diagram is never used.
      </p>
      {versions.data?.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Create a Diagram Version in Technical Diagrams first.
        </p>
      ) : null}
      <ol aria-label="Diagram Versions" className="space-y-1">
        {(versions.data ?? []).map((version) => (
          <li key={version.id}>
            <Button
              aria-pressed={versionId === version.id}
              onClick={() => setVersionId(version.id)}
              size="sm"
              type="button"
              variant={versionId === version.id ? "default" : "outline"}
            >
              {`Preview DDL for ${version.name} · version ${version.number}`}
            </Button>
          </li>
        ))}
      </ol>
      {versionId ? <DdlPreview versionId={versionId} /> : null}
      <section
        aria-label="Choose versions for a Schema Change Draft"
        className="space-y-2"
      >
        <h4 className="font-medium">Schema Change Draft</h4>
        <p className="text-muted-foreground text-sm">
          Pick a source and a target Diagram Version of this diagram.
        </p>
        {(versions.data ?? []).map((version) => (
          <div className="flex flex-wrap gap-2" key={version.id}>
            <Button
              aria-pressed={sourceId === version.id}
              onClick={() => setSourceId(version.id)}
              size="sm"
              type="button"
              variant={sourceId === version.id ? "default" : "outline"}
            >
              {`Use ${version.name} (version ${version.number}) as source`}
            </Button>
            <Button
              aria-pressed={targetId === version.id}
              onClick={() => setTargetId(version.id)}
              size="sm"
              type="button"
              variant={targetId === version.id ? "default" : "outline"}
            >
              {`Use ${version.name} (version ${version.number}) as target`}
            </Button>
          </div>
        ))}
        {sourceId && targetId && sourceId !== targetId ? (
          <ChangeDraft
            key={`${sourceId}:${targetId}`}
            sourceVersionId={sourceId}
            targetVersionId={targetId}
          />
        ) : null}
      </section>
    </article>
  );
}

export default function SchemaArtifactsView({
  projectId,
  selectedDiagramId,
}: {
  projectId: string;
  selectedDiagramId?: string;
}) {
  const diagrams = useQuery(
    orpc.technicalDiagrams.queryOptions({ input: { projectId } }),
  );
  const dataModels = (diagrams.data ?? []).filter(
    ({ id, type }) =>
      type === "Data Model" && (!selectedDiagramId || id === selectedDiagramId),
  );
  return (
    <section aria-label="Schema Artifacts" className="space-y-4">
      <h2 className="font-semibold text-lg">Schema Artifacts</h2>
      <p className="text-muted-foreground text-sm">
        PostgreSQL DDL from an exact Data Model Diagram Version. The product
        takes no database credential and never connects to a live target.
      </p>
      {dataModels.length === 0 ? (
        <p>No Data Model diagram yet. Model one in Technical Diagrams.</p>
      ) : null}
      {dataModels.map((diagram) => (
        <DataModelArtifacts diagram={diagram} key={diagram.id} />
      ))}
    </section>
  );
}
