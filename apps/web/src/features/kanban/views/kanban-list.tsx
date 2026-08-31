import { Button } from "@cantiara/ui/components/button";
import { cn } from "@cantiara/ui/lib/utils";
import { useCallback } from "react";

import {
	type CardVisibleField,
	KANBAN_COPY,
	type KanbanCard,
	type KanbanListView,
} from "../store/present-board";

export default function KanbanList({
	list,
	onOpenSourceRecord,
	onSortField,
	selectedWorkId,
	sortField,
}: {
	list: KanbanListView;
	onOpenSourceRecord: (workId: string) => void;
	onSortField: (field: CardVisibleField) => void;
	selectedWorkId: string | null;
	sortField: CardVisibleField | null;
}) {
	return (
		<section aria-label={KANBAN_COPY.list} className="flex flex-col gap-2">
			<div className="flex flex-wrap gap-1">
				{list.visibleFields.map((field) => (
					<ListSortFieldButton
						field={field}
						key={field}
						onSortField={onSortField}
						pressed={sortField === field}
					/>
				))}
			</div>
			<ul className="flex flex-col">
				{list.rows.map((row) => (
					<li key={row.workId}>
						<KanbanListRow
							onOpenSourceRecord={onOpenSourceRecord}
							row={row}
							selected={row.workId === selectedWorkId}
						/>
					</li>
				))}
			</ul>
		</section>
	);
}

function ListSortFieldButton({
	field,
	onSortField,
	pressed,
}: {
	field: CardVisibleField;
	onSortField: (field: CardVisibleField) => void;
	pressed: boolean;
}) {
	const onClick = useCallback(() => {
		onSortField(field);
	}, [field, onSortField]);
	return (
		<Button
			aria-pressed={pressed}
			onClick={onClick}
			size="xs"
			type="button"
			variant={pressed ? "default" : "outline"}
		>
			{field}
		</Button>
	);
}

function KanbanListRow({
	onOpenSourceRecord,
	row,
	selected,
}: {
	onOpenSourceRecord: (workId: string) => void;
	row: KanbanCard;
	selected: boolean;
}) {
	const onOpen = useCallback(() => {
		onOpenSourceRecord(row.workId);
	}, [onOpenSourceRecord, row.workId]);
	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-2 border-border border-b px-1 py-1.5",
				selected && "bg-muted"
			)}
		>
			<button
				className="min-w-0 flex-1 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onClick={onOpen}
				type="button"
			>
				<span className="font-mono text-muted-foreground text-xs">
					{row.key}
				</span>{" "}
				{row.title}
				<span className="ml-2 text-muted-foreground text-xs">
					{row.summary
						.map((field) => `${field.field} ${field.value}`)
						.join(" · ")}
				</span>
			</button>
			<Button onClick={onOpen} size="xs" type="button" variant="outline">
				{KANBAN_COPY.openSourceRecord}
			</Button>
		</div>
	);
}
