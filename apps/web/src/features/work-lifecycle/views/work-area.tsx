import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import CustomFieldFilter from "@/features/custom-fields/forms/custom-field-filter";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import TagFilter from "@/features/tags/views/tag-filter";
import { orpc } from "@/utils/orpc";

import CreateWorkForm from "../forms/create-work-form";
import { WORK_LIFECYCLE_COPY } from "../forms/work-lifecycle-copy";
import ScopeTree from "./scope-tree";
import WorkDetail from "./work-detail";
import WorkList from "./work-list";
import { nextSelectedWorkId } from "./work-selection";

export default function WorkArea({ projectId }: { projectId: string }) {
	const [archiveFilter, setArchiveFilter] = useState(false);
	const [filteredIds, setFilteredIds] = useState<string[] | null>(null);
	const [tagFilter, setTagFilter] = useState("");
	const work = useQuery(
		orpc.workLifecycle.list.queryOptions({
			input: { archived: archiveFilter, projectId },
		})
	);
	const suggestions = useQuery(
		orpc.tags.suggest.queryOptions({ input: { projectId } })
	);
	const workTags = useQuery(
		orpc.tags.listWorkTags.queryOptions({ input: { projectId } })
	);
	const taggedRecords = useQuery({
		...orpc.tags.listRecords.queryOptions({
			input: { tagId: tagFilter },
		}),
		enabled: tagFilter !== "",
	});
	const [selectedId, setSelectedId] = useState<string | null>(null);

	const onSelect = useCallback((id: string) => {
		setSelectedId((current) => nextSelectedWorkId(current, id));
	}, []);
	const onOpenSourceRecord = useCallback((id: string) => {
		setSelectedId(id);
	}, []);
	const onClose = useCallback(() => {
		setSelectedId(null);
	}, []);
	const onCreated = useCallback((workId: string) => {
		setSelectedId(workId);
		setArchiveFilter(false);
	}, []);
	const onToggleArchiveFilter = useCallback(() => {
		setArchiveFilter((current) => !current);
		setSelectedId(null);
	}, []);
	const onTagFilter = useCallback((tagId: string) => {
		setTagFilter(tagId);
	}, []);

	useEffect(() => {
		if (!selectedId) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setSelectedId(null);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => {
			window.removeEventListener("keydown", onKeyDown);
		};
	}, [selectedId]);

	const tagsByWork = useMemo(() => {
		const map = new Map<string, string[]>();
		for (const row of workTags.data ?? []) {
			map.set(row.workId, row.tagIds);
		}
		return map;
	}, [workTags.data]);
	const tagName = useMemo(() => {
		const map = new Map<string, string>();
		for (const tag of suggestions.data ?? []) {
			map.set(tag.id, tag.name);
		}
		return map;
	}, [suggestions.data]);

	if (work.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (work.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}
	if (tagFilter !== "" && taggedRecords.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (tagFilter !== "" && taggedRecords.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const taggedIds = new Set(
		(taggedRecords.data ?? [])
			.filter((record) => record.projectId === projectId)
			.map((record) => record.id)
	);
	const items = work.data
		.filter((item) => tagFilter === "" || taggedIds.has(item.id))
		.filter((item) => filteredIds === null || filteredIds.includes(item.id))
		.map((item) => ({
			...item,
			tags: (tagsByWork.get(item.id) ?? [])
				.map((tagId) => tagName.get(tagId))
				.filter((name): name is string => Boolean(name)),
		}));
	const selected = items.find((item) => item.id === selectedId) ?? null;

	return (
		<div className="flex flex-col gap-6">
			<CreateWorkForm onCreated={onCreated} projectId={projectId} />
			<div className="flex flex-wrap items-end gap-3">
				<CustomFieldFilter
					onRecordIds={setFilteredIds}
					projectId={projectId}
					recordType="Work"
				/>
				<Button
					aria-pressed={archiveFilter}
					onClick={onToggleArchiveFilter}
					size="sm"
					type="button"
					variant={archiveFilter ? "secondary" : "ghost"}
				>
					{WORK_LIFECYCLE_COPY.archived}
				</Button>
				<TagFilter
					onChange={onTagFilter}
					tags={suggestions.data ?? []}
					value={tagFilter}
				/>
			</div>
			<WorkList items={items} onSelect={onSelect} selectedId={selectedId} />
			<ScopeTree
				onOpenSourceRecord={onOpenSourceRecord}
				openedRecordId={selectedId}
				projectId={projectId}
			/>
			{selected ? (
				<WorkDetail
					appliedTagIds={tagsByWork.get(selected.id) ?? []}
					candidates={items
						.filter((item) => item.id !== selected.id)
						.map((item) => ({
							id: item.id,
							key: item.key,
							title: item.title,
						}))}
					onClose={onClose}
					onDuplicated={onCreated}
					onMerged={onCreated}
					onOpenSourceRecord={onOpenSourceRecord}
					projectId={projectId}
					work={selected}
					works={items}
				/>
			) : null}
		</div>
	);
}
