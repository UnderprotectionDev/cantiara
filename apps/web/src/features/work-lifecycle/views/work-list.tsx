import { Checkbox } from "@cantiara/ui/components/checkbox";
import { cn } from "@cantiara/ui/lib/utils";
import { type MouseEvent, useCallback } from "react";

import { BULK_EDITING_COPY } from "@/features/bulk-editing/views/bulk-editing-copy";

import { WORK_LIFECYCLE_COPY } from "../forms/work-lifecycle-copy";

interface WorkListItemView {
	closureResult?: string | null;
	id: string;
	key: string;
	status: string;
	tags?: string[];
	title: string;
	type: string;
}

export default function WorkList({
	bulkSelectedIds,
	items,
	onSelect,
	onToggleBulkSelect,
	selectedId,
}: {
	bulkSelectedIds: string[];
	items: WorkListItemView[];
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
		<ul className="flex flex-col">
			{items.map((item) => (
				<WorkListItem
					bulkSelected={bulkSelectedIds.includes(item.id)}
					item={item}
					key={item.id}
					onSelect={onSelect}
					onToggleBulkSelect={onToggleBulkSelect}
					selected={item.id === selectedId}
				/>
			))}
		</ul>
	);
}

function WorkListItem({
	bulkSelected,
	item,
	onSelect,
	onToggleBulkSelect,
	selected,
}: {
	bulkSelected: boolean;
	item: WorkListItemView;
	onSelect: (id: string) => void;
	onToggleBulkSelect: (id: string, selected: boolean) => void;
	selected: boolean;
}) {
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
		<li className="flex items-center gap-1">
			<Checkbox
				aria-label={`${BULK_EDITING_COPY.bulkEdit} ${item.key}`}
				checked={bulkSelected}
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
		</li>
	);
}
