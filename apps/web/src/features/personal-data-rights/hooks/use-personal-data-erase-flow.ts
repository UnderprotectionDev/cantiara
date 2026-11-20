import {
  ERASE_PERSONAL_DATA_LABEL,
  type PersonalDataErasePreview,
  type PersonalDataEraseResult,
} from "@cantiara/api/personal-data-rights";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { personalDataRefusalMessage } from "../lib/personal-data-refusal";

export function usePersonalDataEraseFlow({
  onConfirmIdentity,
  onErase,
  onPreview,
}: {
  onConfirmIdentity: () => Promise<string>;
  onErase: (
    preview: PersonalDataErasePreview,
    confirmation: { grant: string; typedName: string },
  ) => Promise<PersonalDataEraseResult>;
  onPreview: (contactId: string) => Promise<PersonalDataErasePreview>;
}) {
  const reviewSession = useRef(0);
  const grant = useRef<string>(null);
  const submission = useRef<{
    preview: PersonalDataErasePreview;
    grant: string;
    typedName: string;
  }>(null);
  const inspect = useMutation({
    gcTime: 0,
    meta: { presentsSupportFailure: true },
    mutationFn: onPreview,
  });
  const identity = useMutation({
    gcTime: 0,
    meta: { onlineWrite: true, presentsSupportFailure: true },
    mutationFn: async (session: number) => {
      const confirmed = await onConfirmIdentity();
      if (reviewSession.current === session) {
        grant.current = confirmed;
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
    onSettled: () => {
      submission.current = null;
    },
    mutationFn: () => {
      const input = submission.current;
      submission.current = null;
      if (!input) {
        throw new Error(
          "Confirm GitHub Identity before erasing personal data.",
        );
      }
      return onErase(input.preview, {
        grant: input.grant,
        typedName: input.typedName,
      });
    },
  });
  const failure = commit.error ?? identity.error ?? inspect.error;

  function reset() {
    reviewSession.current += 1;
    grant.current = null;
    submission.current = null;
    inspect.reset();
    identity.reset();
    commit.reset();
  }

  return {
    cancel: reset,
    async confirmIdentity() {
      if (inspect.data && !identity.isPending && !commit.isPending) {
        commit.reset();
        await identity
          .mutateAsync(reviewSession.current)
          .catch(() => undefined);
      }
    },
    async erase(typedName: string) {
      if (!(inspect.data && grant.current) || commit.isPending) {
        return;
      }
      submission.current = {
        preview: inspect.data,
        grant: grant.current,
        typedName,
      };
      grant.current = null;
      identity.reset();
      await commit.mutateAsync().catch(() => undefined);
    },
    grant: identity.isSuccess,
    identityPending: identity.isPending,
    pending: inspect.isPending || commit.isPending,
    preview: commit.isSuccess ? null : (inspect.data ?? null),
    refusal: failure
      ? personalDataRefusalMessage(failure, ERASE_PERSONAL_DATA_LABEL)
      : null,
    result: commit.data ?? null,
    async review(contactId: string) {
      reset();
      await inspect.mutateAsync(contactId).catch(() => undefined);
    },
  };
}
