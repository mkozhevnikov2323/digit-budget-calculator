import { useId, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { useGetRecurrenceQuery } from '../api/recurrenceApi';
import type { RecurrenceReport, RecurrenceWindow } from './types';
import { validWindow } from './window';

export type RecurrenceState =
  | { status: 'blocked'; reason: 'unauthenticated' | 'verifying' | 'verification_error' | 'invalid_period' }
  | { status: 'loading' }
  | { status: 'refreshing' }
  | { status: 'error'; reason: 'request' | 'invalid_response' | 'oversized' | 'unauthorized'; retry: () => void }
  | { status: 'ready'; data: RecurrenceReport };

export const useRecurrenceAnalytics = (window: RecurrenceWindow | null): RecurrenceState => {
  const owner = useVerifiedOwner();
  const userId = owner.status === 'verified' ? owner.owner.userId : undefined;
  const generation = owner.status === 'verified' ? owner.owner.sessionGeneration : undefined;
  const start = window?.startMonth, end = window?.endMonthExclusive;
  const enabled = userId && generation && start && end && validWindow({ startMonth: start, endMonthExclusive: end });
  const key = enabled ? JSON.stringify([userId, generation, start, end]) : null;
  const instance = useId();
  const [entry, setEntry] = useState({ key, sequence: 0 });
  if (entry.key !== key) setEntry({ key, sequence: entry.sequence + 1 });
  // A/B/A periods (and verified/verifying/verified) require a new request even
  // if RTK could deduplicate a still-pending request from the retired context.
  // This is a UI lifecycle identity, never authentication or ownership proof.
  const requestScope = `${instance}/${entry.sequence}`;
  const args = useMemo(() => enabled && userId && generation && start && end
    ? { userId, sessionGeneration: generation, startMonth: start, endMonthExclusive: end, requestScope } : skipToken,
  [enabled, userId, generation, start, end, requestScope]);
  const query = useGetRecurrenceQuery(args, { refetchOnMountOrArgChange: true });
  if (owner.status !== 'verified') return { status: 'blocked', reason: owner.status };
  if (args === skipToken) return { status: 'blocked', reason: 'invalid_period' };
  if (query.isError) {
    const status = query.error && 'status' in query.error ? query.error.status : undefined;
    const invalid = query.error && 'error' in query.error && query.error.error === 'INVALID_RECURRENCE_RESPONSE';
    return { status: 'error', reason: status === 413 ? 'oversized' : status === 401 || status === 403 ? 'unauthorized'
      : invalid ? 'invalid_response' : 'request', retry: () => { void query.refetch(); } };
  }
  if (entry.key !== key || query.isLoading || query.isUninitialized || !query.requestId) {
    return { status: 'loading' };
  }
  if (query.isFetching) return { status: query.currentData ? 'refreshing' : 'loading' };
  return query.currentData ? { status: 'ready', data: query.currentData } : { status: 'loading' };
};
