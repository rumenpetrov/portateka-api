import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ERROR_STATUS_MAP, type ErrorCode, type Resource } from "./errors";

export type SuccessResponse<
  T extends Record<string, unknown> | unknown[],
  E extends Record<string, unknown> = Record<string, unknown>,
> = { data: T } & E;

export interface ErrorResponse {
  code: ErrorCode;
  resource?: Resource;
  params?: Record<string, string>;
}

export type TransportContext =
  | Context
  | {
      c: Context;
      status?: ContentfulStatusCode;
    };

export const ok = <
  T extends Record<string, unknown> | unknown[],
  E extends Record<string, unknown> = Record<string, unknown>,
>(
  transport: TransportContext,
  data: T,
  extra?: E,
) => {
  const c = "req" in transport ? transport : transport.c;
  const status = "req" in transport ? 200 : (transport.status ?? 200);

  const payload = {
    data,
    ...(extra || {}),
  } as SuccessResponse<T, E>;

  return c.json(payload, status);
};

export const bad = (
  c: Context,
  code: ErrorCode,
  resource?: Resource,
  params?: Record<string, string>,
) => {
  const status = ERROR_STATUS_MAP[code] || 500;
  const payload: ErrorResponse = {
    code,
    ...(resource ? { resource } : {}),
    ...(params && Object.keys(params).length > 0 ? { params } : {}),
  };

  return c.json(payload, status);
};
