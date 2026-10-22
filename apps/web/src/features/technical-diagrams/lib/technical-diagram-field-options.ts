export interface ArchitectureBindOption {
  boundLabel: string;
  diagramId: string;
  diagramTitle: string;
  nodeId: string;
  /** Set when the node belongs to an exact Diagram Version; null is the live node. */
  versionId?: string | null;
  versionName?: string;
}

export const bindKey = (option: ArchitectureBindOption) =>
  `${option.diagramId}:${option.nodeId}:${option.versionId ?? ""}`;

export const ids = (items: { id: string; label?: string; name?: string }[]) =>
  items.map((item) => ({
    label: item.label ?? item.name ?? item.id,
    value: item.id,
  }));

export const CHOOSE = { label: "Choose", value: "" };
