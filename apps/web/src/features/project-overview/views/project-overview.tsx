import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
	PROJECT_SHELL_COPY,
	projectShellAnchor,
} from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

interface OverviewRecordView {
	detail: string | null;
	id: string;
	title: string;
}

interface OverviewModuleView {
	count: number;
	heading: string;
	records: OverviewRecordView[];
}

interface OverviewAreaView {
	entry: string;
	name: string;
}

export default function ProjectOverview({ projectId }: { projectId: string }) {
	const overview = useQuery(
		orpc.projectOverview.get.queryOptions({ input: { projectId } })
	);
	const [openedHeadings, setOpenedHeadings] = useState<readonly string[]>([]);
	const [openedRecordId, setOpenedRecordId] = useState<string | null>(null);
	const onToggle = useCallback((heading: string) => {
		setOpenedHeadings((current) =>
			current.includes(heading)
				? current.filter((item) => item !== heading)
				: [...current, heading]
		);
	}, []);
	const onOpenSourceRecord = useCallback((recordId: string) => {
		setOpenedRecordId(recordId);
	}, []);

	if (overview.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (overview.isError || !overview.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const { data } = overview;

	return (
		<div className="flex flex-col divide-y border-y">
			{data.modules.map((module) => (
				<OverviewModule
					key={module.heading}
					module={module}
					onOpenSourceRecord={onOpenSourceRecord}
					onToggle={onToggle}
					opened={openedHeadings.includes(module.heading)}
					openedRecordId={openedRecordId}
					openSourceRecord={data.openSourceRecord}
				/>
			))}
			<EnabledAreaEntries
				areas={data.enabledAreas}
				label={data.enabledAreasLabel}
			/>
		</div>
	);
}

function OverviewModule({
	module,
	onOpenSourceRecord,
	onToggle,
	openSourceRecord,
	opened,
	openedRecordId,
}: {
	module: OverviewModuleView;
	onOpenSourceRecord: (recordId: string) => void;
	onToggle: (heading: string) => void;
	openSourceRecord: string;
	opened: boolean;
	openedRecordId: string | null;
}) {
	const onClick = useCallback(() => {
		onToggle(module.heading);
	}, [module.heading, onToggle]);
	return (
		<section aria-label={module.heading}>
			<h2>
				<Button
					aria-expanded={opened}
					aria-label={`${openSourceRecord}: ${module.heading} ${module.count}`}
					className="h-auto w-full justify-between px-0 py-3 font-medium text-sm"
					onClick={onClick}
					type="button"
					variant="ghost"
				>
					<span>{module.heading}</span>
					<span className="font-normal text-muted-foreground tabular-nums">
						{module.count}
					</span>
				</Button>
			</h2>
			{opened && module.records.length > 0 ? (
				<ul className="pb-3">
					{module.records.map((record) => (
						<OverviewSourceRow
							key={record.id}
							onOpenSourceRecord={onOpenSourceRecord}
							opened={openedRecordId === record.id}
							openSourceRecord={openSourceRecord}
							record={record}
						/>
					))}
				</ul>
			) : null}
		</section>
	);
}

function OverviewSourceRow({
	onOpenSourceRecord,
	openSourceRecord,
	opened,
	record,
}: {
	onOpenSourceRecord: (recordId: string) => void;
	openSourceRecord: string;
	opened: boolean;
	record: OverviewRecordView;
}) {
	const onClick = useCallback(() => {
		onOpenSourceRecord(record.id);
	}, [onOpenSourceRecord, record.id]);
	return (
		<li>
			{record.title}
			{record.detail ? ` · ${record.detail}` : null}{" "}
			<Button
				aria-pressed={opened}
				onClick={onClick}
				type="button"
				variant="outline"
			>
				{openSourceRecord}
			</Button>
		</li>
	);
}

function EnabledAreaEntries({
	areas,
	label,
}: {
	areas: readonly OverviewAreaView[];
	label: string;
}) {
	return (
		<section aria-label={label} className="pt-6">
			<h2 className="font-medium text-sm">{label}</h2>
			{areas.length > 0 ? (
				<ul className="mt-2 flex flex-col gap-1">
					{areas.map((area) => (
						<li key={area.name}>
							<a
								className="text-muted-foreground text-sm hover:text-foreground"
								href={`#${projectShellAnchor(area.name)}`}
							>
								{area.entry}
							</a>
						</li>
					))}
				</ul>
			) : null}
		</section>
	);
}
