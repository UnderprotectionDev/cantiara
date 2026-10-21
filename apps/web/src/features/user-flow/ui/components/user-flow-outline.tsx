// biome-ignore-all lint/performance/noJsxPropsBind: Row handlers close over the node they act on.
import {
  type ScreenOption,
  type ScreenReferenceView,
  USER_FLOW_NODE_KINDS,
  type UserFlowNodeKind,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { type FormEvent, useState } from "react";

import {
  addNode,
  assignSelectionToSection,
  connectNodes,
  disconnectLink,
  type EditorNode,
  type EditorState,
  groupSelection,
  moveInOutline,
  select,
} from "../../lib/flow-editor";
import { buildOutline, type OutlineRow } from "../../lib/flow-outline";
import { ScreenReference } from "../views/user-flow-view";

interface OutlineProps {
  collapsed: readonly string[];
  createId: () => string;
  onChange: (change: (state: EditorState) => EditorState) => void;
  onToggleCollapse: (sectionId: string) => void;
  screenOptions: ScreenOption[];
  screens: ReadonlyMap<string, ScreenReferenceView>;
  state: EditorState;
}

function describe(node: EditorNode) {
  return `${node.kind}${node.text ? `: ${node.text.slice(0, 60)}` : ""}`;
}

function CreateNodeForm({
  createId,
  onChange,
  screenOptions,
}: Pick<OutlineProps, "createId" | "onChange" | "screenOptions">) {
  const [kind, setKind] = useState<UserFlowNodeKind>("Action");
  const [screenId, setScreenId] = useState("");
  const [text, setText] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (kind === "Screen" && !screenId) {
      return;
    }
    onChange((state) =>
      addNode(state, { id: createId(), kind, screenId, text }),
    );
    setText("");
  }

  return (
    <form
      aria-label="Add a node to the outline"
      className="flex flex-wrap items-end gap-2"
      onSubmit={submit}
    >
      <div className="space-y-1">
        <Label htmlFor="user-flow-outline-kind">Outline node type</Label>
        <NativeSelect
          id="user-flow-outline-kind"
          onChange={(event) => setKind(event.target.value as UserFlowNodeKind)}
          value={kind}
        >
          {USER_FLOW_NODE_KINDS.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {option}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {kind === "Screen" ? (
        <div className="space-y-1">
          <Label htmlFor="user-flow-outline-screen">Outline Screen</Label>
          <NativeSelect
            id="user-flow-outline-screen"
            onChange={(event) => setScreenId(event.target.value)}
            value={screenId}
          >
            <NativeSelectOption value="">Select a Screen</NativeSelectOption>
            {screenOptions.map((option) => (
              <NativeSelectOption key={option.id} value={option.id}>
                {option.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="user-flow-outline-text">Outline node text</Label>
        <input
          className="h-8 rounded-md border bg-background px-2 text-sm"
          id="user-flow-outline-text"
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
      </div>
      <Button size="sm" type="submit">
        Add to outline
      </Button>
    </form>
  );
}

function Inspector({ node, state }: { node: EditorNode; state: EditorState }) {
  const names = new Map(
    state.document.nodes.map((item) => [item.id, describe(item)]),
  );
  const outgoing = state.document.links.filter(({ from }) => from === node.id);
  const incoming = state.document.links.filter(({ to }) => to === node.id);
  return (
    <dl
      aria-label={`Details of ${describe(node)}`}
      className="grid grid-cols-[auto_1fr] gap-x-3 text-xs"
    >
      <dt>Type</dt>
      <dd>{node.kind}</dd>
      <dt>Text</dt>
      <dd>{node.text || "No text"}</dd>
      <dt>Style</dt>
      <dd>{node.style}</dd>
      <dt>Section</dt>
      <dd>
        {node.sectionId
          ? (names.get(node.sectionId) ?? node.sectionId)
          : "Ungrouped"}
      </dd>
      <dt>Leads to</dt>
      <dd>
        {outgoing.length === 0
          ? "Nothing"
          : outgoing.map(({ to }) => names.get(to) ?? to).join(", ")}
      </dd>
      <dt>Comes from</dt>
      <dd>
        {incoming.length === 0
          ? "Nothing"
          : incoming.map(({ from }) => names.get(from) ?? from).join(", ")}
      </dd>
    </dl>
  );
}

function BindControls({
  createId,
  node,
  onChange,
  state,
}: Pick<OutlineProps, "createId" | "onChange" | "state"> & {
  node: EditorNode;
}) {
  const [target, setTarget] = useState("");
  const candidates = state.document.nodes.filter(({ id }) => id !== node.id);
  const outgoing = state.document.links.filter(({ from }) => from === node.id);
  const names = new Map(
    state.document.nodes.map((item) => [item.id, describe(item)]),
  );
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={`Bind ${describe(node)} to`}
          onChange={(event) => setTarget(event.target.value)}
          value={target}
        >
          <NativeSelectOption value="">Bind to…</NativeSelectOption>
          {candidates.map((candidate) => (
            <NativeSelectOption key={candidate.id} value={candidate.id}>
              {describe(candidate)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          aria-label={`Bind ${describe(node)}`}
          disabled={target === ""}
          onClick={() => {
            onChange((current) =>
              connectNodes(current, {
                from: node.id,
                id: createId(),
                to: target,
              }),
            );
            setTarget("");
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          Bind
        </Button>
      </div>
      {outgoing.length > 0 ? (
        <ul aria-label={`Links from ${describe(node)}`} className="text-xs">
          {outgoing.map((link) => (
            <li className="flex items-center gap-2" key={link.id}>
              <span>
                {describe(node)} → {names.get(link.to) ?? link.to}
              </span>
              <Button
                aria-label={`Unbind ${describe(node)} from ${names.get(link.to) ?? link.to}`}
                onClick={() =>
                  onChange((current) => disconnectLink(current, link.id))
                }
                size="sm"
                type="button"
                variant="outline"
              >
                Unbind
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function OutlineItem({
  canMoveDown,
  canMoveUp,
  inspected,
  onInspect,
  props,
  row,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  inspected: boolean;
  onInspect: () => void;
  props: OutlineProps;
  row: OutlineRow;
}) {
  const { node } = row;
  const { onChange, state } = props;
  const label = describe(node);
  const selected = state.selection.includes(node.id);
  const sections = state.document.nodes.filter(
    ({ kind }) => kind === "Section",
  );
  const reference =
    node.screenId === null ? null : (props.screens.get(node.screenId) ?? null);
  return (
    <li
      className="space-y-2 rounded-md border p-2 text-sm"
      style={{ marginLeft: row.depth * 24 }}
    >
      {row.depth === 1 ? (
        <p className="sr-only">Member of the Section above</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-label={`Select ${label}`}
          aria-pressed={selected}
          onClick={() =>
            onChange((current) => select(current, [node.id], "toggle"))
          }
          size="sm"
          type="button"
          variant={selected ? "secondary" : "outline"}
        >
          {selected ? "Selected" : "Select"}
        </Button>
        <span className="font-medium">{label}</span>
        <Button
          aria-label={`Move ${label} up`}
          disabled={!canMoveUp}
          onClick={() =>
            onChange((current) => moveInOutline(current, node.id, "up"))
          }
          size="sm"
          type="button"
          variant="outline"
        >
          Move up
        </Button>
        <Button
          aria-label={`Move ${label} down`}
          disabled={!canMoveDown}
          onClick={() =>
            onChange((current) => moveInOutline(current, node.id, "down"))
          }
          size="sm"
          type="button"
          variant="outline"
        >
          Move down
        </Button>
        {node.kind === "Section" ? (
          <Button
            aria-expanded={!row.isCollapsed}
            aria-label={`${row.isCollapsed ? "Expand" : "Collapse"} ${label}`}
            onClick={() => props.onToggleCollapse(node.id)}
            size="sm"
            type="button"
            variant="outline"
          >
            {row.isCollapsed
              ? `Expand (${row.collapsedMembers} hidden)`
              : "Collapse"}
          </Button>
        ) : null}
        <Button
          aria-controls={`user-flow-inspect-${node.id}`}
          aria-expanded={inspected}
          aria-label={`Inspect ${label}`}
          onClick={onInspect}
          size="sm"
          type="button"
          variant="outline"
        >
          Inspect
        </Button>
      </div>
      {reference ? <ScreenReference reference={reference} /> : null}
      <div id={`user-flow-inspect-${node.id}`}>
        {inspected ? (
          <div className="space-y-2">
            <Inspector node={node} state={state} />
            {node.kind === "Section" ? null : (
              <NativeSelect
                aria-label={`Section of ${label}`}
                onChange={(event) => {
                  const value = event.target.value || null;
                  onChange((current) =>
                    assignSelectionToSection(
                      select(current, [node.id], "replace"),
                      value,
                    ),
                  );
                }}
                value={node.sectionId ?? ""}
              >
                <NativeSelectOption value="">Ungrouped</NativeSelectOption>
                {sections.map((section) => (
                  <NativeSelectOption key={section.id} value={section.id}>
                    {describe(section)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
            <BindControls
              createId={props.createId}
              node={node}
              onChange={onChange}
              state={state}
            />
          </div>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Pointer-free structured outline over the same editor state as the canvas.
 * It creates, selects, reorders, groups, binds, unbinds, inspects and opens
 * the source record, so a founder who only uses a keyboard or a screen reader
 * completes every canvas task here (PRD 15). It is not a read-only fallback.
 */
export function UserFlowOutline(props: OutlineProps) {
  const { collapsed, createId, onChange, screenOptions, state } = props;
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const rows = buildOutline(state.document, collapsed);
  const groupable = state.document.nodes.some(
    ({ id, kind }) => kind !== "Section" && state.selection.includes(id),
  );
  return (
    <section aria-label="Outline" className="space-y-3 rounded-lg border p-3">
      <h4 className="font-medium text-sm">Outline</h4>
      <div className="flex flex-wrap items-center gap-2">
        <CreateNodeForm
          createId={createId}
          onChange={onChange}
          screenOptions={screenOptions}
        />
        <Button
          disabled={!groupable}
          onClick={() =>
            onChange((current) => groupSelection(current, createId()))
          }
          size="sm"
          type="button"
          variant="outline"
        >
          Group selection into Section
        </Button>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          The outline is empty. Add a node to start the path.
        </p>
      ) : (
        <ul aria-label="Outline nodes" className="space-y-2">
          {rows.map((row) => {
            const siblings = state.document.nodes.filter(
              ({ sectionId }) =>
                (sectionId ?? null) === (row.node.sectionId ?? null),
            );
            const position = siblings.findIndex(({ id }) => id === row.node.id);
            return (
              <OutlineItem
                canMoveDown={position < siblings.length - 1}
                canMoveUp={position > 0}
                inspected={inspectedId === row.node.id}
                key={row.node.id}
                onInspect={() =>
                  setInspectedId(
                    inspectedId === row.node.id ? null : row.node.id,
                  )
                }
                props={props}
                row={row}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
