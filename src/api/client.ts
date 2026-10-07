import axios, { AxiosError } from 'axios';
import type { ApiErrorBody } from './contracts';

/** Short in automated tests so timeout scenarios do not slow the suite down. */
export const REQUEST_TIMEOUT_MS = import.meta.env.MODE === 'e2e' ? 1500 : 5000;

export const http = axios.create({
  baseURL: '/api',
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

export type ApiErrorKind = 'timeout' | 'network' | 'client' | 'server' | 'cancelled' | 'unknown';

/** Normalized failure so UI and retry policy never inspect Axios internals. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Timeouts, dropped connections and 5xx may succeed later; 4xx will not. */
  get retryable(): boolean {
    return this.kind === 'timeout' || this.kind === 'network' || this.kind === 'server';
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (axios.isCancel(error)) return new ApiError('cancelled', 'Request cancelled');
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError('timeout', 'The server took too long to answer.');
    }
    const status = error.response?.status ?? null;
    if (status === null) return new ApiError('network', 'Could not reach the server.');
    const body = error.response?.data as Partial<ApiErrorBody> | undefined;
    const message = body?.error?.message ?? `Request failed with status ${status}.`;
    return new ApiError(status >= 500 ? 'server' : 'client', message, status);
  }
  return new ApiError('unknown', error instanceof Error ? error.message : 'Unexpected error');
}
