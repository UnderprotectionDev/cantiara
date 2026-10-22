// biome-ignore-all lint/performance/noJsxPropsBind: Toolbar commands use the current Tiptap selection.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { useForm } from "@tanstack/react-form";
import type { useEditor } from "@tiptap/react";
import { Link2, Unlink2 } from "lucide-react";
import { useRef, useState } from "react";
import { z } from "zod";
import FieldErrors from "../components/document-field-errors";

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

export function DocumentLinkPopover({
  active,
  editor,
}: {
  active: boolean;
  editor: Editor;
}) {
  const [open, setOpen] = useState(false);
  const linkSelection = useRef<Editor["state"]["selection"] | null>(null);
  const linkForm = useForm({
    defaultValues: { url: "" },
    onSubmit: ({ value }) => {
      const chain = editor.chain().focus();
      if (linkSelection.current) {
        const selection = linkSelection.current;
        chain.command(({ tr }) => {
          tr.setSelection(selection);
          return true;
        });
      }
      chain.extendMarkRange("link").setLink({ href: value.url.trim() }).run();
      linkSelection.current = null;
      setOpen(false);
    },
  });
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label="Link"
        aria-pressed={active}
        className={`inline-flex size-10 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring ${active ? "bg-accent text-accent-foreground" : ""}`}
        onClick={() => {
          linkForm.reset({
            url: editor.getAttributes("link").href ?? "",
          });
        }}
        onMouseDown={() => {
          linkSelection.current = editor.state.selection;
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
            event.stopPropagation();
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
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="https://example.com"
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </>
            )}
          </linkForm.Field>
          <div className="flex justify-end gap-2">
            {active ? (
              <Button
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  setOpen(false);
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
  );
}
