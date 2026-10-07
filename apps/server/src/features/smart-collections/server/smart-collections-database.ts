import { getProjectStatusAgeThresholdDays } from "@cantiara/api/project-shell";
import { isLongInSameStatus } from "@cantiara/api/return-to-work";
import type {
  CreateSmartCollectionInput,
  SmartCollectionSourceType,
  SmartCollectionsAccess,
  SmartCollectionViewSource,
} from "@cantiara/api/smart-collections";
import {
  SmartCollectionConflictError,
  SmartCollectionUnavailableError,
} from "@cantiara/api/smart-collections";
import type { Database } from "@cantiara/db";
import { assumption } from "@cantiara/db/schema/assumption";
import { workspace } from "@cantiara/db/schema/auth";
import { decision } from "@cantiara/db/schema/decision";
import { document } from "@cantiara/db/schema/document";
import { openQuestion } from "@cantiara/db/schema/open-question";
import { productionIncident } from "@cantiara/db/schema/production-incident";
import { project } from "@cantiara/db/schema/project";
import { projectMilestone } from "@cantiara/db/schema/project-milestone";
import { projectRelease } from "@cantiara/db/schema/project-release";
import { risk } from "@cantiara/db/schema/risk";
import {
  smartCollection,
  smartCollectionAttentionSignal,
  smartCollectionSubscription,
  smartCollectionSubscriptionMembership,
  smartCollectionView,
} from "@cantiara/db/schema/smart-collection";
import { work } from "@cantiara/db/schema/work";
import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  type SmartCollectionSubscriptionContext,
  type SmartCollectionSubscriptionMember,
  type SmartCollectionSubscriptionMembershipState,
  startSmartCollectionSubscriptionMembership,
  transitionSmartCollectionSubscriptionMembership,
} from "./smart-collection-subscription-signals";

type SmartCollectionConditions = CreateSmartCollectionInput["conditions"];
type SmartCollectionExecutor = Pick<
  Database,
  "delete" | "insert" | "select" | "update"
>;
type ProjectSourceMembershipRecord =
  SmartCollectionViewSource["projectSourceRecords"][number];
type SmartCollectionWorkRecord = SmartCollectionViewSource["works"][number];
type SmartCollectionDocumentRecord =
  SmartCollectionViewSource["documents"][number];
type SmartCollectionDocumentRow = Omit<
  SmartCollectionDocumentRecord,
  "membershipReasons"
>;
interface SmartCollectionProjectScope {
  projectIds: string[];
  projectNames: Map<string, string>;
}

function explainProjectSourceMembership<
  SourceType extends ProjectSourceMembershipRecord["sourceType"],
  Record extends Omit<
    ProjectSourceMembershipRecord,
    "sourceType" | "membershipReasons"
  >,
>(
  records: Record[],
  sourceType: SourceType,
  projectNames: ReadonlyMap<string, string>,
  status?: string,
): Array<
  Record &
    Pick<ProjectSourceMembershipRecord, "membershipReasons"> & {
      sourceType: SourceType;
    }
> {
  return records.map((record) => ({
    ...record,
    sourceType,
    membershipReasons: [
      `Project: ${projectNames.get(record.projectId) ?? "Project scope"}`,
      ...(status ? [`Status: ${status}`] : []),
    ],
  }));
}

