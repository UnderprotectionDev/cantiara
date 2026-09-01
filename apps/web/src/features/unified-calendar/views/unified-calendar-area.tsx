import { CLIENT_SHELL_COPY as MAIN_FLOW_COPY } from "@cantiara/api/client-shell-failure";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	PointerSensor,
	useDraggable,
	useDroppable,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { ChangeEvent, MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";

import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { useClientShell } from "@/features/web-macos-client/views/client-shell-host";
import { invalidateWork } from "@/features/work-lifecycle/forms/invalidate-work";
import { newIdempotencyKey } from "@/lib/mutation";
import { orpc } from "@/utils/orpc";

import { UNIFIED_CALENDAR_COPY } from "./unified-calendar-copy";
import { presentCalendarDateMovePreview } from "./unified-calendar-date-move";
import { calendarListPresentation } from "./unified-calendar-list-presentation";
import {
	type CalendarDaySection,
	type CalendarKindMark,
	type CalendarVisibleRow,
	calendarDaySections,
} from "./unified-calendar-rows";

type CalendarViewName = "Day" | "Week" | "Month";
type CalendarDateKind = "Planned start" | "Reappear date" | "Target date";

const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface DateMoveDraft {
	fromDate: string;
	kind: CalendarDateKind;
	revision: number;
	toDate: string;
	workId: string;
}

interface LastDateMove {
	historyEntryId: string;
	projectId: string;
	revision: number;
	workId: string;
}

export default function UnifiedCalendarArea() {
	const catalog = useQuery(orpc.unifiedCalendar.catalog.queryOptions());
	const [calendarDay, setCalendarDay] = useState<string | undefined>();
	const [view, setView] = useState<CalendarViewName | undefined>();
	const [projectId, setProjectId] = useState<string>("");
	const [hoverPreview, setHoverPreview] = useState<DateMoveDraft | null>(null);
	const [lastMove, setLastMove] = useState<LastDateMove | null>(null);
	const { attemptOnlineWork, markUnsaved, recordSave } = useClientShell();
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
	);
	const viewInput = {
		...(calendarDay ? { calendarDay } : {}),
		...(view ? { view } : {}),
		...(projectId ? { projectId } : {}),
	};
	const query = useQuery(
		orpc.unifiedCalendar.view.queryOptions({
			input: viewInput,
		})
	);
	const move = useMutation(
		orpc.unifiedCalendar.moveRepresentedDate.mutationOptions()
	);
	const undoMove = useMutation(
		orpc.unifiedCalendar.undoRepresentedDateMove.mutationOptions()
	);
	const copy = catalog.data?.copy ?? UNIFIED_CALENDAR_COPY;
	const selectedDay = calendarDay ?? query.data?.calendarDay ?? "";
	const selectedView = view ?? query.data?.view ?? copy.week;
	const onChangeDay = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setCalendarDay(event.target.value);
	}, []);
	const onPickView = useCallback((event: MouseEvent<HTMLButtonElement>) => {
		setView(event.currentTarget.value as CalendarViewName);
	}, []);
	const onChangeProject = useCallback(
		(event: ChangeEvent<HTMLSelectElement>) => {
			setProjectId(event.target.value);
		},
		[]
	);
	const commitMove = useCallback(
		async (draft: DateMoveDraft) => {
			if (draft.toDate === draft.fromDate) {
				setHoverPreview(null);
				return;
			}
			const projectForWork =
				query.data?.positions.find((row) => row.id === draft.workId)
					?.projectId ??
				query.data?.ranges.find((row) => row.id === draft.workId)?.projectId;
			if (!projectForWork) {
				return;
			}
			markUnsaved();
			const result = attemptOnlineWork("planning-change", () =>
				move.mutateAsync({
					baseRevision: draft.revision,
					idempotencyKey: newIdempotencyKey(),
					kind: draft.kind,
					toDate: draft.toDate,
					workId: draft.workId,
				})
			);
			if (result.status === "refused") {
				return;
			}
			const outcome = await result.value;
			if (outcome.status === "committed" || outcome.status === "replayed") {
				setLastMove({
					historyEntryId: outcome.historyEntryId,
					projectId: projectForWork,
					revision: outcome.work.revision,
					workId: draft.workId,
				});
				await invalidateWork(projectForWork, draft.workId);
				recordSave();
			}
			setHoverPreview(null);
		},
		[attemptOnlineWork, markUnsaved, move, query.data, recordSave]
	);
	const onDragOver = useCallback((event: DragOverEvent) => {
		const overId = event.over?.id;
		const data = event.active.data.current as DateMoveDraft | undefined;
		if (typeof overId !== "string" || !data) {
			return;
		}
		if (!CALENDAR_DAY_PATTERN.test(overId)) {
			return;
		}
		setHoverPreview({ ...data, toDate: overId });
	}, []);
	const onDragEnd = useCallback(
		(event: DragEndEvent) => {
			const overId = event.over?.id;
			const data = event.active.data.current as DateMoveDraft | undefined;
			if (typeof overId !== "string" || !data) {
				setHoverPreview(null);
				return;
			}
			if (!CALENDAR_DAY_PATTERN.test(overId)) {
				setHoverPreview(null);
				return;
			}
			commitMove({ ...data, toDate: overId }).catch(() => undefined);
		},
		[commitMove]
	);
	const onDragCancel = useCallback(() => {
		setHoverPreview(null);
	}, []);
	const onUndo = useCallback(() => {
		if (!lastMove) {
			return;
		}
		markUnsaved();
		const result = attemptOnlineWork("planning-change", () =>
			undoMove.mutateAsync({
				baseRevision: lastMove.revision,
				historyEntryId: lastMove.historyEntryId,
				idempotencyKey: newIdempotencyKey(),
				workId: lastMove.workId,
			})
		);
		if (result.status === "refused") {
			return;
		}
		result.value
			.then(async (outcome) => {
				if (outcome.status === "committed" || outcome.status === "replayed") {
					await invalidateWork(lastMove.projectId, lastMove.workId);
					recordSave();
				}
				setLastMove(null);
			})
			.catch(() => undefined);
	}, [attemptOnlineWork, lastMove, markUnsaved, recordSave, undoMove]);
	const sections = query.data
		? calendarDaySections(query.data.days)
		: undefined;
	const presentation = calendarListPresentation({
		data: sections,
		isError: query.isError,
		isPending: query.isPending,
	});
	const views = query.data?.views ?? [copy.day, copy.week, copy.month];
	const preview = hoverPreview
		? presentCalendarDateMovePreview(hoverPreview)
		: null;

	return (
		<FounderPage title={copy.calendar} wide>
			<div className="mb-8 flex flex-wrap items-end gap-3">
				<Field>
					<FieldLabel htmlFor="calendar-day">{copy.selectedDay}</FieldLabel>
					<Input
						id="calendar-day"
						onChange={onChangeDay}
						type="date"
						value={selectedDay}
					/>
				</Field>
				<fieldset className="flex flex-wrap items-end gap-2 border-0 p-0">
					<legend className="sr-only">{copy.calendar}</legend>
					{views.map((name) => (
						<Button
							aria-pressed={selectedView === name}
							key={name}
							onClick={onPickView}
							type="button"
							value={name}
							variant={selectedView === name ? "default" : "outline"}
						>
							{name}
						</Button>
					))}
				</fieldset>
				<Field className="min-w-56">
					<FieldLabel htmlFor="calendar-project">{copy.project}</FieldLabel>
					<NativeSelect
						id="calendar-project"
						onChange={onChangeProject}
						value={projectId}
					>
						<NativeSelectOption value="">{copy.allProjects}</NativeSelectOption>
						{(query.data?.projects ?? []).map((project) => (
							<NativeSelectOption key={project.id} value={project.id}>
								{project.name}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
			</div>
			{preview ? (
				<p aria-live="polite" role="status">
					{copy.preview}: {preview.label}
				</p>
			) : null}
			{lastMove ? (
				<Button onClick={onUndo} size="sm" type="button" variant="outline">
					{copy.undo}
				</Button>
			) : null}
			<DndContext
				onDragCancel={onDragCancel}
				onDragEnd={onDragEnd}
				onDragOver={onDragOver}
				sensors={sensors}
			>
				<CalendarItems
					copy={copy}
					onConfirmMove={commitMove}
					presentation={presentation}
					selectedView={selectedView}
				/>
			</DndContext>
		</FounderPage>
	);
}

function CalendarItems({
	copy,
	onConfirmMove,
	presentation,
	selectedView,
}: {
	copy: typeof UNIFIED_CALENDAR_COPY;
	onConfirmMove: (draft: DateMoveDraft) => Promise<void>;
	presentation: ReturnType<typeof calendarListPresentation<CalendarDaySection>>;
	selectedView: string;
}) {
	if (presentation.kind === "failed") {
		return <p>{MAIN_FLOW_COPY.failed}</p>;
	}
	if (presentation.kind === "loading") {
		return <p>{copy.loading}</p>;
	}
	if (presentation.kind === "empty") {
		return <p>{copy.empty}</p>;
	}
	return (
		<section aria-label={selectedView}>
			{presentation.items.map((section) => (
				<CalendarDayLane
					copy={copy}
					key={section.date}
					onConfirmMove={onConfirmMove}
					section={section}
				/>
			))}
		</section>
	);
}

function CalendarDayLane({
	copy,
	onConfirmMove,
	section,
}: {
	copy: typeof UNIFIED_CALENDAR_COPY;
	onConfirmMove: (draft: DateMoveDraft) => Promise<void>;
	section: CalendarDaySection;
}) {
	const { isOver, setNodeRef } = useDroppable({ id: section.date });
	return (
		<section
			className={isOver ? "mb-6 rounded-md ring-2 ring-ring" : "mb-6"}
			ref={setNodeRef}
		>
			<h2 className="mb-1 font-medium text-muted-foreground text-sm">
				{section.date}
			</h2>
			<ul aria-label={section.date}>
				{section.rows.map((item) => (
					<CalendarWorkRow
						copy={copy}
						item={item}
						key={item.id}
						onConfirmMove={onConfirmMove}
					/>
				))}
			</ul>
		</section>
	);
}

function CalendarWorkRow({
	copy,
	item,
	onConfirmMove,
}: {
	copy: typeof UNIFIED_CALENDAR_COPY;
	item: CalendarVisibleRow;
	onConfirmMove: (draft: DateMoveDraft) => Promise<void>;
}) {
	return (
		<li className="flex flex-wrap items-center justify-between gap-3 border-border border-b py-3">
			<a
				className="min-w-0 truncate text-sm underline-offset-4 hover:underline"
				href={item.href}
			>
				<span className="font-medium">{item.title}</span>
				<span className="text-muted-foreground">{` · ${item.projectName}`}</span>
			</a>
			<div className="flex flex-col items-end gap-2">
				{item.kinds.map((mark) => (
					<CalendarKindControl
						copy={copy}
						key={`${item.workId}-${mark.kind}`}
						mark={mark}
						onConfirmMove={onConfirmMove}
						revision={item.revision}
						workId={item.workId}
					/>
				))}
			</div>
		</li>
	);
}

function CalendarKindControl({
	copy,
	mark,
	onConfirmMove,
	revision,
	workId,
}: {
	copy: typeof UNIFIED_CALENDAR_COPY;
	mark: CalendarKindMark;
	onConfirmMove: (draft: DateMoveDraft) => Promise<void>;
	revision: number;
	workId: string;
}) {
	const [draft, setDraft] = useState(mark.date);
	const kind = mark.kind as CalendarDateKind;
	useEffect(() => {
		setDraft(mark.date);
	}, [mark.date]);
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useDraggable({
			data: {
				fromDate: mark.date,
				kind,
				revision,
				toDate: mark.date,
				workId,
			} satisfies DateMoveDraft,
			id: `${workId}:${kind}:${mark.date}`,
		});
	const preview =
		draft === mark.date
			? null
			: presentCalendarDateMovePreview({
					fromDate: mark.date,
					kind,
					toDate: draft,
				});
	const onChangeDraft = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setDraft(event.target.value);
	}, []);
	const onCancel = useCallback(() => {
		setDraft(mark.date);
	}, [mark.date]);
	const onConfirm = useCallback(() => {
		onConfirmMove({
			fromDate: mark.date,
			kind,
			revision,
			toDate: draft,
			workId,
		}).catch(() => undefined);
	}, [draft, kind, mark.date, onConfirmMove, revision, workId]);
	return (
		<div
			className="flex flex-wrap items-center justify-end gap-2"
			ref={setNodeRef}
			style={{
				opacity: isDragging ? 0.6 : undefined,
				transform: CSS.Translate.toString(transform),
			}}
		>
			<button
				className="cursor-grab text-muted-foreground text-sm"
				type="button"
				{...listeners}
				{...attributes}
			>
				{mark.kind}
			</button>
			<Input
				aria-label={mark.kind}
				className="w-auto"
				onChange={onChangeDraft}
				type="date"
				value={draft}
			/>
			{preview ? (
				<div className="flex flex-wrap items-center gap-2">
					<p aria-live="polite" role="status">
						{copy.preview}: {preview.label}
					</p>
					<Button onClick={onConfirm} size="sm" type="button">
						{copy.confirm}
					</Button>
					<Button onClick={onCancel} size="sm" type="button" variant="outline">
						{copy.cancel}
					</Button>
				</div>
			) : null}
		</div>
	);
}
