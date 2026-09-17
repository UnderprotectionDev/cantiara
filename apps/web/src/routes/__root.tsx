import { Toaster } from "@cantiara/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  useMatches,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import Header from "@/components/header";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { CommandPaletteProvider } from "@/features/command-palette/components/command-palette";
import { ClientShellProvider } from "@/features/web-macos-client/views/client-shell";
import type { orpc } from "@/utils/orpc";

import "../index.css";

export interface RouterAppContext {
  orpc: typeof orpc;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
  head: () => ({
    meta: [
      {
        title: "cantiara",
      },
      {
        name: "description",
        content: "cantiara is a web application",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.ico",
      },
    ],
  }),
});

function RootComponent() {
  return (
    <>
      <HeadContent />
      <ClientShellProvider>
        <ThemeProvider defaultTheme="dark">
          <AppShell />
        </ThemeProvider>
      </ClientShellProvider>
      <TanStackRouterDevtools position="bottom-left" />
      <ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
    </>
  );
}

function AppShell() {
  const { theme } = useTheme();
  const isFounderContext = useMatches().some(
    (match) => match.routeId === "/_auth",
  );

  const shellContent = (
    <>
      <Header />
      <Outlet />
    </>
  );

  return (
    <>
      <div className="grid h-svh grid-rows-[auto_1fr]">
        {isFounderContext ? (
          <CommandPaletteProvider>{shellContent}</CommandPaletteProvider>
        ) : (
          shellContent
        )}
      </div>
      <Toaster richColors theme={theme} />
    </>
  );
}
