// biome-ignore-all lint/performance/noJsxPropsBind: Configuration controls close over their current stage, status, or area.
import {
  getStarterConfigurationDefinition,
  isProjectCoreArea,
  PROJECT_STAGE_STATUS_OPTIONS,
  type ProjectArea,
  type ProjectShellConfiguration,
  type ProjectShellConfigurationChange,
  type StarterConfiguration,
} from "@cantiara/api/project-shell";
import { Badge } from "@cantiara/ui/components/badge";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { type FormEvent, useCallback, useState } from "react";
import CustomFieldEditor from "@/features/custom-fields/ui/components/custom-field-editor";
import PriorityMetricEditor from "@/features/priority-metrics/ui/components/priority-metric-editor";
import { useProjectAreaEnable } from "@/features/project-shell/hooks/use-project-area-enable";
import { useProjectConfiguration } from "@/features/project-shell/hooks/use-project-configuration";
import {
  ALL_PROJECT_AREAS,
  CONFIGURATION_HOSTS,
  type ConfigurationHost,
  configurationHostId,
} from "@/features/project-shell/lib/project-shell-navigation";
import {
  ProjectAreaAvailability,
  projectAreaAvailabilityLabel,
} from "@/features/project-shell/ui/components/project-area-availability";
import RecordActionEditor from "@/features/record-actions/ui/components/record-action-editor";
import WorkContextCardLayoutEditor from "@/features/work-context/ui/components/work-context-card-layout-editor";
import WorkTemplateEditor from "@/features/work-templates/ui/components/work-template-editor";

