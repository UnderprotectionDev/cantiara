import { useForm } from "@tanstack/react-form";
import { useEffect, useRef } from "react";

import {
  EMPTY_RUNTIME_INPUT_DRAFT,
  recordActionRuntimeInputsFormSchema,
} from "../lib/record-action-runtime-inputs";
import type { RecordActionRunnerState } from "./use-record-action-runner";

/**
 * The `Record Action inputs` form. It lives with the run dialog so the draft
 * survives `Change inputs`, and it clears when a new run starts.
 */
export function useRecordActionRuntimeInputForm(
  runner: RecordActionRunnerState,
) {
  const form = useForm({
    defaultValues: EMPTY_RUNTIME_INPUT_DRAFT,
    onSubmit: ({ value }) => {
      if (!runner.active) {
        return;
      }
      const parsed = recordActionRuntimeInputsFormSchema(
        runner.active.action,
      ).safeParse(value);
      if (parsed.success) {
        runner.previewWithInputs(parsed.data);
      }
    },
  });
  const runVersionRef = useRef(runner.runVersion);
  useEffect(() => {
    if (runVersionRef.current === runner.runVersion) {
      return;
    }
    runVersionRef.current = runner.runVersion;
    form.reset();
  }, [form, runner.runVersion]);
  return form;
}
