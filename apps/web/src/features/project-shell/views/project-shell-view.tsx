// biome-ignore-all lint/performance/noJsxPropsBind: Configuration rows and controls close over their current stage, status, or area.
import {
  getStarterConfigurationDefinition,
  isProjectCoreArea,
  PROJECT_AREA_OPTIONS,
  PROJECT_CORE_AREA_OPTIONS,
  PROJECT_STAGE_STATUS_OPTIONS,
  type ProjectArea,
  type ProjectShellConfiguration,
  type ProjectShellConfigurationChange,
  type StarterConfiguration,
} from "@cantiara/api/project-shell";
import { Badge } from "@cantiara/ui/components/badge";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLinkProps, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Check, CircleHelp, Settings2 } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/views/client-shell";
import WorkCreateForm from "@/features/work-lifecycle/forms/work-create-form";
import ProjectWorkList from "@/features/work-lifecycle/views/project-work-list";
import { client, orpc } from "@/utils/orpc";

const ALWAYS_REACHABLE_SURFACES = ["Overview", "All Tools"] as const;

const ALL_PROJECT_AREAS = PROJECT_AREA_OPTIONS;
type NavigationSurface =
  | (typeof ALWAYS_REACHABLE_SURFACES)[number]
  | ProjectArea;
const NAVIGATION_LINK_BASE =
  "relative -mb-px px-0.5 py-3 text-sm transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const PROJECT_SHELL_EXPLANATION_STORAGE_PREFIX =
  "cantiara:project-shell:explanation-dismissed:";

const CONFIGURATION_HOSTS = [
  {
    description:
      "Open the host for Project stages. Stage state is presentation metadata and does not write Work status.",
    label: "Stages",
    message:
      "Stage names and presentation order open here; removing a stage does not delete main records.",
  },
  {
    description:
      "Open the host for user-facing Work status names while protected semantics remain unchanged.",
    label: "Work statuses",
    message:
      "Work status names open here; Not Started, In Progress, Blocked, and Closed semantics remain protected.",
  },
  {
    description:
      "Open the host for enabled Project areas. Overview and All Tools stay reachable.",
    label: "Project areas",
    message:
      "Use All Tools below to enable a ready Project area without creating records.",
  },
  {
    description:
      "Open the host for project-scoped fields. Field types and values belong to the Custom field feature.",
    label: "Custom field",
    message: "No schema is defined here.",
  },
  {
    description:
      "Open the host for project priority criteria without creating a scalar priority field.",
    label: "Priority metrics",
    message:
      "Priority metric definitions open here; Work values remain with their source records.",
  },
  {
    description:
      "Open the host for named Work views. Planning remains a daily action outside this mode.",
    label: "Saved views",
    message:
      "Saved view definitions open here; this entry does not change Planning membership.",
  },
  {
    description:
      "Open the host for Work Context Card presentation without changing its layout engine.",
    label: "Work Context Card layout",
    message:
      "No layout is changed here. The Work Context Card feature owns its layout engine.",
  },
] as const;

type ConfigurationHost = (typeof CONFIGURATION_HOSTS)[number]["label"];

const DAILY_ACTIONS = ["Create", "Edit", "Status", "Planning"] as const;
type DailyAction = (typeof DAILY_ACTIONS)[number];
const DAILY_ACTION_HASHES: Record<DailyAction, string> = {
  Create: "work-create",
  Edit: "work-edit",
  Planning: "work-planning",
  Status: "work-status",
};

const DAILY_ACTION_MESSAGES: Record<DailyAction, string> = {
  Create:
    "Create remains outside Configuration Mode. This Project Shell entry does not create sample Work.",
  Edit: "Edit remains outside Configuration Mode. Project configuration does not change daily content.",
  Status:
    "Status remains outside Configuration Mode. Project stages do not write Work status.",
  Planning:
    "Planning remains outside Configuration Mode. Saved views are a separate Project configuration entry.",
};

