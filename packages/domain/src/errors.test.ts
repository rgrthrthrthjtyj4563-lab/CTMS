import { describe, it, expect } from "vitest";
import {
  ApiErrorSchema,
  ApiErrorException,
  ApiErrorCode,
  defaultStatusFor,
} from "./errors.js";

describe("ApiError shape", () => {
  it("serializes the canonical shape", () => {
    const e = new ApiErrorException(
      ApiErrorCode.VALIDATION_ERROR,
      "Field x required",
      { details: { field: "x" }, requestId: "r-1" },
    );
    const json = e.toJSON();
    expect(ApiErrorSchema.safeParse(json).success).toBe(true);
    expect(json).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Field x required",
      details: { field: "x" },
      requestId: "r-1",
    });
  });

  it("rejects missing required fields", () => {
    expect(ApiErrorSchema.safeParse({ code: "X", message: "m" }).success).toBe(
      false,
    );
  });

  it("maps error codes to HTTP status", () => {
    expect(defaultStatusFor(ApiErrorCode.UNAUTHORIZED)).toBe(401);
    expect(defaultStatusFor(ApiErrorCode.FORBIDDEN)).toBe(403);
    expect(defaultStatusFor(ApiErrorCode.NOT_FOUND)).toBe(404);
    expect(defaultStatusFor(ApiErrorCode.VALIDATION_ERROR)).toBe(422);
    expect(defaultStatusFor(ApiErrorCode.STATE_TRANSITION_INVALID)).toBe(409);
    expect(defaultStatusFor(ApiErrorCode.INTERNAL)).toBe(500);
  });

  it("default details is an empty object", () => {
    const json = new ApiErrorException(
      ApiErrorCode.INTERNAL,
      "boom",
      { requestId: "r" },
    ).toJSON();
    expect(json.details).toEqual({});
  });
});