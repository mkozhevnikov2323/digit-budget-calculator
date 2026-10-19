import type { fetchBaseQuery } from '@reduxjs/toolkit/query';
import { getSessionSnapshot, isCurrentSession } from './sessionBoundary';

const obsolete = () => ({ error: { status: 'CUSTOM_ERROR' as const, error: 'SESSION_CHANGED' } });

/** Preserve current-generation HTTP results/errors/tags. Obsolete successes AND
 * errors lose data and meta (including the old Request/Response) before RTK sees
 * them. Auth mutations are allowed to complete in their initiating generation;
 * only their successful consumer starts the separate credential transition. */
export const withSessionBoundary = (query: ReturnType<typeof fetchBaseQuery>): ReturnType<typeof fetchBaseQuery> =>
  async (args, api, options) => {
    const { generation, transitioning } = getSessionSnapshot();
    if (transitioning) return obsolete();
    const request = typeof args === 'string' ? { url: args } : args;
    // FetchArgs allows undefined record values; preserve fetchBaseQuery's
    // omission semantics without mutating endpoint-owned header objects.
    const headers = new Headers();
    const source = request.headers;
    if (source instanceof Headers) source.forEach((value, key) => headers.append(key, value));
    else if (Array.isArray(source)) source.forEach(([key, value]) => headers.append(key, value));
    else if (source) Object.entries(source).forEach(([key, value]) => {
      if (value !== undefined) headers.append(key, value);
    });
    const token = localStorage.getItem('token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const result = await query({ ...request, headers }, api, options);
    return isCurrentSession(generation) ? result : obsolete();
  };
