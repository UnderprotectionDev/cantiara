// biome-ignore-all lint/performance/noJsxPropsBind: Card controls close over the displayed card id.
import {
  PROJECT_WALL_DENSITIES,
  PROJECT_WALL_HIGHLIGHTS,
  type ProjectWallCardPreview,
  type ProjectWallCardView,
  type ProjectWallDensity,
  type ProjectWallGroupView,
  type ProjectWallHighlight,
} from "@cantiara/api/project-wall";
import { PROJECT_WALL_PRESENTATION_LABELS } from "@cantiara/api/project-wall-presentation";
import { DIAGRAM_CARD_LABELS } from "@cantiara/api/technical-diagram-card";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";

/**
 * Limited accessible highlight palette. Each highlight pairs a border colour
 * with a text label, so colour is never the only signal.
 */
const HIGHLIGHT_BORDER: Record<ProjectWallHighlight, string> = {
  amber: "border-l-amber-600",
  blue: "border-l-blue-700",
  green: "border-l-green-700",
  red: "border-l-red-700",
  violet: "border-l-violet-700",
};

export interface ProjectWallCardActions {
  /** Diagram Versions per diagram id, offered by the pin control. */
  diagramVersions?: Record<
    string,
    Array<{ id: string; name: string; number: number }>
  >;
  onDensity: (cardId: string, density: ProjectWallDensity) => void;
  /** Pins a Technical Diagram card to one exact version; `null` is `Live`. */
  onDiagramPin?: (cardId: string, versionId: string | null) => void;
  onGroup: (cardId: string, groupId: string | null) => void;
  onHighlight: (cardId: string, highlight: ProjectWallHighlight | null) => void;
  onLock: (cardId: string, locked: boolean) => void;
  onRemove: (cardId: string) => void;
}

/**
 * Read-only previews. A Technical Diagram shows the selected Diagram View
 * labeled `Live` or `Exact`; a Smart Collection shows a limited live summary
 * with `Open all in source`. Neither offers any edit control on the wall.
 */
