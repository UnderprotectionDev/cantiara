// biome-ignore-all lint/performance/noJsxPropsBind: Toolbar commands use the current Tiptap selection.

import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  Popover,
  type PopoverActions,
  PopoverContent,
  PopoverTrigger,
} from "@cantiara/ui/components/popover";
import { useForm, useSelector } from "@tanstack/react-form";
import type { useEditor } from "@tiptap/react";
import { Link2, Unlink2 } from "lucide-react";
import { useRef } from "react";
import { submitForm } from "@/lib/submit-form";
import { documentLinkFormSchema } from "../../lib/document-insert-form";
import FieldErrors from "../components/document-field-errors";

type Editor = NonNullable<ReturnType<typeof useEditor>>;
export function DocumentLinkPopover({
  active,
  editor,
}: {
  active: boolean;
  editor: Editor;
}) {
  const popoverActions = useRef<PopoverActions | null>(null);
  const linkSelection = useRef<Editor["state"]["selection"] | null>(null);

  const linkForm = useForm({
    defaultValues: { url: "" },
    onSubmit: ({ value }) => {
      const parsed = documentLinkFormSchema.safeParse(value);
      if (!parsed.success) {
        linkForm.setErrorMap({
          onSubmit: {
            form: parsed.error.issues[0]?.message ?? null,
            fields: {},
          },
        });
        return;
      }
      linkForm.setErrorMap({ onSubmit: undefined });
      const chain = editor.chain().focus();
      if (linkSelection.current) {
        const selection = linkSelection.current;
        chain.command(({ tr }) => {
          tr.setSelection(selection);
          return true;
        });
      }
      chain.extendMarkRange("link").setLink({ href: parsed.data.url }).run();
      linkSelection.current = null;
      popoverActions.current?.close();
    },
  });
  const error = useSelector(
    linkForm.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  return (
    <Popover actionsRef={popoverActions}>
      <PopoverTrigger
        aria-label="Link"
        aria-pressed={active}
        className={`inline-flex size-10 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring ${active ? "bg-accent text-accent-foreground" : ""}`}
        onClick={() => {
          linkForm.setErrorMap({ onSubmit: undefined });
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
            submitForm(linkForm).catch(() => undefined);
          }}
        >
          <label className="font-medium" htmlFor="document-link-url">
            URL
          </label>
          <linkForm.Field name="url">
            {(field) => (
              <>
                <Input
                  id="document-link-url"
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="https://example.com"
                  value={field.state.value}
                />
                <FieldErrors errors={error ? [{ message: error }] : []} />
              </>
            )}
          </linkForm.Field>
          <div className="flex justify-end gap-2">
            {active ? (
              <Button
                onClick={() => {
                  editor.chain().focus().unsetLink().run();
                  popoverActions.current?.close();
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
