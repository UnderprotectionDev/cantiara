import type {
  SecurityRedactionGateResult,
  SecurityRedactionPreview,
} from "@cantiara/api/security-redaction";
import { isDefinedError, ORPCError } from "@orpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import {
  PrivateWriteFailure,
  privateWriteNotice,
} from "@/features/web-macos-client/lib/support-reference";
import { orpc } from "@/utils/orpc";

type ApplyFailure =
  | { code: "GRANT_REJECTED" }
  | { code: "NAME_MISMATCH" }
  | { code: "SPREAD_INCOMPLETE" }
  | { code: "UNKNOWN" };

/**
 * The oRPC failure kinds of `applySecurityRedaction`: a name mismatch burns
 * nothing, a rejected grant needs a fresh confirmation and a partial spread
 * has already removed some copies while leaving the event for replay.
 */
export function parseApplyFailure(error: unknown): ApplyFailure {
  if (!(error instanceof ORPCError && isDefinedError(error))) {
    return { code: "UNKNOWN" };
  }
  if (error.code === "SECURITY_REDACTION_TYPED_NAME_MISMATCH") {
    return { code: "NAME_MISMATCH" };
  }
  if (error.code === "SECURITY_REDACTION_GRANT_REJECTED") {
    return { code: "GRANT_REJECTED" };
  }
  if (error.code === "SECURITY_REDACTION_SPREAD_INCOMPLETE") {
    return { code: "SPREAD_INCOMPLETE" };
  }
  return { code: "UNKNOWN" };
}

export interface SecurityRedactionCalls {
  apply: (confirmation: {
    grant: string;
    reason: string;
    sensitiveValue: string;
    typedName: string;
  }) => Promise<SecurityRedactionGateResult>;
  confirmIdentity: () => Promise<string>;
  preview: (sensitiveValue: string) => Promise<SecurityRedactionPreview>;
}

const APPLY_ERRORS = {
  NAME_MISMATCH: "Could not redact. Check the name and confirm again.",
  GRANT_REJECTED:
    "Confirm GitHub Identity was not accepted. Confirm again to redact.",
  SPREAD_INCOMPLETE:
    "Some copies could not be removed yet. Confirm again to retry; the removal is already recorded.",
  UNKNOWN: "Could not redact. Confirm identity again to retry.",
};

export function useSecurityRedactionFlow(calls: SecurityRedactionCalls) {
  const reviewSession = useRef(0);
  const value = useRef<string | null>(null);
  const grant = useRef<string | null>(null);
  const submission = useRef<
    Parameters<SecurityRedactionCalls["apply"]>[0] | null
  >(null);
  const inspect = useMutation({
    mutationKey: orpc.previewSecurityRedaction.mutationKey(),
    gcTime: 0,
    meta: { privateInput: true, presentsSupportFailure: true },
    mutationFn: async () => {
      try {
        if (value.current !== null) {
          return await calls.preview(value.current);
        }
      } catch {
        // The raw input and upstream errors stay outside Query.
      }
      throw new Error("Could not load the Redact preview.");
    },
  });
  const identity = useMutation({
    gcTime: 0,
    meta: {
      privateInput: true,
      presentsSupportFailure: true,
      onlineWrite: true,
    },
    mutationFn: async (session: number) => {
      try {
        const result = await calls.confirmIdentity();
        if (session === reviewSession.current) {
          grant.current = result;
        }
      } catch {
        // biome-ignore lint/style/useErrorCause: The authentication failure may carry private data.
        throw new Error("Confirm GitHub Identity could not be completed.");
      }
    },
  });
  const commit = useMutation({
    mutationKey: orpc.applySecurityRedaction.mutationKey(),
    gcTime: 0,
    meta: {
      privateInput: true,
      presentsSupportFailure: true,
      onlineWrite: true,
    },
    mutationFn: async () => {
      const input = submission.current;
      submission.current = null;
      if (!input) {
        throw new Error(APPLY_ERRORS.GRANT_REJECTED);
      }
      try {
        const result = await calls.apply(input);
        return {
          ...result,
          reason: result.reason.replaceAll(input.sensitiveValue, "[Redacted]"),
        };
      } catch (caught) {
        // biome-ignore lint/style/useErrorCause: Only approved Support fields can enter MutationCache.
        throw new PrivateWriteFailure(
          caught,
          APPLY_ERRORS[parseApplyFailure(caught).code],
        );
      }
    },
  });

  function reset() {
    reviewSession.current += 1;
    value.current = null;
    grant.current = null;
    submission.current = null;
    inspect.reset();
    identity.reset();
    commit.reset();
  }

  return {
    busy: inspect.isPending || commit.isPending,
    cancel: reset,
    async confirmIdentity() {
      if (inspect.isSuccess && !identity.isPending && !commit.isPending) {
        commit.reset();
        await identity
          .mutateAsync(reviewSession.current)
          .catch(() => undefined);
      }
    },
    error: (commit.error ?? identity.error ?? inspect.error)?.message ?? null,
    async redact(typedName: string, reason: string) {
      if (
        value.current === null ||
        grant.current === null ||
        commit.isPending
      ) {
        return;
      }
      submission.current = {
        grant: grant.current,
        sensitiveValue: value.current,
        reason,
        typedName,
      };
      identity.reset();
      grant.current = null;
      const session = reviewSession.current;
      await commit
        .mutateAsync()
        .then(() => {
          if (session === reviewSession.current) {
            value.current = null;
          }
        })
        .catch(() => undefined);
      if (session === reviewSession.current) {
        submission.current = null;
      }
    },
    result: commit.data ?? null,
    support: commit.error ? privateWriteNotice(commit.error) : null,
    review:
      inspect.isSuccess && !commit.isSuccess
        ? {
            preview: inspect.data,
            grant: identity.isSuccess,
            identityPending: identity.isPending,
          }
        : null,
    async showPreview(sensitiveValue: string) {
      reset();
      value.current = sensitiveValue;
      const session = reviewSession.current;
      await inspect.mutateAsync().catch(() => {
        if (session === reviewSession.current) {
          value.current = null;
        }
      });
    },
  };
}
