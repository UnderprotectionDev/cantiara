import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import ConfigurationMode from "@/features/project-shell/forms/configuration-mode";
import FirstOpenExplanation from "@/features/project-shell/forms/first-open-explanation";
import {
	type ConfigurationModeEditor,
	PROJECT_SHELL_COPY,
	projectShellAnchor,
} from "@/features/project-shell/forms/project-shell-copy";
import ShortCodeForm from "@/features/project-shell/forms/short-code-form";
import { orpc } from "@/utils/orpc";

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

	if (project.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (project.isError || !project.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const { data } = project;
	const alwaysOnAnchors = new Set(
		data.alwaysOnSurfaces.map((surface) => projectShellAnchor(surface))
	);
	const areaNames = data.allToolsAreas.map((area) => area.name);

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
			<section
				aria-label={PROJECT_SHELL_COPY.overview}
				id={projectShellAnchor(PROJECT_SHELL_COPY.overview)}
			>
				<h1 className="font-bold text-2xl">{data.name}</h1>
				<p>
					{PROJECT_SHELL_COPY.active} · {data.starterConfiguration}
				</p>
				<ConfigurationMode
					areas={areaNames}
					editor={configurationEditor}
					onOpenEditor={onOpenEditor}
					onToggle={onToggle}
					open={configurationMode}
					stages={data.stages}
					workStatuses={data.workStatuses}
					workViews={data.workViews}
				/>
				{data.firstOpenExplanationVisible && data.firstOpenExplanation ? (
					<FirstOpenExplanation
						body={data.firstOpenExplanation}
						projectId={data.id}
						revision={data.revision}
					/>
				) : null}
				<ShortCodeForm
					key={`${data.id}:${data.revision}:${data.shortCode}`}
					projectId={data.id}
					revision={data.revision}
					shortCode={data.shortCode}
					shortCodeLocked={data.shortCodeLocked}
				/>
				<nav aria-label={PROJECT_SHELL_COPY.overview}>
					<ul>
						{data.alwaysOnSurfaces.map((surface) => (
							<li key={surface}>
								<a href={`#${projectShellAnchor(surface)}`}>{surface}</a>
							</li>
						))}
						{data.pinnedAreas.map((area) => (
							<li key={`pin-${area}`}>
								<a href={`#${projectShellAnchor(area)}`}>{area}</a>
							</li>
						))}
					</ul>
				</nav>
				{data.purpose ? (
					<p>
						{PROJECT_SHELL_COPY.purpose} {data.purpose}
					</p>
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
				{data.targetDate ? (
					<p>
						{PROJECT_SHELL_COPY.targetDate} {data.targetDate}
					</p>
				) : null}
				{data.logoFileName ? (
					<p>
						{PROJECT_SHELL_COPY.logo} {data.logoFileName}
					</p>
				) : null}
			</section>
			{data.alwaysOnSurfaces
				.filter(
					(surface) =>
						surface !== PROJECT_SHELL_COPY.overview &&
						surface !== PROJECT_SHELL_COPY.allTools
				)
				.map((surface) => (
					<section
						aria-label={surface}
						id={projectShellAnchor(surface)}
						key={surface}
					>
						<h2>{surface}</h2>
						{surface === "Work" ? (
							<>
								<ul>
									<li>{PROJECT_SHELL_COPY.create}</li>
									<li>{PROJECT_SHELL_COPY.edit}</li>
									<li>{PROJECT_SHELL_COPY.status}</li>
									<li>{PROJECT_SHELL_COPY.planning}</li>
								</ul>
								<ul>
									{data.workViews.map((view) => (
										<li id={projectShellAnchor(view)} key={view}>
											{view}
										</li>
									))}
								</ul>
							</>
						) : null}
					</section>
				))}
			<section
				aria-label={PROJECT_SHELL_COPY.allTools}
				id={projectShellAnchor(PROJECT_SHELL_COPY.allTools)}
			>
				<h2>{PROJECT_SHELL_COPY.allTools}</h2>
				<ul>
					{data.allToolsAreas.map((area) => {
						const anchor = projectShellAnchor(area.name);
						return (
							<li
								id={alwaysOnAnchors.has(anchor) ? undefined : anchor}
								key={area.name}
							>
								{area.name}
							</li>
						);
					})}
				</ul>
			</section>
		</main>
	);
}
