import WorkList from "@/features/work-lifecycle/views/work-list";

import { BACKLOG_COPY } from "./backlog-copy";

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
	selectedId,
}: {
	bulkSelectedIds: string[];
	items: PreparedBacklogItemView[];
	onSelect: (id: string) => void;
	onToggleBulkSelect: (id: string, selected: boolean) => void;
	selectedId: string | null;
}) {
	return (
		<div className="flex flex-col gap-3">
			<h2 className="font-medium text-sm">{BACKLOG_COPY.backlog}</h2>
			<WorkList
				bulkSelectedIds={bulkSelectedIds}
				items={items}
				onSelect={onSelect}
				onToggleBulkSelect={onToggleBulkSelect}
				selectedId={selectedId}
			/>
		</div>
	);
}
