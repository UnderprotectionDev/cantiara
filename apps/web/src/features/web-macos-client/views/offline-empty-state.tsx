import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@cantiara/ui/components/empty";

import {
	getDocumentEditorSession,
	presentDocumentDisconnect,
} from "@/features/documents/forms/document-session";
import { DocumentRecoveryActions } from "@/features/documents/views/document-recovery-actions";

import type { OfflineEmptyStateView } from "./client-shell";

export function OfflineEmptyState({ state }: { state: OfflineEmptyStateView }) {
	const recovery = presentDocumentDisconnect({
		connected: false,
		session: getDocumentEditorSession(),
	});

	return (
		<Empty aria-live="polite" className="min-h-full" role="status">
			<EmptyHeader>
				<EmptyTitle>
					<h1>{state.heading}</h1>
				</EmptyTitle>
				<EmptyDescription>
					<span>
						{state.lastSavedLabel}
						{state.lastSavedDisplay ? `: ${state.lastSavedDisplay}` : ""}
					</span>
				</EmptyDescription>
				{state.unsavedRisk ? (
					<EmptyDescription>{state.unsavedRisk}</EmptyDescription>
				) : null}
			</EmptyHeader>
			{recovery.markdown ? (
				<DocumentRecoveryActions
					copyLabel={recovery.copy}
					downloadLabel={recovery.download}
					filename={recovery.filename ?? "Document.md"}
					markdown={recovery.markdown}
				/>
			) : null}
		</Empty>
	);
}
