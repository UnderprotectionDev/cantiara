import { createAuthClient } from "better-auth/react";

import { env } from "../env";
import { getTauriBearerToken } from "../features/account-access/lib/tauri-session";

export const authClient = createAuthClient({
  baseURL: env.VITE_SERVER_URL,
  fetchOptions: {
    auth: {
      token: async () => (await getTauriBearerToken()) ?? undefined,
      type: "Bearer",
    },
    credentials: "include",
  },
});
