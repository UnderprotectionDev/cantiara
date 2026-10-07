import {
  documentMatchContext,
  type RecordDiscoveryIndex,
  type UniversalSearchAccess,
  type UniversalSearchInput,
  type UniversalSearchRecordType,
  type UniversalSearchResult,
} from "@cantiara/api/record-discovery";
import type { Database } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import {
  fileAttachment,
  fileAttachmentVersion,
} from "@cantiara/db/schema/file-attachments";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import {
  diagramView,
  technicalDiagram,
} from "@cantiara/db/schema/technical-diagram";
import { work, workRetiredIdentity } from "@cantiara/db/schema/work";
import {
  and,
  eq,
  inArray,
  isNull,
  or,
  type SQLWrapper,
  sql,
} from "drizzle-orm";

type Candidate = UniversalSearchResult & {
  closed: boolean;
  indexedText: string;
  titleKeyMatch: boolean;
};

function textContent(fields: SQLWrapper[]) {
  return sql<string>`concat_ws(' ', ${sql.join(
    fields.map((field) => sql`coalesce(${field}, '')`),
    sql`, `,
  )})`;
}

function matches(query: string, ...fields: SQLWrapper[]) {
  return sql<boolean>`to_tsvector('simple', ${textContent(fields)}) @@ plainto_tsquery('simple', ${query})`;
}

function archiveCondition(archived: boolean, recordArchivedAt?: SQLWrapper) {
  const recordIsArchived = recordArchivedAt
    ? sql<boolean>`${recordArchivedAt} is not null`
    : sql<boolean>`false`;
  return archived
    ? sql<boolean>`(${recordIsArchived} or ${project.archivedAt} is not null)`
    : sql<boolean>`(not ${recordIsArchived} and ${project.archivedAt} is null)`;
}

// Records that always live in one Project can only satisfy an explicit
// project scope; the Personal Wiki scope cannot see them.
function projectRecordScope(input: UniversalSearchInput) {
  if (input.scope.kind === "project") {
    return eq(project.id, input.scope.projectId);
  }
  if (input.scope.kind === "wiki") {
    return sql`false`;
  }
}

function documentScope(input: UniversalSearchInput) {
  if (input.scope.kind === "project") {
    return eq(document.projectId, input.scope.projectId);
  }
  if (input.scope.kind === "wiki") {
    return isNull(document.projectId);
  }
}

function attachmentScope(input: UniversalSearchInput) {
  if (input.scope.kind === "project") {
    return eq(fileAttachment.projectId, input.scope.projectId);
  }
  if (input.scope.kind === "wiki") {
    return eq(fileAttachment.scopeType, "Personal Wiki");
  }
}

function typeFilter(
  input: UniversalSearchInput,
  category: SQLWrapper | undefined,
) {
  if (!input.type) {
    return;
  }
  return category ? eq(category, input.type) : sql`false`;
}

function folderFilter(input: UniversalSearchInput, folder?: SQLWrapper) {
  if (!input.folder) {
    return;
  }
  return folder ? eq(folder, input.folder) : sql`false`;
}

function projectConditions(
  accountId: string,
  input: UniversalSearchInput,
  searchableText: SQLWrapper,
  recordArchivedAt?: SQLWrapper,
  category?: SQLWrapper,
) {
  return and(
    eq(workspace.ownerAccountId, accountId),
    archiveCondition(input.archived, recordArchivedAt),
    input.query ? matches(input.query, searchableText) : undefined,
    projectRecordScope(input),
    typeFilter(input, category),
    folderFilter(input),
  );
}

function makeCandidate(
  record: Omit<Candidate, "matchCount" | "snippet">,
  query: string,
): Candidate {
  return {
    ...record,
    ...documentMatchContext(record.title, record.indexedText, query),
  };
}

