import type { UserFlowNodeKind } from "@cantiara/api/user-flow";

/** What `Place node` sends: the node type, its live Screen id (Screen nodes only) and text. */
export interface PlaceNodeDraft {
  kind: UserFlowNodeKind;
  screenId: string | null;
  text: string;
}
