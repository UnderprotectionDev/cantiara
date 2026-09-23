import type { PrioritizationSession } from "@cantiara/api/prioritization-sessions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export function usePrioritizationSessions(projectId: string) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery(
    orpc.prioritizationSessions.queryOptions({ input: { projectId } }),
  );
  const backlogQuery = useQuery(
    orpc.projectBacklogOrder.queryOptions({ input: { projectId } }),
  );
  const allWorkQuery = useQuery(
    orpc.projectWorks.queryOptions({ input: { archived: "all", projectId } }),
  );

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: orpc.prioritizationSessions.queryOptions({
          input: { projectId },
        }).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: orpc.projectBacklogOrder.queryOptions({
          input: { projectId },
        }).queryKey,
      }),
    ]);
  }

  const createSession = useMutation({
    mutationFn: (input: { name: string; workIds: string[] }) =>
      runOnlineOnlyWrite(() =>
        client.createPrioritizationSession({
          ...input,
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
        }),
      ),
    onSuccess: invalidate,
  });

  const updateSessionOrder = useMutation({
    mutationFn: (input: {
      session: PrioritizationSession;
      workIds: string[];
    }) =>
      runOnlineOnlyWrite(() =>
        client.updatePrioritizationSessionOrder({
          baseRevision: input.session.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          sessionId: input.session.id,
          workIds: input.workIds,
        }),
      ),
    onSuccess: invalidate,
  });

  const closeSession = useMutation({
    mutationFn: (session: PrioritizationSession) =>
      runOnlineOnlyWrite(() =>
        client.closePrioritizationSession({
          baseRevision: session.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          sessionId: session.id,
        }),
      ),
    onSuccess: invalidate,
  });

  const trashSession = useMutation({
    mutationFn: (session: PrioritizationSession) =>
      runOnlineOnlyWrite(() =>
        client.trashPrioritizationSession({
          baseRevision: session.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          sessionId: session.id,
        }),
      ),
    onSuccess: invalidate,
  });

  const restoreSession = useMutation({
    mutationFn: (session: PrioritizationSession) =>
      runOnlineOnlyWrite(() =>
        client.restorePrioritizationSession({
          baseRevision: session.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          sessionId: session.id,
        }),
      ),
    onSuccess: invalidate,
  });

  const updateBacklogOrder = useMutation({
    mutationFn: (workIds: string[]) => {
      const order = backlogQuery.data;
      if (!order) {
        throw new Error("Backlog order is unavailable.");
      }
      return runOnlineOnlyWrite(() =>
        client.updateBacklogOrder({
          baseRevision: order.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
          workIds,
        }),
      );
    },
    onSuccess: invalidate,
  });

  return {
    allWorkQuery,
    backlogQuery,
    closeSession,
    createSession,
    restoreSession,
    sessionQuery,
    trashSession,
    updateBacklogOrder,
    updateSessionOrder,
  };
}
