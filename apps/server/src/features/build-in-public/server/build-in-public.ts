import {
  type ApprovedBuildInPublic,
  attachmentItemId,
  BUILD_IN_PUBLIC_NOTICE,
  type BuildInPublicAccess,
  type BuildInPublicChange,
  type BuildInPublicDiffRow,
  BuildInPublicError,
  type BuildInPublicField,
  type BuildInPublicItem,
  type BuildInPublicMapRow,
  type BuildInPublicMetadata,
  type BuildInPublicPlaceholderFinding,
  type BuildInPublicPreview,
  type BuildInPublicSettings,
  type BuildInPublicSnapshot,
  type BuildInPublicSnapshotWork,
  type BuildInPublicStatusKey,
  type BuildInPublicWorkCopy,
  DEFAULT_PUBLIC_STATUS_MAP,
  LABEL_REQUIRED_MESSAGE,
  METADATA_ITEM_ID,
  publicStatusKeyOf,
  RELEASED_LABEL,
  releasedItemId,
  resolvePublicLabel,
  unresolvedPlaceholders,
  workItemId,
  youtubeItemId,
} from "@cantiara/api/build-in-public";
import {
  fingerprintMutationPayload,
  type MutationPayload,
} from "@cantiara/api/mutation-and-undo";
import { youtubeOccurrences } from "@cantiara/api/wiki-publishing";

export interface BuildInPublicWorkFact {
  closureResult: string | null;
  /** Internal text; only full-line YouTube URLs are read from it, as separate embeds. */
  description: string | null;
  id: string;
  key: string;
  roadmapHorizon: string;
  status: string;
  title: string;
}

/** Read-only facts owned by Work, Roadmap, Project Release Planning and File Attachment. */
export interface BuildInPublicFacts {
  attachments: (
    accountId: string,
    workId: string,
  ) => Promise<{ id: string; name: string; version: number }[]>;
  /** The owned Project's workspace, or null for anything else. */
  project: (
    accountId: string,
    projectId: string,
  ) => Promise<{ workspaceId: string } | null>;
  /** Roadmap Works that belong to a published Proje Sürümü, with its name. */
  publishedReleaseMembership: (
    accountId: string,
    projectId: string,
  ) => Promise<{ releaseName: string; workId: string }[]>;
  /** Roadmap Works of the Project: a Work with a horizon, not trashed or archived. */
  roadmapWorks: (
    accountId: string,
    projectId: string,
  ) => Promise<BuildInPublicWorkFact[]>;
}

export interface BuildInPublicSettingRow {
  enabled: boolean;
  /** Overrides of the default map, keyed by internal status key. */
  statusMap: Record<string, string>;
}

export interface BuildInPublicLatest {
  revision: number;
  snapshot: BuildInPublicSnapshot;
  surfaceId: string;
}

export interface BuildInPublicStore {
  copies: (projectId: string) => Promise<BuildInPublicWorkCopy[]>;
  /** The Project's current Onaylı snapshot revizyonu, or null before the first approval. */
  latest: (projectId: string) => Promise<BuildInPublicLatest | null>;
  /**
   * Atomic: reuse the Project's Build in Public surface or create one, then
   * append the next immutable revision.
   */
  publish: (write: {
    projectId: string;
    snapshot: BuildInPublicSnapshot;
    workspaceId: string;
  }) => Promise<ApprovedBuildInPublic>;
  saveCopy: (write: {
    copy: BuildInPublicWorkCopy;
    projectId: string;
  }) => Promise<void>;
  saveSetting: (write: {
    projectId: string;
    setting: BuildInPublicSettingRow;
    workspaceId: string;
  }) => Promise<void>;
  setting: (projectId: string) => Promise<BuildInPublicSettingRow | null>;
}

export interface BuildInPublicOptions {
  facts: BuildInPublicFacts;
  now?: () => Date;
  store: BuildInPublicStore;
}

const EMPTY_SETTING: BuildInPublicSettingRow = {
  enabled: false,
  statusMap: {},
};

function mapSource(
  override: string | undefined,
  defaultLabel: string | null,
): BuildInPublicMapRow["source"] {
  if (override) {
    return "Project map";
  }
  return defaultLabel ? "Default map" : "Unmapped";
}

