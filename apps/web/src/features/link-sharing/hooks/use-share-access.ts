import type {
  ReopenExpiredLinkInput,
  ReshareExpiredLinkInput,
  SetShareExpiryInput,
  ShareRoot,
  ShareScopePreview,
} from "@cantiara/api/link-sharing";
import { hashKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { client, orpc } from "@/utils/orpc";
import type { ShareTokenDisplay } from "../lib/share-access";

interface ShareTarget {
  root: ShareRoot;
  surfaceId: string;
}

function previewKey(root: ShareRoot) {
  return orpc.previewShareScope.queryKey({ input: { root } });
}

interface ShareWriteState {
  error: unknown;
  status: "idle" | "pending" | "error" | "success";
}

export interface ShareLifecycleFeedback extends ShareWriteState {
  action: "reopen" | "reshare" | "revoke" | "expiry";
  expiresAt?: string | null;
}

export type ShareRotationFeedback = ShareWriteState;

/** Share writes refresh the selected root and deliver issued tokens only to its private display. */
export function useShareAccess(
  root: ShareRoot | null,
  currentSurfaceId: string | undefined,
  display: ShareTokenDisplay,
) {
  const queryClient = useQueryClient();
  const reshareAttempt = useRef<{ fingerprint: string; id: string } | null>(
    null,
  );
  const passwords = useRef(new WeakMap<ShareTarget, string | null>());

  function target(): ShareTarget {
    if (!(root && currentSurfaceId)) {
      throw new Error("Nothing is shared yet");
    }
    return { root, surfaceId: currentSurfaceId };
  }

  function refreshPreview(_: unknown, __: unknown, input: ShareTarget) {
    return queryClient.invalidateQueries({
      queryKey: previewKey(input.root),
    });
  }

  const reopen = useMutation({
    mutationKey: orpc.reopenShareLink.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({ root: _, ...input }: ShareTarget & ReopenExpiredLinkInput) =>
      client.reopenShareLink(input),
    onSettled: refreshPreview,
  });

  const reshare = useMutation({
    mutationKey: orpc.reshareShareLink.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: async ({
      displayOperation,
      root: _,
      ...input
    }: ShareTarget &
      ReshareExpiredLinkInput & { displayOperation: number }) => {
      const { accessToken, ...shared } = await client.reshareShareLink(input);
      display.receive(displayOperation, shared.surfaceId, accessToken);
      return shared;
    },
    onSuccess: (_, input) => {
      if (reshareAttempt.current?.id === input.newSurfaceId) {
        reshareAttempt.current = null;
      }
    },
    onSettled: refreshPreview,
  });

  const revoke = useMutation({
    mutationKey: orpc.revokeShareLink.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: async ({ root: revokedRoot, surfaceId }: ShareTarget) => {
      const result = await client.revokeShareLink({ surfaceId });
      display.revoke(surfaceId);
      // Clear the revoked surface and its approval scope before the fresh read.
      const queryKey = previewKey(revokedRoot);
      const preview = queryClient.getQueryData<ShareScopePreview>(queryKey);
      if (preview?.surface?.surfaceId === surfaceId) {
        await queryClient.resetQueries({ exact: true, queryKey });
      } else {
        await queryClient.invalidateQueries({ queryKey });
      }
      return result;
    },
    onError: (_, input) =>
      queryClient.invalidateQueries({ queryKey: previewKey(input.root) }),
  });

  const rotate = useMutation({
    mutationKey: orpc.rotateShareToken.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: async ({
      displayOperation,
      root: rotatedRoot,
      surfaceId,
    }: ShareTarget & { displayOperation: number }) => {
      const queryKey = previewKey(rotatedRoot);
      const targetsCurrentPreview = () =>
        queryClient.getQueryData<ShareScopePreview>(queryKey)?.surface
          ?.surfaceId === surfaceId;
      // A global Retry can still reference a failed mutation after a newer write.
      if (
        !(
          display.isCurrent(displayOperation, surfaceId) &&
          targetsCurrentPreview()
        )
      ) {
        throw new Error("The previous rotation is no longer current.");
      }
      const { token, ...access } = await client.rotateShareToken({ surfaceId });
      // Revoke can complete from a previous display while this write is pending.
      if (targetsCurrentPreview()) {
        display.receive(displayOperation, access.surfaceId, token);
      }
      return access;
    },
    onSettled: refreshPreview,
  });

  const expiry = useMutation({
    mutationKey: orpc.setShareExpiry.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: ({ root: _, ...input }: ShareTarget & SetShareExpiryInput) =>
      client.setShareExpiry(input),
    onSettled: refreshPreview,
  });

  const password = useMutation({
    mutationKey: orpc.setLinkPassword.mutationKey(),
    meta: { onlineWrite: true, privateInput: true },
    mutationFn: async (input: ShareTarget) => {
      const value = passwords.current.get(input);
      passwords.current.delete(input);
      if (value === undefined) {
        throw new Error("Enter the Link password again.");
      }
      const { token: _, ...access } = await client.setLinkPassword({
        password: value,
        surfaceId: input.surfaceId,
      });
      return access;
    },
    onSettled: refreshPreview,
  });

  const lifecycle = [
    { action: "reopen", mutation: reopen },
    { action: "reshare", mutation: reshare },
    { action: "revoke", mutation: revoke },
    {
      action: "expiry",
      expiresAt: expiry.variables?.expiresAt,
      mutation: expiry,
    },
  ] as const;
  const [latest] = lifecycle
    .filter(
      ({ action, mutation: { variables } }) =>
        variables &&
        variables.root.id === root?.id &&
        variables.root.kind === root?.kind &&
        (action === "reshare" ||
          action === "revoke" ||
          variables.surfaceId === currentSurfaceId),
    )
    .sort((a, b) => b.mutation.submittedAt - a.mutation.submittedAt);
  const rotationMatches =
    rotate.variables &&
    rotate.variables.root.id === root?.id &&
    rotate.variables.root.kind === root?.kind &&
    rotate.variables.surfaceId === currentSurfaceId;

  return {
    lifecycleFeedback: latest
      ? ({
          action: latest.action,
          error: latest.mutation.error,
          expiresAt: "expiresAt" in latest ? latest.expiresAt : undefined,
          status: latest.mutation.status,
        } satisfies ShareLifecycleFeedback)
      : null,
    resetFeedback: () => {
      reopen.reset();
      reshare.reset();
      revoke.reset();
      rotate.reset();
      expiry.reset();
    },
    rotationFeedback: rotationMatches
      ? ({
          error: rotate.error,
          status: rotate.status,
        } satisfies ShareRotationFeedback)
      : null,
    reopen: async (expiresAt: string | null) =>
      reopen.mutateAsync({
        ...target(),
        confirmOldHoldersRegainAccess: true,
        expiresAt,
      }),
    reshare: async (expiresAt: string | null) => {
      const input = { ...target(), expiresAt };
      const fingerprint = hashKey([input]);
      if (reshareAttempt.current?.fingerprint !== fingerprint) {
        reshareAttempt.current = { fingerprint, id: crypto.randomUUID() };
      }
      return await reshare.mutateAsync({
        ...input,
        displayOperation: display.beginIssuance(),
        newSurfaceId: reshareAttempt.current.id,
      });
    },
    revoke: async () => revoke.mutateAsync(target()),
    rotateToken: async () =>
      rotate.mutateAsync({
        ...target(),
        displayOperation: display.beginIssuance(),
      }),
    setExpiry: async (expiresAt: string | null) =>
      expiry.mutateAsync({ ...target(), expiresAt }),
    setPassword: async (value: string | null) => {
      const input = target();
      passwords.current.set(input, value);
      try {
        return await password.mutateAsync(input);
      } finally {
        passwords.current.delete(input);
      }
    },
  };
}
