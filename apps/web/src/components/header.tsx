import { Link } from "@tanstack/react-router";

import {
  CommandPaletteQuickActions,
  CommandPaletteTrigger,
} from "@/features/command-palette/components/command-palette";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/capture", label: "Capture Inbox" },
  ] as const;

  return (
    <header>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-lg">
          {links.map(({ to, label }) => (
            <Link key={to} to={to}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-1.5">
          <CommandPaletteQuickActions />
          <CommandPaletteTrigger />
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
      <hr />
    </header>
  );
}
