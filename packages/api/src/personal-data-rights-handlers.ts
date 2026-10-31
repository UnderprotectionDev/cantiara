import { ORPCError } from "@orpc/server";

import type { Context } from "./context";
import {
  type ErasePersonalDataInput,
  PERSONAL_DATA_ERASE_OPERATION_ID,
  PERSONAL_DATA_ERROR_MESSAGES,
  type PersonalDataErasePreviewInput,
  PersonalDataError,
  type PersonalDataErrorCode,
  type PersonalDataPreviewInput,
  type PersonalDataProduceInput,
} from "./personal-data-rights";

/**
 * oRPC handler bodies of Personal Data Rights (spec 81). The router only names
 * the procedures and their input schemas; refusal mapping lives here.
 */

type PersonalDataHandlerContext = Context & {
  session: { user: { id: string } };
};

type PersonalDataEraseHandlerContext = Context & {
  session: { session: { id: string }; user: { id: string; name: string } };
};

function requirePersonalDataRights(context: Context) {
  if (!context.personalDataRights) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.personalDataRights;
}

const REFUSAL_STATUS: Record<
  PersonalDataErrorCode,
  "BAD_REQUEST" | "FORBIDDEN" | "INTERNAL_SERVER_ERROR" | "NOT_FOUND"
> = {
  contact_not_found: "NOT_FOUND",
  grant_rejected: "FORBIDDEN",
  name_mismatch: "BAD_REQUEST",
  preview_required: "BAD_REQUEST",
  spread_incomplete: "BAD_REQUEST",
  tombstone_incomplete: "INTERNAL_SERVER_ERROR",
};

async function personalDataRefusal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PersonalDataError) {
      throw new ORPCError(REFUSAL_STATUS[error.code], {
        cause: error,
        data: { code: error.code },
        defined: true,
        message: PERSONAL_DATA_ERROR_MESSAGES[error.code],
      });
    }
    throw error;
  }
}

export function personalDataPreviewHandler(
  context: PersonalDataHandlerContext,
  input: PersonalDataPreviewInput,
) {
  return personalDataRefusal(() =>
    requirePersonalDataRights(context).preview(context.session.user.id, input),
  );
}

export function personalDataProduceHandler(
  context: PersonalDataHandlerContext,
  input: PersonalDataProduceInput,
) {
  return personalDataRefusal(() =>
    requirePersonalDataRights(context).produce(context.session.user.id, input),
  );
}

function eraseActor(context: PersonalDataEraseHandlerContext) {
  return {
    accountId: context.session.user.id,
    accountName: context.session.user.name,
  };
}

export function personalDataErasePreviewHandler(
  context: PersonalDataEraseHandlerContext,
  input: PersonalDataErasePreviewInput,
) {
  return personalDataRefusal(() =>
    requirePersonalDataRights(context).previewErase(eraseActor(context), input),
  );
}

/** The grant is consumed for the `personal-data-erase` operation only. */
export function personalDataEraseHandler(
  context: PersonalDataEraseHandlerContext,
  input: ErasePersonalDataInput,
) {
  const confirmation = context.githubIdentityConfirmation;
  if (!confirmation) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return personalDataRefusal(() =>
    requirePersonalDataRights(context).erase(
      eraseActor(context),
      input,
      (grant) =>
        confirmation.consume(
          {
            accountId: context.session.user.id,
            sessionId: context.session.session.id,
          },
          PERSONAL_DATA_ERASE_OPERATION_ID,
          grant,
          context.clientKey,
        ),
    ),
  );
}
