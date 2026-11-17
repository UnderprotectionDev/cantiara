export const EXPORT_FORMATS = ["PNG", "SVG", "PDF", "HTML"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ChosenVersion {
  screenId: string;
  version: number;
}
