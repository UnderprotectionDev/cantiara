import { Button } from "@cantiara/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@cantiara/ui/components/dropdown-menu";
import { Input } from "@cantiara/ui/components/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { Separator } from "@cantiara/ui/components/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@cantiara/ui/components/tooltip";
import { cn } from "@cantiara/ui/lib/utils";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	ChevronDown,
	Code,
	Heading,
	Highlighter,
	Italic,
	Link,
	List,
	Quote,
	Redo2,
	SquareCode,
	Strikethrough,
	Subscript,
	Superscript,
	Table,
	Underline,
	Undo2,
} from "lucide-react";
import { type ChangeEvent, type ReactNode, useCallback, useState } from "react";

import { DOCUMENTS_COPY } from "./documents-copy";

export default function DocumentToolbar({ editor }: { editor: Editor }) {
	const state = useEditorState({
		editor,
		selector: ({ editor: instance }) => ({
			alignCenter: instance.isActive({ textAlign: "center" }),
			alignJustify: instance.isActive({ textAlign: "justify" }),
			alignLeft: instance.isActive({ textAlign: "left" }),
			alignRight: instance.isActive({ textAlign: "right" }),
			blockquote: instance.isActive("blockquote"),
			bold: instance.isActive("bold"),
			bulletList: instance.isActive("bulletList"),
			canRedo: instance.can().redo(),
			canUndo: instance.can().undo(),
			code: instance.isActive("code"),
			codeBlock: instance.isActive("codeBlock"),
			heading1: instance.isActive("heading", { level: 1 }),
			heading2: instance.isActive("heading", { level: 2 }),
			heading3: instance.isActive("heading", { level: 3 }),
			highlight: instance.isActive("highlight"),
			italic: instance.isActive("italic"),
			link: instance.isActive("link"),
			orderedList: instance.isActive("orderedList"),
			strike: instance.isActive("strike"),
			subscript: instance.isActive("subscript"),
			superscript: instance.isActive("superscript"),
			underline: instance.isActive("underline"),
		}),
	});

	const onUndo = useCallback(() => {
		editor.chain().focus().undo().run();
	}, [editor]);
	const onRedo = useCallback(() => {
		editor.chain().focus().redo().run();
	}, [editor]);
	const onParagraph = useCallback(() => {
		editor.chain().focus().setParagraph().run();
	}, [editor]);
	const onHeading1 = useCallback(() => {
		editor.chain().focus().toggleHeading({ level: 1 }).run();
	}, [editor]);
	const onHeading2 = useCallback(() => {
		editor.chain().focus().toggleHeading({ level: 2 }).run();
	}, [editor]);
	const onHeading3 = useCallback(() => {
		editor.chain().focus().toggleHeading({ level: 3 }).run();
	}, [editor]);
	const onBulletList = useCallback(() => {
		editor.chain().focus().toggleBulletList().run();
	}, [editor]);
	const onOrderedList = useCallback(() => {
		editor.chain().focus().toggleOrderedList().run();
	}, [editor]);
	const onBlockquote = useCallback(() => {
		editor.chain().focus().toggleBlockquote().run();
	}, [editor]);
	const onCodeBlock = useCallback(() => {
		editor.chain().focus().toggleCodeBlock().run();
	}, [editor]);
	const onBold = useCallback(() => {
		editor.chain().focus().toggleBold().run();
	}, [editor]);
	const onItalic = useCallback(() => {
		editor.chain().focus().toggleItalic().run();
	}, [editor]);
	const onStrike = useCallback(() => {
		editor.chain().focus().toggleStrike().run();
	}, [editor]);
	const onInlineCode = useCallback(() => {
		editor.chain().focus().toggleCode().run();
	}, [editor]);
	const onUnderline = useCallback(() => {
		editor.chain().focus().toggleUnderline().run();
	}, [editor]);
	const onHighlight = useCallback(() => {
		editor.chain().focus().toggleHighlight().run();
	}, [editor]);
	const [linkHref, setLinkHref] = useState("");
	const onLinkOpenChange = useCallback(
		(open: boolean) => {
			if (open) {
				setLinkHref(String(editor.getAttributes("link").href ?? ""));
			}
		},
		[editor]
	);
	const onLinkHrefChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setLinkHref(event.target.value);
		},
		[]
	);
	const onApplyLink = useCallback(() => {
		const href = linkHref.trim();
		if (href.length === 0) {
			editor.chain().focus().unsetLink().run();
			return;
		}
		editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
	}, [editor, linkHref]);
	const onSuperscript = useCallback(() => {
		editor.chain().focus().toggleSuperscript().run();
	}, [editor]);
	const onSubscript = useCallback(() => {
		editor.chain().focus().toggleSubscript().run();
	}, [editor]);
	const onAlignLeft = useCallback(() => {
		editor.chain().focus().setTextAlign("left").run();
	}, [editor]);
	const onAlignCenter = useCallback(() => {
		editor.chain().focus().setTextAlign("center").run();
	}, [editor]);
	const onAlignRight = useCallback(() => {
		editor.chain().focus().setTextAlign("right").run();
	}, [editor]);
	const onAlignJustify = useCallback(() => {
		editor.chain().focus().setTextAlign("justify").run();
	}, [editor]);
	const onTable = useCallback(() => {
		editor
			.chain()
			.focus()
			.insertTable({ cols: 2, rows: 2, withHeaderRow: true })
			.run();
	}, [editor]);
	const onMermaid = useCallback(() => {
		editor
			.chain()
			.focus()
			.insertContent("```mermaid\ngraph TD\n  A-->B\n```\n", {
				contentType: "markdown",
			})
			.run();
	}, [editor]);
	const onLatex = useCallback(() => {
		editor
			.chain()
			.focus()
			.insertContent("$$E = mc^2$$\n", { contentType: "markdown" })
			.run();
	}, [editor]);

	return (
		<TooltipProvider delay={400}>
			<div
				className="flex flex-wrap items-center gap-0.5 border-input border-b bg-muted/40 px-1 py-1"
				role="toolbar"
			>
				<ToolbarGroup>
					<ToolbarButton
						active={false}
						disabled={!state.canUndo}
						label={DOCUMENTS_COPY.toolbar.undo}
						onClick={onUndo}
					>
						<Undo2 />
					</ToolbarButton>
					<ToolbarButton
						active={false}
						disabled={!state.canRedo}
						label={DOCUMENTS_COPY.toolbar.redo}
						onClick={onRedo}
					>
						<Redo2 />
					</ToolbarButton>
				</ToolbarGroup>
				<ToolbarDivider />
				<ToolbarGroup>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									aria-label={DOCUMENTS_COPY.toolbar.heading}
									className={cn(
										"px-1.5",
										(state.heading1 || state.heading2 || state.heading3) &&
											"bg-muted text-foreground"
									)}
									size="icon-sm"
									type="button"
									variant="ghost"
								/>
							}
						>
							<Heading />
							<ChevronDown className="size-3 opacity-70" />
						</DropdownMenuTrigger>
						<DropdownMenuContent className="min-w-36 bg-popover">
							<DropdownMenuItem onClick={onParagraph}>
								{DOCUMENTS_COPY.toolbar.paragraph}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onHeading1}>
								{DOCUMENTS_COPY.toolbar.heading1}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onHeading2}>
								{DOCUMENTS_COPY.toolbar.heading2}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onHeading3}>
								{DOCUMENTS_COPY.toolbar.heading3}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button
									aria-label={DOCUMENTS_COPY.toolbar.bulletList}
									className={cn(
										"px-1.5",
										(state.bulletList || state.orderedList) &&
											"bg-muted text-foreground"
									)}
									size="icon-sm"
									type="button"
									variant="ghost"
								/>
							}
						>
							<List />
							<ChevronDown className="size-3 opacity-70" />
						</DropdownMenuTrigger>
						<DropdownMenuContent className="min-w-36 bg-popover">
							<DropdownMenuItem onClick={onBulletList}>
								{DOCUMENTS_COPY.toolbar.bulletList}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={onOrderedList}>
								{DOCUMENTS_COPY.toolbar.orderedList}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
					<ToolbarButton
						active={state.blockquote}
						label={DOCUMENTS_COPY.toolbar.blockquote}
						onClick={onBlockquote}
					>
						<Quote />
					</ToolbarButton>
					<ToolbarButton
						active={state.codeBlock}
						label={DOCUMENTS_COPY.toolbar.code}
						onClick={onCodeBlock}
					>
						<SquareCode />
					</ToolbarButton>
				</ToolbarGroup>
				<ToolbarDivider />
				<ToolbarGroup>
					<ToolbarButton
						active={state.bold}
						label={DOCUMENTS_COPY.toolbar.bold}
						onClick={onBold}
					>
						<Bold />
					</ToolbarButton>
					<ToolbarButton
						active={state.italic}
						label={DOCUMENTS_COPY.toolbar.italic}
						onClick={onItalic}
					>
						<Italic />
					</ToolbarButton>
					<ToolbarButton
						active={state.strike}
						label={DOCUMENTS_COPY.toolbar.strike}
						onClick={onStrike}
					>
						<Strikethrough />
					</ToolbarButton>
					<ToolbarButton
						active={state.code}
						label={DOCUMENTS_COPY.toolbar.inlineCode}
						onClick={onInlineCode}
					>
						<Code />
					</ToolbarButton>
					<ToolbarButton
						active={state.underline}
						label={DOCUMENTS_COPY.toolbar.underline}
						onClick={onUnderline}
					>
						<Underline />
					</ToolbarButton>
					<ToolbarButton
						active={state.highlight}
						label={DOCUMENTS_COPY.toolbar.highlight}
						onClick={onHighlight}
					>
						<Highlighter />
					</ToolbarButton>
					<Popover onOpenChange={onLinkOpenChange}>
						<PopoverTrigger
							render={
								<Button
									aria-label={DOCUMENTS_COPY.toolbar.link}
									aria-pressed={state.link}
									className={cn(state.link && "bg-muted text-foreground")}
									size="icon-sm"
									type="button"
									variant="ghost"
								/>
							}
						>
							<Link />
						</PopoverTrigger>
						<PopoverContent align="start" className="w-64">
							<label
								className="flex flex-col gap-1 text-xs"
								htmlFor="document-link-href"
							>
								{DOCUMENTS_COPY.toolbar.link}
								<Input
									id="document-link-href"
									onChange={onLinkHrefChange}
									type="url"
									value={linkHref}
								/>
							</label>
							<Button onClick={onApplyLink} size="sm" type="button">
								{DOCUMENTS_COPY.toolbar.applyLink}
							</Button>
						</PopoverContent>
					</Popover>
				</ToolbarGroup>
				<ToolbarDivider />
				<ToolbarGroup>
					<ToolbarButton
						active={state.superscript}
						label={DOCUMENTS_COPY.toolbar.superscript}
						onClick={onSuperscript}
					>
						<Superscript />
					</ToolbarButton>
					<ToolbarButton
						active={state.subscript}
						label={DOCUMENTS_COPY.toolbar.subscript}
						onClick={onSubscript}
					>
						<Subscript />
					</ToolbarButton>
				</ToolbarGroup>
				<ToolbarDivider />
				<ToolbarGroup>
					<ToolbarButton
						active={state.alignLeft}
						label={DOCUMENTS_COPY.toolbar.alignLeft}
						onClick={onAlignLeft}
					>
						<AlignLeft />
					</ToolbarButton>
					<ToolbarButton
						active={state.alignCenter}
						label={DOCUMENTS_COPY.toolbar.alignCenter}
						onClick={onAlignCenter}
					>
						<AlignCenter />
					</ToolbarButton>
					<ToolbarButton
						active={state.alignRight}
						label={DOCUMENTS_COPY.toolbar.alignRight}
						onClick={onAlignRight}
					>
						<AlignRight />
					</ToolbarButton>
					<ToolbarButton
						active={state.alignJustify}
						label={DOCUMENTS_COPY.toolbar.alignJustify}
						onClick={onAlignJustify}
					>
						<AlignJustify />
					</ToolbarButton>
				</ToolbarGroup>
				<ToolbarDivider />
				<ToolbarGroup>
					<ToolbarButton
						active={false}
						label={DOCUMENTS_COPY.toolbar.table}
						onClick={onTable}
					>
						<Table />
					</ToolbarButton>
					<ToolbarButton
						active={false}
						label={DOCUMENTS_COPY.toolbar.mermaid}
						onClick={onMermaid}
					>
						<span className="font-mono text-[10px] leading-none">M</span>
					</ToolbarButton>
					<ToolbarButton
						active={false}
						label={DOCUMENTS_COPY.toolbar.latex}
						onClick={onLatex}
					>
						<span className="font-serif text-sm leading-none">∑</span>
					</ToolbarButton>
				</ToolbarGroup>
			</div>
		</TooltipProvider>
	);
}

function ToolbarGroup({ children }: { children: ReactNode }) {
	return <div className="flex items-center">{children}</div>;
}

function ToolbarDivider() {
	return (
		<Separator
			className="mx-1 h-5 w-px self-center data-vertical:h-5"
			orientation="vertical"
		/>
	);
}

function ToolbarButton({
	active,
	children,
	disabled,
	label,
	onClick,
}: {
	active: boolean;
	children: ReactNode;
	disabled?: boolean;
	label: string;
	onClick: () => void;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						aria-label={label}
						aria-pressed={active}
						className={cn(active && "bg-muted text-foreground")}
						disabled={disabled}
						onClick={onClick}
						size="icon-sm"
						type="button"
						variant="ghost"
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent>{label}</TooltipContent>
		</Tooltip>
	);
}
