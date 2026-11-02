import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

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

/**
 * `Archive Project` and `Unarchive`, online only, on the shared revision
 * barrier: the revision comes from the preview or the Archive view, and a
 * stale one conflicts instead of overwriting.
 */
export function useRetirementTransition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      action: "archive" | "unarchive";
      baseRevision: number;
      projectId: string;
    }) => {
      const { action, ...command } = input;
      const body = { ...command, clientIdempotencyKey: crypto.randomUUID() };
      return runOnlineOnlyWrite(() =>
        action === "archive"
          ? client.archiveProject(body)
          : client.unarchiveProject(body),
      );
    },
    onSettled: () => queryClient.invalidateQueries(),
  });
}
