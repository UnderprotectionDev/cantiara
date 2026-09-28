// biome-ignore-all lint/performance/noJsxPropsBind: Toolbar commands use the current Tiptap selection.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { Separator } from "@cantiara/ui/components/separator";
import { useForm } from "@tanstack/react-form";
import { type useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Braces,
  Code2,
  Columns3,
  Italic,
  Link2,
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
  Unlink2,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";

type Editor = NonNullable<ReturnType<typeof useEditor>>;
const allowedLinkPattern = /^(https?:\/\/|mailto:)/i;
const linkSchema = z
  .string()
  .trim()
  .refine((value) => {
    if (!allowedLinkPattern.test(value)) {
      return false;
    }
    try {
      const url = new URL(value);
      return url.protocol === "mailto:" ? !!url.pathname : !!url.hostname;
    } catch {
      return false;
    }
  }, "Use an http, https, or mailto URL.");

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
  const [linkOpen, setLinkOpen] = useState(false);
  const linkForm = useForm({
    defaultValues: { url: "" },
    onSubmit: ({ value }) => {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: value.url.trim() })
        .run();
      setLinkOpen(false);
    },
  });
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
    <div
      aria-label="Document formatting"
      className="flex flex-wrap items-center gap-1 border-border border-b bg-muted/35 p-2"
      role="toolbar"
    >
      <NativeSelect
        aria-label="Text style"
        className="mr-1 min-w-36"
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
      <Separator className="mx-1 h-7" orientation="vertical" />
      <fieldset
        aria-label="Text formatting"
        className="flex items-center gap-1 border-0 p-0"
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
        <Popover onOpenChange={setLinkOpen} open={linkOpen}>
          <PopoverTrigger
            aria-label="Link"
            aria-pressed={state.link}
            className={`inline-flex size-10 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring ${state.link ? "bg-accent text-accent-foreground" : ""}`}
            onClick={() => {
              linkForm.reset({ url: editor.getAttributes("link").href ?? "" });
            }}
            title="Link"
            type="button"
          >
            <Link2 aria-hidden="true" className="size-4" />
          </PopoverTrigger>
          <PopoverContent align="start" aria-label="Edit link">
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                linkForm.handleSubmit().catch(() => undefined);
              }}
            >
              <label className="font-medium" htmlFor="document-link-url">
                URL
              </label>
              <linkForm.Field name="url" validators={{ onSubmit: linkSchema }}>
                {(field) => (
                  <>
                    <Input
                      id="document-link-url"
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      placeholder="https://example.com"
                      value={field.state.value}
                    />
                    {field.state.meta.errors
                      .filter((error) => error !== undefined)
                      .map((error) => (
                        <p key={error.message} role="alert">
                          {error.message}
                        </p>
                      ))}
                  </>
                )}
              </linkForm.Field>
              <div className="flex justify-end gap-2">
                {state.link ? (
                  <Button
                    onClick={() => {
                      editor.chain().focus().unsetLink().run();
                      setLinkOpen(false);
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Unlink2 aria-hidden="true" /> Remove link
                  </Button>
                ) : null}
                <Button size="sm" type="submit">
                  Apply link
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </fieldset>
      <Separator className="mx-1 h-7" orientation="vertical" />
      <fieldset
        aria-label="Block formatting"
        className="flex items-center gap-1 border-0 p-0"
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
      </fieldset>
      <Separator className="mx-1 h-7" orientation="vertical" />
      <fieldset
        aria-label="Insert content"
        className="flex items-center gap-1 border-0 p-0"
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
        <ToolButton
          icon={Minus}
          label="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </fieldset>
      <Separator className="mx-1 h-7" orientation="vertical" />
      <fieldset
        aria-label="Edit history"
        className="flex items-center gap-1 border-0 p-0"
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
          className="flex basis-full items-center gap-1 border-border border-t pt-1"
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
  );
}
