import { ORPCError, type ORPCErrorConstructorMap } from "@orpc/server";

import type { Context } from "./context";
import {
  type ErasePersonalDataInput,
  PERSONAL_DATA_ERASE_OPERATION_ID,
  type PersonalDataErasePreviewInput,
  PersonalDataError,
  type PersonalDataPreviewInput,
  type PersonalDataProduceInput,
} from "./personal-data-rights";

import {
  type personalDataErrors,
  personalDataRpcCode,
} from "./support-reference-rpc-errors";

type PersonalDataRpcErrors = ORPCErrorConstructorMap<typeof personalDataErrors>;

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

async function personalDataRefusal<T>(
  errors: PersonalDataRpcErrors,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PersonalDataError) {
      throw errors[personalDataRpcCode[error.code]]({ cause: error });
    }
    throw error;
  }
}

export function personalDataPreviewHandler(
  context: PersonalDataHandlerContext,
  input: PersonalDataPreviewInput,
  errors: PersonalDataRpcErrors,
) {
  return personalDataRefusal(errors, () =>
    requirePersonalDataRights(context).preview(context.session.user.id, input),
  );
}

export function personalDataProduceHandler(
  context: PersonalDataHandlerContext,
  input: PersonalDataProduceInput,
  errors: PersonalDataRpcErrors,
) {
  return personalDataRefusal(errors, () =>
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
  errors: PersonalDataRpcErrors,
) {
  return personalDataRefusal(errors, () =>
    requirePersonalDataRights(context).previewErase(eraseActor(context), input),
  );
}

/** The grant is consumed for the `personal-data-erase` operation only. */
export function personalDataEraseHandler(
  context: PersonalDataEraseHandlerContext,
  input: ErasePersonalDataInput,
  errors: PersonalDataRpcErrors,
) {
  const confirmation = context.githubIdentityConfirmation;
  if (!confirmation) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return personalDataRefusal(errors, () =>
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