async function getProjectSourceMembershipRecords(
  database: SmartCollectionExecutor,
  sourceType: ProjectSourceMembershipRecord["sourceType"],
  projectIds: string[],
  projectNames: ReadonlyMap<string, string>,
  status?: string,
): Promise<ProjectSourceMembershipRecord[]> {
  if (projectIds.length === 0) {
    return [];
  }

  switch (sourceType) {
    case "Decision": {
      const records = await database
        .select({
          id: decision.id,
          title: decision.title,
          status: decision.life,
          projectId: decision.projectId,
        })
        .from(decision)
        .where(
          and(
            inArray(decision.projectId, projectIds),
            status ? eq(decision.life, status) : undefined,
          ),
        )
        .orderBy(asc(decision.projectId), asc(decision.title));
      return explainProjectSourceMembership(
        records,
        sourceType,
        projectNames,
        status,
      );
    }
    case "Risk": {
      const records = await database
        .select({
          id: risk.id,
          title: risk.title,
          status: risk.life,
          projectId: risk.projectId,
        })
        .from(risk)
        .where(
          and(
            inArray(risk.projectId, projectIds),
            status ? eq(risk.life, status) : undefined,
          ),
        )
        .orderBy(asc(risk.projectId), asc(risk.title));
      return explainProjectSourceMembership(
        records,
        sourceType,
        projectNames,
        status,
      );
    }
    case "Assumption": {
      const records = await database
        .select({
          id: assumption.id,
          title: assumption.title,
          status: assumption.life,
          projectId: assumption.projectId,
        })
        .from(assumption)
        .where(
          and(
            inArray(assumption.projectId, projectIds),
            status ? eq(assumption.life, status) : undefined,
          ),
        )
        .orderBy(asc(assumption.projectId), asc(assumption.title));
      return explainProjectSourceMembership(
        records,
        sourceType,
        projectNames,
        status,
      );
    }
    case "Open Question": {
      const records = await database
        .select({
          id: openQuestion.id,
          title: openQuestion.title,
          status: openQuestion.life,
          projectId: openQuestion.projectId,
        })
        .from(openQuestion)
        .where(
          and(
            inArray(openQuestion.projectId, projectIds),
            status ? eq(openQuestion.life, status) : undefined,
          ),
        )
        .orderBy(asc(openQuestion.projectId), asc(openQuestion.title));
      return explainProjectSourceMembership(
        records,
        sourceType,
        projectNames,
        status,
      );
    }
    case "Milestone": {
      const records = await database
        .select({
          id: projectMilestone.id,
          title: projectMilestone.title,
          status: projectMilestone.status,
          projectId: projectMilestone.projectId,
        })
        .from(projectMilestone)
        .where(
          and(
            inArray(projectMilestone.projectId, projectIds),
            status ? eq(projectMilestone.status, status) : undefined,
          ),
        )
        .orderBy(asc(projectMilestone.projectId), asc(projectMilestone.title));
      return explainProjectSourceMembership(
        records,
        sourceType,
        projectNames,
        status,
      );
    }
    case "Project Release": {
      const records = await database
        .select({
          id: projectRelease.id,
          title: projectRelease.name,
          status: projectRelease.status,
          projectId: projectRelease.projectId,
        })
        .from(projectRelease)
        .where(
          and(
            inArray(projectRelease.projectId, projectIds),
            status ? eq(projectRelease.status, status) : undefined,
          ),
        )
        .orderBy(asc(projectRelease.projectId), asc(projectRelease.name));
      return explainProjectSourceMembership(
        records,
        sourceType,
        projectNames,
        status,
      );
    }
    case "Production Incident": {
      const records = await database
        .select({
          id: productionIncident.id,
          title: productionIncident.title,
          status: productionIncident.status,
          projectId: productionIncident.projectId,
        })
        .from(productionIncident)
        .where(
          and(
            inArray(productionIncident.projectId, projectIds),
            status ? eq(productionIncident.status, status) : undefined,
          ),
        )
        .orderBy(
          asc(productionIncident.projectId),
          asc(productionIncident.title),
        );
      return explainProjectSourceMembership(
        records,
        sourceType,
        projectNames,
        status,
      );
    }
    default:
      return [];
  }
}

function sameJson(left: unknown, right: unknown) {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(normalize);
    }
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([leftKey], [rightKey]) => {
            if (leftKey < rightKey) {
              return -1;
            }
            if (leftKey > rightKey) {
              return 1;
            }
            return 0;
          })
          .map(([key, entry]) => [key, normalize(entry)]),
      );
    }
    return value;
  };
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function getStoredProjectIds(
  sourceType: SmartCollectionSourceType,
  scope: { projectIds: string[] } | null | undefined,
  projectId: string,
): string[] {
  if (sourceType === "Wiki Document") {
    return [];
  }
  return scope?.projectIds.length ? scope.projectIds : [projectId];
}

