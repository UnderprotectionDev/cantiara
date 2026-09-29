import {
  documentLiveWorkDirectives,
  type LiveWorkSource,
} from "@cantiara/api/documents";
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
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { workRecordHref } from "../../../project-shell/lib/project-shell-navigation";

mermaid.initialize({ securityLevel: "strict", startOnLoad: false });

const codeHighlighter = createTanStackMarkdownHighlighter(defaultHighlighter);
const highlightThemeCss = createThemeCss({
  light: githubLightTheme,
  dark: githubDarkTheme,
  darkSelector: ".dark",
});

const previewPattern =
  /^[ ]{0,3}(?<fenceCharacter>`|~)(?<fenceTail>\k<fenceCharacter>{2,})(?<language>[^\n]*)\n(?<fenceBody>[\s\S]*?)\n[ ]{0,3}\k<fenceCharacter>\k<fenceTail>\k<fenceCharacter>*[ \t]*(?=\r?\n|$)|(`+)([^`\n]*?)\5|\$\$([\s\S]*?)\$\$/gm;

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

function LiveWorkCard({
  block,
  loading,
  onAction,
}: {
  block?: LiveWorkBlock;
  loading: boolean;
  onAction?: (workId: string, action: "status" | "close") => void;
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
            <a
              className="self-center underline-offset-4 hover:underline"
              href={workRecordHref(record.projectId, record.id)}
            >
              Open source record
            </a>
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
  liveWorkBlocks,
  onLiveWorkAction,
  source,
}: {
  liveWorkBlocks?: readonly LiveWorkBlock[];
  onLiveWorkAction?: (workId: string, action: "status" | "close") => void;
  source: string;
}) {
  const parts: Array<{
    kind: "markdown" | "mermaid" | "math" | "live-work";
    value: string;
  }> = [];
  const directives = documentLiveWorkDirectives(source);
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
      parts.push({ kind: "live-work", value: directive.id });
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
      parts.push({ kind: "mermaid", value: match[4] ?? "" });
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
    >
      <style>{highlightThemeCss}</style>
      {parts.map((part, index) => {
        const key = `${index}-${part.kind}`;
        if (part.kind === "mermaid") {
          return <MermaidPreview key={key} source={part.value} />;
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
            />
          );
        }
        return (
          <Markdown
            components={{ "document-inline-math": InlineMath }}
            extensions={[inlineMathExtension]}
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
