import {
  APPEARANCE_OPTIONS,
  type Appearance,
} from "@cantiara/api/account-preferences";
import { Button } from "@cantiara/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@cantiara/ui/components/dropdown-menu";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

import { type Theme, useTheme } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { client, orpc } from "@/utils/orpc";

function themeForAppearance(appearance: Appearance): Theme {
  return appearance === "Light" ? "light" : "dark";
}

export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const preferences = useQuery({
    ...orpc.accountPreferences.queryOptions(),
    enabled: Boolean(session.data),
  });
  const saveAppearance = useMutation({
    mutationFn: (appearance: Appearance) => {
      if (!preferences.data) {
        throw new Error("Preferences are unavailable.");
      }
      const {
        isSaved: _isSaved,
        savedAt: _savedAt,
        ...values
      } = preferences.data;
      return client.saveAccountPreferences({ ...values, appearance });
    },
    onError: () => {
      toast.error("Preferences could not be saved.");
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(
        orpc.accountPreferences.queryOptions().queryKey,
        saved,
      );
      setTheme(themeForAppearance(saved.appearance));
      toast.success("Preferences saved.");
    },
  });
  const saveLightAppearance = () => saveAppearance.mutate("Light");
  const saveDarkAppearance = () => saveAppearance.mutate("Dark");
  const appearanceActions: Record<Appearance, () => void> = {
    Dark: saveDarkAppearance,
    Light: saveLightAppearance,
  };

  useEffect(() => {
    if (preferences.data) {
      setTheme(themeForAppearance(preferences.data.appearance));
    }
  }, [preferences.data, setTheme]);

  if (!session.data) {
    return null;
  }

  const currentAppearance = theme === "light" ? "Light" : "Dark";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Appearance"
        render={<Button size="icon" variant="outline" />}
      >
        {currentAppearance === "Light" ? (
          <Sun aria-hidden="true" className="size-4" />
        ) : (
          <Moon aria-hidden="true" className="size-4" />
        )}
        <span className="sr-only">Appearance</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {APPEARANCE_OPTIONS.map((appearance) => (
          <DropdownMenuItem
            disabled={
              preferences.isPending ||
              saveAppearance.isPending ||
              appearance === currentAppearance
            }
            key={appearance}
            onClick={appearanceActions[appearance]}
          >
            {appearance}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
