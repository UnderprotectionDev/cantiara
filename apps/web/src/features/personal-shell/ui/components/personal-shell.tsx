import { Button } from "@cantiara/ui/components/button";
import {
  createSheetHandle,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@cantiara/ui/components/sheet";
import { Tabs, TabsList, TabsTrigger } from "@cantiara/ui/components/tabs";
import { Link } from "@tanstack/react-router";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { type ReactNode, useCallback, useState } from "react";
import {
  isPersonalShellSurface,
  PERSONAL_SHELL_FULL_PAGE_PATHS,
  PERSONAL_SHELL_INITIAL_SURFACE,
  PERSONAL_SHELL_SURFACES,
  type PersonalShellSurface,
} from "../../lib/personal-shell";

/**
 * Opens Daily Focus, Favorites, Notification Center and Look again in one
 * temporary panel above the current route. It owns no membership, no read
 * state and no persisted position. Base UI owns the panel lifecycle.
 */
export default function PersonalShell({
  renderSurface,
}: {
  renderSurface: (
    surface: PersonalShellSurface,
    close: () => void,
  ) => ReactNode;
}) {
  const [sheetHandle] = useState(createSheetHandle);
  const navigation = useCreateStore<PersonalShellSurface>(
    PERSONAL_SHELL_INITIAL_SURFACE,
  );
  const surface = useSelector(navigation, (value) => value);
  const close = useCallback(() => sheetHandle.close(), [sheetHandle]);
  const selectSurface = useCallback(
    (value: unknown) => {
      if (isPersonalShellSurface(value)) {
        navigation.setState(() => value);
      }
    },
    [navigation],
  );
  return (
    <Sheet handle={sheetHandle}>
      <SheetTrigger render={<Button className="min-h-11" variant="ghost" />}>
        Personal
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>{surface}</SheetTitle>
          <SheetDescription>
            Personal surfaces open above your current work.
          </SheetDescription>
          <Tabs onValueChange={selectSurface} value={surface}>
            <TabsList
              aria-label="Personal surfaces"
              className="h-auto flex-wrap"
            >
              {PERSONAL_SHELL_SURFACES.map((name) => (
                <TabsTrigger className="min-h-11" key={name} value={name}>
                  {name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Link
            className="inline-flex min-h-11 items-center text-sm underline"
            onClick={close}
            to={PERSONAL_SHELL_FULL_PAGE_PATHS[surface]}
          >
            Open full page
          </Link>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {renderSurface(surface, close)}
        </div>
      </SheetContent>
    </Sheet>
  );
}
