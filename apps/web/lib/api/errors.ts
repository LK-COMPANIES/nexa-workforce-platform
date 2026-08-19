// Typed error hierarchy for every status the backend can return (brief §21).
// Callers (pages, Server Actions) catch the specific subclass they care
// about instead of parsing status codes ad hoc.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class UnauthenticatedError extends ApiError {
  constructor(body?: unknown) {
    super(401, "Your session has expired. Please sign in again.", body);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(body?: unknown) {
    super(403, "You do not have permission to perform this action.", body);
    this.name = "ForbiddenError";
  }
}

export class NotFoundApiError extends ApiError {
  constructor(body?: unknown) {
    super(404, "The requested resource was not found.", body);
    this.name = "NotFoundApiError";
  }
}

export class ConflictApiError extends ApiError {
  constructor(body?: unknown) {
    super(409, "This action conflicts with the current state.", body);
    this.name = "ConflictApiError";
  }
}

export class ValidationApiError extends ApiError {
  constructor(body?: unknown) {
    super(422, "The submitted data was invalid.", body);
    this.name = "ValidationApiError";
  }
}

export class RateLimitedError extends ApiError {
  constructor(body?: unknown) {
    super(429, "Too many requests. Please wait a moment and try again.", body);
    this.name = "RateLimitedError";
  }
}

export class ServerApiError extends ApiError {
  constructor(status: number, body?: unknown) {
    super(status, "Something went wrong on our end. Please try again.", body);
    this.name = "ServerApiError";
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  switch (status) {
    case 401:
      return new UnauthenticatedError(body);
    case 403:
      return new ForbiddenError(body);
    case 404:
      return new NotFoundApiError(body);
    case 409:
      return new ConflictApiError(body);
    case 422:
      return new ValidationApiError(body);
    case 429:
      return new RateLimitedError(body);
    default:
      return new ServerApiError(status, body);
  }
}
