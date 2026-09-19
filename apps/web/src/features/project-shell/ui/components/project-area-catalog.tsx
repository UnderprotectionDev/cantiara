// biome-ignore-all lint/performance/noJsxPropsBind: Project area controls close over their current area state.
import {
  isProjectCoreArea,
  type ProjectArea,
  type ProjectShellConfiguration,
  type ProjectShellConfigurationChange,
} from "@cantiara/api/project-shell";
import { useCallback } from "react";

import { useProjectAreaEnable } from "@/features/project-shell/hooks/use-project-area-enable";
import { useProjectConfiguration } from "@/features/project-shell/hooks/use-project-configuration";
import { projectAreaCatalogAnchor } from "@/features/project-shell/lib/project-area-navigation";
import { ALL_PROJECT_AREAS } from "@/features/project-shell/lib/project-shell-navigation";
import {
  ProjectAreaAvailability,
  projectAreaAvailabilityLabel,
} from "./project-area-availability";

export default function ProjectAreaCatalog({
  baseRevision,
  configurationMode,
  configuration,
  projectId,
}: {
  baseRevision: number;
  configurationMode: boolean;
  configuration: ProjectShellConfiguration;
  projectId: string;
}) {
  const { error: enableError, mutation: enableProjectArea } =
    useProjectAreaEnable(projectId, baseRevision);
  const { error: configurationError, mutation: configurationMutation } =
    useProjectConfiguration(projectId, baseRevision);
  const requestEnableProjectArea = useCallback(
    (area: ProjectArea) => {
      enableProjectArea.mutate(area);
    },
    [enableProjectArea],
  );
  const requestConfigurationChange = useCallback(
    (change: ProjectShellConfigurationChange) => {
      configurationMutation.mutate(change);
    },
    [configurationMutation],
  );
  const requestReorderPinnedArea = useCallback(
    (area: ProjectArea, direction: -1 | 1) => {
      const currentIndex = configuration.extraPinnedAreas.indexOf(area);
      const nextIndex = currentIndex + direction;
      if (
        currentIndex < 0 ||
        nextIndex < 0 ||
        nextIndex >= configuration.extraPinnedAreas.length
      ) {
        return;
      }
      const areas = [...configuration.extraPinnedAreas];
      const [moved] = areas.splice(currentIndex, 1);
      if (!moved) {
        return;
      }
      areas.splice(nextIndex, 0, moved);
      requestConfigurationChange({ kind: "reorder-pinned-areas", areas });
    },
    [configuration.extraPinnedAreas, requestConfigurationChange],
  );
  const error = enableError ?? configurationError;
  const disabled =
    enableProjectArea.isPending || configurationMutation.isPending;

  return (
    <section
      className="rounded-lg border border-border/70 bg-card/35 py-6"
      id="all-tools"
    >
      <div className="max-w-2xl">
        <h2 className="font-semibold text-xl tracking-tight">All Tools</h2>
        <p className="mt-2 text-muted-foreground text-sm/relaxed">
          Every ready Project area stays discoverable here. Enabling an area
          does not create records or change another Project.
        </p>
      </div>
      {error ? (
        <p className="mt-4 text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <ul
        aria-label="All Project areas"
        className="mt-5 grid gap-x-8 border-border/70 border-y lg:grid-cols-2"
      >
        {ALL_PROJECT_AREAS.map((area) => {
          const enabled = configuration.enabledAreas.includes(area);
          const hidden = configuration.hiddenAreas.includes(area);
          const pinned =
            !isProjectCoreArea(area) &&
            configuration.extraPinnedAreas.includes(area);
          const pinnedIndex = configuration.extraPinnedAreas.indexOf(area);
          return (
            <li
              aria-label={`${area} ${projectAreaAvailabilityLabel(enabled, hidden)}`}
              className="flex items-center justify-between border-border/70 border-b px-3 py-3 text-sm last:border-b-0 lg:[&:nth-last-child(-n+2)]:border-b-0"
              id={projectAreaCatalogAnchor(area).slice(1)}
              key={area}
            >
              {area}
              <ProjectAreaAvailability
                area={area}
                configurationMode={configurationMode}
                disabled={disabled}
                enabled={enabled}
                hidden={hidden}
                onChange={requestConfigurationChange}
                onEnable={requestEnableProjectArea}
                onReorder={requestReorderPinnedArea}
                pinned={pinned}
                pinnedCount={configuration.extraPinnedAreas.length}
                pinnedIndex={pinnedIndex}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
