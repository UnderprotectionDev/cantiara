import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  PROJECT_UPDATE_LABEL,
  PROJECT_UPDATES_LABEL,
  type ProjectUpdate,
  type ProjectUpdateSnapshot,
} from "@cantiara/api/project-updates";
import type { ProjectUpdateLinkCandidate } from "../../lib/project-update-form";
import { ProjectUpdateList } from "../components/project-update-list";
import { ProjectUpdateSummary } from "../components/project-update-summary";
import {
  ProjectUpdateForm,
  type ProjectUpdateFormSubmit,
} from "../forms/project-update-form";
import {
  type ProjectUpdateReminderControls,
  ProjectUpdateReminderForm,
} from "../forms/project-update-reminder-form";

/**
 * Project Updates: the live summary blocks, the form that freezes them at
 * save, and the dated chronology. The surface shows no Project-level health;
 * only the founder's own dated marks.
 */
export function ProjectUpdatesView({
  candidates,
  formatting,
  liveSummary,
  onCreate,
  projectId,
  readOnly,
  reminder,
  updates,
}: {
  candidates: readonly ProjectUpdateLinkCandidate[];
  formatting: AccountPreferences;
  liveSummary: ProjectUpdateSnapshot;
  onCreate: (values: ProjectUpdateFormSubmit) => Promise<unknown>;
  projectId: string;
  readOnly: boolean;
  /** The optional reminder; absent until it has loaded. */
  reminder?: ProjectUpdateReminderControls;
  updates: readonly ProjectUpdate[];
}) {
  return (
    <section aria-label={PROJECT_UPDATES_LABEL} className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">{PROJECT_UPDATES_LABEL}</p>
        <h2 className="text-2xl font-semibold tracking-tight">
          {PROJECT_UPDATE_LABEL}
        </h2>
      </header>
      {readOnly ? (
        <p className="text-sm text-muted-foreground">
          This Project is archived. Its {PROJECT_UPDATES_LABEL} are read-only.
        </p>
      ) : (
        <>
          <section aria-label="Summary now" className="space-y-2">
            <h3 className="font-medium">Summary now</h3>
            <p className="text-sm text-muted-foreground">
              These blocks are saved with the update exactly as shown.
            </p>
            <ProjectUpdateSummary snapshot={liveSummary} />
          </section>
          {reminder ? <ProjectUpdateReminderForm {...reminder} /> : null}
          <ProjectUpdateForm candidates={candidates} onSubmit={onCreate} />
        </>
      )}
      <ProjectUpdateList
        formatting={formatting}
        projectId={projectId}
        updates={updates}
      />
    </section>
  );
}
