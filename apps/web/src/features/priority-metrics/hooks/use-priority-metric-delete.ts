import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { requestGitHubIdentityGrant } from "@/features/account-access/lib/github-identity-confirmation";
import { PrivateWriteFailure } from "@/features/web-macos-client/lib/support-reference";
import { commandVariables } from "@/lib/command-variables";
import { client, orpc } from "@/utils/orpc";
import {
  type PriorityMetricRevisionArgs,
  usePriorityMetricInvalidation,
} from "./use-priority-metrics";

const IDENTITY_ERROR = "Confirm GitHub Identity could not be completed.";
const DELETE_ERROR = "Priority metric could not be permanently deleted.";

interface DeleteCommand extends PriorityMetricRevisionArgs {
  clientIdempotencyKey: string;
  projectId: string;
}

export function usePriorityMetricDelete(projectId: string) {
  const invalidate = usePriorityMetricInvalidation(projectId);
  const session = useRef(0);
  const grant = useRef<string | null>(null);
  const confirmation = useRef<{
    grant: string;
    session: number;
    typedProjectName: string;
  } | null>(null);
  const lastAttempt = useRef<DeleteCommand | undefined>(undefined);
  const identity = useMutation({
    gcTime: 0,
    meta: {
      onlineWrite: true,
      privateInput: true,
      presentsSupportFailure: true,
    },
    mutationFn: async (opened: number) => {
      try {
        const approved = await requestGitHubIdentityGrant(
          "early-permanent-delete",
        );
        if (session.current === opened) {
          grant.current = approved;
        }
      } catch (failure) {
        // biome-ignore lint/style/useErrorCause: Only approved Support fields can enter MutationCache.
        throw new PrivateWriteFailure(failure, IDENTITY_ERROR);
      }
    },
  });

  const commit = useMutation({
    gcTime: 0,
    meta: {
      onlineWrite: true,
      privateInput: true,
      presentsSupportFailure: true,
    },
    mutationKey: orpc.deletePriorityMetric.mutationKey(),
    mutationFn: async ({
      session: opened,
      ...command
    }: DeleteCommand & { session: number }) => {
      const privateInput = confirmation.current;
      if (privateInput?.session !== opened || session.current !== opened) {
        throw new Error("Confirm GitHub Identity again.");
      }
      confirmation.current = null;
      try {
        await client.deletePriorityMetric({
          ...command,
          grant: privateInput.grant,
          typedProjectName: privateInput.typedProjectName,
        });
      } catch (failure) {
        // biome-ignore lint/style/useErrorCause: Only approved Support fields can enter MutationCache.
        throw new PrivateWriteFailure(failure, DELETE_ERROR);
      }
    },
    onSettled: async (
      _,
      __,
      { metricId, projectId: affectedProjectId, session: opened },
    ) => {
      if (confirmation.current?.session === opened) {
        confirmation.current = null;
      }
      await invalidate({ metricId, projectId: affectedProjectId });
    },
  });

  function reset() {
    session.current += 1;
    grant.current = null;
    confirmation.current = null;
    lastAttempt.current = undefined;
    identity.reset();
    commit.reset();
  }

  function confirmIdentity() {
    if (identity.isPending || commit.isPending) {
      return;
    }
    grant.current = null;
    commit.reset();
    identity.mutate(session.current);
  }

  async function deleteMetric(
    target: PriorityMetricRevisionArgs,
    typedProjectName: string,
  ) {
    if (!grant.current || commit.isPending) {
      return false;
    }
    const opened = session.current;
    confirmation.current = {
      grant: grant.current,
      session: opened,
      typedProjectName,
    };
    grant.current = null;
    identity.reset();
    const command = commandVariables(
      { ...target, projectId },
      lastAttempt.current,
    );
    lastAttempt.current = command;
    try {
      await commit.mutateAsync({ ...command, session: opened });
      return session.current === opened;
    } catch {
      return false;
    }
  }

  return {
    confirmIdentity,
    confirmationPending: identity.isPending,
    deleteMetric,
    error: identity.error ?? commit.error,
    identityConfirmed: identity.isSuccess,
    isPending: commit.isPending,
    reset,
  };
}
