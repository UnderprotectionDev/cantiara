import {
  deriveValueChain,
  type ValueChainAccess,
  type ValueChainFactEdge,
  type ValueChainFactNode,
  type ValueChainNodeRef,
  type ValueChainNodeType,
  type ValueChainUnavailableReason,
  valueChainInputSchema,
} from "@cantiara/api/value-chain";
import type { Database } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { evidenceBinding } from "@cantiara/db/schema/evidence";
import {
  githubExternalRecord,
  githubWorkLink,
} from "@cantiara/db/schema/github-integration";
import { openQuestion } from "@cantiara/db/schema/open-question";
import {
  plannedTestCase,
  plannedTestCaseRelation,
  plannedTestCaseVersion,
} from "@cantiara/db/schema/planned-test";
import { project } from "@cantiara/db/schema/project";
import { projectGoal } from "@cantiara/db/schema/project-goal";
import { projectGoalRelation } from "@cantiara/db/schema/project-goal-relation";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { projectReleaseScope } from "@cantiara/db/schema/project-release-planning";
import { workRelation } from "@cantiara/db/schema/relation";
import {
  releaseObservation,
  releaseReassessmentRound,
} from "@cantiara/db/schema/release-communication";
import { risk } from "@cantiara/db/schema/risk";
import { source, sourceVersion } from "@cantiara/db/schema/source";
import { work } from "@cantiara/db/schema/work";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

const GOAL_MEMBER_TYPES: Record<string, ValueChainNodeType> = {
  Assumption: "Assumption",
  Decision: "Decision",
  Milestone: "Milestone",
  "Open Question": "Open Question",
  "Project Release": "Project Release",
  Risk: "Risk",
  Work: "Work",
};

const BROKEN_REASONS: readonly ValueChainUnavailableReason[] = [
  "Archived",
  "In Trash",
  "Permanently deleted",
  "Redacted for security",
  "No access",
];

type GoalRelationRow = typeof projectGoalRelation.$inferSelect;

/** What every read stage reports: nodes and the explicit binds between them. */
interface Facts {
  associations: ValueChainFactEdge[];
  edges: ValueChainFactEdge[];
  nodes: Map<string, ValueChainFactNode>;
}

interface Scope {
  database: Database;
  projectId: string;
}

/** The Project is read only for its owner; an archived Project still reads. */
async function ownsProject(
  database: Database,
  accountId: string,
  projectId: string,
) {
  const [row] = await database
    .select({ id: project.id })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(eq(project.id, projectId), eq(workspace.ownerAccountId, accountId)),
    )
    .limit(1);
  return row !== undefined;
}

function brokenReason(
  value: string | null,
): ValueChainUnavailableReason | null {
  return BROKEN_REASONS.find((reason) => reason === value) ?? null;
}

function addNode(facts: Facts, node: ValueChainFactNode) {
  facts.nodes.set(`${node.type}:${node.id}`, node);
}

function bind(
  parent: ValueChainNodeRef,
  child: ValueChainNodeRef,
  id: string,
  label: string,
): ValueChainFactEdge {
  return { child, parent, relation: { id, label } };
}

function unique(ids: readonly string[]) {
  return [...new Set(ids)];
}

/**
 * Works that only an association names — sharing a reached Release's scope,
 * `Related` to the Goal — are visible but not reached. Their own context is
 * read like a chain Work's so nothing related hides behind them.
 */
function strayWorkIds(facts: Facts, chainWorkIds: string[]): string[] {
  const chained = new Set(chainWorkIds);
  return unique(
    facts.associations
      .flatMap((edge) => [edge.parent, edge.child])
      .filter((ref) => ref.type === "Work" && !chained.has(ref.id))
      .map((ref) => ref.id),
  );
}

function inProject(
  table: { id: AnyPgColumn; projectId: AnyPgColumn },
  projectId: string,
  ids: string[],
) {
  return and(eq(table.projectId, projectId), inArray(table.id, ids));
}

