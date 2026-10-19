// biome-ignore-all lint/performance/noJsxPropsBind: Outline rows bind their own item and section to each action.
import {
  buildOutlineSections,
  dropWithinSection,
  flattenOutline,
  moveWithinSection,
  nextOutlineIndex,
  type OutlineItem,
  type OutlineKey,
  type OutlineRow,
  type OutlineSection,
  type OutlineSourceTarget,
  outlineSourceTarget,
} from "@cantiara/api/moodboard-outline";
import { MOODBOARD_UI_LABELS, type Moodboard } from "@cantiara/api/moodboards";
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { observeElementRect, useVirtualizer } from "@tanstack/react-virtual";
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";

/** Above this many rows the outline virtualizes and drops pointer dragging. */
export const OUTLINE_VIRTUALIZE_THRESHOLD = 150;
const OUTLINE_ROW_HEIGHT = 56;
const OUTLINE_VIEW_HEIGHT = 480;
const NAVIGATION_KEYS = new Set(["ArrowDown", "ArrowUp", "End", "Home"]);

export interface MoodboardOutlineProps {
  /** Add controls shown inside the Outline so adding needs no pointer either. */
  addControls?: ReactNode;
  busy: boolean;
  collapsed: readonly string[];
  moodboard: Moodboard;
  onGroup: (itemId: string, paletteGroupId: string | null) => void;
  onOpenSource: (target: OutlineSourceTarget, itemId: string) => void;
  onReorder: (itemIds: string[]) => void;
  onSelect: (itemId: string) => void;
  onToggleSection: (sectionKey: string) => void;
  selectedId: string | null;
}

interface RowContext extends MoodboardOutlineProps {
  inspectedId: string | null;
  onInspect: (itemId: string) => void;
  order: string[];
  sections: Map<string, OutlineSection>;
}

function rowKey(row: OutlineRow) {
  return row.kind === "section"
    ? `section:${row.section.key}`
    : `item:${row.item.id}`;
}

function SectionHeader({
  context,
  index,
  section,
}: {
  context: RowContext;
  index: number;
  section: OutlineSection;
}) {
  const action = section.collapsed
    ? MOODBOARD_UI_LABELS.expand
    : MOODBOARD_UI_LABELS.collapse;
  return (
    <h4 className="font-medium text-sm">
      <button
        aria-controls={`moodboard-outline-${section.key}`}
        aria-expanded={!section.collapsed}
        className="rounded px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        data-outline-index={index}
        onClick={() => context.onToggleSection(section.key)}
        type="button"
      >
        {action} {section.label} ({section.items.length})
      </button>
    </h4>
  );
}

function ItemDetails({
  item,
  moodboard,
}: {
  item: OutlineItem;
  moodboard: Moodboard;
}) {
  const source = moodboard.items.find(({ id }) => id === item.id);
  if (!source) {
    return null;
  }
  return (
    <dl
      aria-label={`${MOODBOARD_UI_LABELS.inspect}: ${item.label}`}
      className="grid grid-cols-[auto_1fr] gap-x-3 text-sm"
    >
      <dt className="text-muted-foreground">Kind</dt>
      <dd>
        {source.kind === "Visual" ? "Visual" : MOODBOARD_UI_LABELS.colorSwatch}
      </dd>
      {source.kind === "Visual" ? (
        <>
          <dt className="text-muted-foreground">Origin</dt>
          <dd>
            {source.origin.kind === "External link"
              ? `${MOODBOARD_UI_LABELS.externalLink}: ${source.origin.url}`
              : `${MOODBOARD_UI_LABELS.fileAttachmentVersion}: ${source.origin.attachmentVersionId}`}
          </dd>
          <dt className="text-muted-foreground">
            {MOODBOARD_UI_LABELS.caption}
          </dt>
          <dd>{source.caption ?? "None"}</dd>
        </>
      ) : (
        <>
          <dt className="text-muted-foreground">{MOODBOARD_UI_LABELS.color}</dt>
          <dd>{source.color}</dd>
          <dt className="text-muted-foreground">{MOODBOARD_UI_LABELS.note}</dt>
          <dd>{source.note ?? "None"}</dd>
        </>
      )}
    </dl>
  );
}

