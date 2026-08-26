import { createFileRoute } from "@tanstack/react-router";

import CaptureInbox from "@/features/capture-triage/views/capture-inbox";

export const Route = createFileRoute("/_founder/_auth/capture")({
	component: CaptureInbox,
});