function ProjectWallPreview({
  card,
  preview,
}: {
  card: ProjectWallCardView;
  preview: ProjectWallCardPreview;
}) {
  if (preview.kind === "Technical Diagram") {
    const label =
      preview.pin === "Exact"
        ? PROJECT_WALL_PRESENTATION_LABELS.exact
        : PROJECT_WALL_PRESENTATION_LABELS.live;
    return (
      <section
        aria-label={`Diagram preview: ${preview.viewName ?? "Default"}`}
        className="space-y-1 text-xs"
      >
        <p className="text-muted-foreground">
          {label}
          {preview.pin === "Exact" && preview.versionName
            ? ` · ${preview.versionName}`
            : ""}{" "}
          · {preview.diagramType} · {preview.viewName ?? "Default"} view
        </p>
        <ul className="space-y-0.5">
          {preview.nodes.map((node) => (
            <li key={node.id}>
              {node.kind}: {node.label}
            </li>
          ))}
        </ul>
        {preview.links.length > 0 ? (
          <ul aria-label="Diagram links" className="text-muted-foreground">
            {preview.links.map((link) => (
              <li key={`${link.from}-${link.to}`}>
                {link.from} → {link.to}
                {link.label ? ` (${link.label})` : ""}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    );
  }
  return (
    <section
      aria-label={`Collection summary: ${preview.collectionName}`}
      className="space-y-1 text-xs"
      data-density={card.density}
    >
      <p className="text-muted-foreground">
        {preview.total} result{preview.total === 1 ? "" : "s"}, showing{" "}
        {preview.items.length} of {preview.limit} at most
      </p>
      <ul className="space-y-0.5">
        {preview.items.map((item) => (
          <li key={`${item.recordType}:${item.id}`}>
            {item.recordType}: {item.title}
            {item.status ? ` · ${item.status}` : ""}
            {item.sharedWithCard ? (
              <span className="text-muted-foreground">
                {" "}
                · {PROJECT_WALL_PRESENTATION_LABELS.sharedSource}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <a className="text-primary underline" href={preview.openAllPath}>
        {PROJECT_WALL_PRESENTATION_LABELS.openAllInSource}
      </a>
    </section>
  );
}

function DiagramPinControl({
  actions,
  card,
}: {
  actions: ProjectWallCardActions;
  card: ProjectWallCardView;
}) {
  const { onDiagramPin } = actions;
  if (card.sourceType !== "Technical Diagram" || !onDiagramPin) {
    return null;
  }
  const pinned =
    card.preview?.kind === "Technical Diagram"
      ? (card.preview.versionId ?? "")
      : "";
  return (
    <NativeSelect
      aria-label={DIAGRAM_CARD_LABELS.pin}
      onChange={(event) => onDiagramPin(card.id, event.target.value || null)}
      value={pinned}
    >
      <NativeSelectOption value="">
        {DIAGRAM_CARD_LABELS.live} · {DIAGRAM_CARD_LABELS.unpin}
      </NativeSelectOption>
      {(actions.diagramVersions?.[card.source.recordId] ?? []).map(
        (version) => (
          <NativeSelectOption key={version.id} value={version.id}>
            {DIAGRAM_CARD_LABELS.exact} · {version.name} · v{version.number}
          </NativeSelectOption>
        ),
      )}
    </NativeSelect>
  );
}

/**
 * A live card: the source record read live at a density the product defines.
 * Density, highlight and remove change this wall's view state only; content is
 * edited through `Open Source Record`.
 */
export function ProjectWallCard({
  actions,
  card,
  groups = [],
}: {
  actions?: ProjectWallCardActions;
  card: ProjectWallCardView;
  groups?: ProjectWallGroupView[];
}) {
  const { source } = card;
  const { broken } = source;
  const canOpen =
    source.openPath !== null && (broken === null || broken.canOpenSourceRecord);
  return (
    <article
      aria-label={`${card.sourceType} card`}
      className={`w-[240px] space-y-2 rounded-md border border-l-4 bg-background p-3 text-sm ${
        card.highlight ? HIGHLIGHT_BORDER[card.highlight] : ""
      }`}
      data-density={card.density}
      data-source-id={source.recordId}
    >
      <header className="space-y-0.5">
        <p className="text-muted-foreground text-xs">
          {card.sourceType}
          {broken
            ? ` · ${broken.reason === "Archived" ? "Archived" : `Broken — ${broken.reason}`}`
            : ""}
          {card.highlight ? ` · Highlight: ${card.highlight}` : ""}
          {card.locked ? " · Position locked" : ""}
        </p>
        {source.title ? (
          <h3 className="break-words font-medium">{source.title}</h3>
        ) : null}
      </header>
      {card.fields.length > 0 ? (
        <dl className="space-y-0.5 text-xs">
          {card.fields.map((field) => (
            <div className="flex gap-1" key={field.name}>
              <dt className="text-muted-foreground">{field.name}</dt>
              <dd className="line-clamp-4 break-words">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {card.preview ? (
        <ProjectWallPreview card={card} preview={card.preview} />
      ) : null}
      {card.sharedSource ? (
        <p className="text-muted-foreground text-xs">
          {PROJECT_WALL_PRESENTATION_LABELS.sharedSource}: this record is also
          listed in a Smart Collection block on this wall.
        </p>
      ) : null}
      {canOpen ? (
        <a
          className="text-primary text-xs underline"
          href={source.openPath ?? ""}
        >
          Open Source Record
        </a>
      ) : null}
      {actions ? (
        <div className="nodrag nopan flex flex-wrap items-center gap-1">
          <fieldset
            aria-label="Density"
            className="m-0 flex gap-1 border-0 p-0"
          >
            {PROJECT_WALL_DENSITIES.map((density) => (
              <Button
                aria-pressed={card.density === density}
                key={density}
                onClick={() => actions.onDensity(card.id, density)}
                size="sm"
                type="button"
                variant={card.density === density ? "default" : "outline"}
              >
                {density}
              </Button>
            ))}
          </fieldset>
          <NativeSelect
            aria-label="Highlight"
            onChange={(event) =>
              actions.onHighlight(
                card.id,
                (event.target.value || null) as ProjectWallHighlight | null,
              )
            }
            value={card.highlight ?? ""}
          >
            <NativeSelectOption value="">No highlight</NativeSelectOption>
            {PROJECT_WALL_HIGHLIGHTS.map((highlight) => (
              <NativeSelectOption key={highlight} value={highlight}>
                {highlight}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <DiagramPinControl actions={actions} card={card} />
          <NativeSelect
            aria-label="Group"
            onChange={(event) =>
              actions.onGroup(card.id, event.target.value || null)
            }
            value={card.groupId ?? ""}
          >
            <NativeSelectOption value="">No group</NativeSelectOption>
            {groups.map((group) => (
              <NativeSelectOption key={group.id} value={group.id}>
                {group.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button
            aria-pressed={card.locked}
            onClick={() => actions.onLock(card.id, !card.locked)}
            size="sm"
            type="button"
            variant={card.locked ? "default" : "outline"}
          >
            Lock Position
          </Button>
          <Button
            onClick={() => actions.onRemove(card.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            Remove from Project Wall
          </Button>
        </div>
      ) : null}
    </article>
  );
}
