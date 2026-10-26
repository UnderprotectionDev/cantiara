import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { projectSourceRecordFromHash } from "@/features/project-shell/lib/project-shell-navigation";
import { ProductionIncidentSurface } from "../components/production-incident-surface";
import { ProductionIncidentsSurface } from "../components/production-incidents-surface";

/** The project `Production` area: the incident list, or one incident's detail. */
export default function ProductionIncidentsView({
  formatting,
  hash,
  projectId,
}: {
  formatting: AccountPreferences;
  hash: string;
  projectId: string;
}) {
  const source = projectSourceRecordFromHash(hash);
  if (source?.sourceType === "Production Incident") {
    return (
      <ProductionIncidentSurface
        formatting={formatting}
        incidentId={source.sourceId}
        key={`${projectId}:${source.sourceId}`}
        projectId={projectId}
      />
    );
  }
  return (
    <ProductionIncidentsSurface
      formatting={formatting}
      key={projectId}
      projectId={projectId}
    />
  );
}
