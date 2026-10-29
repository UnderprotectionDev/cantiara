import { createHash } from "node:crypto";
import {
  type BuildInPublicChange,
  type BuildInPublicDiffRow,
  type BuildInPublicField,
  type BuildInPublicItem,
  type BuildInPublicMemberKind,
  type BuildInPublicSnapshotMember,
  type BuildInPublicSnapshotWall,
  memberItemId,
  WALL_PART_KINDS,
  type WallPartKind,
  wallPartItemId,
} from "@cantiara/api/build-in-public";

/** A Project Wall as the owners read it: private ids, absolute positions, raw structure. */
export interface BuildInPublicSourceWall {
  cards: {
    color: string | null;
    groupId: string | null;
    id: string;
    title: string;
    x: number;
    y: number;
  }[];
  /** Exact Dosya Eki versions placed on the wall, with their crop, rotate and markup text. */
  files: {
    attachmentId: string;
    cardId: string | null;
    markup: string | null;
    name: string;
    version: number;
  }[];
  focusOrder: string[];
  groups: { id: string; title: string }[];
  lines: { fromCardId: string; id: string; label: string; toCardId: string }[];
  /** Live collection blocks; the seam freezes them, it never keeps them live. */
  liveBlocks: {
    id: string;
    records: { fields: BuildInPublicField[]; title: string }[];
    sourceLabel: string;
  }[];
  narrative: string | null;
}

/** Belge, tasarım, Karar, Proje Sürümü or Proje Duvarı of the Project. */
export interface BuildInPublicSourceMember {
  /** Changelog date (YYYY-MM-DD) of a Proje Sürümü or Karar. */
  date: string | null;
  fields: BuildInPublicField[];
  kind: BuildInPublicMemberKind;
  recordId: string;
  title: string;
  wall: BuildInPublicSourceWall | null;
}

export interface MemberItemSet {
  items: BuildInPublicItem[];
  /** Text of each item the placeholder reader scans. */
  scans: {
    fields: BuildInPublicField[];
    itemId: string;
    recordId: string;
    recordTitle: string;
  }[];
}

function baseItem(
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
    memberKind: null,
    parentId: null,
    publicStatusLabel: null,
    wallPart: null,
    workId: null,
    ...item,
  };
}

/**
 * A one-way digest of a part's readable fields. Shared parts (layout, focus
 * order, colors) name every card of the source Wall, so the readable fields
 * must never be stored in the snapshot. The live block's freeze date is
 * presentation, not content: it never makes a part re-sign.
 */
function signatureOf(fields: BuildInPublicField[]) {
  const content = fields.filter((field) => field.name !== "Frozen on");
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}

function partChange(
  approvedWall: BuildInPublicSnapshotWall | undefined,
  itemId: string,
  fields: BuildInPublicField[],
): Pick<BuildInPublicItem, "change" | "diff"> {
  const before = approvedWall?.partSignatures[itemId];
  if (before === undefined) {
    return { change: "New", diff: [] };
  }
  const now = signatureOf(fields);
  return before === now
    ? { change: "Unchanged", diff: [] }
    : {
        change: "Unpublished changes",
        diff: [
          {
            approved: "Approved version",
            field: "Content",
            proposed: "Changed in the source",
          },
        ],
      };
}

function rank(values: number[]) {
  const order = [...new Set(values)].sort((a, b) => a - b);
  return (value: number) => order.indexOf(value);
}

