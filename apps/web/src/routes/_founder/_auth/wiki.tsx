import { createFileRoute } from "@tanstack/react-router";

import { DOCUMENTS_COPY } from "@/features/documents/forms/documents-copy";
import DocumentArea from "@/features/documents/views/document-area";
import { FILE_ATTACHMENT_COPY } from "@/features/file-attachments/forms/file-attachments-copy";
import FileAttachmentArea from "@/features/file-attachments/views/file-attachment-area";
import { FounderPage } from "@/features/personal-shell/components/founder-page";

export const Route = createFileRoute("/_founder/_auth/wiki")({
	component: PersonalWikiRoute,
});

function PersonalWikiRoute() {
	return (
		<FounderPage title={FILE_ATTACHMENT_COPY.personalWiki} wide>
			<section aria-label={DOCUMENTS_COPY.document}>
				<h1 className="font-semibold text-[1.375rem] tracking-tight">
					{DOCUMENTS_COPY.document}
				</h1>
				<div className="mt-6">
					<DocumentArea projectId={null} />
				</div>
			</section>
			<section
				aria-label={FILE_ATTACHMENT_COPY.fileAttachment}
				className="mt-10"
			>
				<h2 className="font-semibold text-[1.375rem] tracking-tight">
					{FILE_ATTACHMENT_COPY.fileAttachment}
				</h2>
				<div className="mt-6">
					<FileAttachmentArea projectId={null} />
				</div>
			</section>
		</FounderPage>
	);
}
