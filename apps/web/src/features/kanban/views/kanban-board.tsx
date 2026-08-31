import { Button } from "@cantiara/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cantiara/ui/components/card";
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
import { type ChangeEvent, useCallback, useMemo, useState } from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import {
	isNonTerminalWorkStatus,
	NON_TERMINAL_WORK_STATUSES,
} from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import {
	type CardVisibleField,
	KANBAN_COPY,
	type KanbanCard,
	type KanbanColumnStatus,
	presentKanbanBoard,
	presentKanbanList,
	sortKanbanList,
} from "../store/present-board";
import KanbanList from "./kanban-list";

interface BoardWorkItem {
	archived?: boolean;
	closureResult?: string | null;
	id: string;
	key: string;
	lightChecklist?: Array<{ completed: boolean }>;
	revision: number;
	status: string;
	title: string;
	type: string;
}

export default function KanbanBoard({
	items,
	onOpenSourceRecord,
	projectId,
	selectedWorkId,
}: {
	items: BoardWorkItem[];
	onOpenSourceRecord: (workId: string) => void;
	projectId: string;
	selectedWorkId: string | null;
}) {
	const { attemptOnlineWork, recordSave } = useClientShell();
	const [layout, setLayout] = useState<"board" | "list">("board");
	const [sortField, setSortField] = useState<CardVisibleField | null>(null);
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
	);
	const move = useMutation(
		orpc.kanban.moveCard.mutationOptions({
			onSuccess: async (outcome, variables) => {
				if (outcome.status === "committed") {
					await invalidateWork(projectId, variables.workId);
					recordSave();
				}
			},
		})
	);
	const records = useMemo(
		() =>
			items.flatMap((item) => {
				if (!isKanbanStatus(item.status)) {
					return [];
				}
				const checklist = item.lightChecklist ?? [];
				return [
					{
						archived: item.archived,
						checklistCompleted: checklist.filter((entry) => entry.completed)
							.length,
						checklistTotal: checklist.length,
						closureResult: item.closureResult,
						id: item.id,
						key: item.key,
						revision: item.revision,
						status: item.status,
						title: item.title,
						type: item.type,
					},
				];
			}),
		[items]
	);
	const board = presentKanbanBoard(records);
	const list = useMemo(() => {
		const presented = presentKanbanList(records);
		if (!sortField) {
			return presented;
		}
		return sortKanbanList(presented, sortField);
	}, [records, sortField]);
	const onShowBoard = useCallback(() => setLayout("board"), []);
	const onShowList = useCallback(() => setLayout("list"), []);
	const revisionById = useMemo(() => {
		const map = new Map<string, number>();
		for (const item of items) {
			map.set(item.id, item.revision);
		}
		return map;
	}, [items]);
	const onMove = useCallback(
		(workId: string, targetStatus: string) => {
			const revision = revisionById.get(workId);
			if (revision === undefined) {
				return;
			}
			attemptOnlineWork("record-create", () =>
				move.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					targetStatus,
					workId,
				})
			);
		},
		[attemptOnlineWork, move, revisionById]
	);
	const onDragEnd = useCallback(
		(event: DragEndEvent) => {
			const overId = event.over?.id;
			if (typeof overId !== "string") {
				return;
			}
			const workId = String(event.active.id);
			const current = event.active.data.current?.status;
			if (current === overId) {
				return;
			}
			onMove(workId, overId);
		},
		[onMove]
	);

	return (
		<section aria-label={KANBAN_COPY.kanban} className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<h2 className="font-medium text-sm">{KANBAN_COPY.board}</h2>
				<fieldset className="flex gap-1">
					<legend className="sr-only">{KANBAN_COPY.kanban}</legend>
					<Button
						aria-pressed={layout === "board"}
						onClick={onShowBoard}
						size="xs"
						type="button"
						variant={layout === "board" ? "default" : "outline"}
					>
						{KANBAN_COPY.board}
					</Button>
					<Button
						aria-pressed={layout === "list"}
						onClick={onShowList}
						size="xs"
						type="button"
						variant={layout === "list" ? "default" : "outline"}
					>
						{KANBAN_COPY.list}
					</Button>
				</fieldset>
			</div>
			{layout === "list" ? (
				<KanbanList
					list={list}
					onOpenSourceRecord={onOpenSourceRecord}
					onSortField={setSortField}
					selectedWorkId={selectedWorkId}
					sortField={sortField}
				/>
			) : (
				<DndContext onDragEnd={onDragEnd} sensors={sensors}>
					<div className="grid gap-3 md:grid-cols-4">
						{board.columns.map((column) => (
							<KanbanColumnLane
								cards={column.cards}
								key={column.status}
								onMove={onMove}
								onOpenSourceRecord={onOpenSourceRecord}
								selectedWorkId={selectedWorkId}
								status={column.status}
							/>
						))}
					</div>
				</DndContext>
			)}
		</section>
	);
}

