import type { ExternalSourceLink } from "@cantiara/api/technical-diagram-authority";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";

export function ExternalSourceLinkDetails({
  source,
}: {
  source: ExternalSourceLink;
}) {
  return (
    <section aria-label="External Source Link" className="space-y-1 text-sm">
      <a
        className="underline"
        href={source.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        Open external source
      </a>
      <p>URL: {source.url}</p>
      <p>Tool: {source.tool}</p>
      <p>Revision: {source.revision ?? "Unknown"}</p>
      <p>Last checked: {source.lastCheckedAt}</p>
    </section>
  );
}

export function DiagramOrigins({
  origins,
}: {
  origins: TechnicalDiagramSource["origins"];
}) {
  if (origins.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Origin" className="text-sm">
      {origins.map((origin) => (
        <li key={`${origin.relation}:${origin.diagramId}`}>
          {origin.relation}: {origin.title} · {origin.authorityMode}
        </li>
      ))}
    </ul>
  );
}
