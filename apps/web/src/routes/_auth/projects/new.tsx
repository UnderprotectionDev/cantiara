import { createFileRoute } from "@tanstack/react-router";

import CreateProject from "@/features/project-shell/views/create-project";

export const Route = createFileRoute("/_auth/projects/new")({
	component: CreateProject,
});
