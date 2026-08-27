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
	const [openedHeading, setOpenedHeading] = useState<string | null>(null);
	const onToggle = useCallback((heading: string) => {
		setOpenedHeading((current) => (current === heading ? null : heading));
	}, []);

	if (overview.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (overview.isError || !overview.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const { data } = overview;

	return (
		<div className="flex flex-col gap-4">
			{data.modules.map((module) => (
				<OverviewModule
					key={module.heading}
					module={module}
					onToggle={onToggle}
					opened={openedHeading === module.heading}
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
	onToggle,
	openSourceRecord,
	opened,
}: {
	module: OverviewModuleView;
	onToggle: (heading: string) => void;
	openSourceRecord: string;
	opened: boolean;
}) {
	const onClick = useCallback(() => {
		onToggle(module.heading);
	}, [module.heading, onToggle]);
	return (
		<section aria-label={module.heading}>
			<h2 className="font-medium text-lg">
				<Button
					aria-expanded={opened}
					onClick={onClick}
					type="button"
					variant="ghost"
				>
					{module.heading} {module.count}
				</Button>
			</h2>
			{opened && module.records.length > 0 ? (
				<ul>
					{module.records.map((record) => (
						<OverviewSourceRow
							key={record.id}
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
	openSourceRecord,
	record,
}: {
	openSourceRecord: string;
	record: OverviewRecordView;
}) {
	return (
		<li>
			{record.title}
			{record.detail ? ` · ${record.detail}` : null}{" "}
			<Button type="button" variant="outline">
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
		<section aria-label={label}>
			<h2 className="font-medium text-lg">{label}</h2>
			{areas.length > 0 ? (
				<ul>
					{areas.map((area) => (
						<li key={area.name}>
							<a href={`#${projectShellAnchor(area.name)}`}>{area.entry}</a>
						</li>
					))}
				</ul>
			) : null}
		</section>
	);
}
