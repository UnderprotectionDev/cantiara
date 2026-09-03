import { DOCUMENTS_COPY } from "@/features/documents/forms/documents-copy";
import DocumentArea from "@/features/documents/views/document-area";
import { FILE_ATTACHMENT_COPY } from "@/features/file-attachments/forms/file-attachments-copy";
import FileAttachmentArea from "@/features/file-attachments/views/file-attachment-area";

export default function PersonalWikiArea() {
	return (
		<div className="flex flex-col gap-10">
			<section aria-label={DOCUMENTS_COPY.document}>
				<DocumentArea projectId={null} />
			</section>
			<section aria-label={FILE_ATTACHMENT_COPY.fileAttachment}>
				<h2 className="font-medium text-sm tracking-tight">
					{FILE_ATTACHMENT_COPY.fileAttachment}
				</h2>
				<div className="mt-4">
					<FileAttachmentArea projectId={null} />
				</div>
			</section>
		</div>
	);
}
