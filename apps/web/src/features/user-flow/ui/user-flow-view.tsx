// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over the selected User Flow and their own draft fields.
import {
  type CardRecordOption,
  type ScreenOption,
  type ScreenReferenceView,
  USER_FLOW_NODE_KINDS,
  type UserFlowBindView,
  type UserFlowCardKind,
  type UserFlowConvertPlan,
  type UserFlowConvertTarget,
  type UserFlowNodeKind,
  type UserFlowNodeView,
  type UserFlowRebindPlan,
  type UserFlowView as UserFlowRecordView,
  type UserFlowSummary,
  type UserFlowTemplateView,
  type UserFlowWorkType,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, type ReactNode, useCallback, useState } from "react";
import {
  ConvertAndBindDialog,
  type ConvertAndBindIdentity,
} from "./convert-and-bind-dialog";
import { RebindDialog } from "./rebind-dialog";
import {
  CreateFromTemplateForm,
  type PromoteChoice,
  PromoteToScreenForm,
  SaveTemplateForm,
} from "./user-flow-promote-templates";
import { BindList, LiveCardList, PlaceCardForm } from "./user-flow-records";

/** Spec 49 #373 actions of the outline; the surface owns every durable read and write. */
export interface UserFlowDetailTools {
  binds: UserFlowBindView[];
  cardRecords: CardRecordOption[];
  onConvertConfirm: (
    nodeId: string,
    plan: UserFlowConvertPlan,
    identity: ConvertAndBindIdentity,
  ) => Promise<unknown>;
  onConvertPreview: (
    nodeId: string,
    target: UserFlowConvertTarget,
    workType: UserFlowWorkType,
  ) => Promise<UserFlowConvertPlan>;
  onPlaceCard: (kind: UserFlowCardKind, recordId: string) => Promise<unknown>;
  onPreviewRebind: (bindId: string) => Promise<UserFlowRebindPlan>;
  onPromote: (nodeId: string, choice: PromoteChoice) => Promise<unknown>;
  onRebind: (bindId: string, plan: UserFlowRebindPlan) => Promise<unknown>;
  onRemoveCard: (cardId: string) => Promise<unknown>;
  onSaveTemplate: (name: string, nodeIds: string[]) => Promise<unknown>;
}

export interface PlaceNodeDraft {
  kind: UserFlowNodeKind;
  screenId: string | null;
  text: string;
}

/**
 * Common broken-reference presentation of a node's live Screen reference. A
 * broken target shows its reason and when the link was established, never a
 * title or body; `Archived` keeps the title and still opens the source.
 */
export function ScreenReference({
  reference,
}: {
  reference: ScreenReferenceView;
}) {
  const { broken } = reference;
  return (
    <div
      className="space-y-1 text-sm"
      data-screen-reference={reference.screenId}
    >
      {broken ? (
        <p>
          {broken.reason === "Archived" ? (
            <span className="font-medium">Archived</span>
          ) : (
            <span className="font-medium">Broken — {broken.reason}</span>
          )}
          {reference.title ? <span> · {reference.title}</span> : null}
        </p>
      ) : (
        <p className="font-medium">{reference.title}</p>
      )}
      {broken ? (
        <p className="text-muted-foreground text-xs">
          Linked{" "}
          <time dateTime={broken.establishedAt}>{broken.establishedAt}</time>
        </p>
      ) : null}
      {reference.openPath && (broken === null || broken.canOpenSourceRecord) ? (
        <a className="text-primary underline" href={reference.openPath}>
          Open Source Record
        </a>
      ) : null}
    </div>
  );
}

function NodeOutlineItem({
  actions,
  node,
}: {
  actions?: ReactNode;
  node: UserFlowNodeView;
}) {
  return (
    <li className="space-y-1 rounded-md border p-3">
      <p className="font-medium text-sm">
        {node.kind}
        {node.style === "default" ? "" : ` · ${node.style}`}
      </p>
      {node.text ? (
        <p className="whitespace-pre-wrap text-sm">{node.text}</p>
      ) : null}
      {node.screen ? <ScreenReference reference={node.screen} /> : null}
      {actions}
    </li>
  );
}

