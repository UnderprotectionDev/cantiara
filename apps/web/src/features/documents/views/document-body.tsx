import { Markdown } from "@tanstack/markdown/react";
import katex from "katex";
import mermaid from "mermaid";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useId, useState } from "react";

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
	  };

export default function DocumentBodyView({
	blocks,
	onBlockSourceChange,
}: {
	blocks: readonly DocumentBodyBlock[];
	onBlockSourceChange?: (previous: string, next: string) => void;
}) {
	return (
		<div className="flex flex-col gap-3 text-sm">
			<style>{documentHighlightCss}</style>
			{blocks.map((block) => (
				<BodyBlock
					block={block}
					key={blockKey(block)}
					onBlockSourceChange={onBlockSourceChange}
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
	return `${block.kind}:${block.status}:${block.source}`;
}

function BodyBlock({
	block,
	onBlockSourceChange,
}: {
	block: DocumentBodyBlock;
	onBlockSourceChange?: (previous: string, next: string) => void;
}) {
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
			<MermaidBlock block={block} onBlockSourceChange={onBlockSourceChange} />
		);
	}
	return <LatexBlock block={block} onBlockSourceChange={onBlockSourceChange} />;
}

function MermaidBlock({
	block,
	onBlockSourceChange,
}: {
	block: Extract<DocumentBodyBlock, { kind: "mermaid" }>;
	onBlockSourceChange?: (previous: string, next: string) => void;
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
		<div
			className="overflow-x-auto"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: mermaid SVG
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
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
