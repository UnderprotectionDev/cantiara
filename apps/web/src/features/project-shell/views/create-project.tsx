import CreateProjectForm from "@/features/project-shell/forms/create-project-form";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";

export default function CreateProject() {
	return (
		<main className="mx-auto w-full max-w-3xl p-6">
			<h1 className="mb-6 font-bold text-2xl">
				{PROJECT_SHELL_COPY.createProject}
			</h1>
			<CreateProjectForm />
		</main>
	);
}
