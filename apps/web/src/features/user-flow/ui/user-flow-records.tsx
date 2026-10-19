// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed bind.
import type {
  CardRecordOption,
  RecordReferenceView,
  UserFlowBindView,
  UserFlowCardKind,
  UserFlowCardView,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { type FormEvent, useState } from "react";

/**
 * Common broken-reference presentation of a live record. A broken target shows
 * its reason, never a title or status; `Archived` keeps the title and still
 * opens the source.
 */
export function RecordReference({
  reference,
}: {
  reference: RecordReferenceView;
}) {
  const { broken } = reference;
  return (
    <div
      className="space-y-1 text-sm"
      data-record-reference={reference.recordId}
    >
      <p>
        <span className="text-muted-foreground">{reference.kind}</span>
        {broken ? (
          <span className="font-medium">
            {" · "}
            {broken.reason === "Archived"
              ? "Archived"
              : `Broken — ${broken.reason}`}
          </span>
        ) : null}
        {reference.title ? (
          <span className="font-medium"> · {reference.title}</span>
        ) : null}
        {reference.status ? (
          <span className="text-muted-foreground"> · {reference.status}</span>
        ) : null}
      </p>
      {reference.openPath && (broken === null || broken.canOpenSourceRecord) ? (
        <a className="text-primary underline" href={reference.openPath}>
          Open Source Record
        </a>
      ) : null}
    </div>
  );
}

/** Read-only live cards. Removing one edits this flow only; the source record is never written. */
export function LiveCardList({
  cards,
  onRemove,
  readOnly,
}: {
  cards: UserFlowCardView[];
  onRemove?: (cardId: string) => Promise<unknown>;
  readOnly: boolean;
}) {
  if (cards.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Live cards" className="space-y-2">
      {cards.map((card) => (
        <li
          className="flex items-start justify-between gap-2 rounded-md border p-3"
          key={card.id}
        >
          <RecordReference reference={card.record} />
          {onRemove ? (
            <Button
              disabled={readOnly}
              onClick={() => onRemove(card.id)}
              size="sm"
              type="button"
              variant="outline"
            >
              Remove card
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function PlaceCardForm({
  disabled,
  onPlace,
  options,
}: {
  disabled: boolean;
  onPlace: (kind: UserFlowCardKind, recordId: string) => Promise<unknown>;
  options: CardRecordOption[];
}) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const option = options.find(({ id }) => id === selected);
    if (!option) {
      return;
    }
    try {
      await onPlace(option.kind, option.id);
      setSelected("");
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The card could not be placed.",
      );
    }
  }
  return (
    <form className="space-y-2" onSubmit={submit}>
      <Label htmlFor="user-flow-card-record">Record</Label>
      <NativeSelect
        id="user-flow-card-record"
        onChange={(event) => setSelected(event.target.value)}
        value={selected}
      >
        <NativeSelectOption value="">
          Select a Work, Decision or Risk
        </NativeSelectOption>
        {options.map((option) => (
          <NativeSelectOption key={option.id} value={option.id}>
            {option.kind} · {option.title}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error ? <p role="alert">{error}</p> : null}
      <Button disabled={disabled || selected === ""} type="submit">
        Place live card
      </Button>
    </form>
  );
}

/** The records `Convert and Bind` opened, their immutable Origin Location and the explicit `Rebind`. */
export function BindList({
  binds,
  onRebind,
  readOnly,
}: {
  binds: UserFlowBindView[];
  onRebind?: (bind: UserFlowBindView) => void;
  readOnly: boolean;
}) {
  if (binds.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Binds" className="space-y-2">
      {binds.map((bind) => (
        <li className="space-y-1 rounded-md border p-3" key={bind.id}>
          <RecordReference reference={bind.record} />
          <p className="text-muted-foreground text-xs">
            Origin Location: User Flow {bind.origin.userFlowId} · node{" "}
            {bind.origin.nodeId} · version {bind.origin.flowVersion}
          </p>
          {bind.origin.node ? (
            <p className="whitespace-pre-wrap text-xs">
              Node at origin: {bind.origin.node.text}
            </p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Bound to version {bind.boundVersion}
          </p>
          {bind.rebindAvailable && onRebind ? (
            <Button
              disabled={readOnly}
              onClick={() => onRebind(bind)}
              size="sm"
              type="button"
              variant="outline"
            >
              Rebind
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