interface ItemRowProps {
  context: RowContext;
  dragHandle?: ReactNode;
  index: number;
  item: OutlineItem;
}

function ItemRow({ context, dragHandle, index, item }: ItemRowProps) {
  const section = context.sections.get(item.sectionKey);
  const siblings = section?.items.map(({ id }) => id) ?? [];
  const source = context.moodboard.items.find(({ id }) => id === item.id);
  const target = source ? outlineSourceTarget(source) : null;
  const selected = context.selectedId === item.id;
  const inspected = context.inspectedId === item.id;
  const up = moveWithinSection(context.order, siblings, item.id, "up");
  const down = moveWithinSection(context.order, siblings, item.id, "down");
  const buttonClass =
    "rounded border px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50";
  return (
    <div className="space-y-2 rounded-md border p-2" data-selected={selected}>
      <div className="flex flex-wrap items-center gap-2">
        {dragHandle}
        <button
          aria-pressed={selected}
          className="min-w-0 flex-1 truncate rounded px-1 py-1 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-pressed:font-semibold"
          data-outline-index={index}
          onClick={() => context.onSelect(item.id)}
          type="button"
        >
          {item.label}
        </button>
        <button
          aria-label={`${MOODBOARD_UI_LABELS.moveUp}: ${item.label}`}
          className={buttonClass}
          disabled={context.busy || up === null}
          onClick={() => up && context.onReorder(up)}
          type="button"
        >
          {MOODBOARD_UI_LABELS.moveUp}
        </button>
        <button
          aria-label={`${MOODBOARD_UI_LABELS.moveDown}: ${item.label}`}
          className={buttonClass}
          disabled={context.busy || down === null}
          onClick={() => down && context.onReorder(down)}
          type="button"
        >
          {MOODBOARD_UI_LABELS.moveDown}
        </button>
        {item.kind === "Color Swatch" ? (
          <label className="inline-flex items-center gap-1 text-xs">
            <span>{MOODBOARD_UI_LABELS.group}</span>
            <select
              aria-label={`${MOODBOARD_UI_LABELS.group}: ${item.label}`}
              className="rounded border bg-background px-1 py-1"
              disabled={context.busy}
              onChange={(event) =>
                context.onGroup(item.id, event.target.value || null)
              }
              value={item.sectionKey === "ungrouped" ? "" : item.sectionKey}
            >
              <option value="">{MOODBOARD_UI_LABELS.noPaletteGroup}</option>
              {context.moodboard.paletteGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          aria-expanded={inspected}
          aria-label={`${MOODBOARD_UI_LABELS.inspect}: ${item.label}`}
          className={buttonClass}
          onClick={() => context.onInspect(item.id)}
          type="button"
        >
          {MOODBOARD_UI_LABELS.inspect}
        </button>
        {target ? (
          <button
            aria-label={`${MOODBOARD_UI_LABELS.openSourceRecord}: ${item.label}`}
            className={buttonClass}
            onClick={() => context.onOpenSource(target, item.id)}
            type="button"
          >
            {MOODBOARD_UI_LABELS.openSourceRecord}
          </button>
        ) : null}
      </div>
      {inspected ? (
        <ItemDetails item={item} moodboard={context.moodboard} />
      ) : null}
    </div>
  );
}

function SortableItemRow(props: Omit<ItemRowProps, "dragHandle">) {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: props.item.id, disabled: props.context.busy });
  return (
    <li
      ref={setNodeRef}
      style={{
        opacity: isDragging ? 0.6 : undefined,
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <ItemRow
        {...props}
        dragHandle={
          <button
            aria-label={`Drag ${props.item.label}`}
            className="cursor-grab rounded px-2 py-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:cursor-grabbing"
            type="button"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        }
      />
    </li>
  );
}

function useOutlineModel(props: MoodboardOutlineProps) {
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const sectionList = buildOutlineSections(props.moodboard, props.collapsed);
  const rows = flattenOutline(sectionList);
  const indexes = new Map(rows.map((row, index) => [rowKey(row), index]));
  const context: RowContext = {
    ...props,
    inspectedId,
    onInspect: (itemId) =>
      setInspectedId((current) => (current === itemId ? null : itemId)),
    order: props.moodboard.items.map(({ id }) => id),
    sections: new Map(sectionList.map((section) => [section.key, section])),
  };
  return { context, indexes, rows, sectionList };
}

/** Pointer-free ArrowUp/ArrowDown/Home/End roving focus across outline rows. */
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
    const target = nextOutlineIndex(
      count,
      Number(current.dataset.outlineIndex),
      event.key as OutlineKey,
    );
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
  indexes,
  sectionList,
}: ReturnType<typeof useOutlineModel>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const container = useRef<HTMLDivElement>(null);
  const onKeyDown = useRovingFocus(container, rows.length, () => undefined);

  function onDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) {
      return;
    }
    const activeId = String(event.active.id);
    const section = sectionList.find(({ items }) =>
      items.some(({ id }) => id === activeId),
    );
    const next = section
      ? dropWithinSection(
          context.order,
          section.items.map(({ id }) => id),
          activeId,
          String(event.over.id),
        )
      : null;
    if (next) {
      context.onReorder(next);
    }
  }

  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Key events bubble from the focusable row buttons to give them roving focus.
    // biome-ignore lint/a11y/noStaticElementInteractions: Key events bubble from the focusable row buttons to give them roving focus.
    <div onKeyDown={onKeyDown} ref={container}>
      <DndContext onDragEnd={onDragEnd} sensors={sensors}>
        {sectionList.map((section) => (
          <section className="space-y-2" key={section.key}>
            <SectionHeader
              context={context}
              index={indexes.get(`section:${section.key}`) ?? 0}
              section={section}
            />
            <SortableContext
              items={section.items.map(({ id }) => id)}
              strategy={verticalListSortingStrategy}
            >
              <ul
                className="space-y-2"
                hidden={section.collapsed}
                id={`moodboard-outline-${section.key}`}
              >
                {section.collapsed
                  ? null
                  : section.items.map((item) => (
                      <SortableItemRow
                        context={context}
                        index={indexes.get(`item:${item.id}`) ?? 0}
                        item={item}
                        key={item.id}
                      />
                    ))}
              </ul>
            </SortableContext>
          </section>
        ))}
      </DndContext>
    </div>
  );
}

