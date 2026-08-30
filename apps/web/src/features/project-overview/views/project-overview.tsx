import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { Skeleton } from "@cantiara/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
	PROJECT_SHELL_COPY,
	projectShellAnchor,
} from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

import { projectOverviewRecordHref } from "./project-overview-record-href";

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
	const onToggle = useCallback((heading: string) => {
		setOpenedHeadings((current) =>
			current.includes(heading)
				? current.filter((item) => item !== heading)
				: [...current, heading]
		);
	}, []);

	if (overview.isPending) {
		return (
			<div className="flex flex-col gap-3">
				<Skeleton className="h-8 w-48" />
				<p>{PROJECT_SHELL_COPY.loading}</p>
			</div>
		);
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
					onToggle={onToggle}
					opened={openedHeadings.includes(module.heading)}
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
							heading={module.heading}
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
	heading,
	openSourceRecord,
	record,
}: {
	heading: string;
	openSourceRecord: string;
	record: OverviewRecordView;
}) {
	const href = projectOverviewRecordHref(heading, record.id);
	return (
		<li>
			{record.title}
			{record.detail ? ` · ${record.detail}` : null}{" "}
			<a className={buttonVariants({ variant: "outline" })} href={href}>
				{openSourceRecord}
			</a>
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
