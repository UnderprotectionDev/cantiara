import { createFileRoute } from "@tanstack/react-router";

import CreateProject from "@/features/project-shell/views/create-project";

export const Route = createFileRoute("/_founder/_auth/projects/new")({
	component: CreateProject,
});
