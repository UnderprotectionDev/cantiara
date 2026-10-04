import { z } from "zod";
import { type Document, documentTypeSchema } from "./documents";
import type { ProjectLifecycleStatus } from "./project-shell";

export const documentDiscoveryInputSchema = z
  .object({
    query: z.string().trim().max(200).default(""),
    scope: z
      .discriminatedUnion("kind", [
        z.object({ kind: z.literal("all") }).strict(),
        z.object({ kind: z.literal("wiki") }).strict(),
        z
          .object({
            kind: z.literal("project"),
            projectId: z.string().min(1).max(200),
          })
          .strict(),
      ])
      .default({ kind: "all" }),
    archived: z.boolean().default(false),
    type: documentTypeSchema.optional(),
    folder: z.string().min(1).max(255).optional(),
    currentProjectId: z.string().min(1).max(200).optional(),
  })
  .strict();

export type DocumentDiscoveryInput = z.infer<
  typeof documentDiscoveryInputSchema
>;

export interface DocumentDiscoveryResult {
  document: Document;
  matchCount: number;
  projectArchivedAt: string | null;
  projectName: string | null;
  projectStatus: ProjectLifecycleStatus | null;
  snippet: string;
}

export interface DocumentDiscoveryAccess {
  discover: (
    accountId: string,
    input: DocumentDiscoveryInput,
  ) => Promise<DocumentDiscoveryResult[]>;
}

export const universalSearchInputSchema = z
  .object({
    query: z.string().trim().max(200).default(""),
    currentProjectId: z.string().min(1).max(200).optional(),
    archived: z.boolean().default(false),
  })
  .strict();

export type UniversalSearchInput = z.infer<typeof universalSearchInputSchema>;

export const universalSearchRecordTypes = [
  "Work",
  "Decision",
  "Risk",
  "Assumption",
  "Open Question",
  "Milestone",
  "Project Release",
  "Production Incident",
  "Technical Diagram",
  "Document",
  "File Attachment",
] as const;

export type UniversalSearchRecordType =
  (typeof universalSearchRecordTypes)[number];

export interface UniversalSearchResult {
  archived: boolean;
  category: string | null;
  closureResult: string | null;
  id: string;
  key: string | null;
  matchCount: number;
  ownerDocumentId: string | null;
  projectArchivedAt: string | null;
  projectId: string | null;
  projectName: string | null;
  recordType: UniversalSearchRecordType;
  scopeName: string;
  scopeType: "Personal Wiki" | "Project";
  snippet: string;
  status: string;
  title: string;
  updatedAt: string;
}

export interface UniversalSearchAccess {
  search: (
    accountId: string,
    input: UniversalSearchInput,
  ) => Promise<UniversalSearchResult[]>;
}

const wordPattern = /[\p{L}\p{N}_]+/gu;
const wordPartsPattern = /([\p{L}\p{N}_]+)/gu;

export function documentMatchParts(text: string, query: string) {
  const terms = new Set(
    query.toLocaleLowerCase("en-US").match(wordPattern) ?? [],
  );
  let offset = 0;
  return text.split(wordPartsPattern).map((part) => {
    const start = offset;
    offset += part.length;
    return {
      text: part,
      start,
      matched: terms.has(part.toLocaleLowerCase("en-US")),
    };
  });
}

export function documentMatchContext(
  title: string,
  body: string,
  query: string,
) {
  const source = `${title}\n${body}`;
  const matches = documentMatchParts(source, query).filter(
    (part) => part.matched,
  );
  const firstMatch = matches[0]?.start ?? 0;
  const start = Math.max(0, firstMatch - 60);
  return {
    snippet: source.slice(start, start + 200),
    matchCount: matches.length,
  };
}
