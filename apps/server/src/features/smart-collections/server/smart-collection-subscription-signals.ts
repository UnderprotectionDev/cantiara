import type { SmartCollectionSourceType } from "@cantiara/api/smart-collections";

export const SMART_COLLECTION_ENTRY_SIGNAL_TYPE =
  "smart-collection-entry" as const;
export const SMART_COLLECTION_SIGNAL_PRESENTATION = "Information Flow" as const;

export type SmartCollectionSubscriptionEventType = "entry" | "leave";

export interface SmartCollectionSubscriptionMember {
  membershipReasons: string[];
  sourcePath: string;
  sourceProjectId: string | null;
  sourceRecordId: string;
  sourceRecordTitle: string;
  sourceRecordType: SmartCollectionSourceType;
}

export interface SmartCollectionSubscriptionMembershipState
  extends SmartCollectionSubscriptionMember {
  enteredAt: Date;
  isMember: boolean;
  leftAt: Date | null;
  membershipPeriod: number;
}

export interface SmartCollectionSubscriptionContext {
  accountId: string;
  collectionId: string;
  collectionName: string;
  id: string;
}

export interface SmartCollectionAttentionSignal {
  collectionId: string;
  eventType: SmartCollectionSubscriptionEventType;
  membershipPeriod: number;
  occurredAt: Date;
  ownerAccountId: string;
  presentation: typeof SMART_COLLECTION_SIGNAL_PRESENTATION;
  reason: string;
  signalId: string;
  signalType: typeof SMART_COLLECTION_ENTRY_SIGNAL_TYPE;
  sourcePath: string;
  sourceProjectId: string | null;
  sourceRecordId: string;
  sourceRecordName: string;
  sourceRecordType: SmartCollectionSourceType;
  subscriptionId: string;
}

export function startSmartCollectionSubscriptionMembership(
  member: SmartCollectionSubscriptionMember,
  now: Date,
): SmartCollectionSubscriptionMembershipState {
  return {
    ...member,
    membershipReasons: [...member.membershipReasons],
    enteredAt: now,
    isMember: true,
    leftAt: null,
    membershipPeriod: 1,
  };
}

export function transitionSmartCollectionSubscriptionMembership({
  current,
  now,
  notifyOnLeave,
  previous,
  subscription,
}: {
  current: SmartCollectionSubscriptionMember | null;
  now: Date;
  notifyOnLeave: boolean;
  previous: SmartCollectionSubscriptionMembershipState | null;
  subscription: SmartCollectionSubscriptionContext;
}): {
  changed: boolean;
  nextState: SmartCollectionSubscriptionMembershipState | null;
  signal: SmartCollectionAttentionSignal | null;
} {
  if (!current) {
    if (!previous?.isMember) {
      return { changed: false, nextState: previous, signal: null };
    }

    return {
      changed: true,
      nextState: { ...previous, isMember: false, leftAt: now },
      signal: notifyOnLeave
        ? createSignal({
            eventType: "leave",
            membershipPeriod: previous.membershipPeriod,
            member: previous,
            now,
            subscription,
          })
        : null,
    };
  }

  if (previous?.isMember) {
    const nextState = {
      ...previous,
      ...current,
      isMember: true,
      leftAt: null,
    };
    return {
      changed: !sameMemberSnapshot(previous, nextState),
      nextState,
      signal: null,
    };
  }

  const membershipPeriod = (previous?.membershipPeriod ?? 0) + 1;
  const nextState: SmartCollectionSubscriptionMembershipState = {
    ...current,
    enteredAt: now,
    isMember: true,
    leftAt: null,
    membershipPeriod,
  };

  return {
    changed: true,
    nextState,
    signal: createSignal({
      eventType: "entry",
      membershipPeriod,
      member: current,
      now,
      subscription,
    }),
  };
}

function sameMemberSnapshot(
  left: SmartCollectionSubscriptionMembershipState,
  right: SmartCollectionSubscriptionMembershipState,
) {
  return (
    left.sourceRecordType === right.sourceRecordType &&
    left.sourceRecordId === right.sourceRecordId &&
    left.sourceProjectId === right.sourceProjectId &&
    left.sourceRecordTitle === right.sourceRecordTitle &&
    left.sourcePath === right.sourcePath &&
    left.isMember === right.isMember &&
    left.membershipPeriod === right.membershipPeriod &&
    left.enteredAt.getTime() === right.enteredAt.getTime() &&
    left.leftAt === right.leftAt &&
    JSON.stringify(left.membershipReasons) ===
      JSON.stringify(right.membershipReasons)
  );
}

function createSignal({
  eventType,
  membershipPeriod,
  member,
  now,
  subscription,
}: {
  eventType: SmartCollectionSubscriptionEventType;
  membershipPeriod: number;
  member: SmartCollectionSubscriptionMember;
  now: Date;
  subscription: SmartCollectionSubscriptionContext;
}): SmartCollectionAttentionSignal {
  const reason =
    eventType === "entry"
      ? `Entered "${subscription.collectionName}" because ${member.membershipReasons.join(", ") || "it matched the collection conditions"}.`
      : `Left "${subscription.collectionName}" after no longer matching ${member.membershipReasons.join(", ") || "the collection conditions"}.`;

  return {
    collectionId: subscription.collectionId,
    eventType,
    membershipPeriod,
    occurredAt: now,
    ownerAccountId: subscription.accountId,
    presentation: SMART_COLLECTION_SIGNAL_PRESENTATION,
    reason,
    signalId: [
      SMART_COLLECTION_ENTRY_SIGNAL_TYPE,
      encodeURIComponent(subscription.id),
      encodeURIComponent(member.sourceRecordType),
      encodeURIComponent(member.sourceRecordId),
      `period-${membershipPeriod}`,
      eventType,
    ].join(":"),
    signalType: SMART_COLLECTION_ENTRY_SIGNAL_TYPE,
    sourcePath: member.sourcePath,
    sourceProjectId: member.sourceProjectId,
    sourceRecordId: member.sourceRecordId,
    sourceRecordName: member.sourceRecordTitle,
    sourceRecordType: member.sourceRecordType,
    subscriptionId: subscription.id,
  };
}
