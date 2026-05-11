import type { ProblemDetails } from './types';

/** Typed error thrown when the API returns a non-2xx response. */
export class ApiError extends Error {
  constructor(
    public readonly problem: ProblemDetails,
    public readonly httpStatus: number,
    public readonly url: string,
  ) {
    super(`${problem.status} ${problem.title}: ${problem.detail ?? ''}`);
    this.name = 'ApiError';
  }
}

/** Type-guard: narrows an unknown error to `ApiError`. */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** 404 Not Found. */
export function isNotFound(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 404;
}

/** 409 Conflict (duplicate, concurrent edit, dependent records). */
export function isConflict(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 409;
}

/** 422 Unprocessable Entity (validation). */
export function isValidation(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 422;
}

/** 401 Unauthorized (missing or invalid token). */
export function isUnauthorized(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 401;
}

/** 403 Forbidden (valid token but insufficient role). */
export function isForbidden(err: unknown): boolean {
  return isApiError(err) && err.httpStatus === 403;
}
