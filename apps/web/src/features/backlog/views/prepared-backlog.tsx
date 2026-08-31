import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { cn } from "@cantiara/ui/lib/utils";
import {
	DndContext,
	type DragEndEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "@tanstack/react-query";
import { type ChangeEvent, type MouseEvent, useCallback } from "react";

import { BULK_EDITING_COPY } from "@/features/bulk-editing/views/bulk-editing-copy";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { WORK_LIFECYCLE_COPY } from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import WorkList from "@/features/work-lifecycle/views/work-list";
import { orpc } from "@/utils/orpc";

import { BACKLOG_COPY, BACKLOG_SORTS, type BacklogSort } from "./backlog-copy";

interface PreparedBacklogItemView {
	closureResult?: string | null;
	id: string;
	key: string;
	status: string;
	tags?: string[];
	title: string;
	type: string;
}

export default function PreparedBacklog({
	bulkSelectedIds,
	items,
	onSelect,
	onToggleBulkSelect,
	presentationSort,
	projectId,
	selectedId,
}: {
	bulkSelectedIds: string[];
	items: PreparedBacklogItemView[];
	onSelect: (id: string) => void;
	onToggleBulkSelect: (id: string, selected: boolean) => void;
	presentationSort: BacklogSort;
	projectId: string;
	selectedId: string | null;
}) {
	const { attemptOnlineWork, recordSave } = useClientShell();
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
	);
	const manual = presentationSort === BACKLOG_COPY.manualOrder;
	const reorder = useMutation(orpc.backlog.reorder.mutationOptions());
	const savePresentation = useMutation(
		orpc.backlog.savePresentation.mutationOptions()
	);

	const persistOrder = useCallback(
		(workIds: string[]) => {
			attemptOnlineWork("planning-change", () =>
				reorder.mutateAsync({ projectId, workIds }).then(async (outcome) => {
					if (outcome.status === "committed") {
						const [workId] = workIds;
						if (workId) {
							await invalidateWork(projectId, workId);
						}
						recordSave();
					}
					return outcome;
				})
			);
		},
		[attemptOnlineWork, projectId, recordSave, reorder]
	);

	const onSortChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			const sort = event.currentTarget.value as BacklogSort;
			attemptOnlineWork("planning-change", () =>
				savePresentation
					.mutateAsync({ projectId, sort })
					.then(async (outcome) => {
						if (outcome.status === "committed") {
							const [first] = items;
							if (first) {
								await invalidateWork(projectId, first.id);
							}
							recordSave();
						}
						return outcome;
					})
			);
		},
		[attemptOnlineWork, items, projectId, recordSave, savePresentation]
	);

	const onMove = useCallback(
		(workId: string, direction: number) => {
			const index = items.findIndex((item) => item.id === workId);
			const next = index + direction;
			if (index < 0 || next < 0 || next >= items.length) {
				return;
			}
			const workIds = items.map((item) => item.id);
			const [moved] = workIds.splice(index, 1);
			if (!moved) {
				return;
			}
			workIds.splice(next, 0, moved);
			persistOrder(workIds);
		},
		[items, persistOrder]
	);

	const onDragEnd = useCallback(
		(event: DragEndEvent) => {
			const overId = event.over?.id;
			if (typeof overId !== "string") {
				return;
			}
			const from = items.findIndex(
				(item) => item.id === String(event.active.id)
			);
			const to = items.findIndex((item) => item.id === overId);
			if (from < 0 || to < 0 || from === to) {
				return;
			}
			const workIds = items.map((item) => item.id);
			const [moved] = workIds.splice(from, 1);
			if (!moved) {
				return;
			}
			workIds.splice(to, 0, moved);
			persistOrder(workIds);
		},
		[items, persistOrder]
	);

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-3">
				<h2 className="font-medium text-sm">{BACKLOG_COPY.backlog}</h2>
				<NativeSelect
					aria-label={BACKLOG_COPY.manualOrder}
					onChange={onSortChange}
					value={presentationSort}
				>
					{BACKLOG_SORTS.map((sort) => (
						<NativeSelectOption key={sort} value={sort}>
							{sort}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</div>
			{manual ? (
				<DndContext onDragEnd={onDragEnd} sensors={sensors}>
					<ManualOrderList
						bulkSelectedIds={bulkSelectedIds}
						items={items}
						onMove={onMove}
						onSelect={onSelect}
						onToggleBulkSelect={onToggleBulkSelect}
						selectedId={selectedId}
					/>
				</DndContext>
			) : (
				<WorkList
					bulkSelectedIds={bulkSelectedIds}
					items={items}
					onSelect={onSelect}
					onToggleBulkSelect={onToggleBulkSelect}
					selectedId={selectedId}
				/>
			)}
		</div>
	);
}

function ManualOrderList({
	bulkSelectedIds,
	items,
	onMove,
	onSelect,
	onToggleBulkSelect,
	selectedId,
}: {
	bulkSelectedIds: string[];
	items: PreparedBacklogItemView[];
	onMove: (workId: string, direction: number) => void;
	onSelect: (id: string) => void;
	onToggleBulkSelect: (id: string, selected: boolean) => void;
	selectedId: string | null;
}) {
	if (items.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				{WORK_LIFECYCLE_COPY.noWork}
			</p>
		);
	}
	return (
		<div className="flex flex-col gap-2">
			<p className="font-medium text-sm">{BULK_EDITING_COPY.bulkEdit}</p>
			<ol aria-label={BACKLOG_COPY.manualOrder} className="flex flex-col">
				{items.map((item, index) => (
					<ManualOrderItem
						bulkSelected={bulkSelectedIds.includes(item.id)}
						index={index}
						item={item}
						key={item.id}
						lastIndex={items.length - 1}
						onMove={onMove}
						onSelect={onSelect}
						onToggleBulkSelect={onToggleBulkSelect}
						selected={item.id === selectedId}
					/>
				))}
			</ol>
		</div>
	);
}

