import { Empty, EmptyHeader, EmptyTitle } from "@cantiara/ui/components/empty";
import { Spinner } from "@cantiara/ui/components/spinner";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { PROJECT_SHELL_COPY } from "@/features/project-shell/forms/project-shell-copy";
import { orpc } from "@/utils/orpc";

import CreateDocumentForm from "../forms/create-document-form";
import { DOCUMENTS_COPY, documentScopeFor } from "../forms/documents-copy";
import DocumentDetail from "./document-detail";

export default function DocumentArea({
	projectId,
}: {
	projectId: string | null;
}) {
	const scope = documentScopeFor(projectId);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const documents = useQuery(
		orpc.documents.list.queryOptions({ input: { scope } })
	);
	const onCreated = useCallback((documentId: string) => {
		setSelectedId(documentId);
	}, []);
	const onSelect = useCallback((documentId: string) => {
		setSelectedId(documentId);
	}, []);

	if (documents.isPending) {
		return (
			<p className="flex items-center gap-2 text-muted-foreground text-sm">
				<Spinner />
				{PROJECT_SHELL_COPY.loading}
			</p>
		);
	}
	if (documents.isError) {
		return <p role="alert">{PROJECT_SHELL_COPY.unavailable}</p>;
	}

	return (
		<div className="flex flex-col gap-6">
			<CreateDocumentForm onCreated={onCreated} projectId={projectId} />
			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]">
				{documents.data.length === 0 ? (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{DOCUMENTS_COPY.noDocuments}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				) : (
					<ul className="flex flex-col gap-2">
						{documents.data.map((item) => (
							<li key={item.id}>
								<DocumentRow
									id={item.id}
									onSelect={onSelect}
									selected={item.id === selectedId}
									title={item.title}
									type={item.type}
								/>
							</li>
						))}
					</ul>
				)}
				{selectedId ? (
					<DocumentDetail documentId={selectedId} projectId={projectId} />
				) : (
					<Empty>
						<EmptyHeader>
							<EmptyTitle>{DOCUMENTS_COPY.selectDocument}</EmptyTitle>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

function DocumentRow({
	id,
	onSelect,
	selected,
	title,
	type,
}: {
	id: string;
	onSelect: (id: string) => void;
	selected: boolean;
	title: string;
	type: string;
}) {
	const onClick = useCallback(() => {
		onSelect(id);
	}, [id, onSelect]);
	return (
		<button
			aria-current={selected ? "true" : undefined}
			className="w-full rounded-none border border-input px-2.5 py-2 text-left text-sm hover:bg-muted/40"
			onClick={onClick}
			type="button"
		>
			<span className="font-medium">{title}</span>
			<span className="mt-0.5 block text-muted-foreground text-xs">{type}</span>
		</button>
	);
}
