import type { TrashEntry } from "@cantiara/api/trash";
import type { TrashEarlyDeletePreview } from "@cantiara/api/trash-early-delete";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import {
  PrivateWriteFailure,
  privateWriteNotice,
} from "@/features/web-macos-client/lib/support-reference";
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
  const confirmation = useRef<{
    session: number;
    grant: string;
    typedName: string;
  } | null>(null);
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
      session: number;
    }) => {
      const approved = confirmation.current;
      if (!(permanentDelete && approved?.session === request.session)) {
        throw new Error("Confirm GitHub Identity again.");
      }
      confirmation.current = null;
      try {
        await permanentDelete.permanentlyDelete(request.entry, {
          grant: approved.grant,
          typedName: approved.typedName,
          clientIdempotencyKey: request.clientIdempotencyKey,
        });
      } catch (failure) {
        // biome-ignore lint/style/useErrorCause: Only approved Support fields can enter MutationCache.
        throw new PrivateWriteFailure(
          failure,
          "Could not permanently delete. Check the name and confirm again.",
        );
      }
    },
    onSettled: (_, _error, { entry, session: viewed }) => {
      if (confirmation.current?.session === viewed) {
        confirmation.current = null;
      }
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
      confirmation.current = {
        session: session.current,
        grant: grant.current,
        typedName,
      };
      grant.current = null;
      identity.reset();
      const previous = lastAttempt.current;
      const request = commandVariables(
        { entry: deleting.entry },
        previous?.typedName === typedName ? previous.request : undefined,
      );
      lastAttempt.current = { typedName, request };
      await commit
        .mutateAsync({ ...request, session: session.current })
        .catch(() => undefined);
    },
    deleting,
    error,
    support: commit.error ? privateWriteNotice(commit.error) : null,
    async review(entry: TrashEntry) {
      reset();
      if (permanentDelete) {
        await inspect.mutateAsync(entry).catch(() => undefined);
      }
    },
  };
}
