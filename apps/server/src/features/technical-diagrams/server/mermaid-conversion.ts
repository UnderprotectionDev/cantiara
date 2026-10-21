import type { ArchitectureModel } from "@cantiara/db/schema/technical-diagram";
import mermaid from "mermaid";

const graphHeader = /^(?:graph|flowchart)\s+(?:TD|TB|LR|RL|BT)$/;
const edgeLine =
  /^([A-Za-z][A-Za-z0-9_]*)(?:\[([^\]\n]+)\])?\s+-->\s+([A-Za-z][A-Za-z0-9_]*)(?:\[([^\]\n]+)\])?$/;

export interface MermaidUnparseableLine {
  line: number;
  reason: string;
  text: string;
}

export interface MermaidArchitecturePreview {
  canConvert: boolean;
  model: ArchitectureModel;
  unparseableLines: MermaidUnparseableLine[];
}

function addMermaidEdge(
  raw: string,
  line: number,
  nodes: Map<string, ArchitectureModel["nodes"][number]>,
  links: ArchitectureModel["links"],
  unparseableLines: MermaidUnparseableLine[],
) {
  const match = edgeLine.exec(raw.trim());
  if (!match) {
    unparseableLines.push({
      line,
      reason: "This Mermaid syntax is not represented in the structural model.",
      text: raw,
    });
    return;
  }
  const [, from, fromLabel, to, toLabel] = match;
  if (!(from && to)) {
    unparseableLines.push({
      line,
      reason: "This Mermaid edge is incomplete.",
      text: raw,
    });
    return;
  }

  const endpoints = [
    [from, fromLabel],
    [to, toLabel],
  ] as const;
  const conflictingNodeId = endpoints.find(([id, label]) => {
    const previous = nodes.get(id);
    return (
      !!previous && !!label && previous.label !== id && previous.label !== label
    );
  })?.[0];
  if (conflictingNodeId) {
    unparseableLines.push({
      line,
      reason: `Node ${conflictingNodeId} has conflicting labels.`,
      text: raw,
    });
    return;
  }
  for (const [id, label] of endpoints) {
    const previous = nodes.get(id);
    nodes.set(id, {
      id,
      label: label ?? previous?.label ?? id,
      kind: "Component",
    });
  }
  links.push({ from, kind: "Depends on", label: null, to });
}

const syntaxErrorMarker = /Parse error|Lexical error/;
const parseErrorLine = /on line (\d+)/;

/**
 * Mermaid is the parse input: its parser decides whether the source is valid
 * syntax. A syntax error is a preview outcome, never a throw. Mermaid's server
 * parser cannot sanitize labels without a browser, so a failure that is not a
 * syntax error (a missing DOM sanitizer) leaves the guarded regex path in charge.
 */
async function findSyntaxError(
  source: string,
  lines: string[],
): Promise<MermaidUnparseableLine | null> {
  try {
    await mermaid.parse(source);
    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!syntaxErrorMarker.test(message)) {
      return null;
    }
    const line = Number(parseErrorLine.exec(message)?.[1] ?? 1);
    return {
      line,
      reason: `Mermaid could not parse this diagram: ${message.split("\n")[0]}`,
      text: lines[line - 1] ?? "",
    };
  }
}

async function validateGraph(
  header: string,
  links: ArchitectureModel["links"],
): Promise<string | null> {
  // Mermaid's server parser requires a browser sanitizer for labels. Parse the
  // exact supported graph topology without labels, then retain labels above.
  const graph = [
    header,
    ...links.map(({ from, to }) => `${from} --> ${to}`),
  ].join("\n");
  try {
    const parsed = await mermaid.parse(graph);
    return parsed.diagramType.startsWith("flowchart")
      ? null
      : "Unsupported Mermaid diagram type.";
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Invalid Mermaid flowchart.";
  }
}

/** Returns the convertible graph subset and every line that would be lost. */
export async function previewMermaidArchitecture(
  source: string,
): Promise<MermaidArchitecturePreview> {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const header = lines[0]?.trim() ?? "";
  const unparseableLines: MermaidUnparseableLine[] = [];
  if (!graphHeader.test(header)) {
    unparseableLines.push({
      line: 1,
      reason: "Only flowchart diagrams can become Technical Diagrams.",
      text: lines[0] ?? "",
    });
    return {
      canConvert: false,
      model: { nodes: [], links: [] },
      unparseableLines,
    };
  }
  const syntaxError = await findSyntaxError(source, lines);
  if (syntaxError) {
    return {
      canConvert: false,
      model: { nodes: [], links: [] },
      unparseableLines: [syntaxError],
    };
  }
  const nodes = new Map<string, ArchitectureModel["nodes"][number]>();
  const links: ArchitectureModel["links"] = [];
  for (const [index, raw] of lines.entries()) {
    if (index === 0 || !raw.trim()) {
      continue;
    }
    addMermaidEdge(raw, index + 1, nodes, links, unparseableLines);
  }
  if (links.length === 0) {
    return {
      canConvert: false,
      model: { nodes: [...nodes.values()], links },
      unparseableLines,
    };
  }
  const graphError = await validateGraph(header, links);
  if (graphError) {
    return {
      canConvert: false,
      model: { nodes: [...nodes.values()], links },
      unparseableLines: [
        ...unparseableLines,
        { line: 1, reason: graphError, text: header },
      ],
    };
  }
  return {
    canConvert: true,
    model: { nodes: [...nodes.values()], links },
    unparseableLines,
  };
}

/** Strict parser retained for callers that require a lossless conversion. */
export async function parseMermaidArchitecture(
  source: string,
): Promise<ArchitectureModel> {
  const preview = await previewMermaidArchitecture(source);
  const [firstUnparseable] = preview.unparseableLines;
  if (firstUnparseable) {
    if (firstUnparseable.reason.startsWith("Node ")) {
      throw new Error(`Conflicting Mermaid node ${firstUnparseable.text}`);
    }
    throw new Error(`Unsupported Mermaid line ${firstUnparseable.line}`);
  }
  if (!preview.canConvert) {
    throw new Error("A convertible Mermaid edge is required.");
  }
  return preview.model;
}
