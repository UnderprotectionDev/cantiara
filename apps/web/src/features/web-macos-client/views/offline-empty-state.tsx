import { Button } from "@cantiara/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@cantiara/ui/components/empty";
import { useCallback } from "react";

import {
	getDocumentEditorSession,
	presentDocumentDisconnect,
} from "@/features/documents/forms/document-session";

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

function DocumentRecoveryActions({
	copyLabel,
	downloadLabel,
	filename,
	markdown,
}: {
	copyLabel: string;
	downloadLabel: string;
	filename: string;
	markdown: string;
}) {
	const onCopy = useCallback(() => {
		navigator.clipboard.writeText(markdown).catch(() => undefined);
	}, [markdown]);
	const onDownload = useCallback(() => {
		const blob = new Blob([markdown], {
			type: "text/markdown;charset=utf-8",
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.download = filename;
		link.href = url;
		link.click();
		URL.revokeObjectURL(url);
	}, [filename, markdown]);

	return (
		<EmptyContent>
			<Button onClick={onCopy} type="button">
				{copyLabel}
			</Button>
			<Button onClick={onDownload} type="button">
				{downloadLabel}
			</Button>
		</EmptyContent>
	);
}
