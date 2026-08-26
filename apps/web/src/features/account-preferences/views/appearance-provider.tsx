import {
	type Appearance,
	appearanceFromHesap,
	DEFAULT_APPEARANCE,
} from "@cantiara/auth/account-preferences-model";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { createContext, type ReactNode, useCallback, useContext } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

const AppearanceSaveContext = createContext<
	((appearance: Appearance) => void) | null
>(null);

function appearanceClass(appearance: Appearance): "light" | "dark" {
	return appearance === "Light" ? "light" : "dark";
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
	const { data: session } = authClient.useSession();
	const preferences = useQuery({
		...orpc.accountPreferences.get.queryOptions(),
		enabled: Boolean(session?.user),
	});
	const save = useMutation(
		orpc.accountPreferences.save.mutationOptions({
			onError: (error) => {
				toast.error(`Error: ${error.message}`);
			},
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: orpc.accountPreferences.get.queryKey(),
				});
			},
		})
	);
	const appearance = preferences.data
		? appearanceFromHesap(preferences.data)
		: DEFAULT_APPEARANCE;
	const saveAppearance = useCallback(
		(next: Appearance) => {
			const current = preferences.data;
			if (!(session?.user && current)) {
				return;
			}
			save.mutate({
				appearance: next,
				dateFormat: current.dateFormat,
				firstDayOfWeek: current.firstDayOfWeek,
				locale: current.locale,
				timeZone: current.timeZone,
			});
		},
		[preferences.data, save, session?.user]
	);

	return (
		<AppearanceSaveContext.Provider value={saveAppearance}>
			<NextThemesProvider
				attribute="class"
				defaultTheme={appearanceClass(DEFAULT_APPEARANCE)}
				disableTransitionOnChange
				enableSystem={false}
				forcedTheme={appearanceClass(appearance)}
			>
				{children}
			</NextThemesProvider>
		</AppearanceSaveContext.Provider>
	);
}

export function useSaveAppearance() {
	const saveAppearance = useContext(AppearanceSaveContext);
	if (!saveAppearance) {
		throw new Error("AppearanceProvider is required");
	}
	return saveAppearance;
}
