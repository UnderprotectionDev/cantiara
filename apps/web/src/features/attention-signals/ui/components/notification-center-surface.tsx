// biome-ignore-all lint/performance/noJsxPropsBind: Row actions close over the signal they act on.

import type {
  AttentionFollowUpPreview,
  AttentionSignal,
  OpenAttentionSignalOutput,
} from "@cantiara/api/attention-signals";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import NotificationCenterList from "./notification-center-list";

export default function NotificationCenterSurface() {
  const queryClient = useQueryClient();
  const center = useQuery(orpc.notificationCenter.queryOptions());
  const [opened, setOpened] = useState<{
    output: OpenAttentionSignalOutput;
    signalRowId: string;
  } | null>(null);
  const [preview, setPreview] = useState<AttentionFollowUpPreview | null>(null);
  const [attempt, setAttempt] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.notificationCenter.queryOptions().queryKey,
    });
  const mark = useMutation({
    mutationFn: (variables: Parameters<typeof client.markNotification>[0]) =>
      runOnlineOnlyWrite(() => client.markNotification(variables)),
    onSuccess: refresh,
  });
  const open = useMutation({
    mutationFn: (signal: AttentionSignal) =>
      runOnlineOnlyWrite(() =>
        client.openNotification({ signalRowId: signal.id }),
      ).then((output) => ({ output, signalRowId: signal.id })),
    onSuccess: setOpened,
  });
  const previewFollowUp = useMutation({
    mutationFn: (signal: AttentionSignal) =>
      runOnlineOnlyWrite(() =>
        client.previewNotificationFollowUp({ signalRowId: signal.id }),
      ),
    onSuccess: (result) => {
      setAttempt(crypto.randomUUID());
      setMessage(null);
      setPreview(result);
    },
  });
  const createFollowUp = useMutation({
    mutationFn: (signal: AttentionSignal) =>
      runOnlineOnlyWrite(() =>
        client.createNotificationFollowUp({
          attemptId: attempt,
          fingerprint: preview?.fingerprint ?? "",
          signalRowId: signal.id,
        }),
      ),
    onSuccess: async () => {
      setPreview(null);
      setMessage("Follow-up work created. The notification stays open.");
      await refresh();
    },
  });
  if (center.isPending) {
    return <p>Loading Notification Center…</p>;
  }
  if (!center.data) {
    return <p role="alert">Notification Center could not be loaded.</p>;
  }
  return (
    <>
      {message ? <p role="status">{message}</p> : null}
      <NotificationCenterList
        actions={{
          onCreateFollowUp: (signal) => createFollowUp.mutate(signal),
          onMark: (signal, markValue) =>
            mark.mutate({ mark: markValue, signalRowId: signal.id }),
          onOpen: (signal) => open.mutate(signal),
          onPreviewFollowUp: (signal) => previewFollowUp.mutate(signal),
        }}
        center={center.data}
        panels={{ opened, preview }}
      />
    </>
  );
}
