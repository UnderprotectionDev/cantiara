import type { AccountPreferences } from "@cantiara/api/account-preferences";
import { projectSourceRecordFromHash } from "@/features/project-shell/lib/project-shell-navigation";
import { ProjectReleasePlanningSurface } from "../components/project-release-planning-surface";
import { ProjectReleasesSurface } from "../components/project-releases-surface";

/** The project `Releases` area: the overview, or one release's Planning detail. */
export default function ProjectReleasesView({
  formatting,
  hash,
  projectId,
}: {
  formatting: AccountPreferences;
  hash: string;
  projectId: string;
}) {
  const source = projectSourceRecordFromHash(hash);
  if (source?.sourceType === "Project Release") {
    return (
      <ProjectReleasePlanningSurface
        key={`${projectId}:${source.sourceId}`}
        projectId={projectId}
        releaseId={source.sourceId}
      />
    );
  }
  return (
    <ProjectReleasesSurface
      formatting={formatting}
      key={projectId}
      projectId={projectId}
    />
  );
}