function wallParts(
  member: BuildInPublicSourceMember,
  wall: BuildInPublicSourceWall,
  parent: BuildInPublicItem,
  approvedWall: BuildInPublicSnapshotWall | undefined,
  frozenOn: string,
): BuildInPublicItem[] {
  const title = new Map(wall.cards.map((card) => [card.id, card.title]));
  const part = (
    kind: WallPartKind,
    partId: string,
    label: string,
    fields: BuildInPublicField[],
    extra: Partial<BuildInPublicItem> = {},
  ): BuildInPublicItem => {
    const id = wallPartItemId(member.recordId, kind, partId);
    return baseItem({
      ...partChange(approvedWall, id, fields),
      fields,
      id,
      kind: "Wall part",
      parentId: parent.id,
      title: `${kind}: ${label}`,
      wallPart: kind,
      ...extra,
    });
  };
  const columnOf = rank(wall.cards.map((card) => card.x));
  const rowOf = rank(wall.cards.map((card) => card.y));
  const parts: BuildInPublicItem[] = [];

  for (const card of wall.cards) {
    parts.push(
      part("Card", card.id, card.title, [{ name: "Title", value: card.title }]),
    );
  }
  if (wall.cards.length > 0) {
    parts.push(
      part(
        "Layout",
        "all",
        "positions",
        wall.cards.map((card) => ({
          name: card.title,
          value: `column ${columnOf(card.x) + 1}, row ${rowOf(card.y) + 1}`,
        })),
      ),
    );
  }
  for (const group of wall.groups) {
    parts.push(
      part("Group", group.id, group.title, [
        { name: "Title", value: group.title },
      ]),
    );
  }
  if (wall.narrative) {
    parts.push(
      part("View text", "narrative", "Wall narrative", [
        { name: "Text", value: wall.narrative },
      ]),
    );
  }
  for (const line of wall.lines) {
    parts.push(
      part("Visual line", line.id, line.label, [
        { name: "From", value: title.get(line.fromCardId) ?? "" },
        { name: "To", value: title.get(line.toCardId) ?? "" },
        { name: "Label", value: line.label },
      ]),
    );
  }
  if (wall.focusOrder.length > 0) {
    parts.push(
      part(
        "Focus order",
        "all",
        "presentation order",
        wall.focusOrder.map((cardId, index) => ({
          name: `Step ${index + 1}`,
          value: title.get(cardId) ?? "",
        })),
      ),
    );
  }
  const colored = wall.cards.filter((card) => card.color);
  if (colored.length > 0) {
    parts.push(
      part(
        "Color",
        "all",
        "card colors",
        colored.map((card) => ({ name: card.title, value: card.color ?? "" })),
      ),
    );
  }
  for (const file of wall.files) {
    const key = `${file.attachmentId}:${file.version}`;
    const fields = [
      { name: "File", value: `${file.name} (version ${file.version})` },
    ];
    parts.push(
      part("File version", key, file.name, fields, {
        files: [
          {
            attachmentId: file.attachmentId,
            name: file.name,
            version: file.version,
          },
        ],
      }),
    );
    if (file.markup) {
      parts.push(
        part("Crop, rotate and markup", key, file.name, [
          { name: "Markup", value: file.markup },
        ]),
      );
    }
  }
  for (const block of wall.liveBlocks) {
    parts.push(
      part(
        "Live collection block",
        block.id,
        block.sourceLabel,
        [
          { name: "Source", value: block.sourceLabel },
          { name: "Frozen on", value: frozenOn },
          ...block.records.flatMap((record) => [
            { name: "Record", value: record.title },
            ...record.fields,
          ]),
        ],
        {
          title: `Live collection block: ${block.sourceLabel} (snapshot of ${frozenOn}, read-only)`,
        },
      ),
    );
  }
  return parts;
}

/** Which Wall part kinds the last approved revision holds that the source no longer has. */
function removedWallPartKinds(
  member: BuildInPublicSourceMember,
  parts: BuildInPublicItem[],
  approvedWall: BuildInPublicSnapshotWall | undefined,
): WallPartKind[] {
  if (!approvedWall) {
    return [];
  }
  const live = new Set(parts.map((part) => part.id));
  const kinds = new Set<WallPartKind>();
  for (const id of Object.keys(approvedWall.partSignatures)) {
    if (live.has(id)) {
      continue;
    }
    // The stale id names its own kind, so a deleted card, line, group or file
    // still surfaces without reintroducing its readable content.
    const kind = WALL_PART_KINDS.find((name) =>
      id.startsWith(`wall:${member.recordId}:${name}:`),
    );
    if (kind) {
      kinds.add(kind);
    }
  }
  return [...kinds];
}

/** Root approval item of every Project member, with its Wall parts as separate dependents. */
export function memberItemSet(
  member: BuildInPublicSourceMember,
  approved: BuildInPublicSnapshotMember | undefined,
  frozenOn: string,
): MemberItemSet {
  const before = new Map(
    (approved?.fields ?? []).map((field) => [field.name, field.value]),
  );
  const rows = [
    ["Title", approved?.title ?? null, member.title] as const,
    ...member.fields.map(
      (field) =>
        [field.name, before.get(field.name) ?? null, field.value] as const,
    ),
  ].filter(([, was, now]) => was !== now);
  let change: BuildInPublicChange = "New";
  if (approved) {
    change = rows.length > 0 ? "Unpublished changes" : "Unchanged";
  }
  const root = baseItem({
    change,
    diff: approved
      ? rows.map(([field, was, now]) => ({
          approved: was,
          field,
          proposed: now,
        }))
      : [],
    fields: [{ name: "Title", value: member.title }, ...member.fields],
    id: memberItemId(member.recordId),
    kind: "Project member",
    memberKind: member.kind,
    title: `${member.kind}: ${member.title}`,
  });
  const parts = member.wall
    ? wallParts(member, member.wall, root, approved?.wall, frozenOn)
    : [];
  // A part that was approved in the last revision but whose source item no
  // longer exists (e.g. a deleted card) has no item of its own anymore, so the
  // removal would drop out of the snapshot silently. It thus shows on the
  // member as `Unpublished changes` and needs an explicit approval.
  const removals = removedWallPartKinds(member, parts, approved?.wall);
  if (removals.length > 0) {
    root.change = "Unpublished changes";
    root.diff = [
      ...root.diff,
      ...removals.map(
        (field): BuildInPublicDiffRow => ({
          approved: "Approved",
          field,
          proposed: "Removed in the source",
        }),
      ),
    ];
  }
  const items = [root, ...parts];
  return {
    items,
    scans: items.map((item) => ({
      fields: item.fields,
      itemId: item.id,
      recordId: member.recordId,
      recordTitle: member.title,
    })),
  };
}

