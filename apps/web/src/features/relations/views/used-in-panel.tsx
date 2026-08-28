import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { RELATIONS_COPY } from "../forms/relations-copy";
import { readUsedIn } from "./read-used-in";
import { usedInQueryKey } from "./used-in-query-key";

interface UsedInRow {
	groupLabel: string;
	id: string;
	key?: string;
	openSourceRecord: boolean;
	sourceRecordId: string;
	title?: string;
}

interface UsedInGroup {
	label: string;
	rows: UsedInRow[];
}

export default function UsedInPanel({
	onOpenSourceRecord,
	workId,
}: {
	onOpenSourceRecord?: (id: string) => void;
	workId: string;
}) {
	const inspect = useQuery({
		queryFn: () => readUsedIn(workId),
		queryKey: usedInQueryKey(workId),
	});
	const usedIn = inspect.data?.usedIn;
	if (!usedIn) {
		return null;
	}
	return (
		<section className="flex flex-col gap-3">
			<h3 className="font-medium text-sm">{usedIn.copy.usedIn}</h3>
			{usedIn.relationBacklinks.map((group) => (
				<UsedInGroupList
					group={group}
					key={`relation:${group.label}`}
					onOpenSourceRecord={onOpenSourceRecord}
				/>
			))}
			{usedIn.usageGroups.map((group) => (
				<UsedInGroupList
					group={group}
					key={`usage:${group.label}`}
					onOpenSourceRecord={onOpenSourceRecord}
				/>
			))}
		</section>
	);
}

function UsedInGroupList({
	group,
	onOpenSourceRecord,
}: {
	group: UsedInGroup;
	onOpenSourceRecord?: (id: string) => void;
}) {
	return (
		<div className="flex flex-col gap-2">
			<h4 className="text-muted-foreground text-xs">{group.label}</h4>
			<ul className="flex flex-col gap-2 text-sm">
				{group.rows.map((row) => (
					<UsedInRowItem
						key={row.id}
						onOpenSourceRecord={onOpenSourceRecord}
						row={row}
					/>
				))}
			</ul>
		</div>
	);
}

function UsedInRowItem({
	onOpenSourceRecord,
	row,
}: {
	onOpenSourceRecord?: (id: string) => void;
	row: UsedInRow;
}) {
	return (
		<li className="flex flex-col gap-1">
			<p>
				{row.key ? (
					<>
						<span className="font-mono text-muted-foreground">
							{row.key}
						</span>{" "}
					</>
				) : null}
				{row.title}
			</p>
			{row.openSourceRecord ? (
				<OpenSourceRecordButton
					onOpen={onOpenSourceRecord}
					recordId={row.sourceRecordId}
				/>
			) : null}
		</li>
	);
}

function OpenSourceRecordButton({
	onOpen,
	recordId,
}: {
	onOpen?: (id: string) => void;
	recordId: string;
}) {
	const onClick = useCallback(() => {
		onOpen?.(recordId);
	}, [onOpen, recordId]);
	return (
		<Button onClick={onClick} size="sm" type="button" variant="ghost">
			{RELATIONS_COPY.openSourceRecord}
		</Button>
	);
}