function PlaceNodeForm({
  disabled,
  onPlaceNode,
  screens,
}: {
  disabled: boolean;
  onPlaceNode: (draft: PlaceNodeDraft) => Promise<unknown>;
  screens: ScreenOption[];
}) {
  const [kind, setKind] = useState<UserFlowNodeKind>("Action");
  const [screenId, setScreenId] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const needsScreen = kind === "Screen";

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (needsScreen && !screenId) {
      setError("Choose a Screen for a Screen node.");
      return;
    }
    try {
      await onPlaceNode({
        kind,
        screenId: needsScreen ? screenId : null,
        text,
      });
      setText("");
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Node could not be placed.",
      );
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="space-y-1">
        <Label htmlFor="user-flow-node-kind">Node type</Label>
        <NativeSelect
          id="user-flow-node-kind"
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
      {needsScreen ? (
        <div className="space-y-1">
          <Label htmlFor="user-flow-node-screen">Screen</Label>
          <NativeSelect
            id="user-flow-node-screen"
            onChange={(event) => setScreenId(event.target.value)}
            value={screenId}
          >
            <NativeSelectOption value="">Select a Screen</NativeSelectOption>
            {screens.map((screen) => (
              <NativeSelectOption key={screen.id} value={screen.id}>
                {screen.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      ) : null}
      <div className="space-y-1">
        <Label htmlFor="user-flow-node-text">Node text</Label>
        <Textarea
          id="user-flow-node-text"
          onChange={(event) => setText(event.target.value)}
          value={text}
        />
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <Button disabled={disabled} type="submit">
        Place node
      </Button>
    </form>
  );
}

/** Presentation of one User Flow; durable reads and writes belong to the surface. */
export function UserFlowDetail({
  flow,
  onPlaceNode,
  readOnly,
  screens,
  tools,
}: {
  flow: UserFlowRecordView;
  onPlaceNode: (draft: PlaceNodeDraft) => Promise<unknown>;
  readOnly: boolean;
  screens: ScreenOption[];
  tools?: UserFlowDetailTools;
}) {
  const [converting, setConverting] = useState<UserFlowNodeView | null>(null);
  const [rebinding, setRebinding] = useState<UserFlowBindView | null>(null);
  const rebindingId = rebinding?.id;
  const previewRebind = useCallback(
    () =>
      tools && rebindingId
        ? tools.onPreviewRebind(rebindingId)
        : Promise.reject(new Error("No bind")),
    [rebindingId, tools],
  );

  return (
    <section aria-label={`User Flow ${flow.title}`} className="space-y-4">
      <h3 className="font-medium text-lg">{flow.title}</h3>
      {flow.nodes.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          This User Flow has no nodes yet.
        </p>
      ) : (
        <ol aria-label="Outline" className="space-y-2">
          {flow.nodes.map((node) => (
            <NodeOutlineItem
              actions={
                tools ? (
                  <div className="space-y-2 pt-1">
                    <Button
                      disabled={readOnly}
                      onClick={() => setConverting(node)}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Convert and Bind
                    </Button>
                    {node.screen ? null : (
                      <PromoteToScreenForm
                        disabled={readOnly}
                        node={node}
                        onPromote={tools.onPromote}
                        screens={screens}
                      />
                    )}
                  </div>
                ) : null
              }
              key={node.id}
              node={node}
            />
          ))}
        </ol>
      )}
      {tools ? (
        <>
          <BindList
            binds={tools.binds}
            onRebind={setRebinding}
            readOnly={readOnly}
          />
          <LiveCardList
            cards={flow.cards}
            onRemove={tools.onRemoveCard}
            readOnly={readOnly}
          />
          <PlaceCardForm
            disabled={readOnly}
            onPlace={tools.onPlaceCard}
            options={tools.cardRecords}
          />
          {flow.nodes.length > 0 ? (
            <SaveTemplateForm
              disabled={readOnly}
              nodes={flow.nodes}
              onSave={tools.onSaveTemplate}
            />
          ) : null}
        </>
      ) : null}
      <PlaceNodeForm
        disabled={readOnly}
        onPlaceNode={onPlaceNode}
        screens={screens}
      />
      {tools && converting ? (
        <ConvertAndBindDialog
          node={converting}
          onClose={() => setConverting(null)}
          onConfirm={(plan, identity) =>
            tools.onConvertConfirm(converting.id, plan, identity)
          }
          onPreview={(target, workType) =>
            tools.onConvertPreview(converting.id, target, workType)
          }
        />
      ) : null}
      {tools && rebinding ? (
        <RebindDialog
          bind={rebinding}
          onClose={() => setRebinding(null)}
          onConfirm={(plan) => tools.onRebind(rebinding.id, plan)}
          onPreview={previewRebind}
        />
      ) : null}
    </section>
  );
}

export function UserFlowListView({
  flows,
  onCreate,
  onCreateFromTemplate,
  onSelect,
  readOnly,
  selected,
  selectedId,
  templates = [],
}: {
  flows: UserFlowSummary[];
  onCreate: (title: string) => Promise<unknown>;
  onCreateFromTemplate?: (
    templateId: string,
    title: string,
  ) => Promise<unknown>;
  onSelect: (id: string) => void;
  readOnly: boolean;
  selected: ReactNode;
  selectedId: string | null;
  templates?: UserFlowTemplateView[];
}) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await onCreate(title);
      setTitle("");
      setError(null);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "User Flow could not be created.",
      );
    }
  }

  return (
    <section aria-label="User Flow" className="space-y-4">
      <h2 className="font-medium text-xl">User Flow</h2>
      {flows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No User Flows yet.</p>
      ) : (
        <ul className="space-y-1">
          {flows.map((flow) => (
            <li key={flow.id}>
              <Button
                aria-pressed={flow.id === selectedId}
                onClick={() => onSelect(flow.id)}
                type="button"
                variant={flow.id === selectedId ? "secondary" : "outline"}
              >
                {flow.title}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <form className="space-y-2" onSubmit={submit}>
        <Label htmlFor="user-flow-title">Title</Label>
        <Input
          id="user-flow-title"
          onChange={(event) => setTitle(event.target.value)}
          value={title}
        />
        {error ? <p role="alert">{error}</p> : null}
        <Button disabled={readOnly || title.trim() === ""} type="submit">
          Create User Flow
        </Button>
      </form>
      {onCreateFromTemplate ? (
        <CreateFromTemplateForm
          onCreate={onCreateFromTemplate}
          readOnly={readOnly}
          templates={templates}
        />
      ) : null}
      {selected}
    </section>
  );
}
