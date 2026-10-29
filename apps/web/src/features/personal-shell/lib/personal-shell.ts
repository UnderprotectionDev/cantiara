/** The four personal surfaces the shell opens, in tab order. */
export const PERSONAL_SHELL_SURFACES = [
  "Daily Focus",
  "Favorites",
  "Notification Center",
  "Look again",
] as const;

export type PersonalShellSurface = (typeof PERSONAL_SHELL_SURFACES)[number];

export const PERSONAL_SHELL_FULL_PAGE_PATHS = {
  "Daily Focus": "/daily-focus",
  Favorites: "/favorites",
  "Look again": "/look-again",
  "Notification Center": "/notifications",
} as const satisfies Record<PersonalShellSurface, string>;

/** A new session always starts closed on the first surface; nothing is restored. */
export const PERSONAL_SHELL_INITIAL_SURFACE: PersonalShellSurface =
  PERSONAL_SHELL_SURFACES[0];

export function isPersonalShellSurface(
  value: unknown,
): value is PersonalShellSurface {
  return PERSONAL_SHELL_SURFACES.some((surface) => surface === value);
}
