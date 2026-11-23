// biome-ignore-all lint/performance/noJsxPropsBind: The disclosure handler binds to one gap.

import {
  VALUE_CHAIN_CHOOSE_EXISTING_LABEL,
  VALUE_CHAIN_FILL_GAP_LABEL,
  VALUE_CHAIN_GAP_NOTE,
  VALUE_CHAIN_LABEL,
  VALUE_CHAIN_NOT_LINKED_LABEL,
  VALUE_CHAIN_NOTE,
  VALUE_CHAIN_OPEN_FAILED,
  VALUE_CHAIN_OPEN_SOURCE_LABEL,
  VALUE_CHAIN_RELATED_NOTE,
  VALUE_CHAIN_START_NEW_LABEL,
  VALUE_CHAIN_UNAVAILABLE_LABEL,
  type ValueChain,
  type ValueChainGap,
  type ValueChainNode,
  valueChainBoundByLabel,
} from "@cantiara/api/value-chain";
import { Button } from "@cantiara/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
import {
  VirtualList,
  type VirtualRowProps,
} from "@cantiara/ui/components/virtual-list";
import { AppLink } from "@/components/app-link";
import {
  valueChainGapActions,
  valueChainSourceHref,
} from "../../lib/value-chain-links";

function OpenSource({
  node,
  projectId,
}: {
  node: { id: string; title: string | null; type: ValueChainNode["type"] };
  projectId: string;
}) {
  const href = valueChainSourceHref(projectId, node);
  if (!href) {
    return null;
  }
  return (
    <AppLink
      aria-label={`${VALUE_CHAIN_OPEN_SOURCE_LABEL}: ${node.title ?? VALUE_CHAIN_UNAVAILABLE_LABEL}`}
      className="underline underline-offset-2"
      href={href}
    >
      {VALUE_CHAIN_OPEN_SOURCE_LABEL}
    </AppLink>
  );
}

function NodeTitle({
  node,
}: {
  node: Pick<ValueChainNode, "status" | "title" | "type" | "unavailable">;
}) {
  if (node.unavailable) {
    return (
      <p className="font-medium">
        {`${VALUE_CHAIN_UNAVAILABLE_LABEL} `}
        <span className="text-muted-foreground">{`· ${node.type} · ${node.unavailable}`}</span>
      </p>
    );
  }
  return (
    <p className="font-medium">
      {node.title}
      <span className="text-muted-foreground">
        {` · ${node.type}${node.status ? ` · ${node.status}` : ""}`}
      </span>
    </p>
  );
}

/**
 * `Fill this gap` only reveals two ways into the owning feature. Neither link
 * writes: the relation or record exists only after the founder saves it there.
 */
