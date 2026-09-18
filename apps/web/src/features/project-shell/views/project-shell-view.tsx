import {
  PROJECT_AREA_OPTIONS,
  type ProjectArea,
} from "@cantiara/api/project-shell";
import { Badge } from "@cantiara/ui/components/badge";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLinkProps, useLocation } from "@tanstack/react-router";
import { ArrowLeft, Check, CircleHelp, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/views/client-shell";
import { client, orpc } from "@/utils/orpc";

const ALWAYS_REACHABLE_SURFACES = [
  "Overview",
  "Work",
  "Documents",
  "All Tools",
] as const;

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

const DAILY_ACTION_MESSAGES: Record<DailyAction, string> = {
  Create:
    "Create remains outside Configuration Mode. No sample Work was created for this Project.",
  Edit: "Edit remains outside Configuration Mode. Project configuration does not change daily content.",
  Status:
    "Status remains outside Configuration Mode. Project stages do not write Work status.",
  Planning:
    "Planning remains outside Configuration Mode. Saved views are a separate Project configuration entry.",
};

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
  const [dailyAction, setDailyAction] = useState<DailyAction | null>(null);

  useEffect(() => {
    setShowExplanation(!isProjectShellExplanationDismissed(projectId));
    setConfigurationMode(false);
    setConfigurationHost(null);
    setDailyAction(null);
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

      <ProjectNavigation extraPinnedAreas={configuration.extraPinnedAreas} />

      {configurationMode ? (
        <ConfigurationModePanel
          configurationHost={configurationHost}
          onConfigurationHostChange={setConfigurationHost}
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
            items={configuration.preparedStages}
            label="Stages"
          />
          <ConfigurationList
            items={configuration.workStatuses}
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
            <p className="mt-2 text-muted-foreground text-sm/relaxed">
              No sample content was created.
            </p>
            <DailyWorkActions
              activeAction={dailyAction}
              onActionChange={setDailyAction}
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
          configurationMode={configurationMode}
          enabledAreas={configuration.enabledAreas}
          projectId={projectId}
        />
      </section>
    </main>
  );
}

function DailyWorkActions({
  activeAction,
  onActionChange,
}: {
  activeAction: DailyAction | null;
  onActionChange: (action: DailyAction | null) => void;
}) {
  return (
    <section aria-labelledby="daily-actions-heading" className="mt-5">
      <h3 className="sr-only" id="daily-actions-heading">
        Daily actions
      </h3>
      <div className="flex flex-wrap gap-2">
        {DAILY_ACTIONS.map((action) => (
          <DailyActionButton
            action={action}
            activeAction={activeAction}
            key={action}
            onActionChange={onActionChange}
          />
        ))}
      </div>
      {activeAction ? (
        <section
          aria-label={activeAction}
          className="mt-4 border bg-muted/20 p-3 text-muted-foreground text-sm"
        >
          {DAILY_ACTION_MESSAGES[activeAction]}
        </section>
      ) : null}
    </section>
  );
}

function DailyActionButton({
  action,
  activeAction,
  onActionChange,
}: {
  action: DailyAction;
  activeAction: DailyAction | null;
  onActionChange: (action: DailyAction | null) => void;
}) {
  const handleClick = useCallback(
    () => onActionChange(activeAction === action ? null : action),
    [action, activeAction, onActionChange],
  );

  return (
    <Button
      aria-expanded={activeAction === action}
      onClick={handleClick}
      size="xs"
      type="button"
      variant="outline"
    >
      {action}
    </Button>
  );
}

function ConfigurationModePanel({
  configurationHost,
  onConfigurationHostChange,
}: {
  configurationHost: ConfigurationHost | null;
  onConfigurationHostChange: (host: ConfigurationHost | null) => void;
}) {
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
                {isOpen ? <ConfigurationHostPanel label={label} /> : null}
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
      aria-expanded={isOpen}
      onClick={handleClick}
      type="button"
      variant="ghost"
    >
      {label}
    </Button>
  );
}

function ConfigurationHostPanel({ label }: { label: ConfigurationHost }) {
  const host = CONFIGURATION_HOSTS.find(
    (candidate) => candidate.label === label,
  );

  return (
    <section aria-label={label} className="mt-4 border-t pt-4 text-sm">
      <p>{host?.message}</p>
    </section>
  );
}

function ProjectNavigation({
  extraPinnedAreas,
}: {
  extraPinnedAreas: readonly ProjectArea[];
}) {
  const activeHash = useLocation({ select: ({ hash }) => hash });
  const activeSurface = navigationSurfaceFromHash(activeHash, extraPinnedAreas);

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
      {extraPinnedAreas.length > 0 ? (
        <span
          aria-hidden="true"
          className="mx-1 hidden h-4 w-px bg-border sm:block"
        />
      ) : null}
      {extraPinnedAreas.map((area) => (
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
  extraPinnedAreas: readonly ProjectArea[],
): NavigationSurface {
  if (!hash) {
    return "Overview";
  }
  if (hash === "all-tools") {
    return "All Tools";
  }
  if (hash === "work") {
    return "Work";
  }
  if (hash === "documents") {
    return "Documents";
  }
  const pinnedArea = extraPinnedAreas.find(
    (area) => projectAreaHash(area) === hash,
  );
  return pinnedArea ?? "Overview";
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

function AllToolsSection({
  baseRevision,
  configurationMode,
  enabledAreas,
  projectId,
}: {
  baseRevision: number;
  configurationMode: boolean;
  enabledAreas: readonly ProjectArea[];
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
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
      setError("Project area could not be enabled. Try again.");
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: orpc.project.queryOptions({ input: { projectId } }).queryKey,
      });
    },
  });
  const requestEnableProjectArea = useCallback(
    (area: ProjectArea) => {
      setError(null);
      enableProjectArea.mutate(area);
    },
    [enableProjectArea],
  );

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
          const enabled = enabledAreas.includes(area);
          return (
            <li
              aria-label={`${area} ${enabled ? "Enabled" : "Available"}`}
              className="flex items-center justify-between border-b px-3 py-2.5 text-sm last:border-b-0 lg:[&:nth-last-child(-n+2)]:border-b-0"
              id={projectAreaAnchor(area).slice(1)}
              key={area}
            >
              {area}
              <ProjectAreaAvailability
                area={area}
                configurationMode={configurationMode}
                disabled={enableProjectArea.isPending}
                enabled={enabled}
                onEnable={requestEnableProjectArea}
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
  onEnable,
}: {
  area: ProjectArea;
  configurationMode: boolean;
  disabled: boolean;
  enabled: boolean;
  onEnable: (area: ProjectArea) => void;
}) {
  if (enabled) {
    return <Check aria-hidden="true" className="size-3" />;
  }

  if (configurationMode) {
    return (
      <EnableProjectAreaButton
        area={area}
        disabled={disabled}
        onEnable={onEnable}
      />
    );
  }

  return (
    <span className="text-muted-foreground text-xs">Configuration Mode</span>
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
