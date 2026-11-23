import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ProjectProfile } from "@cantiara/api/project-shell";
import {
  cloneWorkspaceOverviewSavedListDefinition,
  type WorkspaceOverviewModel,
  type WorkspaceOverviewModuleId,
  type WorkspaceOverviewPresentation,
  workspaceOverviewSavedListDefinitionSchema,
  workspaceOverviewSavedListHref,
} from "@cantiara/api/workspace-overview";
import { buttonVariants } from "@cantiara/ui/components/button";
import {
  VirtualList,
  virtualRowId,
} from "@cantiara/ui/components/virtual-list";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { Plus } from "lucide-react";
import { useCallback } from "react";
import WorkspaceOverviewView from "@/features/workspace-overview/ui/components/workspace-overview";
import {
  accountPreferencesQueryOptions,
  orpc,
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
  const editors = useCreateStore<readonly string[]>([]);
  const editingProjects = useSelector(editors);
  const trackEditor = useCallback(
    (id: string, editing: boolean) => {
      editors.setState((current) => {
        if (current.includes(id) === editing) {
          return current;
        }
        return editing ? [...current, id] : current.filter((key) => key !== id);
      });
    },
    [editors],
  );
  return (
    <section aria-labelledby="projects-list-heading" className="pt-9">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2
          className="text-lg font-semibold tracking-tight"
          id="projects-list-heading"
        >
          Your Projects
        </h2>
        {data ? (
          <span className="text-xs text-muted-foreground">
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
        <VirtualList
          className="divide-y border-y border-border/70"
          estimateSize={100}
          gap={12}
          getKey={virtualRowId}
          keepMounted={editingProjects}
          rows={data}
        >
          {(project, rowProps) => (
            <ProjectRow
              onEditingChange={trackEditor}
              project={project}
              rowProps={rowProps}
            />
          )}
        </VirtualList>
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
  const overviewOptions = workspaceOverviewQueryOptions(accountId);
  const workspaceOverview = useQuery(overviewOptions);
  const accountPreferences = useQuery(
    accountPreferencesQueryOptions(accountId),
  );
  const queryClient = useQueryClient();
  const saveWorkspaceOverview = useMutation(
    orpc.saveWorkspaceOverviewPresentation.mutationOptions({
      meta: { onlineWrite: true, retryInSurface: true },
      scope: {
        id: `workspace-overview-presentation:${accountId ?? "anonymous"}`,
      },
      onMutate: async (presentation) => {
        await queryClient.cancelQueries({
          exact: true,
          queryKey: overviewOptions.queryKey,
        });
        const previous = queryClient.getQueryData<WorkspaceOverviewModel>(
          overviewOptions.queryKey,
        );
        if (previous) {
          queryClient.setQueryData(overviewOptions.queryKey, {
            ...previous,
            layout: presentation.layout,
            liveBlockSources: presentation.liveBlockSources,
            savedLists:
              presentation.savedLists?.map((definition) => ({
                ...workspaceOverviewSavedListDefinitionSchema.parse(definition),
                href: workspaceOverviewSavedListHref(definition.id),
                projects:
                  previous.savedLists.find(({ id }) => id === definition.id)
                    ?.projects ?? [],
              })) ?? previous.savedLists,
          } satisfies WorkspaceOverviewModel);
        }
        return previous;
      },
      onError: (_, __, previous) => {
        if (previous) {
          queryClient.setQueryData(overviewOptions.queryKey, previous);
        }
      },
      onSuccess: (overview) => {
        queryClient.setQueryData(overviewOptions.queryKey, overview);
      },
      onSettled: () =>
        queryClient.invalidateQueries({
          exact: true,
          queryKey: overviewOptions.queryKey,
        }),
    }),
  );
  function handlePresentationChange(
    presentation: WorkspaceOverviewPresentation,
  ) {
    return saveWorkspaceOverview.mutateAsync({
      layout: {
        hidden: [...presentation.layout.hidden],
        order: [...presentation.layout.order],
      },
      liveBlockSources: [...presentation.liveBlockSources],
      savedLists: presentation.savedLists?.map(
        cloneWorkspaceOverviewSavedListDefinition,
      ),
      version: presentation.version,
    });
  }

  return (
    <main className="surface-frame max-w-6xl">
      <header className="surface-header flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance">
            Projects
          </h1>
          <p className="mt-3 text-sm/6 text-pretty text-muted-foreground">
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

      {workspaceOverview.status === "pending" ? (
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
        <fieldset
          className={
            selectedModule || selectedSavedList
              ? "pt-1"
              : "mt-12 border-t border-border/80 pt-9"
          }
          disabled={saveWorkspaceOverview.isPending}
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
        </fieldset>
      ) : null}
      {saveWorkspaceOverview.isError ? (
        <p className="pt-3 text-sm text-destructive" role="alert">
          Workspace overview settings could not be saved. Try again.
        </p>
      ) : null}
    </main>
  );
}
