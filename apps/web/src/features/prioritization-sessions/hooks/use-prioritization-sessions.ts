import type { PrioritizationSession } from "@cantiara/api/prioritization-sessions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
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

  const createSession = usePreparedMutation(
    orpc.createPrioritizationSession.mutationOptions({
      mutationFn: (input) => client.createPrioritizationSession(input),
      onSuccess: invalidate,
    }),
    (input: { name: string; workIds: string[] }) => ({
      ...input,
      baseRevision: 0,
      projectId,
    }),
  );

  const updateSessionOrder = usePreparedMutation(
    orpc.updatePrioritizationSessionOrder.mutationOptions({
      mutationFn: (input) => client.updatePrioritizationSessionOrder(input),
      onSuccess: invalidate,
    }),
    (input: { session: PrioritizationSession; workIds: string[] }) => ({
      baseRevision: input.session.revision,
      sessionId: input.session.id,
      workIds: input.workIds,
    }),
  );

  const closeSession = usePreparedMutation(
    orpc.closePrioritizationSession.mutationOptions({
      mutationFn: (input) => client.closePrioritizationSession(input),
      onSuccess: invalidate,
    }),
    (session: PrioritizationSession) => ({
      baseRevision: session.revision,
      sessionId: session.id,
    }),
  );

  const trashSession = usePreparedMutation(
    orpc.trashPrioritizationSession.mutationOptions({
      mutationFn: (input) => client.trashPrioritizationSession(input),
      onSuccess: invalidate,
    }),
    (session: PrioritizationSession) => ({
      baseRevision: session.revision,
      sessionId: session.id,
    }),
  );

  const restoreSession = usePreparedMutation(
    orpc.restorePrioritizationSession.mutationOptions({
      mutationFn: (input) => client.restorePrioritizationSession(input),
      onSuccess: invalidate,
    }),
    (session: PrioritizationSession) => ({
      baseRevision: session.revision,
      sessionId: session.id,
    }),
  );

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
