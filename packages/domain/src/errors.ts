/**
 * Unified API error shape used by all backend responses.
 *
 * Per AIC-DCT architecture: every error response MUST conform to this shape
 * so the Web client, subject mobile, and provider views can rely on a single
 * error contract.
 */
import { z } from "zod";

export const ApiErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  STATE_TRANSITION_INVALID: "STATE_TRANSITION_INVALID",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED",
  REASON_REQUIRED: "REASON_REQUIRED",
  MASKING_REQUIRED: "MASKING_REQUIRED",
  AI_CONFIRMATION_REQUIRED: "AI_CONFIRMATION_REQUIRED",
  AUDIT_REQUIRED: "AUDIT_REQUIRED",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;
export type ApiErrorCode = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const ApiErrorSchema = z.object({
  code: z.nativeEnum(ApiErrorCode),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional().default({}),
  requestId: z.string().min(1),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export class ApiErrorException extends Error {
  public readonly code: ApiErrorCode;
  public readonly details: Record<string, unknown>;
  public readonly requestId: string;
  public readonly status: number;

  constructor(
    code: ApiErrorCode,
    message: string,
    options: {
      status?: number;
      details?: Record<string, unknown>;
      requestId?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message);
    this.name = "ApiErrorException";
    this.code = code;
    this.details = options.details ?? {};
    this.requestId = options.requestId ?? "unknown-request";
    this.status = options.status ?? defaultStatusFor(code);
    if (options.cause !== undefined) {
      // Node 18+ supports Error.cause for richer logs.
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }

  toJSON(): ApiError {
    return ApiErrorSchema.parse({
      code: this.code,
      message: this.message,
      details: this.details,
      requestId: this.requestId,
    });
  }
}

export function defaultStatusFor(code: ApiErrorCode): number {
  switch (code) {
    case ApiErrorCode.UNAUTHORIZED:
      return 401;
    case ApiErrorCode.FORBIDDEN:
      return 403;
    case ApiErrorCode.NOT_FOUND:
      return 404;
    case ApiErrorCode.CONFLICT:
    case ApiErrorCode.STATE_TRANSITION_INVALID:
    case ApiErrorCode.AI_CONFIRMATION_REQUIRED:
    case ApiErrorCode.CONFIRMATION_REQUIRED:
      return 409;
    case ApiErrorCode.VALIDATION_ERROR:
    case ApiErrorCode.REASON_REQUIRED:
      return 422;
    case ApiErrorCode.MASKING_REQUIRED:
    case ApiErrorCode.AUDIT_REQUIRED:
      return 403;
    case ApiErrorCode.RATE_LIMITED:
      return 429;
    case ApiErrorCode.INTERNAL:
    default:
      return 500;
  }
}