import {
  ConflictApiError,
  ForbiddenError,
  NotFoundApiError,
  RateLimitedError,
  ServerApiError,
  UnauthenticatedError,
  ValidationApiError,
  toApiError,
} from "./errors";

describe("toApiError", () => {
  it("maps 401 to UnauthenticatedError", () => {
    expect(toApiError(401, {})).toBeInstanceOf(UnauthenticatedError);
  });

  it("maps 403 to ForbiddenError", () => {
    expect(toApiError(403, {})).toBeInstanceOf(ForbiddenError);
  });

  it("maps 404 to NotFoundApiError", () => {
    expect(toApiError(404, {})).toBeInstanceOf(NotFoundApiError);
  });

  it("maps 409 to ConflictApiError", () => {
    expect(toApiError(409, {})).toBeInstanceOf(ConflictApiError);
  });

  it("maps 422 to ValidationApiError", () => {
    expect(toApiError(422, {})).toBeInstanceOf(ValidationApiError);
  });

  it("maps 429 to RateLimitedError", () => {
    expect(toApiError(429, {})).toBeInstanceOf(RateLimitedError);
  });

  it("maps any other status (e.g. 500, 502) to ServerApiError", () => {
    expect(toApiError(500, {})).toBeInstanceOf(ServerApiError);
    expect(toApiError(502, {})).toBeInstanceOf(ServerApiError);
  });

  it("preserves the original response body on the error instance", () => {
    const body = { detail: "something specific" };
    const error = toApiError(422, body);
    expect((error as ValidationApiError).body).toEqual(body);
  });

  it("every mapped error is an instance of Error with a status code", () => {
    const error = toApiError(403, {});
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(403);
  });
});
