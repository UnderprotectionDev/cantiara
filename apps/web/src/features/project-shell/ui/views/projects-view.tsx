import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import type {
  WorkspaceOverviewModuleId,
  WorkspaceOverviewPresentation,
} from "@cantiara/api/workspace-overview";
import { cloneWorkspaceOverviewSavedListDefinition } from "@cantiara/api/workspace-overview";
import { buttonVariants } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback, useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import WorkspaceOverviewView from "@/features/workspace-overview/ui/components/workspace-overview";
import {
  accountPreferencesQueryOptions,
  client,
  projectsQueryOptions,
  workspaceOverviewQueryOptions,
} from "@/utils/orpc";

import ProjectRow from "../components/project-row";
import {
  ProjectsEmptyState,
  ProjectsSkeleton,
} from "../components/projects-list-states";

function ProjectsListSection({
  data,
  isError,
  isPending,
}: {
  data: readonly ProjectProfile[] | undefined;
  isError: boolean;
  isPending: boolean;
}) {
  return (
    <section aria-labelledby="projects-list-heading" className="pt-9">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2
          className="font-semibold text-lg tracking-tight"
          id="projects-list-heading"
        >
          Your Projects
        </h2>
        {data ? (
          <span className="text-muted-foreground text-xs">
            {data.length} {data.length === 1 ? "Project" : "Projects"}
          </span>
        ) : null}
      </div>

      {isPending ? <ProjectsSkeleton /> : null}
      {isError ? (
        <div className="border-y py-8 text-sm" role="alert">
          <p className="font-medium">Project is unavailable.</p>
          <p className="mt-1 text-muted-foreground">
            Try loading this page again.
          </p>
        </div>
      ) : null}
      {data?.length === 0 ? <ProjectsEmptyState /> : null}
      {data && data.length > 0 ? (
        <ul className="divide-y border-border/70 border-y">
          {data.map((project) => (
            <ProjectRow key={project.id} project={project} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export default function ProjectsView({
  accountId,
  selectedModule,
  selectedSavedList,
}: {
  accountId?: string;
  selectedModule?: WorkspaceOverviewModuleId;
  selectedSavedList?: string;
}) {
  const projects = useQuery(projectsQueryOptions());
  const workspaceOverview = useQuery(workspaceOverviewQueryOptions(accountId));
  const accountPreferences = useQuery(
    accountPreferencesQueryOptions(accountId),
  );
  const queryClient = useQueryClient();
  // Serialize saves so requests reach the server and responses resolve in
  // issue order; concurrent saves could otherwise resolve out of order and
  // overwrite the cached overview with an older layout.
  const lastOverviewSaveRef = useRef<Promise<unknown>>(Promise.resolve());
  const saveWorkspaceOverview = useMutation({
    mutationFn: (presentation: WorkspaceOverviewPresentation) => {
      const request = lastOverviewSaveRef.current.then(() =>
        runOnlineOnlyWrite(() =>
          client.saveWorkspaceOverviewPresentation({
            layout: {
              hidden: [...presentation.layout.hidden],
              order: [...presentation.layout.order],
            },
            liveBlockSources: presentation.liveBlockSources.map((source) => ({
              ...source,
            })),
            savedLists: presentation.savedLists?.map(
              cloneWorkspaceOverviewSavedListDefinition,
            ),
            version: presentation.version,
          }),
        ),
      );
      lastOverviewSaveRef.current = request.catch(() => undefined);
      return request;
    },
    scope: {
      id: `workspace-overview-presentation:${accountId ?? "anonymous"}`,
    },
    onSuccess: (nextOverview) => {
      queryClient.setQueryData(
        workspaceOverviewQueryOptions(accountId).queryKey,
        nextOverview,
      );
    },
  });
  const handlePresentationChange = useCallback(
    (presentation: WorkspaceOverviewPresentation) =>
      saveWorkspaceOverview.mutate(presentation),
    [saveWorkspaceOverview],
  );

  return (
    <main className="surface-frame max-w-6xl">
      <header className="surface-header flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="mt-2 text-balance font-semibold text-3xl tracking-tight">
            Projects
          </h1>
          <p className="mt-3 text-pretty text-muted-foreground text-sm/6">
            Give each line of work a durable home. Start with the essentials;
            add context when the Project needs it.
          </p>
        </div>
        {selectedModule || selectedSavedList ? (
          <Link
            className={`${buttonVariants({ size: "sm", variant: "outline" })} min-h-11`}
            to="/projects"
          >
            Back to Projects
          </Link>
        ) : (
          <Link
            className={`${buttonVariants({ size: "sm" })} min-h-11`}
            to="/projects/new"
          >
            <Plus aria-hidden="true" />
            Create Project
          </Link>
        )}
      </header>

      {selectedModule || selectedSavedList ? null : (
        <ProjectsListSection
          data={projects.data}
          isError={projects.isError}
          isPending={projects.isPending}
        />
      )}

      {workspaceOverview.isPending ? (
        <section
          aria-label="Loading Workspace overview"
          className="space-y-4 pt-9"
          data-workspace-overview-loading="true"
          role="status"
        >
          <div className="h-7 w-56 animate-pulse bg-muted" />
          <div className="h-4 w-full max-w-xl animate-pulse bg-muted" />
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((item) => (
              <div
                className="h-44 animate-pulse rounded-lg border border-border/70 bg-muted/30"
                key={item}
              />
            ))}
          </div>
          <span className="sr-only">Loading…</span>
        </section>
      ) : null}
      {workspaceOverview.isError ? (
        <div className="border-y py-6 text-sm" role="alert">
          <p className="font-medium">Workspace overview is unavailable.</p>
          <p className="mt-1 text-muted-foreground">
            Your Projects are still available above. Try loading this page again
            to see the source-backed horizon.
          </p>
        </div>
      ) : null}
      {workspaceOverview.data ? (
        <div
          className={
            selectedModule || selectedSavedList
              ? "pt-1"
              : "mt-12 border-border/80 border-t pt-9"
          }
        >
          <WorkspaceOverviewView
            formattingPreferences={
              accountPreferences.data ?? DEFAULT_ACCOUNT_PREFERENCES
            }
            model={workspaceOverview.data}
            onPresentationChange={handlePresentationChange}
            selectedModule={selectedModule}
            selectedSavedList={selectedSavedList}
          />
        </div>
      ) : null}
      {saveWorkspaceOverview.isError ? (
        <p className="pt-3 text-destructive text-sm" role="alert">
          Workspace overview settings could not be saved. Try again.
        </p>
      ) : null}
    </main>
  );
}
