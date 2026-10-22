// biome-ignore-all lint/performance/noJsxPropsBind: Each Diagram View form binds its own selected nodes.
import type { diagramGraph } from "@cantiara/api/technical-diagram-structure";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client } from "@/utils/orpc";
import { diagramViewSchema } from "../../lib/technical-diagram-form-schemas";

export function DiagramViewForm({
  diagramId,
  error,
  nodes,
  onError,
  views,
}: {
  diagramId: string;
  error: string | null;
  nodes: ReturnType<typeof diagramGraph>["nodes"];
  onError: (message: string | null) => void;
  views: readonly { id: string; name: string; selectedNodeIds: string[] }[];
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries();
  const pendingKey = useRef<string | null>(null);
  const create = useMutation({
    mutationFn: ({
      name,
      selectedNodeIds,
    }: {
      name: string;
      selectedNodeIds: string[];
    }) => {
      pendingKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.createDiagramView({
          clientIdempotencyKey: pendingKey.current as string,
          diagramId,
          name,
          selectedNodeIds,
        }),
      );
    },
    onSuccess: async () => {
      pendingKey.current = null;
      onError(null);
      // A new Diagram View can become the diagram's current view (a view named
      // "Default"), so the diagram query is invalidated with the views list.
      await invalidate();
    },
    onError: (failure) =>
      onError(
        failure instanceof Error
          ? failure.message
          : "Diagram View could not be saved.",
      ),
  });
  const form = useForm({
    defaultValues: {
      name: "",
      selectedNodeIds: nodes.map(({ id }) => id),
    },
    // Any edit starts a new save attempt, so it gets a fresh idempotency key.
    listeners: {
      onChange: () => {
        pendingKey.current = null;
      },
    },
    onSubmit: async ({ value, formApi }) => {
      if (!diagramViewSchema.safeParse(value).success) {
        return;
      }
      await create
        .mutateAsync(value)
        .then(() => formApi.setFieldValue("name", ""))
        .catch(() => undefined);
    },
  });
  return (
    <section aria-label="Diagram View" className="space-y-2">
      <h4 className="font-medium">Diagram View</h4>
      {views.map((view) => (
        <p key={view.id}>
          {view.name}: {view.selectedNodeIds.length} nodes
        </p>
      ))}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <form.Field name="name">
          {(field) => (
            <>
              <Label htmlFor={`diagram-view-name-${diagramId}`}>Name</Label>
              <Input
                id={`diagram-view-name-${diagramId}`}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                value={field.state.value}
              />
            </>
          )}
        </form.Field>
        <form.Field name="selectedNodeIds">
          {(field) => (
            <fieldset
              aria-label="Diagram View"
              className="flex flex-wrap gap-3"
            >
              {nodes.map((node) => (
                <label
                  className="inline-flex items-center gap-1"
                  htmlFor={`diagram-view-node-${diagramId}-${node.id}`}
                  key={node.id}
                >
                  <Checkbox
                    checked={field.state.value.includes(node.id)}
                    id={`diagram-view-node-${diagramId}-${node.id}`}
                    onCheckedChange={(checked) =>
                      field.handleChange(
                        checked
                          ? [...field.state.value, node.id]
                          : field.state.value.filter((id) => id !== node.id),
                      )
                    }
                  />
                  {node.label}
                </label>
              ))}
            </fieldset>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.selectedNodeIds}>
          {(selectedNodeIds) => (
            <Button
              disabled={create.isPending || selectedNodeIds.length === 0}
              type="submit"
            >
              Save
            </Button>
          )}
        </form.Subscribe>
      </form>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
