import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import { decisionChain } from "@cantiara/api/decision-chain";
import type { DecisionSupersessionGraph } from "@cantiara/api/decision-supersession";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";

export function decisionHref(projectId: string, id: string) {
  return `/projects/${encodeURIComponent(projectId)}#source-decision-${encodeURIComponent(id)}`;
}

export function DecisionChainView({
  graph,
  selectedId,
  projectId,
  preferences = DEFAULT_ACCOUNT_PREFERENCES,
}: {
  graph: DecisionSupersessionGraph;
  selectedId: string;
  projectId: string;
  preferences?: AccountPreferences;
}) {
  const chain = decisionChain(graph, selectedId);
  if (!chain) {
    return <p role="alert">Decision chain is unavailable.</p>;
  }
  if (chain.records.length === 1 && chain.records[0]?.life !== "Superseded") {
    return null;
  }
  const selected = chain.records.find((record) => record.id === selectedId);
  const direct = chain.relations.find(
    (edge) => edge.predecessorId === selectedId,
  );
  const successor = chain.records.find(
    (record) => record.id === direct?.successorId,
  );
  return (
    <section
      aria-label="Decision chain"
      className="space-y-3 break-words rounded-lg border border-border/70 p-4"
    >
      <h4 className="font-medium">Decision chain</h4>
      {selected?.life === "Superseded" ? (
        <div className="space-y-2 border-border/70 border-b pb-3">
          <p>
            Current Decision: {chain.current?.title ?? "No Valid Decision."}
          </p>
          {chain.current ? (
            <a
              className="inline-flex min-h-10 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
              href={decisionHref(projectId, chain.current.id)}
            >
              Open current decision
            </a>
          ) : null}
          {direct && successor ? (
            <div className="space-y-1 text-sm">
              <p>
                Superseded by{" "}
                <a
                  className="underline underline-offset-4"
                  href={decisionHref(projectId, successor.id)}
                >
                  {successor.title}
                </a>
              </p>
              <time dateTime={direct.occurredAt}>
                {formatAccountDateTime(direct.occurredAt, preferences)}
              </time>
              <p className="whitespace-pre-wrap break-words">
                {direct.rationale || "—"}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <ol className="space-y-2">
        {chain.records.map((record) => {
          const transition = chain.relations.find(
            (edge) => edge.predecessorId === record.id,
          );
          const successorTitle = chain.records.find(
            (item) => item.id === transition?.successorId,
          )?.title;
          return (
            <li
              className="space-y-1 border-border border-l-2 pl-3"
              key={record.id}
            >
              <div className="flex flex-wrap items-center gap-x-3">
                <a
                  aria-current={record.id === selectedId ? "page" : undefined}
                  className="min-w-0 break-words underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
                  href={decisionHref(projectId, record.id)}
                >
                  {record.title}
                </a>
                <span className="text-muted-foreground text-sm">
                  {record.life}
                </span>
              </div>
              {transition ? (
                <div className="space-y-1 text-muted-foreground text-sm">
                  <p>Superseded by {successorTitle}</p>
                  <time dateTime={transition.occurredAt}>
                    {formatAccountDateTime(transition.occurredAt, preferences)}
                  </time>
                  <p className="whitespace-pre-wrap break-words">
                    {transition.rationale || "—"}
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
