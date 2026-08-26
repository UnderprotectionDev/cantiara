import { Button } from "@cantiara/ui/components/button";
import { useCallback } from "react";

import {
	CONFIGURATION_MODE_EDITORS,
	type ConfigurationModeEditor,
	PROJECT_SHELL_COPY,
	projectShellAnchor,
} from "./project-shell-copy";

export default function ConfigurationMode({
	areas,
	editor,
	onOpenEditor,
	onToggle,
	open,
	stages,
	workStatuses,
	workViews,
}: {
	areas: readonly string[];
	editor: ConfigurationModeEditor | null;
	onOpenEditor: (editor: ConfigurationModeEditor) => void;
	onToggle: () => void;
	open: boolean;
	stages: readonly string[];
	workStatuses: readonly string[];
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
					<section aria-label={PROJECT_SHELL_COPY.stages}>
						<h2>{PROJECT_SHELL_COPY.stages}</h2>
						<ul>
							{stages.map((stage) => (
								<li key={stage}>{stage}</li>
							))}
						</ul>
					</section>
					<section aria-label={PROJECT_SHELL_COPY.workStatuses}>
						<h2>{PROJECT_SHELL_COPY.workStatuses}</h2>
						<ul>
							{workStatuses.map((status) => (
								<li key={status}>{status}</li>
							))}
						</ul>
					</section>
					<section aria-label={PROJECT_SHELL_COPY.projectAreas}>
						<h2>{PROJECT_SHELL_COPY.projectAreas}</h2>
						<ul>
							{areas.map((area) => (
								<li key={area}>{area}</li>
							))}
						</ul>
					</section>
					<section aria-label={PROJECT_SHELL_COPY.priorityMetrics}>
						<h2>{PROJECT_SHELL_COPY.priorityMetrics}</h2>
					</section>
					<section aria-label={PROJECT_SHELL_COPY.planning}>
						<h2>{PROJECT_SHELL_COPY.planning}</h2>
						<ul>
							{workViews.map((view) => (
								<li key={`saved-${view}`}>
									<a href={`#${projectShellAnchor(view)}`}>{view}</a>
								</li>
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
