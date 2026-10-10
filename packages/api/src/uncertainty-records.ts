import type { ProjectSourceRecord } from "./project-source-records";

export type AssumptionRecord = Extract<
  ProjectSourceRecord,
  { sourceType: "Assumption" }
>;

export interface AssumptionEvidence {
  assumptionId: string;
  documentId: string | null;
  excerpt: string | null;
  id: string;
  revision: number;
  title: string;
}

export interface AssumptionsContext {
  evidence: AssumptionEvidence[];
  readOnly: boolean;
  records: AssumptionRecord[];
}
