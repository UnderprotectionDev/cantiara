import {
	type CollectionRecord,
	conditionMatches,
	fieldLabel,
	type MembershipCondition,
	type MembershipMember,
} from "./smart-collections-model";

export const SMART_COLLECTION_ENTRY_SIGNAL_ID =
	"smart-collection-entry" as const;

export const SMART_COLLECTION_ENTRY_SIGNAL_SECTION =
	"Information flow" as const;

export type SubscriptionPhase = "enter" | "leave";

export interface MembershipPeriod {
	open: boolean;
	recordId: string;
	recordKind: string;
}

export interface SmartCollectionEntrySignal {
	parenting: false;
	phase: SubscriptionPhase;
	reason: string;
	section: typeof SMART_COLLECTION_ENTRY_SIGNAL_SECTION;
	signalId: typeof SMART_COLLECTION_ENTRY_SIGNAL_ID;
	source: { id: string; kind: string };
	sourceFieldWrites: false;
}

export interface SubscriptionSignalSink {
	emit: (signal: SmartCollectionEntrySignal) => void;
}

export class MemorySignalSink implements SubscriptionSignalSink {
	readonly emissions: SmartCollectionEntrySignal[] = [];

	emit(signal: SmartCollectionEntrySignal): void {
		this.emissions.push(signal);
	}
}

export function asRegisteredCollectionSignal(kind: string):
	| {
			section: typeof SMART_COLLECTION_ENTRY_SIGNAL_SECTION;
			signalId: typeof SMART_COLLECTION_ENTRY_SIGNAL_ID;
			status: "ok";
	  }
	| { reason: "unregistered-kind"; status: "refused" } {
	if (kind !== SMART_COLLECTION_ENTRY_SIGNAL_ID) {
		return { reason: "unregistered-kind", status: "refused" };
	}
	return {
		section: SMART_COLLECTION_ENTRY_SIGNAL_SECTION,
		signalId: SMART_COLLECTION_ENTRY_SIGNAL_ID,
		status: "ok",
	};
}

function enterReason(member: MembershipMember): string {
	return member.because.map((reason) => reason.label).join(" and ");
}

function leaveReason(
	record: CollectionRecord | undefined,
	conditions: readonly MembershipCondition[]
): string {
	if (!record) {
		return "The record is no longer in this Smart Collection.";
	}
	const failed = conditions.filter(
		(condition) => !conditionMatches(record, condition)
	);
	if (failed.length === 0) {
		return "The record is no longer in this Smart Collection.";
	}
	return failed
		.map(
			(condition) =>
				`${fieldLabel(condition.field)} is no longer ${condition.value}`
		)
		.join(" and ");
}

function entrySignal(
	member: MembershipMember
): SmartCollectionEntrySignal | null {
	const registered = asRegisteredCollectionSignal(
		SMART_COLLECTION_ENTRY_SIGNAL_ID
	);
	if (registered.status !== "ok") {
		return null;
	}
	return {
		parenting: false,
		phase: "enter",
		reason: enterReason(member),
		section: registered.section,
		signalId: registered.signalId,
		source: { id: member.id, kind: member.kind },
		sourceFieldWrites: false,
	};
}

function leaveSignal(
	recordId: string,
	recordKind: string,
	record: CollectionRecord | undefined,
	conditions: readonly MembershipCondition[]
): SmartCollectionEntrySignal | null {
	const registered = asRegisteredCollectionSignal(
		SMART_COLLECTION_ENTRY_SIGNAL_ID
	);
	if (registered.status !== "ok") {
		return null;
	}
	return {
		parenting: false,
		phase: "leave",
		reason: leaveReason(record, conditions),
		section: registered.section,
		signalId: registered.signalId,
		source: { id: recordId, kind: recordKind },
		sourceFieldWrites: false,
	};
}

export function seedOpenMembershipPeriods(
	members: readonly MembershipMember[],
	periods: readonly MembershipPeriod[]
): MembershipPeriod[] {
	const next = periods.map((period) => ({ ...period }));
	for (const member of members) {
		const open = next.some(
			(period) => period.recordId === member.id && period.open
		);
		if (open) {
			continue;
		}
		next.push({
			open: true,
			recordId: member.id,
			recordKind: member.kind,
		});
	}
	return next;
}

export function produceSubscriptionSignals(input: {
	catalog: readonly CollectionRecord[];
	conditions: readonly MembershipCondition[];
	members: readonly MembershipMember[];
	periods: readonly MembershipPeriod[];
	sink: SubscriptionSignalSink;
	subscription: { onEntry: boolean; onExit: boolean };
}): { periods: MembershipPeriod[]; status: "ok" } {
	if (!(input.subscription.onEntry || input.subscription.onExit)) {
		return {
			periods: input.periods.map((period) => ({ ...period })),
			status: "ok",
		};
	}
	const catalogById = new Map(
		input.catalog.map((record) => [record.id, record])
	);
	const memberIds = new Set(input.members.map((member) => member.id));
	const next = input.periods.map((period) => ({ ...period }));

	if (input.subscription.onEntry) {
		for (const member of input.members) {
			const open = next.some(
				(period) => period.recordId === member.id && period.open
			);
			if (open) {
				continue;
			}
			next.push({
				open: true,
				recordId: member.id,
				recordKind: member.kind,
			});
			const signal = entrySignal(member);
			if (signal) {
				input.sink.emit(signal);
			}
		}
	}

	for (const period of next) {
		if (!(period.open && !memberIds.has(period.recordId))) {
			continue;
		}
		period.open = false;
		if (!input.subscription.onExit) {
			continue;
		}
		const signal = leaveSignal(
			period.recordId,
			period.recordKind,
			catalogById.get(period.recordId),
			input.conditions
		);
		if (signal) {
			input.sink.emit(signal);
		}
	}

	return { periods: next, status: "ok" };
}
