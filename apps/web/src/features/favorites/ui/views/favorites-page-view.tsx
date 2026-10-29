import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import FavoritesList from "../components/favorites-list";

const noop = () => undefined;

export default function FavoritesPageView() {
  return (
    <ClientShellContent>
      <main className="mx-auto grid w-full max-w-3xl gap-4 p-4">
        <h1 className="font-semibold text-xl">Favorites</h1>
        <FavoritesList onOpenSource={noop} />
      </main>
    </ClientShellContent>
  );
}