function mapRows(overrides: Record<string, string>): BuildInPublicMapRow[] {
  return (
    Object.keys(DEFAULT_PUBLIC_STATUS_MAP) as BuildInPublicStatusKey[]
  ).map((statusKey) => {
    const defaultLabel = DEFAULT_PUBLIC_STATUS_MAP[statusKey];
    const override = overrides[statusKey];
    return {
      defaultLabel,
      label: override ?? defaultLabel,
      source: mapSource(override, defaultLabel),
      statusKey,
    };
  });
}

function clean(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function changeOf(
  approved: unknown,
  rows: BuildInPublicDiffRow[],
): BuildInPublicChange {
  if (!approved) {
    return "New";
  }
  return rows.length > 0 ? "Unpublished changes" : "Unchanged";
}

type DiffPair = [
  field: string,
  approved: string | null,
  proposed: string | null,
];

/** Rows only exist against an approved value; a new item has nothing to diff. */
function diffAgainst(approved: unknown, pairs: DiffPair[]) {
  const rows: BuildInPublicDiffRow[] = approved
    ? pairs
        .filter(([, before, after]) => before !== after)
        .map(([field, before, after]) => ({
          approved: before,
          field,
          proposed: after,
        }))
    : [];
  return { change: changeOf(approved, rows), diff: rows };
}

function dependent(
  parent: BuildInPublicItem,
  item: Pick<BuildInPublicItem, "id" | "kind" | "title"> &
    Partial<BuildInPublicItem>,
): BuildInPublicItem {
  return {
    blocker: null,
    change: "New",
    diff: [],
    fields: [],
    files: [],
    internalStatus: null,
    labelSource: null,
    parentId: parent.id,
    publicStatusLabel: null,
    workId: parent.workId,
    ...item,
  };
}

function findingsIn(
  itemId: string,
  fields: BuildInPublicField[],
  sourceRecord: BuildInPublicPlaceholderFinding["sourceRecord"],
): BuildInPublicPlaceholderFinding[] {
  return fields.flatMap((field) =>
    unresolvedPlaceholders(field.value).map(({ context, name }) => ({
      context,
      field: field.name,
      itemId,
      name,
      sourceRecord,
    })),
  );
}

interface PreviewContext {
  approvedOf: Map<string, BuildInPublicSnapshotWork>;
  copyOf: Map<string, BuildInPublicWorkCopy>;
  projectMap: Record<string, string>;
  releaseOf: Map<string, string>;
}

function workItem(work: BuildInPublicWorkFact, context: PreviewContext) {
  const copy = context.copyOf.get(work.id);
  const statusKey = publicStatusKeyOf(work.status, work.closureResult);
  const resolved = resolvePublicLabel({
    chosenLabel: copy?.publicStatusLabel ?? null,
    projectMap: context.projectMap,
    statusKey,
  });
  const publicTitle = clean(copy?.publicTitle);
  const publicSummary = clean(copy?.publicSummary);
  const title = publicTitle ?? work.title;
  const approved = context.approvedOf.get(work.id);
  const fields: BuildInPublicField[] = [
    { name: publicTitle ? "Public title" : "Title", value: title },
    ...(publicSummary
      ? [{ name: "Public summary", value: publicSummary }]
      : []),
    { name: "Roadmap horizon", value: work.roadmapHorizon },
  ];
  const item: BuildInPublicItem = {
    blocker: resolved.label ? null : LABEL_REQUIRED_MESSAGE,
    ...diffAgainst(approved, [
      ["Title", approved?.title ?? null, title],
      ["Summary", approved?.summary ?? null, publicSummary],
      [
        "Public Status Label",
        approved?.publicStatusLabel ?? null,
        resolved.label,
      ],
      ["Roadmap horizon", approved?.horizon ?? null, work.roadmapHorizon],
    ]),
    fields,
    files: [],
    id: workItemId(work.id),
    internalStatus: statusKey,
    kind: "Roadmap Work",
    labelSource: resolved.source,
    parentId: null,
    publicStatusLabel: resolved.label,
    title: `${work.key} · ${title}`,
    workId: work.id,
  };
  return { approved, item, label: resolved.label };
}

function releasedItem(
  parent: BuildInPublicItem,
  approved: BuildInPublicSnapshotWork | undefined,
  releaseName: string,
) {
  return dependent(parent, {
    ...diffAgainst(approved, [
      [
        "Public Status Label",
        approved?.publicStatusLabel ?? null,
        RELEASED_LABEL,
      ],
    ]),
    fields: [{ name: "Public Status Label", value: RELEASED_LABEL }],
    id: releasedItemId(parent.workId ?? ""),
    kind: "Released label",
    publicStatusLabel: RELEASED_LABEL,
    title: `Suggested: ${RELEASED_LABEL} (in ${releaseName})`,
  });
}

function attachmentItem(
  parent: BuildInPublicItem,
  approved: BuildInPublicSnapshotWork | undefined,
  file: { id: string; name: string; version: number },
) {
  const before = approved?.files.find(
    (entry) => entry.attachmentId === file.id,
  );
  return dependent(parent, {
    ...diffAgainst(before, [
      [
        "File version",
        before ? String(before.version) : null,
        String(file.version),
      ],
    ]),
    files: [{ attachmentId: file.id, name: file.name, version: file.version }],
    id: attachmentItemId(parent.workId ?? "", file.id),
    kind: "File Attachment",
    title: file.name,
  });
}

function youtubeItem(
  parent: BuildInPublicItem,
  approved: BuildInPublicSnapshotWork | undefined,
  occurrence: { id: string; url: string },
) {
  const known = approved?.embeds.some((entry) => entry.url === occurrence.url);
  return dependent(parent, {
    change: known ? "Unchanged" : "New",
    fields: [{ name: "URL", value: occurrence.url }],
    id: youtubeItemId(parent.workId ?? "", occurrence.id),
    kind: "YouTube video",
    title: occurrence.url,
  });
}

function metadataItem(
  metadata: BuildInPublicMetadata,
  before: BuildInPublicMetadata | undefined,
): BuildInPublicItem {
  return {
    blocker: null,
    ...diffAgainst(before, [
      ["Publication title", before?.title ?? null, metadata.title],
      ["Publication summary", before?.summary ?? null, metadata.summary],
    ]),
    fields: [
      ...(metadata.title
        ? [{ name: "Publication title", value: metadata.title }]
        : []),
      ...(metadata.summary
        ? [{ name: "Publication summary", value: metadata.summary }]
        : []),
    ],
    files: [],
    id: METADATA_ITEM_ID,
    internalStatus: null,
    kind: "Metadata",
    labelSource: null,
    parentId: null,
    publicStatusLabel: null,
    title: "Publication metadata",
    workId: null,
  };
}

/** Which items would leave: ticked Roadmap Works, their ticked dependents, ticked metadata. */
function leavingItemIds(
  preview: BuildInPublicPreview,
  ticked: ReadonlySet<string>,
) {
  const ids = new Set<string>();
  for (const item of preview.items) {
    if (item.kind === "Roadmap Work" && ticked.has(item.id)) {
      ids.add(item.id);
    }
  }
  for (const item of preview.items) {
    // Closed world: a dependent item leaves only with its approved Work.
    if (item.parentId && ids.has(item.parentId) && ticked.has(item.id)) {
      ids.add(item.id);
    }
    if (item.kind === "Metadata" && ticked.has(item.id)) {
      ids.add(item.id);
    }
  }
  return ids;
}

function snapshotWorks(
  preview: BuildInPublicPreview,
  leaving: ReadonlySet<string>,
  works: BuildInPublicWorkFact[],
  previous: BuildInPublicSnapshot | undefined,
) {
  const known = new Map(
    (previous?.roadmap ?? []).map((entry) => [
      entry.sourceWorkId,
      entry.memberId,
    ]),
  );
  const used = new Set(known.values());
  let counter = 0;
  const nextMemberId = () => {
    counter += 1;
    while (used.has(`work-${counter}`)) {
      counter += 1;
    }
    used.add(`work-${counter}`);
    return `work-${counter}`;
  };
  const horizonOf = new Map(
    works.map((work) => [work.id, work.roadmapHorizon]),
  );

  return preview.items
    .filter((item) => item.kind === "Roadmap Work" && leaving.has(item.id))
    .map((item): BuildInPublicSnapshotWork => {
      const workId = item.workId ?? "";
      const memberId = known.get(workId) ?? nextMemberId();
      const fieldOf = (name: string) =>
        item.fields.find((field) => field.name === name)?.value ?? null;
      const parts = preview.items.filter(
        (entry) => entry.parentId === item.id && leaving.has(entry.id),
      );
      return {
        embeds: parts
          .filter((entry) => entry.kind === "YouTube video")
          .map((entry, index) => ({
            kind: "YouTube video",
            memberId: `${memberId}-video-${index + 1}`,
            url: entry.title,
          })),
        files: parts.flatMap((entry) =>
          entry.kind === "File Attachment" ? entry.files : [],
        ),
        horizon: horizonOf.get(workId) ?? "",
        memberId,
        publicStatusLabel: leaving.has(releasedItemId(workId))
          ? RELEASED_LABEL
          : (item.publicStatusLabel ?? ""),
        sourceWorkId: workId,
        summary: fieldOf("Public summary"),
        title: fieldOf("Public title") ?? fieldOf("Title") ?? "",
      };
    });
}

function assertApprovable(
  preview: BuildInPublicPreview,
  leaving: ReadonlySet<string>,
  publishAnyway: boolean,
) {
  if (leaving.size === 0) {
    throw new BuildInPublicError("BUILD_IN_PUBLIC_NOTHING_APPROVED");
  }
  const unlabeled = preview.items.some(
    (item) =>
      item.kind === "Roadmap Work" &&
      leaving.has(item.id) &&
      !item.publicStatusLabel &&
      !leaving.has(releasedItemId(item.workId ?? "")),
  );
  if (unlabeled) {
    throw new BuildInPublicError("BUILD_IN_PUBLIC_LABEL_REQUIRED");
  }
  const unresolved = preview.placeholders.some((finding) =>
    leaving.has(finding.itemId),
  );
  if (unresolved && !publishAnyway) {
    throw new BuildInPublicError("BUILD_IN_PUBLIC_PLACEHOLDERS_UNRESOLVED");
  }
}

export function createBuildInPublic(
  options: BuildInPublicOptions,
): BuildInPublicAccess {
  const { facts, store } = options;
  const now = options.now ?? (() => new Date());

  async function settingsOf(projectId: string): Promise<BuildInPublicSettings> {
    const [setting, latest] = await Promise.all([
      store.setting(projectId),
      store.latest(projectId),
    ]);
    return {
      enabled: (setting ?? EMPTY_SETTING).enabled,
      projectId,
      revision: latest?.revision ?? null,
      statusMap: mapRows((setting ?? EMPTY_SETTING).statusMap),
    };
  }

  async function workItems(
    accountId: string,
    works: BuildInPublicWorkFact[],
    context: PreviewContext,
  ) {
    const items: BuildInPublicItem[] = [];
    const placeholders: BuildInPublicPlaceholderFinding[] = [];
    for (const work of works) {
      const { approved, item } = workItem(work, context);
      items.push(item);
      placeholders.push(
        ...findingsIn(
          item.id,
          item.fields.filter((field) => field.name !== "Roadmap horizon"),
          { id: work.id, title: work.title, type: "Work" },
        ),
      );
      const releaseName = context.releaseOf.get(work.id);
      if (releaseName && item.publicStatusLabel !== RELEASED_LABEL) {
        items.push(releasedItem(item, approved, releaseName));
      }
      // biome-ignore lint/performance/noAwaitInLoops: items keep Roadmap order.
      const files = await facts.attachments(accountId, work.id);
      items.push(...files.map((file) => attachmentItem(item, approved, file)));
      items.push(
        ...youtubeOccurrences(work.description ?? "").map((occurrence) =>
          youtubeItem(item, approved, occurrence),
        ),
      );
    }
    return { items, placeholders };
  }

  async function build(
    accountId: string,
    projectId: string,
    proposed: { summary?: string | null; title?: string | null },
  ) {
    const project = await facts.project(accountId, projectId);
    if (!project) {
      return null;
    }
    const [setting, works, copies, latest, memberships] = await Promise.all([
      store.setting(projectId),
      facts.roadmapWorks(accountId, projectId),
      store.copies(projectId),
      store.latest(projectId),
      facts.publishedReleaseMembership(accountId, projectId),
    ]);
    const { items, placeholders } = await workItems(accountId, works, {
      approvedOf: new Map(
        (latest?.snapshot.roadmap ?? []).map((entry) => [
          entry.sourceWorkId,
          entry,
        ]),
      ),
      copyOf: new Map(copies.map((copy) => [copy.workId, copy])),
      projectMap: (setting ?? EMPTY_SETTING).statusMap,
      releaseOf: new Map(
        memberships.map((entry) => [entry.workId, entry.releaseName]),
      ),
    });

    const metadata: BuildInPublicMetadata = {
      summary: clean(proposed.summary),
      title: clean(proposed.title),
    };
    if (metadata.title || metadata.summary) {
      const item = metadataItem(metadata, latest?.snapshot.metadata);
      items.push(item);
      placeholders.push(
        ...findingsIn(item.id, item.fields, {
          id: projectId,
          title: "Publication metadata",
          type: "Project",
        }),
      );
    }

    const preview: BuildInPublicPreview = {
      fingerprint: await fingerprintMutationPayload({
        items,
        metadata,
        placeholders,
      } as unknown as MutationPayload),
      items,
      metadata,
      notice: BUILD_IN_PUBLIC_NOTICE,
      placeholders,
      projectId,
      written: false,
    };
    return { latest, preview, workspaceId: project.workspaceId, works };
  }

  async function saveSetting(
    accountId: string,
    projectId: string,
    change: (current: BuildInPublicSettingRow) => BuildInPublicSettingRow,
  ) {
    const project = await facts.project(accountId, projectId);
    if (!project) {
      return null;
    }
    // Only the publication settings are written; no Work status is touched.
    await store.saveSetting({
      projectId,
      setting: change((await store.setting(projectId)) ?? EMPTY_SETTING),
      workspaceId: project.workspaceId,
    });
    return settingsOf(projectId);
  }

  return {
    settings: async (accountId, projectId) =>
      (await facts.project(accountId, projectId))
        ? settingsOf(projectId)
        : null,

    setEnabled: (accountId, input) =>
      saveSetting(accountId, input.projectId, (current) => ({
        ...current,
        enabled: input.enabled,
      })),

    setStatusMap: (accountId, input) =>
      saveSetting(accountId, input.projectId, (current) => {
        const statusMap = { ...current.statusMap };
        if (input.label) {
          statusMap[input.statusKey] = input.label;
        } else {
          delete statusMap[input.statusKey];
        }
        return { ...current, statusMap };
      }),

    setWorkCopy: async (accountId, input) => {
      if (!(await facts.project(accountId, input.projectId))) {
        return null;
      }
      const works = await facts.roadmapWorks(accountId, input.projectId);
      if (!works.some((work) => work.id === input.workId)) {
        return null;
      }
      const copy: BuildInPublicWorkCopy = {
        publicStatusLabel: clean(input.publicStatusLabel),
        publicSummary: clean(input.publicSummary),
        publicTitle: clean(input.publicTitle),
        workId: input.workId,
      };
      // Only the publication fields are written; the internal Work is untouched.
      await store.saveCopy({ copy, projectId: input.projectId });
      return copy;
    },

    preview: async (accountId, input) =>
      (await build(accountId, input.projectId, input.metadata ?? {}))
        ?.preview ?? null,

    approve: async (accountId, input) => {
      const built = await build(
        accountId,
        input.projectId,
        input.approval.metadata ?? {},
      );
      if (!built) {
        return null;
      }
      const setting = (await store.setting(input.projectId)) ?? EMPTY_SETTING;
      if (!setting.enabled) {
        throw new BuildInPublicError("BUILD_IN_PUBLIC_DISABLED");
      }
      const { latest, preview, workspaceId, works } = built;
      if (preview.fingerprint !== input.approval.fingerprint) {
        throw new BuildInPublicError("BUILD_IN_PUBLIC_PREVIEW_STALE");
      }

      const leaving = leavingItemIds(
        preview,
        new Set(input.approval.approvedItemIds),
      );
      assertApprovable(preview, leaving, input.approval.publishAnyway);

      const approvedMetadata = preview.items.find(
        (item) => item.kind === "Metadata" && leaving.has(item.id),
      );
      const fieldOf = (name: string) =>
        approvedMetadata?.fields.find((field) => field.name === name)?.value ??
        null;
      const snapshot: BuildInPublicSnapshot = {
        approvedAt: now().toISOString(),
        kind: "Build in Public",
        metadata: approvedMetadata
          ? {
              summary: fieldOf("Publication summary"),
              title: fieldOf("Publication title"),
            }
          : (latest?.snapshot.metadata ?? { summary: null, title: null }),
        projectId: input.projectId,
        roadmap: snapshotWorks(preview, leaving, works, latest?.snapshot),
      };
      return store.publish({
        projectId: input.projectId,
        snapshot,
        workspaceId,
      });
    },
  };
}
