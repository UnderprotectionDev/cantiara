import { type MouseEvent, useCallback } from "react";

import { WORK_LIFECYCLE_COPY } from "../forms/work-lifecycle-copy";

export default function WorkList({
	items,
	onSelect,
	selectedId,
}: {
	items: Array<{
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
			<p className="mt-6 text-muted-foreground text-sm">
				{WORK_LIFECYCLE_COPY.noWork}
			</p>
		);
	}
	return (
		<ul className="mt-6 flex flex-col gap-2">
			{items.map((item) => (
				<li key={item.id}>
					<button
						aria-current={item.id === selectedId ? "true" : undefined}
						className="flex w-full items-baseline justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm"
						onClick={onClick}
						type="button"
						value={item.id}
					>
						<span>
							{item.key} {item.title}
						</span>
						<span className="text-muted-foreground">
							{item.type} · {item.status}
						</span>
					</button>
				</li>
			))}
		</ul>
	);
}
