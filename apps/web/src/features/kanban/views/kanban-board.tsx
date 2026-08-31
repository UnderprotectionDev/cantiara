import { Button } from "@cantiara/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@cantiara/ui/components/card";
import { Field, FieldGroup, FieldLabel } from "@cantiara/ui/components/field";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
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
import {
	type ChangeEvent,
	type FormEvent,
	useCallback,
	useMemo,
	useState,
} from "react";

import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { isNonTerminalWorkStatus } from "@/features/work-lifecycle/forms/work-lifecycle-copy";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import {
	KANBAN_CLOSURE_RESULTS,
	KANBAN_COLUMNS,
	KANBAN_COPY,
	KANBAN_REOPEN_TARGETS,
	type KanbanCard,
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
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
	);
	const [closingWorkId, setClosingWorkId] = useState<string | null>(null);
	const [reopeningWorkId, setReopeningWorkId] = useState<string | null>(null);
	const [reopenTarget, setReopenTarget] = useState<string>(
		KANBAN_COPY.inProgress
	);
	const move = useMutation(
		orpc.kanban.moveCard.mutationOptions({
			onSuccess: async (outcome, variables) => {
				if (outcome.status === "committed") {
					await invalidateWork(projectId, variables.workId);
					recordSave();
					return;
				}
				if (
					outcome.status === "rejected" &&
					outcome.reason === "close-step-required"
				) {
					setClosingWorkId(variables.workId);
					return;
				}
				if (
					outcome.status === "rejected" &&
					outcome.reason === "reopen-required"
				) {
					setReopeningWorkId(variables.workId);
				}
			},
		})
	);
	const closeCard = useMutation(
		orpc.kanban.closeCard.mutationOptions({
			onSuccess: async (outcome, variables) => {
				if (outcome.status === "committed") {
					await invalidateWork(projectId, variables.workId);
					recordSave();
					setClosingWorkId(null);
				}
			},
		})
	);
	const reopenCard = useMutation(
		orpc.kanban.reopenCard.mutationOptions({
			onSuccess: async (outcome, variables) => {
				if (outcome.status === "committed") {
					await invalidateWork(projectId, variables.workId);
					recordSave();
					setReopeningWorkId(null);
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
			if (targetStatus === KANBAN_COPY.closed) {
				setClosingWorkId(workId);
				setReopeningWorkId(null);
				return;
			}
			const current = items.find((item) => item.id === workId);
			if (current?.status === KANBAN_COPY.closed) {
				setReopeningWorkId(workId);
				setReopenTarget(targetStatus);
				setClosingWorkId(null);
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
		[attemptOnlineWork, items, move, revisionById]
	);
	const onCancelClose = useCallback(() => {
		setClosingWorkId(null);
	}, []);
	const onCancelReopen = useCallback(() => {
		setReopeningWorkId(null);
	}, []);
	const onClose = useCallback(
		(workId: string, result: string, reason: string) => {
			const revision = revisionById.get(workId);
			if (revision === undefined) {
				return;
			}
			attemptOnlineWork("record-create", () =>
				closeCard.mutateAsync({
					baseRevision: revision,
					idempotencyKey: newIdempotencyKey(),
					reason: reason === "" ? undefined : reason,
					result,
					workId,
				})
			);
		},
		[attemptOnlineWork, closeCard, revisionById]
	);
	const onReopen = useCallback(
		(workId: string, targetStatus: string, confirmed: boolean) => {
			const revision = revisionById.get(workId);
			if (revision === undefined) {
				return;
			}
			attemptOnlineWork("record-create", () =>
				reopenCard.mutateAsync({
					baseRevision: revision,
					confirmed,
					idempotencyKey: newIdempotencyKey(),
					targetStatus,
					workId,
				})
			);
		},
		[attemptOnlineWork, reopenCard, revisionById]
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
			<h2 className="font-medium text-sm">{KANBAN_COPY.board}</h2>
			<DndContext onDragEnd={onDragEnd} sensors={sensors}>
				<div className="grid gap-3 md:grid-cols-4">
					{board.columns.map((column) => (
						<KanbanColumnLane
							cards={column.cards}
							closingWorkId={closingWorkId}
							key={column.status}
							onCancelClose={onCancelClose}
							onCancelReopen={onCancelReopen}
							onClose={onClose}
							onMove={onMove}
							onOpenSourceRecord={onOpenSourceRecord}
							onReopen={onReopen}
							reopeningWorkId={reopeningWorkId}
							reopenTarget={reopenTarget}
							selectedWorkId={selectedWorkId}
							status={column.status}
						/>
					))}
				</div>
			</DndContext>
		</section>
	);
}

function KanbanColumnLane({
	cards,
	closingWorkId,
	onCancelClose,
	onCancelReopen,
	onClose,
	onMove,
	onOpenSourceRecord,
	onReopen,
	reopenTarget,
	reopeningWorkId,
	selectedWorkId,
	status,
}: {
	cards: KanbanCard[];
	closingWorkId: string | null;
	onCancelClose: () => void;
	onCancelReopen: () => void;
	onClose: (workId: string, result: string, reason: string) => void;
	onMove: (workId: string, targetStatus: string) => void;
	onOpenSourceRecord: (workId: string) => void;
	onReopen: (workId: string, targetStatus: string, confirmed: boolean) => void;
	reopenTarget: string;
	reopeningWorkId: string | null;
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
							closing={card.workId === closingWorkId}
							onCancelClose={onCancelClose}
							onCancelReopen={onCancelReopen}
							onClose={onClose}
							onMove={onMove}
							onOpenSourceRecord={onOpenSourceRecord}
							onReopen={onReopen}
							reopening={card.workId === reopeningWorkId}
							reopenTarget={reopenTarget}
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
	closing,
	onCancelClose,
	onCancelReopen,
	onClose,
	onMove,
	onOpenSourceRecord,
	onReopen,
	reopenTarget,
	reopening,
	selected,
}: {
	card: KanbanCard;
	closing: boolean;
	onCancelClose: () => void;
	onCancelReopen: () => void;
	onClose: (workId: string, result: string, reason: string) => void;
	onMove: (workId: string, targetStatus: string) => void;
	onOpenSourceRecord: (workId: string) => void;
	onReopen: (workId: string, targetStatus: string, confirmed: boolean) => void;
	reopenTarget: string;
	reopening: boolean;
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
	const onStartReopen = useCallback(() => {
		onMove(card.workId, KANBAN_COPY.inProgress);
	}, [card.workId, onMove]);
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
				{closing ? (
					<KanbanClosureStep
						onCancel={onCancelClose}
						onClose={onClose}
						workId={card.workId}
					/>
				) : null}
				{reopening ? (
					<KanbanReopenStep
						onCancel={onCancelReopen}
						onReopen={onReopen}
						targetStatus={reopenTarget}
						workId={card.workId}
					/>
				) : null}
				{!(closing || reopening) && isNonTerminalWorkStatus(card.status) ? (
					<NativeSelect
						aria-label={KANBAN_COPY.kanban}
						onChange={onStatusChange}
						size="sm"
						value={card.status}
					>
						{KANBAN_COLUMNS.map((status) => (
							<NativeSelectOption key={status} value={status}>
								{status}
							</NativeSelectOption>
						))}
					</NativeSelect>
				) : null}
				{!(closing || reopening) && card.status === KANBAN_COPY.closed ? (
					<Button
						onClick={onStartReopen}
						size="xs"
						type="button"
						variant="outline"
					>
						{KANBAN_COPY.reopen}
					</Button>
				) : null}
				<Button onClick={onOpen} size="xs" type="button" variant="outline">
					{KANBAN_COPY.openSourceRecord}
				</Button>
			</CardContent>
		</Card>
	);
}

function KanbanClosureStep({
	onCancel,
	onClose,
	workId,
}: {
	onCancel: () => void;
	onClose: (workId: string, result: string, reason: string) => void;
	workId: string;
}) {
	const [result, setResult] = useState<string>(KANBAN_COPY.completed);
	const [reason, setReason] = useState("");
	const onResultChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setResult(event.currentTarget.value);
		},
		[]
	);
	const onReasonChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			setReason(event.currentTarget.value);
		},
		[]
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			onClose(workId, result, reason);
		},
		[onClose, reason, result, workId]
	);
	return (
		<form
			aria-label={KANBAN_COPY.closed}
			className="flex flex-col gap-2"
			onSubmit={onSubmit}
		>
			<FieldGroup className="flex-col gap-2">
				<Field>
					<FieldLabel htmlFor={`kanban-close-result-${workId}`}>
						{KANBAN_COPY.completed}
					</FieldLabel>
					<NativeSelect
						id={`kanban-close-result-${workId}`}
						onChange={onResultChange}
						size="sm"
						value={result}
					>
						{KANBAN_CLOSURE_RESULTS.map((closureResult) => (
							<NativeSelectOption key={closureResult} value={closureResult}>
								{closureResult}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel htmlFor={`kanban-close-reason-${workId}`}>
						{KANBAN_COPY.reason}
					</FieldLabel>
					<Textarea
						id={`kanban-close-reason-${workId}`}
						onChange={onReasonChange}
						value={reason}
					/>
				</Field>
			</FieldGroup>
			<div className="flex flex-wrap gap-2">
				<Button onClick={onCancel} size="xs" type="button" variant="ghost">
					{KANBAN_COPY.cancel}
				</Button>
				<Button size="xs" type="submit">
					{result}
				</Button>
			</div>
		</form>
	);
}

function KanbanReopenStep({
	onCancel,
	onReopen,
	targetStatus,
	workId,
}: {
	onCancel: () => void;
	onReopen: (workId: string, targetStatus: string, confirmed: boolean) => void;
	targetStatus: string;
	workId: string;
}) {
	const [status, setStatus] = useState<string>(
		isNonTerminalWorkStatus(targetStatus)
			? targetStatus
			: KANBAN_COPY.inProgress
	);
	const [confirmed, setConfirmed] = useState(false);
	const onStatusChange = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setStatus(event.currentTarget.value);
		},
		[]
	);
	const onSubmit = useCallback(
		(event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			if (!confirmed) {
				setConfirmed(true);
				return;
			}
			onReopen(workId, status, true);
		},
		[confirmed, onReopen, status, workId]
	);
	return (
		<form
			aria-label={KANBAN_COPY.reopen}
			className="flex flex-col gap-2"
			onSubmit={onSubmit}
		>
			<Field>
				<FieldLabel htmlFor={`kanban-reopen-status-${workId}`}>
					{KANBAN_COPY.reopen}
				</FieldLabel>
				<NativeSelect
					id={`kanban-reopen-status-${workId}`}
					onChange={onStatusChange}
					size="sm"
					value={status}
				>
					{KANBAN_REOPEN_TARGETS.map((reopenStatus) => (
						<NativeSelectOption key={reopenStatus} value={reopenStatus}>
							{reopenStatus}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Field>
			<div className="flex flex-wrap gap-2">
				<Button onClick={onCancel} size="xs" type="button" variant="ghost">
					{KANBAN_COPY.cancel}
				</Button>
				<Button size="xs" type="submit">
					{confirmed ? KANBAN_COPY.confirmReopen : KANBAN_COPY.reopen}
				</Button>
			</div>
		</form>
	);
}

function isKanbanStatus(value: string): value is KanbanColumnStatus {
	return (KANBAN_COLUMNS as readonly string[]).includes(value);
}
