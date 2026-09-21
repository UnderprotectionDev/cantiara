import {
  renderWorkContextMarkdown,
  type WorkContextModel,
} from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";

import {
  COMMAND_PALETTE_COMMAND_SHORTCUT,
  type CommandPaletteCommand,
} from "@/features/command-palette/lib/command-palette-commands";

export const COPY_CONTEXT_AS_MARKDOWN_COMMAND_ID =
  "copy-context-as-markdown" as const;
export const COPY_CONTEXT_AS_MARKDOWN_LABEL =
  "Copy Context as Markdown" as const;

export type ClipboardWriter = (markdown: string) => Promise<void>;

export interface CopyWorkContextAsMarkdownInput {
  model: WorkContextModel;
  now?: () => string;
  statusLabel?: string;
  work: WorkProfile;
  writeText?: ClipboardWriter;
}

export async function copyWorkContextAsMarkdown({
  model,
  now = () => new Date().toISOString(),
  statusLabel,
  work,
  writeText = writeToClipboard,
}: CopyWorkContextAsMarkdownInput) {
  const markdown = renderWorkContextMarkdown({
    model,
    producedAt: now(),
    statusLabel,
    work,
  });
  await writeText(markdown);
  return markdown;
}

export function createCopyContextAsMarkdownCommand(
  input: CopyWorkContextAsMarkdownInput,
): CommandPaletteCommand {
  const { work } = input;
  return {
    id: COPY_CONTEXT_AS_MARKDOWN_COMMAND_ID,
    keywords: ["copy", "context", "markdown", work.key, work.title],
    kind: "common",
    label: COPY_CONTEXT_AS_MARKDOWN_LABEL,
    run: () => copyWorkContextAsMarkdown(input).then(() => undefined),
    scope: `Work: ${work.key}`,
    selectionCount: 1,
    shortcut: COMMAND_PALETTE_COMMAND_SHORTCUT,
    target: `${work.key} ${work.title}`,
    visibleCounterpart: "Work Context Card",
  };
}

function writeToClipboard(markdown: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return Promise.reject(new Error("Clipboard is unavailable."));
  }
  return navigator.clipboard.writeText(markdown);
}
