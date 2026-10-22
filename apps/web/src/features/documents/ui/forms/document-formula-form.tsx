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
import { useForm } from "@tanstack/react-form";
import type { useEditor } from "@tiptap/react";
import { Sigma } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import FieldErrors from "../components/document-field-errors";

type Editor = NonNullable<ReturnType<typeof useEditor>>;

export function DocumentFormulaPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const formulaForm = useForm({
    defaultValues: { latex: "", placement: "inline" },
    onSubmit: ({ value }) => {
      const latex = value.latex.trim();
      if (value.placement === "block") {
        editor.chain().focus().insertBlockMath({ latex }).run();
      } else {
        editor.chain().focus().insertInlineMath({ latex }).run();
      }
      setOpen(false);
      formulaForm.reset();
    },
  });
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label="Insert formula"
        className="inline-flex size-10 items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring"
        title="Insert formula"
        type="button"
      >
        <Sigma aria-hidden="true" className="size-4" />
      </PopoverTrigger>
      <PopoverContent align="start" aria-label="Formula">
        <form
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            formulaForm.handleSubmit().catch(() => undefined);
          }}
        >
          <formulaForm.Field
            name="latex"
            validators={{
              onSubmit: z.string().trim().min(1, "LaTeX is required."),
            }}
          >
            {(field) => (
              <div className="space-y-1">
                <label className="font-medium" htmlFor="document-formula-latex">
                  LaTeX
                </label>
                <Input
                  id="document-formula-latex"
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="x^2"
                  value={field.state.value}
                />
                <FieldErrors errors={field.state.meta.errors} />
              </div>
            )}
          </formulaForm.Field>
          <formulaForm.Field name="placement">
            {(field) => (
              <div className="space-y-1">
                <label
                  className="font-medium"
                  htmlFor="document-formula-placement"
                >
                  Placement
                </label>
                <NativeSelect
                  id="document-formula-placement"
                  onChange={(event) => field.handleChange(event.target.value)}
                  value={field.state.value}
                >
                  <NativeSelectOption value="inline">Inline</NativeSelectOption>
                  <NativeSelectOption value="block">Block</NativeSelectOption>
                </NativeSelect>
              </div>
            )}
          </formulaForm.Field>
          <Button className="self-end" size="sm" type="submit">
            Insert formula
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
