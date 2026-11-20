import type { TrashEntry } from "@cantiara/api/trash";
import type { TrashEarlyDeletePreview } from "@cantiara/api/trash-early-delete";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { commandVariables } from "@/lib/command-variables";
import { orpc } from "@/utils/orpc";
import { refreshTrashQueries } from "../lib/refresh-trash-queries";

export interface TrashPermanentDelete {
  confirmIdentity: () => Promise<string>;
  permanentlyDelete: (
    entry: TrashEntry,
    confirmation: {
      grant: string;
      typedName: string;
      clientIdempotencyKey: string;
    },
  ) => Promise<unknown>;
  preview: (entry: TrashEntry) => Promise<TrashEarlyDeletePreview>;
}

export function usePermanentDeleteFlow(permanentDelete?: TrashPermanentDelete) {
  const queryClient = useQueryClient();
  const session = useRef(0);
  const grant = useRef<string | null>(null);
  const confirmation = useRef<{ grant: string; typedName: string } | null>(
    null,
  );
  const lastAttempt = useRef<{
    typedName: string;
    request: { entry: TrashEntry; clientIdempotencyKey: string };
  } | null>(null);
  const inspect = useMutation({
    meta: { presentsSupportFailure: true },
    mutationFn: (entry: TrashEntry) =>
      permanentDelete?.preview(entry) ?? Promise.resolve(undefined),
  });
  const identity = useMutation({
    gcTime: 0,
    meta: {
      privateInput: true,
      presentsSupportFailure: true,
      onlineWrite: true,
    },
    mutationFn: async (opened: number) => {
      const approved = await permanentDelete?.confirmIdentity();
      if (session.current === opened) {
        grant.current = approved ?? null;
      }
    },
  });
  const commit = useMutation({
    mutationKey: orpc.permanentlyDeleteFromTrash.mutationKey(),
    gcTime: 0,
    meta: {
      privateInput: true,
      presentsSupportFailure: true,
      onlineWrite: true,
    },
    mutationFn: async (request: {
      entry: TrashEntry;
      clientIdempotencyKey: string;
    }) => {
      const approved = confirmation.current;
      confirmation.current = null;
      if (!(permanentDelete && approved)) {
        throw new Error("Confirm GitHub Identity again.");
      }
      try {
        await permanentDelete.permanentlyDelete(request.entry, {
          ...approved,
          clientIdempotencyKey: request.clientIdempotencyKey,
        });
      } catch {
        // biome-ignore lint/style/useErrorCause: The raw authentication error stays outside MutationCache.
        throw new Error(
          "Could not permanently delete. Check the name and confirm again.",
        );
      }
    },
    onSettled: (_, _error, { entry }) => {
      confirmation.current = null;
      return refreshTrashQueries(queryClient, entry);
    },
  });
  const deleting =
    inspect.isSuccess && inspect.data && !commit.isSuccess
      ? {
          entry: inspect.variables,
          grant: identity.isSuccess,
          identityPending: identity.isPending,
          preview: inspect.data,
        }
      : null;
  let error: string | null = null;
  if (inspect.isError) {
    error = "Could not load the Permanently Delete preview.";
  } else if (identity.isError) {
    error = "Confirm GitHub Identity could not be completed.";
  } else if (commit.isError) {
    error = "Could not permanently delete. Check the name and confirm again.";
  }

  function reset() {
    session.current += 1;
    grant.current = null;
    confirmation.current = null;
    lastAttempt.current = null;
    inspect.reset();
    identity.reset();
    commit.reset();
  }

  return {
    busy: commit.isPending,
    cancel: reset,
    async confirmIdentity() {
      if (
        permanentDelete &&
        deleting &&
        !identity.isPending &&
        !commit.isPending
      ) {
        commit.reset();
        await identity.mutateAsync(session.current).catch(() => undefined);
      }
    },
    async deleteForever(typedName: string) {
      if (!(permanentDelete && deleting && grant.current) || commit.isPending) {
        return;
      }
      confirmation.current = { grant: grant.current, typedName };
      grant.current = null;
      identity.reset();
      const previous = lastAttempt.current;
      const request = commandVariables(
        { entry: deleting.entry },
        previous?.typedName === typedName ? previous.request : undefined,
      );
      lastAttempt.current = { typedName, request };
      await commit.mutateAsync(request).catch(() => undefined);
    },
    deleting,
    error,
    async review(entry: TrashEntry) {
      reset();
      if (permanentDelete) {
        await inspect.mutateAsync(entry).catch(() => undefined);
      }
    },
  };
}
