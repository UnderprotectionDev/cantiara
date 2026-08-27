import { FounderPage } from "@/features/personal-shell/components/founder-page";
import CreateProjectForm from "@/features/project-shell/forms/create-project-form";
import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";

export default function CreateProject() {
	return (
		<FounderPage title={PROJECT_SHELL_COPY.createProject}>
			<CreateProjectForm />
		</FounderPage>
	);
}
