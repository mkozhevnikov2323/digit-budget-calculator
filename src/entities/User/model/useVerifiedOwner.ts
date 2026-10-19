import { createContext, useContext, useSyncExternalStore } from 'react';
import { getSessionSnapshot, subscribeSession } from 'shared/api/sessionBoundary';
import type { VerifiedOwnerState } from './verifiedOwner';

/** Supplied only by the existing session-keyed UserProvider. No query or storage. */
export const VerifiedOwnerContext = createContext<VerifiedOwnerState>({
  status: 'verification_error', reason: 'provider_missing',
});

export const useVerifiedOwner = (): VerifiedOwnerState => {
  const state = useContext(VerifiedOwnerContext);
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  if (session.transitioning ||
      (state.status === 'verified' && state.owner.sessionGeneration !== session.generation)) {
    return { status: 'verifying' };
  }
  return state;
};
