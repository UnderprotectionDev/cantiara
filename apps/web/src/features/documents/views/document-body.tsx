import { Button } from "@cantiara/ui/components/button";
import { Markdown } from "@tanstack/markdown/react";
import katex from "katex";
import mermaid from "mermaid";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useId, useState } from "react";

import ChangeWorkStatusForm from "@/features/work-lifecycle/forms/change-work-status-form";
import type { WorkStatus } from "@/features/work-lifecycle/forms/work-lifecycle-copy";

import { DOCUMENTS_COPY } from "../forms/documents-copy";
import {
	documentHighlightCss,
	highlightDocumentCode,
} from "./document-highlight";

export type DocumentBodyBlock =
	| { kind: "markdown"; text: string }
	| { kind: "fenced-code"; language: string; source: string }
	| {
			error?: string;
			kind: "mermaid";
			source: string;
			status: "ok" | "error";
	  }
	| {
			error?: string;
			kind: "latex";
			source: string;
			status: "ok" | "error";
	  }
	| { kind: "live-marker"; language: string; source: string }
	| {
			kind:
				| "live-work"
				| "live-collection"
				| "live-section"
				| "live-diagram"
				| "live-diagram-view"
				| "inline-reference";
			reason: string;
			resolution: "broken";
			sourceRecordId: string;
	  }
	| {
			actions: {
				changeStatus: string;
				close: string;
				openSourceRecord: string;
			};
			id: string;
			key: string;
			kind: "live-work";
			label: string;
			plannedStart: string | null;
			priority: string | null;
			projectId: string;
			resolution: "ok";
			revision: number;
			targetDate: string | null;
			title: string;
			type: string;
			workStatus: string;
	  }
	| {
			id: string;
			kind: "live-collection";
			membershipRuleId: string;
			name: string;
			openSourceRecord: string;
			presentationId: string;
			resolution: "ok";
	  }
	| {
			heading: string;
			kind: "live-section";
			label: string;
			openSourceRecord: string;
			resolution: "ok";
			sectionId: string;
			sourceDocumentId: string;
			sourceTitle: string;
			text: string;
			updatedAt: string;
	  }
	| {
			authorityMode: string | null;
			canvas: false;
			id: string;
			kind: "live-diagram" | "live-diagram-view";
			openSourceRecord: string;
			readOnly: true;
			resolution: "ok";
			title: string;
	  }
	| {
			kind: "inline-reference";
			openSourceRecord: string;
			recordKind: string;
			resolution: "ok";
			sourceRecordId: string;
			title: string;
	  };

export default function DocumentBodyView({
	blocks,
	onBlockSourceChange,
	onConvertMermaid,
	onOpenSourceRecord,
}: {
	blocks: readonly DocumentBodyBlock[];
	onBlockSourceChange?: (previous: string, next: string) => void;
	onConvertMermaid?: (source: string) => void;
	onOpenSourceRecord?: (id: string, kind: string) => void;
}) {
	return (
		<div className="flex flex-col gap-3 text-sm">
			<style>{documentHighlightCss}</style>
			{blocks.map((block) => (
				<BodyBlock
					block={block}
					key={blockKey(block)}
					onBlockSourceChange={onBlockSourceChange}
					onConvertMermaid={onConvertMermaid}
					onOpenSourceRecord={onOpenSourceRecord}
				/>
			))}
		</div>
	);
}

function blockKey(block: DocumentBodyBlock): string {
	if (block.kind === "markdown") {
		return `markdown:${block.text}`;
	}
	if (block.kind === "fenced-code") {
		return `code:${block.language}:${block.source}`;
	}
	if (block.kind === "live-marker") {
		return `marker:${block.language}:${block.source}`;
	}
	if (block.kind === "mermaid" || block.kind === "latex") {
		return `${block.kind}:${block.status}:${block.source}`;
	}
	if ("id" in block) {
		return `${block.kind}:${block.id}`;
	}
	if ("sourceRecordId" in block) {
		return `${block.kind}:${block.sourceRecordId}`;
	}
	return block.kind;
}

