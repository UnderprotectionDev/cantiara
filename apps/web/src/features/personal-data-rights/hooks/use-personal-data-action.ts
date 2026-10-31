import { useState } from "react";
import {
  type PersonalDataAction,
  personalDataRefusalMessage,
} from "../lib/personal-data-refusal";

/**
 * The pending flag and visible refusal shared by the export and erase flows.
 * `run` clears the refusal, tracks pending and turns a failure into the
 * refusal text instead of throwing; `onSettled` runs after either outcome.
 */
export function usePersonalDataAction(action: PersonalDataAction) {
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  async function run(work: () => Promise<void>, onSettled?: () => void) {
    setPending(true);
    setRefusal(null);
    try {
      await work();
    } catch (error) {
      setRefusal(personalDataRefusalMessage(error, action));
    } finally {
      onSettled?.();
      setPending(false);
    }
  }

  return { pending, refusal, run, setRefusal };
}
