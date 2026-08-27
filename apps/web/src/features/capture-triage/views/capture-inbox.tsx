import { useQuery } from "@tanstack/react-query";

import CaptureForm from "@/features/capture-triage/forms/capture-form";
import { FounderPage } from "@/features/personal-shell/components/founder-page";
import { orpc } from "@/utils/orpc";

export default function CaptureInbox() {
	const catalog = useQuery(orpc.captureInbox.catalog.queryOptions());
	const heading = catalog.data?.copy.captureInbox ?? "Capture Inbox";

	return (
		<FounderPage title={heading} wide>
			<CaptureForm />
		</FounderPage>
	);
}
