// biome-ignore-all lint/performance/noJsxPropsBind: Each artifact binds its own export handlers.
import type { MigrationArtifact } from "@cantiara/api/schema-migration-artifact";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

import { SqlOutput } from "./sql-output";

function ArtifactExport({ artifactId }: { artifactId: string }) {
  const exported = useQuery(
    orpc.migrationArtifactExport.queryOptions({ input: { artifactId } }),
  );
  return (
    <>
      {(exported.data?.files ?? []).map((file) => (
        <SqlOutput
          exported={file}
          key={file.filename}
          label={file.filename}
          sql={file.sql}
        />
      ))}
    </>
  );
}

function ArtifactItem({ artifact }: { artifact: MigrationArtifact }) {
  return (
    <li className="space-y-2 rounded-md border p-3">
      <p>
        <strong>{`Migration Artifact ${artifact.id}`}</strong>
        {` · ${artifact.source.name} → ${artifact.target.name} · ${artifact.createdAt}`}
      </p>
      <p className="break-all text-sm">
        {`Migration Artifact Digest ${artifact.digest}`}
      </p>
      <p className="text-sm">
        {`${artifact.staticValidation.label} · PostgreSQL ${artifact.staticValidation.postgresMajor} · ${artifact.generatorVersion}`}
      </p>
      {artifact.supersedes ? (
        <p className="text-sm">{`Supersedes Migration Artifact ${artifact.supersedes}`}</p>
      ) : null}
      {artifact.downSql === null && artifact.warningManifest.down ? (
        <div role="note">
          <p className="font-medium">{artifact.warningManifest.down.label}</p>
          <ul className="text-sm">
            {artifact.warningManifest.down.blockers.map((blocker) => (
              <li key={`${blocker.operation}:${blocker.path}`}>
                {`${blocker.operation} · ${blocker.path} — ${blocker.criterion}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ArtifactExport artifactId={artifact.id} />
    </li>
  );
}

/** Immutable artifacts of one Data Model diagram; they carry no applied state. */
export function ArtifactList({ diagramId }: { diagramId: string }) {
  const artifacts = useQuery(
    orpc.migrationArtifacts.queryOptions({ input: { diagramId } }),
  );
  if (!artifacts.data || artifacts.data.length === 0) {
    return null;
  }
  return (
    <section aria-label="Migration Artifacts" className="space-y-2">
      <h4 className="font-medium">Migration Artifacts</h4>
      <p className="text-muted-foreground text-sm">
        The product stores and exports these files. It never runs them.
      </p>
      <ol className="space-y-2">
        {artifacts.data.map((artifact) => (
          <ArtifactItem artifact={artifact} key={artifact.id} />
        ))}
      </ol>
    </section>
  );
}
