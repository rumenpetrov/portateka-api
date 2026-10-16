import type { ContentfulStatusCode } from "hono/utils/http-status";

export const ERROR_STATUS_MAP = {
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  ALREADY_EXISTS: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  INTERNAL_SERVER_ERROR: 500,
} as const satisfies Record<string, ContentfulStatusCode>;

export type ErrorCode = keyof typeof ERROR_STATUS_MAP;

export const RESOURCES = ["property", "route", "user"] as const;

export type Resource = (typeof RESOURCES)[number];

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly resource?: Resource,
    public readonly params?: Record<string, string>,
  ) {
    super(code);
    this.name = this.constructor.name;
  }
}

export class NotFoundApiError extends ApiError {
  constructor(resource?: Resource, params?: Record<string, string>) {
    super("NOT_FOUND", resource, params);
  }
}

export class ValidationApiError extends ApiError {
  constructor(resource?: Resource, params?: Record<string, string>) {
    super("VALIDATION_ERROR", resource, params);
  }
}

export class DuplicateApiError extends ApiError {
  constructor(resource?: Resource, params?: Record<string, string>) {
    super("ALREADY_EXISTS", resource, params);
  }
}

export class InternalServerApiError extends ApiError {
  constructor(resource?: Resource, params?: Record<string, string>) {
    super("INTERNAL_SERVER_ERROR", resource, params);
  }
}

