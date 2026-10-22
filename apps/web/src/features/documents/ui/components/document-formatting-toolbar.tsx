// biome-ignore-all lint/performance/noJsxPropsBind: Toolbar commands use the current Tiptap selection.
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Separator } from "@cantiara/ui/components/separator";
import { type useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Braces,
  Code2,
  Columns3,
  Italic,
  List,
  ListOrdered,
  type LucideIcon,
  Minus,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table2,
  Trash2,
  Undo2,
  Workflow,
} from "lucide-react";
import { DocumentFormulaPopover } from "../forms/document-formula-form";
import { DocumentLinkPopover } from "../forms/document-link-form";

type Editor = NonNullable<ReturnType<typeof useEditor>>;

function ToolButton({
  label,
  icon: Icon,
  active,
  disabled,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      aria-pressed={active}
      className={active ? "bg-accent text-accent-foreground" : undefined}
      disabled={disabled}
      onClick={onClick}
      size="icon-sm"
      title={label}
      type="button"
      variant="ghost"
    >
      <Icon aria-hidden="true" />
    </Button>
  );
}

export default function DocumentFormattingToolbar({
  editor,
}: {
  editor: Editor;
}) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      heading1: current.isActive("heading", { level: 1 }),
      heading2: current.isActive("heading", { level: 2 }),
      heading3: current.isActive("heading", { level: 3 }),
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      link: current.isActive("link"),
      table: current.isActive("table"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      codeBlock: current.isActive("codeBlock"),
      codeLanguage: current.getAttributes("codeBlock").language ?? "",
      mermaid: current.isActive("codeBlock", { language: "mermaid" }),
      canUndo: current.can().undo(),
      canRedo: current.can().redo(),
    }),
  });
  let block = "paragraph";
  if (state.heading1) {
    block = "heading1";
  } else if (state.heading2) {
    block = "heading2";
  } else if (state.heading3) {
    block = "heading3";
  }

  return (
    <>
      <div
        aria-describedby="document-toolbar-hint"
        aria-label="Document formatting"
        className="flex max-w-full items-center gap-1 overflow-x-auto border-border border-b bg-muted/25 p-2 [scrollbar-width:thin]"
        role="toolbar"
      >
        <NativeSelect
          aria-label="Text style"
          className="mr-1 min-w-36 shrink-0"
          onChange={(event) => {
            const { value } = event.target;
            if (value === "paragraph") {
              editor.chain().focus().setParagraph().run();
            } else {
              const level = Number(value.slice(-1)) as 1 | 2 | 3;
              editor.chain().focus().setHeading({ level }).run();
            }
          }}
          size="sm"
          value={block}
        >
          <NativeSelectOption value="paragraph">Paragraph</NativeSelectOption>
          <NativeSelectOption value="heading1">Heading 1</NativeSelectOption>
          <NativeSelectOption value="heading2">Heading 2</NativeSelectOption>
          <NativeSelectOption value="heading3">Heading 3</NativeSelectOption>
        </NativeSelect>
        <Separator className="mx-1 h-7 shrink-0" orientation="vertical" />
        <fieldset
          aria-label="Text formatting"
          className="flex shrink-0 items-center gap-1 border-0 p-0"
        >
          <ToolButton
            active={state.bold}
            icon={Bold}
            label="Bold"
            onClick={() => editor.chain().focus().toggleBold().run()}
          />
          <ToolButton
            active={state.italic}
            icon={Italic}
            label="Italic"
            onClick={() => editor.chain().focus().toggleItalic().run()}
          />
          <ToolButton
            active={state.strike}
            icon={Strikethrough}
            label="Strikethrough"
            onClick={() => editor.chain().focus().toggleStrike().run()}
          />
          <ToolButton
            active={state.code}
            icon={Code2}
            label="Inline code"
            onClick={() => editor.chain().focus().toggleCode().run()}
          />
          <DocumentLinkPopover active={state.link} editor={editor} />
        </fieldset>
        <Separator className="mx-1 h-7 shrink-0" orientation="vertical" />
        <fieldset
          aria-label="Block formatting"
          className="flex shrink-0 items-center gap-1 border-0 p-0"
        >
          <ToolButton
            active={state.bulletList}
            icon={List}
            label="Bullet list"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          />
          <ToolButton
            active={state.orderedList}
            icon={ListOrdered}
            label="Numbered list"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          />
          <ToolButton
            active={state.blockquote}
            icon={Quote}
            label="Quote"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          />
          <ToolButton
            active={state.codeBlock && !state.mermaid}
            icon={Braces}
            label="Code block"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          />
          {state.codeBlock && !state.mermaid ? (
            <NativeSelect
              aria-label="Code language"
              className="min-w-32"
              onChange={(event) =>
                editor
                  .chain()
                  .focus()
                  .updateAttributes("codeBlock", {
                    language: event.target.value,
                  })
                  .run()
              }
              size="sm"
              value={state.codeLanguage}
            >
              <NativeSelectOption value="">Auto detect</NativeSelectOption>
              <NativeSelectOption value="typescript">
                TypeScript
              </NativeSelectOption>
              <NativeSelectOption value="javascript">
                JavaScript
              </NativeSelectOption>
              <NativeSelectOption value="json">JSON</NativeSelectOption>
              <NativeSelectOption value="sql">SQL</NativeSelectOption>
              <NativeSelectOption value="bash">Bash</NativeSelectOption>
              <NativeSelectOption value="python">Python</NativeSelectOption>
            </NativeSelect>
          ) : null}
        </fieldset>
        <Separator className="mx-1 h-7 shrink-0" orientation="vertical" />
        <fieldset
          aria-label="Insert content"
          className="flex shrink-0 items-center gap-1 border-0 p-0"
        >
          <ToolButton
            icon={Table2}
            label="Insert table"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          />
          <ToolButton
            active={state.mermaid}
            icon={Workflow}
            label="Mermaid block"
            onClick={() =>
              editor.chain().focus().setCodeBlock({ language: "mermaid" }).run()
            }
          />
          <DocumentFormulaPopover editor={editor} />
          <ToolButton
            icon={Minus}
            label="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          />
        </fieldset>
        <Separator className="mx-1 h-7 shrink-0" orientation="vertical" />
        <fieldset
          aria-label="Edit history"
          className="flex shrink-0 items-center gap-1 border-0 p-0"
        >
          <ToolButton
            disabled={!state.canUndo}
            icon={Undo2}
            label="Undo"
            onClick={() => editor.chain().focus().undo().run()}
          />
          <ToolButton
            disabled={!state.canRedo}
            icon={Redo2}
            label="Redo"
            onClick={() => editor.chain().focus().redo().run()}
          />
        </fieldset>
        {state.table ? (
          <fieldset
            aria-label="Table editing"
            className="flex shrink-0 items-center gap-1 border-border border-l pl-2"
          >
            <ToolButton
              icon={Rows3}
              label="Add row"
              onClick={() => editor.chain().focus().addRowAfter().run()}
            />
            <ToolButton
              icon={Columns3}
              label="Add column"
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            />
            <ToolButton
              icon={Trash2}
              label="Delete table"
              onClick={() => editor.chain().focus().deleteTable().run()}
            />
          </fieldset>
        ) : null}
      </div>
      <p
        className="border-border border-b px-3 py-1 text-muted-foreground text-xs sm:hidden"
        id="document-toolbar-hint"
      >
        Swipe for more formatting tools →
      </p>
    </>
  );
}