function KanbanColumnLane({
	cards,
	onMove,
	onOpenSourceRecord,
	selectedWorkId,
	status,
}: {
	cards: KanbanCard[];
	onMove: (workId: string, targetStatus: string) => void;
	onOpenSourceRecord: (workId: string) => void;
	selectedWorkId: string | null;
	status: KanbanColumnStatus;
}) {
	const { isOver, setNodeRef } = useDroppable({ id: status });
	return (
		<section
			aria-label={status}
			className={cn(
				"flex min-h-48 flex-col gap-2 border p-2",
				isOver ? "bg-muted/70" : "bg-muted/20"
			)}
			ref={setNodeRef}
		>
			<h3 className="font-medium text-xs">
				{status} <span className="text-muted-foreground">{cards.length}</span>
			</h3>
			<ul className="flex flex-col gap-2">
				{cards.map((card) => (
					<li key={card.workId}>
						<KanbanCardItem
							card={card}
							onMove={onMove}
							onOpenSourceRecord={onOpenSourceRecord}
							selected={card.workId === selectedWorkId}
						/>
					</li>
				))}
			</ul>
		</section>
	);
}

function KanbanCardItem({
	card,
	onMove,
	onOpenSourceRecord,
	selected,
}: {
	card: KanbanCard;
	onMove: (workId: string, targetStatus: string) => void;
	onOpenSourceRecord: (workId: string) => void;
	selected: boolean;
}) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			data: { status: card.status },
			id: card.workId,
		});
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			if (event.currentTarget.value === card.status) {
				return;
			}
			onMove(card.workId, event.currentTarget.value);
		},
		[card.status, card.workId, onMove]
	);
	const onOpen = useCallback(() => {
		onOpenSourceRecord(card.workId);
	}, [card.workId, onOpenSourceRecord]);
	return (
		<Card
			className={selected ? "ring-2 ring-ring" : undefined}
			ref={setNodeRef}
			size="sm"
			style={{
				opacity: isDragging ? 0.6 : 1,
				transform: CSS.Translate.toString(transform),
			}}
		>
			<CardHeader className="gap-1">
				<button
					className="cursor-grab text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
					type="button"
					{...listeners}
					{...attributes}
				>
					<CardTitle>
						<span className="font-mono text-muted-foreground">{card.key}</span>{" "}
						{card.title}
					</CardTitle>
				</button>
			</CardHeader>
			<CardContent className="flex flex-col gap-2">
				<dl className="grid gap-0.5 text-muted-foreground text-xs">
					{card.summary.map((field) => (
						<div className="flex justify-between gap-2" key={field.field}>
							<dt>{field.field}</dt>
							<dd className="text-foreground">{field.value}</dd>
						</div>
					))}
				</dl>
				{isNonTerminalWorkStatus(card.status) ? (
					<NativeSelect
						aria-label={KANBAN_COPY.kanban}
						onChange={onStatusChange}
						size="sm"
						value={card.status}
					>
						{NON_TERMINAL_WORK_STATUSES.map((status) => (
							<NativeSelectOption key={status} value={status}>
								{status}
							</NativeSelectOption>
						))}
					</NativeSelect>
				) : null}
				<Button onClick={onOpen} size="xs" type="button" variant="outline">
					{KANBAN_COPY.openSourceRecord}
				</Button>
			</CardContent>
		</Card>
	);
}

function isKanbanStatus(value: string): value is KanbanColumnStatus {
	return (
		value === KANBAN_COPY.notStarted ||
		value === KANBAN_COPY.inProgress ||
		value === KANBAN_COPY.blocked ||
		value === KANBAN_COPY.closed
	);
}
