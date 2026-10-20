// biome-ignore-all lint/performance/noJsxPropsBind: Outline rows bind their own card to each action.
import type {
  ProjectWallCardView,
  ProjectWallLinkView,
  ProjectWallView,
} from "@cantiara/api/project-wall";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { observeElementRect, useVirtualizer } from "@tanstack/react-virtual";
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from "react";

import {
  buildOutline,
  cardTitle,
  moveInOutline,
  type OutlineRow,
} from "../lib/project-wall-outline";
import {
  ProjectWallCard,
  type ProjectWallCardActions,
} from "./project-wall-card";

/** Above this many rows the Outline virtualizes. */
export const OUTLINE_VIRTUALIZE_THRESHOLD = 150;
const OUTLINE_ROW_HEIGHT = 48;
const OUTLINE_VIEW_HEIGHT = 420;
const NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "End", "Home"]);

export interface ProjectWallOutlineActions {
  onDrawLink: (input: {
    fromCardId: string;
    label: string;
    toCardId: string;
  }) => Promise<boolean>;
  /** Creates a group and puts the selected cards into it. */
  onGroupSelection: (title: string, cardIds: string[]) => Promise<boolean>;
  onReorder: (cardIds: string[]) => void;
  onUnbindLink: (linkId: string) => Promise<boolean>;
}

export interface ProjectWallOutlineProps {
  actions: ProjectWallOutlineActions;
  /** The `Place live card` form, shown inside the Outline so creating needs no pointer. */
  addControls?: ReactNode;
  cardActions: ProjectWallCardActions;
  /** Group ids collapsed in this account's own view. */
  collapsed: readonly string[];
  onSelectionChange: (cardIds: string[]) => void;
  onToggleGroup: (groupId: string) => void;
  selection: readonly string[];
  wall: Pick<ProjectWallView, "cards" | "groups" | "links">;
}

interface RowContext extends ProjectWallOutlineProps {
  inspectedId: string | null;
  onInspect: (cardId: string | null) => void;
}

