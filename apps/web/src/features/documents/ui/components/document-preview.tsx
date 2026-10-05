import {
  type DocumentLiveSectionSource,
  type DocumentRecordReferenceView,
  documentLiveDirectives,
  documentSectionById,
  type LiveWorkSource,
} from "@cantiara/api/documents";
import type { ProjectSourceType } from "@cantiara/api/project-source-records";
import type { SmartCollectionViewSource } from "@cantiara/api/smart-collections";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { defaultHighlighter } from "@tanstack/highlight";
import { createTanStackMarkdownHighlighter } from "@tanstack/highlight/markdown";
import { createThemeCss } from "@tanstack/highlight/theme";
import { githubDarkTheme } from "@tanstack/highlight/themes/github-dark";
import { githubLightTheme } from "@tanstack/highlight/themes/github-light";
import type { MarkdownExtension } from "@tanstack/markdown";
import { Markdown } from "@tanstack/markdown/react";
import katex from "katex";
import "katex/dist/katex.min.css";
import mermaid from "mermaid";
import {
  type MouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { SourceRecordPreviewTarget } from "@/features/record-discovery/ui/components/context-record-preview";
import {
  documentRecordHash,
  projectSourceRecordHash,
  workRecordHref,
} from "../../../project-shell/lib/project-shell-navigation";

mermaid.initialize({ securityLevel: "strict", startOnLoad: false });

const codeHighlighter = createTanStackMarkdownHighlighter(defaultHighlighter);
const highlightThemeCss = createThemeCss({
  light: githubLightTheme,
  dark: githubDarkTheme,
  darkSelector: ".dark",
});

const previewPattern =
  /^[ ]{0,3}(?<fenceCharacter>`|~)(?<fenceTail>\k<fenceCharacter>{2,})(?<language>[^\n]*)\n(?<fenceBody>[\s\S]*?)\n[ ]{0,3}\k<fenceCharacter>\k<fenceTail>\k<fenceCharacter>*[ \t]*(?=\r?\n|$)|(`+)([^`\n]*?)\5|\$\$([\s\S]*?)\$\$/gm;

const livePartKind = {
  Work: "live-work",
  "Smart Collection": "live-collection",
  "Technical Diagram": "live-diagram",
  "Document section": "live-section",
} as const;

const inlineMathExtension: MarkdownExtension = {
  name: "document-inline-math",
  transformInline(nodes) {
    return nodes.flatMap((node) => {
      if (node.type !== "text") {
        return [node];
      }
      const pieces: typeof nodes = [];
      const pattern = /(?<!\\)(?<!\$)\$([^$\n]+)\$(?!\$)/g;
      let cursor = 0;
      for (const match of node.value.matchAll(pattern)) {
        const position = match.index ?? 0;
        if (position > cursor) {
          pieces.push({
            type: "text",
            value: node.value.slice(cursor, position),
          });
        }
        pieces.push({
          type: "inlineComponent",
          name: "InlineMath",
          tagName: "document-inline-math",
          attributes: { latex: match[1] },
          properties: { latex: match[1] },
          children: [],
        });
        cursor = position + match[0].length;
      }
      if (cursor === 0) {
        return [node];
      }
      if (cursor < node.value.length) {
        pieces.push({ type: "text", value: node.value.slice(cursor) });
      }
      return pieces;
    });
  },
};

const inlineRecordReferenceExtension: MarkdownExtension = {
  name: "document-record-reference",
  transformInline(nodes) {
    return nodes.flatMap((node) => {
      if (node.type !== "text") {
        return [node];
      }
      const pieces: typeof nodes = [];
      const pattern =
        /\[\[record:([A-Za-z ]{1,40}):([^|\]\n]{1,255})\|([^\]\n]{1,255})\]\]/g;
      let cursor = 0;
      for (const match of node.value.matchAll(pattern)) {
        const [matchedText, recordType, recordId, label] = match;
        const position = match.index ?? 0;
        if (!(matchedText && recordType && recordId && label)) {
          continue;
        }
        if (position > cursor) {
          pieces.push({
            type: "text",
            value: node.value.slice(cursor, position),
          });
        }
        pieces.push({
          type: "inlineComponent",
          name: "DocumentRecordReference",
          tagName: "document-record-reference",
          attributes: { recordId, recordType, label },
          properties: { recordId, recordType, label },
          children: [],
        });
        cursor = position + matchedText.length;
      }
      if (cursor === 0) {
        return [node];
      }
      if (cursor < node.value.length) {
        pieces.push({ type: "text", value: node.value.slice(cursor) });
      }
      return pieces;
    });
  },
};

const documentSectionAnchorPattern =
  /\s+\{#([A-Za-z0-9][A-Za-z0-9_-]{0,254})\}[ \t]*$/;

const documentSectionAnchorExtension: MarkdownExtension = {
  name: "document-section-anchor",
  transformDocument(document) {
    return {
      ...document,
      children: document.children.map((node) => {
        if (node.type !== "heading") {
          return node;
        }
        const lastChild = node.children.at(-1);
        if (lastChild?.type !== "text") {
          return node;
        }
        const match = documentSectionAnchorPattern.exec(lastChild.value);
        const sectionId = match?.[1];
        if (!(match && sectionId)) {
          return node;
        }
        const children = [...node.children];
        const headingText = lastChild.value.slice(0, match.index);
        if (headingText) {
          children[children.length - 1] = { ...lastChild, value: headingText };
        } else {
          children.pop();
        }
        return {
          ...node,
          children,
          id: sectionId,
        };
      }),
    };
  },
};

function recordReferenceHref(
  projectId: string | null,
  recordType: string,
  recordId: string,
) {
  if (projectId === null) {
    return recordType === "Document"
      ? `/personal-wiki#${documentRecordHash(recordId)}`
      : null;
  }
  if (recordType === "Work") {
    return workRecordHref(projectId, recordId);
  }
  if (isProjectSourceType(recordType)) {
    return `/projects/${encodeURIComponent(projectId)}#${projectSourceRecordHash(
      recordType,
      recordId,
    )}`;
  }
  if (recordType === "Technical Diagram") {
    return `/projects/${encodeURIComponent(projectId)}#technical-diagram-${encodeURIComponent(recordId)}`;
  }
  if (recordType === "Document") {
    return `/projects/${encodeURIComponent(projectId)}#${documentRecordHash(
      recordId,
    )}`;
  }
  return null;
}

const projectSourceTypes = new Set<ProjectSourceType>([
  "Assumption",
  "Decision",
  "Milestone",
  "Open Question",
  "Production Incident",
  "Project Release",
  "Risk",
]);

function isProjectSourceType(
  recordType: string,
): recordType is ProjectSourceType {
  return projectSourceTypes.has(recordType as ProjectSourceType);
}

function documentPreviewRecordTarget(
  label: string,
  projectId: string | null,
  recordType: string,
  recordId: string,
): SourceRecordPreviewTarget | null {
  if (recordType === "Work" && projectId) {
    return { kind: "work", label, projectId, workId: recordId };
  }
  if (recordType === "Document") {
    return { documentId: recordId, kind: "document", label, projectId };
  }
  if (projectId && isProjectSourceType(recordType)) {
    return {
      kind: "project-source-record",
      label,
      projectId,
      sourceId: recordId,
      sourceType: recordType,
    };
  }
  return null;
}

function SourceRecordPreviewLink({
  children,
  className,
  href,
  onOpenSourceRecord,
  target,
}: {
  children: ReactNode;
  className?: string;
  href: string | null;
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
  target: SourceRecordPreviewTarget | null;
}) {
  const handleOpenSourceRecord = useCallback(() => {
    if (target) {
      onOpenSourceRecord?.(target);
    }
  }, [onOpenSourceRecord, target]);

  if (target && onOpenSourceRecord) {
    return (
      <Button
        aria-label={`Open source record: ${target.label}`}
        className={`h-auto px-0 py-0 font-normal ${className ?? ""}`}
        onClick={handleOpenSourceRecord}
        type="button"
        variant="link"
      >
        {children}
      </Button>
    );
  }
  return href ? (
    <a className={className} href={href}>
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}

function MermaidPreview({ source }: { source: string }) {
  const id = useId().replaceAll(/[^a-zA-Z0-9]/g, "");
  const [rendered, setRendered] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setRendered(null);
    setError(null);
    mermaid
      .render(`documentMermaid${id}`, source)
      .then(({ svg }) => {
        if (active) {
          setRendered(svg);
        }
      })
      .catch((failure: unknown) => {
        if (active) {
          setError(
            failure instanceof Error
              ? failure.message
              : "Diagram could not be rendered.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [id, source]);

  return (
    <div className="space-y-2">
      {error ? <p role="alert">{error}</p> : null}
      {rendered ? (
        <img
          alt="Mermaid diagram"
          height={300}
          src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(rendered)}`}
          width={600}
        />
      ) : null}
      <pre className="overflow-auto rounded-md border bg-muted p-3 text-sm">
        <code>{`\`\`\`mermaid\n${source}\n\`\`\``}</code>
      </pre>
    </div>
  );
}

function useKatexRendering(source: string, displayMode: boolean) {
  const target = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!target.current) {
      return;
    }
    try {
      katex.render(source, target.current, {
        displayMode,
        throwOnError: true,
        trust: false,
      });
      setError(null);
    } catch (failure) {
      target.current.replaceChildren();
      setError(
        failure instanceof Error
          ? failure.message
          : "Formula could not be rendered.",
      );
    }
  }, [displayMode, source]);
  return { error, target };
}

function MathPreview({ source }: { source: string }) {
  const { error, target } = useKatexRendering(source, true);
  return (
    <div className="space-y-2">
      {error ? <p role="alert">{error}</p> : null}
      <span ref={target} />
      <pre className="overflow-auto text-sm">{`$$${source}$$`}</pre>
    </div>
  );
}

function InlineMath({ latex }: { latex: string }) {
  const { error, target } = useKatexRendering(latex, false);
  return (
    <span>
      {error ? (
        <span role="alert">
          {error} ${latex}$
        </span>
      ) : null}
      <span ref={target} />
    </span>
  );
}

interface LiveWorkBlock {
  source: LiveWorkSource | null;
  workId: string;
}

interface LiveOtherBlock {
  id: string;
  kind: "Work" | "Smart Collection" | "Technical Diagram" | "Document section";
  sectionId?: string | null;
  source:
    | SmartCollectionViewSource
    | TechnicalDiagramSource
    | DocumentLiveSectionSource
    | null;
  viewId: string | null;
}

function LiveSectionCard({
  block,
  loading,
  onOpenSourceRecord,
}: {
  block?: LiveOtherBlock;
  loading: boolean;
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
}) {
  const source = block?.source;
  if (!(source && "sectionId" in source)) {
    return (
      <section
        aria-label="Read-only live section"
        className="rounded-lg border p-4"
      >
        <p className="text-xs">Read-only live section</p>
        <p role="status">
          {loading ? "Loading source record…" : "Source record is unavailable."}
        </p>
      </section>
    );
  }
  return (
    <section
      aria-label="Read-only live section"
      className="space-y-2 rounded-lg border p-4"
    >
      <p className="text-xs">Read-only live section</p>
      <h3 className="font-medium">
        {source.title} · {source.heading}
      </h3>
      <Markdown extensions={[inlineMathExtension]}>{source.text}</Markdown>
      <SourceRecordPreviewLink
        className="underline"
        href={
          source.projectId === null
            ? `/personal-wiki#${documentRecordHash(source.documentId)}`
            : `/projects/${encodeURIComponent(source.projectId)}#${documentRecordHash(source.documentId)}`
        }
        onOpenSourceRecord={onOpenSourceRecord}
        target={{
          documentId: source.documentId,
          kind: "document",
          label: `${source.title} · ${source.heading}`,
          projectId: source.projectId,
        }}
      >
        Open source record
      </SourceRecordPreviewLink>
    </section>
  );
}

function MembershipReasons({ reasons }: { reasons: string[] }) {
  return (
    <p className="text-muted-foreground text-xs">
      <span className="font-medium">Membership reason: </span>
      {reasons.join(" · ")}
    </p>
  );
}

interface SmartCollectionPreviewMember {
  details: string[];
  href: string;
  id: string;
  label: string;
  membershipReasons: string[];
  target: SourceRecordPreviewTarget | null;
}

function SmartCollectionMembers({
  onOpenSourceRecord,
  source,
}: {
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
  source: SmartCollectionViewSource;
}) {
  let memberHeading: string;
  let detailHeadings: string[];
  let members: SmartCollectionPreviewMember[];

  if (source.sourceType === "Work") {
    memberHeading = "Work";
    detailHeadings = ["Status", "Type"];
    members = source.works.map((record) => ({
      details: [record.status, record.type],
      href: workRecordHref(record.projectId, record.id),
      id: record.id,
      label: `${record.key} · ${record.title}`,
      membershipReasons: record.membershipReasons,
      target: {
        kind: "work",
        label: `${record.key} · ${record.title}`,
        projectId: record.projectId,
        workId: record.id,
      },
    }));
  } else if (
    source.sourceType === "Document" ||
    source.sourceType === "Wiki Document"
  ) {
    memberHeading = "Document";
    detailHeadings = ["Type"];
    members = source.documents.map((record) => ({
      details: [record.type],
      href:
        record.projectId === null
          ? `/personal-wiki#${documentRecordHash(record.id)}`
          : `/projects/${encodeURIComponent(record.projectId)}#${documentRecordHash(record.id)}`,
      id: record.id,
      label: record.title,
      membershipReasons: record.membershipReasons,
      target: {
        documentId: record.id,
        kind: "document",
        label: record.title,
        projectId: record.projectId,
      },
    }));
  } else {
    memberHeading = source.sourceType;
    detailHeadings = ["Status"];
    members = source.projectSourceRecords.map((record) => ({
      details: [record.status],
      href: `/projects/${encodeURIComponent(record.projectId)}#${projectSourceRecordHash(record.sourceType, record.id)}`,
      id: record.id,
      label: record.title,
      membershipReasons: record.membershipReasons,
      target: {
        kind: "project-source-record",
        label: record.title,
        projectId: record.projectId,
        sourceId: record.id,
        sourceType: record.sourceType,
      },
    }));
  }

  if (members.length === 0) {
    return <p>No {source.sourceType} matches this view.</p>;
  }

  if (source.presentation === "Table") {
    return (
      <table className="w-full text-left">
        <thead>
          <tr>
            <th>{memberHeading}</th>
            {detailHeadings.map((heading) => (
              <th key={heading}>{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id}>
              <td>
                <SourceRecordPreviewLink
                  className="underline"
                  href={member.href}
                  onOpenSourceRecord={onOpenSourceRecord}
                  target={member.target}
                >
                  {member.label}
                </SourceRecordPreviewLink>
                <MembershipReasons reasons={member.membershipReasons} />
              </td>
              {member.details.map((detail, index) => (
                <td key={detailHeadings[index] ?? index}>{detail}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <ul className="list-inside list-disc">
      {members.map((member) => (
        <li key={member.id}>
          <SourceRecordPreviewLink
            className="underline"
            href={member.href}
            onOpenSourceRecord={onOpenSourceRecord}
            target={member.target}
          >
            {member.label}
          </SourceRecordPreviewLink>
          {member.details.length > 0 ? (
            <> · {member.details.join(" · ")}</>
          ) : null}
          <MembershipReasons reasons={member.membershipReasons} />
        </li>
      ))}
    </ul>
  );
}

function LiveOtherCard({
  block,
  kind,
  loading,
  onOpenSourceRecord,
}: {
  block?: LiveOtherBlock;
  kind: "Smart Collection" | "Technical Diagram";
  loading: boolean;
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
}) {
  const source = block?.source;
  if (kind === "Smart Collection") {
    if (!(source && "works" in source)) {
      return (
        <section aria-label={kind} className="rounded-lg border p-4">
          <p role="status">
            {loading
              ? "Loading source record…"
              : "Source record is unavailable."}
          </p>
        </section>
      );
    }
    return (
      <section
        aria-label="Smart Collection"
        className="space-y-2 rounded-lg border p-4"
      >
        <p className="text-xs">Smart Collection · Named view</p>
        <h3 className="font-medium">
          {source.collectionName} · {source.name}
        </h3>
        <p className="text-muted-foreground text-sm">{source.presentation}</p>
        <SmartCollectionMembers
          onOpenSourceRecord={onOpenSourceRecord}
          source={source}
        />
        <a
          className="underline"
          href={`/projects/${source.projectId}#smart-collection-view-${encodeURIComponent(source.id)}`}
        >
          Open source record
        </a>
      </section>
    );
  }
  const diagram = source && "model" in source ? source : null;
  if (!diagram) {
    return (
      <section aria-label={kind} className="rounded-lg border p-4">
        <p role="status">
          {loading ? "Loading source record…" : "Source record is unavailable."}
        </p>
      </section>
    );
  }
  const selected =
    diagram.view?.selectedNodeIds ?? diagram.model.nodes.map(({ id }) => id);
  const selectedNodes = diagram.model.nodes.filter(({ id }) =>
    selected.includes(id),
  );
  const nodesById = new Map(diagram.model.nodes.map((node) => [node.id, node]));
  const selectedLinks = diagram.model.links.filter(
    ({ from, to }) => selected.includes(from) && selected.includes(to),
  );
  return (
    <section
      aria-label="Technical Diagram"
      className="space-y-2 rounded-lg border p-4"
    >
      <p className="text-xs">
        Technical Diagram · {diagram.view?.name ?? "Default"}
      </p>
      <h3 className="font-medium">{diagram.title}</h3>
      <p className="text-muted-foreground text-sm">
        {diagram.type} · {diagram.authorityMode}
      </p>
      <ul aria-label="Diagram elements" className="list-inside list-disc">
        {selectedNodes.map((node) => (
          <li key={node.id}>{node.label}</li>
        ))}
      </ul>
      {selectedLinks.length > 0 ? (
        <ul aria-label="Diagram links" className="space-y-1 text-sm">
          {selectedLinks.map((link) => {
            const from = nodesById.get(link.from);
            const to = nodesById.get(link.to);
            return (
              <li key={JSON.stringify([link.from, link.to, link.label])}>
                {from?.label ?? link.from} → {to?.label ?? link.to}
                {link.label ? ` · ${link.label}` : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      <a
        className="underline"
        href={`/projects/${diagram.projectId}#technical-diagram-${encodeURIComponent(diagram.id)}`}
      >
        Open source record
      </a>
    </section>
  );
}

function LiveWorkCard({
  block,
  loading,
  onAction,
  onOpenSourceRecord,
}: {
  block?: LiveWorkBlock;
  loading: boolean;
  onAction?: (workId: string, action: "status" | "close") => void;
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
}) {
  const record = block?.source;
  const handleAction = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const { action } = event.currentTarget.dataset;
      if (record && (action === "status" || action === "close")) {
        onAction?.(record.id, action);
      }
    },
    [onAction, record],
  );
  return (
    <section aria-label="Live Work block" className="rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">Live Work block</p>
      {record ? (
        <>
          <p className="font-medium">
            {record.key} · {record.title}
          </p>
          <p className="text-muted-foreground text-sm">
            {[
              record.type,
              record.status,
              record.plannedStartDate,
              record.targetDate,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="text-muted-foreground text-sm">
            Priority metrics:{" "}
            {record.priority.length > 0
              ? record.priority
                  .map(({ name, rank }) => `${name}: ${rank}`)
                  .join(" · ")
              : "—"}
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            {onAction ? (
              <>
                <Button
                  data-action="status"
                  onClick={handleAction}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Change status
                </Button>
                {record.status === "Closed" ? null : (
                  <Button
                    data-action="close"
                    onClick={handleAction}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Close
                  </Button>
                )}
              </>
            ) : null}
            <SourceRecordPreviewLink
              className="self-center underline-offset-4 hover:underline"
              href={workRecordHref(record.projectId, record.id)}
              onOpenSourceRecord={onOpenSourceRecord}
              target={{
                kind: "work",
                label: `${record.key} · ${record.title}`,
                projectId: record.projectId,
                workId: record.id,
              }}
            >
              Open source record
            </SourceRecordPreviewLink>
          </div>
        </>
      ) : (
        <p role="status">
          {loading ? "Loading source record…" : "Source record is unavailable."}
        </p>
      )}
    </section>
  );
}

export default function DocumentPreview({
  documentReferences,
  liveOtherBlocks,
  liveWorkBlocks,
  onMermaidConvert,
  onLiveWorkAction,
  onOpenSourceRecord,
  source,
  targetSectionId,
}: {
  documentReferences?: readonly DocumentRecordReferenceView[];
  liveOtherBlocks?: readonly LiveOtherBlock[];
  liveWorkBlocks?: readonly LiveWorkBlock[];
  onMermaidConvert?: (blockStart: number, blockEnd: number) => void;
  onLiveWorkAction?: (workId: string, action: "status" | "close") => void;
  onOpenSourceRecord?: (target: SourceRecordPreviewTarget) => void;
  source: string;
  targetSectionId?: string;
}) {
  const previewRef = useRef<HTMLElement>(null);
  const targetSectionExists = targetSectionId
    ? documentSectionById(source, targetSectionId) !== null
    : false;
  useEffect(() => {
    if (
      !targetSectionId ||
      documentSectionById(source, targetSectionId) === null
    ) {
      return;
    }
    const target = Array.from(
      previewRef.current?.querySelectorAll<HTMLElement>("[id]") ?? [],
    ).find(({ id }) => id === targetSectionId);
    target?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [source, targetSectionId]);
  const referencesByIdentity = new Map(
    (documentReferences ?? []).map((reference) => [
      `${reference.recordType}:${reference.recordId}`,
      reference,
    ]),
  );
  const parts: Array<{
    kind:
      | "markdown"
      | "mermaid"
      | "math"
      | "live-work"
      | "live-collection"
      | "live-diagram"
      | "live-section";
    value: string;
    start?: number;
    end?: number;
    viewId?: string;
    sectionId?: string;
  }> = [];
  const directives = documentLiveDirectives(source);
  function appendMarkdown(value: string, offset: number) {
    let last = 0;
    for (const directive of directives) {
      if (directive.start < offset || directive.end > offset + value.length) {
        continue;
      }
      const relativeStart = directive.start - offset;
      if (relativeStart > last) {
        parts.push({
          kind: "markdown",
          value: value.slice(last, relativeStart),
        });
      }
      parts.push({
        kind: livePartKind[directive.kind],
        value: directive.id,
        sectionId: directive.sectionId,
        viewId: directive.viewId,
      });
      last = directive.end - offset;
    }
    if (last < value.length) {
      parts.push({ kind: "markdown", value: value.slice(last) });
    }
  }
  let cursor = 0;
  for (const match of source.matchAll(previewPattern)) {
    if (match[5] !== undefined) {
      continue;
    }
    if (match[1] !== undefined && match[3].trim() !== "mermaid") {
      continue;
    }
    const position = match.index ?? 0;
    if (position > cursor) {
      appendMarkdown(source.slice(cursor, position), cursor);
    }
    if (match[1] === undefined) {
      parts.push({ kind: "math", value: match[7] ?? "" });
    } else {
      parts.push({
        kind: "mermaid",
        value: match[4] ?? "",
        start: position,
        end: position + match[0].length,
      });
    }
    cursor = position + match[0].length;
  }
  if (cursor < source.length) {
    appendMarkdown(source.slice(cursor), cursor);
  }
  if (parts.length === 0) {
    parts.push({ kind: "markdown", value: source });
  }

  return (
    <section
      aria-label="Document preview"
      className="document-preview space-y-4"
      ref={previewRef}
    >
      <style>{highlightThemeCss}</style>
      {targetSectionId && !targetSectionExists ? (
        <p role="status">This section is missing.</p>
      ) : null}
      {parts.map((part, index) => {
        const key = `${index}-${part.kind}`;
        if (part.kind === "mermaid") {
          return (
            <div key={key}>
              <MermaidPreview source={part.value} />
              {onMermaidConvert &&
              part.start !== undefined &&
              part.end !== undefined ? (
                <Button
                  // biome-ignore lint/performance/noJsxPropsBind: The selected Mermaid offsets belong to this rendered block.
                  onClick={() =>
                    onMermaidConvert(part.start as number, part.end as number)
                  }
                  type="button"
                  variant="outline"
                >
                  Convert to Technical Diagram
                </Button>
              ) : null}
            </div>
          );
        }
        if (part.kind === "math") {
          return <MathPreview key={key} source={part.value} />;
        }
        if (part.kind === "live-work") {
          const block = liveWorkBlocks?.find(
            ({ workId }) => workId === part.value,
          );
          return (
            <LiveWorkCard
              block={block}
              key={key}
              loading={!liveWorkBlocks}
              onAction={onLiveWorkAction}
              onOpenSourceRecord={onOpenSourceRecord}
            />
          );
        }
        if (part.kind === "live-section") {
          const block = liveOtherBlocks?.find(
            (candidate) =>
              candidate.id === part.value &&
              candidate.kind === "Document section" &&
              candidate.sectionId === (part.sectionId ?? null),
          );
          return (
            <LiveSectionCard
              block={block}
              key={key}
              loading={!liveOtherBlocks}
              onOpenSourceRecord={onOpenSourceRecord}
            />
          );
        }
        if (part.kind === "live-collection" || part.kind === "live-diagram") {
          const kind =
            part.kind === "live-collection"
              ? "Smart Collection"
              : "Technical Diagram";
          const block = liveOtherBlocks?.find(
            (candidate) =>
              candidate.id === part.value &&
              candidate.kind === kind &&
              candidate.viewId === (part.viewId ?? null),
          );
          return (
            <LiveOtherCard
              block={block}
              key={key}
              kind={kind}
              loading={!liveOtherBlocks}
              onOpenSourceRecord={onOpenSourceRecord}
            />
          );
        }
        return (
          <Markdown
            components={{
              "document-inline-math": InlineMath,
              "document-record-reference": (properties: {
                label?: string;
                recordId?: string;
                recordType?: string;
              }) => {
                const reference = referencesByIdentity.get(
                  `${properties.recordType}:${properties.recordId}`,
                );
                if (!reference?.source) {
                  return (
                    <span className="text-muted-foreground" role="status">
                      Source record is unavailable.
                    </span>
                  );
                }
                const href = recordReferenceHref(
                  reference.source.projectId,
                  reference.recordType,
                  reference.recordId,
                );
                return (
                  <SourceRecordPreviewLink
                    className="underline"
                    href={href}
                    onOpenSourceRecord={onOpenSourceRecord}
                    target={documentPreviewRecordTarget(
                      reference.source.title,
                      reference.source.projectId,
                      reference.recordType,
                      reference.recordId,
                    )}
                  >
                    {reference.source.title}
                  </SourceRecordPreviewLink>
                );
              },
            }}
            extensions={[
              inlineMathExtension,
              inlineRecordReferenceExtension,
              documentSectionAnchorExtension,
            ]}
            highlighter={codeHighlighter}
            key={key}
          >
            {part.value}
          </Markdown>
        );
      })}
    </section>
  );
}
