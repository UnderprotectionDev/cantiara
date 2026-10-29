import {
  LINK_PASSWORD_MAX_LENGTH,
  LINK_PASSWORD_MIN_LENGTH,
  SHARE_VISITOR_LINK_PATH,
} from "@cantiara/api/link-sharing";
import { z } from "zod";

const TRAILING_SLASH = /\/$/;

/** The visitor link the founder copies: the server origin, `/s` and the token. */
export function shareVisitorUrl(serverUrl: string, token: string) {
  return `${serverUrl.replace(TRAILING_SLASH, "")}${SHARE_VISITOR_LINK_PATH}/${token}`;
}

export const sharePasswordFormSchema = z.object({
  password: z
    .string()
    .min(
      LINK_PASSWORD_MIN_LENGTH,
      `Use at least ${LINK_PASSWORD_MIN_LENGTH} characters.`,
    )
    .max(
      LINK_PASSWORD_MAX_LENGTH,
      `Use at most ${LINK_PASSWORD_MAX_LENGTH} characters.`,
    ),
});

export interface IssuedShareLink {
  surfaceId: string;
  token: string;
}
