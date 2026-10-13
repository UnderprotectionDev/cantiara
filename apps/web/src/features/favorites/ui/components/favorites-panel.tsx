import { Button } from "@cantiara/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@cantiara/ui/components/sheet";
import { lazy, Suspense, useCallback, useState } from "react";

const FavoritesList = lazy(() => import("./favorites-list"));

/** The shell hosts the Favorites reader; membership remains with source controls. */
export default function FavoritesPanel() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger render={<Button className="min-h-11" variant="ghost" />}>
        Favorites
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl" side="right">
        <SheetHeader className="border-b">
          <SheetTitle>Favorites</SheetTitle>
          <SheetDescription>
            Open your source records from Favorites.
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <Suspense fallback={<p role="status">Loading Favorites…</p>}>
            <FavoritesList onOpenSource={close} />
          </Suspense>
        </div>
      </SheetContent>
    </Sheet>
  );
}
