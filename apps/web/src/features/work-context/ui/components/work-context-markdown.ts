import {
  renderWorkContextMarkdown,
  type WorkContextModel,
  type WorkContextSource,
} from "@cantiara/api/work-context";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";

import {
  COMMAND_PALETTE_COMMAND_SHORTCUT,
  type CommandPaletteCommand,
} from "@/features/command-palette/lib/command-palette-commands";
import type { ClipboardWriter } from "@/lib/clipboard";
import { writeTextToClipboard } from "@/lib/clipboard";

export type { ClipboardWriter } from "@/lib/clipboard";

export const COPY_CONTEXT_AS_MARKDOWN_COMMAND_ID =
  "copy-context-as-markdown" as const;
export const COPY_CONTEXT_AS_MARKDOWN_LABEL =
  "Copy Context as Markdown" as const;

export function copyContextAsMarkdownCommandId(workId: string) {
  return `${COPY_CONTEXT_AS_MARKDOWN_COMMAND_ID}-${workId}`;
}

export interface CopyWorkContextAsMarkdownInput {
  model: WorkContextModel;
  now?: () => string;
  sourceLink?: (source: WorkContextSource) => string | null;
  statusLabel?: string;
  work: WorkProfile;
  writeText?: ClipboardWriter;
}

export async function copyWorkContextAsMarkdown({
  model,
  now = () => new Date().toISOString(),
  statusLabel,
  work,
  writeText = writeTextToClipboard,
  sourceLink,
}: CopyWorkContextAsMarkdownInput) {
  const markdown = renderWorkContextMarkdown({
    model,
    producedAt: now(),
    statusLabel,
    sourceLink,
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
    id: copyContextAsMarkdownCommandId(work.id),
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
