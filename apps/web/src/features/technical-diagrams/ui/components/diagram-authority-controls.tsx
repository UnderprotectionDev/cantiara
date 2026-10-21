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
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";

const TARGET_MODES: CreatableAuthorityMode[] = [
  "Product-authored Model",
  "Imported Independent Copy",
  "External Source Link",
];

const conversionSchema = z
  .object({
    revision: z.string(),
    targetMode: z.string().min(1),
    title: z.string().trim().min(1),
    tool: z.string(),
    url: z.string(),
  })
  .refine(
    (value) =>
      value.targetMode !== "External Source Link" ||
      (z.url().safeParse(value.url).success && value.tool.trim().length > 0),
  );
type ConversionValues = z.infer<typeof conversionSchema>;

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
  const [preview, setPreview] = useState<AuthorityConversionPreview | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const pendingKey = useRef<string | null>(null);
  const checkedAt = useRef(new Date().toISOString());

  const request = (values: ConversionValues) => {
    const externalSource: ExternalSourceLink | undefined =
      values.targetMode === "External Source Link"
        ? {
            lastCheckedAt: checkedAt.current,
            revision: values.revision.trim() || null,
            tool: values.tool,
            url: values.url,
          }
        : undefined;
    return {
      ...(externalSource ? { externalSource } : {}),
      sourceDiagramId: diagram.id,
      targetMode: values.targetMode as CreatableAuthorityMode,
      title: values.title,
    };
  };
  const reset = () => {
    pendingKey.current = null;
    setPreview(null);
  };
  const form = useForm({
    defaultValues: {
      revision: "",
      targetMode: targets[0] ?? "",
      title: `${diagram.title} (converted)`,
      tool: "",
      url: "",
    } as ConversionValues,
    // Any edit invalidates the previewed conversion and its idempotency key.
    listeners: { onChange: reset },
    onSubmit: ({ value }) => previewMutation.mutate(value),
    validators: { onChange: conversionSchema },
  });
  const previewMutation = useMutation({
    mutationFn: (values: ConversionValues) => {
      checkedAt.current = new Date().toISOString();
      return client.previewDiagramAuthorityConversion(request(values));
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
          ...request(form.state.values),
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
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <form.Field name="targetMode">
          {(field) => (
            <>
              <Label htmlFor={`authority-target-${diagram.id}`}>
                Diagram Authority Mode
              </Label>
              <select
                id={`authority-target-${diagram.id}`}
                onChange={(event) =>
                  field.handleChange(
                    event.target.value as CreatableAuthorityMode,
                  )
                }
                value={field.state.value}
              >
                {targets.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </>
          )}
        </form.Field>
        <form.Field name="title">
          {(field) => (
            <>
              <Label htmlFor={`authority-title-${diagram.id}`}>Title</Label>
              <Input
                id={`authority-title-${diagram.id}`}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                value={field.state.value}
              />
            </>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.targetMode}>
          {(targetMode) =>
            targetMode === "External Source Link" ? (
              <>
                <form.Field name="url">
                  {(field) => (
                    <>
                      <Label htmlFor={`authority-url-${diagram.id}`}>
                        HTTPS URL
                      </Label>
                      <Input
                        id={`authority-url-${diagram.id}`}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required
                        type="url"
                        value={field.state.value}
                      />
                    </>
                  )}
                </form.Field>
                <form.Field name="tool">
                  {(field) => (
                    <>
                      <Label htmlFor={`authority-tool-${diagram.id}`}>
                        Source tool
                      </Label>
                      <Input
                        id={`authority-tool-${diagram.id}`}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        required
                        value={field.state.value}
                      />
                    </>
                  )}
                </form.Field>
                <form.Field name="revision">
                  {(field) => (
                    <>
                      <Label htmlFor={`authority-revision-${diagram.id}`}>
                        Known revision (optional)
                      </Label>
                      <Input
                        id={`authority-revision-${diagram.id}`}
                        onChange={(event) =>
                          field.handleChange(event.target.value)
                        }
                        value={field.state.value}
                      />
                    </>
                  )}
                </form.Field>
              </>
            ) : null
          }
        </form.Subscribe>
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