function GapRow({
  gap,
  projectId,
  rowProps,
}: {
  gap: ValueChainGap;
  projectId: string;
  rowProps: VirtualRowProps;
}) {
  const actions = valueChainGapActions(projectId, gap);
  return (
    <Collapsible render={<li {...rowProps} className="space-y-2 text-sm" />}>
      <p>{gap.label}</p>
      <CollapsibleTrigger render={<Button variant="outline" />}>
        {VALUE_CHAIN_FILL_GAP_LABEL}
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 rounded-md border border-border/60 p-3">
        {actions ? (
          <div className="flex flex-wrap gap-4">
            <AppLink
              className="underline underline-offset-2"
              href={actions.choose}
            >
              {VALUE_CHAIN_CHOOSE_EXISTING_LABEL}
            </AppLink>
            <AppLink
              className="underline underline-offset-2"
              href={actions.start}
            >
              {VALUE_CHAIN_START_NEW_LABEL}
            </AppLink>
          </div>
        ) : (
          <p role="alert">{VALUE_CHAIN_OPEN_FAILED}</p>
        )}
        <p className="text-muted-foreground">{VALUE_CHAIN_GAP_NOTE}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ChainNode({
  node,
  projectId,
  rowProps,
}: {
  node: ValueChainNode;
  projectId: string;
  rowProps?: VirtualRowProps;
}) {
  return (
    <li {...rowProps} className="space-y-2">
      <div className="space-y-1 rounded-md border border-border/60 p-3">
        <NodeTitle node={node} />
        <p className="text-sm text-muted-foreground">{node.why}</p>
        <p className="text-sm">{valueChainBoundByLabel(node.relation.label)}</p>
        {node.repeat ? (
          <p className="text-sm text-muted-foreground">
            Also reached from another branch; shown in full there.
          </p>
        ) : null}
        <OpenSource node={node} projectId={projectId} />
      </div>
      {node.children.length > 0 ? (
        <VirtualList
          className="ml-4 space-y-2 border-l border-border/60 pl-3"
          estimateSize={80}
          gap={8}
          getKey={(child) => `${child.type}:${child.id}`}
          rows={node.children}
        >
          {(child, childRowProps) => (
            <ChainNode
              node={child}
              projectId={projectId}
              rowProps={childRowProps}
            />
          )}
        </VirtualList>
      ) : null}
    </li>
  );
}

/**
 * The `Value Chain` of one Project Goal. It only reads: every node shows why it
 * is there and opens its source, missing steps are listed as plain gaps and
 * unlinked records stay under `Not linked to goal`. No control here writes a
 * relation, a record or a status, and nothing scores the chain.
 */
export function ValueChainView({
  chain,
  projectId,
}: {
  chain: ValueChain;
  projectId: string;
}) {
  const headingId = `value-chain-${chain.goal.id}`;
  return (
    <section aria-labelledby={headingId} className="space-y-5">
      <header className="space-y-1">
        <h3 className="text-xl font-semibold" id={headingId}>
          {VALUE_CHAIN_LABEL}
        </h3>
        <p className="text-sm text-muted-foreground">{VALUE_CHAIN_NOTE}</p>
        {chain.goal.unavailable ? (
          <p role="status">
            {`This Project Goal is unavailable: ${chain.goal.unavailable}. Records still bound to it are shown.`}
          </p>
        ) : null}
      </header>
      {chain.branches.length > 0 ? (
        <VirtualList
          className="space-y-2"
          estimateSize={80}
          gap={8}
          getKey={(node) => `${node.type}:${node.id}`}
          rows={chain.branches}
        >
          {(node, rowProps) => (
            <ChainNode node={node} projectId={projectId} rowProps={rowProps} />
          )}
        </VirtualList>
      ) : null}
      <section aria-labelledby={`${headingId}-gaps`} className="space-y-2">
        <h4 className="font-medium" id={`${headingId}-gaps`}>
          {`Gaps (${chain.gaps.length})`}
        </h4>
        {chain.gaps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No step is missing on the explicit relations. This is not a verdict.
          </p>
        ) : (
          <VirtualList
            className="space-y-1"
            estimateSize={72}
            gap={4}
            getKey={(gap) => `${gap.from.type}:${gap.from.id}:${gap.missing}`}
            rows={chain.gaps}
          >
            {(gap, rowProps) => (
              <GapRow gap={gap} projectId={projectId} rowProps={rowProps} />
            )}
          </VirtualList>
        )}
      </section>
      <section aria-labelledby={`${headingId}-unlinked`} className="space-y-2">
        <h4 className="font-medium" id={`${headingId}-unlinked`}>
          {`${VALUE_CHAIN_NOT_LINKED_LABEL} (${chain.notLinked.length})`}
        </h4>
        {chain.notLinked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No related record sits outside this chain.
          </p>
        ) : (
          <VirtualList
            className="space-y-2"
            estimateSize={60}
            gap={8}
            getKey={(item) => `${item.type}:${item.id}`}
            rows={chain.notLinked}
          >
            {(item, rowProps) => (
              <li
                className="space-y-1 rounded-md border border-border/60 p-3"
                {...rowProps}
              >
                <NodeTitle node={item} />
                <p className="text-sm text-muted-foreground">{item.reason}</p>
                <p className="text-sm">
                  {valueChainBoundByLabel(item.relation.label)}
                </p>
                {item.relation.label === "Related" ? (
                  <p className="text-sm text-muted-foreground">
                    {VALUE_CHAIN_RELATED_NOTE}
                  </p>
                ) : null}
                <OpenSource node={item} projectId={projectId} />
              </li>
            )}
          </VirtualList>
        )}
      </section>
    </section>
  );
}
