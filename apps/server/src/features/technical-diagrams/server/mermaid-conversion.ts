import type { DiagramModel } from "@cantiara/db/schema/technical-diagram";
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
  model: DiagramModel;
  unparseableLines: MermaidUnparseableLine[];
}

function addMermaidEdge(
  raw: string,
  line: number,
  nodes: Map<string, DiagramModel["nodes"][number]>,
  links: DiagramModel["links"],
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
  links.push({ from, to, label: null });
}

async function validateGraph(header: string, links: DiagramModel["links"]) {
  // Mermaid's server parser requires a browser sanitizer for labels. Parse the
  // exact supported graph topology without labels, then retain labels above.
  const graph = [
    header,
    ...links.map(({ from, to }) => `${from} --> ${to}`),
  ].join("\n");
  try {
    const parsed = await mermaid.parse(graph);
    if (!parsed.diagramType.startsWith("flowchart")) {
      throw new Error("Unsupported Mermaid diagram type");
    }
  } catch (error) {
    throw new Error("Invalid or unsupported Mermaid flowchart.", {
      cause: error,
    });
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
  const nodes = new Map<string, DiagramModel["nodes"][number]>();
  const links: DiagramModel["links"] = [];
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
  await validateGraph(header, links);
  return {
    canConvert: true,
    model: { nodes: [...nodes.values()], links },
    unparseableLines,
  };
}

/** Strict parser retained for callers that require a lossless conversion. */
export async function parseMermaidArchitecture(
  source: string,
): Promise<DiagramModel> {
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
