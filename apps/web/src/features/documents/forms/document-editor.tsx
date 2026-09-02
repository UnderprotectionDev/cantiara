import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import DocumentToolbar from "./document-toolbar";
import { DOCUMENTS_COPY } from "./documents-copy";

const DOCUMENT_EXTENSIONS = [
	StarterKit,
	Underline,
	Highlight,
	Link.configure({ openOnClick: false }),
	Subscript,
	Superscript,
	TextAlign.configure({ types: ["heading", "paragraph"] }),
	TableKit,
	Markdown,
];

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
		extensions: DOCUMENT_EXTENSIONS,
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
		<div className="overflow-hidden rounded-none border border-input">
			<DocumentToolbar editor={editor} />
			<EditorContent
				aria-label={DOCUMENTS_COPY.body}
				className="tiptap-document px-3 py-2.5 text-sm [&_.tiptap]:min-h-40 [&_.tiptap]:outline-none [&_blockquote]:border-border [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_h1]:font-semibold [&_h1]:text-2xl [&_h2]:font-semibold [&_h2]:text-xl [&_h3]:font-medium [&_h3]:text-lg [&_mark]:bg-yellow-300/40 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:bg-muted [&_pre]:p-2 [&_table]:w-full [&_td]:border [&_td]:border-border [&_td]:p-1 [&_th]:border [&_th]:border-border [&_th]:p-1 [&_ul]:list-disc [&_ul]:pl-5"
				editor={editor}
			/>
		</div>
	);
}