function isClosed(
  recordType: UniversalSearchRecordType,
  status: string,
  closureResult: string | null,
) {
  if (recordType === "Work") {
    return status === "Closed";
  }
  if (recordType === "Decision") {
    return status !== "Valid";
  }
  if (recordType === "Risk") {
    return ["Occurred", "Resolved", "Accepted"].includes(status);
  }
  if (recordType === "Assumption") {
    return status !== "Open";
  }
  if (recordType === "Open Question") {
    return status !== "Open";
  }
  if (recordType === "Milestone") {
    return status !== "Planned";
  }
  if (recordType === "Project Release") {
    return ["Published", "Cancelled"].includes(status);
  }
  if (recordType === "Production Incident") {
    return status === "Resolved";
  }
  return closureResult !== null;
}

function candidate(
  input: {
    archived: boolean;
    authorityMode?: string | null;
    category?: string | null;
    closureResult?: string | null;
    fileMimeType?: string | null;
    fileName?: string | null;
    folder?: string | null;
    id: string;
    indexedText: string;
    key?: string | null;
    ownerDocumentId?: string | null;
    projectArchivedAt?: Date | null;
    projectId?: string | null;
    projectName?: string | null;
    recordType: UniversalSearchRecordType;
    scopeName?: string | null;
    scopeType?: "Personal Wiki" | "Project";
    status: string;
    title: string;
    titleKeyMatch: boolean;
    updatedAt: Date;
  },
  query: string,
) {
  const closureResult = input.closureResult ?? null;
  return makeCandidate(
    {
      archived: input.archived || Boolean(input.projectArchivedAt),
      authorityMode: input.authorityMode ?? null,
      category: input.category ?? null,
      closed: isClosed(input.recordType, input.status, closureResult),
      closureResult,
      fileMimeType: input.fileMimeType ?? null,
      fileName: input.fileName ?? null,
      folder: input.folder ?? null,
      id: input.id,
      indexedText: input.indexedText,
      key: input.key ?? null,
      ownerDocumentId: input.ownerDocumentId ?? null,
      projectArchivedAt: input.projectArchivedAt?.toISOString() ?? null,
      projectId: input.projectId ?? null,
      projectName: input.projectName ?? null,
      recordType: input.recordType,
      scopeName: input.scopeName ?? input.projectName ?? "Personal Wiki",
      scopeType:
        input.scopeType ?? (input.projectId ? "Project" : "Personal Wiki"),
      status:
        input.archived || input.projectArchivedAt ? "Archived" : input.status,
      title: input.title,
      titleKeyMatch: input.titleKeyMatch,
      updatedAt: input.updatedAt.toISOString(),
    },
    query,
  );
}

function closureRank(result: string | null) {
  if (result === "Completed") {
    return 0;
  }
  if (result === "Abandoned") {
    return 1;
  }
  return 0;
}

function compareIds(left: Candidate, right: Candidate) {
  if (left.id < right.id) {
    return -1;
  }
  if (left.id > right.id) {
    return 1;
  }
  return 0;
}

function compareCandidates(
  left: Candidate,
  right: Candidate,
  currentProjectId: string | undefined,
) {
  return (
    Number(right.titleKeyMatch) - Number(left.titleKeyMatch) ||
    Number(right.projectId === currentProjectId) -
      Number(left.projectId === currentProjectId) ||
    Number(left.closed) - Number(right.closed) ||
    closureRank(left.closureResult) - closureRank(right.closureResult) ||
    right.updatedAt.localeCompare(left.updatedAt) ||
    compareIds(left, right)
  );
}

interface SearchContext {
  accountId: string;
  database: Database;
  input: UniversalSearchInput;
  query: string;
}

