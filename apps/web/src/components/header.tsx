import { Link, useMatches } from "@tanstack/react-router";
import {
  CommandPaletteQuickActions,
  CommandPaletteTrigger,
} from "@/features/command-palette/ui/components/command-palette";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const isFounderContext = useMatches().some(
    (match) => match.routeId === "/_auth",
  );

  if (!isFounderContext) {
    return (
      <>
        <SkipLink />
        <header className="border-border/80 border-b bg-background">
          <div className="mx-auto flex min-h-14 w-full max-w-[1440px] items-center px-5 sm:px-8 lg:px-10">
            <Link
              className="font-semibold text-foreground text-sm tracking-[-0.02em]"
              to="/"
            >
              cantiara
            </Link>
          </div>
        </header>
      </>
    );
  }

  return (
    <>
      <SkipLink />
      <header className="border-border/80 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-[1440px] items-center gap-1 px-3 sm:gap-6 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Link
              className="shrink-0 font-semibold text-foreground text-sm tracking-[-0.02em]"
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
    </>
  );
}

function SkipLink() {
  return (
    <a className="skip-link" href="#main-content">
      Skip to main content
    </a>
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
    "inline-flex h-11 min-w-max items-center whitespace-nowrap rounded-md px-2 font-medium text-xs text-muted-foreground hover:bg-muted hover:text-foreground sm:px-2.5 sm:text-sm";

  return (
    <Link
      activeOptions={{ exact: false }}
      activeProps={{
        "aria-current": "page",
        className: `${linkClassName} bg-accent text-accent-foreground shadow-xs hover:bg-accent/80`,
      }}
      className={linkClassName}
      to={to}
    >
      {children}
    </Link>
  );
}
