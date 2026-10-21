// biome-ignore-all lint/performance/noJsxPropsBind: Each form binds its own field state.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";

type DiagramType =
  | "Technical Architecture"
  | "Data Model"
  | "Technical Sequence";
type CreateMode = "Product-authored Model" | "External Source Link";

const TYPES: DiagramType[] = [
  "Technical Architecture",
  "Data Model",
  "Technical Sequence",
];
const MODES: CreateMode[] = ["Product-authored Model", "External Source Link"];

const newDiagramSchema = z
  .object({
    mode: z.enum(MODES),
    revision: z.string(),
    title: z.string().trim().min(1),
    tool: z.string(),
    type: z.enum(TYPES),
    url: z.string(),
  })
  .refine(
    (value) =>
      value.mode !== "External Source Link" ||
      (z.url().safeParse(value.url).success && value.tool.trim().length > 0),
  );
type NewDiagramValues = z.infer<typeof newDiagramSchema>;

export function NewTechnicalDiagramForm({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const pendingKey = useRef<string | null>(null);
  const create = useMutation({
    mutationFn: ({
      mode,
      revision,
      title,
      tool,
      type,
      url,
    }: NewDiagramValues) => {
      pendingKey.current ??= crypto.randomUUID();
      const base = {
        clientIdempotencyKey: pendingKey.current,
        projectId,
        title,
        type,
      };
      return runOnlineOnlyWrite(() =>
        mode === "External Source Link"
          ? client.createTechnicalDiagram({
              ...base,
              authorityMode: mode,
              externalSource: {
                lastCheckedAt: new Date().toISOString(),
                revision: revision.trim() || null,
                tool,
                url,
              },
            })
          : client.createTechnicalDiagram({ ...base, authorityMode: mode }),
      );
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Technical Diagram could not be created.",
      ),
    onSuccess: async () => {
      pendingKey.current = null;
      setError(null);
      await queryClient.invalidateQueries();
    },
  });
  const form = useForm({
    defaultValues: {
      mode: "Product-authored Model",
      revision: "",
      title: "",
      tool: "",
      type: "Technical Architecture",
      url: "",
    } as NewDiagramValues,
    // Any edit starts a new create attempt, so it gets a fresh idempotency key.
    listeners: {
      onChange: () => {
        pendingKey.current = null;
      },
    },
    onSubmit: async ({ value, formApi }) => {
      await create
        .mutateAsync(value)
        .then(() => formApi.setFieldValue("title", ""))
        .catch(() => undefined);
    },
    validators: { onChange: newDiagramSchema },
  });
  return (
    <form
      aria-label="New Technical Diagram"
      className="space-y-2 rounded-lg border p-4"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h3 className="font-medium">New Technical Diagram</h3>
      <form.Field name="title">
        {(field) => (
          <>
            <Label htmlFor="new-diagram-title">Title</Label>
            <Input
              id="new-diagram-title"
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          </>
        )}
      </form.Field>
      <form.Field name="type">
        {(field) => (
          <>
            <Label htmlFor="new-diagram-type">Type</Label>
            <select
              id="new-diagram-type"
              onChange={(event) =>
                field.handleChange(event.target.value as DiagramType)
              }
              value={field.state.value}
            >
              {TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        )}
      </form.Field>
      <form.Field name="mode">
        {(field) => (
          <>
            <Label htmlFor="new-diagram-mode">Diagram Authority Mode</Label>
            <select
              id="new-diagram-mode"
              onChange={(event) =>
                field.handleChange(event.target.value as CreateMode)
              }
              value={field.state.value}
            >
              {MODES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.mode}>
        {(mode) =>
          mode === "External Source Link" ? (
            <>
              <form.Field name="url">
                {(field) => (
                  <>
                    <Label htmlFor="new-diagram-url">HTTPS URL</Label>
                    <Input
                      id="new-diagram-url"
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
                    <Label htmlFor="new-diagram-tool">Source tool</Label>
                    <Input
                      id="new-diagram-tool"
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
                    <Label htmlFor="new-diagram-revision">
                      Known revision (optional)
                    </Label>
                    <Input
                      id="new-diagram-revision"
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
      <Button disabled={create.isPending} type="submit">
        Create
      </Button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}
