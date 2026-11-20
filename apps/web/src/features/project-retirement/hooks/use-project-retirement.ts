import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";

/** The `Archive` view: archived Projects, living surfaces and open security actions. */
export function useArchivedProjects() {
  return useQuery(orpc.listArchivedProjects.queryOptions({ input: {} }));
}

/** The archive preview, read only when the founder asks for it. */
export function useArchivePreview(projectId: string, enabled: boolean) {
  return useQuery(
    orpc.previewArchiveProject.queryOptions({
      enabled,
      input: { projectId },
    }),
  );
}

/** The Delete Project preview; the server refuses a Project that is not archived. */
export function useDeletePreview(projectId: string | null) {
  return useQuery(
    orpc.previewDeleteProject.queryOptions({
      enabled: projectId !== null,
      input: { projectId: projectId ?? "" },
    }),
  );
}

function invalidateRetirementQueries(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return async (
    _: unknown,
    __: unknown,
    { projectId }: { projectId: string },
  ) => {
    await Promise.all([
      ...[
        orpc.listArchivedProjects.key(),
        orpc.previewArchiveProject.queryKey({ input: { projectId } }),
        orpc.previewDeleteProject.queryKey({ input: { projectId } }),
        orpc.project.queryKey({ input: { projectId } }),
        orpc.projects.key(),
        orpc.projectWorks.queryKey({ input: { projectId } }),
        orpc.documents.key(),
        orpc.projectScreens.key(),
        orpc.projectDecisions.key(),
        orpc.projectRisks.key(),
        orpc.searchRecords.key(),
        orpc.workspaceOverview.key(),
        orpc.listExternalSurfaces.key(),
        orpc.projectGitHubOverview.key(),
        orpc.trash.key(),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ...invalidateSmartCollectionMembership(queryClient),
    ]);
  };
}

/** `Delete Project`: online only, never carries a surface disposition. */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  return usePreparedMutation(
    orpc.deleteProject.mutationOptions({
      mutationFn: (input) => client.deleteProject(input),
      onSettled: invalidateRetirementQueries(queryClient),
    }),
    (input: { baseRevision: number; projectId: string }) => ({
      ...input,
    }),
  );
}

/** `Restore to Archive`: online only; the entry and its revision come from the Archive view. */
export function useRestoreToArchive() {
  const queryClient = useQueryClient();
  return usePreparedMutation(
    orpc.restoreProjectToArchive.mutationOptions({
      mutationFn: (input) => client.restoreProjectToArchive(input),
      onSettled: invalidateRetirementQueries(queryClient),
    }),
    (input: { baseRevision: number; entryId: string; projectId: string }) => ({
      ...input,
    }),
  );
}

/**
 * `Archive Project` and `Unarchive`, online only, on the shared revision
 * barrier: the revision comes from the preview or the Archive view, and a
 * stale one conflicts instead of overwriting.
 */
export function useRetirementTransition() {
  const queryClient = useQueryClient();
  return usePreparedMutation(
    {
      mutationFn: ({
        action,
        ...command
      }: {
        action: "archive" | "unarchive";
        baseRevision: number;
        clientIdempotencyKey: string;
        projectId: string;
      }) =>
        action === "archive"
          ? client.archiveProject(command)
          : client.unarchiveProject(command),
      onSettled: invalidateRetirementQueries(queryClient),
    },
    (input: {
      action: "archive" | "unarchive";
      baseRevision: number;
      projectId: string;
    }) => input,
  );
}
