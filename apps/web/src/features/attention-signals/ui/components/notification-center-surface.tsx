// biome-ignore-all lint/performance/noJsxPropsBind: Row actions close over the signal they act on.

import type { AttentionSignal } from "@cantiara/api/attention-signals";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import NotificationCenterList from "./notification-center-list";

export default function NotificationCenterSurface() {
  const queryClient = useQueryClient();
  const center = useQuery(orpc.notificationCenter.queryOptions());
  const attempt = useRef<string | null>(null);
  const refreshed = useRef<boolean>(false);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.notificationCenter.queryKey(),
    });
  const { mutate: refreshPublicReview } = useMutation(
    orpc.refreshPublicRoadmapReviewSignals.mutationOptions({
      meta: { onlineWrite: true, presentsSupportFailure: true },
      mutationFn: () => client.refreshPublicRoadmapReviewSignals(),
      onSuccess: async (result) => {
        if (result.emitted > 0) {
          await refresh();
        }
      },
    }),
  );
  // The public Roadmap review rule runs when the center opens.
  useEffect(() => {
    if (!refreshed.current) {
      refreshed.current = true;
      refreshPublicReview();
    }
  }, [refreshPublicReview]);
  const mark = useMutation(
    orpc.markNotification.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.markNotification(input),
      onSuccess: refresh,
    }),
  );
  const open = useMutation({
    mutationKey: orpc.openNotification.mutationKey(),
    meta: { onlineWrite: true },
    mutationFn: async (signalRowId: string) => ({
      output: await client.openNotification({ signalRowId }),
      signalRowId,
    }),
  });
  const previewFollowUp = useMutation(
    orpc.previewNotificationFollowUp.mutationOptions({
      mutationFn: (input) => client.previewNotificationFollowUp(input),
    }),
  );
  const createFollowUp = useMutation(
    orpc.createNotificationFollowUp.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createNotificationFollowUp(input),
      onSuccess: async (result, { attemptId }) => {
        if (attempt.current === attemptId) {
          previewFollowUp.reset();
          attempt.current = null;
        }
        await Promise.all([
          refresh(),
          ...(result.created && result.signal.projectId
            ? [
                queryClient.invalidateQueries({
                  queryKey: orpc.projectWorks.queryKey({
                    input: { projectId: result.signal.projectId },
                  }),
                }),
                ...invalidateSmartCollectionMembership(queryClient),
              ]
            : []),
        ]);
      },
    }),
  );
  const latestError = [mark, open, previewFollowUp, createFollowUp].sort(
    (first, second) => second.submittedAt - first.submittedAt,
  )[0]?.error;
  const error = latestError
    ? latestError.message || "The action could not be completed."
    : null;
  const message =
    createFollowUp.isSuccess && followUpMessage(createFollowUp.data.created);
  const preview = previewFollowUp.data ?? null;

  function confirmFollowUp(signal: AttentionSignal) {
    if (
      !preview ||
      previewFollowUp.variables?.signalRowId !== signal.id ||
      createFollowUp.isPending
    ) {
      return;
    }
    attempt.current ??= crypto.randomUUID();
    createFollowUp.mutate({
      attemptId: attempt.current,
      fingerprint: preview.fingerprint,
      signalRowId: signal.id,
    });
  }

  if (center.status === "pending") {
    return <p>Loading Notification Center…</p>;
  }
  if (!center.data) {
    return <p role="alert">Notification Center could not be loaded.</p>;
  }
  return (
    <>
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <NotificationCenterList
        actions={{
          onCreateFollowUp: confirmFollowUp,
          onMark: (signal, markValue) =>
            mark.mutate({ mark: markValue, signalRowId: signal.id }),
          onOpen: (signal) => open.mutate(signal.id),
          onPreviewFollowUp: (signal) => {
            attempt.current = null;
            createFollowUp.reset();
            previewFollowUp.mutate({ signalRowId: signal.id });
          },
        }}
        center={center.data}
        panels={{ opened: open.data ?? null, preview }}
      />
    </>
  );
}

function followUpMessage(created: boolean) {
  return created
    ? "Follow-up work created. The notification stays open."
    : "Follow-up work already exists for this attempt.";
}
