import type {
  ReopenExpiredLinkInput,
  ReshareExpiredLinkInput,
  SetShareExpiryInput,
  ShareRoot,
} from "@cantiara/api/link-sharing";
import { hashKey, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { client, orpc } from "@/utils/orpc";
import type { IssuedShareLink } from "../lib/share-access";

interface ShareTarget {
  root: ShareRoot;
  surfaceId: string;
}

/** Share writes refresh the selected root and deliver issued tokens only to its private display. */
export function useShareAccess(
  root: ShareRoot | null,
  currentSurfaceId: string | undefined,
  issueLink: (link: IssuedShareLink) => void,
  onRevoked: () => void,
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
      queryKey: orpc.previewShareScope.queryKey({
        input: { root: input.root },
      }),
    });
  }

  const reopen = useMutation({
    mutationKey: orpc.reopenShareLink.mutationKey(),
    mutationFn: ({ root: _, ...input }: ShareTarget & ReopenExpiredLinkInput) =>
      client.reopenShareLink(input),
    onSettled: refreshPreview,
  });

  const reshare = useMutation({
    mutationKey: orpc.reshareShareLink.mutationKey(),
    mutationFn: async ({
      root: _,
      ...input
    }: ShareTarget & ReshareExpiredLinkInput) => {
      const { accessToken, ...shared } = await client.reshareShareLink(input);
      if (accessToken) {
        issueLink({ surfaceId: shared.surfaceId, token: accessToken });
      }
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
    mutationFn: ({ surfaceId }: ShareTarget) =>
      client.revokeShareLink({ surfaceId }),
    onSuccess: onRevoked,
    onSettled: refreshPreview,
  });

  const rotate = useMutation({
    mutationKey: orpc.rotateShareToken.mutationKey(),
    mutationFn: async ({ surfaceId }: ShareTarget) => {
      const { token, ...access } = await client.rotateShareToken({ surfaceId });
      if (token) {
        issueLink({ surfaceId: access.surfaceId, token });
      }
      return access;
    },
    onSettled: refreshPreview,
  });

  const expiry = useMutation({
    mutationKey: orpc.setShareExpiry.mutationKey(),
    mutationFn: ({ root: _, ...input }: ShareTarget & SetShareExpiryInput) =>
      client.setShareExpiry(input),
    onSettled: refreshPreview,
  });

  const password = useMutation({
    mutationKey: orpc.setLinkPassword.mutationKey(),
    meta: { privateInput: true },
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

  return {
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
        newSurfaceId: reshareAttempt.current.id,
      });
    },
    revoke: async () => revoke.mutateAsync(target()),
    rotateToken: async () => rotate.mutateAsync(target()),
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
