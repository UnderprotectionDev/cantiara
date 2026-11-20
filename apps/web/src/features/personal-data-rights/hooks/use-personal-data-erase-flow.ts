import {
  ERASE_PERSONAL_DATA_LABEL,
  type PersonalDataErasePreview,
  type PersonalDataEraseResult,
} from "@cantiara/api/personal-data-rights";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import {
  PrivateWriteFailure,
  privateWriteNotice,
} from "@/features/web-macos-client/lib/support-reference";
import { orpc } from "@/utils/orpc";
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
  const queryClient = useQueryClient();
  const reviewSession = useRef(0);
  const grant = useRef<string>(null);
  const submission = useRef<{
    session: number;
    preview: PersonalDataErasePreview;
    grant: string;
    typedName: string;
  } | null>(null);
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
    mutationKey: orpc.erasePersonalData.mutationKey(),
    onSettled: (_, _error, { session }) => {
      if (submission.current?.session === session) {
        submission.current = null;
      }
    },
    onSuccess: async (_, { contactId, session }) => {
      if (reviewSession.current === session) {
        inspect.reset();
      }
      queryClient.removeQueries({
        queryKey: orpc.contact.key({ input: { contactId } }),
      });
      await queryClient.invalidateQueries({ queryKey: orpc.contacts.key() });
    },
    mutationFn: async ({ session }: { session: number; contactId: string }) => {
      const input = submission.current;
      if (input?.session !== session) {
        throw new Error(
          "Confirm GitHub Identity before erasing personal data.",
        );
      }
      submission.current = null;
      try {
        return await onErase(input.preview, {
          grant: input.grant,
          typedName: input.typedName,
        });
      } catch (error) {
        // biome-ignore lint/style/useErrorCause: Only approved Support fields can enter MutationCache.
        throw new PrivateWriteFailure(
          error,
          personalDataRefusalMessage(error, ERASE_PERSONAL_DATA_LABEL),
        );
      }
    },
  });
  const failure = commit.error ?? identity.error ?? inspect.error;
  let refusal = failure
    ? personalDataRefusalMessage(failure, ERASE_PERSONAL_DATA_LABEL)
    : null;
  if (failure instanceof PrivateWriteFailure) {
    refusal = failure.message;
  }

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
        session: reviewSession.current,
        preview: inspect.data,
        grant: grant.current,
        typedName,
      };
      grant.current = null;
      identity.reset();
      await commit
        .mutateAsync({
          session: reviewSession.current,
          contactId: inspect.data.contactId,
        })
        .catch(() => undefined);
    },
    grant: identity.isSuccess,
    identityPending: identity.isPending,
    pending: inspect.isPending || commit.isPending,
    preview: commit.isSuccess ? null : (inspect.data ?? null),
    refusal,
    support: commit.error ? privateWriteNotice(commit.error) : null,
    result: commit.data ?? null,
    async review(contactId: string) {
      reset();
      await inspect.mutateAsync(contactId).catch(() => undefined);
    },
  };
}
