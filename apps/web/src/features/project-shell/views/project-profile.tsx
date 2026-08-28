import { Button, buttonVariants } from "@cantiara/ui/components/button";
import { cn } from "@cantiara/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import { useCallback } from "react";

import BoundRecordValuesSurface from "@/features/custom-fields/views/bound-record-values";
import ProjectOverview from "@/features/project-overview/views/project-overview";
import ConfigurationMode from "@/features/project-shell/forms/configuration-mode";
import CopyProjectStructureForm from "@/features/project-shell/forms/copy-project-structure-form";
import FirstOpenExplanation from "@/features/project-shell/forms/first-open-explanation";
import ProjectAreasForm from "@/features/project-shell/forms/project-areas-form";
import {
	type ConfigurationModeEditor,
	PROJECT_SHELL_COPY,
	projectPersistentNav,
	projectShellAnchor,
	type StageState,
} from "@/features/project-shell/forms/project-shell-copy";
import ShortCodeForm from "@/features/project-shell/forms/short-code-form";
import WorkArea from "@/features/work-lifecycle/views/work-area";
import { orpc } from "@/utils/orpc";

const HASH_PREFIX = /^#/;

interface ProjectShellRecord {
	allToolsAreas: readonly {
		enabled: boolean;
		name: string;
		pinned: boolean;
	}[];
	alwaysOnSurfaces: readonly string[];
	enabledAreas: readonly string[];
	firstOpenExplanation: string | null;
	firstOpenExplanationVisible: boolean;
	id: string;
	logoFileName: string | null;
	name: string;
	pinnedAreas: readonly string[];
	problem: string | null;
	revision: number;
	scope: string | null;
	shortCode: string;
	shortCodeLocked: boolean;
	stages: readonly {
		id: string;
		name: string;
		state: StageState;
	}[];
	starterConfiguration: string;
	workStatuses: readonly { label: string; semantic: string }[];
	workViews: readonly string[];
}

