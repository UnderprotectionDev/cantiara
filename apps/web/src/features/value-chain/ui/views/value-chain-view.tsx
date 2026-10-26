import {
  VALUE_CHAIN_LABEL,
  VALUE_CHAIN_NOT_LINKED_LABEL,
  VALUE_CHAIN_NOTE,
  VALUE_CHAIN_OPEN_SOURCE_LABEL,
  VALUE_CHAIN_RELATED_NOTE,
  VALUE_CHAIN_UNAVAILABLE_LABEL,
  type ValueChain,
  type ValueChainNode,
  valueChainBoundByLabel,
} from "@cantiara/api/value-chain";
import { AppLink } from "@/components/app-link";
import { valueChainSourceHref } from "../../lib/value-chain-links";

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

function ChainNode({
  node,
  projectId,
}: {
  node: ValueChainNode;
  projectId: string;
}) {
  return (
    <li className="space-y-2">
      <div className="space-y-1 rounded-md border border-border/60 p-3">
        <NodeTitle node={node} />
        <p className="text-muted-foreground text-sm">{node.why}</p>
        <p className="text-sm">{valueChainBoundByLabel(node.relation.label)}</p>
        {node.repeat ? (
          <p className="text-muted-foreground text-sm">
            Also reached from another branch; shown in full there.
          </p>
        ) : null}
        <OpenSource node={node} projectId={projectId} />
      </div>
      {node.children.length > 0 ? (
        <ul className="ml-4 space-y-2 border-border/60 border-l pl-3">
          {node.children.map((child) => (
            <ChainNode
              key={`${child.type}:${child.id}`}
              node={child}
              projectId={projectId}
            />
          ))}
        </ul>
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
        <h3 className="font-semibold text-xl" id={headingId}>
          {VALUE_CHAIN_LABEL}
        </h3>
        <p className="text-muted-foreground text-sm">{VALUE_CHAIN_NOTE}</p>
        {chain.goal.unavailable ? (
          <p role="status">
            {`This Project Goal is unavailable: ${chain.goal.unavailable}. Records still bound to it are shown.`}
          </p>
        ) : null}
      </header>
      {chain.branches.length > 0 ? (
        <ul className="space-y-2">
          {chain.branches.map((node) => (
            <ChainNode
              key={`${node.type}:${node.id}`}
              node={node}
              projectId={projectId}
            />
          ))}
        </ul>
      ) : null}
      <section aria-labelledby={`${headingId}-gaps`} className="space-y-2">
        <h4 className="font-medium" id={`${headingId}-gaps`}>
          {`Gaps (${chain.gaps.length})`}
        </h4>
        {chain.gaps.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No step is missing on the explicit relations. This is not a verdict.
          </p>
        ) : (
          <ul className="space-y-1">
            {chain.gaps.map((gap) => (
              <li
                className="text-sm"
                key={`${gap.from.type}:${gap.from.id}:${gap.missing}`}
              >
                {gap.label}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={`${headingId}-unlinked`} className="space-y-2">
        <h4 className="font-medium" id={`${headingId}-unlinked`}>
          {`${VALUE_CHAIN_NOT_LINKED_LABEL} (${chain.notLinked.length})`}
        </h4>
        {chain.notLinked.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No related record sits outside this chain.
          </p>
        ) : (
          <ul className="space-y-2">
            {chain.notLinked.map((item) => (
              <li
                className="space-y-1 rounded-md border border-border/60 p-3"
                key={`${item.type}:${item.id}`}
              >
                <NodeTitle node={item} />
                <p className="text-muted-foreground text-sm">{item.reason}</p>
                <p className="text-sm">
                  {valueChainBoundByLabel(item.relation.label)}
                </p>
                {item.relation.label === "Related" ? (
                  <p className="text-muted-foreground text-sm">
                    {VALUE_CHAIN_RELATED_NOTE}
                  </p>
                ) : null}
                <OpenSource node={item} projectId={projectId} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