async function searchWorkRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const retiredKeys = sql<string>`coalesce((select string_agg(${workRetiredIdentity.key}, ' ' order by ${workRetiredIdentity.key} collate "C") from ${workRetiredIdentity} where ${workRetiredIdentity.survivingWorkId} = ${work.id}), '')`;
  const checklistText = sql<string>`coalesce((select string_agg(item.value ->> 'text', ' ' order by item.ordinality) from jsonb_array_elements(${work.checklist}) with ordinality as item(value, ordinality)), '')`;
  const workTitleKey = textContent([work.title, work.key, retiredKeys]);
  const workText = textContent([
    work.description,
    work.expectedOutcome,
    work.problemOpportunity,
    work.nextConcreteStep,
    checklistText,
    retiredKeys,
  ]);
  const workSearchText = textContent([workTitleKey, workText]);
  const workRows = await database
    .select({
      archivedAt: work.archivedAt,
      closureResult: work.closureResult,
      id: work.id,
      key: work.key,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      projectName: project.name,
      status: work.status,
      title: work.title,
      titleKeyMatch: query ? matches(query, workTitleKey) : sql<boolean>`false`,
      type: work.type,
      updatedAt: work.updatedAt,
      workText,
    })
    .from(work)
    .innerJoin(project, eq(work.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(workspace.ownerAccountId, accountId),
        isNull(work.trashedAt),
        archiveCondition(input.archived, work.archivedAt),
        query ? matches(query, workSearchText) : undefined,
        projectRecordScope(input),
        typeFilter(input, work.type),
        folderFilter(input),
      ),
    );
  results.push(
    ...workRows.map((row) =>
      candidate(
        {
          archived: Boolean(row.archivedAt),
          category: row.type,
          closureResult: row.closureResult,
          id: row.id,
          indexedText: `${row.key} ${row.workText}`,
          key: row.key,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Work",
          status: row.status,
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

function searchesFamily(
  selectedRecordType: UniversalSearchRecordType | undefined,
  family: UniversalSearchRecordType,
) {
  return !selectedRecordType || selectedRecordType === family;
}

async function searchDecisionRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const decisionText = textContent([decision.decision, decision.rationale]);
  const decisionTitle = textContent([decision.title]);
  const decisionRows = await database
    .select({
      id: decision.id,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      projectName: project.name,
      status: decision.life,
      text: decisionText,
      title: decision.title,
      titleKeyMatch: query
        ? matches(query, decisionTitle)
        : sql<boolean>`false`,
      updatedAt: decision.updatedAt,
    })
    .from(decision)
    .innerJoin(project, eq(decision.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      projectConditions(
        accountId,
        input,
        textContent([decisionTitle, decisionText]),
      ),
    );
  results.push(
    ...decisionRows.map((row) =>
      candidate(
        {
          archived: false,
          id: row.id,
          indexedText: row.text,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Decision",
          status: row.status,
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

async function searchRiskRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const riskText = textContent([
    risk.description,
    risk.impact,
    risk.probability,
    risk.rationale,
    risk.response,
  ]);
  const riskTitle = textContent([risk.title]);
  const riskRows = await database
    .select({
      id: risk.id,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      projectName: project.name,
      status: risk.life,
      text: riskText,
      title: risk.title,
      titleKeyMatch: query ? matches(query, riskTitle) : sql<boolean>`false`,
      updatedAt: risk.updatedAt,
    })
    .from(risk)
    .innerJoin(project, eq(risk.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      projectConditions(accountId, input, textContent([riskTitle, riskText])),
    );
  results.push(
    ...riskRows.map((row) =>
      candidate(
        {
          archived: false,
          id: row.id,
          indexedText: row.text,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Risk",
          status: row.status,
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

async function searchAssumptionRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const assumptionText = textContent([
    assumption.statement,
    assumption.rationale,
  ]);
  const assumptionTitle = textContent([assumption.title]);
  const assumptionRows = await database
    .select({
      id: assumption.id,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      projectName: project.name,
      status: assumption.life,
      text: assumptionText,
      title: assumption.title,
      titleKeyMatch: query
        ? matches(query, assumptionTitle)
        : sql<boolean>`false`,
      updatedAt: assumption.updatedAt,
    })
    .from(assumption)
    .innerJoin(project, eq(assumption.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      projectConditions(
        accountId,
        input,
        textContent([assumptionTitle, assumptionText]),
      ),
    );
  results.push(
    ...assumptionRows.map((row) =>
      candidate(
        {
          archived: false,
          id: row.id,
          indexedText: row.text,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Assumption",
          status: row.status,
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

async function searchOpenQuestionRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const questionText = textContent([
    openQuestion.question,
    openQuestion.answer,
    openQuestion.context,
  ]);
  const questionTitle = textContent([openQuestion.title]);
  const questionRows = await database
    .select({
      id: openQuestion.id,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      projectName: project.name,
      status: openQuestion.life,
      text: questionText,
      title: openQuestion.title,
      titleKeyMatch: query
        ? matches(query, questionTitle)
        : sql<boolean>`false`,
      updatedAt: openQuestion.updatedAt,
    })
    .from(openQuestion)
    .innerJoin(project, eq(openQuestion.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      projectConditions(
        accountId,
        input,
        textContent([questionTitle, questionText]),
      ),
    );
  results.push(
    ...questionRows.map((row) =>
      candidate(
        {
          archived: false,
          id: row.id,
          indexedText: row.text,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Open Question",
          status: row.status,
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

async function searchMilestoneRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const milestoneText = textContent([projectMilestone.description]);
  const milestoneTitle = textContent([projectMilestone.title]);
  const milestoneRows = await database
    .select({
      id: projectMilestone.id,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      projectName: project.name,
      status: projectMilestone.status,
      text: milestoneText,
      title: projectMilestone.title,
      titleKeyMatch: query
        ? matches(query, milestoneTitle)
        : sql<boolean>`false`,
      updatedAt: projectMilestone.updatedAt,
    })
    .from(projectMilestone)
    .innerJoin(project, eq(projectMilestone.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      projectConditions(
        accountId,
        input,
        textContent([milestoneTitle, milestoneText]),
      ),
    );
  results.push(
    ...milestoneRows.map((row) =>
      candidate(
        {
          archived: false,
          id: row.id,
          indexedText: row.text,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Milestone",
          status: row.status,
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

async function searchProjectReleaseRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const releaseText = textContent([
    projectRelease.versionLabel,
    projectRelease.description,
  ]);
  const releaseTitle = textContent([projectRelease.name]);
  const releaseRows = await database
    .select({
      id: projectRelease.id,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      projectName: project.name,
      status: projectRelease.status,
      text: releaseText,
      title: projectRelease.name,
      versionLabel: projectRelease.versionLabel,
      titleKeyMatch: query ? matches(query, releaseTitle) : sql<boolean>`false`,
      updatedAt: projectRelease.updatedAt,
    })
    .from(projectRelease)
    .innerJoin(project, eq(projectRelease.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      projectConditions(
        accountId,
        input,
        textContent([releaseTitle, releaseText]),
        undefined,
        projectRelease.versionLabel,
      ),
    );
  results.push(
    ...releaseRows.map((row) =>
      candidate(
        {
          archived: false,
          category: row.versionLabel,
          id: row.id,
          indexedText: row.text,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Project Release",
          status: row.status,
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

async function searchProductionIncidentRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const incidentText = textContent([
    productionIncident.detectedHow,
    productionIncident.impact,
    productionIncident.learning,
    productionIncident.resolution,
    productionIncident.rootCause,
  ]);
  const incidentTitle = textContent([productionIncident.title]);
  const incidentRows = await database
    .select({
      id: productionIncident.id,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      projectName: project.name,
      status: productionIncident.status,
      text: incidentText,
      title: productionIncident.title,
      titleKeyMatch: query
        ? matches(query, incidentTitle)
        : sql<boolean>`false`,
      updatedAt: productionIncident.updatedAt,
    })
    .from(productionIncident)
    .innerJoin(project, eq(productionIncident.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      projectConditions(
        accountId,
        input,
        textContent([incidentTitle, incidentText]),
      ),
    );
  results.push(
    ...incidentRows.map((row) =>
      candidate(
        {
          archived: false,
          id: row.id,
          indexedText: row.text,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Production Incident",
          status: row.status,
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

const projectRecordFamilySearches: [
  UniversalSearchRecordType,
  (context: SearchContext) => Promise<Candidate[]>,
][] = [
  ["Decision", searchDecisionRecords],
  ["Risk", searchRiskRecords],
  ["Assumption", searchAssumptionRecords],
  ["Open Question", searchOpenQuestionRecords],
  ["Milestone", searchMilestoneRecords],
  ["Project Release", searchProjectReleaseRecords],
  ["Production Incident", searchProductionIncidentRecords],
];

async function searchProjectRecords(
  context: SearchContext,
  selectedRecordType?: UniversalSearchRecordType,
) {
  const families = projectRecordFamilySearches.filter(([family]) =>
    searchesFamily(selectedRecordType, family),
  );
  const familyResults = await Promise.all(
    families.map(([, searchRecords]) => searchRecords(context)),
  );
  return familyResults.flat();
}

async function searchDiagramRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const diagramNodes = sql<string>`coalesce((select string_agg(node.value ->> 'label', ' ' order by node.ordinality) from jsonb_array_elements(coalesce(${technicalDiagram.model} -> 'nodes', '[]'::jsonb)) with ordinality as node(value, ordinality)), '')`;
  const diagramLinks = sql<string>`coalesce((select string_agg(link.value ->> 'label', ' ' order by link.ordinality) from jsonb_array_elements(coalesce(${technicalDiagram.model} -> 'links', '[]'::jsonb)) with ordinality as link(value, ordinality)), '')`;
  const diagramViews = sql<string>`coalesce((select string_agg(${diagramView.name}, ' ' order by ${diagramView.id}) from ${diagramView} where ${diagramView.diagramId} = ${technicalDiagram.id}), '')`;
  const diagramText = textContent([
    technicalDiagram.type,
    technicalDiagram.authorityMode,
    diagramViews,
    diagramNodes,
    diagramLinks,
  ]);
  const diagramTitle = textContent([technicalDiagram.title]);
  const diagramRows = await database
    .select({
      authorityMode: technicalDiagram.authorityMode,
      id: technicalDiagram.id,
      projectArchivedAt: project.archivedAt,
      projectId: project.id,
      projectName: project.name,
      text: diagramText,
      title: technicalDiagram.title,
      titleKeyMatch: query ? matches(query, diagramTitle) : sql<boolean>`false`,
      type: technicalDiagram.type,
      updatedAt: technicalDiagram.updatedAt,
    })
    .from(technicalDiagram)
    .innerJoin(project, eq(technicalDiagram.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      projectConditions(
        accountId,
        input,
        textContent([diagramTitle, diagramText]),
        undefined,
        technicalDiagram.type,
      ),
    );
  results.push(
    ...diagramRows.map((row) =>
      candidate(
        {
          archived: false,
          authorityMode: row.authorityMode,
          category: row.type,
          id: row.id,
          indexedText: row.text,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Technical Diagram",
          status: "Active",
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

async function searchDocumentRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const documentText = textContent([document.body]);
  const documentTitle = textContent([document.title]);
  const documentRows = await database
    .select({
      archivedAt: document.archivedAt,
      id: document.id,
      projectArchivedAt: project.archivedAt,
      projectId: document.projectId,
      projectName: project.name,
      status: document.type,
      text: documentText,
      title: document.title,
      titleKeyMatch: query
        ? matches(query, documentTitle)
        : sql<boolean>`false`,
      updatedAt: document.updatedAt,
      workspaceId: workspace.id,
      folder: document.folder,
    })
    .from(document)
    .leftJoin(project, eq(document.projectId, project.id))
    .innerJoin(
      workspace,
      eq(
        sql`coalesce(${document.workspaceId}, ${project.workspaceId})`,
        workspace.id,
      ),
    )
    .where(
      and(
        eq(workspace.ownerAccountId, accountId),
        or(isNull(document.projectId), eq(project.workspaceId, workspace.id)),
        archiveCondition(input.archived, document.archivedAt),
        query
          ? matches(query, textContent([documentTitle, documentText]))
          : undefined,
        documentScope(input),
        typeFilter(input, document.type),
        folderFilter(input, document.folder),
      ),
    );
  results.push(
    ...documentRows.map((row) =>
      candidate(
        {
          archived: Boolean(row.archivedAt),
          category: row.status,
          folder: row.folder,
          id: row.id,
          indexedText: row.text,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "Document",
          scopeName: row.projectName ?? "Personal Wiki",
          scopeType: row.projectId ? "Project" : "Personal Wiki",
          status: "Active",
          title: row.title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      ),
    ),
  );
  return results;
}

async function searchAttachmentRecords({
  accountId,
  database,
  input,
  query,
}: SearchContext) {
  const results: Candidate[] = [];
  const attachmentTitle = textContent([
    fileAttachment.name,
    fileAttachmentVersion.fileName,
  ]);
  const searchableAttachmentTitle = sql<string>`
    regexp_replace(${attachmentTitle}, '[^[:alnum:]_]+', ' ', 'g')
  `;
  const attachmentMetadata = textContent([
    fileAttachmentVersion.extension,
    fileAttachmentVersion.mimeType,
    fileAttachmentVersion.detectedMimeType,
  ]);
  const attachmentText = textContent([
    searchableAttachmentTitle,
    attachmentMetadata,
  ]);
  const attachmentRows = await database
    .select({
      id: fileAttachment.id,
      lifecycleStatus: fileAttachment.lifecycleStatus,
      name: fileAttachment.name,
      ownerDocumentId: fileAttachment.ownerDocumentId,
      projectArchivedAt: project.archivedAt,
      projectId: fileAttachment.projectId,
      projectName: project.name,
      scopeType: fileAttachment.scopeType,
      text: attachmentMetadata,
      titleKeyMatch: query
        ? matches(query, searchableAttachmentTitle)
        : sql<boolean>`false`,
      updatedAt: fileAttachment.updatedAt,
      ownerDocumentArchivedAt: document.archivedAt,
      versionFileName: fileAttachmentVersion.fileName,
      versionExtension: fileAttachmentVersion.extension,
      fileMimeType: fileAttachmentVersion.detectedMimeType,
      folder: document.folder,
    })
    .from(fileAttachment)
    .innerJoin(workspace, eq(fileAttachment.workspaceId, workspace.id))
    .innerJoin(
      fileAttachmentVersion,
      and(
        eq(fileAttachmentVersion.attachmentId, fileAttachment.id),
        eq(fileAttachmentVersion.version, fileAttachment.currentVersion),
      ),
    )
    .leftJoin(project, eq(fileAttachment.projectId, project.id))
    .leftJoin(document, eq(fileAttachment.ownerDocumentId, document.id))
    .where(
      and(
        eq(workspace.ownerAccountId, accountId),
        or(
          isNull(fileAttachment.projectId),
          eq(project.workspaceId, workspace.id),
        ),
        or(
          isNull(fileAttachment.ownerDocumentId),
          and(
            eq(
              sql`coalesce(${document.workspaceId}, ${project.workspaceId})`,
              workspace.id,
            ),
            sql`${document.projectId} is not distinct from ${fileAttachment.projectId}`,
          ),
        ),
        sql`${fileAttachment.lifecycleStatus} <> 'Trash'`,
        input.archived
          ? or(
              eq(fileAttachment.lifecycleStatus, "Archive"),
              sql`${project.archivedAt} is not null`,
              sql`${document.archivedAt} is not null`,
            )
          : and(
              eq(fileAttachment.lifecycleStatus, "Active"),
              isNull(project.archivedAt),
              isNull(document.archivedAt),
            ),
        query ? matches(query, attachmentText) : undefined,
        attachmentScope(input),
        typeFilter(input, fileAttachmentVersion.extension),
        folderFilter(input, document.folder),
      ),
    );
  results.push(
    ...attachmentRows.map((row) => {
      const archived =
        row.lifecycleStatus === "Archive" ||
        Boolean(row.projectArchivedAt) ||
        Boolean(row.ownerDocumentArchivedAt);
      const title = row.name || row.versionFileName;
      const otherFileName =
        row.versionFileName === title ? "" : row.versionFileName;
      return candidate(
        {
          archived,
          category: row.versionExtension,
          fileMimeType: row.fileMimeType,
          fileName: row.versionFileName,
          folder: row.folder,
          id: row.id,
          indexedText: `${otherFileName} ${row.text}`,
          ownerDocumentId: row.ownerDocumentId,
          projectArchivedAt: row.projectArchivedAt,
          projectId: row.projectId,
          projectName: row.projectName,
          recordType: "File Attachment",
          scopeName:
            row.projectName ??
            (row.scopeType === "Personal Wiki" ? "Personal Wiki" : "Project"),
          scopeType: row.scopeType === "Project" ? "Project" : "Personal Wiki",
          status: row.lifecycleStatus,
          title,
          titleKeyMatch: row.titleKeyMatch,
          updatedAt: row.updatedAt,
        },
        query,
      );
    }),
  );
  return results;
}

const recordTypeByIndex: Partial<
  Record<RecordDiscoveryIndex, UniversalSearchRecordType>
> = {
  "All Work": "Work",
  "All Documents": "Document",
  "All Decisions": "Decision",
  "All Risks": "Risk",
  "All Technical Diagrams": "Technical Diagram",
  "All Project Releases": "Project Release",
  "All Files": "File Attachment",
};

function canSearchIndex(index: RecordDiscoveryIndex | "Search", query: string) {
  return index === "Search"
    ? Boolean(query)
    : recordTypeByIndex[index] !== undefined;
}

async function searchIndexCandidates(context: SearchContext) {
  const { input } = context;
  const isSearch = input.index === "Search";
  const selectedRecordType =
    input.index === "Search" ? undefined : recordTypeByIndex[input.index];
  return [
    ...(isSearch || input.index === "All Work"
      ? await searchWorkRecords(context)
      : []),
    ...(isSearch ||
    ["All Decisions", "All Risks", "All Project Releases"].includes(input.index)
      ? await searchProjectRecords(context, selectedRecordType)
      : []),
    ...(isSearch || input.index === "All Technical Diagrams"
      ? await searchDiagramRecords(context)
      : []),
    ...(isSearch || input.index === "All Documents"
      ? await searchDocumentRecords(context)
      : []),
    ...(isSearch || input.index === "All Files"
      ? await searchAttachmentRecords(context)
      : []),
  ];
}

async function currentProjectIdForAccount(
  database: Database,
  accountId: string,
  currentProjectId?: string,
) {
  if (!currentProjectId) {
    return;
  }

  const [currentProject] = await database
    .select({ id: project.id })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(project.id, currentProjectId),
        eq(workspace.ownerAccountId, accountId),
        isNull(project.archivedAt),
        inArray(project.status, ["Active", "Pending"]),
      ),
    )
    .limit(1);

  return currentProject?.id;
}

export function createDatabaseUniversalSearch(
  database: Database,
): UniversalSearchAccess {
  return {
    async search(accountId, input) {
      const query = input.query.trim();
      if (!canSearchIndex(input.index, query)) {
        return [];
      }

      const context = { accountId, database, input, query };
      const [currentProjectId, results] = await Promise.all([
        currentProjectIdForAccount(database, accountId, input.currentProjectId),
        searchIndexCandidates(context),
      ]);
      return results
        .sort((left, right) => compareCandidates(left, right, currentProjectId))
        .map(
          ({
            closed: _closed,
            indexedText: _indexedText,
            titleKeyMatch: _titleKeyMatch,
            ...result
          }) => result,
        );
    },
  };
}
