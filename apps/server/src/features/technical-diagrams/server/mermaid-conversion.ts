import type { DiagramModel } from "@cantiara/db/schema/technical-diagram";

const graphHeader = /^(?:graph|flowchart)\s+(?:TD|TB|LR|RL|BT)$/;
const edgeLine =
  /^([A-Za-z][A-Za-z0-9_]*)(?:\[([^\]\n]+)\])?\s+-->\s+([A-Za-z][A-Za-z0-9_]*)(?:\[([^\]\n]+)\])?$/;

/** This intentionally accepts only the lossless flowchart subset represented by the structural model. */
export function parseMermaidArchitecture(source: string): DiagramModel {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  if (!graphHeader.test(lines[0]?.trim() ?? "")) {
    throw new Error("Unsupported Mermaid line 1");
  }
  const nodes = new Map<string, DiagramModel["nodes"][number]>();
  const links: DiagramModel["links"] = [];
  for (const [index, raw] of lines.entries()) {
    if (index === 0 || !raw.trim()) {
      continue;
    }
    const match = edgeLine.exec(raw.trim());
    if (!match) {
      throw new Error(`Unsupported Mermaid line ${index + 1}`);
    }
    const [, from, fromLabel, to, toLabel] = match;
    if (!(from && to)) {
      throw new Error(`Unsupported Mermaid line ${index + 1}`);
    }
    for (const [id, label] of [
      [from, fromLabel],
      [to, toLabel],
    ] as const) {
      const previous = nodes.get(id);
      if (
        previous &&
        label &&
        previous.label !== id &&
        previous.label !== label
      ) {
        throw new Error(`Conflicting Mermaid node ${id}`);
      }
      nodes.set(id, {
        id,
        label: label ?? previous?.label ?? id,
        kind: "Component",
      });
    }
    links.push({ from, to, label: null });
  }
  if (links.length === 0) {
    throw new Error("A convertible Mermaid edge is required.");
  }
  return { nodes: [...nodes.values()], links };
}
