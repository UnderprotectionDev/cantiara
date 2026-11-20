// biome-ignore-all lint/performance/noJsxPropsBind: Each Diagram View form binds its own selected nodes.
import type {
  ConvertToRecordPlan,
  PreviewConvertToRecordInput,
} from "@cantiara/api/technical-diagram-card";
import { diagramGraph } from "@cantiara/api/technical-diagram-structure";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { AppLink } from "@/components/app-link";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
import { client, orpc } from "@/utils/orpc";
import { usePersonalTechnicalDiagramView } from "../../hooks/use-personal-technical-diagram-view";
import type { ArchitectureBindOption } from "../../lib/technical-diagram-field-options";
import { DiagramAuthorityConversion } from "../forms/diagram-authority-conversion-form";
import { DiagramViewForm } from "../forms/diagram-view-form";
import { NewTechnicalDiagramForm } from "../forms/new-technical-diagram-form";
import type { RecordCardOption } from "../forms/place-record-form";
import {
  DiagramOrigins,
  ExternalSourceLinkDetails,
} from "./diagram-authority-controls";
import { DiagramCompositionPanel } from "./diagram-composition-panel";
import { DiagramVersionPanel } from "./diagram-version-panel";
import { TechnicalDiagramCanvas } from "./technical-diagram-canvas";
import { TechnicalDiagramEditor } from "./technical-diagram-editor";
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
  const invalidate = () =>
    Promise.all(
      [
        orpc.technicalDiagrams.queryKey({
          input: { projectId: diagram.projectId },
        }),
        orpc.technicalDiagram.queryKey({ input: { diagramId: diagram.id } }),
        options.queryKey,
        versionOptions.queryKey,
        orpc.technicalDiagramRecordCards.queryKey({
          input: { diagramId: diagram.id },
        }),
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  const createVersion = usePreparedMutation(
    orpc.createDiagramVersion.mutationOptions({
      mutationFn: (input) => client.createDiagramVersion(input),
      onSuccess: invalidate,
    }),
    (name: string) => ({ diagramId: diagram.id, name }),
  );
  const restoreVersion = useMutation(
    orpc.restoreDiagramVersion.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.restoreDiagramVersion(input),
      onSuccess: invalidate,
    }),
  );
  const personalView = usePersonalTechnicalDiagramView(
    diagram.id,
    diagram.view?.id,
  );
  const recordCards = useQuery(
    orpc.technicalDiagramRecordCards.queryOptions({
      input: { diagramId: diagram.id },
    }),
  );
  const placeCard = usePreparedMutation(
    orpc.placeDiagramRecordCard.mutationOptions({
      mutationFn: (input) => client.placeDiagramRecordCard(input),
      onSuccess: invalidate,
    }),
    (option: RecordCardOption) => ({
      diagramId: diagram.id,
      sourceId: option.id,
      sourceType: option.sourceType,
      x: 40,
      y: 40,
    }),
  );
  const moveCard = useMutation(
    orpc.moveDiagramRecordCard.mutationOptions({
      meta: { onlineWrite: true, retryInSurface: true },
      mutationFn: (input) => client.moveDiagramRecordCard(input),
      onSuccess: invalidate,
    }),
  );
  const removeCard = useMutation(
    orpc.removeDiagramRecordCard.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.removeDiagramRecordCard(input),
      onSuccess: invalidate,
    }),
  );
  const previewConvert = useMutation({
    meta: { retryInSurface: true },
    mutationKey: orpc.previewDiagramNodeConversion.mutationKey(),
    mutationFn: (input: Omit<PreviewConvertToRecordInput, "diagramId">) =>
      queryClient.query({
        ...orpc.previewDiagramNodeConversion.queryOptions({
          input: { ...input, diagramId: diagram.id },
        }),
        gcTime: 0,
        staleTime: 0,
      }),
  });
  const confirmConvert = usePreparedMutation(
    orpc.convertDiagramNodeToRecord.mutationOptions({
      meta: { retryInSurface: true },
      mutationFn: (input) => client.convertDiagramNodeToRecord(input),
      onSuccess: invalidate,
    }),
    (confirmed: ConvertToRecordPlan) => ({ plan: confirmed }),
  );
  const saveStructure = useMutation(
    orpc.saveTechnicalDiagramStructure.mutationOptions({
      meta: { onlineWrite: true, retryInSurface: true },
      mutationFn: (input) => client.saveTechnicalDiagramStructure(input),
      onSuccess: invalidate,
    }),
  );
  const saveLayout = useMutation(
    orpc.saveDiagramLayout.mutationOptions({
      meta: { onlineWrite: true, retryInSurface: true },
      mutationFn: (input) => client.saveDiagramLayout(input),
      onSuccess: invalidate,
    }),
  );
  function writeError(
    ...attempts: [
      mutation: { error: unknown; submittedAt: number },
      fallback: string,
    ][]
  ) {
    const latest = attempts.reduce((previous, attempt) =>
      attempt[0].submittedAt >= previous[0].submittedAt ? attempt : previous,
    );
    const [mutation, fallback] = latest;
    if (!mutation.error) {
      return null;
    }
    return mutation.error instanceof Error ? mutation.error.message : fallback;
  }
  function resetConversion() {
    previewConvert.reset();
    confirmConvert.reset();
  }
  const versionNames = Object.fromEntries(
    (versions.data ?? []).map((version) => [version.id, version.name]),
  );
  return (
    <article className="space-y-3 rounded-lg border p-4">
      <h3 className="font-medium">{diagram.title}</h3>
      <p className="text-sm text-muted-foreground">
        {diagram.type} · {diagram.authorityMode}
      </p>
      {diagram.type === "Data Model" ? (
        <AppLink
          className="text-sm underline"
          href={`/projects/${encodeURIComponent(diagram.projectId)}/schema-artifacts?diagramId=${encodeURIComponent(diagram.id)}`}
        >
          Open Schema Artifacts
        </AppLink>
      ) : null}
      <DiagramOrigins origins={diagram.origins} />
      {diagram.externalSource ? (
        <ExternalSourceLinkDetails source={diagram.externalSource} />
      ) : null}
      <TechnicalDiagramOutline diagram={diagram} versionNames={versionNames} />
      {diagram.authorityMode === "External Source Link" ||
      !personalView.isReady ? null : (
        <TechnicalDiagramCanvas
          diagram={diagram}
          key={`${diagram.id}:${diagram.view?.id ?? ""}`}
          onMove={(id, position) =>
            saveLayout.mutate({
              diagramId: diagram.id,
              positions: { [id]: position },
              viewId: diagram.view?.id,
            })
          }
          onMoveRecordCard={(cardId, position) =>
            moveCard.mutate({ cardId, diagramId: diagram.id, ...position })
          }
          onViewChange={personalView.schedule}
          recordCards={recordCards.data ?? []}
          savedView={personalView.saved}
        />
      )}
      {personalView.saveError ? (
        <p className="text-sm text-destructive" role="alert">
          {personalView.saveError}
        </p>
      ) : null}
      <TechnicalDiagramEditor
        bindOptions={bindOptions}
        diagram={diagram}
        disabled={saveStructure.isPending}
        onSave={(model) =>
          saveStructure.mutateAsync({ diagramId: diagram.id, model })
        }
      />
      <DiagramVersionPanel
        diagram={diagram}
        disabled={createVersion.isPending || restoreVersion.isPending}
        error={writeError(
          [createVersion, "Diagram Version could not be created."],
          [restoreVersion, "Diagram Version could not be restored."],
        )}
        onCreate={(versionName) => createVersion.mutateAsync(versionName)}
        onRestore={(version) =>
          restoreVersion.mutate({
            diagramId: diagram.id,
            expectedRevision: diagram.revision,
            versionId: version.id,
          })
        }
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
        error={writeError(
          [placeCard, "The record card could not be placed."],
          [moveCard, "The record card could not be moved."],
          [removeCard, "The record card could not be removed."],
          [previewConvert, "The conversion could not be previewed."],
          [confirmConvert, "The conversion could not be confirmed."],
        )}
        onCancelConvert={resetConversion}
        onConfirmConvert={(confirmed) =>
          confirmConvert.mutate(confirmed, { onSuccess: resetConversion })
        }
        onPlace={(option) => placeCard.mutateAsync(option)}
        onPreviewConvert={(input) => {
          confirmConvert.reset();
          previewConvert.mutate(input);
        }}
        onRemove={(cardId) =>
          removeCard.mutate({ cardId, diagramId: diagram.id })
        }
        options={recordOptions}
        plan={previewConvert.data ?? null}
        versions={versions.data ?? []}
      />
      <DiagramAuthorityConversion diagram={diagram} />
      <DiagramViewForm
        diagramId={diagram.id}
        error={writeError(
          [saveStructure, "Structural model could not be saved."],
          [saveLayout, "Element position could not be saved."],
        )}
        nodes={graph.nodes}
        projectId={diagram.projectId}
        views={views.data ?? []}
      />
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
      <h2 className="text-2xl font-semibold">Technical Diagram</h2>
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