async function getAccessibleProjectScope(
  database: SmartCollectionExecutor,
  accountId: string,
  workspaceId: string,
  collection: typeof smartCollection.$inferSelect,
  sourceType: SmartCollectionSourceType,
): Promise<SmartCollectionProjectScope> {
  if (sourceType === "Wiki Document") {
    return { projectIds: [], projectNames: new Map() };
  }
  const storedProjectIds = getStoredProjectIds(
    sourceType,
    collection.scope,
    collection.projectId,
  );

  const projects = await database
    .select({ id: project.id, name: project.name })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        inArray(project.id, storedProjectIds),
        eq(project.workspaceId, workspaceId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  return {
    projectIds: projects.map(({ id }) => id),
    projectNames: new Map(projects.map(({ id, name }) => [id, name])),
  };
}

async function getWorkMembershipRecords(
  database: SmartCollectionExecutor,
  projectIds: string[],
  projectNames: ReadonlyMap<string, string>,
  conditions: SmartCollectionConditions,
  statusAgeThresholdDays?: number,
): Promise<SmartCollectionWorkRecord[]> {
  if (projectIds.length === 0) {
    return [];
  }
  const records = await database
    .select({
      createdAt: work.createdAt,
      effort: work.effort,
      id: work.id,
      key: work.key,
      title: work.title,
      status: work.status,
      statusChangedAt: work.statusChangedAt,
      type: work.type,
      projectId: work.projectId,
    })
    .from(work)
    .where(
      and(
        inArray(work.projectId, projectIds),
        isNull(work.archivedAt),
        isNull(work.trashedAt),
        conditions.status ? eq(work.status, conditions.status) : undefined,
        conditions.type ? eq(work.type, conditions.type) : undefined,
      ),
    )
    .orderBy(asc(work.projectId), asc(work.key));
  const now = new Date();
  const members =
    statusAgeThresholdDays === undefined
      ? records
      : records.filter((record) =>
          isLongInSameStatus(
            {
              active: record.status !== "Closed",
              changedAt: record.statusChangedAt.toISOString(),
            },
            statusAgeThresholdDays,
            now,
          ),
        );
  return members.map((record) => ({
    ...record,
    createdAt: record.createdAt.toISOString(),
    statusChangedAt: record.statusChangedAt.toISOString(),
    membershipReasons: [
      `Project: ${projectNames.get(record.projectId) ?? "Project scope"}`,
      ...(conditions.status ? [`Status: ${conditions.status}`] : []),
      ...(conditions.type ? [`Work type: ${conditions.type}`] : []),
      ...(statusAgeThresholdDays === undefined
        ? []
        : ["Long in the same status"]),
    ],
  }));
}

async function getDocumentMembershipRecords(
  database: SmartCollectionExecutor,
  sourceType: "Document" | "Wiki Document" | null,
  projectScope: SmartCollectionProjectScope,
  workspaceId: string,
  conditions: SmartCollectionConditions,
): Promise<SmartCollectionDocumentRecord[]> {
  if (!sourceType) {
    return [];
  }
  if (sourceType === "Document" && projectScope.projectIds.length === 0) {
    return [];
  }

  const selection = {
    id: document.id,
    title: document.title,
    type: document.type,
    projectId: document.projectId,
    workspaceId: document.workspaceId,
  };
  const documentConditions = [
    isNull(document.archivedAt),
    conditions.documentType
      ? eq(document.type, conditions.documentType)
      : undefined,
    conditions.tag
      ? sql`${document.inlineTags} @> ${JSON.stringify([
          { name: conditions.tag },
        ])}::jsonb`
      : undefined,
  ];
  let records: SmartCollectionDocumentRow[];
  if (sourceType === "Document") {
    records = await database
      .select(selection)
      .from(document)
      .where(
        and(
          inArray(document.projectId, projectScope.projectIds),
          isNull(document.workspaceId),
          ...documentConditions,
        ),
      )
      .orderBy(asc(document.projectId), asc(document.title));
  } else {
    records = await database
      .select(selection)
      .from(document)
      .where(
        and(
          eq(document.workspaceId, workspaceId),
          isNull(document.projectId),
          ...documentConditions,
        ),
      )
      .orderBy(asc(document.title));
  }

  return records.map((record) => {
    const membershipReasons = [
      record.projectId
        ? `Project: ${projectScope.projectNames.get(record.projectId) ?? "Project scope"}`
        : "Workspace scope",
    ];
    if (conditions.documentType) {
      membershipReasons.push(`Document type: ${conditions.documentType}`);
    }
    if (conditions.tag) {
      membershipReasons.push(`Tag: ${conditions.tag}`);
    }
    return { ...record, membershipReasons };
  });
}

function getProjectSourceRecords(
  database: SmartCollectionExecutor,
  sourceType: SmartCollectionSourceType,
  projectScope: SmartCollectionProjectScope,
  conditions: SmartCollectionConditions,
): Promise<ProjectSourceMembershipRecord[]> {
  if (
    sourceType === "Work" ||
    sourceType === "Document" ||
    sourceType === "Wiki Document"
  ) {
    return Promise.resolve([]);
  }
  return getProjectSourceMembershipRecords(
    database,
    sourceType,
    projectScope.projectIds,
    projectScope.projectNames,
    conditions.status,
  );
}

function assertNever(value: never): never {
  throw new Error(`Unsupported Smart Collection source type: ${value}`);
}

function smartCollectionSourcePath(
  sourceRecordType: SmartCollectionSourceType,
  sourceRecordId: string,
  sourceProjectId: string | null,
) {
  const recordId = encodeURIComponent(sourceRecordId);
  const recordPath = sourceProjectId
    ? `/projects/${encodeURIComponent(sourceProjectId)}`
    : "/personal-wiki";
  switch (sourceRecordType) {
    case "Work":
      return `${recordPath}#work-${recordId}`;
    case "Document":
    case "Wiki Document":
      return `${recordPath}#document-${recordId}`;
    case "Decision":
      return `${recordPath}#source-decision-${recordId}`;
    case "Risk":
      return `${recordPath}#source-risk-${recordId}`;
    case "Assumption":
      return `${recordPath}#source-assumption-${recordId}`;
    case "Open Question":
      return `${recordPath}#source-open-question-${recordId}`;
    case "Milestone":
      return `${recordPath}#source-milestone-${recordId}`;
    case "Project Release":
      return `${recordPath}#source-project-release-${recordId}`;
    case "Production Incident":
      return `${recordPath}#source-production-incident-${recordId}`;
    default:
      return assertNever(sourceRecordType);
  }
}

function smartCollectionSubscriptionMembers(
  view: SmartCollectionViewSource,
): SmartCollectionSubscriptionMember[] {
  if (view.sourceType === "Work") {
    return view.works.map((record) => ({
      membershipReasons: record.membershipReasons,
      sourcePath: smartCollectionSourcePath(
        "Work",
        record.id,
        record.projectId,
      ),
      sourceProjectId: record.projectId,
      sourceRecordId: record.id,
      sourceRecordTitle: `${record.key} · ${record.title}`,
      sourceRecordType: "Work",
    }));
  }
  if (view.sourceType === "Document" || view.sourceType === "Wiki Document") {
    return view.documents.map((record) => ({
      membershipReasons: record.membershipReasons,
      sourcePath: smartCollectionSourcePath(
        view.sourceType,
        record.id,
        record.projectId,
      ),
      sourceProjectId: record.projectId,
      sourceRecordId: record.id,
      sourceRecordTitle: record.title,
      sourceRecordType: view.sourceType,
    }));
  }
  return view.projectSourceRecords.map((record) => ({
    membershipReasons: record.membershipReasons,
    sourcePath: smartCollectionSourcePath(
      record.sourceType,
      record.id,
      record.projectId,
    ),
    sourceProjectId: record.projectId,
    sourceRecordId: record.id,
    sourceRecordTitle: record.title,
    sourceRecordType: record.sourceType,
  }));
}

function subscriptionMembershipState(
  row: typeof smartCollectionSubscriptionMembership.$inferSelect,
): SmartCollectionSubscriptionMembershipState {
  return {
    membershipReasons: row.membershipReasons,
    sourcePath: row.sourcePath,
    sourceProjectId: row.sourceProjectId,
    sourceRecordId: row.sourceRecordId,
    sourceRecordTitle: row.sourceRecordTitle,
    sourceRecordType: row.sourceRecordType as SmartCollectionSourceType,
    enteredAt: row.enteredAt,
    isMember: row.isMember,
    leftAt: row.leftAt,
    membershipPeriod: row.membershipPeriod,
  };
}

function subscriptionMembershipKey(
  sourceRecordType: string,
  sourceRecordId: string,
) {
  return JSON.stringify([sourceRecordType, sourceRecordId]);
}

async function saveSubscriptionMembership(
  executor: SmartCollectionExecutor,
  subscriptionId: string,
  state: SmartCollectionSubscriptionMembershipState,
) {
  await executor
    .insert(smartCollectionSubscriptionMembership)
    .values({ ...state, subscriptionId })
    .onConflictDoUpdate({
      target: [
        smartCollectionSubscriptionMembership.subscriptionId,
        smartCollectionSubscriptionMembership.sourceRecordType,
        smartCollectionSubscriptionMembership.sourceRecordId,
      ],
      set: {
        enteredAt: state.enteredAt,
        isMember: state.isMember,
        leftAt: state.leftAt,
        membershipPeriod: state.membershipPeriod,
        membershipReasons: state.membershipReasons,
        sourcePath: state.sourcePath,
        sourceProjectId: state.sourceProjectId,
        sourceRecordTitle: state.sourceRecordTitle,
      },
    });
}

async function reconcileSubscriptionMembership(
  executor: SmartCollectionExecutor,
  subscription: SmartCollectionSubscriptionContext,
  notifyOnLeave: boolean,
  view: SmartCollectionViewSource,
  now: Date,
) {
  const currentMembers = smartCollectionSubscriptionMembers(view);
  const previousRows = await executor
    .select()
    .from(smartCollectionSubscriptionMembership)
    .where(
      eq(smartCollectionSubscriptionMembership.subscriptionId, subscription.id),
    );
  const previousByKey = new Map(
    previousRows.map((row) => [
      subscriptionMembershipKey(row.sourceRecordType, row.sourceRecordId),
      row,
    ]),
  );
  const currentKeys = new Set<string>();

  for (const current of currentMembers) {
    const key = subscriptionMembershipKey(
      current.sourceRecordType,
      current.sourceRecordId,
    );
    currentKeys.add(key);
    const previousRow = previousByKey.get(key);
    const transition = transitionSmartCollectionSubscriptionMembership({
      current,
      now,
      notifyOnLeave,
      previous: previousRow ? subscriptionMembershipState(previousRow) : null,
      subscription,
    });
    if (transition.changed && transition.nextState) {
      // biome-ignore lint/performance/noAwaitInLoops: Keep each snapshot write before its idempotent signal insert in the same transaction.
      await saveSubscriptionMembership(
        executor,
        subscription.id,
        transition.nextState,
      );
    }
    if (transition.signal) {
      await executor
        .insert(smartCollectionAttentionSignal)
        .values(transition.signal)
        .onConflictDoNothing();
    }
  }

  for (const row of previousRows) {
    const key = subscriptionMembershipKey(
      row.sourceRecordType,
      row.sourceRecordId,
    );
    if (currentKeys.has(key)) {
      continue;
    }
    const transition = transitionSmartCollectionSubscriptionMembership({
      current: null,
      now,
      notifyOnLeave,
      previous: subscriptionMembershipState(row),
      subscription,
    });
    if (transition.changed && transition.nextState) {
      // biome-ignore lint/performance/noAwaitInLoops: Keep each snapshot write before its idempotent signal insert in the same transaction.
      await saveSubscriptionMembership(
        executor,
        subscription.id,
        transition.nextState,
      );
    }
    if (transition.signal) {
      await executor
        .insert(smartCollectionAttentionSignal)
        .values(transition.signal)
        .onConflictDoNothing();
    }
  }
}

async function startSubscriptionMembershipBaseline(
  executor: SmartCollectionExecutor,
  subscriptionId: string,
  view: SmartCollectionViewSource,
  now: Date,
) {
  const baseline = smartCollectionSubscriptionMembers(view).map((member) => ({
    ...startSmartCollectionSubscriptionMembership(member, now),
    subscriptionId,
  }));
  if (baseline.length === 0) {
    return;
  }
  await executor
    .insert(smartCollectionSubscriptionMembership)
    .values(baseline)
    .onConflictDoNothing();
}

type SmartCollectionSubscriptionRow =
  typeof smartCollectionSubscription.$inferSelect;

async function loadSmartCollectionView(
  executor: SmartCollectionExecutor,
  accountId: string,
  viewId: string,
): Promise<{
  subscription: SmartCollectionSubscriptionRow | null;
  view: SmartCollectionViewSource;
} | null> {
  const query = executor
    .select({
      collection: smartCollection,
      view: smartCollectionView,
      workspaceId: project.workspaceId,
    })
    .from(smartCollectionView)
    .innerJoin(
      smartCollection,
      eq(smartCollectionView.collectionId, smartCollection.id),
    )
    .innerJoin(project, eq(smartCollection.projectId, project.id))
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(smartCollectionView.id, viewId),
        eq(workspace.ownerAccountId, accountId),
      ),
    );
  const [row] = await query.for("update", { of: smartCollection }).limit(1);
  if (!row) {
    return null;
  }

  const { collection, view, workspaceId } = row;
  const sourceType = collection.sourceType as SmartCollectionSourceType;
  const conditions = collection.conditions as SmartCollectionConditions;
  const [subscription] = await executor
    .select()
    .from(smartCollectionSubscription)
    .where(
      and(
        eq(smartCollectionSubscription.collectionId, collection.id),
        eq(smartCollectionSubscription.accountId, accountId),
      ),
    )
    .limit(1);
  const projectScope = await getAccessibleProjectScope(
    executor,
    accountId,
    workspaceId,
    collection,
    sourceType,
  );
  const works = await getWorkMembershipRecords(
    executor,
    sourceType === "Work" ? projectScope.projectIds : [],
    projectScope.projectNames,
    conditions,
  );
  const documents = await getDocumentMembershipRecords(
    executor,
    sourceType === "Document" || sourceType === "Wiki Document"
      ? sourceType
      : null,
    projectScope,
    workspaceId,
    conditions,
  );
  const projectSourceRecords = await getProjectSourceRecords(
    executor,
    sourceType,
    projectScope,
    conditions,
  );

  return {
    subscription: subscription ?? null,
    view: {
      collectionId: collection.id,
      collectionName: collection.name,
      conditions,
      id: view.id,
      isSubscribed: Boolean(subscription),
      name: view.name,
      notifyOnLeave: subscription?.notifyOnLeave ?? false,
      presentation: view.presentation as "List" | "Table",
      projectId: collection.projectId,
      sourceType,
      scope: { projectIds: projectScope.projectIds },
      workspaceId,
      works,
      documents,
      projectSourceRecords,
    },
  };
}

