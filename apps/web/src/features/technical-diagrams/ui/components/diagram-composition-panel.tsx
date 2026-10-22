// biome-ignore-all lint/performance/noJsxPropsBind: The panel binds its own selection fields.

import {
  type ConvertToRecordPlan,
  DIAGRAM_CARD_LABELS,
  type DiagramRecordCardView,
} from "@cantiara/api/technical-diagram-card";
import type { TechnicalDiagramVersion } from "@cantiara/api/technical-diagram-version";
import type { TechnicalDiagramSource } from "@cantiara/api/technical-diagrams";
import { Button } from "@cantiara/ui/components/button";
import { AppLink } from "@/components/app-link";

import {
  ConvertNodeForm,
  type Target,
  type WORK_TYPES,
} from "../forms/convert-node-form";
import {
  PlaceRecordForm,
  type RecordCardOption,
} from "../forms/place-record-form";

interface Props {
  cards: DiagramRecordCardView[];
  diagram: Pick<TechnicalDiagramSource, "authorityMode" | "id">;
  disabled: boolean;
  error: string | null;
  onCancelConvert: () => void;
  onConfirmConvert: (plan: ConvertToRecordPlan) => void;
  onPlace: (option: RecordCardOption) => void;
  onPreviewConvert: (input: {
    nodeId: string;
    target: Target;
    versionId: string;
    workType: (typeof WORK_TYPES)[number];
  }) => void;
  onRemove: (cardId: string) => void;
  options: RecordCardOption[];
  plan: ConvertToRecordPlan | null;
  versions: TechnicalDiagramVersion[];
}

function RecordCard({
  card,
  disabled,
  onRemove,
}: {
  card: DiagramRecordCardView;
  disabled: boolean;
  onRemove: (cardId: string) => void;
}) {
  const canOpen =
    card.openPath !== null &&
    (card.broken === null || card.broken.canOpenSourceRecord);
  return (
    <li className="space-y-1 rounded-md border p-2">
      <p className="text-muted-foreground text-xs">
        {card.sourceType} · Read-only live card
        {card.broken
          ? ` · ${card.broken.reason === "Archived" ? "Archived" : `Broken — ${card.broken.reason}`}`
          : ""}
      </p>
      {card.title ? <p className="font-medium">{card.title}</p> : null}
      {card.status ? <p className="text-sm">{card.status}</p> : null}
      <div className="flex flex-wrap gap-2">
        {canOpen ? (
          <AppLink className="text-sm underline" href={card.openPath ?? ""}>
            {DIAGRAM_CARD_LABELS.openSource}
          </AppLink>
        ) : null}
        <Button
          disabled={disabled}
          onClick={() => onRemove(card.id)}
          size="sm"
          type="button"
          variant="outline"
        >
          Remove from diagram
        </Button>
      </div>
    </li>
  );
}

function ConvertPlan({
  disabled,
  onCancel,
  onConfirm,
  plan,
}: {
  disabled: boolean;
  onCancel: () => void;
  onConfirm: (plan: ConvertToRecordPlan) => void;
  plan: ConvertToRecordPlan;
}) {
  return (
    <section aria-label="Conversion preview" className="space-y-2">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
        <dt>Target type</dt>
        <dd>{plan.record.type}</dd>
        {plan.record.workType ? (
          <>
            <dt>Work type</dt>
            <dd>{plan.record.workType}</dd>
          </>
        ) : null}
        <dt>Project</dt>
        <dd>{plan.targetProject.name}</dd>
        <dt>Title</dt>
        <dd>{plan.record.title}</dd>
        <dt>Body</dt>
        <dd>{plan.record.body}</dd>
        <dt>Exact version</dt>
        <dd>
          {plan.version.name} · version {plan.version.number}
        </dd>
        <dt>Origin</dt>
        <dd>
          {plan.diagram.title} · {plan.node.kind} {plan.node.label}
        </dd>
        <dt>Authority mode</dt>
        <dd>
          {plan.diagram.authorityMode} stays unchanged; the diagram is not
          written.
        </dd>
      </dl>
      <p className="text-muted-foreground text-sm">
        Confirming writes exactly {plan.recordCount} {plan.record.type} and
        links it to this Diagram Version.
      </p>
      <div className="flex gap-2">
        <Button
          disabled={disabled}
          onClick={() => onConfirm(plan)}
          type="button"
        >
          {DIAGRAM_CARD_LABELS.convert}
        </Button>
        <Button onClick={onCancel} type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

/**
 * Composition on the diagram canvas: existing records as read-only live cards
 * (moving or removing a card never writes the record) and the previewed
 * `Convert to record and link` of a node of one exact Diagram Version.
 */
export function DiagramCompositionPanel({
  cards,
  diagram,
  disabled,
  error,
  onCancelConvert,
  onConfirmConvert,
  onPlace,
  onPreviewConvert,
  onRemove,
  options,
  plan,
  versions,
}: Props) {
  const placed = new Set(
    cards.map((card) => `${card.sourceType}:${card.sourceId}`),
  );
  const free = options.filter(
    ({ id, sourceType }) => !placed.has(`${sourceType}:${id}`),
  );
  const external = diagram.authorityMode === "External Source Link";
  return (
    <section aria-label="Diagram composition" className="space-y-4">
      <section aria-label="Record cards" className="space-y-2">
        <h4 className="font-medium">Record cards</h4>
        <p className="text-muted-foreground text-sm">
          A record card reads the existing İş, Karar, Risk or Açık Soru live.
          Moving it only moves the card; the record is edited in its own
          surface.
        </p>
        {cards.length > 0 ? (
          <ul aria-label="Placed record cards" className="space-y-2">
            {cards.map((card) => (
              <RecordCard
                card={card}
                disabled={disabled}
                key={card.id}
                onRemove={onRemove}
              />
            ))}
          </ul>
        ) : null}
        <PlaceRecordForm disabled={disabled} free={free} onPlace={onPlace} />
      </section>
      <section aria-label={DIAGRAM_CARD_LABELS.convert} className="space-y-2">
        <h4 className="font-medium">{DIAGRAM_CARD_LABELS.convert}</h4>
        {external ? (
          <p className="text-muted-foreground text-sm">
            An External Source Link has no Diagram Version, so none of its
            elements can be converted.
          </p>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              A local node becomes one record only from an exact Diagram
              Version. Nothing is written before you confirm the preview.
            </p>
            <ConvertNodeForm
              disabled={disabled}
              onCancelConvert={onCancelConvert}
              onPreviewConvert={onPreviewConvert}
              versions={versions}
            />
            {versions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Create a Diagram Version first.
              </p>
            ) : null}
            {plan ? (
              <ConvertPlan
                disabled={disabled}
                onCancel={onCancelConvert}
                onConfirm={onConfirmConvert}
                plan={plan}
              />
            ) : null}
          </>
        )}
      </section>
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
