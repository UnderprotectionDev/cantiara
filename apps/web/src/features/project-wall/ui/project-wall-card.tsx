// biome-ignore-all lint/performance/noJsxPropsBind: Card controls close over the displayed card id.
import {
  PROJECT_WALL_DENSITIES,
  PROJECT_WALL_HIGHLIGHTS,
  type ProjectWallCardView,
  type ProjectWallDensity,
  type ProjectWallHighlight,
} from "@cantiara/api/project-wall";
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
  onDensity: (cardId: string, density: ProjectWallDensity) => void;
  onHighlight: (cardId: string, highlight: ProjectWallHighlight | null) => void;
  onRemove: (cardId: string) => void;
}

/**
 * A live card: the source record read live at a density the product defines.
 * Density, highlight and remove change this wall's view state only; content is
 * edited through `Open Source Record`.
 */
export function ProjectWallCard({
  actions,
  card,
}: {
  actions?: ProjectWallCardActions;
  card: ProjectWallCardView;
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
