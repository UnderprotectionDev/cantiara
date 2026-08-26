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
			<DropdownMenuTrigger render={<Button size="icon" variant="outline" />}>
				<Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
				<Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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