export default function ProjectConfigurationForm({
  baseRevision,
  configuration,
  configurationHost,
  onConfigurationHostChange,
  projectId,
  projectName,
  starterConfiguration,
}: {
  baseRevision: number;
  configuration: ProjectShellConfiguration;
  configurationHost: ConfigurationHost | null;
  onConfigurationHostChange: (host: ConfigurationHost | null) => void;
  projectId: string;
  projectName: string;
  starterConfiguration: StarterConfiguration;
}) {
  const { error, mutation } = useProjectConfiguration(projectId, baseRevision);
  const { error: enableError, mutation: enableProjectArea } =
    useProjectAreaEnable(projectId, baseRevision);
  const [restorePreviewOpen, setRestorePreviewOpen] = useState(false);
  const defaultPinnedAreas =
    getStarterConfigurationDefinition(starterConfiguration).extraPinnedAreas;
  const requestEnableProjectArea = useCallback(
    (area: ProjectArea) => {
      enableProjectArea.mutate(area);
    },
    [enableProjectArea],
  );
  const requestConfigurationChange = useCallback(
    (change: ProjectShellConfigurationChange) => {
      mutation.mutate(change);
    },
    [mutation],
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
  const combinedError = enableError ?? error;
  const disabled = enableProjectArea.isPending || mutation.isPending;

  return (
    <section
      aria-label="Configuration Mode"
      className="mt-6 space-y-6 rounded-lg border border-border/80 bg-card/55 p-5 shadow-sm sm:p-6"
    >
      <header className="max-w-3xl border-border/70 border-b pb-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Configuration Mode</Badge>
        </div>
        <h2 className="mt-3 font-semibold text-xl tracking-tight">
          Configuration Mode
        </h2>
        <p className="mt-2 text-muted-foreground text-sm/relaxed">
          Structure changes stay separate from daily content editing. Entering
          this mode does not change records, view membership, or Project
          lifecycle.
        </p>
      </header>

      <div>
        <h3
          className="font-medium text-base"
          id="configuration-project-areas-heading"
        >
          Project areas
        </h3>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm/relaxed">
          Enable and arrange ready Project areas from the selected host below.
          These controls change presentation metadata only and do not create
          records.
        </p>
        <Button
          className="mt-4"
          disabled={disabled}
          onClick={() => setRestorePreviewOpen(true)}
          type="button"
          variant="outline"
        >
          Restore default navigation
        </Button>
        {restorePreviewOpen ? (
          <div
            aria-label="Navigation preview"
            className="mt-4 space-y-3 border bg-background p-4 text-sm"
            role="status"
          >
            <p className="font-medium">Navigation preview</p>
            <p className="text-muted-foreground">
              Current pinned areas:{" "}
              {configuration.extraPinnedAreas.join(", ") || "None"}
            </p>
            <p className="text-muted-foreground">
              Default pinned areas: {defaultPinnedAreas.join(", ") || "None"}
            </p>
            <ConfigurationMutationError error={combinedError} />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={disabled}
                onClick={() =>
                  mutation.mutate(
                    { kind: "restore-default-navigation" },
                    { onSuccess: () => setRestorePreviewOpen(false) },
                  )
                }
                size="xs"
                type="button"
              >
                Confirm
              </Button>
              <Button
                disabled={disabled}
                onClick={() => setRestorePreviewOpen(false)}
                size="xs"
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <h3
          className="font-medium text-sm"
          id="configuration-entry-points-heading"
        >
          Configuration Mode
        </h3>
        <div className="mt-3 grid items-start gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <nav
            aria-label="Configuration Mode"
            className="grid gap-1 rounded-md border border-border/70 bg-background/55 p-1"
          >
            {CONFIGURATION_HOSTS.map(({ description, label }) => (
              <div className="group" key={label}>
                <ConfigurationHostButton
                  isOpen={configurationHost === label}
                  label={label}
                  onChange={onConfigurationHostChange}
                />
                <p className="px-3 pb-2 text-[0.68rem]/relaxed text-muted-foreground lg:hidden">
                  {description}
                </p>
              </div>
            ))}
          </nav>
          <div className="min-w-0 rounded-md border border-border/70 bg-background/55 p-4 sm:p-5">
            {configurationHost ? (
              <ConfigurationHostPanel
                baseRevision={baseRevision}
                configuration={configuration}
                disabled={disabled}
                error={combinedError}
                label={configurationHost}
                onChange={mutation.mutate}
                onEnableProjectArea={requestEnableProjectArea}
                onReorderPinnedArea={requestReorderPinnedArea}
                projectId={projectId}
                projectName={projectName}
              />
            ) : (
              <div className="flex min-h-32 items-center">
                <p className="max-w-md text-muted-foreground text-sm/relaxed">
                  Choose a surface to inspect its Project-level controls. Daily
                  Work editing stays outside this mode.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfigurationHostButton({
  isOpen,
  label,
  onChange,
}: {
  isOpen: boolean;
  label: ConfigurationHost;
  onChange: (host: ConfigurationHost | null) => void;
}) {
  const handleClick = useCallback(
    () => onChange(isOpen ? null : label),
    [isOpen, label, onChange],
  );

  return (
    <Button
      aria-controls={isOpen ? configurationHostId(label) : undefined}
      aria-expanded={isOpen}
      className="w-full justify-start"
      onClick={handleClick}
      type="button"
      variant={isOpen ? "secondary" : "ghost"}
    >
      {label}
    </Button>
  );
}

function ConfigurationHostPanel({
  baseRevision,
  configuration,
  disabled,
  error,
  label,
  onChange,
  onEnableProjectArea,
  onReorderPinnedArea,
  projectId,
  projectName,
}: {
  baseRevision: number;
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  label: ConfigurationHost;
  onChange: (change: ProjectShellConfigurationChange) => void;
  onEnableProjectArea: (area: ProjectArea) => void;
  onReorderPinnedArea: (area: ProjectArea, direction: -1 | 1) => void;
  projectId: string;
  projectName: string;
}) {
  const host = CONFIGURATION_HOSTS.find(
    (candidate) => candidate.label === label,
  );
  const hostId = configurationHostId(label);

  if (!host) {
    return null;
  }

  return (
    <section
      aria-labelledby={`${hostId}-heading`}
      className="mt-4 border-t pt-4 text-sm"
      id={hostId}
    >
      <h4 className="font-medium text-foreground" id={`${hostId}-heading`}>
        {label}
      </h4>
      <ConfigurationHostContent
        baseRevision={baseRevision}
        configuration={configuration}
        disabled={disabled}
        error={error}
        label={label}
        message={host.message}
        onChange={onChange}
        onEnableProjectArea={onEnableProjectArea}
        onReorderPinnedArea={onReorderPinnedArea}
        projectId={projectId}
        projectName={projectName}
      />
    </section>
  );
}

function ConfigurationHostContent({
  baseRevision,
  configuration,
  disabled,
  error,
  label,
  message,
  onChange,
  onEnableProjectArea,
  onReorderPinnedArea,
  projectId,
  projectName,
}: {
  baseRevision: number;
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  label: ConfigurationHost;
  message: string;
  onChange: (change: ProjectShellConfigurationChange) => void;
  onEnableProjectArea: (area: ProjectArea) => void;
  onReorderPinnedArea: (area: ProjectArea, direction: -1 | 1) => void;
  projectId: string;
  projectName: string;
}) {
  switch (label) {
    case "Stages":
      return (
        <StagesConfiguration
          configuration={configuration}
          disabled={disabled}
          error={error}
          onChange={onChange}
        />
      );
    case "Work statuses":
      return (
        <WorkStatusesConfiguration
          configuration={configuration}
          disabled={disabled}
          error={error}
          onChange={onChange}
        />
      );
    case "Project areas":
      return (
        <ProjectAreasConfiguration
          configuration={configuration}
          disabled={disabled}
          error={error}
          message={message}
          onChange={onChange}
          onEnableProjectArea={onEnableProjectArea}
          onReorderPinnedArea={onReorderPinnedArea}
        />
      );
    case "Custom field":
      return <CustomFieldEditor disabled={disabled} projectId={projectId} />;
    case "Priority metrics":
      return (
        <PriorityMetricEditor
          disabled={disabled}
          projectId={projectId}
          projectName={projectName}
        />
      );
    case "Work Template":
      return <WorkTemplateEditor disabled={disabled} projectId={projectId} />;
    case "Record Action":
      return <RecordActionEditor disabled={disabled} projectId={projectId} />;
    case "Work Context Card layout":
      return (
        <WorkContextCardLayoutEditor
          baseRevision={baseRevision}
          configuration={configuration}
          disabled={disabled}
          error={error}
          projectId={projectId}
        />
      );
    default:
      return <p className="mt-1">{message}</p>;
  }
}

function ProjectAreasConfiguration({
  configuration,
  disabled,
  error,
  message,
  onChange,
  onEnableProjectArea,
  onReorderPinnedArea,
}: {
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  message: string;
  onChange: (change: ProjectShellConfigurationChange) => void;
  onEnableProjectArea: (area: ProjectArea) => void;
  onReorderPinnedArea: (area: ProjectArea, direction: -1 | 1) => void;
}) {
  return (
    <div className="mt-3 space-y-4">
      <p className="text-muted-foreground text-xs/relaxed">{message}</p>
      <ConfigurationMutationError error={error} />
      <ul
        aria-label="Project areas"
        className="grid divide-y rounded-md border border-border/70 bg-card/45 lg:grid-cols-2 lg:divide-y-0"
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
              className="flex items-center justify-between border-border/70 border-b px-3 py-3 text-sm last:border-b-0 lg:[&:nth-child(odd)]:border-r lg:[&:nth-last-child(-n+2)]:border-b-0"
              key={area}
            >
              <span>{area}</span>
              <ProjectAreaAvailability
                area={area}
                configurationMode
                disabled={disabled}
                enabled={enabled}
                hidden={hidden}
                onChange={onChange}
                onEnable={onEnableProjectArea}
                onReorder={onReorderPinnedArea}
                pinned={pinned}
                pinnedCount={configuration.extraPinnedAreas.length}
                pinnedIndex={pinnedIndex}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ConfigurationMutationError({ error }: { error: string | null }) {
  return error ? (
    <p className="mt-3 text-destructive text-sm" role="alert">
      {error}
    </p>
  ) : null;
}

function StagesConfiguration({
  configuration,
  disabled,
  error,
  onChange,
}: {
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  onChange: (change: ProjectShellConfigurationChange) => void;
}) {
  const [stageName, setStageName] = useState("");
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [pendingStageRemovalId, setPendingStageRemovalId] = useState<
    string | null
  >(null);

  function addStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = stageName.trim();
    if (!name) {
      return;
    }
    onChange({ kind: "add-stage", name });
    setStageName("");
  }

  function renameStage(stageId: string, currentName: string) {
    const name = (draftNames[stageId] ?? currentName).trim();
    if (!name || name === currentName) {
      return;
    }
    onChange({ kind: "rename-stage", name, stageId });
  }

  function reorderStage(stageId: string, direction: -1 | 1) {
    const currentIndex = configuration.preparedStages.findIndex(
      (stage) => stage.id === stageId,
    );
    const nextIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= configuration.preparedStages.length
    ) {
      return;
    }
    const stageIds = configuration.preparedStages.map((stage) => stage.id);
    const [moved] = stageIds.splice(currentIndex, 1);
    if (!moved) {
      return;
    }
    stageIds.splice(nextIndex, 0, moved);
    onChange({ kind: "reorder-stages", stageIds });
  }

  return (
    <div className="mt-3 space-y-4">
      <p className="text-muted-foreground text-xs/relaxed">
        Stages are independent presentation metadata. Several stages can be
        Active at once, and removing one does not delete main records.
      </p>
      <form className="flex flex-wrap items-end gap-2" onSubmit={addStage}>
        <label className="grid gap-1 text-xs" htmlFor="new-project-stage">
          Stage name
          <Input
            disabled={disabled}
            id="new-project-stage"
            onChange={(event) => setStageName(event.target.value)}
            value={stageName}
          />
        </label>
        <Button
          disabled={disabled || !stageName.trim()}
          size="xs"
          type="submit"
        >
          Add stage
        </Button>
      </form>
      <ConfigurationMutationError error={error} />
      <ul aria-label="Stages configuration" className="space-y-2">
        {configuration.preparedStages.map((stage, index) => (
          <li className="border bg-background p-3" key={stage.id}>
            <div className="flex flex-wrap items-end gap-2">
              <label
                className="grid min-w-44 flex-1 gap-1 text-xs"
                htmlFor={`stage-name-${stage.id}`}
              >
                Stage name
                <Input
                  aria-label={`Stage name ${stage.name}`}
                  disabled={disabled}
                  id={`stage-name-${stage.id}`}
                  onChange={(event) =>
                    setDraftNames((current) => ({
                      ...current,
                      [stage.id]: event.target.value,
                    }))
                  }
                  value={draftNames[stage.id] ?? stage.name}
                />
              </label>
              <Button
                disabled={disabled}
                onClick={() => renameStage(stage.id, stage.name)}
                size="xs"
                type="button"
                variant="outline"
              >
                Save
              </Button>
              <label
                className="grid gap-1 text-xs"
                htmlFor={`stage-status-${stage.id}`}
              >
                Status
                <NativeSelect
                  aria-label={`${stage.name} status`}
                  disabled={disabled}
                  id={`stage-status-${stage.id}`}
                  onChange={(event) =>
                    onChange({
                      kind: "set-stage-status",
                      stageId: stage.id,
                      status: event.target
                        .value as (typeof PROJECT_STAGE_STATUS_OPTIONS)[number],
                    })
                  }
                  value={stage.status}
                >
                  {PROJECT_STAGE_STATUS_OPTIONS.map((status) => (
                    <NativeSelectOption key={status} value={status}>
                      {status}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </label>
              <Button
                aria-label={`Move up ${stage.name}`}
                disabled={disabled || index === 0}
                onClick={() => reorderStage(stage.id, -1)}
                size="xs"
                type="button"
                variant="ghost"
              >
                ↑
              </Button>
              <Button
                aria-label={`Move down ${stage.name}`}
                disabled={
                  disabled || index === configuration.preparedStages.length - 1
                }
                onClick={() => reorderStage(stage.id, 1)}
                size="xs"
                type="button"
                variant="ghost"
              >
                ↓
              </Button>
              {pendingStageRemovalId === stage.id ? (
                <Button
                  aria-label="Remove stage"
                  disabled={disabled}
                  onClick={() => {
                    onChange({ kind: "remove-stage", stageId: stage.id });
                    setPendingStageRemovalId(null);
                  }}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Remove stage
                </Button>
              ) : (
                <Button
                  aria-label="Remove stage"
                  disabled={disabled}
                  onClick={() => setPendingStageRemovalId(stage.id)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  Remove stage
                </Button>
              )}
            </div>
            {pendingStageRemovalId === stage.id ? (
              <div className="mt-3 space-y-2" role="status">
                <p className="text-muted-foreground text-xs/relaxed">
                  {stage.name} will leave presentation and filters. Main records
                  are not deleted.
                </p>
                <Button
                  disabled={disabled}
                  onClick={() => setPendingStageRemovalId(null)}
                  size="xs"
                  type="button"
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {configuration.preparedStages.length === 0 ? (
        <p className="text-muted-foreground text-sm">No stages prepared.</p>
      ) : null}
    </div>
  );
}

function WorkStatusesConfiguration({
  configuration,
  disabled,
  error,
  onChange,
}: {
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  onChange: (change: ProjectShellConfigurationChange) => void;
}) {
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});

  return (
    <div className="mt-3 space-y-4">
      <p className="text-muted-foreground text-xs/relaxed">
        Rename the visible labels while the four protected Work status semantics
        remain fixed. New status values cannot be added here.
      </p>
      <ConfigurationMutationError error={error} />
      <ul aria-label="Work status configuration" className="space-y-2">
        {configuration.workStatusLabels.map((status) => (
          <li
            className="flex flex-wrap items-end gap-2 border bg-background p-3"
            key={status.semantic}
          >
            <span className="pb-2 font-medium text-xs">{status.semantic}</span>
            <label
              className="grid min-w-44 flex-1 gap-1 text-xs"
              htmlFor={`work-status-label-${status.semantic}`}
            >
              Visible label
              <Input
                aria-label={`Work status label ${status.semantic}`}
                disabled={disabled}
                id={`work-status-label-${status.semantic}`}
                onChange={(event) =>
                  setDraftLabels((current) => ({
                    ...current,
                    [status.semantic]: event.target.value,
                  }))
                }
                value={draftLabels[status.semantic] ?? status.label}
              />
            </label>
            <Button
              disabled={
                disabled ||
                !(draftLabels[status.semantic] ?? status.label).trim() ||
                (draftLabels[status.semantic] ?? status.label).trim() ===
                  status.label
              }
              onClick={() =>
                onChange({
                  kind: "rename-work-status",
                  label: (draftLabels[status.semantic] ?? status.label).trim(),
                  semantic: status.semantic,
                })
              }
              size="xs"
              type="button"
              variant="outline"
            >
              Save
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
