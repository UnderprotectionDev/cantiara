import { useQuery } from "@tanstack/react-query";

import CaptureForm from "@/features/capture-triage/forms/capture-form";
import { orpc } from "@/utils/orpc";

export default function CaptureInbox() {
	const catalog = useQuery(orpc.captureInbox.catalog.queryOptions());
	const heading = catalog.data?.copy.captureInbox ?? "Capture Inbox";

	return (
		<main className="mx-auto w-full max-w-6xl p-6">
			<h1 className="mb-6 font-bold text-2xl">{heading}</h1>
			<CaptureForm />
		</main>
	);
}
