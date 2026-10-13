import { z } from "zod";

export const FAVORITE_SOURCE_TYPES = [
  "Project",
  "Document",
  "Work",
  "Decision",
  "Smart Collection",
] as const;

export const favoriteSourceSchema = z
  .object({
    sourceRecordId: z.string().trim().min(1).max(255),
    sourceRecordType: z.enum(FAVORITE_SOURCE_TYPES),
  })
  .strict();

export type FavoriteSource = z.infer<typeof favoriteSourceSchema>;

export type FavoriteEntry = FavoriteSource & { addedAt: string } & (
    | {
        status: "available";
        title: string;
        projectId: string | null;
        viewId: string | null;
        life: "Archived" | "In Trash" | null;
      }
    | { status: "unavailable"; reason: "No access" | "Permanently deleted" }
  );

export class FavoriteSourceUnavailableError extends Error {
  constructor() {
    super("Source record is unavailable.");
    this.name = "FavoriteSourceUnavailableError";
  }
}

export interface FavoritesAccess {
  add: (accountId: string, source: FavoriteSource) => Promise<void>;
  contains: (accountId: string, source: FavoriteSource) => Promise<boolean>;
  list: (accountId: string) => Promise<FavoriteEntry[]>;
  open: (accountId: string, source: FavoriteSource) => Promise<FavoriteEntry>;
  remove: (accountId: string, source: FavoriteSource) => Promise<void>;
}
