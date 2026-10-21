import { zValidator } from "@hono/zod-validator";
import type { z } from "zod";
import { ValidationApiError } from "../helpers/errors";
import type { Resource } from "../helpers/errors";

const formatIssues = (issues: z.core.$ZodIssue[]) => {
  const params: Record<string, string> = {};

  for (const issue of issues) {
    const field = String(issue.path[0] ?? "body");
    params[field] ??= issue.message;
  }

  return params;
};

// Validates the JSON body and throws a ValidationApiError whose params
// map each invalid field to its first error code.
export const validateJson = <T extends z.ZodType>(
  schema: T,
  resource: Resource,
) =>
  zValidator("json", schema, (result) => {
    if (!result.success) {
      throw new ValidationApiError(resource, formatIssues(result.error.issues));
    }
  });

// Validates route params and throws a ValidationApiError whose params
// map each invalid param to its first error code.
export const validateParams = <T extends z.ZodType>(
  schema: T,
  resource: Resource,
) =>
  zValidator("param", schema, (result) => {
    if (!result.success) {
      throw new ValidationApiError(resource, formatIssues(result.error.issues));
    }
  });