function ManualOrderItem({
	bulkSelected,
	index,
	item,
	lastIndex,
	onMove,
	onSelect,
	onToggleBulkSelect,
	selected,
}: {
	bulkSelected: boolean;
	index: number;
	item: PreparedBacklogItemView;
	lastIndex: number;
	onMove: (workId: string, direction: number) => void;
	onSelect: (id: string) => void;
	onToggleBulkSelect: (id: string, selected: boolean) => void;
	selected: boolean;
}) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({ id: item.id });
	const droppable = useDroppable({ id: item.id });
	const onMoveUp = useCallback(() => {
		onMove(item.id, -1);
	}, [item.id, onMove]);
	const onMoveDown = useCallback(() => {
		onMove(item.id, 1);
	}, [item.id, onMove]);
	const onClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onSelect(event.currentTarget.value);
		},
		[onSelect]
	);
	const onCheckedChange = useCallback(
		(checked: boolean | "indeterminate") => {
			onToggleBulkSelect(item.id, checked === true);
		},
		[item.id, onToggleBulkSelect]
	);
	return (
		<li
			className="flex items-center gap-2"
			ref={droppable.setNodeRef}
			style={{
				opacity: isDragging ? 0.6 : 1,
				transform: CSS.Translate.toString(transform),
			}}
		>
			<button
				aria-label={`${BACKLOG_COPY.manualOrder} ${item.key}`}
				className="cursor-grab px-1 text-muted-foreground text-xs"
				ref={setNodeRef}
				type="button"
				{...listeners}
				{...attributes}
			>
				⋮⋮
			</button>
			<Checkbox
				aria-label={`${BULK_EDITING_COPY.bulkEdit} ${item.key}`}
				checked={bulkSelected}
				className="border-foreground"
				onCheckedChange={onCheckedChange}
			/>
			<button
				aria-pressed={selected}
				className={cn(
					"flex min-w-0 flex-1 items-baseline justify-between gap-3 px-2 py-2 text-left text-sm outline-none transition-colors duration-200 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px",
					selected && "bg-muted"
				)}
				onClick={onClick}
				type="button"
				value={item.id}
			>
				<span className="min-w-0 truncate">
					<span className="font-mono text-muted-foreground text-xs">
						{item.key}
					</span>{" "}
					{item.title}
					{item.tags && item.tags.length > 0 ? (
						<span className="text-muted-foreground">
							{" "}
							· {item.tags.join(", ")}
						</span>
					) : null}
				</span>
				<span className="shrink-0 text-muted-foreground text-xs">
					{item.type} · {item.status}
					{"closureResult" in item && item.closureResult
						? ` · ${item.closureResult}`
						: ""}
				</span>
			</button>
			<div className="flex shrink-0 flex-col gap-1">
				<Button
					disabled={index === 0}
					onClick={onMoveUp}
					size="sm"
					type="button"
					variant="ghost"
				>
					{BACKLOG_COPY.moveUp}
				</Button>
				<Button
					disabled={index === lastIndex}
					onClick={onMoveDown}
					size="sm"
					type="button"
					variant="ghost"
				>
					{BACKLOG_COPY.moveDown}
				</Button>
			</div>
		</li>
	);
}
