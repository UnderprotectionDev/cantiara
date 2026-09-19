import { Link, useMatches } from "@tanstack/react-router";
import {
  CommandPaletteQuickActions,
  CommandPaletteTrigger,
} from "@/features/command-palette/components/command-palette";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const isFounderContext = useMatches().some(
    (match) => match.routeId === "/_auth",
  );

  if (!isFounderContext) {
    return (
      <header>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
          <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-lg">
            <Link to="/">Home</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/projects">Projects</Link>
            <Link to="/capture">Capture Inbox</Link>
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

  return (
    <header className="border-border/80 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-[1440px] items-center gap-1 px-3 sm:gap-6 sm:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link
            className="shrink-0 font-semibold text-foreground text-xs tracking-[-0.02em] sm:text-sm"
            to="/projects"
          >
            cantiara
          </Link>
          <span
            aria-hidden="true"
            className="hidden h-5 w-px bg-border/80 sm:block"
          />
          <nav
            aria-label="Primary navigation"
            className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto sm:gap-1"
          >
            <ShellNavLink to="/projects">Projects</ShellNavLink>
            <ShellNavLink to="/capture">Capture Inbox</ShellNavLink>
          </nav>
        </div>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-1 sm:gap-1.5">
          <div className="hidden items-center lg:flex">
            <CommandPaletteQuickActions />
          </div>
          <CommandPaletteTrigger />
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function ShellNavLink({
  children,
  to,
}: {
  children: string;
  to: "/capture" | "/projects";
}) {
  const linkClassName =
    "inline-flex h-8 min-w-max items-center whitespace-nowrap rounded-md px-1.5 font-medium text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground sm:px-2.5 sm:text-xs";

  return (
    <Link
      activeProps={{
        className: `${linkClassName} bg-accent text-accent-foreground shadow-xs hover:bg-accent/80`,
      }}
      className={linkClassName}
      to={to}
    >
      {children}
    </Link>
  );
}
