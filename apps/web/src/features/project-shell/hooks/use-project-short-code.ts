import type { ProjectProfile } from "@cantiara/api/project-shell";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, projectsQueryPrefix } from "@/utils/orpc";

import { projectErrorMessage } from "../lib/project-list";

export function useProjectShortCode(project: ProjectProfile) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const pendingShortCode = useRef<{
    baseRevision: number;
    clientIdempotencyKey: string;
    shortCode: string;
  } | null>(null);
  const updateShortCode = useMutation({
    mutationFn: (input: {
      baseRevision: number;
      clientIdempotencyKey: string;
      shortCode: string;
    }) =>
      runOnlineOnlyWrite(() =>
        client.updateProjectShortCode({
          projectId: project.id,
          ...input,
        }),
      ),
    onError: (mutationError) => setError(projectErrorMessage(mutationError)),
    onSuccess: async () => {
      pendingShortCode.current = null;
      setError(null);
      await queryClient.invalidateQueries({ queryKey: projectsQueryPrefix });
      toast.success("Short code saved.");
    },
  });

  async function saveShortCode(nextShortCode: string) {
    const pending = pendingShortCode.current;
    const clientIdempotencyKey =
      pending?.baseRevision === project.revision &&
      pending.shortCode === nextShortCode
        ? pending.clientIdempotencyKey
        : crypto.randomUUID();
    pendingShortCode.current = {
      baseRevision: project.revision,
      clientIdempotencyKey,
      shortCode: nextShortCode,
    };

    try {
      await updateShortCode.mutateAsync({
        baseRevision: project.revision,
        clientIdempotencyKey,
        shortCode: nextShortCode,
      });
    } catch {
      // onError owns the inline error state; the form event must settle.
    }
  }

  return {
    error,
    isPending: updateShortCode.isPending,
    saveShortCode,
  };
}
