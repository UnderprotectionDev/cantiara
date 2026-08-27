import { ACCOUNT_PREFERENCES_COPY } from "@cantiara/auth/account-preferences-copy";
import { Button } from "@cantiara/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@cantiara/ui/components/dropdown-menu";
import { Moon, Sun } from "lucide-react";
import { useCallback } from "react";

import { useSaveAppearance } from "@/features/account-preferences/views/appearance-provider";

export function AppearanceToggle() {
	const saveAppearance = useSaveAppearance();
	const onLight = useCallback(() => {
		saveAppearance("Light");
	}, [saveAppearance]);
	const onDark = useCallback(() => {
		saveAppearance("Dark");
	}, [saveAppearance]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button className="relative" size="icon" variant="ghost" />}
			>
				<Sun className="size-4 scale-100 dark:scale-0" />
				<Moon className="absolute size-4 scale-0 dark:scale-100" />
				<span className="sr-only">{ACCOUNT_PREFERENCES_COPY.appearance}</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={onLight}>
					{ACCOUNT_PREFERENCES_COPY.light}
				</DropdownMenuItem>
				<DropdownMenuItem onClick={onDark}>
					{ACCOUNT_PREFERENCES_COPY.dark}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
