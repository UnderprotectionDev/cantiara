import type {
  ResearchSessionFields,
  ResearchSessionNoteInput,
  ResearchSessionRecord,
} from "@cantiara/api/research-sessions";
import { Button } from "@cantiara/ui/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef } from "react";
import { fetchFresh } from "@/lib/fetch-fresh";
import { accountPreferencesQueryOptions, client, orpc } from "@/utils/orpc";
import { isResearchSessionConflict } from "../../lib/research-session-conflict";
import type { ResearchBindingActions } from "../forms/research-note-binding-form";
import { ResearchSessionsView } from "../views/research-sessions-view";

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
  const confirmBinding = useMutation(
    orpc.confirmResearchSessionBinding.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.confirmResearchSessionBinding(input),
      onSuccess: async (_, { id, projectId: targetProjectId }) => {
        await Promise.all(
          [
            orpc.projectResearchSessionBindings.queryKey({
              input: { id, projectId: targetProjectId },
            }),
            orpc.researchSessionBindingTargets.queryKey({
              input: { id, projectId: targetProjectId },
            }),
            orpc.researchSessionBindingFeedback.key(),
            orpc.evidenceFlow.key(),
            orpc.projectResearchSessions.queryKey({
              input: { projectId: targetProjectId },
            }),
          ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
        );
      },
      onError: () =>
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
    }),
  );
  const previewBinding = useMutation(
    orpc.previewResearchSessionBinding.mutationOptions({
      gcTime: 0,
      meta: { onlineWrite: true, retryInSurface: true },
      mutationFn: (input) => client.previewResearchSessionBinding(input),
      onError: () =>
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
    }),
  );
  const previewBindingAsync = previewBinding.mutateAsync;
  const confirmBindingAsync = confirmBinding.mutateAsync;
  const bindingActions = useMemo<ResearchBindingActions>(
    () => ({
      feedback: (record, bindingId) =>
        fetchFresh(queryClient, {
          ...orpc.researchSessionBindingFeedback.queryOptions({
            input: { id: record.id, projectId, bindingId },
          }),
          gcTime: 0,
        }),
      targets: (record) =>
        client.researchSessionBindingTargets({ id: record.id, projectId }),
      list: (record) =>
        fetchFresh(queryClient, {
          ...orpc.projectResearchSessionBindings.queryOptions({
            input: { id: record.id, projectId },
          }),
          gcTime: 0,
        }),
      preview: previewBindingAsync,
      confirm: (record, preview, key) =>
        confirmBindingAsync({
          id: record.id,
          projectId,
          baseRevision: record.revision,
          previewId: preview.previewId,
          clientIdempotencyKey: key,
        }),
    }),
    [projectId, queryClient, previewBindingAsync, confirmBindingAsync],
  );
  const preferences = useQuery(accountPreferencesQueryOptions(accountId));
  const notePending = useRef(
    new Map<string, { fingerprint: string; key: string }>(),
  );
  const pending = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });
  const refreshConflict = (error: unknown) => {
    if (isResearchSessionConflict(error)) {
      return refresh();
    }
  };
  const saveSession = useMutation(
    orpc.saveResearchSession.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.saveResearchSession(input),
      onError: refreshConflict,
      onSuccess: async (_, input) => {
        if (pending.current?.key === input.clientIdempotencyKey) {
          pending.current = null;
        }
        await refresh();
      },
    }),
  );
  const saveSessionNote = useMutation(
    orpc.saveResearchSessionNote.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.saveResearchSessionNote(input),
      onError: refreshConflict,
      onSuccess: async (_, input) => {
        const draftId = JSON.stringify([input.id, input.note.id]);
        if (
          notePending.current.get(draftId)?.key === input.clientIdempotencyKey
        ) {
          notePending.current.delete(draftId);
        }
        await refresh();
      },
    }),
  );
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
    await saveSession.mutateAsync({
      fields,
      projectId,
      id: identity.id,
      baseRevision: record?.revision ?? 0,
      clientIdempotencyKey: identity.key,
    });
  }
  async function saveNote(
    note: ResearchSessionNoteInput,
    record: ResearchSessionRecord,
    create: boolean,
  ) {
    const fingerprint = JSON.stringify({
      note,
      id: record.id,
      revision: record.revision,
      create,
    });
    const draftId = JSON.stringify([record.id, note.id]);
    let identity = notePending.current.get(draftId);
    if (identity?.fingerprint !== fingerprint) {
      identity = { fingerprint, key: crypto.randomUUID() };
      notePending.current.set(draftId, identity);
    }
    const { key } = identity;
    await saveSessionNote.mutateAsync({
      id: record.id,
      projectId,
      baseRevision: record.revision,
      clientIdempotencyKey: key,
      note,
      create,
    });
  }
  function retry() {
    query.refetch().catch(() => undefined);
    preferences.refetch().catch(() => undefined);
  }
  function startEditing() {
    pending.current = null;
    saveSession.reset();
  }
  function startNoteEditing() {
    if (saveSessionNote.isSuccess) {
      saveSessionNote.reset();
    }
  }
  if (query.status === "pending" || preferences.isPending) {
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
      bindingActions={bindingActions}
      bindingPreview={previewBinding}
      bindingWrite={confirmBinding}
      noteWrite={saveSessionNote}
      onSave={save}
      onSaveNote={saveNote}
      onStartEditing={startEditing}
      onStartNoteEditing={startNoteEditing}
      readOnly={query.data.readOnly}
      records={query.data.records}
      sessionWrite={saveSession}
      timeZone={preferences.data.timeZone}
    />
  );
}
