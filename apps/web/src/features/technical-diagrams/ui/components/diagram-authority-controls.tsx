// biome-ignore-all lint/performance/noJsxPropsBind: Each form binds its own field state.
import type {
  AuthorityConversionPreview,
  CreatableAuthorityMode,
  ExternalSourceLink,
} from "@cantiara/api/technical-diagram-authority";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";

const TARGET_MODES: CreatableAuthorityMode[] = [
  "Product-authored Model",
  "Imported Independent Copy",
  "External Source Link",
];

export function ExternalSourceLinkDetails({
  source,
}: {
  source: ExternalSourceLink;
}) {
  return (
    <section aria-label="External Source Link" className="space-y-1 text-sm">
      <a
        className="underline"
        href={source.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        Open external source
      </a>
      <p>URL: {source.url}</p>
      <p>Tool: {source.tool}</p>
      <p>Revision: {source.revision ?? "Unknown"}</p>
      <p>Last checked: {source.lastCheckedAt}</p>
    </section>
  );
}

export function DiagramOrigins({
  origins,
}: {
  origins: TechnicalDiagramSource["origins"];
}) {
  if (origins.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Origin" className="text-sm">
      {origins.map((origin) => (
        <li key={`${origin.relation}:${origin.diagramId}`}>
          {origin.relation}: {origin.title} · {origin.authorityMode}
        </li>
      ))}
    </ul>
  );
}

export function DiagramAuthorityConversion({
  diagram,
}: {
  diagram: TechnicalDiagramSource;
}) {
  const queryClient = useQueryClient();
  const targets = TARGET_MODES.filter(
    (mode) =>
      mode !== diagram.authorityMode &&
      !(
        mode === "Imported Independent Copy" &&
        diagram.authorityMode === "External Source Link"
      ),
  );
  const [targetMode, setTargetMode] = useState<CreatableAuthorityMode | "">(
    targets[0] ?? "",
  );
  const [title, setTitle] = useState(`${diagram.title} (converted)`);
  const [link, setLink] = useState({ url: "", tool: "", revision: "" });
  const [preview, setPreview] = useState<AuthorityConversionPreview | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const pendingKey = useRef<string | null>(null);
  const checkedAt = useRef(new Date().toISOString());

  const request = () => {
    const externalSource: ExternalSourceLink | undefined =
      targetMode === "External Source Link"
        ? {
            lastCheckedAt: checkedAt.current,
            revision: link.revision.trim() || null,
            tool: link.tool,
            url: link.url,
          }
        : undefined;
    return {
      ...(externalSource ? { externalSource } : {}),
      sourceDiagramId: diagram.id,
      targetMode: targetMode as CreatableAuthorityMode,
      title,
    };
  };
  const reset = () => {
    pendingKey.current = null;
    setPreview(null);
  };
  const previewMutation = useMutation({
    mutationFn: () => {
      checkedAt.current = new Date().toISOString();
      return client.previewDiagramAuthorityConversion(request());
    },
    onError: (failure) =>
      setError(failure instanceof Error ? failure.message : "Preview failed."),
    onSuccess: (result) => {
      setError(null);
      setPreview(result);
    },
  });
  const confirmMutation = useMutation({
    mutationFn: () => {
      pendingKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.convertDiagramAuthority({
          ...request(),
          clientIdempotencyKey: pendingKey.current as string,
          previewToken: (preview as AuthorityConversionPreview).previewToken,
        }),
      );
    },
    onError: (failure) =>
      setError(
        failure instanceof Error ? failure.message : "Conversion failed.",
      ),
    onSuccess: async () => {
      reset();
      setError(null);
      await queryClient.invalidateQueries();
    },
  });

  if (targets.length === 0) {
    return null;
  }
  return (
    <section aria-label="Convert authority" className="space-y-2">
      <h4 className="font-medium">Convert authority</h4>
      <p className="text-muted-foreground text-sm">
        Diagram Authority Mode never changes in place. Converting creates a new
        Technical Diagram that Originates from this one.
      </p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          previewMutation.mutate();
        }}
      >
        <Label htmlFor={`authority-target-${diagram.id}`}>
          Diagram Authority Mode
        </Label>
        <select
          id={`authority-target-${diagram.id}`}
          onChange={(event) => {
            reset();
            setTargetMode(event.target.value as CreatableAuthorityMode);
          }}
          value={targetMode}
        >
          {targets.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
        <Label htmlFor={`authority-title-${diagram.id}`}>Title</Label>
        <Input
          id={`authority-title-${diagram.id}`}
          onChange={(event) => {
            reset();
            setTitle(event.target.value);
          }}
          required
          value={title}
        />
        {targetMode === "External Source Link" ? (
          <>
            <Label htmlFor={`authority-url-${diagram.id}`}>HTTPS URL</Label>
            <Input
              id={`authority-url-${diagram.id}`}
              onChange={(event) => {
                reset();
                setLink({ ...link, url: event.target.value });
              }}
              required
              type="url"
              value={link.url}
            />
            <Label htmlFor={`authority-tool-${diagram.id}`}>Source tool</Label>
            <Input
              id={`authority-tool-${diagram.id}`}
              onChange={(event) => {
                reset();
                setLink({ ...link, tool: event.target.value });
              }}
              required
              value={link.tool}
            />
            <Label htmlFor={`authority-revision-${diagram.id}`}>
              Known revision (optional)
            </Label>
            <Input
              id={`authority-revision-${diagram.id}`}
              onChange={(event) => {
                reset();
                setLink({ ...link, revision: event.target.value });
              }}
              value={link.revision}
            />
          </>
        ) : null}
        <Button disabled={previewMutation.isPending} type="submit">
          Preview conversion
        </Button>
      </form>
      {preview ? (
        <div className="space-y-2" role="status">
          <p>
            {preview.sourceMode} to {preview.targetMode}: a new Technical
            Diagram that Originates from this one.
          </p>
          <ul className="list-inside list-disc">
            {preview.loss.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>{preview.history}</p>
          <Button
            disabled={!preview.canConvert || confirmMutation.isPending}
            onClick={() => confirmMutation.mutate()}
            type="button"
          >
            Confirm conversion
          </Button>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
