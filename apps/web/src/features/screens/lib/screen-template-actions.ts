import type { ScreenRecord } from "@cantiara/api/screens";

interface ScreenTemplateSummary {
  createdAt: string;
  id: string;
  name: string;
}

export interface ScreenTemplateActions {
  /** Creates a Screen in the current Project from a Workspace template. */
  create: (templateId: string, title: string) => Promise<unknown>;
  /** Stamps the chosen saved version into a Workspace template. */
  save: (
    screen: ScreenRecord,
    wireframeVersion: number,
    name: string,
  ) => Promise<unknown>;
  templates: ScreenTemplateSummary[];
}