/** Records the Goal binds directly and the Work behind a contributing Milestone. */
async function readContributors(
  { database, projectId }: Scope,
  facts: Facts,
  goalRef: ValueChainNodeRef,
  rows: GoalRelationRow[],
) {
  const contributing = rows.filter((row) => row.kind === "Contributes to Goal");
  for (const row of contributing) {
    const type = GOAL_MEMBER_TYPES[row.memberType];
    if (type) {
      facts.edges.push(
        bind(
          goalRef,
          { id: row.memberId, type },
          row.id,
          "Contributes to Goal",
        ),
      );
    }
  }
  const milestoneIds = contributing
    .filter((row) => row.memberType === "Milestone")
    .map((row) => row.memberId);
  const milestoneWork = milestoneIds.length
    ? await database
        .select()
        .from(workRelation)
        .where(
          and(
            eq(workRelation.kind, "Contributes to Milestone"),
            eq(workRelation.targetRecordType, "Milestone"),
            eq(workRelation.targetProjectId, projectId),
            inArray(workRelation.targetRecordId, milestoneIds),
            isNull(workRelation.deletedAt),
          ),
        )
    : [];
  for (const row of milestoneWork) {
    facts.edges.push(
      bind(
        { id: row.targetRecordId, type: "Milestone" },
        { id: row.sourceWorkId, type: "Work" },
        row.id,
        "Contributes to Milestone",
      ),
    );
  }
  return {
    releaseIds: contributing
      .filter((row) => row.memberType === "Project Release")
      .map((row) => row.memberId),
    workIds: unique([
      ...contributing
        .filter((row) => row.memberType === "Work")
        .map((row) => row.memberId),
      ...milestoneWork.map((row) => row.sourceWorkId),
    ]),
  };
}

async function readScopes(
  { database, projectId }: Scope,
  facts: Facts,
  direct: { releaseIds: string[]; workIds: string[] },
) {
  const byWork = direct.workIds.length
    ? await database
        .select()
        .from(projectReleaseScope)
        .where(
          and(
            eq(projectReleaseScope.projectId, projectId),
            inArray(projectReleaseScope.workId, direct.workIds),
            isNull(projectReleaseScope.removedAt),
          ),
        )
    : [];
  for (const row of byWork) {
    facts.edges.push(
      bind(
        { id: row.workId, type: "Work" },
        { id: row.releaseId, type: "Project Release" },
        row.id,
        "Release scope",
      ),
    );
  }
  const releaseIds = unique([
    ...direct.releaseIds,
    ...byWork.map((row) => row.releaseId),
  ]);
  const ofRelease = releaseIds.length
    ? await database
        .select()
        .from(projectReleaseScope)
        .where(
          and(
            eq(projectReleaseScope.projectId, projectId),
            inArray(projectReleaseScope.releaseId, releaseIds),
            isNull(projectReleaseScope.removedAt),
          ),
        )
    : [];
  // Other Work in a reached Release's scope is related, not reached.
  for (const row of ofRelease) {
    if (!direct.workIds.includes(row.workId)) {
      facts.associations.push(
        bind(
          { id: row.workId, type: "Work" },
          { id: row.releaseId, type: "Project Release" },
          row.id,
          "Release scope",
        ),
      );
    }
  }
  return releaseIds;
}

/**
 * The node type of a chain bind's target. The kind only names the relation;
 * the stored target type names the record, so an `Origin` bind whose target is
 * a Work resolves as a Work, never as an invented problem record. The chain
 * reads Origin, Evidence and Karar binds; other kinds stay outside it.
 */
function relationTarget(
  row: typeof workRelation.$inferSelect,
): ValueChainNodeType | null {
  const inChain =
    row.kind === "Origin" ||
    row.kind === "Evidence" ||
    row.targetRecordType === "Decision";
  if (!inChain) {
    return null;
  }
  switch (row.targetRecordType) {
    case "Assumption":
    case "Decision":
    case "Milestone":
    case "Open Question":
    case "Project Release":
    case "Risk":
    case "Work":
      return row.targetRecordType;
    default:
      // A produced main record this view does not resolve: only its type shows.
      return "Other record";
  }
}

/**
 * Origin, evidence and Karar binds written on a read Work. The caller passes
 * chain Works and unlinked Works alike; edges anchored at an unlinked Work
 * never reach the Goal, they only feed the `Not linked to goal` second hop.
 */