function subscriptionContext(
  accountId: string,
  view: SmartCollectionViewSource,
  subscription: SmartCollectionSubscriptionRow,
): SmartCollectionSubscriptionContext {
  return {
    accountId,
    collectionId: view.collectionId,
    collectionName: view.collectionName,
    id: subscription.id,
  };
}

const LONG_STATUS_VIEW_PREFIX = "long-status:";

async function preparedLongStatusView(
  database: SmartCollectionExecutor,
  accountId: string,
  projectId: string,
): Promise<SmartCollectionViewSource | null> {
  const [owned] = await database
    .select({ project })
    .from(project)
    .innerJoin(workspace, eq(project.workspaceId, workspace.id))
    .where(
      and(
        eq(project.id, projectId),
        eq(workspace.ownerAccountId, accountId),
        isNull(project.archivedAt),
      ),
    )
    .limit(1);
  if (!owned) {
    return null;
  }
  const currentProject = owned.project;
  const threshold = getProjectStatusAgeThresholdDays(currentProject);
  if (threshold === null) {
    return null;
  }
  const id = `${LONG_STATUS_VIEW_PREFIX}${projectId}`;
  const works = await getWorkMembershipRecords(
    database,
    [projectId],
    new Map([[projectId, currentProject.name]]),
    {},
    threshold,
  );
  return {
    id,
    collectionId: id,
    collectionName: "Long in the same status",
    name: "Default",
    preparedReason: "Long in the same status",
    conditions: {},
    documents: [],
    projectSourceRecords: [],
    works,
    scope: { projectIds: [projectId] },
    sourceType: "Work",
    projectId,
    workspaceId: currentProject.workspaceId,
    presentation: "List",
    isSubscribed: false,
    notifyOnLeave: false,
  };
}