function useProjectConfigurationMutation(
  projectId: string,
  baseRevision: number,
) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const projectQueryKey = orpc.project.queryOptions({
    input: { projectId },
  }).queryKey;
  const mutation = useMutation({
    mutationFn: (change: ProjectShellConfigurationChange) =>
      runOnlineOnlyWrite(() =>
        client.updateProjectConfiguration({
          baseRevision,
          change,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
        }),
      ),
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Project configuration could not be changed. Try again.",
      );
    },
    onSuccess: async (nextProject) => {
      setError(null);
      queryClient.setQueryData(projectQueryKey, nextProject);
      await queryClient.invalidateQueries({
        queryKey: projectQueryKey,
      });
    },
  });

  return { error, mutation };
}

function projectShellExplanationStorageKey(projectId: string) {
  return `${PROJECT_SHELL_EXPLANATION_STORAGE_PREFIX}${projectId}`;
}

function isProjectShellExplanationDismissed(projectId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(
        projectShellExplanationStorageKey(projectId),
      ) === "dismissed"
    );
  } catch {
    return false;
  }
}

function rememberProjectShellExplanationDismissal(projectId: string) {
  try {
    window.localStorage.setItem(
      projectShellExplanationStorageKey(projectId),
      "dismissed",
    );
  } catch {
    // A restricted browser storage context should not block the Project Shell.
  }
}