async function readWorkRelations(
  { database, projectId }: Scope,
  facts: Facts,
  workIds: string[],
) {
  const rows = workIds.length
    ? await database
        .select()
        .from(workRelation)
        .where(
          and(
            eq(workRelation.targetProjectId, projectId),
            inArray(workRelation.sourceWorkId, workIds),
            isNull(workRelation.deletedAt),
          ),
        )
    : [];
  const decisionIds: string[] = [];
  for (const row of rows) {
    const type = relationTarget(row);
    if (!type) {
      continue;
    }
    if (type === "Decision") {
      // A Karar resolves live below, so a stored label never outlives it.
      decisionIds.push(row.targetRecordId);
    } else {
      const unavailable = brokenReason(row.brokenReason);
      addNode(facts, {
        id: row.targetRecordId,
        status: null,
        title: unavailable ? null : row.targetLabel,
        type,
        unavailable,
      });
    }
    facts.edges.push(
      bind(
        { id: row.sourceWorkId, type: "Work" },
        { id: row.targetRecordId, type },
        row.id,
        row.kind,
      ),
    );
  }
  return decisionIds;
}

/** Evidence bindings whose target is a read Work or Karar. */
async function readEvidence(
  { database, projectId }: Scope,
  facts: Facts,
  workIds: string[],
  decisionIds: string[],
) {
  const targets = [...workIds, ...decisionIds];
  const bindings = targets.length
    ? await database
        .select()
        .from(evidenceBinding)
        .where(
          and(
            eq(evidenceBinding.targetProjectId, projectId),
            inArray(evidenceBinding.targetRecordId, targets),
          ),
        )
    : [];
  const sourceIds = unique(bindings.map((row) => row.sourceRecordId));
  const versions = sourceIds.length
    ? await database
        .select({
          id: sourceVersion.sourceId,
          title: sourceVersion.title,
        })
        .from(sourceVersion)
        .innerJoin(
          source,
          and(
            eq(source.id, sourceVersion.sourceId),
            eq(source.revision, sourceVersion.revision),
          ),
        )
        .where(inArray(sourceVersion.sourceId, sourceIds))
        .orderBy(desc(sourceVersion.revision))
    : [];
  for (const row of bindings) {
    const version = versions.find((item) => item.id === row.sourceRecordId);
    addNode(facts, {
      id: row.sourceRecordId,
      status: row.role,
      title: version?.title ?? null,
      type: "Evidence",
      unavailable: version ? null : "Permanently deleted",
    });
    facts.edges.push(
      bind(
        {
          id: row.targetRecordId,
          type: row.targetRecordType === "Decision" ? "Decision" : "Work",
        },
        { id: row.sourceRecordId, type: "Evidence" },
        row.id,
        `Evidence (${row.role})`,
      ),
    );
  }
}

function githubUnavailable(
  link: typeof githubWorkLink.$inferSelect,
  record: typeof githubExternalRecord.$inferSelect | null,
): ValueChainUnavailableReason | null {
  if (link.recordId && !record) {
    return "Permanently deleted";
  }
  if (record?.trashedAt) {
    return "In Trash";
  }
  return record?.archivedAt ? "Archived" : null;
}

function githubTitle(
  link: typeof githubWorkLink.$inferSelect,
  record: typeof githubExternalRecord.$inferSelect | null,
) {
  return record
    ? `${link.kind} #${record.number} ${record.title}`
    : `${link.kind} ${link.value ?? ""}`.trim();
}

/** Supported GitHub facts reach a Work only through a stored link. */
async function readGithub(
  { database, projectId }: Scope,
  facts: Facts,
  workIds: string[],
) {
  const rows = workIds.length
    ? await database
        .select({ link: githubWorkLink, record: githubExternalRecord })
        .from(githubWorkLink)
        .leftJoin(
          githubExternalRecord,
          eq(githubExternalRecord.id, githubWorkLink.recordId),
        )
        .where(
          and(
            eq(githubWorkLink.projectId, projectId),
            inArray(githubWorkLink.workId, workIds),
            isNull(githubWorkLink.removedAt),
          ),
        )
    : [];
  for (const { link, record } of rows) {
    const unavailable = githubUnavailable(link, record);
    addNode(facts, {
      id: link.id,
      status: record?.sourceState ?? null,
      title: unavailable ? null : githubTitle(link, record),
      type: "GitHub",
      unavailable,
    });
    facts.edges.push(
      bind(
        { id: link.workId, type: "Work" },
        { id: link.id, type: "GitHub" },
        link.id,
        `GitHub link (${link.role})`,
      ),
    );
  }
}

