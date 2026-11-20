// biome-ignore-all lint/performance/noJsxPropsBind: Each Diagram View form binds its own selected nodes.
import type { diagramGraph } from "@cantiara/api/technical-diagram-structure";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";

import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";
import { diagramViewSchema } from "../../lib/technical-diagram-form-schemas";

export function DiagramViewForm({
  diagramId,
  error,
  nodes,
  projectId,
  views,
}: {
  diagramId: string;
  error: string | null;
  nodes: ReturnType<typeof diagramGraph>["nodes"];
  projectId: string;
  views: readonly { id: string; name: string; selectedNodeIds: string[] }[];
}) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all(
      [
        orpc.technicalDiagrams.key({ input: { projectId } }),
        orpc.technicalDiagram.queryKey({ input: { diagramId } }),
        orpc.technicalDiagramViews.queryKey({ input: { diagramId } }),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  const create = usePreparedMutation(
    orpc.createDiagramView.mutationOptions({
      mutationFn: (input) => client.createDiagramView(input),
      // A view named "Default" can become the current diagram view.
      onSuccess: invalidate,
    }),
    (input: { name: string; selectedNodeIds: string[] }) => ({
      ...input,
      diagramId,
    }),
  );
  const form = useForm({
    defaultValues: {
      name: "",
      selectedNodeIds: nodes.map(({ id }) => id),
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
  const requestError = create.isError
    ? create.error.message || "Diagram View could not be saved."
    : error;
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
      {requestError ? <p role="alert">{requestError}</p> : null}
    </section>
  );
}
