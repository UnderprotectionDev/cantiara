// biome-ignore-all lint/performance/noJsxPropsBind: Configuration rows and controls close over their current stage, status, or area.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import {
  isProjectCoreArea,
  PROJECT_CORE_AREA_OPTIONS,
  type ProjectArea,
  type ProjectShellConfiguration,
} from "@cantiara/api/project-shell";
import type { ScopeTree } from "@cantiara/api/work-lifecycle";
import { Badge } from "@cantiara/ui/components/badge";
import { Button, buttonVariants } from "@cantiara/ui/components/button";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link, useLinkProps, useLocation } from "@tanstack/react-router";
import { ArrowLeft, CircleHelp, Settings2, X } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import FileAttachmentsSurface from "@/features/file-attachments/ui/components/file-attachment-preview";
import PrioritizationSurface from "@/features/prioritization-sessions/ui/components/prioritization-surface";
import ProjectOverviewView from "@/features/project-overview/ui/components/project-overview";
import {
  isProjectShellExplanationDismissed,
  rememberProjectShellExplanationDismissal,
} from "@/features/project-shell/lib/project-shell-explanation";
import {
  ALWAYS_REACHABLE_SURFACES,
  type ConfigurationHost,
  DAILY_ACTION_HASHES,
  DAILY_ACTION_MESSAGES,
  DAILY_ACTIONS,
  type DailyAction,
  dailyActionFromHash,
  isWorkSurfaceHash,
  NAVIGATION_LINK_BASE,
  type NavigationSurface,
  navigationHash,
  navigationSurfaceFromHash,
  PRIORITY_MAP_HASH,
} from "@/features/project-shell/lib/project-shell-navigation";
import ProjectAreaCatalog from "@/features/project-shell/ui/components/project-area-catalog";
import ProjectConfigurationForm from "@/features/project-shell/ui/forms/project-configuration-form";
import ProjectTagsSurface from "@/features/tags/ui/components/project-tags-surface";
import { ClientShellStatus } from "@/features/web-macos-client/ui/components/client-shell";
import WorkDraftForm from "@/features/work-drafts/ui/forms/work-draft-form";
import ProjectWorkList from "@/features/work-lifecycle/ui/components/project-work-list";
import ScopeTreeView from "@/features/work-lifecycle/ui/components/scope-tree";

const PriorityMap = lazy(
  () => import("@/features/priority-metrics/ui/components/priority-map"),
);

