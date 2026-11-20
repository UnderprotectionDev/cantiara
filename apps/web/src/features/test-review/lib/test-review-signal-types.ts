import type { TestReviewList } from "@cantiara/api/test-review";
import type {
  FollowUpTargetInput,
  TestFollowUpPreview,
} from "@cantiara/api/test-review-signals";

export interface TestReviewSignalActions {
  bindResult: (
    scenarioId: string,
    scenarioVersion: number,
    sessionTestId: string,
  ) => Promise<unknown>;
  bindState?: { error: unknown; isPending: boolean };
  commitFollowUp: (
    sessionTestIds: string[],
    target: FollowUpTargetInput,
    preview: TestFollowUpPreview,
  ) => Promise<unknown>;
  followUpState?: {
    error: unknown;
    isPending: boolean;
    isSuccess: boolean;
    reset: () => void;
  };
  previewFollowUp: (
    sessionTestIds: string[],
    target: FollowUpTargetInput,
  ) => Promise<TestFollowUpPreview>;
  supersede: (newerId: string, olderId: string) => Promise<unknown>;
}

export type TestReviewSignalData = Pick<
  TestReviewList,
  "bindings" | "conflicts" | "contextChanges" | "followUps" | "supersessions"
>;
