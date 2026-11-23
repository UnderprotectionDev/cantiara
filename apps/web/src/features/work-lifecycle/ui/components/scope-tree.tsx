// biome-ignore-all lint/performance/noJsxPropsBind: Record windows bind identity to the row model for this surface.
import type {
  ScopeTree,
  ScopeTreeFeatureNode,
  ScopeTreeNode,
  ScopeTreeReference,
} from "@cantiara/api/work-lifecycle";
import {
  VirtualList,
  type VirtualRowProps,
  virtualRowId,
} from "@cantiara/ui/components/virtual-list";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useMemo } from "react";
import { OpenSourceRecordButton } from "@/features/record-discovery/ui/components/context-record-preview";

export default function ScopeTreeView({ scopeTree }: { scopeTree: ScopeTree }) {
  const disclosures = useCreateStore<ReadonlySet<string>>(new Set<string>());
  const collapsedFeatures = useSelector(disclosures);
  const rows = useMemo(
    () =>
      scopeTree.features.flatMap((feature) => [
        { feature, id: `feature:${feature.work.id}` },
        ...(collapsedFeatures.has(feature.work.id)
          ? []
          : feature.includedWork.map((node) => ({
              id: `included:${feature.work.id}:${node.work.id}`,
              node,
              parentTitle: feature.work.title,
            }))),
      ]),
    [collapsedFeatures, scopeTree.features],
  );
  function setFeatureOpen(id: string, open: boolean) {
    disclosures.setState((current) => {
      if (current.has(id) === !open) {
        return current;
      }
      const next = new Set(current);
      if (open) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
  return (
    <section
      aria-labelledby="scope-tree-heading"
      className="mt-10 space-y-4 rounded-lg border border-border/70 bg-card/35 p-5"
      data-scope-tree-read-only="true"
      id="scope-tree"
    >
      <header>
        <h2
          className="text-xl font-semibold tracking-tight"
          id="scope-tree-heading"
        >
          Scope Tree
        </h2>
        <p className="mt-1 max-w-2xl text-sm/relaxed text-muted-foreground">
          Project scope from the current Feature and Included Work records.
        </p>
      </header>

      <details draggable={false} open>
        <summary className="cursor-pointer list-inside text-sm font-medium">
          {scopeTree.project.name}
        </summary>
        {scopeTree.features.length > 0 ? (
          <div className="mt-3 border-l border-border/70 pl-4">
            <VirtualList
              aria-label="Scope Tree records"
              className="space-y-3"
              estimateSize={110}
              gap={12}
              getKey={virtualRowId}
              rows={rows}
            >
              {(row, rowProps) =>
                "feature" in row ? (
                  <FeatureTreeNode
                    feature={row.feature}
                    onOpenChange={setFeatureOpen}
                    open={!collapsedFeatures.has(row.feature.work.id)}
                    projectId={scopeTree.project.id}
                    rowProps={rowProps}
                  />
                ) : (
                  <WorkTreeNode
                    node={row.node}
                    parentTitle={row.parentTitle}
                    projectId={scopeTree.project.id}
                    rowProps={rowProps}
                  />
                )
              }
            </VirtualList>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No Features in this Scope Tree.
          </p>
        )}
      </details>
    </section>
  );
}

function FeatureTreeNode({
  feature,
  onOpenChange,
  open,
  projectId,
  rowProps,
}: {
  feature: ScopeTreeFeatureNode;
  open: boolean;
  onOpenChange: (id: string, open: boolean) => void;
  projectId: string;
  rowProps?: VirtualRowProps;
}) {
  const completedCount = feature.progress.statusCounts.Closed;

  return (
    <li {...rowProps} draggable={false} id={`work-${feature.work.id}`}>
      <details
        draggable={false}
        onToggle={(event) =>
          onOpenChange(feature.work.id, event.currentTarget.open)
        }
        open={open}
      >
        <summary className="cursor-pointer list-inside">
          <span className="font-medium">
            {feature.work.key} {feature.work.title}
          </span>
          <span className="ml-2 text-xs text-muted-foreground">Feature</span>
        </summary>
        <div className="mt-2 space-y-2 pl-5 text-sm">
          <ScopeTreeWorkMetadata node={feature} projectId={projectId} />
          <p>
            <span className="font-medium">Progress:</span> {completedCount} /{" "}
            {feature.progress.includedWorkCount}
          </p>
          <OpenSourceRecordButton
            className="inline-block min-h-10 px-0 py-0 text-xs underline-offset-4 hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            target={{
              kind: "work",
              label: `${feature.work.key} · ${feature.work.title}`,
              projectId,
              workId: feature.work.id,
            }}
          />
        </div>
      </details>
    </li>
  );
}

function WorkTreeNode({
  node,
  parentTitle,
  projectId,
  rowProps,
}: {
  node: ScopeTreeNode;
  parentTitle: string;
  projectId: string;
  rowProps?: VirtualRowProps;
}) {
  return (
    <li
      {...rowProps}
      className="pl-5"
      draggable={false}
      id={`work-${node.work.id}`}
    >
      <div className="space-y-2 pl-1 text-sm">
        <p className="font-medium">
          <span className="sr-only">Included Work of {parentTitle}. </span>
          {node.work.key} {node.work.title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {node.work.type}
          </span>
        </p>
        <ScopeTreeWorkMetadata node={node} projectId={projectId} />
        <OpenSourceRecordButton
          className="inline-block min-h-10 px-0 py-0 text-xs underline-offset-4 hover:underline focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          target={{
            kind: "work",
            label: `${node.work.key} · ${node.work.title}`,
            projectId,
            workId: node.work.id,
          }}
        />
      </div>
    </li>
  );
}

function ScopeTreeWorkMetadata({
  node,
  projectId,
}: {
  node: ScopeTreeNode;
  projectId: string;
}) {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p>
        <span className="font-medium text-foreground">Status:</span>{" "}
        {node.work.status}
      </p>
      {node.blockers.length > 0 ? (
        <p>
          <span className="font-medium text-foreground">Blocked by:</span>{" "}
          <ScopeTreeReferences
            projectId={projectId}
            references={node.blockers}
          />
        </p>
      ) : null}
      {node.milestones.length > 0 ? (
        <p>
          <span className="font-medium text-foreground">In Milestone:</span>{" "}
          <ScopeTreeReferences
            projectId={projectId}
            references={node.milestones}
          />
        </p>
      ) : null}
    </div>
  );
}

function ScopeTreeReferences({
  projectId,
  references,
}: {
  projectId: string;
  references: readonly ScopeTreeReference[];
}) {
  return (
    <span>
      {references.map((reference, index) => (
        <span key={reference.id}>
          {index > 0 ? ", " : null}
          {reference.key ? (
            <ScopeTreeReferenceLink
              projectId={reference.projectId ?? projectId}
              reference={reference}
            />
          ) : (
            reference.label
          )}
        </span>
      ))}
    </span>
  );
}

function ScopeTreeReferenceLink({
  projectId,
  reference,
}: {
  projectId: string;
  reference: ScopeTreeReference;
}) {
  return (
    <>
      <span>
        {reference.key} {reference.label}
      </span>{" "}
      <OpenSourceRecordButton
        className="min-h-8 px-0 py-0 text-xs underline-offset-4 hover:underline"
        target={{
          kind: "work",
          label: `${reference.key} · ${reference.label}`,
          projectId,
          workId: reference.id,
        }}
      />
    </>
  );
}