/** Tests: the current version of a Planned Test Case that targets a Work. */
async function readTests(
  { database, projectId }: Scope,
  facts: Facts,
  workIds: string[],
) {
  const rows = workIds.length
    ? await database
        .select({
          caseId: plannedTestCase.id,
          relationId: plannedTestCaseRelation.id,
          targetId: plannedTestCaseRelation.targetId,
          title: plannedTestCaseVersion.title,
        })
        .from(plannedTestCaseRelation)
        .innerJoin(
          plannedTestCaseVersion,
          eq(plannedTestCaseVersion.id, plannedTestCaseRelation.versionId),
        )
        .innerJoin(
          plannedTestCase,
          and(
            eq(plannedTestCase.id, plannedTestCaseVersion.caseId),
            eq(plannedTestCase.currentVersion, plannedTestCaseVersion.version),
          ),
        )
        .where(
          and(
            eq(plannedTestCase.projectId, projectId),
            eq(plannedTestCaseRelation.targetType, "Work"),
            inArray(plannedTestCaseRelation.targetId, workIds),
          ),
        )
    : [];
  for (const row of rows) {
    addNode(facts, {
      id: row.caseId,
      status: null,
      title: row.title,
      type: "Test",
      unavailable: null,
    });
    facts.edges.push(
      bind(
        { id: row.targetId, type: "Work" },
        { id: row.caseId, type: "Test" },
        row.relationId,
        "Planned Test Case target",
      ),
    );
  }
}

/** Dated Access and Outcome observations of every reached Release. */
async function readObservations(
  { database, projectId }: Scope,
  facts: Facts,
  releaseIds: string[],
) {
  const rows = releaseIds.length
    ? await database
        .select({
          observation: releaseObservation,
          releaseId: releaseReassessmentRound.releaseId,
          sequence: releaseReassessmentRound.sequence,
        })
        .from(releaseObservation)
        .innerJoin(
          releaseReassessmentRound,
          eq(releaseReassessmentRound.id, releaseObservation.roundId),
        )
        .where(
          and(
            eq(releaseReassessmentRound.projectId, projectId),
            inArray(releaseReassessmentRound.releaseId, releaseIds),
          ),
        )
    : [];
  for (const { observation, releaseId, sequence } of rows) {
    const kind = observation.kind === "access" ? "Access" : "Outcome";
    addNode(facts, {
      id: observation.id,
      status: observation.assessment,
      title: `${kind} observation ${observation.observedAt.toISOString().slice(0, 10)}`,
      type: "Observation",
      unavailable: null,
    });
    facts.edges.push(
      bind(
        { id: releaseId, type: "Project Release" },
        { id: observation.id, type: "Observation" },
        observation.id,
        `Reassessment round ${sequence}`,
      ),
    );
  }
}

/** Goal `Related` binds are visible but never part of the chain. */
function readRelated(
  facts: Facts,
  goalRef: ValueChainNodeRef,
  rows: GoalRelationRow[],
) {
  for (const row of rows.filter((item) => item.kind === "Related")) {
    const type = GOAL_MEMBER_TYPES[row.memberType] ?? "Other record";
    facts.associations.push(
      bind(goalRef, { id: row.memberId, type }, row.id, "Related"),
    );
    if (type === "Other record") {
      // Only the record type is shown: its content is not resolved here.
      addNode(facts, {
        id: row.memberId,
        status: null,
        title: row.memberType,
        type,
        unavailable: null,
      });
    }
  }
}

function idsOfType(facts: Facts, type: ValueChainNodeType) {
  return unique(
    [...facts.edges, ...facts.associations]
      .flatMap((edge) => [edge.parent, edge.child])
      .filter((ref) => ref.type === type)
      .map((ref) => ref.id),
  );
}

interface TitledRow {
  id: string;
  life?: string;
  status?: string;
  title: string;
}

async function titledRows(
  facts: Facts,
  type: ValueChainNodeType,
  load: (ids: string[]) => Promise<TitledRow[]>,
) {
  const ids = idsOfType(facts, type);
  const rows = ids.length ? await load(ids) : [];
  for (const row of rows) {
    addNode(facts, {
      id: row.id,
      status: row.status ?? row.life ?? null,
      title: row.title,
      type,
      unavailable: null,
    });
  }
}