function CardRow({
  card,
  context,
  depth,
  index,
}: {
  card: ProjectWallCardView;
  context: RowContext;
  depth: 0 | 1;
  index: number;
}) {
  const title = cardTitle(card);
  const selected = context.selection.includes(card.id);
  const inspected = context.inspectedId === card.id;
  const { broken, openPath } = card.source;
  const canOpen =
    openPath !== null && (broken === null || broken.canOpenSourceRecord);
  const order = context.wall.cards.map(({ id }) => id);
  return (
    <div
      className="flex flex-wrap items-center gap-1 py-1"
      style={{ paddingLeft: depth * 16 }}
    >
      <Button
        aria-label={`Select: ${title}`}
        aria-pressed={selected}
        data-outline-index={index}
        onClick={() =>
          context.onSelectionChange(
            selected
              ? context.selection.filter((id) => id !== card.id)
              : [...context.selection, card.id],
          )
        }
        size="sm"
        type="button"
        variant={selected ? "default" : "outline"}
      >
        {card.sourceType}: {title}
        {card.locked ? " · Position locked" : ""}
      </Button>
      <Button
        aria-label={`Move up: ${title}`}
        onClick={() =>
          context.actions.onReorder(
            moveInOutline(context.wall.cards, card.id, "up"),
          )
        }
        size="sm"
        type="button"
        variant="outline"
      >
        Move up
      </Button>
      <Button
        aria-label={`Move down: ${title}`}
        onClick={() =>
          context.actions.onReorder(
            moveInOutline(context.wall.cards, card.id, "down"),
          )
        }
        size="sm"
        type="button"
        variant="outline"
      >
        Move down
      </Button>
      <NativeSelect
        aria-label={`Group: ${title}`}
        onChange={(event) =>
          context.cardActions.onGroup(card.id, event.target.value || null)
        }
        value={card.groupId ?? ""}
      >
        <NativeSelectOption value="">No group</NativeSelectOption>
        {context.wall.groups.map((group) => (
          <NativeSelectOption key={group.id} value={group.id}>
            {group.title}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button
        aria-label={`Inspect: ${title}`}
        aria-pressed={inspected}
        onClick={() => context.onInspect(inspected ? null : card.id)}
        size="sm"
        type="button"
        variant={inspected ? "default" : "outline"}
      >
        Inspect
      </Button>
      {canOpen ? (
        <a
          aria-label={`Open Source Record: ${title}`}
          className="text-primary text-xs underline"
          href={openPath ?? ""}
        >
          Open Source Record
        </a>
      ) : null}
      <span className="sr-only">
        Position {order.indexOf(card.id) + 1} of {order.length}
      </span>
    </div>
  );
}

function GroupRow({
  context,
  index,
  row,
}: {
  context: RowContext;
  index: number;
  row: Extract<OutlineRow, { kind: "group" }>;
}) {
  const { group } = row;
  return (
    <div className="flex items-center gap-2 py-1 font-medium text-sm">
      <Button
        aria-expanded={!row.collapsed}
        aria-label={`${row.collapsed ? "Expand group" : "Collapse group"}: ${group.title}`}
        data-outline-index={index}
        onClick={() => context.onToggleGroup(group.id)}
        size="sm"
        type="button"
        variant="outline"
      >
        {row.collapsed ? "Expand" : "Collapse"}
      </Button>
      <span>
        Group: {group.title} ({row.memberCount})
      </span>
    </div>
  );
}

function OutlineRowView({
  context,
  index,
  row,
}: {
  context: RowContext;
  index: number;
  row: OutlineRow;
}) {
  if (row.kind === "group") {
    return <GroupRow context={context} index={index} row={row} />;
  }
  if (row.kind === "ungrouped") {
    return (
      <p
        className="py-1 font-medium text-muted-foreground text-sm"
        data-outline-index={index}
        tabIndex={-1}
      >
        No group ({row.memberCount})
      </p>
    );
  }
  return (
    <CardRow
      card={row.card}
      context={context}
      depth={row.depth}
      index={index}
    />
  );
}

function rowKey(row: OutlineRow) {
  if (row.kind === "group") {
    return `group:${row.group.id}`;
  }
  return row.kind === "card" ? `card:${row.card.id}` : "ungrouped";
}

function useRovingFocus(
  container: React.RefObject<HTMLElement | null>,
  count: number,
  reveal: (index: number) => void,
) {
  return (event: KeyboardEvent<HTMLElement>) => {
    const current = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-outline-index]",
    );
    if (
      !(current && NAVIGATION_KEYS.has(event.key)) ||
      event.target !== current
    ) {
      return;
    }
    event.preventDefault();
    const at = Number(current.dataset.outlineIndex);
    let target = at;
    if (event.key === "ArrowDown") {
      target = Math.min(count - 1, at + 1);
    } else if (event.key === "ArrowUp") {
      target = Math.max(0, at - 1);
    } else if (event.key === "Home") {
      target = 0;
    } else {
      target = count - 1;
    }
    reveal(target);
    const focus = () =>
      container.current
        ?.querySelector<HTMLElement>(`[data-outline-index="${target}"]`)
        ?.focus();
    focus();
    // A virtualized row may mount only after scrolling to it.
    requestAnimationFrame(focus);
  };
}

function StaticOutline({
  context,
  rows,
}: {
  context: RowContext;
  rows: OutlineRow[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const onKeyDown = useRovingFocus(container, rows.length, () => undefined);
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Key events bubble from the focusable row buttons to give them roving focus.
    // biome-ignore lint/a11y/noStaticElementInteractions: Key events bubble from the focusable row buttons to give them roving focus.
    <div onKeyDown={onKeyDown} ref={container}>
      <ul aria-label="Outline rows">
        {rows.map((row, index) => (
          <li key={rowKey(row)}>
            <OutlineRowView context={context} index={index} row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function VirtualOutline({
  context,
  rows,
}: {
  context: RowContext;
  rows: OutlineRow[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    estimateSize: () => OUTLINE_ROW_HEIGHT,
    getScrollElement: () => scroller.current,
    initialRect: { height: OUTLINE_VIEW_HEIGHT, width: 800 },
    // Rows that cannot be measured keep the estimate instead of collapsing.
    measureElement: (element) => {
      const { height } = element.getBoundingClientRect();
      return height > 0 ? height : OUTLINE_ROW_HEIGHT;
    },
    // An unmeasured (zero-size) viewport falls back to the fixed outline height
    // so rows always render, including where layout is unavailable.
    observeElementRect: (instance, callback) =>
      observeElementRect(instance, (rect) =>
        callback(
          rect.height > 0
            ? rect
            : { height: OUTLINE_VIEW_HEIGHT, width: rect.width || 800 },
        ),
      ),
    overscan: 8,
  });
  const onKeyDown = useRovingFocus(scroller, rows.length, (index) =>
    virtualizer.scrollToIndex(index),
  );
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Key events bubble from the focusable row buttons to give them roving focus.
    <section
      aria-label={`Outline rows (${rows.length})`}
      className="overflow-auto"
      onKeyDown={onKeyDown}
      ref={scroller}
      style={{ height: OUTLINE_VIEW_HEIGHT }}
    >
      <ul className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtual) => {
          const row = rows[virtual.index];
          if (!row) {
            return null;
          }
          return (
            <li
              aria-posinset={virtual.index + 1}
              aria-setsize={rows.length}
              className="absolute inset-x-0"
              data-index={virtual.index}
              key={rowKey(row)}
              ref={virtualizer.measureElement}
              style={{ top: virtual.start }}
            >
              <OutlineRowView
                context={context}
                index={virtual.index}
                row={row}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function GroupSelectionForm({
  onGroupSelection,
  selection,
}: {
  onGroupSelection: ProjectWallOutlineActions["onGroupSelection"];
  selection: readonly string[];
}) {
  const id = useId();
  const [title, setTitle] = useState("");
  const ready = title.trim() !== "" && selection.length > 0;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) {
      return;
    }
    if (await onGroupSelection(title.trim(), [...selection])) {
      // Only a persisted group clears the draft; a failed write keeps it.
      setTitle("");
    }
  }
  return (
    <form
      aria-label="Group selection"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor={id}>Group name</Label>
        <Input
          id={id}
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
      </div>
      <Button disabled={!ready} type="submit" variant="outline">
        Group selection
      </Button>
      <span className="text-muted-foreground text-xs">
        {selection.length} selected
      </span>
    </form>
  );
}

function BindForm({
  actions,
  card,
  cards,
}: {
  actions: ProjectWallOutlineActions;
  card: ProjectWallCardView;
  cards: ProjectWallCardView[];
}) {
  const toId = useId();
  const labelId = useId();
  const [to, setTo] = useState("");
  const [label, setLabel] = useState("");
  const ready = to !== "" && to !== card.id && label.trim() !== "";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) {
      return;
    }
    await actions.onDrawLink({
      fromCardId: card.id,
      label: label.trim(),
      toCardId: to,
    });
    setLabel("");
  }
  return (
    <form
      aria-label="Bind Visual link"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <p className="text-xs">From: {cardTitle(card)}</p>
      <div className="space-y-1">
        <Label htmlFor={toId}>To</Label>
        <NativeSelect
          id={toId}
          onChange={(event) => setTo(event.target.value)}
          value={to}
        >
          <NativeSelectOption value="">Select a card</NativeSelectOption>
          {cards
            .filter(({ id }) => id !== card.id)
            .map((other) => (
              <NativeSelectOption key={other.id} value={other.id}>
                {other.sourceType} · {cardTitle(other)}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </div>
      <div className="space-y-1">
        <Label htmlFor={labelId}>Label</Label>
        <Input
          id={labelId}
          maxLength={120}
          onChange={(event) => setLabel(event.target.value)}
          value={label}
        />
      </div>
      <Button disabled={!ready} type="submit" variant="outline">
        Bind
      </Button>
    </form>
  );
}

function LinkList({
  actions,
  card,
  cards,
  links,
}: {
  actions: ProjectWallOutlineActions;
  card: ProjectWallCardView;
  cards: ProjectWallCardView[];
  links: ProjectWallLinkView[];
}) {
  const mine = links.filter(
    ({ fromCardId, toCardId }) =>
      fromCardId === card.id || toCardId === card.id,
  );
  const nameOf = (id: string) => {
    const found = cards.find((candidate) => candidate.id === id);
    return found ? cardTitle(found) : "Unavailable record";
  };
  if (mine.length === 0) {
    return <p className="text-muted-foreground text-xs">No Visual links.</p>;
  }
  return (
    <ul aria-label="Visual links of this card" className="space-y-1 text-xs">
      {mine.map((link) => (
        <li className="flex flex-wrap items-center gap-2" key={link.id}>
          <span>
            From: {nameOf(link.fromCardId)} To: {nameOf(link.toCardId)} (
            {link.label})
          </span>
          <Button
            aria-label={`Unbind: ${link.label}`}
            onClick={() => actions.onUnbindLink(link.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            Unbind
          </Button>
        </li>
      ))}
    </ul>
  );
}

function Inspector({
  card,
  context,
}: {
  card: ProjectWallCardView;
  context: RowContext;
}) {
  return (
    <section aria-label={`Inspector: ${cardTitle(card)}`} className="space-y-2">
      <h4 className="font-medium text-sm">Inspect: {cardTitle(card)}</h4>
      <ProjectWallCard
        actions={context.cardActions}
        card={card}
        groups={context.wall.groups}
      />
      <LinkList
        actions={context.actions}
        card={card}
        cards={context.wall.cards}
        links={context.wall.links}
      />
      <BindForm
        actions={context.actions}
        card={card}
        cards={context.wall.cards}
      />
    </section>
  );
}

/**
 * The structured Outline: place, select, reorder (Move up / Move down), group,
 * bind and unbind a Visual link, inspect and Open Source Record, all with
 * buttons and fields. It edits the same wall state as the canvas. Selection
 * and the inspected card are session-only and never persisted.
 */
export function ProjectWallOutline(props: ProjectWallOutlineProps) {
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const context: RowContext = {
    ...props,
    inspectedId,
    onInspect: setInspectedId,
  };
  const rows = buildOutline(
    props.wall.cards,
    props.wall.groups,
    props.collapsed,
  );
  const virtualized = rows.length > OUTLINE_VIRTUALIZE_THRESHOLD;
  const inspected = props.wall.cards.find(({ id }) => id === inspectedId);
  return (
    <section
      aria-label="Outline"
      className="space-y-3"
      data-virtualized={virtualized}
    >
      <h3 className="font-medium">Outline</h3>
      {props.addControls}
      <GroupSelectionForm
        onGroupSelection={props.actions.onGroupSelection}
        selection={props.selection}
      />
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No cards yet.</p>
      ) : null}
      {virtualized ? (
        <VirtualOutline context={context} rows={rows} />
      ) : (
        <StaticOutline context={context} rows={rows} />
      )}
      {inspected ? <Inspector card={inspected} context={context} /> : null}
    </section>
  );
}
