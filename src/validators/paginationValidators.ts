import { z } from "zod";
import { SYSTEM_CONFIG } from "@/config";

const coerceEmptyStringToNaN = (val: unknown) => {
  if (typeof val === "string" && val.trim() === "") {
    return Number.NaN;
  }

  return val;
};

export const paginationQuerySchema = z.object({
  page: z
    .preprocess(
      coerceEmptyStringToNaN,
      z.coerce
        .number({ error: "invalid_type" })
        .int("invalid_type")
        .min(1, "too_small"),
    )
    .default(1),
  limit: z
    .preprocess(
      coerceEmptyStringToNaN,
      z.coerce
        .number({ error: "invalid_type" })
        .int("invalid_type")
        .min(1, "too_small")
        .max(SYSTEM_CONFIG.maxPageSize, "too_big"),
    )
    .default(SYSTEM_CONFIG.defaultPageSize),
});
