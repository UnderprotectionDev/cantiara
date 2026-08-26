import { DEFAULT_APPEARANCE } from "@cantiara/auth/account-preferences-model";
import { useQuery } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";

export function ThemeProvider({ children }: { children: ReactNode }) {
	const { data: session } = authClient.useSession();
	const preferences = useQuery({
		...orpc.accountPreferences.get.queryOptions(),
		enabled: Boolean(session?.user),
	});
	const appearance = preferences.data?.appearance ?? DEFAULT_APPEARANCE;

	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme={DEFAULT_APPEARANCE}
			disableTransitionOnChange
			enableSystem={false}
			forcedTheme={appearance}
		>
			{children}
		</NextThemesProvider>
	);
}

export { useTheme } from "next-themes";
