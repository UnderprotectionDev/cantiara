// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface state.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ArchivedProjectEntry } from "@cantiara/api/project-retirement";
import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import {
  useArchivedProjects,
  useRetirementTransition,
} from "../../hooks/use-project-retirement";
import { ArchiveView } from "../views/archive-view";

/** The Archive route surface: archived Projects and `Unarchive`. */
export default function ArchiveSurface() {
  const archived = useArchivedProjects();
  const transition = useRetirementTransition();
  const preferences = useQuery(orpc.accountPreferences.queryOptions());

  return (
    <ArchiveView
      error={archived.isError}
      errorMessage={
        transition.isError ? "Unarchive did not complete. Try again." : null
      }
      formatting={preferences.data ?? DEFAULT_ACCOUNT_PREFERENCES}
      loading={archived.isPending}
      onUnarchive={(entry: ArchivedProjectEntry) =>
        transition.mutate({
          action: "unarchive",
          baseRevision: entry.project.revision,
          projectId: entry.project.id,
        })
      }
      pendingProjectId={
        transition.isPending ? transition.variables?.projectId : null
      }
      projects={archived.data?.projects ?? []}
    />
  );
}
