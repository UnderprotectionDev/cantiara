import type {
  MoveToTrashPreview,
  TrashSurfaceDisposition,
} from "@cantiara/api/trash";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { commandVariables } from "@/lib/command-variables";
import { orpc } from "@/utils/orpc";
import { refreshTrashQueries } from "../lib/refresh-trash-queries";
import type { TrashCandidate } from "../lib/trash-candidates";

function candidateKey(candidate: TrashCandidate) {
  return `${candidate.kind}:${candidate.id}`;
}

export function useMoveToTrashFlow({
  onMove,
  onPreview,
  projectId,
}: {
  onMove: (
    candidate: TrashCandidate,
    disposition: TrashSurfaceDisposition,
    clientIdempotencyKey: string,
  ) => Promise<unknown>;
  onPreview: (candidate: TrashCandidate) => Promise<MoveToTrashPreview>;
  projectId: string;
}) {
  const queryClient = useQueryClient();
  const inspect = useMutation({ mutationFn: onPreview });
  const move = useMutation({
    mutationKey: orpc.moveToTrash.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({
      candidate,
      disposition,
      clientIdempotencyKey,
    }: {
      candidate: TrashCandidate;
      disposition: TrashSurfaceDisposition;
      clientIdempotencyKey: string;
    }) => onMove(candidate, disposition, clientIdempotencyKey),
    onSettled: (_, _error, { candidate }) =>
      refreshTrashQueries(queryClient, {
        projectId,
        recordId: candidate.id,
        recordKind: candidate.kind,
      }),
  });
  let pending: string | null = null;
  let failed: string | null = null;
  if (inspect.isPending) {
    pending = candidateKey(inspect.variables);
  } else if (move.isPending) {
    pending = candidateKey(move.variables.candidate);
  }
  if (inspect.isError) {
    failed = candidateKey(inspect.variables);
  } else if (move.isError) {
    failed = candidateKey(move.variables.candidate);
  }
  const reviewing =
    inspect.isSuccess && !move.isSuccess
      ? { candidate: inspect.variables, preview: inspect.data }
      : null;
  return {
    cancel: () => {
      inspect.reset();
      move.reset();
    },
    async confirm(disposition: TrashSurfaceDisposition) {
      if (reviewing && !move.isPending) {
        await move
          .mutateAsync(
            commandVariables(
              { candidate: reviewing.candidate, disposition },
              move.isError ? move.variables : undefined,
            ),
          )
          .catch(() => undefined);
      }
    },
    failed,
    pending,
    async review(candidate: TrashCandidate) {
      move.reset();
      await inspect.mutateAsync(candidate).catch(() => undefined);
    },
    reviewing,
  };
}
