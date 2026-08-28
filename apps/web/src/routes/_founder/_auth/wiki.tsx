import { createFileRoute } from "@tanstack/react-router";

import { FILE_ATTACHMENT_COPY } from "@/features/file-attachments/forms/file-attachments-copy";
import FileAttachmentArea from "@/features/file-attachments/views/file-attachment-area";
import { FounderPage } from "@/features/personal-shell/components/founder-page";

export const Route = createFileRoute("/_founder/_auth/wiki")({
	component: PersonalWikiRoute,
});

function PersonalWikiRoute() {
	return (
		<FounderPage title={FILE_ATTACHMENT_COPY.personalWiki} wide>
			<FileAttachmentArea projectId={null} />
		</FounderPage>
	);
}
