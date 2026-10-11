import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { SmartLinkPreview } from "@cantiara/api/smart-link-preview";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { env } from "@/env";
import { isTauriRuntime } from "@/features/account-access/lib/tauri-session";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { formatAccountDateTime } from "../../../account-preferences/lib/account-preferences-format";
import { SmartLinkComposer } from "./smart-link-preview";

function preview(url: string) {
  return client.smartLinkPreview({ url });
}
export default function ProjectSourcesSurface({
  projectId,
  preferences = DEFAULT_ACCOUNT_PREFERENCES,
}: {
  projectId: string;
  preferences?: AccountPreferences;
}) {
  const options = orpc.projectSources.queryOptions({ input: { projectId } });
  const sources = useQuery(options);
  const queryClient = useQueryClient();
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
    await runOnlineOnlyWrite(() =>
      client.createSource({
        id: command.id,
        clientIdempotencyKey: command.key,
        baseRevision: 0,
        projectId,
        url: value.url,
        title: value.title,
        capturedContent: value.capturedContent,
        accessedAt: value.accessedAt,
        provider: value.player ? "YouTube" : null,
      }),
    );
    await queryClient.invalidateQueries({ queryKey: options.queryKey });
    pending.current = null;
  }
  if (sources.isPending) {
    return <p role="status">Loading Sources…</p>;
  }
  if (sources.isError || !sources.data) {
    return (
      <p role="alert">Sources are unavailable. Try loading this page again.</p>
    );
  }
  return (
    <section className="space-y-5" id="sources">
      <h2 className="font-semibold text-xl">Source</h2>
      {sources.data.readOnly ? (
        <p>Archived Project. Sources are read-only.</p>
      ) : null}
      <SmartLinkComposer
        onPreview={preview}
        onSave={save}
        preferences={preferences}
        readOnly={sources.data.readOnly}
        youtubePlayerOrigin={
          isTauriRuntime() ? new URL(env.VITE_SERVER_URL).origin : undefined
        }
      />
      {sources.data.records.map((source) => (
        <article
          className="space-y-2 rounded-lg border bg-card p-4"
          key={source.id}
        >
          <h3 className="font-medium">{source.version.title}</h3>
          <p className="font-medium text-sm">Historical snapshot</p>
          <a
            className="block break-all underline"
            href={source.version.url}
            rel="noopener noreferrer"
            target="_blank"
          >
            {source.version.url}
          </a>
          <p className="text-muted-foreground text-sm">
            {formatAccountDateTime(source.version.accessedAt, preferences)}
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">
            {source.version.capturedContent || "No text was captured."}
          </p>
        </article>
      ))}
    </section>
  );
}
