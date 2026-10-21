import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";

/**
 * Technical Diagram structured outline: the keyboard and screen-reader path to
 * the canonical structural model. It reads the same model as the canvas and
 * never depends on coordinates.
 */
function ArchitectureOutline({
  model,
}: {
  model: Extract<TechnicalDiagramSource["model"], { nodes: unknown }>;
}) {
  const label = (id: string) =>
    model.nodes.find((node) => node.id === id)?.label ?? id;
  return (
    <>
      <h4 className="font-medium">Nodes</h4>
      <ul aria-label="Architecture nodes" className="list-inside list-disc">
        {model.nodes.map((node) => (
          <li key={node.id}>
            {node.label} · {node.kind}
          </li>
        ))}
      </ul>
      <h4 className="font-medium">Links</h4>
      <ul aria-label="Architecture links" className="list-inside list-disc">
        {model.links.map((link) => (
          <li key={`${link.from}>${link.kind}>${link.to}`}>
            {label(link.from)} {link.kind} {label(link.to)}
            {link.label ? ` · ${link.label}` : null}
          </li>
        ))}
      </ul>
    </>
  );
}

function DataModelOutline({
  model,
}: {
  model: Extract<TechnicalDiagramSource["model"], { tables: unknown }>;
}) {
  const column = (tableId: string, columnId: string) => {
    const table = model.tables.find(({ id }) => id === tableId);
    return `${table?.name ?? tableId}.${table?.columns.find(({ id }) => id === columnId)?.name ?? columnId}`;
  };
  return (
    <>
      <h4 className="font-medium">Tables</h4>
      <ul aria-label="Data Model tables" className="space-y-2">
        {model.tables.map((table) => (
          <li key={table.id}>
            <span className="font-medium">{table.name}</span>
            <ul aria-label={`${table.name} columns`} className="list-inside">
              {table.columns.map((item) => (
                <li key={item.id}>
                  {item.name} · {item.type}
                  {item.primaryKey ? " · primary key" : ""}
                  {item.nullable ? " · nullable" : " · not null"}
                  {item.unique ? " · unique" : ""}
                  {item.default ? ` · default ${item.default}` : ""}
                </li>
              ))}
            </ul>
            {table.indexes.length > 0 ? (
              <ul aria-label={`${table.name} indexes`} className="list-inside">
                {table.indexes.map((index) => (
                  <li key={index.id}>
                    {index.unique ? "Unique index" : "Index"} {index.name} on{" "}
                    {index.columnIds
                      .map(
                        (id) =>
                          table.columns.find((item) => item.id === id)?.name ??
                          id,
                      )
                      .join(", ")}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <h4 className="font-medium">Relations</h4>
      <ul aria-label="Data Model relations" className="list-inside list-disc">
        {model.relations.map((relation) => (
          <li key={relation.id}>
            {column(relation.fromTableId, relation.fromColumnId)} references{" "}
            {column(relation.toTableId, relation.toColumnId)} ·{" "}
            {relation.cardinality} · on delete {relation.onDelete} · on update{" "}
            {relation.onUpdate}
          </li>
        ))}
      </ul>
    </>
  );
}

function SequenceOutline({
  model,
}: {
  model: Extract<TechnicalDiagramSource["model"], { participants: unknown }>;
}) {
  const name = (id: string) =>
    model.participants.find((item) => item.id === id)?.label ?? id;
  return (
    <>
      <h4 className="font-medium">Participants</h4>
      <ul aria-label="Sequence participants" className="list-inside list-disc">
        {model.participants.map((participant) => (
          <li key={participant.id}>
            {participant.label} · {participant.kind}
            {participant.bind
              ? ` · bound to ${participant.bind.boundLabel} (${
                  participant.bind.versionId
                    ? `Diagram Version ${participant.bind.versionId}`
                    : "node only, no Diagram Version pinned"
                })`
              : ""}
          </li>
        ))}
      </ul>
      <h4 className="font-medium">Steps</h4>
      <ol aria-label="Sequence steps" className="list-inside list-decimal">
        {model.steps.map((step) =>
          step.kind === "Group" ? (
            <li key={step.id}>
              {step.groupKind} · {step.condition}
              <ol className="ml-4 list-inside list-decimal">
                {step.steps.map((inner) => (
                  <li key={inner.id}>
                    {name(inner.from)} → {name(inner.to)} · {inner.messageKind}{" "}
                    · {inner.label}
                  </li>
                ))}
              </ol>
            </li>
          ) : (
            <li key={step.id}>
              {name(step.from)} → {name(step.to)} · {step.messageKind} ·{" "}
              {step.label}
            </li>
          ),
        )}
      </ol>
    </>
  );
}

export function TechnicalDiagramOutline({
  diagram,
}: {
  diagram: Pick<TechnicalDiagramSource, "model" | "title" | "type">;
}) {
  const { model } = diagram;
  return (
    <section
      aria-label="Technical Diagram outline"
      className="space-y-2"
      // The outline is a reading region: keyboard users reach it by tab.
      // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable region
      tabIndex={0}
    >
      <h3 className="font-medium">
        {diagram.title} outline · {diagram.type}
      </h3>
      {"nodes" in model ? <ArchitectureOutline model={model} /> : null}
      {"tables" in model ? <DataModelOutline model={model} /> : null}
      {"participants" in model ? <SequenceOutline model={model} /> : null}
    </section>
  );
}
