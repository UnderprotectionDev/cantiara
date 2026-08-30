import { createFileRoute } from "@tanstack/react-router";

import CompletionEffects from "@/features/completion-effects/views/completion-effects";

export const Route = createFileRoute("/_founder/_auth/completion-effects")({
	component: CompletionEffects,
});
