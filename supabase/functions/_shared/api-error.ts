// Stripe-style API error envelope for the public v1 REST API.
//
// All v1 endpoints respond with:
//   { error: { type, code, message, param? } }
// on non-2xx. Pinning the shape lets SDKs map errors mechanically.

import { json } from './cors.ts';

export type ApiErrorType =
  | 'invalid_request_error' // bad input / shape / missing field
  | 'authentication_error'  // missing or invalid API key
  | 'permission_error'      // valid auth, wrong owner / forbidden
  | 'not_found_error'       // resource does not exist
  | 'rate_limit_error'      // 429
  | 'idempotency_error'     // same key, different body
  | 'api_error';            // 5xx server side

export function apiError(
  type: ApiErrorType,
  code: string,
  message: string,
  status: number,
  param?: string,
): Response {
  const err: Record<string, unknown> = { type, code, message };
  if (param) err.param = param;
  return json({ error: err }, status);
}
