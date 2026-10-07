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

export class FavoriteSourceUnavailableError extends Error {
  constructor() {
    super("Source record is unavailable.");
    this.name = "FavoriteSourceUnavailableError";
  }
}

export interface FavoritesAccess {
  add: (accountId: string, source: FavoriteSource) => Promise<void>;
  contains: (accountId: string, source: FavoriteSource) => Promise<boolean>;
  remove: (accountId: string, source: FavoriteSource) => Promise<void>;
}
