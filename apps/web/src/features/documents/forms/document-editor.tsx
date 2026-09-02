import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect } from "react";

import { DOCUMENTS_COPY } from "./documents-copy";

export default function DocumentEditor({
	onChange,
	value,
}: {
	onChange: (markdown: string) => void;
	value: string;
}) {
	const editor = useEditor({
		content: value,
		contentType: "markdown",
		extensions: [StarterKit, TableKit, Markdown],
		immediatelyRender: false,
		onUpdate: ({ editor: instance }) => {
			onChange(instance.getMarkdown());
		},
	});

	useEffect(() => {
		if (!editor) {
			return;
		}
		const current = editor.getMarkdown();
		if (current === value) {
			return;
		}
		editor.commands.setContent(value, { contentType: "markdown" });
	}, [editor, value]);

	if (!editor) {
		return null;
	}

	return (
		<div className="flex flex-col gap-2">
			<DocumentToolbar editor={editor} />
			<EditorContent
				aria-label={DOCUMENTS_COPY.body}
				className="tiptap-document min-h-48 rounded-none border border-input px-2.5 py-2 text-sm [&_.tiptap]:min-h-40 [&_.tiptap]:outline-none [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-2 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:p-1"
				editor={editor}
			/>
		</div>
	);
}

function DocumentToolbar({ editor }: { editor: Editor }) {
	const onBold = useCallback(() => {
		editor.chain().focus().toggleBold().run();
	}, [editor]);
	const onItalic = useCallback(() => {
		editor.chain().focus().toggleItalic().run();
	}, [editor]);
	const onCode = useCallback(() => {
		editor.chain().focus().toggleCodeBlock().run();
	}, [editor]);
	const onTable = useCallback(() => {
		editor
			.chain()
			.focus()
			.insertTable({ cols: 2, rows: 2, withHeaderRow: true })
			.run();
	}, [editor]);

	return (
		<div className="flex flex-wrap gap-2">
			<button
				className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
				onClick={onBold}
				type="button"
			>
				Bold
			</button>
			<button
				className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
				onClick={onItalic}
				type="button"
			>
				Italic
			</button>
			<button
				className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
				onClick={onCode}
				type="button"
			>
				Code
			</button>
			<button
				className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
				onClick={onTable}
				type="button"
			>
				Table
			</button>
		</div>
	);
}
