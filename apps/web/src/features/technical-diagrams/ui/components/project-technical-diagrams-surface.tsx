// biome-ignore-all lint/performance/noJsxPropsBind: Each Diagram View form binds its own selected nodes.
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

function DiagramCard({ diagram }: { diagram: TechnicalDiagramSource }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(() =>
    diagram.model.nodes.map(({ id }) => id),
  );
  const [error, setError] = useState<string | null>(null);
  const pendingKey = useRef<string | null>(null);
  const options = orpc.technicalDiagramViews.queryOptions({
    input: { diagramId: diagram.id },
  });
  const views = useQuery(options);
  const create = useMutation({
    mutationFn: () => {
      pendingKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.createDiagramView({
          clientIdempotencyKey: pendingKey.current as string,
          diagramId: diagram.id,
          name,
          selectedNodeIds,
        }),
      );
    },
    onSuccess: async () => {
      pendingKey.current = null;
      setName("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: options.queryKey });
    },
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Diagram View could not be saved.",
      ),
  });
  return (
    <article className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">{diagram.title}</h3>
      <p className="text-muted-foreground text-sm">
        {diagram.type} · {diagram.authorityMode}
      </p>
      <ol className="list-inside list-decimal">
        {diagram.model.nodes.map((node) => (
          <li key={node.id}>
            {node.label} · {node.kind}
          </li>
        ))}
      </ol>
      <section aria-label="Diagram View" className="space-y-2">
        <h4 className="font-medium">Diagram View</h4>
        {views.data?.map((view) => (
          <p key={view.id}>
            {view.name}: {view.selectedNodeIds.length} nodes
          </p>
        ))}
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <Label htmlFor={`diagram-view-name-${diagram.id}`}>Name</Label>
          <Input
            id={`diagram-view-name-${diagram.id}`}
            onChange={(event) => {
              pendingKey.current = null;
              setName(event.target.value);
            }}
            required
            value={name}
          />
          <fieldset aria-label="Diagram View" className="flex flex-wrap gap-3">
            {diagram.model.nodes.map((node) => (
              <label className="inline-flex items-center gap-1" key={node.id}>
                <input
                  checked={selectedNodeIds.includes(node.id)}
                  onChange={(event) => {
                    pendingKey.current = null;
                    setSelectedNodeIds((current) =>
                      event.target.checked
                        ? [...current, node.id]
                        : current.filter((id) => id !== node.id),
                    );
                  }}
                  type="checkbox"
                />
                {node.label}
              </label>
            ))}
          </fieldset>
          <Button
            disabled={create.isPending || selectedNodeIds.length === 0}
            type="submit"
          >
            Save
          </Button>
        </form>
        {error ? <p role="alert">{error}</p> : null}
      </section>
    </article>
  );
}

export default function ProjectTechnicalDiagramsSurface({
  projectId,
  selectedDiagramId,
}: {
  projectId: string;
  selectedDiagramId?: string;
}) {
  const diagrams = useQuery(
    orpc.technicalDiagrams.queryOptions({ input: { projectId } }),
  );
  const visible = selectedDiagramId
    ? diagrams.data?.filter(({ id }) => id === selectedDiagramId)
    : diagrams.data;
  return (
    <section aria-label="Technical Diagram" className="space-y-5">
      <h2 className="font-semibold text-2xl">Technical Diagram</h2>
      {diagrams.isError ? (
        <p role="alert">Technical Diagram is unavailable.</p>
      ) : null}
      {visible?.map((diagram) => (
        <DiagramCard diagram={diagram} key={diagram.id} />
      ))}
    </section>
  );
}
