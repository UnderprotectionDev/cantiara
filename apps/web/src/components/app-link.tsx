import { Link } from "@tanstack/react-router";
import type { AnchorHTMLAttributes } from "react";

const NO_ACTIVE_PROPS = {};

export function parseAppHref(href: string) {
  const hashIndex = href.indexOf("#");
  const beforeHash = hashIndex === -1 ? href : href.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : href.slice(hashIndex + 1);
  const queryIndex = beforeHash.indexOf("?");
  const path = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : beforeHash.slice(queryIndex + 1);
  const search: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(query)) {
    search[key] = value;
  }

  return { hash, path, search };
}

/**
 * Router link for an in-app path string (for example `/projects/p1#work-w1`
 * or `#work-w1`) produced by a helper, so navigation stays client-side.
 */
export function AppLink({
  href,
  ...anchorProps
}: Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string }) {
  const { hash, path, search } = parseAppHref(href);
  const hasSearch = Object.keys(search).length > 0;
  const keepCurrentSearch = path === "" ? true : undefined;

  return (
    <Link
      {...anchorProps}
      activeOptions={{ exact: true, includeHash: true }}
      activeProps={NO_ACTIVE_PROPS}
      hash={hash || undefined}
      // biome-ignore lint/suspicious/noExplicitAny: the path is a runtime string from a href helper, so it cannot satisfy the typed route union.
      search={(hasSearch ? search : keepCurrentSearch) as any}
      // biome-ignore lint/suspicious/noExplicitAny: see above.
      to={(path === "" ? "." : path) as any}
    />
  );
}
