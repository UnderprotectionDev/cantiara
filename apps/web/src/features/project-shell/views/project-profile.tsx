import { useQuery } from "@tanstack/react-query";

import FirstOpenExplanation from "@/features/project-shell/forms/first-open-explanation";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import ShortCodeForm from "@/features/project-shell/forms/short-code-form";
import { orpc } from "@/utils/orpc";

export default function ProjectProfile({ projectId }: { projectId: string }) {
	const project = useQuery(
		orpc.projectShell.get.queryOptions({ input: { projectId } })
	);

	if (project.isPending) {
		return <p>{PROJECT_SHELL_COPY.loading}</p>;
	}
	if (project.isError || !project.data) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	const data = project.data;

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
			<h1 className="font-bold text-2xl">{data.name}</h1>
			<p>
				{PROJECT_SHELL_COPY.active} · {data.starterConfiguration}
			</p>
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
							{surface === PROJECT_SHELL_COPY.allTools ? (
								<a href="#all-tools">{surface}</a>
							) : (
								surface
							)}
						</li>
					))}
					{data.pinnedAreas.map((area) => (
						<li key={`pin-${area}`}>{area}</li>
					))}
				</ul>
			</nav>
			<section id="all-tools" aria-label={PROJECT_SHELL_COPY.allTools}>
				<h2>{PROJECT_SHELL_COPY.allTools}</h2>
				<ul>
					{data.allToolsAreas.map((area) => (
						<li key={area.name}>{area.name}</li>
					))}
				</ul>
			</section>
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
		</main>
	);
}
