import { ORPCError } from "@orpc/server";

import type { Context } from "./context";
import {
  PERSONAL_DATA_ERROR_MESSAGES,
  PersonalDataError,
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

function requirePersonalDataRights(context: Context) {
  if (!context.personalDataRights) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.personalDataRights;
}

async function personalDataRefusal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PersonalDataError) {
      throw new ORPCError(
        error.code === "contact_not_found" ? "NOT_FOUND" : "BAD_REQUEST",
        {
          cause: error,
          data: { code: error.code },
          defined: true,
          message: PERSONAL_DATA_ERROR_MESSAGES[error.code],
        },
      );
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