/** Resolves title, status and availability of the stored records live. */
async function resolveRecords({ database, projectId }: Scope, facts: Facts) {
  const workIds = idsOfType(facts, "Work");
  const works = workIds.length
    ? await database
        .select()
        .from(work)
        .where(inProject(work, projectId, workIds))
    : [];
  for (const row of works) {
    let unavailable: ValueChainUnavailableReason | null = null;
    if (row.trashedAt) {
      unavailable = "In Trash";
    } else if (row.archivedAt) {
      unavailable = "Archived";
    }
    addNode(facts, {
      id: row.id,
      status: row.status,
      title: unavailable ? null : row.title,
      type: "Work",
      unavailable,
    });
  }
  const releaseIds = idsOfType(facts, "Project Release");
  const releases = releaseIds.length
    ? await database
        .select()
        .from(projectRelease)
        .where(inProject(projectRelease, projectId, releaseIds))
    : [];
  for (const row of releases) {
    addNode(facts, {
      id: row.id,
      status: row.status,
      title: row.name,
      type: "Project Release",
      unavailable: null,
    });
  }
  await Promise.all([
    titledRows(facts, "Milestone", (ids) =>
      database
        .select()
        .from(projectMilestone)
        .where(inProject(projectMilestone, projectId, ids)),
    ),
    titledRows(facts, "Decision", (ids) =>
      database
        .select()
        .from(decision)
        .where(inProject(decision, projectId, ids)),
    ),
    titledRows(facts, "Risk", (ids) =>
      database
        .select()
        .from(risk)
        .where(inProject(risk, projectId, ids)),
    ),
    titledRows(facts, "Open Question", (ids) =>
      database
        .select()
        .from(openQuestion)
        .where(inProject(openQuestion, projectId, ids)),
    ),
    titledRows(facts, "Assumption", (ids) =>
      database
        .select()
        .from(assumption)
        .where(inProject(assumption, projectId, ids)),
    ),
  ]);
}

/**
 * Reads the explicit records and relations around one Project Goal and hands
 * them to the pure derivation. Every query here is a select: Value Chain has
 * no write path, and a bind that is not stored is never invented.
 */
export function createDatabaseValueChain(database: Database): ValueChainAccess {
  return {
    async chain(accountId, rawInput) {
      const { goalId, projectId } = valueChainInputSchema.parse(rawInput);
      if (!(await ownsProject(database, accountId, projectId))) {
        return null;
      }
      const scope: Scope = { database, projectId };
      const [goalRow] = await database
        .select()
        .from(projectGoal)
        .where(
          and(eq(projectGoal.id, goalId), eq(projectGoal.projectId, projectId)),
        )
        .limit(1);
      const goalRelations = await database
        .select()
        .from(projectGoalRelation)
        .where(
          and(
            eq(projectGoalRelation.projectId, projectId),
            eq(projectGoalRelation.goalId, goalId),
            isNull(projectGoalRelation.removedAt),
          ),
        );
      if (!goalRow && goalRelations.length === 0) {
        return null;
      }
      const goalRef: ValueChainNodeRef = { id: goalId, type: "Project Goal" };
      const facts: Facts = { associations: [], edges: [], nodes: new Map() };
      const direct = await readContributors(
        scope,
        facts,
        goalRef,
        goalRelations,
      );
      const releaseIds = await readScopes(scope, facts, direct);
      // An unlinked Work keeps its own Karar, evidence and test context
      // visible: PRD 04 hides no related piece behind an unlinked Work. Its
      // edges never reach the Goal, they only feed the `Not linked to goal`
      // second hop. GitHub links stay read for chain Works only: the PRD's
      // unlinked enumeration names Karar, evidence and tests, not GitHub.
      const contextWorkIds = unique([
        ...direct.workIds,
        ...strayWorkIds(facts, direct.workIds),
      ]);
      const decisionIds = await readWorkRelations(scope, facts, contextWorkIds);
      await readEvidence(scope, facts, contextWorkIds, decisionIds);
      await readGithub(scope, facts, direct.workIds);
      await readTests(scope, facts, contextWorkIds);
      await readObservations(scope, facts, releaseIds);
      readRelated(facts, goalRef, goalRelations);
      await resolveRecords(scope, facts);
      return deriveValueChain({
        associations: facts.associations,
        edges: facts.edges,
        goal: {
          id: goalId,
          title: goalRow?.title ?? null,
          unavailable: goalRow ? null : "Permanently deleted",
        },
        nodes: [...facts.nodes.values()],
      });
    },
  };
}
