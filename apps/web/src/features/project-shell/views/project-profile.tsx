import { useQuery } from "@tanstack/react-query";

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

	return (
		<main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
			<h1 className="font-bold text-2xl">{project.data.name}</h1>
			<p>
				{PROJECT_SHELL_COPY.active} · {project.data.starterConfiguration}
			</p>
			<ShortCodeForm
				key={`${project.data.id}:${project.data.revision}:${project.data.shortCode}`}
				projectId={project.data.id}
				revision={project.data.revision}
				shortCode={project.data.shortCode}
				shortCodeLocked={project.data.shortCodeLocked}
			/>
			{project.data.purpose ? (
				<p>
					{PROJECT_SHELL_COPY.purpose} {project.data.purpose}
				</p>
			) : null}
			{project.data.problem ? (
				<p>
					{PROJECT_SHELL_COPY.problem} {project.data.problem}
				</p>
			) : null}
			{project.data.scope ? (
				<p>
					{PROJECT_SHELL_COPY.scope} {project.data.scope}
				</p>
			) : null}
			{project.data.targetDate ? (
				<p>
					{PROJECT_SHELL_COPY.targetDate} {project.data.targetDate}
				</p>
			) : null}
			{project.data.logoFileName ? (
				<p>
					{PROJECT_SHELL_COPY.logo} {project.data.logoFileName}
				</p>
			) : null}
		</main>
	);
}