function VirtualOutline({ context, rows }: ReturnType<typeof useOutlineModel>) {
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
      aria-label={`${MOODBOARD_UI_LABELS.outline} (${rows.length})`}
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
              {row.kind === "section" ? (
                <SectionHeader
                  context={context}
                  index={virtual.index}
                  section={row.section}
                />
              ) : (
                <ItemRow
                  context={context}
                  index={virtual.index}
                  item={row.item}
                />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * The structured Outline: add, select, reorder (Move up/Move down or drag),
 * group, inspect, and Open Source Record without a pointer. Selection and the
 * inspected row are session-only and never persisted.
 */
export function MoodboardOutline(props: MoodboardOutlineProps) {
  const model = useOutlineModel(props);
  const virtualized = model.rows.length > OUTLINE_VIRTUALIZE_THRESHOLD;
  return (
    <section
      aria-label={MOODBOARD_UI_LABELS.outline}
      className="space-y-3"
      data-virtualized={virtualized}
    >
      <h3 className="font-medium">{MOODBOARD_UI_LABELS.outline}</h3>
      {props.addControls}
      {model.rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No items yet.</p>
      ) : null}
      {virtualized ? (
        <VirtualOutline {...model} />
      ) : (
        <StaticOutline {...model} />
      )}
    </section>
  );
}
