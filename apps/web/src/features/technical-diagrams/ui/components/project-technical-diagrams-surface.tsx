// biome-ignore-all lint/performance/noJsxPropsBind: Each Diagram View form binds its own selected nodes.
import type {
  ConvertToRecordPlan,
  PreviewConvertToRecordInput,
} from "@cantiara/api/technical-diagram-card";
import { diagramGraph } from "@cantiara/api/technical-diagram-structure";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  DiagramAuthorityConversion,
  DiagramOrigins,
  ExternalSourceLinkDetails,
} from "./diagram-authority-controls";
import {
  DiagramCompositionPanel,
  type RecordCardOption,
} from "./diagram-composition-panel";
import { DiagramVersionPanel } from "./diagram-version-panel";
import { NewTechnicalDiagramForm } from "./new-technical-diagram-form";
import { TechnicalDiagramCanvas } from "./technical-diagram-canvas";
import {
  type ArchitectureBindOption,
  TechnicalDiagramEditor,
} from "./technical-diagram-editor";
import { TechnicalDiagramOutline } from "./technical-diagram-outline";

function DiagramCard({
  bindOptions,
  diagram,
  recordOptions,
}: {
  bindOptions: ArchitectureBindOption[];
  diagram: TechnicalDiagramSource;
  recordOptions: RecordCardOption[];
}) {
  const graph = diagramGraph(diagram.model);
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>(() =>
    graph.nodes.map(({ id }) => id),
  );
  const [error, setError] = useState<string | null>(null);
  const pendingKey = useRef<string | null>(null);
  const options = orpc.technicalDiagramViews.queryOptions({
    input: { diagramId: diagram.id },
  });
  const views = useQuery(options);
  const versionOptions = orpc.technicalDiagramVersions.queryOptions({
    input: { diagramId: diagram.id },
  });
  const versions = useQuery({
    ...versionOptions,
    enabled: diagram.authorityMode !== "External Source Link",
  });
  const versionKey = useRef<string | null>(null);
  const [versionError, setVersionError] = useState<string | null>(null);
  const invalidate = () => queryClient.invalidateQueries();
  const createVersion = useMutation({
    mutationFn: (versionName: string) => {
      versionKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.createDiagramVersion({
          clientIdempotencyKey: versionKey.current as string,
          diagramId: diagram.id,
          name: versionName,
        }),
      );
    },
    onError: (failure) =>
      setVersionError(
        failure instanceof Error
          ? failure.message
          : "Diagram Version could not be created.",
      ),
    onSuccess: async () => {
      versionKey.current = null;
      setVersionError(null);
      await invalidate();
    },
  });
  const restoreVersion = useMutation({
    mutationFn: (versionId: string) =>
      runOnlineOnlyWrite(() =>
        client.restoreDiagramVersion({
          diagramId: diagram.id,
          expectedRevision: diagram.revision,
          versionId,
        }),
      ),
    onError: (failure) =>
      setVersionError(
        failure instanceof Error
          ? failure.message
          : "Diagram Version could not be restored.",
      ),
    onSuccess: async () => {
      setVersionError(null);
      await invalidate();
    },
  });
  const [plan, setPlan] = useState<ConvertToRecordPlan | null>(null);
  const [compositionError, setCompositionError] = useState<string | null>(null);
  const placeKey = useRef<string | null>(null);
  const convertKey = useRef<string | null>(null);
  const recordCards = useQuery(
    orpc.technicalDiagramRecordCards.queryOptions({
      input: { diagramId: diagram.id },
    }),
  );
  const compositionFailure = (fallback: string) => (failure: unknown) =>
    setCompositionError(failure instanceof Error ? failure.message : fallback);
  const placeCard = useMutation({
    mutationFn: (option: RecordCardOption) => {
      placeKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.placeDiagramRecordCard({
          clientIdempotencyKey: placeKey.current as string,
          diagramId: diagram.id,
          sourceId: option.id,
          sourceType: option.sourceType,
          x: 40,
          y: 40,
        }),
      );
    },
    onError: compositionFailure("The record card could not be placed."),
    onSuccess: async () => {
      placeKey.current = null;
      setCompositionError(null);
      await invalidate();
    },
  });
  const moveCard = useMutation({
    mutationFn: (input: { cardId: string; x: number; y: number }) =>
      runOnlineOnlyWrite(() =>
        client.moveDiagramRecordCard({ diagramId: diagram.id, ...input }),
      ),
    onSuccess: invalidate,
  });
  const removeCard = useMutation({
    mutationFn: (cardId: string) =>
      runOnlineOnlyWrite(() =>
        client.removeDiagramRecordCard({ cardId, diagramId: diagram.id }),
      ),
    onError: compositionFailure("The record card could not be removed."),
    onSuccess: invalidate,
  });
  const previewConvert = useMutation({
    mutationFn: (input: Omit<PreviewConvertToRecordInput, "diagramId">) => {
      convertKey.current = null;
      return runOnlineOnlyWrite(() =>
        client.previewDiagramNodeConversion({
          diagramId: diagram.id,
          ...input,
        }),
      );
    },
    onError: compositionFailure("The conversion could not be previewed."),
    onSuccess: (preview) => {
      setCompositionError(null);
      setPlan(preview);
    },
  });
  const confirmConvert = useMutation({
    mutationFn: (confirmed: ConvertToRecordPlan) => {
      convertKey.current ??= crypto.randomUUID();
      return runOnlineOnlyWrite(() =>
        client.convertDiagramNodeToRecord({
          clientIdempotencyKey: convertKey.current as string,
          plan: confirmed,
        }),
      );
    },
    onError: compositionFailure("The conversion could not be confirmed."),
    onSuccess: async () => {
      convertKey.current = null;
      setPlan(null);
      setCompositionError(null);
      await invalidate();
    },
  });
  const saveStructure = useMutation({
    mutationFn: (model: TechnicalDiagramSource["model"]) =>
      runOnlineOnlyWrite(() =>
        client.saveTechnicalDiagramStructure({ diagramId: diagram.id, model }),
      ),
    onError: (failure) =>
      setError(
        failure instanceof Error
          ? failure.message
          : "Structural model could not be saved.",
      ),
    onSuccess: async () => {
      setError(null);
      await invalidate();
    },
  });
  const saveLayout = useMutation({
    mutationFn: (input: { id: string; x: number; y: number }) =>
      runOnlineOnlyWrite(() =>
        client.saveDiagramLayout({
          diagramId: diagram.id,
          positions: { [input.id]: { x: input.x, y: input.y } },
          viewId: diagram.view?.id,
        }),
      ),
    onSuccess: invalidate,
  });
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
      <DiagramOrigins origins={diagram.origins} />
      {diagram.externalSource ? (
        <ExternalSourceLinkDetails source={diagram.externalSource} />
      ) : null}
      <TechnicalDiagramOutline diagram={diagram} />
      {diagram.authorityMode === "External Source Link" ? null : (
        <TechnicalDiagramCanvas
          diagram={diagram}
          onMove={(id, position) => saveLayout.mutate({ id, ...position })}
          onMoveRecordCard={(cardId, position) =>
            moveCard.mutate({ cardId, ...position })
          }
          recordCards={recordCards.data ?? []}
        />
      )}
      <TechnicalDiagramEditor
        bindOptions={bindOptions}
        diagram={diagram}
        disabled={saveStructure.isPending}
        onSave={(model) => saveStructure.mutate(model)}
      />
      <DiagramVersionPanel
        diagram={diagram}
        disabled={createVersion.isPending || restoreVersion.isPending}
        error={versionError}
        onCreate={(versionName) => createVersion.mutate(versionName)}
        onRestore={(version) => restoreVersion.mutate(version.id)}
        versions={versions.data ?? []}
      />
      <DiagramCompositionPanel
        cards={recordCards.data ?? []}
        diagram={diagram}
        disabled={
          placeCard.isPending ||
          removeCard.isPending ||
          previewConvert.isPending ||
          confirmConvert.isPending
        }
        error={compositionError}
        onCancelConvert={() => {
          convertKey.current = null;
          setPlan(null);
        }}
        onConfirmConvert={(confirmed) => confirmConvert.mutate(confirmed)}
        onPlace={(option) => placeCard.mutate(option)}
        onPreviewConvert={(input) => previewConvert.mutate(input)}
        onRemove={(cardId) => removeCard.mutate(cardId)}
        options={recordOptions}
        plan={plan}
        versions={versions.data ?? []}
      />
      <DiagramAuthorityConversion diagram={diagram} />
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
            {graph.nodes.map((node) => (
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
  const sourceRecords = useQuery(
    orpc.projectSourceRecords.queryOptions({ input: { projectId } }),
  );
  const works = useQuery(
    orpc.projectWallSourceOptions.queryOptions({ input: { projectId } }),
  );
  const recordOptions: RecordCardOption[] = [
    ...(works.data ?? []).flatMap((option) =>
      option.sourceType === "Work"
        ? [
            {
              id: option.id,
              sourceType: "Work" as const,
              title: option.title,
            },
          ]
        : [],
    ),
    ...(sourceRecords.data ?? []).flatMap((record) =>
      record.sourceType === "Decision" ||
      record.sourceType === "Risk" ||
      record.sourceType === "Open Question"
        ? [
            {
              id: record.id,
              sourceType: record.sourceType,
              title: record.title,
            },
          ]
        : [],
    ),
  ];
  const architectures = (diagrams.data ?? []).filter(
    (item) =>
      item.type === "Technical Architecture" &&
      item.authorityMode !== "External Source Link",
  );
  const architectureVersions = useQueries({
    queries: architectures.map((item) =>
      orpc.technicalDiagramVersions.queryOptions({
        input: { diagramId: item.id },
      }),
    ),
  });
  const bindOptions: ArchitectureBindOption[] = architectures.flatMap(
    (item, index) => [
      ...diagramGraph(item.model).nodes.map((node) => ({
        boundLabel: node.label,
        diagramId: item.id,
        diagramTitle: item.title,
        nodeId: node.id,
      })),
      ...(architectureVersions[index]?.data ?? []).flatMap((version) =>
        diagramGraph(version.model).nodes.map((node) => ({
          boundLabel: node.label,
          diagramId: item.id,
          diagramTitle: item.title,
          nodeId: node.id,
          versionId: version.id,
          versionName: version.name,
        })),
      ),
    ],
  );
  return (
    <section aria-label="Technical Diagram" className="space-y-5">
      <h2 className="font-semibold text-2xl">Technical Diagram</h2>
      {diagrams.isError ? (
        <p role="alert">Technical Diagram is unavailable.</p>
      ) : null}
      <NewTechnicalDiagramForm projectId={projectId} />
      {visible?.map((diagram) => (
        <DiagramCard
          bindOptions={bindOptions.filter(
            ({ diagramId }) => diagramId !== diagram.id,
          )}
          diagram={diagram}
          key={diagram.id}
          recordOptions={recordOptions}
        />
      ))}
    </section>
  );
}
