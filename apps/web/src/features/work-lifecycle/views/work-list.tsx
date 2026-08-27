import { cn } from "@cantiara/ui/lib/utils";
import { type MouseEvent, useCallback } from "react";

import { WORK_LIFECYCLE_COPY } from "../forms/work-lifecycle-copy";

export default function WorkList({
	items,
	onSelect,
	selectedId,
}: {
	items: Array<{
		closureResult?: string | null;
		id: string;
		key: string;
		status: string;
		title: string;
		type: string;
	}>;
	onSelect: (id: string) => void;
	selectedId: string | null;
}) {
	const onClick = useCallback(
		(event: MouseEvent<HTMLButtonElement>) => {
			onSelect(event.currentTarget.value);
		},
		[onSelect]
	);
	if (items.length === 0) {
		return (
			<p className="text-muted-foreground text-sm">
				{WORK_LIFECYCLE_COPY.noWork}
			</p>
		);
	}
	return (
		<ul className="flex flex-col">
			{items.map((item) => {
				const selected = item.id === selectedId;
				return (
					<li key={item.id}>
						<button
							aria-pressed={selected}
							className={cn(
								"flex w-full items-baseline justify-between gap-3 px-2 py-2 text-left text-sm outline-none transition-colors hover:bg-muted/70 focus-visible:ring-1 focus-visible:ring-ring active:translate-y-px",
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
			})}
		</ul>
	);
}