export default function ProjectShellView({ projectId }: { projectId: string }) {
  const activeHash = useLocation({ select: ({ hash }) => hash });
  const projectQueryOptions = orpc.project.queryOptions({
    input: { projectId },
  });
  const projectQuery = useQuery({
    ...projectQueryOptions,
  });
  const [showExplanation, setShowExplanation] = useState(
    () => !isProjectShellExplanationDismissed(projectId),
  );
  const [configurationMode, setConfigurationMode] = useState(false);
  const [configurationHost, setConfigurationHost] =
    useState<ConfigurationHost | null>(null);
  const dailyAction = dailyActionFromHash(activeHash);

  useEffect(() => {
    setShowExplanation(!isProjectShellExplanationDismissed(projectId));
    setConfigurationMode(false);
    setConfigurationHost(null);
  }, [projectId]);

  if (projectQuery.isPending) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div aria-label="Loading…" role="status">
          Loading…
        </div>
      </main>
    );
  }

  if (projectQuery.isError) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="border-y py-8 text-sm" role="alert">
          <p className="font-medium">Project is unavailable.</p>
          <p className="mt-1 text-muted-foreground">
            Try loading this page again.
          </p>
        </div>
      </main>
    );
  }

  const {
    configuration,
    name,
    revision,
    shortCode,
    starterConfiguration,
    status,
  } = projectQuery.data;

  function dismissExplanation() {
    setShowExplanation(false);
    rememberProjectShellExplanationDismissal(projectId);
  }

  function toggleConfigurationMode() {
    setConfigurationMode((isActive) => {
      if (isActive) {
        setConfigurationHost(null);
      }
      return !isActive;
    });
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="border-b pb-8">
        <Link
          className={`${buttonVariants({ variant: "ghost", size: "sm" })} mb-6 -ml-3`}
          to="/projects"
        >
          <ArrowLeft aria-hidden="true" />
          Projects
        </Link>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-end sm:gap-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-balance font-semibold text-3xl tracking-tight">
                {name}
              </h1>
              <Badge variant="secondary">{status}</Badge>
            </div>
            <p className="mt-3 max-w-xl text-muted-foreground text-sm/relaxed">
              A durable home for this Project’s work and context.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-5 border-t pt-4 sm:grid-cols-1 sm:gap-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
            <div>
              <dt className="text-muted-foreground text-xs">Short code</dt>
              <dd className="mt-1 font-medium text-sm">{shortCode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">
                Starter Configuration
              </dt>
              <dd className="mt-1 font-medium text-sm">
                {starterConfiguration}
              </dd>
            </div>
          </dl>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div>
            <p className="font-medium text-sm">Configuration Mode</p>
            <p className="mt-1 text-muted-foreground text-xs/relaxed">
              Separate Project structure from daily Work editing.
            </p>
          </div>
          <Button
            aria-pressed={configurationMode}
            onClick={toggleConfigurationMode}
            type="button"
            variant={configurationMode ? "default" : "outline"}
          >
            <Settings2 aria-hidden="true" />
            Configuration Mode
          </Button>
        </div>
      </header>

      {showExplanation ? (
        <aside
          aria-label="Starter Configuration explanation"
          className="mt-5 flex items-start gap-3 border bg-muted/20 p-4"
        >
          <CircleHelp
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">Starter Configuration applied once</p>
            <p className="mt-1 text-muted-foreground">
              These defaults give this Project a starting shape. You can adjust
              its structure later; no sample content was created.
            </p>
          </div>
          <Button onClick={dismissExplanation} size="xs" variant="ghost">
            Dismiss
          </Button>
        </aside>
      ) : null}

      <ProjectNavigation
        enabledAreas={configuration.enabledAreas}
        extraPinnedAreas={configuration.extraPinnedAreas}
        hiddenAreas={configuration.hiddenAreas}
      />

      {configurationMode ? (
        <ConfigurationModePanel
          baseRevision={revision}
          configuration={configuration}
          configurationHost={configurationHost}
          onConfigurationHostChange={setConfigurationHost}
          projectId={projectId}
          starterConfiguration={starterConfiguration}
        />
      ) : null}

      <section className="mt-10 space-y-10" id="overview">
        <div className="max-w-2xl">
          <h2 className="mt-2 font-semibold text-2xl">Overview</h2>
          <p className="mt-3 text-muted-foreground text-sm/relaxed">
            This Project is ready for your work. Starter defaults are structure
            only and do not add records, history, or workflow gates.
          </p>
        </div>

        <div className="grid items-start gap-x-12 gap-y-10 lg:grid-cols-2">
          <ConfigurationList
            emptyMessage="No stages prepared."
            items={configuration.preparedStages.map((stage) => stage.name)}
            label="Stages"
          />
          <ConfigurationList
            items={configuration.workStatusLabels.map(
              (workStatus) => workStatus.label,
            )}
            label="Work statuses"
          />
          <ConfigurationList
            items={configuration.preparedWorkViews}
            label="Saved views"
          />
          <EnabledAreasList areas={configuration.enabledAreas} />
        </div>

        <section
          className="grid gap-6 border-y py-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:gap-8"
          id="work"
        >
          <div>
            <h2 className="font-medium text-lg">Work</h2>
            <ProjectWorkList projectId={projectId} />
            <DailyWorkActions
              activeAction={dailyAction}
              projectId={projectId}
            />
          </div>
          <div className="lg:border-l lg:pl-6">
            <p className="font-medium text-muted-foreground text-xs">
              Saved views
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {configuration.preparedWorkViews.map((view) => (
                <span
                  className="border bg-background px-3 py-1.5 text-sm"
                  key={view}
                >
                  {view}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b pb-6" id="documents">
          <h2 className="font-medium text-lg">Documents</h2>
          <p className="mt-2 text-muted-foreground text-sm/relaxed">
            No sample content was created.
          </p>
        </section>

        <AllToolsSection
          baseRevision={revision}
          configuration={configuration}
          configurationMode={configurationMode}
          projectId={projectId}
        />
      </section>
    </main>
  );
}

function DailyWorkActions({
  activeAction,
  projectId,
}: {
  activeAction: DailyAction | null;
  projectId: string;
}) {
  return (
    <section aria-labelledby="daily-actions-heading" className="mt-5">
      <h3 className="sr-only" id="daily-actions-heading">
        Daily actions
      </h3>
      <div className="flex flex-wrap gap-2">
        {DAILY_ACTIONS.map((action) => (
          <DailyActionLink
            action={action}
            activeAction={activeAction}
            key={action}
          />
        ))}
      </div>
      {activeAction ? (
        <DailyActionHost action={activeAction} projectId={projectId} />
      ) : null}
    </section>
  );
}

function DailyActionLink({
  action,
  activeAction,
}: {
  action: DailyAction;
  activeAction: DailyAction | null;
}) {
  const linkProps = useLinkProps({
    activeOptions: { exact: true, includeHash: true },
    hash: DAILY_ACTION_HASHES[action],
    to: ".",
  });

  return (
    <a
      {...linkProps}
      aria-current={activeAction === action ? "location" : undefined}
      className={buttonVariants({ size: "xs", variant: "outline" })}
    >
      {action}
    </a>
  );
}

function DailyActionHost({
  action,
  projectId,
}: {
  action: DailyAction;
  projectId: string;
}) {
  const hostId = DAILY_ACTION_HASHES[action];

  return (
    <section
      aria-labelledby={`${hostId}-heading`}
      className="mt-4 border bg-muted/20 p-3 text-muted-foreground text-sm"
      id={hostId}
    >
      <h4 className="font-medium text-foreground" id={`${hostId}-heading`}>
        {action}
      </h4>
      {action === "Create" ? (
        <WorkCreateForm projectId={projectId} />
      ) : (
        <p className="mt-1">{DAILY_ACTION_MESSAGES[action]}</p>
      )}
    </section>
  );
}

function ConfigurationModePanel({
  baseRevision,
  configuration,
  configurationHost,
  onConfigurationHostChange,
  projectId,
  starterConfiguration,
}: {
  baseRevision: number;
  configuration: ProjectShellConfiguration;
  configurationHost: ConfigurationHost | null;
  onConfigurationHostChange: (host: ConfigurationHost | null) => void;
  projectId: string;
  starterConfiguration: StarterConfiguration;
}) {
  const { error, mutation } = useProjectConfigurationMutation(
    projectId,
    baseRevision,
  );
  const [restorePreviewOpen, setRestorePreviewOpen] = useState(false);
  const defaultPinnedAreas =
    getStarterConfigurationDefinition(starterConfiguration).extraPinnedAreas;

  return (
    <section
      aria-label="Configuration Mode"
      className="mt-6 space-y-8 border border-primary/30 bg-primary/5 p-5 sm:p-6"
    >
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <Badge>Configuration Mode</Badge>
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

      <section aria-labelledby="configuration-project-areas-heading">
        <h3
          className="font-medium text-base"
          id="configuration-project-areas-heading"
        >
          Project areas
        </h3>
        <p className="mt-2 max-w-2xl text-muted-foreground text-sm/relaxed">
          Enable a ready Project area from All Tools below. Enabling an area
          changes presentation metadata only and does not create records.
        </p>
        <Button
          className="mt-4"
          disabled={mutation.isPending}
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
            <ConfigurationMutationError error={error} />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={mutation.isPending}
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
                disabled={mutation.isPending}
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
      </section>

      <section aria-labelledby="configuration-entry-points-heading">
        <h3
          className="font-medium text-base"
          id="configuration-entry-points-heading"
        >
          Configuration Mode
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {CONFIGURATION_HOSTS.map(({ description, label }) => {
            const isOpen = configurationHost === label;
            return (
              <div className="border bg-background p-4" key={label}>
                <ConfigurationHostButton
                  isOpen={isOpen}
                  label={label}
                  onChange={onConfigurationHostChange}
                />
                <p className="mt-2 text-muted-foreground text-xs/relaxed">
                  {description}
                </p>
                {isOpen ? (
                  <ConfigurationHostPanel
                    configuration={configuration}
                    disabled={mutation.isPending}
                    error={error}
                    label={label}
                    onChange={mutation.mutate}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
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
      onClick={handleClick}
      type="button"
      variant="ghost"
    >
      {label}
    </Button>
  );
}

function ConfigurationHostPanel({
  configuration,
  disabled,
  error,
  label,
  onChange,
}: {
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  label: ConfigurationHost;
  onChange: (change: ProjectShellConfigurationChange) => void;
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
        configuration={configuration}
        disabled={disabled}
        error={error}
        label={label}
        message={host.message}
        onChange={onChange}
      />
    </section>
  );
}

function ConfigurationHostContent({
  configuration,
  disabled,
  error,
  label,
  message,
  onChange,
}: {
  configuration: ProjectShellConfiguration;
  disabled: boolean;
  error: string | null;
  label: ConfigurationHost;
  message: string;
  onChange: (change: ProjectShellConfigurationChange) => void;
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
    case "Custom field":
      return <CustomFieldEditorHost message={message} />;
    case "Work Context Card layout":
      return <WorkContextCardLayoutEditorHost message={message} />;
    default:
      return <p className="mt-1">{message}</p>;
  }
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

function CustomFieldEditorHost({ message }: { message: string }) {
  return (
    <div
      className="mt-3 border-l-2 pl-3"
      data-configuration-editor-host="custom-field"
    >
      <p>{message}</p>
    </div>
  );
}

function WorkContextCardLayoutEditorHost({ message }: { message: string }) {
  return (
    <div
      className="mt-3 border-l-2 pl-3"
      data-configuration-editor-host="work-context-card-layout"
    >
      <p>{message}</p>
    </div>
  );
}

function configurationHostId(label: ConfigurationHost) {
  return `configuration-host-${navigationSlug(label)}`;
}

function ProjectNavigation({
  enabledAreas,
  extraPinnedAreas,
  hiddenAreas,
}: {
  enabledAreas: readonly ProjectArea[];
  extraPinnedAreas: readonly ProjectArea[];
  hiddenAreas: readonly ProjectArea[];
}) {
  const activeHash = useLocation({ select: ({ hash }) => hash });
  const visiblePinnedAreas = extraPinnedAreas.filter(
    (area) =>
      !isProjectCoreArea(area) &&
      enabledAreas.includes(area) &&
      !hiddenAreas.includes(area),
  );
  const visibleCoreAreas = PROJECT_CORE_AREA_OPTIONS.filter(
    (area) => enabledAreas.includes(area) && !hiddenAreas.includes(area),
  );
  const activeSurface = navigationSurfaceFromHash(
    activeHash,
    enabledAreas,
    hiddenAreas,
    visiblePinnedAreas,
  );

  return (
    <nav
      aria-label="Project navigation"
      className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 border-b"
    >
      {ALWAYS_REACHABLE_SURFACES.map((surface) => (
        <ProjectNavigationLink
          activeSurface={activeSurface}
          hash={navigationHash(surface)}
          key={surface}
          surface={surface}
        />
      ))}
      {visibleCoreAreas.map((area) => (
        <ProjectNavigationLink
          activeSurface={activeSurface}
          hash={navigationHash(area)}
          key={area}
          surface={area}
        />
      ))}
      {visiblePinnedAreas.length > 0 ? (
        <span
          aria-hidden="true"
          className="mx-1 hidden h-4 w-px bg-border sm:block"
        />
      ) : null}
      {visiblePinnedAreas.map((area) => (
        <ProjectNavigationLink
          activeSurface={activeSurface}
          hash={projectAreaHash(area)}
          key={area}
          pinned
          surface={area}
        />
      ))}
    </nav>
  );
}

function ProjectNavigationLink({
  activeSurface,
  hash,
  pinned = false,
  surface,
}: {
  activeSurface: NavigationSurface;
  hash: string;
  pinned?: boolean;
  surface: NavigationSurface;
}) {
  const isActive = activeSurface === surface;
  const linkProps = useLinkProps({
    activeOptions: { exact: true, includeHash: true },
    hash,
    to: ".",
  });

  return (
    <a
      {...linkProps}
      aria-current={isActive ? "location" : undefined}
      className={`${NAVIGATION_LINK_BASE} ${pinned ? "border-b border-dashed" : "border-b-2 font-medium"} ${navigationLinkStateClass(isActive)}`}
    >
      {surface}
    </a>
  );
}

function navigationLinkStateClass(isActive: boolean) {
  return isActive
    ? "border-foreground text-foreground"
    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground";
}

function navigationSurfaceFromHash(
  hash: string,
  enabledAreas: readonly ProjectArea[],
  hiddenAreas: readonly ProjectArea[],
  visiblePinnedAreas: readonly ProjectArea[],
): NavigationSurface {
  if (!hash) {
    return "Overview";
  }
  if (hash === "all-tools") {
    return "All Tools";
  }
  if (
    hash === "work" &&
    enabledAreas.includes("Work") &&
    !hiddenAreas.includes("Work")
  ) {
    return "Work";
  }
  if (
    hash === "documents" &&
    enabledAreas.includes("Documents") &&
    !hiddenAreas.includes("Documents")
  ) {
    return "Documents";
  }
  if (dailyActionFromHash(hash)) {
    return "Work";
  }
  const visibleArea = PROJECT_AREA_OPTIONS.find(
    (area) =>
      enabledAreas.includes(area) &&
      !hiddenAreas.includes(area) &&
      projectAreaHash(area) === hash,
  );
  if (visibleArea) {
    return visibleArea;
  }
  const pinnedArea = visiblePinnedAreas.find(
    (area) => projectAreaHash(area) === hash,
  );
  return pinnedArea ?? "Overview";
}

function dailyActionFromHash(hash: string) {
  return (
    DAILY_ACTIONS.find((action) => DAILY_ACTION_HASHES[action] === hash) ?? null
  );
}

function navigationHash(surface: NavigationSurface) {
  if (surface === "All Tools") {
    return "all-tools";
  }
  return navigationSlug(surface);
}

function projectAreaHash(area: ProjectArea) {
  return projectAreaAnchor(area).slice(1);
}

function projectAreaAnchor(area: ProjectArea) {
  return `#project-area-${navigationSlug(area)}`;
}

function navigationSlug(surface: string) {
  return surface.toLowerCase().replaceAll(" ", "-");
}

function ConfigurationList({
  emptyMessage,
  items,
  label,
}: {
  emptyMessage?: string;
  items: readonly string[];
  label: string;
}) {
  return (
    <section
      aria-labelledby={`${label.toLowerCase().replaceAll(" ", "-")}-heading`}
      className="border-t pt-5"
    >
      <h2
        className="font-medium text-base"
        id={`${label.toLowerCase().replaceAll(" ", "-")}-heading`}
      >
        {label}
      </h2>
      <ul aria-label={label} className="mt-3 divide-y border-y">
        {items.map((item) => (
          <li className="px-3 py-2.5 text-sm" key={item}>
            {item}
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <p className="mt-3 text-muted-foreground text-sm">{emptyMessage}</p>
      ) : null}
    </section>
  );
}

function EnabledAreasList({ areas }: { areas: readonly ProjectArea[] }) {
  return (
    <section
      aria-labelledby="enabled-project-areas-heading"
      className="border-t pt-5"
    >
      <h2 className="font-medium text-base" id="enabled-project-areas-heading">
        Project areas
      </h2>
      <ul aria-label="Enabled Project areas" className="mt-3 divide-y border-y">
        {areas.map((area) => (
          <li className="px-3 py-2.5 text-sm" key={area}>
            {area}
          </li>
        ))}
      </ul>
    </section>
  );
}

function projectAreaAvailabilityLabel(enabled: boolean, hidden: boolean) {
  if (!enabled) {
    return "Available";
  }
  return hidden ? "Hidden" : "Enabled";
}

function AllToolsSection({
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
  const queryClient = useQueryClient();
  const { error: configurationError, mutation: configurationMutation } =
    useProjectConfigurationMutation(projectId, baseRevision);
  const [enableError, setEnableError] = useState<string | null>(null);
  const enableProjectArea = useMutation({
    mutationFn: (area: ProjectArea) =>
      runOnlineOnlyWrite(() =>
        client.enableProjectArea({
          area,
          baseRevision,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
        }),
      ),
    onError: () => {
      setEnableError("Project area could not be enabled. Try again.");
    },
    onSuccess: async () => {
      setEnableError(null);
      await queryClient.invalidateQueries({
        queryKey: orpc.project.queryOptions({ input: { projectId } }).queryKey,
      });
    },
  });
  const requestEnableProjectArea = useCallback(
    (area: ProjectArea) => {
      setEnableError(null);
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
    <section className="border-y py-6" id="all-tools">
      <div className="max-w-2xl">
        <h2 className="font-medium text-lg">All Tools</h2>
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
        className="mt-5 grid gap-x-8 border-y lg:grid-cols-2"
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
              className="flex items-center justify-between border-b px-3 py-2.5 text-sm last:border-b-0 lg:[&:nth-last-child(-n+2)]:border-b-0"
              id={projectAreaAnchor(area).slice(1)}
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

function ProjectAreaAvailability({
  area,
  configurationMode,
  disabled,
  enabled,
  hidden,
  onChange,
  onEnable,
  onReorder,
  pinned,
  pinnedCount,
  pinnedIndex,
}: {
  area: ProjectArea;
  configurationMode: boolean;
  disabled: boolean;
  enabled: boolean;
  hidden: boolean;
  onChange: (change: ProjectShellConfigurationChange) => void;
  onEnable: (area: ProjectArea) => void;
  onReorder: (area: ProjectArea, direction: -1 | 1) => void;
  pinned: boolean;
  pinnedCount: number;
  pinnedIndex: number;
}) {
  if (!enabled && configurationMode) {
    return (
      <EnableProjectAreaButton
        area={area}
        disabled={disabled}
        onEnable={onEnable}
      />
    );
  }

  if (!enabled) {
    return (
      <span className="text-muted-foreground text-xs">Configuration Mode</span>
    );
  }

  if (!configurationMode) {
    return hidden ? (
      <span className="text-muted-foreground text-xs">Hidden</span>
    ) : (
      <Check aria-hidden="true" className="size-3" />
    );
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {pinned ? (
        <>
          <Button
            aria-label={`Move ${area} up`}
            disabled={disabled || pinnedIndex <= 0}
            onClick={() => onReorder(area, -1)}
            size="xs"
            type="button"
            variant="ghost"
          >
            ↑
          </Button>
          <Button
            aria-label={`Move ${area} down`}
            disabled={disabled || pinnedIndex >= pinnedCount - 1}
            onClick={() => onReorder(area, 1)}
            size="xs"
            type="button"
            variant="ghost"
          >
            ↓
          </Button>
        </>
      ) : null}
      <Button
        aria-label={`${hidden ? "Show" : "Hide"} ${area}`}
        disabled={disabled}
        onClick={() =>
          onChange({ area, kind: "set-area-visibility", visible: hidden })
        }
        size="xs"
        type="button"
        variant="outline"
      >
        {hidden ? "Show" : "Hide"}
      </Button>
      {isProjectCoreArea(area) ? null : (
        <Button
          aria-label={
            pinned ? `Remove ${area} from navigation` : "Pin to navigation"
          }
          disabled={disabled}
          onClick={() =>
            onChange({ area, kind: pinned ? "unpin-area" : "pin-area" })
          }
          size="xs"
          type="button"
          variant="ghost"
        >
          {pinned ? "Remove pin" : "Pin to navigation"}
        </Button>
      )}
    </div>
  );
}

function EnableProjectAreaButton({
  area,
  disabled,
  onEnable,
}: {
  area: ProjectArea;
  disabled: boolean;
  onEnable: (area: ProjectArea) => void;
}) {
  const handleClick = useCallback(() => onEnable(area), [area, onEnable]);

  return (
    <Button
      aria-label={`Enable ${area}`}
      disabled={disabled}
      onClick={handleClick}
      size="xs"
      type="button"
      variant="outline"
    >
      Enable
    </Button>
  );
}
