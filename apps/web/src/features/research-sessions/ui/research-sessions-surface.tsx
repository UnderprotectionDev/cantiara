import type {
  ResearchSessionFields,
  ResearchSessionRecord,
} from "@cantiara/api/research-sessions";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { accountPreferencesQueryOptions, client, orpc } from "@/utils/orpc";
import { ResearchSessionsView } from "./research-sessions-view";

export default function ResearchSessionsSurface({
  projectId,
  accountId,
}: {
  projectId: string;
  accountId?: string;
}) {
  const queryClient = useQueryClient();
  const options = orpc.projectResearchSessions.queryOptions({
    input: { projectId },
  });
  const query = useQuery(options);
  const preferences = useQuery(accountPreferencesQueryOptions(accountId));
  const pending = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  async function save(
    fields: ResearchSessionFields,
    record?: ResearchSessionRecord,
  ) {
    const fingerprint = JSON.stringify({
      fields,
      id: record?.id,
      revision: record?.revision,
    });
    if (pending.current?.fingerprint !== fingerprint) {
      pending.current = {
        fingerprint,
        id: record?.id ?? pending.current?.id ?? crypto.randomUUID(),
        key: crypto.randomUUID(),
      };
    }
    const identity = pending.current;
    try {
      await runOnlineOnlyWrite(() =>
        client.saveResearchSession({
          fields,
          projectId,
          id: identity.id,
          baseRevision: record?.revision ?? 0,
          clientIdempotencyKey: identity.key,
        }),
      );
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "CONFLICT"
      ) {
        await queryClient.invalidateQueries({ queryKey: options.queryKey });
      }
      throw error;
    }
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
    pending.current = null;
  }
  function retry() {
    query.refetch().catch(() => undefined);
    preferences.refetch().catch(() => undefined);
  }
  function startEditing() {
    pending.current = null;
  }
  if (query.isPending || preferences.isPending) {
    return <p role="status">Loading Research Sessions…</p>;
  }
  if (!(query.data && preferences.data)) {
    return (
      <div className="space-y-3">
        <p role="alert">Research Sessions are unavailable.</p>
        <Button onClick={retry}>Retry</Button>
      </div>
    );
  }
  return (
    <ResearchSessionsView
      onSave={save}
      onStartEditing={startEditing}
      readOnly={query.data.readOnly}
      records={query.data.records}
      timeZone={preferences.data.timeZone}
    />
  );
}
