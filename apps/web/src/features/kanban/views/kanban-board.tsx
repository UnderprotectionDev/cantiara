import { Button } from "@cantiara/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cantiara/ui/components/card";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	type ChangeEvent,
	type FormEvent,
	useCallback,
	useMemo,
	useState,
} from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import {
	isNonTerminalWorkStatus,
	NON_TERMINAL_WORK_STATUSES,
} from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import {
	collapseKanbanColumn,
	KANBAN_COPY,
	type KanbanBoardView,
	type KanbanCard,
	type KanbanColumn,
	type KanbanColumnStatus,
	presentKanbanBoard,
} from "../store/present-board";

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
	configurationMode = false,
	items,
	onOpenSourceRecord,
	projectId,
	selectedWorkId,
}: {
	configurationMode?: boolean;
	items: BoardWorkItem[];
	onOpenSourceRecord: (workId: string) => void;
	projectId: string;
	selectedWorkId: string | null;
}) {
	const { attemptOnlineWork, recordSave } = useClientShell();
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
	);
	const [collapsedStatuses, setCollapsedStatuses] = useState<
		KanbanColumnStatus[]
	>([]);
	const remote = useQuery(
		orpc.kanban.board.queryOptions({ input: { projectId } })
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
	const saveLimits = useMutation(
		orpc.kanban.saveLimits.mutationOptions({
			onSuccess: async () => {
				await invalidateWork(projectId, projectId);
				recordSave();
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
	const presented = remote.data ?? presentKanbanBoard(records);
	const board = useMemo(
		() =>
			collapsedStatuses.reduce(
				(current, status) => collapseKanbanColumn(current, status),
				presented as KanbanBoardView
			),
		[collapsedStatuses, presented]
	);
	const revisionById = useMemo(() => {
		const map = new Map<string, number>();
		for (const item of items) {
			map.set(item.id, item.revision);
		}
		for (const column of board.columns) {
			for (const card of column.cards) {
				if (!map.has(card.workId)) {
					map.set(card.workId, card.revision);
				}
			}
		}
		return map;
	}, [board.columns, items]);
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
	const onToggleCollapse = useCallback((status: KanbanColumnStatus) => {
		setCollapsedStatuses((current) =>
			current.includes(status)
				? current.filter((item) => item !== status)
				: [...current, status]
		);
	}, []);
	const onSaveLimits = useCallback(
		(next: {
			focusThreshold: number | null;
			softWipLimits: Array<{ limit: number | null; status: string }>;
		}) => {
			attemptOnlineWork("record-create", () =>
				saveLimits.mutateAsync({
					focusThreshold: next.focusThreshold,
					projectId,
					softWipLimits: next.softWipLimits,
				})
			);
		},
		[attemptOnlineWork, projectId, saveLimits]
	);

	const onSaveFocus = useCallback(
		(focusThreshold: number | null) => {
			onSaveLimits({
				focusThreshold,
				softWipLimits: board.columns.map((column) => ({
					limit: column.softWip.limit,
					status: column.status,
				})),
			});
		},
		[board.columns, onSaveLimits]
	);
	const onSaveColumnLimit = useCallback(
		(status: string, limit: number | null) => {
			onSaveLimits({
				focusThreshold: board.focus.threshold,
				softWipLimits: board.columns.map((item) => ({
					limit: item.status === status ? limit : item.softWip.limit,
					status: item.status,
				})),
			});
		},
		[board.columns, board.focus.threshold, onSaveLimits]
	);

	return (
		<section aria-label={KANBAN_COPY.kanban} className="flex flex-col gap-3">
			<h2 className="font-medium text-sm">{KANBAN_COPY.board}</h2>
			<p className="text-muted-foreground text-sm">
				{KANBAN_COPY.inProgressCount}: {board.inProgressCount}
				{typeof board.focus.threshold === "number" ? (
					<span
						className="ml-2 font-medium"
						role={board.focus.mark ? "status" : undefined}
					>
						{KANBAN_COPY.focusThreshold}
						{board.focus.mark ? ` ${board.focus.mark}` : ""} ·{" "}
						{board.focus.count}/{board.focus.threshold}
					</span>
				) : null}
			</p>
			{configurationMode ? (
				<FocusThresholdField
					disabled={saveLimits.isPending}
					onSave={onSaveFocus}
					value={board.focus.threshold}
				/>
			) : null}
			<DndContext onDragEnd={onDragEnd} sensors={sensors}>
				<div className="grid gap-3 md:grid-cols-4">
					{board.columns.map((column) => (
						<KanbanColumnLane
							column={column}
							configurationMode={configurationMode}
							key={column.status}
							onMove={onMove}
							onOpenSourceRecord={onOpenSourceRecord}
							onSaveColumnLimit={onSaveColumnLimit}
							onToggleCollapse={onToggleCollapse}
							selectedWorkId={selectedWorkId}
						/>
					))}
				</div>
			</DndContext>
		</section>
	);
}

function KanbanColumnLane({
	column,
	configurationMode,
	onMove,
	onOpenSourceRecord,
	onSaveColumnLimit,
	onToggleCollapse,
	selectedWorkId,
}: {
	column: KanbanColumn;
	configurationMode: boolean;
	onMove: (workId: string, targetStatus: string) => void;
	onOpenSourceRecord: (workId: string) => void;
	onSaveColumnLimit: (status: string, limit: number | null) => void;
	onToggleCollapse: (status: KanbanColumnStatus) => void;
	selectedWorkId: string | null;
}) {
	const { isOver, setNodeRef } = useDroppable({ id: column.status });
	const onCollapse = useCallback(() => {
		onToggleCollapse(column.status);
	}, [column.status, onToggleCollapse]);
	const onSaveLimit = useCallback(
		(limit: number | null) => {
			onSaveColumnLimit(column.status, limit);
		},
		[column.status, onSaveColumnLimit]
	);
	return (
		<section
			aria-label={column.status}
			className={cn(
				"flex min-h-48 flex-col gap-2 border p-2",
				isOver ? "bg-muted/70" : "bg-muted/20"
			)}
			ref={setNodeRef}
		>
			<div className="flex items-start justify-between gap-2">
				<h3 className="font-medium text-xs">
					{column.status}{" "}
					<span className="text-muted-foreground">{column.count}</span>
					{typeof column.softWip.limit === "number" ? (
						<span
							className="ml-1 font-medium"
							role={column.softWip.mark ? "status" : undefined}
						>
							{KANBAN_COPY.softWip}
							{column.softWip.mark ? ` ${column.softWip.mark}` : ""} ·{" "}
							{column.softWip.count}/{column.softWip.limit}
						</span>
					) : null}
				</h3>
				<Button
					aria-expanded={!column.collapsed}
					onClick={onCollapse}
					size="xs"
					type="button"
					variant="ghost"
				>
					{column.collapsed ? KANBAN_COPY.expand : KANBAN_COPY.collapse}
				</Button>
			</div>
			{column.collapsed && column.openBlockerCount > 0 ? (
				<p className="text-xs">
					{KANBAN_COPY.openBlocker}: {column.openBlockerCount}
				</p>
			) : null}
			{configurationMode ? (
				<SoftWipField
					onSave={onSaveLimit}
					status={column.status}
					value={column.softWip.limit}
				/>
			) : null}
			{column.collapsed ? null : (
				<ul className="flex flex-col gap-2">
					{column.cards.map((card) => (
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
			)}
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
					{card.timeInCurrentStatus ? (
						<div className="flex justify-between gap-2">
							<dt>{KANBAN_COPY.timeInStatus}</dt>
							<dd className="text-foreground">{card.timeInCurrentStatus}</dd>
						</div>
					) : null}
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

function FocusThresholdField({
	disabled,
	onSave,
	value,
}: {
	disabled: boolean;
	onSave: (value: number | null) => void;
	value: number | null;
}) {
	const [draft, setDraft] = useState(value === null ? "" : String(value));
	const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setDraft(event.currentTarget.value);
	}, []);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			onSave(parseOptionalLimit(draft));
		},
		[draft, onSave]
	);
	return (
		<form className="flex max-w-xs items-end gap-2" onSubmit={onSubmit}>
			<Field>
				<FieldLabel htmlFor="focus-threshold">
					{KANBAN_COPY.focusThreshold}
				</FieldLabel>
				<Input
					id="focus-threshold"
					inputMode="numeric"
					onChange={onChange}
					value={draft}
				/>
			</Field>
			<Button disabled={disabled} size="sm" type="submit">
				{KANBAN_COPY.focusThreshold}
			</Button>
		</form>
	);
}

function SoftWipField({
	onSave,
	status,
	value,
}: {
	onSave: (value: number | null) => void;
	status: string;
	value: number | null;
}) {
	const [draft, setDraft] = useState(value === null ? "" : String(value));
	const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setDraft(event.currentTarget.value);
	}, []);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			onSave(parseOptionalLimit(draft));
		},
		[draft, onSave]
	);
	return (
		<form className="flex flex-col gap-1" onSubmit={onSubmit}>
			<Field>
				<FieldLabel htmlFor={`soft-wip-${status}`}>
					{KANBAN_COPY.softWip}
				</FieldLabel>
				<Input
					id={`soft-wip-${status}`}
					inputMode="numeric"
					onChange={onChange}
					value={draft}
				/>
			</Field>
			<Button size="xs" type="submit">
				{KANBAN_COPY.softWip}
			</Button>
		</form>
	);
}

function parseOptionalLimit(value: string): number | null {
	const trimmed = value.trim();
	if (trimmed === "") {
		return null;
	}
	const parsed = Number(trimmed);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return null;
	}
	return parsed;
}

function isKanbanStatus(value: string): value is KanbanColumnStatus {
	return (
		value === KANBAN_COPY.notStarted ||
		value === KANBAN_COPY.inProgress ||
		value === KANBAN_COPY.blocked ||
		value === KANBAN_COPY.closed
	);
}
