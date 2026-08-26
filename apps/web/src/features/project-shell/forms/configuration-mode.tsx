import { Button } from "@cantiara/ui/components/button";
import { useCallback } from "react";

import ProjectAreasForm from "./project-areas-form";
import {
	CONFIGURATION_MODE_EDITORS,
	type ConfigurationModeEditor,
	PROJECT_SHELL_COPY,
	type StageState,
} from "./project-shell-copy";
import StagesForm from "./stages-form";
import WorkStatusesForm from "./work-statuses-form";

export default function ConfigurationMode({
	areas,
	editor,
	onOpenEditor,
	onToggle,
	open,
	projectId,
	revision,
	stages,
	workStatuses,
	workViews,
}: {
	areas: readonly { enabled: boolean; name: string; pinned: boolean }[];
	editor: ConfigurationModeEditor | null;
	onOpenEditor: (editor: ConfigurationModeEditor) => void;
	onToggle: () => void;
	open: boolean;
	projectId: string;
	revision: number;
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
			<Button
				aria-pressed={open}
				onClick={onToggle}
				type="button"
				variant={open ? "secondary" : "outline"}
			>
				{PROJECT_SHELL_COPY.configurationMode}
			</Button>
			{open ? (
				<>
					<p role="status">{PROJECT_SHELL_COPY.configurationMode}</p>
					<StagesForm
						projectId={projectId}
						revision={revision}
						stages={stages}
					/>
					<WorkStatusesForm
						projectId={projectId}
						revision={revision}
						workStatuses={workStatuses}
					/>
					<section aria-label={PROJECT_SHELL_COPY.projectAreas}>
						<h2>{PROJECT_SHELL_COPY.projectAreas}</h2>
						<ProjectAreasForm
							areas={areas}
							label={PROJECT_SHELL_COPY.projectAreas}
							projectId={projectId}
							revision={revision}
							showEnablement={true}
							showRestore={true}
						/>
					</section>
					<section aria-label={PROJECT_SHELL_COPY.priorityMetrics}>
						<h2>{PROJECT_SHELL_COPY.priorityMetrics}</h2>
					</section>
					<section aria-label={PROJECT_SHELL_COPY.savedViews}>
						<h2>{PROJECT_SHELL_COPY.savedViews}</h2>
						<ul>
							{workViews.map((view) => (
								<li key={view}>{view}</li>
							))}
						</ul>
					</section>
					<Button
						aria-expanded={editor === CONFIGURATION_MODE_EDITORS.customField}
						onClick={openCustomField}
						type="button"
						variant="outline"
					>
						{PROJECT_SHELL_COPY.customField}
					</Button>
					{editor === CONFIGURATION_MODE_EDITORS.customField ? (
						<section aria-label={PROJECT_SHELL_COPY.customField}>
							<h2>{PROJECT_SHELL_COPY.customField}</h2>
						</section>
					) : null}
					<Button
						aria-expanded={
							editor === CONFIGURATION_MODE_EDITORS.workContextCardLayout
						}
						onClick={openWorkContextCardLayout}
						type="button"
						variant="outline"
					>
						{PROJECT_SHELL_COPY.workContextCardLayout}
					</Button>
					{editor === CONFIGURATION_MODE_EDITORS.workContextCardLayout ? (
						<section aria-label={PROJECT_SHELL_COPY.workContextCardLayout}>
							<h2>{PROJECT_SHELL_COPY.workContextCardLayout}</h2>
						</section>
					) : null}
				</>
			) : null}
		</section>
	);
}