export default function ProjectShellSurface({
  accountId,
  accountFormattingPreferences,
  project,
  projectId,
  scopeTreeQuery,
}: {
  accountId?: string;
  accountFormattingPreferences: AccountPreferences;
  project: ProjectProfile;
  projectId: string;
  scopeTreeQuery: UseQueryResult<ScopeTree>;
}) {
  const activeHash = useLocation({ select: ({ hash }) => hash });
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

  useEffect(() => {
    if (!activeHash || typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(activeHash)?.scrollIntoView({
        block: "start",
        behavior: "auto",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeHash]);

  const {
    configuration,
    name,
    revision,
    shortCode,
    starterConfiguration,
    status,
  } = project;

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

  const projectSurface = (() => {
    if (activeHash === "tags") {
      return <ProjectTagsSurface projectId={projectId} />;
    }

    if (activeHash === "all-tools" || activeHash.startsWith("project-area-")) {
      return (
        <ProjectAreaCatalog
          baseRevision={revision}
          configuration={configuration}
          configurationMode={configurationMode}
          projectId={projectId}
        />
      );
    }

    if (isWorkSurfaceHash(activeHash)) {
      return (
        <ProjectWorkSurface
          accountFormattingPreferences={accountFormattingPreferences}
          accountId={accountId}
          activeAction={dailyAction}
          activeHash={activeHash}
          configuration={configuration}
          projectId={projectId}
        />
      );
    }

    if (
      activeHash === "documents" &&
      configuration.enabledAreas.includes("Documents") &&
      !configuration.hiddenAreas.includes("Documents")
    ) {
      return <FileAttachmentsSurface projectId={projectId} />;
    }

    return (
      <>
        <ProjectOverviewView
          accountFormattingPreferences={accountFormattingPreferences}
          project={project}
        />

        <ScopeTreeSection query={scopeTreeQuery} />

        <section
          aria-label="Project Shell configuration summary"
          className="space-y-8 border-border/70 border-t pt-8"
          id="project-shell-configuration-summary"
        >
          <div className="grid items-start gap-x-10 gap-y-8 lg:grid-cols-2">
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
            <EnabledAreasList
              areas={configuration.enabledAreas.filter(
                (area) => !configuration.hiddenAreas.includes(area),
              )}
            />
          </div>
        </section>
      </>
    );
  })();

  return (
    <>
      <header className="surface-header">
        <Link
          className={`${buttonVariants({ variant: "ghost", size: "sm" })} mb-6 -ml-3 min-h-11`}
          to="/projects"
        >
          <ArrowLeft aria-hidden="true" />
          Projects
        </Link>
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_15rem] sm:items-end sm:gap-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-balance font-semibold text-3xl tracking-tight">
                {name}
              </h1>
              <Badge variant="secondary">{status}</Badge>
            </div>
            <p className="mt-2 max-w-xl text-muted-foreground text-sm/relaxed">
              A durable home for this Project’s work and context.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-5 border-t pt-4 sm:grid-cols-1 sm:gap-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
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
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-border/70 border-t pt-5">
          <div>
            <p className="font-medium text-sm">Configuration Mode</p>
            <p className="mt-1 text-muted-foreground text-xs/relaxed">
              Separate Project structure from daily Work editing.
            </p>
          </div>
          <Button
            aria-pressed={configurationMode}
            className="min-h-11"
            onClick={toggleConfigurationMode}
            type="button"
            variant={configurationMode ? "default" : "outline"}
          >
            {configurationMode ? (
              <X aria-hidden="true" />
            ) : (
              <Settings2 aria-hidden="true" />
            )}
            {configurationMode
              ? "Exit Configuration Mode"
              : "Configuration Mode"}
          </Button>
        </div>
      </header>

      {showExplanation ? (
        <aside
          aria-label="Starter Configuration explanation"
          className="mt-5 flex items-start gap-3 rounded-lg border border-border/70 bg-card/55 p-4 shadow-sm"
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

      {activeHash === DAILY_ACTION_HASHES.Create ? null : (
        <div className="mt-5">
          <ClientShellStatus
            accountFormattingPreferences={accountFormattingPreferences}
            presentation="inline"
          />
        </div>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10">
        <ProjectNavigation
          enabledAreas={configuration.enabledAreas}
          extraPinnedAreas={configuration.extraPinnedAreas}
          hiddenAreas={configuration.hiddenAreas}
        />

        <div className="min-w-0 space-y-10">
          {configurationMode ? (
            <ProjectConfigurationForm
              baseRevision={revision}
              configuration={configuration}
              configurationHost={configurationHost}
              onConfigurationHostChange={setConfigurationHost}
              projectId={projectId}
              projectName={name}
              starterConfiguration={starterConfiguration}
            />
          ) : null}

          {projectSurface}
        </div>
      </div>
    </>
  );
}

function ProjectWorkSurface({
  accountId,
  activeHash,
  activeAction,
  accountFormattingPreferences,
  configuration,
  projectId,
}: {
  accountId?: string;
  activeHash: string;
  activeAction: DailyAction | null;
  accountFormattingPreferences: AccountPreferences;
  configuration: ProjectShellConfiguration;
  projectId: string;
}) {
  return (
    <section
      aria-labelledby="work-surface-heading"
      className="space-y-8"
      id="work"
    >
      <header className="surface-header max-w-3xl">
        <h2
          className="text-balance font-semibold text-2xl tracking-tight"
          id="work-surface-heading"
        >
          Work
        </h2>
        <p className="mt-3 text-muted-foreground text-sm/relaxed">
          Daily actions stay separate from Overview source records. Start, edit,
          and review this Project’s Work here.
        </p>
      </header>

      <nav aria-label="Work views" className="flex flex-wrap gap-2">
        <Link
          aria-current={activeHash === PRIORITY_MAP_HASH ? undefined : "page"}
          className={`${buttonVariants({
            size: "sm",
            variant: activeHash === PRIORITY_MAP_HASH ? "ghost" : "secondary",
          })} min-h-10`}
          hash="work"
          params={{ projectId }}
          to="/projects/$projectId"
        >
          Work
        </Link>
        <Link
          aria-current={activeHash === PRIORITY_MAP_HASH ? "page" : undefined}
          className={`${buttonVariants({
            size: "sm",
            variant: activeHash === PRIORITY_MAP_HASH ? "secondary" : "ghost",
          })} min-h-10`}
          hash={PRIORITY_MAP_HASH}
          params={{ projectId }}
          to="/projects/$projectId"
        >
          Priority Map
        </Link>
      </nav>

      {activeHash === PRIORITY_MAP_HASH ? (
        <Suspense
          fallback={
            <p className="text-muted-foreground text-sm" role="status">
              Loading…
            </p>
          }
        >
          <PriorityMap projectId={projectId} />
        </Suspense>
      ) : (
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_14rem] xl:gap-10">
          <div className="min-w-0">
            <DailyWorkActions
              accountFormattingPreferences={accountFormattingPreferences}
              activeAction={activeAction}
              projectId={projectId}
            />
            <ProjectWorkList
              accountFormattingPreferences={accountFormattingPreferences}
              accountId={accountId}
              projectId={projectId}
              workContextLayouts={configuration.workContextLayouts}
              workStatusLabels={configuration.workStatusLabels}
            />
            <PrioritizationSurface projectId={projectId} />
          </div>
          <aside className="border-border/70 border-t pt-5 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6">
            <p className="surface-kicker">Saved views</p>
            <ul aria-label="Saved views" className="mt-3 space-y-1">
              {configuration.preparedWorkViews.map((view) => (
                <li
                  className="rounded-md px-2.5 py-2 text-muted-foreground text-sm"
                  key={view}
                >
                  {view}
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </section>
  );
}

function ScopeTreeSection({
  query,
}: {
  query: {
    data: ScopeTree | undefined;
    isError: boolean;
    isPending: boolean;
  };
}) {
  if (query.isPending) {
    return (
      <section aria-labelledby="scope-tree-heading" className="mt-10">
        <h2 className="sr-only" id="scope-tree-heading">
          Scope Tree
        </h2>
        <p className="text-muted-foreground text-sm">Loading Scope Tree…</p>
      </section>
    );
  }

  if (query.isError) {
    return (
      <section aria-labelledby="scope-tree-heading" className="mt-10">
        <h2 className="sr-only" id="scope-tree-heading">
          Scope Tree
        </h2>
        <p className="text-destructive text-sm" role="alert">
          Scope Tree is unavailable. Try loading this page again.
        </p>
      </section>
    );
  }

  if (!query.data) {
    return null;
  }

  return <ScopeTreeView scopeTree={query.data} />;
}

function DailyWorkActions({
  accountFormattingPreferences,
  activeAction,
  projectId,
}: {
  accountFormattingPreferences: AccountPreferences;
  activeAction: DailyAction | null;
  projectId: string;
}) {
  return (
    <section aria-labelledby="daily-actions-heading" className="mb-6">
      <h3 className="sr-only" id="daily-actions-heading">
        Daily actions
      </h3>
      <div className="flex flex-wrap gap-2 border-border/70 border-b pb-4">
        {DAILY_ACTIONS.map((action) => (
          <DailyActionLink
            action={action}
            activeAction={activeAction}
            key={action}
          />
        ))}
      </div>
      {activeAction ? (
        <DailyActionHost
          accountFormattingPreferences={accountFormattingPreferences}
          action={activeAction}
          projectId={projectId}
        />
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
      className={`${buttonVariants({
        size: "sm",
        variant: dailyActionVariant(action, activeAction),
      })} min-h-10`}
    >
      {action}
    </a>
  );
}

function dailyActionVariant(
  action: DailyAction,
  activeAction: DailyAction | null,
) {
  if (activeAction === action) {
    return "secondary" as const;
  }
  if (action === "Create") {
    return "default" as const;
  }
  return "outline" as const;
}

function DailyActionHost({
  accountFormattingPreferences,
  action,
  projectId,
}: {
  accountFormattingPreferences: AccountPreferences;
  action: DailyAction;
  projectId: string;
}) {
  const hostId = DAILY_ACTION_HASHES[action];

  return (
    <section
      aria-labelledby={`${hostId}-heading`}
      className="mt-4 rounded-md border border-border/70 bg-card/45 p-4 text-muted-foreground text-sm"
      id={hostId}
    >
      <h4 className="font-medium text-foreground" id={`${hostId}-heading`}>
        {action}
      </h4>
      {action === "Create" ? (
        <WorkDraftForm
          accountFormattingPreferences={accountFormattingPreferences}
          projectId={projectId}
        />
      ) : (
        <p className="mt-1">{DAILY_ACTION_MESSAGES[action]}</p>
      )}
    </section>
  );
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
    <aside className="min-w-0 lg:sticky lg:top-4 lg:self-start">
      <div className="mb-3 hidden px-2 lg:block">
        <p className="surface-kicker">Project navigation</p>
      </div>
      <nav
        aria-label="Project navigation"
        className="flex min-w-0 gap-1 overflow-x-auto border-border/70 border-b pb-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:pb-0"
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
            className="mx-1 hidden h-px bg-border lg:my-2 lg:block"
          />
        ) : null}
        {visiblePinnedAreas.map((area) => (
          <ProjectNavigationLink
            activeSurface={activeSurface}
            hash={navigationHash(area)}
            key={area}
            surface={area}
          />
        ))}
      </nav>
    </aside>
  );
}

function ProjectNavigationLink({
  activeSurface,
  hash,
  surface,
}: {
  activeSurface: NavigationSurface;
  hash: string;
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
      className={`${NAVIGATION_LINK_BASE} ${navigationLinkStateClass(isActive)}`}
    >
      {surface}
    </a>
  );
}

function navigationLinkStateClass(isActive: boolean) {
  return isActive
    ? "bg-accent text-accent-foreground"
    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground";
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
      className="border-border/70 border-t pt-5"
    >
      <h2
        className="font-medium text-base"
        id={`${label.toLowerCase().replaceAll(" ", "-")}-heading`}
      >
        {label}
      </h2>
      <ul
        aria-label={label}
        className="mt-3 divide-y rounded-md border border-border/70 bg-card/45"
      >
        {items.map((item) => (
          <li
            className="px-3 py-2.5 text-sm first:rounded-t-md last:rounded-b-md"
            key={item}
          >
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
      className="border-border/70 border-t pt-5"
    >
      <h2 className="font-medium text-base" id="enabled-project-areas-heading">
        Project areas
      </h2>
      <ul
        aria-label="Enabled Project areas"
        className="mt-3 divide-y rounded-md border border-border/70 bg-card/45"
      >
        {areas.map((area) => (
          <li
            className="px-3 py-2.5 text-sm first:rounded-t-md last:rounded-b-md"
            key={area}
          >
            {area}
          </li>
        ))}
      </ul>
    </section>
  );
}