function BodyBlock({
	block,
	onBlockSourceChange,
	onConvertMermaid,
	onOpenSourceRecord,
}: {
	block: DocumentBodyBlock;
	onBlockSourceChange?: (previous: string, next: string) => void;
	onConvertMermaid?: (source: string) => void;
	onOpenSourceRecord?: (id: string, kind: string) => void;
}) {
	if ("resolution" in block && block.resolution === "broken") {
		return <p role="alert">{block.reason}</p>;
	}
	if (block.kind === "markdown") {
		return <Markdown>{block.text}</Markdown>;
	}
	if (block.kind === "fenced-code") {
		return (
			<div
				className="overflow-x-auto bg-muted p-2"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: TanStack Highlight HTML
				dangerouslySetInnerHTML={{
					__html: highlightDocumentCode(block.source, block.language),
				}}
			/>
		);
	}
	if (block.kind === "mermaid") {
		return (
			<MermaidBlock
				block={block}
				onBlockSourceChange={onBlockSourceChange}
				onConvertMermaid={onConvertMermaid}
			/>
		);
	}
	if (block.kind === "latex") {
		return (
			<LatexBlock block={block} onBlockSourceChange={onBlockSourceChange} />
		);
	}
	if (block.kind === "live-work" && block.resolution === "ok") {
		return (
			<LiveWorkBlock block={block} onOpenSourceRecord={onOpenSourceRecord} />
		);
	}
	if (block.kind === "live-section" && block.resolution === "ok") {
		return (
			<section className="border border-input p-3">
				<p className="font-medium text-xs">{block.label}</p>
				<p>{block.sourceTitle}</p>
				<Markdown>{block.text}</Markdown>
				<OpenSource
					id={block.sourceDocumentId}
					kind="Document"
					onOpenSourceRecord={onOpenSourceRecord}
				/>
			</section>
		);
	}
	if (block.kind === "live-collection" && block.resolution === "ok") {
		return (
			<section className="border border-input p-3">
				<p className="font-medium">{block.name}</p>
				<OpenSource
					id={block.id}
					kind="live-collection"
					onOpenSourceRecord={onOpenSourceRecord}
				/>
			</section>
		);
	}
	if (
		(block.kind === "live-diagram" || block.kind === "live-diagram-view") &&
		block.resolution === "ok"
	) {
		return (
			<section className="border border-input p-3">
				<p className="font-medium">{block.title}</p>
				{block.authorityMode ? <p>{block.authorityMode}</p> : null}
				<OpenSource
					id={block.id}
					kind={block.kind}
					onOpenSourceRecord={onOpenSourceRecord}
				/>
			</section>
		);
	}
	if (block.kind === "inline-reference" && block.resolution === "ok") {
		return (
			<InlineReference block={block} onOpenSourceRecord={onOpenSourceRecord} />
		);
	}
	return null;
}

function InlineReference({
	block,
	onOpenSourceRecord,
}: {
	block: Extract<
		DocumentBodyBlock,
		{ kind: "inline-reference"; resolution: "ok" }
	>;
	onOpenSourceRecord?: (id: string, kind: string) => void;
}) {
	const onClick = useCallback(() => {
		onOpenSourceRecord?.(block.sourceRecordId, block.recordKind);
	}, [block.recordKind, block.sourceRecordId, onOpenSourceRecord]);
	return (
		<button className="underline" onClick={onClick} type="button">
			{block.title}
		</button>
	);
}

function LiveWorkBlock({
	block,
	onOpenSourceRecord,
}: {
	block: Extract<DocumentBodyBlock, { kind: "live-work"; resolution: "ok" }>;
	onOpenSourceRecord?: (id: string, kind: string) => void;
}) {
	return (
		<section className="flex flex-col gap-2 border border-input p-3">
			<p className="font-medium text-xs">{block.label}</p>
			<p>
				{block.key} {block.title}
			</p>
			<p>
				{block.type} · {block.workStatus}
				{block.plannedStart ? ` · ${block.plannedStart}` : ""}
				{block.targetDate ? ` · ${block.targetDate}` : ""}
			</p>
			<ChangeWorkStatusForm
				projectId={block.projectId}
				revision={block.revision}
				status={block.workStatus as WorkStatus}
				workId={block.id}
			/>
			<OpenSource
				id={block.id}
				kind="Work"
				onOpenSourceRecord={onOpenSourceRecord}
			/>
		</section>
	);
}

