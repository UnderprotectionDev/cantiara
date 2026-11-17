// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed link.
import type { ProjectWallRelationPreview } from "@cantiara/api/project-wall";
import type { RelationKind } from "@cantiara/api/relations";
import { Button } from "@cantiara/ui/components/button";
import CreateGroupForm from "../forms/create-group-form";
import DrawLinkForm from "../forms/draw-link-form";
import { RelationLinkForm } from "../forms/relation-link-form";
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
            <RelationLinkForm
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
