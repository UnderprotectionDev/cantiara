import { ACCOUNT_PREFERENCES_COPY } from "@cantiara/auth/account-preferences-copy";
import type { Appearance } from "@cantiara/auth/account-preferences-model";
import { Button } from "@cantiara/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@cantiara/ui/components/dropdown-menu";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { orpc, queryClient } from "@/utils/orpc";

export function ModeToggle() {
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

	const onAppearance = useCallback(
		(appearance: Appearance) => {
			const current = preferences.data;
			if (!session?.user || !current) {
				return;
			}
			save.mutate({
				appearance,
				dateFormat: current.dateFormat,
				firstDayOfWeek: current.firstDayOfWeek,
				locale: current.locale,
				timeZone: current.timeZone,
			});
		},
		[preferences.data, save, session?.user]
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger render={<Button size="icon" variant="outline" />}>
				<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
				<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
				<span className="sr-only">{ACCOUNT_PREFERENCES_COPY.appearance}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => onAppearance("light")}>
					{ACCOUNT_PREFERENCES_COPY.light}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => onAppearance("dark")}>
					{ACCOUNT_PREFERENCES_COPY.dark}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
