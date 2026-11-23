import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { SmartLinkPreview } from "@cantiara/api/smart-link-preview";
import {
  VirtualList,
  type VirtualListReveal,
} from "@cantiara/ui/components/virtual-list";
import { virtualRowId } from "@cantiara/ui/lib/virtual-list-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { env } from "@/env";
import { isTauriRuntime } from "@/features/account-access/lib/tauri-session";
import { client, orpc } from "@/utils/orpc";
import { formatAccountDateTime } from "../../../account-preferences/lib/account-preferences-format";
import { useSmartLinkPreview } from "../../hooks/use-smart-link-preview";
import { SmartLinkComposer } from "../forms/smart-link-form";

import { SourceEvidenceControls } from "./source-evidence-controls";
import { SourceRecheckControls } from "./source-recheck-controls";

export default function ProjectSourcesSurface({
  projectId,
  preferences = DEFAULT_ACCOUNT_PREFERENCES,
  reveal,
}: {
  projectId: string;
  preferences?: AccountPreferences;
  reveal?: VirtualListReveal;
}) {
  const createSourceMutation = useMutation(
    orpc.createSource.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.createSource(input),
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: options.queryKey }),
    }),
  );
  const options = orpc.projectSources.queryOptions({ input: { projectId } });
  const sources = useQuery(options);
  const queryClient = useQueryClient();
  const preview = useSmartLinkPreview();
  const pending = useRef<{
    fingerprint: string;
    id: string;
    key: string;
  } | null>(null);
  async function save(value: SmartLinkPreview) {
    const fingerprint = JSON.stringify(value);
    if (pending.current?.fingerprint !== fingerprint) {
      pending.current = {
        fingerprint,
        id: crypto.randomUUID(),
        key: crypto.randomUUID(),
      };
    }
    const command = pending.current;
    await createSourceMutation.mutateAsync({
      id: command.id,
      clientIdempotencyKey: command.key,
      baseRevision: 0,
      projectId,
      url: value.url,
      title: value.title,
      capturedContent: value.capturedContent,
      accessedAt: value.accessedAt,
      provider: value.player ? "YouTube" : null,
    });
    pending.current = null;
  }
  if (sources.status === "pending") {
    return <p role="status">Loading Sources…</p>;
  }
  if (sources.isError || !sources.data) {
    return (
      <p role="alert">Sources are unavailable. Try loading this page again.</p>
    );
  }
  const { readOnly, records } = sources.data;
  return (
    <section className="space-y-5" id="sources">
      <h2 className="text-xl font-semibold">Source</h2>
      {readOnly ? <p>Archived Project. Sources are read-only.</p> : null}
      <SmartLinkComposer
        onPreview={preview}
        onSave={save}
        preferences={preferences}
        readOnly={readOnly}
        write={createSourceMutation}
        youtubePlayerOrigin={
          isTauriRuntime() ? new URL(env.VITE_SERVER_URL).origin : undefined
        }
      />
      <VirtualList
        as="div"
        className="space-y-5"
        estimateSize={130}
        gap={12}
        getKey={virtualRowId}
        reveal={reveal}
        rows={records}
      >
        {(source, rowProps) => (
          <article
            className="space-y-2 rounded-lg border bg-card p-4"
            id={`source-record-${source.id}`}
            {...rowProps}
            tabIndex={-1}
          >
            <h3 className="font-medium">{source.version.title}</h3>
            <p className="text-sm font-medium">
              Historical snapshot · Version {source.revision}
            </p>
            <a
              className="block break-all underline"
              href={source.version.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {source.version.url}
            </a>
            <p className="text-sm text-muted-foreground">
              {formatAccountDateTime(source.version.accessedAt, preferences)}
            </p>
            <p className="text-sm break-words whitespace-pre-wrap">
              {source.version.capturedContent || "No text was captured."}
            </p>
            <SourceRecheckControls
              preferences={preferences}
              readOnly={readOnly}
              source={source}
            />
            <SourceEvidenceControls
              preferences={preferences}
              readOnly={readOnly}
              source={source}
            />
          </article>
        )}
      </VirtualList>
    </section>
  );
}
