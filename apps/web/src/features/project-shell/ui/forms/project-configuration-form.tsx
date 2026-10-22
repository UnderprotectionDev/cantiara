// biome-ignore-all lint/performance/noJsxPropsBind: Configuration controls close over their current stage, status, or area.
import {
  getStarterConfigurationDefinition,
  isProjectCoreArea,
  PROJECT_STAGE_STATUS_OPTIONS,
  type ProjectArea,
  type ProjectShellConfiguration,
  type ProjectShellConfigurationChange,
  projectShellConfigurationChangeSchema,
  type StarterConfiguration,
} from "@cantiara/api/project-shell";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useCallback, useState } from "react";
import CustomFieldEditor from "@/components/custom-field-editor-form";
import RecordActionEditor from "@/components/record-action-form";
import PriorityMetricEditor from "@/features/priority-metrics/ui/components/priority-metric-editor";
import { useProjectAreaEnable } from "@/features/project-shell/hooks/use-project-area-enable";
import { useProjectConfiguration } from "@/features/project-shell/hooks/use-project-configuration";
import {
  ALL_PROJECT_AREAS,
  CONFIGURATION_HOST_GROUPS,
  CONFIGURATION_HOSTS,
  CONFIGURATION_MODE_HASH,
  type ConfigurationHost,
  type ConfigurationHostGroup,
  configurationHostId,
} from "@/features/project-shell/lib/project-shell-navigation";
import {
  ProjectAreaAvailability,
  projectAreaAvailabilityLabel,
} from "@/features/project-shell/ui/components/project-area-availability";
import WorkContextCardLayoutEditor from "@/features/work-context/ui/components/work-context-card-layout-editor";
import WorkTemplateEditor from "@/features/work-templates/ui/components/work-template-editor";

function submitConfigurationChange(
  change: ProjectShellConfigurationChange,
  onChange: (change: ProjectShellConfigurationChange) => void,
) {
  if (!projectShellConfigurationChangeSchema.safeParse(change).success) {
    return false;
  }
  onChange(change);
  return true;
}

function handleFormSubmit(form: { handleSubmit: () => Promise<void> }) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  };
}

interface ProjectAreasNavigationPreview {
  defaultPinnedAreas: readonly ProjectArea[];
  onRestoreDefaultNavigation: () => void;
  onRestorePreviewOpenChange: (open: boolean) => void;
  restorePreviewOpen: boolean;
}