export function createDatabaseSmartCollections(
  database: Database,
): SmartCollectionsAccess {
  function getView(
    accountId: string,
    viewId: string,
  ): Promise<SmartCollectionViewSource | null> {
    if (viewId.startsWith(LONG_STATUS_VIEW_PREFIX)) {
      return preparedLongStatusView(
        database,
        accountId,
        viewId.slice(LONG_STATUS_VIEW_PREFIX.length),
      );
    }
    return database.transaction(async (tx) => {
      const loaded = await loadSmartCollectionView(tx, accountId, viewId);
      if (!loaded) {
        return null;
      }
      if (loaded.subscription) {
        await reconcileSubscriptionMembership(
          tx,
          subscriptionContext(accountId, loaded.view, loaded.subscription),
          loaded.subscription.notifyOnLeave,
          loaded.view,
          new Date(),
        );
      }
      return loaded.view;
    });
  }

  return {
    getView,
    async create(accountId: string, input: CreateSmartCollectionInput) {
      const [anchorProject] = await database
        .select({ id: project.id, workspaceId: project.workspaceId })
        .from(project)
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(project.id, input.projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      if (!anchorProject) {
        throw new SmartCollectionUnavailableError();
      }

      const scopeProjectIds =
        input.sourceType === "Wiki Document"
          ? []
          : [...new Set(input.scope?.projectIds ?? [input.projectId])].sort();
      if (
        input.sourceType !== "Wiki Document" &&
        (!scopeProjectIds.includes(input.projectId) ||
          scopeProjectIds.length === 0)
      ) {
        throw new SmartCollectionUnavailableError();
      }
      if (scopeProjectIds.length > 0) {
        const ownedScopeProjects = await database
          .select({ id: project.id, workspaceId: project.workspaceId })
          .from(project)
          .innerJoin(workspace, eq(project.workspaceId, workspace.id))
          .where(
            and(
              inArray(project.id, scopeProjectIds),
              eq(workspace.ownerAccountId, accountId),
            ),
          );
        if (
          ownedScopeProjects.length !== scopeProjectIds.length ||
          ownedScopeProjects.some(
            ({ workspaceId }) => workspaceId !== anchorProject.workspaceId,
          )
        ) {
          throw new SmartCollectionUnavailableError();
        }
      }

      const collectionId = input.clientIdempotencyKey;
      const viewId = `${collectionId}:default`;
      const { conditions } = input;
      const scope = { projectIds: scopeProjectIds };
      await database.transaction(async (tx) => {
        const [created] = await tx
          .insert(smartCollection)
          .values({
            id: collectionId,
            projectId: input.projectId,
            name: input.name,
            sourceType: input.sourceType,
            scope,
            conditions,
          })
          .onConflictDoNothing()
          .returning({ id: smartCollection.id });
        if (!created) {
          const [existing] = await tx
            .select()
            .from(smartCollection)
            .where(eq(smartCollection.id, collectionId))
            .limit(1);
          const [existingView] = await tx
            .select()
            .from(smartCollectionView)
            .where(eq(smartCollectionView.id, viewId))
            .limit(1);
          const existingScope = existing
            ? {
                projectIds: getStoredProjectIds(
                  existing.sourceType as SmartCollectionSourceType,
                  existing.scope,
                  existing.projectId,
                ),
              }
            : undefined;
          if (
            existing?.projectId !== input.projectId ||
            existing.name !== input.name ||
            existing.sourceType !== input.sourceType ||
            !sameJson(existingScope, scope) ||
            !sameJson(existing.conditions, conditions) ||
            existingView?.name !== input.viewName ||
            existingView.presentation !== input.presentation
          ) {
            throw new SmartCollectionConflictError();
          }
          return;
        }
        await tx.insert(smartCollectionView).values({
          id: viewId,
          collectionId,
          name: input.viewName,
          presentation: input.presentation,
        });
      });
      const result = await getView(accountId, viewId);
      if (!result) {
        throw new SmartCollectionUnavailableError();
      }
      return result;
    },
    setSubscription(accountId, input) {
      return database.transaction(async (tx) => {
        const loaded = await loadSmartCollectionView(
          tx,
          accountId,
          input.viewId,
        );
        if (!loaded) {
          throw new SmartCollectionUnavailableError();
        }

        const { view } = loaded;
        if (!input.subscribe) {
          if (loaded.subscription) {
            await reconcileSubscriptionMembership(
              tx,
              subscriptionContext(accountId, view, loaded.subscription),
              loaded.subscription.notifyOnLeave,
              view,
              new Date(),
            );
            await tx
              .delete(smartCollectionSubscription)
              .where(
                and(
                  eq(
                    smartCollectionSubscription.collectionId,
                    view.collectionId,
                  ),
                  eq(smartCollectionSubscription.accountId, accountId),
                ),
              );
          }
          return { ...view, isSubscribed: false, notifyOnLeave: false };
        }

        const now = new Date();
        if (loaded.subscription) {
          await reconcileSubscriptionMembership(
            tx,
            subscriptionContext(accountId, view, loaded.subscription),
            loaded.subscription.notifyOnLeave,
            view,
            now,
          );
          if (loaded.subscription.notifyOnLeave !== input.notifyOnLeave) {
            await tx
              .update(smartCollectionSubscription)
              .set({ notifyOnLeave: input.notifyOnLeave })
              .where(
                and(
                  eq(
                    smartCollectionSubscription.collectionId,
                    view.collectionId,
                  ),
                  eq(smartCollectionSubscription.accountId, accountId),
                ),
              );
          }
          return {
            ...view,
            isSubscribed: true,
            notifyOnLeave: input.notifyOnLeave,
          };
        }

        const subscriptionId = crypto.randomUUID();
        await tx.insert(smartCollectionSubscription).values({
          accountId,
          collectionId: view.collectionId,
          id: subscriptionId,
          notifyOnLeave: input.notifyOnLeave,
        });
        await startSubscriptionMembershipBaseline(
          tx,
          subscriptionId,
          view,
          now,
        );
        return {
          ...view,
          isSubscribed: true,
          notifyOnLeave: input.notifyOnLeave,
        };
      });
    },
    async listViews(accountId, projectId) {
      const [targetProject] = await database
        .select({ workspaceId: project.workspaceId })
        .from(project)
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(project.id, projectId),
            eq(workspace.ownerAccountId, accountId),
          ),
        )
        .limit(1);
      if (!targetProject) {
        return [];
      }
      const rows = await database
        .select({ id: smartCollectionView.id })
        .from(smartCollectionView)
        .innerJoin(
          smartCollection,
          eq(smartCollectionView.collectionId, smartCollection.id),
        )
        .innerJoin(project, eq(smartCollection.projectId, project.id))
        .innerJoin(workspace, eq(project.workspaceId, workspace.id))
        .where(
          and(
            eq(workspace.ownerAccountId, accountId),
            or(
              eq(smartCollection.projectId, projectId),
              sql`${smartCollection.scope} @> ${JSON.stringify({ projectIds: [projectId] })}::jsonb`,
              and(
                eq(smartCollection.sourceType, "Wiki Document"),
                eq(project.workspaceId, targetProject.workspaceId),
              ),
            ),
          ),
        );
      const views = (
        await Promise.all(rows.map(({ id }) => getView(accountId, id)))
      ).filter((value): value is SmartCollectionViewSource => value !== null);
      const prepared = await preparedLongStatusView(
        database,
        accountId,
        projectId,
      );
      return prepared ? [prepared, ...views] : views;
    },
  };
}

