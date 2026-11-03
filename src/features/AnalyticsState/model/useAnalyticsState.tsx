import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { ReactReduxContext } from 'react-redux';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { getSessionSnapshot } from 'shared/api/sessionBoundary';
import {
  setValue,
  resetPageInput,
  type AnalyticsPageKey,
  type AnalyticsUI,
} from './slice';
export const AnalyticsPageContext = createContext<AnalyticsPageKey | null>(
  null,
);
/** Reused components keep their local demo/test lifecycle outside an Analytics page. */
export function useAnalyticsState<T>(
  field: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const page = useContext(AnalyticsPageContext),
    owner = useVerifiedOwner(),
    redux = useContext(ReactReduxContext);
  const dispatch = redux?.store.dispatch;
  const scope =
    owner.status === 'verified'
      ? `${owner.owner.userId}/${owner.owner.sessionGeneration}`
      : `unverified/${getSessionSnapshot().generation}`;
  const state = useSyncExternalStore(
    redux?.store.subscribe ?? (() => () => {}),
    () =>
      (redux?.store.getState() as { analyticsUI?: AnalyticsUI } | undefined)
        ?.analyticsUI,
  );
  const [local, setLocal] = useState(initial);
  // Persisted display settings have no owner; private input requires the current scope.
  const safe = ['selection', 'months', 'page', 'visible'].includes(field);
  const stored =
    page && state && (safe || state.scope === scope)
      ? state.pages[page]?.[field]
      : undefined;
  const value = stored === undefined ? local : (stored as T);
  return [
    value,
    (next) => {
      if (!page || !state || !dispatch) {
        setLocal(next);
        return;
      }
      const v =
        typeof next === 'function' ? (next as (previous: T) => T)(value) : next;
      dispatch(setValue({ scope, page, field, value: v }));
    },
  ];
}

export const useResetAnalyticsInput = () => {
  const page = useContext(AnalyticsPageContext),
    redux = useContext(ReactReduxContext);
  return () => {
    if (page) redux?.store.dispatch(resetPageInput(page));
  };
};
