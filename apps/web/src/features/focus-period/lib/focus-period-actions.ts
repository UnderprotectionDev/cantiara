import type { client } from "@/utils/orpc";

type FocusPeriodMembershipInput = Parameters<typeof client.addToFocusPeriod>[0];

export interface FocusPeriodMembershipMutation {
  mutateAsync: (input: FocusPeriodMembershipInput) => Promise<unknown>;
}

export type FocusPeriodAction = (
  action: () => Promise<unknown>,
) => Promise<void>;

export interface FocusPeriodSaveEvaluation {
  mutateAsync: (
    input: Parameters<typeof client.saveFocusPeriodEvaluation>[0],
  ) => Promise<unknown>;
}

export interface FocusPeriodCreateFollowUp {
  mutateAsync: (
    input: Parameters<typeof client.createFocusPeriodFollowUpWork>[0],
  ) => Promise<unknown>;
}

export interface FocusPeriodRemove {
  mutateAsync: (input: {
    periodId: string;
    workId: string;
  }) => Promise<unknown>;
}