function opaque(prefix: string, taken: Set<string>, counter: { n: number }) {
  do {
    counter.n += 1;
  } while (taken.has(`${prefix}-${counter.n}`));
  taken.add(`${prefix}-${counter.n}`);
  return `${prefix}-${counter.n}`;
}

function snapshotWall(
  member: BuildInPublicSourceMember,
  wall: BuildInPublicSourceWall,
  leaving: ReadonlySet<string>,
  items: Map<string, BuildInPublicItem>,
  frozenOn: string,
): BuildInPublicSnapshotWall {
  const approvedPart = (kind: WallPartKind, partId: string) =>
    leaving.has(wallPartItemId(member.recordId, kind, partId));
  const cards = wall.cards.filter((card) => approvedPart("Card", card.id));
  const cardIds = new Map(
    cards.map((card, index) => [card.id, `card-${index + 1}`]),
  );
  // Ranks over the approved cards only, so a gap never hints at a private card.
  const columnOf = rank(cards.map((card) => card.x));
  const rowOf = rank(cards.map((card) => card.y));
  const layout = approvedPart("Layout", "all");
  const groups = wall.groups
    .filter(
      (group) =>
        approvedPart("Group", group.id) &&
        cards.some((card) => card.groupId === group.id),
    )
    .map((group, index) => ({ groupId: `group-${index + 1}`, source: group }));
  const groupIds = new Map(groups.map((g) => [g.source.id, g.groupId]));
  const colorOk = approvedPart("Color", "all");
  const signatures: Record<string, string> = {};
  for (const [id, item] of items) {
    if (leaving.has(id) && item.wallPart) {
      signatures[id] = signatureOf(item.fields);
    }
  }
  const files = wall.files.filter((file) =>
    approvedPart("File version", `${file.attachmentId}:${file.version}`),
  );
  const blockCounter = { n: 0 };
  return {
    cards: cards.map((card) => ({
      cardId: cardIds.get(card.id) ?? "",
      color: colorOk ? card.color : null,
      column: layout ? columnOf(card.x) : 0,
      groupId: card.groupId ? (groupIds.get(card.groupId) ?? null) : null,
      row: layout ? rowOf(card.y) : 0,
      title: card.title,
    })),
    files: files.map((file) => ({
      attachmentId: file.attachmentId,
      cardId: file.cardId ? (cardIds.get(file.cardId) ?? null) : null,
      markup:
        file.markup &&
        approvedPart(
          "Crop, rotate and markup",
          `${file.attachmentId}:${file.version}`,
        )
          ? file.markup
          : null,
      name: file.name,
      version: file.version,
    })),
    focusOrder: approvedPart("Focus order", "all")
      ? wall.focusOrder.flatMap((id) => cardIds.get(id) ?? [])
      : [],
    groups: groups.map((g) => ({ groupId: g.groupId, title: g.source.title })),
    lines: wall.lines
      .filter(
        (line) =>
          approvedPart("Visual line", line.id) &&
          cardIds.has(line.fromCardId) &&
          cardIds.has(line.toCardId),
      )
      .map((line) => ({
        fromCardId: cardIds.get(line.fromCardId) ?? "",
        label: line.label,
        toCardId: cardIds.get(line.toCardId) ?? "",
      })),
    liveBlocks: wall.liveBlocks
      .filter((block) => approvedPart("Live collection block", block.id))
      .map((block) => ({
        blockId: opaque("block", new Set(), blockCounter),
        frozenOn,
        records: block.records,
        sourceLabel: block.sourceLabel,
      })),
    narrative: approvedPart("View text", "narrative") ? wall.narrative : null,
    partSignatures: signatures,
  };
}

/** Approved Project members of one revision; a part leaves only with its approved member. */
export function snapshotMembers(input: {
  frozenOn: string;
  items: BuildInPublicItem[];
  leaving: ReadonlySet<string>;
  previous: BuildInPublicSnapshotMember[];
  sources: BuildInPublicSourceMember[];
}): BuildInPublicSnapshotMember[] {
  const known = new Map(
    input.previous.map((entry) => [entry.sourceRecordId, entry.memberId]),
  );
  const taken = new Set(known.values());
  const counter = { n: 0 };
  const byId = new Map(input.items.map((item) => [item.id, item]));
  return input.sources
    .filter((source) => input.leaving.has(memberItemId(source.recordId)))
    .map((source) => ({
      date: source.date,
      fields: source.fields,
      kind: source.kind,
      memberId: known.get(source.recordId) ?? opaque("member", taken, counter),
      sourceRecordId: source.recordId,
      title: source.title,
      ...(source.wall
        ? {
            wall: snapshotWall(
              source,
              source.wall,
              input.leaving,
              byId,
              input.frozenOn,
            ),
          }
        : {}),
    }));
}
