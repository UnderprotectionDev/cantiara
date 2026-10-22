// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over the selected User Flow and their own draft fields.

import type {
  CardRecordOption,
  ScreenOption,
  ScreenReferenceView,
  UserFlowBindView,
  UserFlowCardKind,
  UserFlowConvertPlan,
  UserFlowConvertTarget,
  UserFlowNodeView,
  UserFlowRebindPlan,
  UserFlowView as UserFlowRecordView,
  UserFlowSummary,
  UserFlowTemplateView,
  UserFlowWorkType,
} from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { type ReactNode, useCallback, useState } from "react";
import { AppLink } from "@/components/app-link";
import type { PlaceNodeDraft } from "../../lib/place-node-draft";
import {
  ConvertAndBindDialog,
  type ConvertAndBindIdentity,
} from "../components/convert-and-bind-dialog";
import { RebindDialog } from "../components/rebind-dialog";
import { BindList, LiveCardList } from "../components/user-flow-records";
import { CreateFromTemplateForm } from "../forms/create-from-template-form";
import { CreateUserFlowForm } from "../forms/create-user-flow-form";
import { PlaceCardForm } from "../forms/place-card-form";
import { PlaceNodeForm } from "../forms/place-node-form";
import {
  type PromoteChoice,
  PromoteToScreenForm,
} from "../forms/promote-to-screen-form";
import { SaveTemplateForm } from "../forms/save-template-form";

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

export type { PlaceNodeDraft } from "../../lib/place-node-draft";

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
        <AppLink className="text-primary underline" href={reference.openPath}>
          Open Source Record
        </AppLink>
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
        <ol aria-label="Saved version nodes" className="space-y-2">
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
      <CreateUserFlowForm onCreate={onCreate} readOnly={readOnly} />
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
