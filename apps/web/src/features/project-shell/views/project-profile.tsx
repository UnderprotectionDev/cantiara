import { Button } from "@cantiara/ui/components/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@cantiara/ui/components/sheet";
import { Skeleton } from "@cantiara/ui/components/skeleton";
import { cn } from "@cantiara/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { type MouseEvent, useCallback } from "react";

import BoundRecordValuesSurface from "@/features/custom-fields/views/bound-record-values";
import DecisionArea from "@/features/decisions/views/decision-area";
import { DOCUMENTS_COPY } from "@/features/documents/forms/documents-copy";
import DocumentArea from "@/features/documents/views/document-area";
import FavoriteToggle from "@/features/favorites/views/favorite-toggle";
import FileAttachmentArea from "@/features/file-attachments/views/file-attachment-area";
import ProjectGoalsPanel from "@/features/goals/views/project-goals-panel";
import { FOUNDER_MAIN_ID } from "@/features/personal-shell/components/founder-chrome";
import ProjectOverview from "@/features/project-overview/views/project-overview";
import ConfigurationMode from "@/features/project-shell/forms/configuration-mode";
import CopyProjectStructureForm from "@/features/project-shell/forms/copy-project-structure-form";
import FirstOpenExplanation from "@/features/project-shell/forms/first-open-explanation";
import ProjectAreasForm from "@/features/project-shell/forms/project-areas-form";
import {
	type ConfigurationModeEditor,
	isWorkShellAnchor,
	PROJECT_SHELL_COPY,
	projectNavPinnedAreas,
	projectNavRecordAreas,
	projectPersistentNav,
	projectShellAnchor,
	projectShellHashAnchor,
	projectShellShowsWorkSurface,
	type StageState,
	WORK_DAILY_ACTIONS,
	workSavedViewIsBoard,
	workSavedViewIsList,
	workSavedViewIsRoadmap,
} from "@/features/project-shell/forms/project-shell-copy";
import ShortCodeForm from "@/features/project-shell/forms/short-code-form";
import ReturnToWorkPanel from "@/features/return-to-work/views/return-to-work-panel";
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
	decisionId,
	goalId,
	onDecisionId,
	onGoalId,
	onPresentationChange,
	onWorkId,
	projectId,
	workId,
}: {
	configurationEditor: ConfigurationModeEditor | null;
	configurationMode: boolean;
	decisionId?: string | null;
	goalId?: string | null;
	onDecisionId?: (decisionId: string | null) => void;
	onGoalId?: (goalId: string | null) => void;
	onPresentationChange: (next: {
		editor: ConfigurationModeEditor | null;
		hash?: string;
		open: boolean;
	}) => void;
	onWorkId?: (workId: string | null) => void;
	projectId: string;
	workId?: string | null;
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
	const onLeaveConfiguration = useCallback(
		(nextHash: string) => {
			if (!configurationMode) {
				return;
			}
			onPresentationChange({
				editor: null,
				hash: nextHash,
				open: false,
			});
		},
		[configurationMode, onPresentationChange]
	);

	if (project.isPending) {
		return (
			<div className="grid h-full min-h-0 gap-4 p-6 md:grid-cols-[13rem_minmax(0,1fr)]">
				<Skeleton className="hidden h-full md:block" />
				<div className="flex flex-col gap-3">
					<Skeleton className="h-8 w-48" />
					<p>{PROJECT_SHELL_COPY.loading}</p>
				</div>
			</div>
		);
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
		(selectedAnchor === "" && !workId && !decisionId) ||
		selectedAnchor === overviewAnchor;

	const nav = (
		<ProjectNav
			allToolsCurrent={selectedAnchor === allToolsAnchor}
			allToolsHref={`#${allToolsAnchor}`}
			configurationMode={configurationMode}
			navigationAreas={navigationAreas}
			onLeaveConfiguration={onLeaveConfiguration}
			overviewCurrent={overviewCurrent}
			overviewHref={`#${overviewAnchor}`}
			selectedAnchor={selectedAnchor}
			workViews={data.workViews}
		/>
	);

	return (
		<div className="grid h-full min-h-0 md:grid-cols-[13rem_minmax(0,1fr)]">
			<aside className="hidden h-full min-h-0 flex-col gap-3 border-e bg-sidebar px-2 py-3 text-sidebar-foreground md:flex">
				<ConfigurationToggle
					configurationMode={configurationMode}
					onToggle={onToggle}
				/>
				{nav}
			</aside>
			<main
				className="min-h-0 overflow-auto px-4 py-6 md:px-8 md:py-8"
				id={FOUNDER_MAIN_ID}
			>
				<div className="mb-4 flex items-center gap-2 md:hidden">
					<Sheet>
						<SheetTrigger render={<Button size="sm" variant="outline" />}>
							<Menu className="size-4" />
							{PROJECT_SHELL_COPY.openNavigation}
						</SheetTrigger>
						<SheetContent className="bg-sidebar p-3" side="left">
							<SheetHeader>
								<SheetTitle>{PROJECT_SHELL_COPY.project}</SheetTitle>
							</SheetHeader>
							<div className="flex flex-col gap-3 px-2">
								<ConfigurationToggle
									configurationMode={configurationMode}
									onToggle={onToggle}
								/>
								{nav}
							</div>
						</SheetContent>
					</Sheet>
					<p className="truncate font-medium text-sm">{data.name}</p>
				</div>
				<ProjectBody
					configurationEditor={configurationEditor}
					configurationMode={configurationMode}
					data={data}
					decisionId={decisionId}
					goalId={goalId}
					onDecisionId={onDecisionId}
					onGoalId={onGoalId}
					onOpenEditor={onOpenEditor}
					onToggle={onToggle}
					onWorkId={onWorkId}
					selectedAnchor={selectedAnchor}
					workId={workId}
				/>
			</main>
		</div>
	);
}

function ConfigurationToggle({
	configurationMode,
	onToggle,
}: {
	configurationMode: boolean;
	onToggle: () => void;
}) {
	return (
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
	);
}

function ProjectNav({
	allToolsCurrent,
	allToolsHref,
	configurationMode,
	navigationAreas,
	onLeaveConfiguration,
	overviewCurrent,
	overviewHref,
	selectedAnchor,
	workViews,
}: {
	allToolsCurrent: boolean;
	allToolsHref: string;
	configurationMode: boolean;
	navigationAreas: readonly string[];
	onLeaveConfiguration: (nextHash: string) => void;
	overviewCurrent: boolean;
	overviewHref: string;
	selectedAnchor: string;
	workViews: readonly string[];
}) {
	const records = projectNavRecordAreas(navigationAreas);
	const pinned = projectNavPinnedAreas(navigationAreas);
	return (
		<nav aria-label={PROJECT_SHELL_COPY.project}>
			<ul className="flex flex-col gap-3">
				<li>
					<p className="px-2 font-medium text-muted-foreground text-xs">
						{PROJECT_SHELL_COPY.overview}
					</p>
					<ul className="mt-0.5 flex flex-col gap-0.5">
						<li>
							<ProjectNavLink
								configurationMode={configurationMode}
								current={overviewCurrent}
								href={overviewHref}
								label={PROJECT_SHELL_COPY.overview}
								onLeaveConfiguration={onLeaveConfiguration}
							/>
						</li>
					</ul>
				</li>
				{records.length > 0 ? (
					<li>
						<ul className="flex flex-col gap-0.5">
							{records.map((area) => (
								<li key={`record-${area}`}>
									<ProjectNavLink
										configurationMode={configurationMode}
										current={
											selectedAnchor === projectShellAnchor(area) ||
											(area === "Work" &&
												isWorkShellAnchor(selectedAnchor, workViews))
										}
										href={`#${projectShellAnchor(area)}`}
										label={area}
										onLeaveConfiguration={onLeaveConfiguration}
									/>
								</li>
							))}
						</ul>
					</li>
				) : null}
				{pinned.length > 0 ? (
					<li>
						<p className="px-2 font-medium text-muted-foreground text-xs">
							{PROJECT_SHELL_COPY.projectAreas}
						</p>
						<ul className="mt-0.5 flex flex-col gap-0.5">
							{pinned.map((area) => (
								<li key={`pin-${area}`}>
									<ProjectNavLink
										configurationMode={configurationMode}
										current={selectedAnchor === projectShellAnchor(area)}
										href={`#${projectShellAnchor(area)}`}
										label={area}
										onLeaveConfiguration={onLeaveConfiguration}
									/>
								</li>
							))}
						</ul>
					</li>
				) : null}
				<li>
					<p className="px-2 font-medium text-muted-foreground text-xs">
						{PROJECT_SHELL_COPY.allTools}
					</p>
					<ul className="mt-0.5 flex flex-col gap-0.5">
						<li>
							<ProjectNavLink
								configurationMode={configurationMode}
								current={allToolsCurrent}
								href={allToolsHref}
								label={PROJECT_SHELL_COPY.allTools}
								onLeaveConfiguration={onLeaveConfiguration}
							/>
						</li>
					</ul>
				</li>
			</ul>
			{configurationMode ? (
				<p className="sr-only" role="status">
					{PROJECT_SHELL_COPY.configurationMode}
				</p>
			) : null}
		</nav>
	);
}

function ProjectNavLink({
	configurationMode,
	current,
	href,
	label,
	onLeaveConfiguration,
}: {
	configurationMode: boolean;
	current: boolean;
	href: string;
	label: string;
	onLeaveConfiguration: (nextHash: string) => void;
}) {
	const onClick = useCallback(
		(event: MouseEvent<HTMLAnchorElement>) => {
			if (configurationMode) {
				event.preventDefault();
			}
			onLeaveConfiguration(projectShellHashAnchor(href));
		},
		[configurationMode, href, onLeaveConfiguration]
	);
	return (
		<a
			aria-current={current ? "page" : undefined}
			className={cn(
				"block rounded-sm px-2 py-1.5 text-sm transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring",
				current
					? "border-sidebar-primary border-s-2 bg-sidebar-accent font-medium text-sidebar-accent-foreground"
					: "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
			)}
			href={href}
			onClick={onClick}
		>
			{label}
		</a>
	);
}

function DocumentsProjectSection({
	onWorkId,
	projectId,
	sectionId,
}: {
	onWorkId?: (workId: string | null) => void;
	projectId: string;
	sectionId: string;
}) {
	return (
		<section aria-label="Documents" id={sectionId}>
			<h1 className="font-semibold text-[1.375rem] tracking-tight">
				{DOCUMENTS_COPY.document}
			</h1>
			<div className="mt-6">
				<DocumentArea
					onOpenSourceRecord={
						onWorkId ? (id: string) => onWorkId(id) : undefined
					}
					projectId={projectId}
				/>
			</div>
		</section>
	);
}

function DecisionsProjectSection({
	decisionId,
	onDecisionId,
	projectId,
	sectionId,
}: {
	decisionId?: string | null;
	onDecisionId?: (decisionId: string | null) => void;
	projectId: string;
	sectionId: string;
}) {
	return (
		<section aria-label="Decisions" id={sectionId}>
			<h1 className="font-semibold text-[1.375rem] tracking-tight">
				Decisions
			</h1>
			<div className="mt-6">
				<DecisionArea
					decisionId={decisionId}
					onDecisionId={onDecisionId}
					projectId={projectId}
				/>
			</div>
		</section>
	);
}

function projectRecordArea({
	decisionId,
	decisionsAnchor,
	documentsAnchor,
	fileAttachmentAnchor,
	onDecisionId,
	onWorkId,
	projectId,
	selectedAnchor,
	selectedArea,
}: {
	decisionId?: string | null;
	decisionsAnchor: string;
	documentsAnchor: string;
	fileAttachmentAnchor: string;
	onDecisionId?: (decisionId: string | null) => void;
	onWorkId?: (workId: string | null) => void;
	projectId: string;
	selectedAnchor: string;
	selectedArea: string | undefined;
}) {
	if (selectedAnchor === documentsAnchor || selectedArea === "Documents") {
		return (
			<DocumentsProjectSection
				onWorkId={onWorkId}
				projectId={projectId}
				sectionId={documentsAnchor}
			/>
		);
	}
	if (
		selectedAnchor === decisionsAnchor ||
		selectedArea === "Decisions" ||
		decisionId
	) {
		return (
			<DecisionsProjectSection
				decisionId={decisionId}
				onDecisionId={onDecisionId}
				projectId={projectId}
				sectionId={decisionsAnchor}
			/>
		);
	}
	if (
		selectedAnchor === fileAttachmentAnchor ||
		selectedArea === "File Attachment"
	) {
		return (
			<section aria-label="File Attachment" id={fileAttachmentAnchor}>
				<h1 className="font-semibold text-[1.375rem] tracking-tight">
					File Attachment
				</h1>
				<div className="mt-6">
					<FileAttachmentArea projectId={projectId} />
				</div>
			</section>
		);
	}
	return null;
}

function ProjectBody({
	configurationEditor,
	configurationMode,
	data,
	decisionId,
	goalId,
	onDecisionId,
	onGoalId,
	onOpenEditor,
	onToggle,
	onWorkId,
	selectedAnchor,
	workId,
}: {
	configurationEditor: ConfigurationModeEditor | null;
	configurationMode: boolean;
	data: ProjectShellRecord;
	decisionId?: string | null;
	goalId?: string | null;
	onDecisionId?: (decisionId: string | null) => void;
	onGoalId?: (goalId: string | null) => void;
	onOpenEditor: (editor: ConfigurationModeEditor) => void;
	onToggle: () => void;
	onWorkId?: (workId: string | null) => void;
	selectedAnchor: string;
	workId?: string | null;
}) {
	const overviewAnchor = projectShellAnchor(PROJECT_SHELL_COPY.overview);
	const allToolsAnchor = projectShellAnchor(PROJECT_SHELL_COPY.allTools);
	const documentsAnchor = projectShellAnchor("Documents");
	const decisionsAnchor = projectShellAnchor("Decisions");
	const fileAttachmentAnchor = projectShellAnchor("File Attachment");
	const selectedArea = data.allToolsAreas
		.map((area) => area.name)
		.find((area) => projectShellAnchor(area) === selectedAnchor);
	const showingWork = projectShellShowsWorkSurface({
		anchor: selectedAnchor,
		workId,
		workViews: data.workViews,
	});
	const recordArea = projectRecordArea({
		decisionId: showingWork ? null : decisionId,
		decisionsAnchor,
		documentsAnchor,
		fileAttachmentAnchor,
		onDecisionId,
		onWorkId,
		projectId: data.id,
		selectedAnchor,
		selectedArea,
	});

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

	if (recordArea) {
		return recordArea;
	}

	if (showingWork) {
		const activeView = data.workViews.find(
			(view) => projectShellAnchor(view) === selectedAnchor
		);
		return (
			<section aria-label="Work" id={projectShellAnchor("Work")}>
				<h1 className="font-semibold text-[1.375rem] tracking-tight">Work</h1>
				<nav
					aria-label={PROJECT_SHELL_COPY.savedViews}
					className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs"
				>
					{WORK_DAILY_ACTIONS.map((action) => (
						<a
							className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
							href={`#${projectShellAnchor(action)}`}
							key={action}
						>
							{action}
						</a>
					))}
					{data.workViews.map((view) => {
						const current =
							projectShellAnchor(view) === selectedAnchor ||
							(view === "Backlog" &&
								(selectedAnchor === "work" || selectedAnchor === "create"));
						return (
							<a
								aria-current={current ? "page" : undefined}
								className={cn(
									"underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring",
									current
										? "font-medium text-foreground"
										: "text-muted-foreground hover:text-foreground hover:underline"
								)}
								href={`#${projectShellAnchor(view)}`}
								id={projectShellAnchor(view)}
								key={view}
							>
								{view}
							</a>
						);
					})}
				</nav>
				<div className="mt-6">
					<WorkArea
						configurationMode={configurationMode}
						onSelectedWorkId={onWorkId}
						projectId={data.id}
						savedView={activeView ?? "Backlog"}
						selectedWorkId={workId ?? null}
						unavailableView={
							activeView &&
							!workSavedViewIsList(activeView) &&
							!workSavedViewIsBoard(activeView) &&
							!workSavedViewIsRoadmap(activeView)
								? activeView
								: null
						}
					/>
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
				<p className="mt-2 text-muted-foreground text-sm">Feedback</p>
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
			<h1 className="font-semibold text-[1.375rem] tracking-tight">
				{data.name}
			</h1>
			<div className="mt-3">
				<FavoriteToggle sourceId={data.id} sourceType="Project" />
			</div>
			<p className="text-muted-foreground text-sm">
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
				<ReturnToWorkPanel projectId={data.id} />
				<ProjectGoalsPanel
					onGoalId={onGoalId}
					projectId={data.id}
					selectedGoalId={goalId}
				/>
				<ProjectOverview projectId={data.id} />
			</div>
		</section>
	);
}
