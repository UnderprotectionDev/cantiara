import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  buildProjectOverview,
  type ProjectOverviewSources,
} from "@cantiara/api/project-overview";
import type { ProjectProfile } from "@cantiara/api/project-shell";

import {
  DEFAULT_OVERVIEW_FORMATTING_PREFERENCES,
  normalizeFormattingPreferences,
} from "../../lib/project-overview";
import {
  EnabledProjectAreas,
  OverviewModule,
  OverviewSummary,
} from "./project-overview-sections";

type OverviewFormattingPreferences = AccountPreferences;

export interface ProjectOverviewViewProps {
  accountFormattingPreferences?: OverviewFormattingPreferences;
  project: ProjectProfile;
  sources?: ProjectOverviewSources;
}

export default function ProjectOverviewView({
  accountFormattingPreferences = DEFAULT_OVERVIEW_FORMATTING_PREFERENCES,
  project,
  sources = {},
}: ProjectOverviewViewProps) {
  const overview = buildProjectOverview(project, sources);
  const formattingPreferences = normalizeFormattingPreferences(
    accountFormattingPreferences,
  );

  return (
    <section
      aria-labelledby="project-overview-heading"
      className="space-y-8"
      data-project-overview="true"
      id="overview"
    >
      <header className="surface-header max-w-3xl">
        <h2
          className="text-balance font-semibold text-2xl tracking-tight sm:text-3xl"
          id="project-overview-heading"
        >
          Overview
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground text-sm/relaxed">
          A neutral view of this Project’s source records. Empty sections stay
          empty until a source record exists.
        </p>
      </header>

      <div className="grid gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 sm:grid-cols-2">
        <OverviewSummary
          emptyMessage="No Purpose recorded yet."
          label="Purpose"
          value={overview.purpose}
        />
        <OverviewSummary label="Lifecycle" value={overview.lifecycle} />
      </div>

      <EnabledProjectAreas areas={overview.enabledAreas} />

      <div className="grid items-start overflow-hidden rounded-lg border border-border/70 bg-border/70 md:grid-cols-2">
        {overview.modules.map((module) => (
          <OverviewModule
            formattingPreferences={formattingPreferences}
            key={module.name}
            module={module}
            overview={overview}
          />
        ))}
      </div>
    </section>
  );
}
