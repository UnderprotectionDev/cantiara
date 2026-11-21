import { z } from "zod";

export const optionalRouteId = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .optional()
  .catch(undefined);
