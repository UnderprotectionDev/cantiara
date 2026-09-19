import type {
  ScopeTree,
  ScopeTreeFeatureNode,
  ScopeTreeNode,
  ScopeTreeReference,
} from "@cantiara/api/work-lifecycle";
import { useLinkProps } from "@tanstack/react-router";

export default function ScopeTreeView({ scopeTree }: { scopeTree: ScopeTree }) {
  return (
    <section
      aria-labelledby="scope-tree-heading"
      className="mt-10 space-y-4 border-y py-6"
      data-scope-tree-read-only="true"
      id="scope-tree"
    >
      <header>
        <h2 className="font-medium text-lg" id="scope-tree-heading">
          Scope Tree
        </h2>
        <p className="mt-1 max-w-2xl text-muted-foreground text-sm/relaxed">
          Project scope from the current Feature and Included Work records.
        </p>
      </header>

      <details draggable={false} open>
        <summary className="cursor-pointer list-inside font-medium text-sm">
          {scopeTree.project.name}
        </summary>
        {scopeTree.features.length > 0 ? (
          <ul
            aria-label="Scope Tree records"
            className="mt-3 space-y-3 border-l pl-4"
          >
            {scopeTree.features.map((feature) => (
              <FeatureTreeNode
                feature={feature}
                key={feature.work.id}
                projectId={scopeTree.project.id}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-muted-foreground text-sm">
            No Features in this Scope Tree.
          </p>
        )}
      </details>
    </section>
  );
}

function FeatureTreeNode({
  feature,
  projectId,
}: {
  feature: ScopeTreeFeatureNode;
  projectId: string;
}) {
  const completedCount = feature.progress.statusCounts.Closed;

  return (
    <li draggable={false}>
      <details draggable={false} open>
        <summary className="cursor-pointer list-inside">
          <span className="font-medium">
            {feature.work.key} {feature.work.title}
          </span>
          <span className="ml-2 text-muted-foreground text-xs">Feature</span>
        </summary>
        <div className="mt-2 space-y-2 pl-5 text-sm">
          <ScopeTreeWorkMetadata node={feature} projectId={projectId} />
          <p>
            <span className="font-medium">Progress:</span> {completedCount} /{" "}
            {feature.progress.includedWorkCount}
          </p>
          <OpenSourceRecordLink
            projectId={projectId}
            workId={feature.work.id}
          />
        </div>
        {feature.includedWork.length > 0 ? (
          <ul className="mt-3 space-y-2 border-l pl-4">
            {feature.includedWork.map((node) => (
              <WorkTreeNode
                key={node.work.id}
                node={node}
                projectId={projectId}
              />
            ))}
          </ul>
        ) : null}
      </details>
    </li>
  );
}

function WorkTreeNode({
  node,
  projectId,
}: {
  node: ScopeTreeNode;
  projectId: string;
}) {
  return (
    <li draggable={false}>
      <div className="space-y-2 pl-1 text-sm">
        <p className="font-medium">
          {node.work.key} {node.work.title}
          <span className="ml-2 font-normal text-muted-foreground text-xs">
            {node.work.type}
          </span>
        </p>
        <ScopeTreeWorkMetadata node={node} projectId={projectId} />
        <OpenSourceRecordLink projectId={projectId} workId={node.work.id} />
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
    <div className="space-y-1 text-muted-foreground text-xs">
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
  const linkProps = useLinkProps({
    activeOptions: { exact: true, includeHash: true },
    hash: `work-${reference.id}`,
    params: { projectId },
    to: "/projects/$projectId",
  });

  return (
    <a {...linkProps} className="underline-offset-4 hover:underline">
      {reference.key} {reference.label}
    </a>
  );
}

function OpenSourceRecordLink({
  projectId,
  workId,
}: {
  projectId: string;
  workId: string;
}) {
  const linkProps = useLinkProps({
    activeOptions: { exact: true, includeHash: true },
    hash: `work-${workId}`,
    params: { projectId },
    to: "/projects/$projectId",
  });

  return (
    <a
      {...linkProps}
      className="inline-block text-xs underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      Open source record
    </a>
  );
}