function OpenSource({
	id,
	kind,
	onOpenSourceRecord,
}: {
	id: string;
	kind: string;
	onOpenSourceRecord?: (id: string, kind: string) => void;
}) {
	const onClick = useCallback(() => {
		onOpenSourceRecord?.(id, kind);
	}, [id, kind, onOpenSourceRecord]);
	return (
		<Button onClick={onClick} size="sm" type="button" variant="outline">
			{DOCUMENTS_COPY.openSourceRecord}
		</Button>
	);
}

function MermaidBlock({
	block,
	onBlockSourceChange,
	onConvertMermaid,
}: {
	block: Extract<DocumentBodyBlock, { kind: "mermaid" }>;
	onBlockSourceChange?: (previous: string, next: string) => void;
	onConvertMermaid?: (source: string) => void;
}) {
	const reactId = useId().replaceAll(":", "");
	const [svg, setSvg] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(
		block.status === "error"
			? (block.error ?? DOCUMENTS_COPY.couldNotRender)
			: null
	);

	useEffect(() => {
		if (block.status === "error") {
			setSvg(null);
			setError(block.error ?? DOCUMENTS_COPY.couldNotRender);
			return;
		}
		let cancelled = false;
		mermaid.initialize({ startOnLoad: false });
		mermaid
			.render(`mermaid-${reactId}`, block.source)
			.then((result) => {
				if (!cancelled) {
					setSvg(result.svg);
					setError(null);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setSvg(null);
					setError(DOCUMENTS_COPY.couldNotRender);
				}
			});
		return () => {
			cancelled = true;
		};
	}, [block.error, block.source, block.status, reactId]);

	if (error) {
		return (
			<RenderFailure
				error={error}
				onBlockSourceChange={onBlockSourceChange}
				source={block.source}
			/>
		);
	}
	if (!svg) {
		return (
			<pre className="overflow-x-auto bg-muted p-2 font-mono text-xs">
				{block.source}
			</pre>
		);
	}
	return (
		<div className="flex flex-col gap-2">
			<div
				className="overflow-x-auto"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid SVG
				dangerouslySetInnerHTML={{ __html: svg }}
			/>
			{onConvertMermaid ? (
				<ConvertMermaidButton
					onConvertMermaid={onConvertMermaid}
					source={block.source}
				/>
			) : null}
		</div>
	);
}

function ConvertMermaidButton({
	onConvertMermaid,
	source,
}: {
	onConvertMermaid: (source: string) => void;
	source: string;
}) {
	const onClick = useCallback(() => {
		onConvertMermaid(source);
	}, [onConvertMermaid, source]);
	return (
		<Button onClick={onClick} size="sm" type="button" variant="outline">
			{DOCUMENTS_COPY.convertToTechnicalDiagram}
		</Button>
	);
}

function LatexBlock({
	block,
	onBlockSourceChange,
}: {
	block: Extract<DocumentBodyBlock, { kind: "latex" }>;
	onBlockSourceChange?: (previous: string, next: string) => void;
}) {
	if (block.status === "error") {
		return (
			<RenderFailure
				error={block.error ?? DOCUMENTS_COPY.couldNotRender}
				onBlockSourceChange={onBlockSourceChange}
				source={block.source}
			/>
		);
	}
	try {
		const html = katex.renderToString(block.source, {
			displayMode: true,
			throwOnError: true,
		});
		return (
			<div
				// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX HTML
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		);
	} catch {
		return (
			<RenderFailure
				error={DOCUMENTS_COPY.couldNotRender}
				onBlockSourceChange={onBlockSourceChange}
				source={block.source}
			/>
		);
	}
}

function RenderFailure({
	error,
	onBlockSourceChange,
	source,
}: {
	error: string;
	onBlockSourceChange?: (previous: string, next: string) => void;
	source: string;
}) {
	const onChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			onBlockSourceChange?.(source, event.target.value);
		},
		[onBlockSourceChange, source]
	);
	return (
		<div className="flex flex-col gap-2 border border-destructive/40 p-2">
			<p role="alert">{error}</p>
			<label className="flex flex-col gap-1 text-xs">
				{DOCUMENTS_COPY.editableSource}
				<textarea
					className="min-h-16 border border-input bg-transparent p-2 font-mono text-xs"
					defaultValue={source}
					onChange={onChange}
					readOnly={!onBlockSourceChange}
				/>
			</label>
		</div>
	);
}
