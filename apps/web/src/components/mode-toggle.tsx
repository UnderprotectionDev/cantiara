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
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { themeForAppearance, useTheme } from "@/components/theme-provider";
import {
  accountPreferencesMutationErrorMessage,
  parseAccountPreferencesMutationError,
} from "@/features/account-preferences/lib/account-preferences-mutation-error";
import { authClient } from "@/lib/auth-client";
import {
  accountPreferencesQueryOptions,
  accountPreferencesQueryPrefix,
  client,
} from "@/utils/orpc";

export function ModeToggle() {
  const { setTheme, theme } = useTheme();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const accountId = session.data?.user.id;
  const previousAccountId = useRef(accountId);
  const pendingAppearanceSave = useRef<{
    appearance: Appearance;
    baseRevision: number;
    clientIdempotencyKey: string;
  } | null>(null);
  const preferences = useQuery(accountPreferencesQueryOptions(accountId));
  const saveAppearance = useMutation({
    mutationFn: (input: {
      appearance: Appearance;
      baseRevision: number;
      clientIdempotencyKey: string;
    }) => client.saveAccountAppearance(input),
    onError: (error) => {
      const parsedError = parseAccountPreferencesMutationError(error);
      const message = accountPreferencesMutationErrorMessage(parsedError);
      toast.error(
        parsedError.code === "STALE_BASE_REVISION"
          ? `${message}: ${parsedError.currentValue.appearance} (Revision ${parsedError.currentRevision})`
          : message,
      );
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(
        accountPreferencesQueryOptions(accountId).queryKey,
        saved,
      );
      pendingAppearanceSave.current = null;
      setTheme(themeForAppearance(saved.appearance));
      toast.success("Preferences saved.");
    },
  });
  const saveCurrentAppearance = (appearance: Appearance) => {
    const current = preferences.data;
    if (!current) {
      return;
    }

    const pending = pendingAppearanceSave.current;
    const clientIdempotencyKey =
      pending?.appearance === appearance &&
      pending.baseRevision === current.revision
        ? pending.clientIdempotencyKey
        : crypto.randomUUID();
    pendingAppearanceSave.current = {
      appearance,
      baseRevision: current.revision,
      clientIdempotencyKey,
    };
    saveAppearance.mutate({
      appearance,
      baseRevision: current.revision,
      clientIdempotencyKey,
    });
  };
  const saveLightAppearance = () => saveCurrentAppearance("Light");
  const saveDarkAppearance = () => saveCurrentAppearance("Dark");
  const appearanceActions: Record<Appearance, () => void> = {
    Dark: saveDarkAppearance,
    Light: saveLightAppearance,
  };

  useEffect(() => {
    if (previousAccountId.current !== accountId) {
      previousAccountId.current = accountId;
      pendingAppearanceSave.current = null;
      setTheme("dark");
    }
    if (!accountId) {
      queryClient.removeQueries({ queryKey: accountPreferencesQueryPrefix });
    }
  }, [accountId, queryClient, setTheme]);

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
        render={
          <Button className="min-h-11 min-w-11" size="icon" variant="outline" />
        }
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