export async function sweepSmartCollectionSubscriptionSignals(
  database: Database,
  now = new Date(),
) {
  const subscriptions = await database
    .select({
      accountId: smartCollectionSubscription.accountId,
      collectionId: smartCollectionSubscription.collectionId,
    })
    .from(smartCollectionSubscription)
    .orderBy(asc(smartCollectionSubscription.collectionId));
  let processedCount = 0;

  for (const candidate of subscriptions) {
    // biome-ignore lint/performance/noAwaitInLoops: Bound shared database load and isolate each subscription's atomic reconciliation.
    const processed = await database.transaction(async (tx) => {
      const [view] = await tx
        .select({ id: smartCollectionView.id })
        .from(smartCollectionView)
        .where(eq(smartCollectionView.collectionId, candidate.collectionId))
        .orderBy(asc(smartCollectionView.id))
        .limit(1);
      if (!view) {
        return false;
      }

      const loaded = await loadSmartCollectionView(
        tx,
        candidate.accountId,
        view.id,
      );
      if (!loaded?.subscription) {
        return false;
      }
      await reconcileSubscriptionMembership(
        tx,
        subscriptionContext(
          candidate.accountId,
          loaded.view,
          loaded.subscription,
        ),
        loaded.subscription.notifyOnLeave,
        loaded.view,
        now,
      );
      return true;
    });
    if (processed) {
      processedCount += 1;
    }
  }

  return processedCount;
}
