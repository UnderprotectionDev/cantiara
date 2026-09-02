import { DOCUMENTS_COPY } from "./documents-copy";

export interface DocumentEditorSession {
	baseRevision: number;
	body: string;
	documentId: string;
	lastSuccessfulSaveAt: Date | null;
	title: string;
	type: string;
}

let remembered: DocumentEditorSession | null = null;

export function rememberDocumentEditorSession(
	session: DocumentEditorSession
): void {
	remembered = session;
}

export function clearDocumentEditorSession(): void {
	remembered = null;
}

export function getDocumentEditorSession(): DocumentEditorSession | null {
	return remembered;
}

export function presentDocumentDisconnect(input: {
	connected: boolean;
	session: DocumentEditorSession | null;
}): {
	copy: typeof DOCUMENTS_COPY.copy;
	download: typeof DOCUMENTS_COPY.download;
	editingAllowed: boolean;
	filename: string | null;
	lastSuccessfulSaveAt: Date | null;
	markdown: string | null;
	queuedWrites: readonly never[];
} {
	const { connected, session } = input;
	if (connected || !session) {
		return {
			copy: DOCUMENTS_COPY.copy,
			download: DOCUMENTS_COPY.download,
			editingAllowed: connected,
			filename: null,
			lastSuccessfulSaveAt: session?.lastSuccessfulSaveAt ?? null,
			markdown: null,
			queuedWrites: [],
		};
	}
	return {
		copy: DOCUMENTS_COPY.copy,
		download: DOCUMENTS_COPY.download,
		editingAllowed: false,
		filename: recoveryFilename(session.title),
		lastSuccessfulSaveAt: session.lastSuccessfulSaveAt,
		markdown: session.body,
		queuedWrites: [],
	};
}

export function presentReconnectSave(input: {
	connected: boolean;
	session: DocumentEditorSession | null;
}):
	| { status: "none" }
	| {
			baseRevision: number;
			payload: {
				body: string;
				documentId: string;
				title: string;
				type: string;
			};
			status: "attempt";
	  } {
	if (!(input.connected && input.session)) {
		return { status: "none" };
	}
	return {
		baseRevision: input.session.baseRevision,
		payload: {
			body: input.session.body,
			documentId: input.session.documentId,
			title: input.session.title,
			type: input.session.type,
		},
		status: "attempt",
	};
}

export function recoveryFilename(title: string): string {
	const stem = title
		.trim()
		.replace(/[^A-Za-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return `${stem.length > 0 ? stem : "Document"}.md`;
}
