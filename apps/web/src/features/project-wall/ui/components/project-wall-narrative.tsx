// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed link.
import type {
  ProjectWallCardView,
  ProjectWallRelationPreview,
  ProjectWallView,
} from "@cantiara/api/project-wall";
import {
  isAllowedRelationEndpoints,
  RELATION_KIND_OPTIONS,
  type RelationKind,
} from "@cantiara/api/relations";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useState } from "react";
import { cardName } from "../../lib/project-wall-narrative-labels";
import CreateGroupForm from "../forms/create-group-form";
import DrawLinkForm from "../forms/draw-link-form";
import type { ProjectWallSceneWall } from "./project-wall-scene";

/** Wall narrative actions: none of them edits a source record. `onX`
 * actions resolve `true` only when the write persisted. */
export interface ProjectWallNarrativeActions {
  onCreateGroup: (title: string) => Promise<boolean>;
  /** Writes the catalog relation; reached only from the previewed confirm. */
  onCreateRelation: (input: {
    baseRevision: number;
    kind: RelationKind;
    linkId: string;
    previewId: string;
  }) => Promise<boolean>;
  onDeleteGroup: (groupId: string) => Promise<boolean>;
  onDrawLink: (input: {
    fromCardId: string;
    label: string;
    toCardId: string;
  }) => Promise<boolean>;
  /** Previews the catalog relation of a Visual link; writes nothing. */
  onPreviewRelation: (input: {
    kind: RelationKind;
    linkId: string;
  }) => Promise<ProjectWallRelationPreview | undefined>;
  onToggleGroup: (groupId: string, collapsed: boolean) => Promise<unknown>;
  onUnbindLink: (linkId: string) => Promise<boolean>;
}

function RelationPreviewPanel({
  onCancel,
  onConfirm,
  preview,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  preview: ProjectWallRelationPreview;
}) {
  const { relation } = preview;
  return (
    <section
      aria-label="Persistent relation preview"
      className="space-y-2 rounded-md border p-3 text-sm"
    >
      <p>
        This writes a persistent <strong>{relation.label}</strong> relation:{" "}
        {relation.source.title ?? relation.source.recordId} (
        {relation.source.recordType}) →{" "}
        {relation.target.title ?? relation.target.recordId} (
        {relation.target.recordType}). The Visual link stays wall narrative.
      </p>
      <div className="flex gap-2">
        <Button onClick={onConfirm} size="sm" type="button">
          Confirm Create Persistent Relation
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

function LinkRow({
  actions,
  cards,
  link,
}: {
  actions: ProjectWallNarrativeActions;
  cards: ProjectWallCardView[];
  link: ProjectWallView["links"][number];
}) {
  const from = cards.find((card) => card.id === link.fromCardId);
  const to = cards.find((card) => card.id === link.toCardId);
  // A Smart Collection block summarizes records and is not a relation endpoint.
  const kinds = RELATION_KIND_OPTIONS.filter(
    (option) =>
      from !== undefined &&
      to !== undefined &&
      from.sourceType !== "Smart Collection" &&
      to.sourceType !== "Smart Collection" &&
      isAllowedRelationEndpoints(option, from.sourceType, to.sourceType),
  );
  const [kind, setKind] = useState<RelationKind>(kinds[0] ?? "Related");
  const [preview, setPreview] = useState<ProjectWallRelationPreview | null>(
    null,
  );

  async function requestPreview() {
    setPreview(
      (await actions.onPreviewRelation({ kind, linkId: link.id })) ?? null,
    );
  }
  async function confirm() {
    if (!preview) {
      return;
    }
    await actions.onCreateRelation({
      baseRevision: preview.relation.baseRevision,
      kind,
      linkId: link.id,
      previewId: preview.relation.previewId,
    });
    setPreview(null);
  }

  return (
    <li className="space-y-2 rounded-md border p-2 text-sm">
      <p>
        <span className="text-muted-foreground">From</span> {cardName(from)}{" "}
        <span className="text-muted-foreground">To</span> {cardName(to)}:{" "}
        <em>{link.label}</em>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Relation kind"
          onChange={(event) => {
            setKind(event.target.value as RelationKind);
            setPreview(null);
          }}
          value={kind}
        >
          {kinds.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          disabled={kinds.length === 0}
          onClick={requestPreview}
          size="sm"
          type="button"
          variant="outline"
        >
          Create Persistent Relation
        </Button>
        <Button
          onClick={() => actions.onUnbindLink(link.id)}
          size="sm"
          type="button"
          variant="outline"
        >
          Unbind
        </Button>
      </div>
      {preview ? (
        <RelationPreviewPanel
          onCancel={() => setPreview(null)}
          onConfirm={confirm}
          preview={preview}
        />
      ) : null}
    </li>
  );
}

function GroupsPanel({
  actions,
  wall,
}: {
  actions: ProjectWallNarrativeActions;
  /** The wall the account sees; its group collapse is this account's view. */
  wall: ProjectWallSceneWall;
}) {
  return (
    <div className="space-y-2">
      <CreateGroupForm onCreateGroup={actions.onCreateGroup} />
      {wall.groups.length > 0 ? (
        <ul aria-label="Groups" className="flex flex-wrap gap-2 text-sm">
          {wall.groups.map((group) => {
            const members = wall.cards.filter(
              (card) => card.groupId === group.id,
            ).length;
            return (
              <li
                className="flex items-center gap-1 rounded-md border p-1"
                key={group.id}
              >
                <span>
                  {group.title} ({members})
                </span>
                <Button
                  aria-pressed={group.collapsed}
                  onClick={() =>
                    actions.onToggleGroup(group.id, !group.collapsed)
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {group.collapsed ? "Expand group" : "Collapse group"}
                </Button>
                <Button
                  onClick={() => actions.onDeleteGroup(group.id)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Delete group
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Wall narrative: Visual links, single-level groups. A line, a group and
 * proximity are never relations; only the previewed `Create Persistent
 * Relation` writes one.
 */
export function ProjectWallNarrativePanel({
  actions,
  wall,
}: {
  actions: ProjectWallNarrativeActions;
  /** The wall the account sees; the groups' collapse is this account's view. */
  wall: ProjectWallSceneWall;
}) {
  return (
    <section aria-label="Wall narrative" className="space-y-3">
      <GroupsPanel actions={actions} wall={wall} />
      <DrawLinkForm
        cards={wall.cards}
        key={wall.cards.map(({ id }) => id).join(",")}
        onDrawLink={actions.onDrawLink}
      />
      {wall.links.length > 0 ? (
        <ul aria-label="Visual links" className="space-y-2">
          {wall.links.map((link) => (
            <LinkRow
              actions={actions}
              cards={wall.cards}
              key={link.id}
              link={link}
            />
          ))}
        </ul>
      ) : null}
      <p className="text-muted-foreground text-xs">
        A Visual link, a group and card proximity are wall narrative, not record
        relations. Create Persistent Relation previews the relation before it
        writes.
      </p>
    </section>
  );
}