export default function ProjectProfile({
	configurationEditor,
	configurationMode,
	onPresentationChange,
	projectId,
}: {
	configurationEditor: ConfigurationModeEditor | null;
	configurationMode: boolean;
	onPresentationChange: (next: {
		editor: ConfigurationModeEditor | null;
		open: boolean;
	}) => void;
	projectId: string;
}) {
	const project = useQuery(
		orpc.projectShell.get.queryOptions({ input: { projectId } })
	);
	const hash = useLocation({ select: (location) => location.hash });
	const onOpenEditor = useCallback(
		(editor: ConfigurationModeEditor) => {
			onPresentationChange({ editor, open: true });
		},
		[onPresentationChange]
	);
	const onToggle = useCallback(() => {
		onPresentationChange({
			editor: null,
			open: !configurationMode,
		});
	}, [configurationMode, onPresentationChange]);
	const onLeaveConfiguration = useCallback(() => {
		if (!configurationMode) {
			return;
		}
		onPresentationChange({ editor: null, open: false });
	}, [configurationMode, onPresentationChange]);

	if (project.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (project.isError || !project.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const { data } = project;
	const navigationAreas = projectPersistentNav(
		data.pinnedAreas,
		data.enabledAreas
	);
	const selectedAnchor = hash.replace(HASH_PREFIX, "");
	const overviewAnchor = projectShellAnchor(PROJECT_SHELL_COPY.overview);
	const allToolsAnchor = projectShellAnchor(PROJECT_SHELL_COPY.allTools);
	const overviewCurrent =
		!configurationMode &&
		(selectedAnchor === "" || selectedAnchor === overviewAnchor);

	return (
		<div className="grid h-full min-h-0 grid-cols-[13rem_minmax(0,1fr)]">
			<aside className="flex h-full min-h-0 flex-col gap-3 border-e px-2 py-3">
				<Button
					aria-pressed={configurationMode}
					className="w-full justify-start"
					onClick={onToggle}
					size="sm"
					type="button"
					variant={configurationMode ? "secondary" : "outline"}
				>
					{PROJECT_SHELL_COPY.configurationMode}
				</Button>
				<nav aria-label={PROJECT_SHELL_COPY.overview}>
					<ul className="flex flex-col gap-0.5">
						<li>
							<ProjectNavLink
								current={overviewCurrent}
								href={`#${overviewAnchor}`}
								label={PROJECT_SHELL_COPY.overview}
								onLeaveConfiguration={onLeaveConfiguration}
							/>
						</li>
						<li>
							<ProjectNavLink
								current={
									!configurationMode && selectedAnchor === allToolsAnchor
								}
								href={`#${allToolsAnchor}`}
								label={PROJECT_SHELL_COPY.allTools}
								onLeaveConfiguration={onLeaveConfiguration}
							/>
						</li>
						{navigationAreas.map((area) => (
							<li key={`pin-${area}`}>
								<ProjectNavLink
									current={
										!configurationMode &&
										selectedAnchor === projectShellAnchor(area)
									}
									href={`#${projectShellAnchor(area)}`}
									label={area}
									onLeaveConfiguration={onLeaveConfiguration}
								/>
							</li>
						))}
					</ul>
				</nav>
				<Link
					className={cn(
						buttonVariants({ size: "sm", variant: "ghost" }),
						"justify-start"
					)}
					to="/projects/new"
				>
					{PROJECT_SHELL_COPY.createProject}
				</Link>
			</aside>
			<main className="min-h-0 overflow-auto px-8 py-8">
				<ProjectBody
					configurationEditor={configurationEditor}
					configurationMode={configurationMode}
					data={data}
					onOpenEditor={onOpenEditor}
					onToggle={onToggle}
					selectedAnchor={selectedAnchor}
				/>
			</main>
		</div>
	);
}

function ProjectNavLink({
	current,
	href,
	label,
	onLeaveConfiguration,
}: {
	current: boolean;
	href: string;
	label: string;
	onLeaveConfiguration: () => void;
}) {
	return (
		<a
			aria-current={current ? "page" : undefined}
			className={cn(
				"block px-2 py-1.5 text-sm transition-colors",
				current
					? "bg-muted font-medium text-foreground"
					: "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
			)}
			href={href}
			onClick={onLeaveConfiguration}
		>
			{label}
		</a>
	);
}

function ProjectBody({
	configurationEditor,
	configurationMode,
	data,
	onOpenEditor,
	onToggle,
	selectedAnchor,
}: {
	configurationEditor: ConfigurationModeEditor | null;
	configurationMode: boolean;
	data: ProjectShellRecord;
	onOpenEditor: (editor: ConfigurationModeEditor) => void;
	onToggle: () => void;
	selectedAnchor: string;
}) {
	const overviewAnchor = projectShellAnchor(PROJECT_SHELL_COPY.overview);
	const allToolsAnchor = projectShellAnchor(PROJECT_SHELL_COPY.allTools);
	const selectedArea = data.allToolsAreas
		.map((area) => area.name)
		.find((area) => projectShellAnchor(area) === selectedAnchor);

	if (configurationMode) {
		return (
			<ConfigurationMode
				areas={data.allToolsAreas}
				editor={configurationEditor}
				onOpenEditor={onOpenEditor}
				onToggle={onToggle}
				open={true}
				projectId={data.id}
				revision={data.revision}
				showToggle={false}
				stages={data.stages}
				workStatuses={data.workStatuses}
				workViews={data.workViews}
			>
				<ShortCodeForm
					key={`${data.id}:${data.revision}:${data.shortCode}`}
					projectId={data.id}
					revision={data.revision}
					shortCode={data.shortCode}
					shortCodeLocked={data.shortCodeLocked}
				/>
				<CopyProjectStructureForm projectId={data.id} />
			</ConfigurationMode>
		);
	}

	if (selectedAnchor === allToolsAnchor) {
		const reservedAnchors = new Set(
			data.alwaysOnSurfaces.map((surface) => projectShellAnchor(surface))
		);
		return (
			<section aria-label={PROJECT_SHELL_COPY.allTools} id={allToolsAnchor}>
				<h1 className="font-semibold text-[1.375rem] tracking-tight">
					{PROJECT_SHELL_COPY.allTools}
				</h1>
				<div className="mt-6">
					<ProjectAreasForm
						areas={data.allToolsAreas}
						label={PROJECT_SHELL_COPY.allTools}
						projectId={data.id}
						reservedAnchors={reservedAnchors}
						revision={data.revision}
						showEnablement={false}
						showRestore={true}
					/>
				</div>
			</section>
		);
	}

	if (selectedArea === "Work") {
		return (
			<section aria-label="Work" id={projectShellAnchor("Work")}>
				<h1 className="font-semibold text-[1.375rem] tracking-tight">Work</h1>
				<p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground text-xs">
					<span>{PROJECT_SHELL_COPY.create}</span>
					<span>{PROJECT_SHELL_COPY.edit}</span>
					<span>{PROJECT_SHELL_COPY.status}</span>
					<span>{PROJECT_SHELL_COPY.planning}</span>
					{data.workViews.map((view) => (
						<span id={projectShellAnchor(view)} key={view}>
							{view}
						</span>
					))}
				</p>
				<div className="mt-6">
					<WorkArea projectId={data.id} />
				</div>
			</section>
		);
	}

	if (selectedArea === "Discovery") {
		return (
			<section aria-label={selectedArea} id={projectShellAnchor(selectedArea)}>
				<h1 className="font-semibold text-[1.375rem] tracking-tight">
					{selectedArea}
				</h1>
				<div className="mt-6">
					<BoundRecordValuesSurface projectId={data.id} recordType="Feedback" />
				</div>
			</section>
		);
	}

	if (selectedArea) {
		return (
			<section aria-label={selectedArea} id={projectShellAnchor(selectedArea)}>
				<h1 className="font-semibold text-[1.375rem] tracking-tight">
					{selectedArea}
				</h1>
				<p className="mt-3 text-muted-foreground text-sm">
					{PROJECT_SHELL_COPY.areaNotAvailable}
				</p>
			</section>
		);
	}

	return (
		<section aria-label={PROJECT_SHELL_COPY.overview} id={overviewAnchor}>
			<h1 className="font-bold text-2xl">{data.name}</h1>
			<p className="text-muted-foreground">
				{PROJECT_SHELL_COPY.active} · {data.starterConfiguration}
			</p>
			{data.firstOpenExplanationVisible && data.firstOpenExplanation ? (
				<FirstOpenExplanation
					body={data.firstOpenExplanation}
					projectId={data.id}
					revision={data.revision}
				/>
			) : null}
			{data.problem ? (
				<p>
					{PROJECT_SHELL_COPY.problem} {data.problem}
				</p>
			) : null}
			{data.scope ? (
				<p>
					{PROJECT_SHELL_COPY.scope} {data.scope}
				</p>
			) : null}
			{data.logoFileName ? (
				<p>
					{PROJECT_SHELL_COPY.logo} {data.logoFileName}
				</p>
			) : null}
			<div className="mt-6">
				<ProjectOverview projectId={data.id} />
			</div>
		</section>
	);
}
