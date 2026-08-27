import { Button } from "@cantiara/ui/components/button";
import { type ReactNode, useCallback } from "react";

import ProjectAreasForm from "./project-areas-form";
import {
	CONFIGURATION_MODE_EDITORS,
	type ConfigurationModeEditor,
	PROJECT_SHELL_COPY,
	type StageState,
} from "./project-shell-copy";
import StagesForm from "./stages-form";
import WorkStatusesForm from "./work-statuses-form";

const SECTION = "flex flex-col gap-3 border-border border-t pt-8";

export default function ConfigurationMode({
	areas,
	editor,
	onOpenEditor,
	onToggle,
	open,
	projectId,
	revision,
	showToggle = true,
	stages,
	workStatuses,
	workViews,
	children,
}: {
	areas: readonly { enabled: boolean; name: string; pinned: boolean }[];
	children?: ReactNode;
	editor: ConfigurationModeEditor | null;
	onOpenEditor: (editor: ConfigurationModeEditor) => void;
	onToggle: () => void;
	open: boolean;
	projectId: string;
	revision: number;
	showToggle?: boolean;
	stages: readonly { id: string; name: string; state: StageState }[];
	workStatuses: readonly { label: string; semantic: string }[];
	workViews: readonly string[];
}) {
	const openCustomField = useCallback(() => {
		onOpenEditor(CONFIGURATION_MODE_EDITORS.customField);
	}, [onOpenEditor]);
	const openWorkContextCardLayout = useCallback(() => {
		onOpenEditor(CONFIGURATION_MODE_EDITORS.workContextCardLayout);
	}, [onOpenEditor]);

	return (
		<section aria-label={PROJECT_SHELL_COPY.configurationMode}>
			{showToggle ? (
				<Button
					aria-pressed={open}
					onClick={onToggle}
					type="button"
					variant={open ? "secondary" : "outline"}
				>
					{PROJECT_SHELL_COPY.configurationMode}
				</Button>
			) : null}
			{open ? (
				<div className="flex max-w-xl flex-col">
					<div className="mb-8 flex items-center justify-between gap-4">
						<h1 className="font-semibold text-[1.375rem] tracking-tight">
							{PROJECT_SHELL_COPY.configurationMode}
						</h1>
						<p className="sr-only" role="status">
							{PROJECT_SHELL_COPY.configurationMode}
						</p>
					</div>
					{children ? (
						<div className="flex flex-col gap-6">{children}</div>
					) : null}
					<div className={SECTION}>
						<StagesForm
							projectId={projectId}
							revision={revision}
							stages={stages}
						/>
					</div>
					<div className={SECTION}>
						<WorkStatusesForm
							projectId={projectId}
							revision={revision}
							workStatuses={workStatuses}
						/>
					</div>
					<section
						aria-label={PROJECT_SHELL_COPY.projectAreas}
						className={SECTION}
					>
						<h2 className="font-medium text-sm">
							{PROJECT_SHELL_COPY.projectAreas}
						</h2>
						<ProjectAreasForm
							areas={areas}
							label={PROJECT_SHELL_COPY.projectAreas}
							projectId={projectId}
							revision={revision}
							showEnablement={true}
							showRestore={true}
						/>
					</section>
					<section
						aria-label={PROJECT_SHELL_COPY.priorityMetrics}
						className={SECTION}
					>
						<h2 className="font-medium text-sm">
							{PROJECT_SHELL_COPY.priorityMetrics}
						</h2>
					</section>
					<section
						aria-label={PROJECT_SHELL_COPY.savedViews}
						className={SECTION}
					>
						<h2 className="font-medium text-sm">
							{PROJECT_SHELL_COPY.savedViews}
						</h2>
						<ul className="flex flex-col gap-1 text-sm">
							{workViews.map((view) => (
								<li key={view}>{view}</li>
							))}
						</ul>
					</section>
					<section className={`${SECTION} gap-2`}>
						<Button
							aria-expanded={editor === CONFIGURATION_MODE_EDITORS.customField}
							onClick={openCustomField}
							size="sm"
							type="button"
							variant="outline"
						>
							{PROJECT_SHELL_COPY.customField}
						</Button>
						{editor === CONFIGURATION_MODE_EDITORS.customField ? (
							<section aria-label={PROJECT_SHELL_COPY.customField}>
								<h2 className="font-medium text-sm">
									{PROJECT_SHELL_COPY.customField}
								</h2>
							</section>
						) : null}
						<Button
							aria-expanded={
								editor === CONFIGURATION_MODE_EDITORS.workContextCardLayout
							}
							onClick={openWorkContextCardLayout}
							size="sm"
							type="button"
							variant="outline"
						>
							{PROJECT_SHELL_COPY.workContextCardLayout}
						</Button>
						{editor === CONFIGURATION_MODE_EDITORS.workContextCardLayout ? (
							<section aria-label={PROJECT_SHELL_COPY.workContextCardLayout}>
								<h2 className="font-medium text-sm">
									{PROJECT_SHELL_COPY.workContextCardLayout}
								</h2>
							</section>
						) : null}
					</section>
				</div>
			) : null}
		</section>
	);
}