function configurationHostsForGroup(group: ConfigurationHostGroup) {
  return CONFIGURATION_HOSTS.filter((host) => host.group === group);
}

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
  const requestRestoreDefaultNavigation = useCallback(() => {
    mutation.mutate(
      { kind: "restore-default-navigation" },
      { onSuccess: () => setRestorePreviewOpen(false) },
    );
  }, [mutation]);
  const projectAreasNavigationPreview: ProjectAreasNavigationPreview = {
    defaultPinnedAreas,
    onRestoreDefaultNavigation: requestRestoreDefaultNavigation,
    onRestorePreviewOpenChange: setRestorePreviewOpen,
    restorePreviewOpen,
  };
  const combinedError = enableError ?? error;
  const disabled = enableProjectArea.isPending || mutation.isPending;

  return (
    <section
      aria-label="Configuration Mode"
      className="mt-6 space-y-8 border-border/70 border-y py-6"
      id={CONFIGURATION_MODE_HASH}
    >
      <header className="max-w-3xl border-border/70 border-b pb-5">
        <h2 className="font-semibold text-2xl tracking-tight">
          Configuration Mode
        </h2>
        <p className="mt-2 text-muted-foreground text-sm/relaxed">
          Structure changes stay separate from daily content editing. Entering
          this mode does not change records, view membership, or Project
          lifecycle.
        </p>
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="lg:hidden">
            <label className="sr-only" htmlFor="configuration-host-selector">
              Configuration Mode
            </label>
            <NativeSelect
              className="min-h-11 w-full"
              id="configuration-host-selector"
              onChange={(event) => {
                const selected = CONFIGURATION_HOSTS.find(
                  (host) => host.label === event.target.value,
                );
                onConfigurationHostChange(selected?.label ?? null);
              }}
              value={configurationHost ?? ""}
            >
              <NativeSelectOption value="">
                Choose a surface to inspect its Project-level controls
              </NativeSelectOption>
              {CONFIGURATION_HOST_GROUPS.map((group) => (
                <optgroup key={group} label={group}>
                  {configurationHostsForGroup(group).map(({ label }) => (
                    <NativeSelectOption key={label} value={label}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </optgroup>
              ))}
            </NativeSelect>
          </div>
          <div className="hidden space-y-5 lg:block">
            {CONFIGURATION_HOST_GROUPS.map((group) => (
              <fieldset className="min-w-0 space-y-2 border-0 p-0" key={group}>
                <legend className="surface-kicker px-3">{group}</legend>
                <div className="grid gap-1 border-border/70 border-l pl-2">
                  {configurationHostsForGroup(group).map(({ label }) => (
                    <ConfigurationHostButton
                      isOpen={configurationHost === label}
                      key={label}
                      label={label}
                      onChange={onConfigurationHostChange}
                    />
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
        <div className="min-w-0 lg:border-border/70 lg:border-l lg:pl-5">
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
              projectAreasNavigationPreview={projectAreasNavigationPreview}
              projectId={projectId}
              projectName={projectName}
            />
          ) : (
            <div className="flex min-h-20 items-center border-border/70 border-t pt-4 lg:min-h-32 lg:border-0 lg:pt-0">
              <p className="max-w-md text-muted-foreground text-sm/relaxed">
                Choose a surface to inspect its Project-level controls. Daily
                Work editing stays outside this mode.
              </p>
            </div>
          )}
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
  projectAreasNavigationPreview,
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
  projectAreasNavigationPreview: ProjectAreasNavigationPreview;
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
        projectAreasNavigationPreview={projectAreasNavigationPreview}
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
  projectAreasNavigationPreview,
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
  projectAreasNavigationPreview: ProjectAreasNavigationPreview;
  projectId: string;
  projectName: string;
}) {
  switch (label) {
    case "Backlog":
      return (
        <div className="mt-3 space-y-3">
          <label
            className="flex items-center gap-3"
            htmlFor="notify-on-reappear-date"
          >
            <Checkbox
              checked={configuration.notifyOnReappearDate ?? false}
              disabled={disabled}
              id="notify-on-reappear-date"
              onCheckedChange={(checked) =>
                onChange({
                  kind: "set-reappear-date-notification",
                  enabled: checked,
                })
              }
            />
            Notify on Reappear date
          </label>
          <ConfigurationMutationError error={error} />
        </div>
      );
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
    case "Saved views":
      return (
        <SavedViewsConfiguration
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
          navigationPreview={projectAreasNavigationPreview}
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
  navigationPreview,
}: {
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  message: string;
  onChange: (change: ProjectShellConfigurationChange) => void;
  onEnableProjectArea: (area: ProjectArea) => void;
  onReorderPinnedArea: (area: ProjectArea, direction: -1 | 1) => void;
  navigationPreview: ProjectAreasNavigationPreview;
}) {
  return (
    <div className="mt-3 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-muted-foreground text-xs/relaxed">
          {message}
        </p>
        <Button
          className="shrink-0"
          disabled={disabled}
          onClick={() => navigationPreview.onRestorePreviewOpenChange(true)}
          type="button"
          variant="outline"
        >
          Restore default navigation
        </Button>
      </div>
      {navigationPreview.restorePreviewOpen ? (
        <fieldset className="space-y-3 border bg-background p-4 text-sm">
          <legend className="font-medium">Navigation preview</legend>
          <p className="text-muted-foreground">
            Current pinned areas:{" "}
            {configuration.extraPinnedAreas.join(", ") || "None"}
          </p>
          <p className="text-muted-foreground">
            Default pinned areas:{" "}
            {navigationPreview.defaultPinnedAreas.join(", ") || "None"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled}
              onClick={navigationPreview.onRestoreDefaultNavigation}
              size="xs"
              type="button"
            >
              Confirm
            </Button>
            <Button
              disabled={disabled}
              onClick={() =>
                navigationPreview.onRestorePreviewOpenChange(false)
              }
              size="xs"
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </div>
        </fieldset>
      ) : null}
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
  const addStageForm = useForm({
    defaultValues: { name: "" },
    onSubmit: ({ value, formApi }) => {
      const name = value.name.trim();
      if (
        name &&
        submitConfigurationChange({ kind: "add-stage", name }, onChange)
      ) {
        formApi.reset();
      }
    },
  });
  const [pendingStageRemovalId, setPendingStageRemovalId] = useState<
    string | null
  >(null);

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
      <form
        className="flex flex-wrap items-end gap-2"
        noValidate
        onSubmit={handleFormSubmit(addStageForm)}
      >
        <addStageForm.Field name="name">
          {(field) => (
            <label className="grid gap-1 text-xs" htmlFor="new-project-stage">
              Stage name
              <Input
                disabled={disabled}
                id="new-project-stage"
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            </label>
          )}
        </addStageForm.Field>
        <addStageForm.Subscribe selector={(state) => state.values.name}>
          {(name) => (
            <Button disabled={disabled || !name.trim()} size="xs" type="submit">
              Add stage
            </Button>
          )}
        </addStageForm.Subscribe>
      </form>
      <ConfigurationMutationError error={error} />
      <ul aria-label="Stages configuration" className="space-y-2">
        {configuration.preparedStages.map((stage, index) => (
          <li className="border bg-background p-3" key={stage.id}>
            <div className="flex flex-wrap items-end gap-2">
              <StageNameForm
                disabled={disabled}
                key={`${stage.id}-${stage.name}`}
                onChange={onChange}
                stage={stage}
              />
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
                className="min-w-10"
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
                className="min-w-10"
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

function StageNameForm({
  disabled,
  onChange,
  stage,
}: {
  disabled: boolean;
  onChange: (change: ProjectShellConfigurationChange) => void;
  stage: { id: string; name: string };
}) {
  const form = useForm({
    defaultValues: { name: stage.name },
    onSubmit: ({ value }) => {
      const name = value.name.trim();
      if (!name || name === stage.name) {
        return;
      }
      submitConfigurationChange(
        { kind: "rename-stage", name, stageId: stage.id },
        onChange,
      );
    },
  });

  return (
    <form className="contents" noValidate onSubmit={handleFormSubmit(form)}>
      <form.Field name="name">
        {(field) => (
          <label
            className="grid min-w-44 flex-1 gap-1 text-xs"
            htmlFor={`stage-name-${stage.id}`}
          >
            Stage name
            <Input
              aria-label={`Stage name ${stage.name}`}
              disabled={disabled}
              id={`stage-name-${stage.id}`}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <Button disabled={disabled} size="xs" type="submit" variant="outline">
        Save
      </Button>
    </form>
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
            <WorkStatusLabelForm
              disabled={disabled}
              key={`${status.semantic}-${status.label}`}
              onChange={onChange}
              status={status}
            />
            <WorkStatusSoftWipForm
              configuration={configuration}
              disabled={disabled}
              onChange={onChange}
              semantic={status.semantic}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

type WorkStatusSemantic =
  ProjectShellConfiguration["workStatusLabels"][number]["semantic"];

function WorkStatusLabelForm({
  disabled,
  onChange,
  status,
}: {
  disabled: boolean;
  onChange: (change: ProjectShellConfigurationChange) => void;
  status: { label: string; semantic: WorkStatusSemantic };
}) {
  const form = useForm({
    defaultValues: { label: status.label },
    onSubmit: ({ value }) => {
      const label = value.label.trim();
      if (!label || label === status.label) {
        return;
      }
      submitConfigurationChange(
        { kind: "rename-work-status", label, semantic: status.semantic },
        onChange,
      );
    },
  });

  return (
    <form className="contents" noValidate onSubmit={handleFormSubmit(form)}>
      <form.Field name="label">
        {(field) => (
          <label
            className="grid min-w-44 flex-1 gap-1 text-xs"
            htmlFor={`work-status-label-${status.semantic}`}
          >
            Visible label
            <Input
              aria-label={`Work status label ${status.semantic}`}
              disabled={disabled}
              id={`work-status-label-${status.semantic}`}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.label.trim()}>
        {(label) => (
          <Button
            disabled={disabled || !label || label === status.label}
            size="xs"
            type="submit"
            variant="outline"
          >
            Save
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function WorkStatusSoftWipForm({
  configuration,
  disabled,
  onChange,
  semantic,
}: {
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  onChange: (change: ProjectShellConfigurationChange) => void;
  semantic: WorkStatusSemantic;
}) {
  const savedLimit =
    configuration.workStatusSoftWipLimits[semantic]?.toString() ?? "";
  const form = useForm({
    defaultValues: { limit: savedLimit },
    onSubmit: ({ value }) => {
      submitConfigurationChange(
        {
          kind: "set-work-status-soft-wip-limit",
          limit: value.limit === "" ? null : Number(value.limit),
          semantic,
        },
        onChange,
      );
    },
  });

  return (
    <form className="contents" noValidate onSubmit={handleFormSubmit(form)}>
      <form.Field name="limit">
        {(field) => (
          <label
            className="grid gap-1 text-xs"
            htmlFor={`work-status-soft-wip-${semantic}`}
          >
            Soft WIP
            <Input
              aria-label={`Soft WIP ${semantic}`}
              disabled={disabled}
              id={`work-status-soft-wip-${semantic}`}
              max={10_000}
              min={1}
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              type="number"
              value={field.state.value}
            />
          </label>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.limit}>
        {(limit) => (
          <Button
            disabled={
              disabled ||
              (limit !== "" &&
                (!Number.isInteger(Number(limit)) ||
                  Number(limit) < 1 ||
                  Number(limit) > 10_000)) ||
              limit === savedLimit
            }
            size="xs"
            type="submit"
            variant="outline"
          >
            Save Soft WIP
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function SavedViewsConfiguration({
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
  const focusThresholdForm = useForm({
    defaultValues: {
      threshold: configuration.workFocusThreshold?.toString() ?? "",
    },
    onSubmit: ({ value }) => {
      submitConfigurationChange(
        {
          kind: "set-work-focus-threshold",
          threshold: value.threshold === "" ? null : Number(value.threshold),
        },
        onChange,
      );
    },
  });

  return (
    <div className="mt-3 space-y-4">
      <p className="text-muted-foreground text-xs/relaxed">
        Board and List use the same saved sort. Focus threshold is a visual
        signal and never blocks a Work status move.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs" htmlFor="saved-work-sort-field">
          Sort by
          <NativeSelect
            disabled={disabled}
            id="saved-work-sort-field"
            onChange={(event) =>
              onChange({
                direction: configuration.workSort.direction,
                field: event.target
                  .value as ProjectShellConfiguration["workSort"]["field"],
                kind: "set-work-sort",
              })
            }
            value={configuration.workSort.field}
          >
            <NativeSelectOption value="number">Work number</NativeSelectOption>
            <NativeSelectOption value="title">Title</NativeSelectOption>
            <NativeSelectOption value="createdAt">Created</NativeSelectOption>
            <NativeSelectOption value="updatedAt">Updated</NativeSelectOption>
            <NativeSelectOption value="reappearDate">
              Reappear date
            </NativeSelectOption>
          </NativeSelect>
        </label>
        <label
          className="grid gap-1 text-xs"
          htmlFor="saved-work-sort-direction"
        >
          Sort direction
          <NativeSelect
            disabled={disabled}
            id="saved-work-sort-direction"
            onChange={(event) =>
              onChange({
                direction: event.target
                  .value as ProjectShellConfiguration["workSort"]["direction"],
                field: configuration.workSort.field,
                kind: "set-work-sort",
              })
            }
            value={configuration.workSort.direction}
          >
            <NativeSelectOption value="ascending">Ascending</NativeSelectOption>
            <NativeSelectOption value="descending">
              Descending
            </NativeSelectOption>
          </NativeSelect>
        </label>
        <form
          className="contents"
          noValidate
          onSubmit={handleFormSubmit(focusThresholdForm)}
        >
          <focusThresholdForm.Field name="threshold">
            {(field) => (
              <label
                className="grid gap-1 text-xs"
                htmlFor="work-focus-threshold"
              >
                Focus threshold
                <Input
                  aria-label="Focus threshold"
                  disabled={disabled}
                  id="work-focus-threshold"
                  max={10_000}
                  min={1}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  type="number"
                  value={field.state.value}
                />
              </label>
            )}
          </focusThresholdForm.Field>
          <focusThresholdForm.Subscribe
            selector={(state) => state.values.threshold}
          >
            {(threshold) => (
              <Button
                disabled={
                  disabled ||
                  !(
                    threshold === "" ||
                    (Number.isInteger(Number(threshold)) &&
                      Number(threshold) >= 1 &&
                      Number(threshold) <= 10_000)
                  ) ||
                  (threshold === ""
                    ? configuration.workFocusThreshold === null
                    : Number(threshold) === configuration.workFocusThreshold)
                }
                size="xs"
                type="submit"
                variant="outline"
              >
                Save Focus threshold
              </Button>
            )}
          </focusThresholdForm.Subscribe>
        </form>
      </div>
      <StatusAgeThresholdConfiguration
        configuration={configuration}
        disabled={disabled}
        onChange={onChange}
      />
      <ConfigurationMutationError error={error} />
    </div>
  );
}

function StatusAgeThresholdConfiguration({
  configuration,
  disabled,
  onChange,
}: {
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  onChange: (change: ProjectShellConfigurationChange) => void;
}) {
  const form = useForm({
    defaultValues: {
      days: configuration.statusAgeThresholdDays?.toString() ?? "",
    },
    onSubmit: ({ value }) => {
      submitConfigurationChange(
        {
          kind: "set-status-age-threshold",
          thresholdDays: value.days === "" ? null : Number(value.days),
        },
        onChange,
      );
    },
  });
  return (
    <form className="space-y-2" noValidate onSubmit={handleFormSubmit(form)}>
      <form.Field name="days">
        {(field) => (
          <label
            className="grid max-w-sm gap-1 text-sm"
            htmlFor="status-age-threshold"
          >
            Long in the same status
            <form.Subscribe selector={(state) => state.values.days}>
              {(days) => (
                <Input
                  aria-describedby="status-age-threshold-description"
                  aria-invalid={!isValidStatusAge(days)}
                  disabled={disabled}
                  id="status-age-threshold"
                  max={10_000}
                  min={1}
                  name={field.name}
                  onChange={(event) => field.handleChange(event.target.value)}
                  type="number"
                  value={field.state.value}
                />
              )}
            </form.Subscribe>
          </label>
        )}
      </form.Field>
      <p
        className="text-muted-foreground text-xs/relaxed"
        id="status-age-threshold-description"
      >
        Optional days in the current status. Leave blank to turn off. Candidates
        appear in Return to Work and a Smart Collection without changing Work or
        sending notifications.
      </p>
      <form.Subscribe selector={(state) => state.values.days}>
        {(days) => {
          const valid = isValidStatusAge(days);
          const thresholdDays = days === "" ? null : Number(days);
          return (
            <>
              {valid ? null : (
                <p className="text-destructive text-sm" role="alert">
                  Enter a whole number of days from 1 to 10000.
                </p>
              )}
              <Button
                disabled={
                  disabled ||
                  !valid ||
                  thresholdDays ===
                    (configuration.statusAgeThresholdDays ?? null)
                }
                size="xs"
                type="submit"
                variant="outline"
              >
                Save Long in the same status
              </Button>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}

function isValidStatusAge(days: string) {
  if (days === "") {
    return true;
  }
  const value = Number(days);
  return Number.isInteger(value) && value >= 1 && value <= 10_000;
}
