import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { useGetMeQuery } from '../api/userApi';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from 'app/providers/store/store';
import { setUser } from '../model/userSlice';
import { useNavigate } from 'react-router';
import { logout } from 'features/Authorization/model/authThunks';
import { completeSessionTransition, getSessionSnapshot, isCurrentSession, subscribeSession } from 'shared/api/sessionBoundary';
import { validateVerifiedOwner, type VerifiedOwnerState } from '../model/verifiedOwner';
import { VerifiedOwnerContext } from '../model/useVerifiedOwner';

interface Props {
  children: React.ReactNode;
}

const CurrentSessionUser: React.FC<Props & { generation: number }> = ({ children, generation }) => {
  const token = localStorage.getItem('token');
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const query = useGetMeQuery(undefined, { skip: !token, refetchOnMountOrArgChange: true });
  const { data, error } = query;
  // A pre-existing fulfilled cache alone cannot open the capability on mount.
  // RTK shares any pending request; otherwise the mount requests fresh /me.
  const [cachedRequestOnMount] = useState(() =>
    query.isSuccess && !query.isFetching ? query.requestId : undefined);
  const [identity, setIdentity] = useState<{ userId: string | null; changed: boolean }>({
    userId: null, changed: false,
  });
  let ownerState: VerifiedOwnerState;
  if (!token) ownerState = { status: 'unauthenticated' };
  else if (!isCurrentSession(generation)) ownerState = { status: 'verifying' };
  else if (query.isFetching || query.isLoading || query.isUninitialized) {
    ownerState = { status: 'verifying' };
  } else if (error || query.isError) {
    ownerState = { status: 'verification_error', reason: 'request_failed' };
  } else if (!query.isSuccess || !query.requestId || query.requestId === cachedRequestOnMount) {
    ownerState = { status: 'verifying' };
  } else {
    ownerState = validateVerifiedOwner(query.currentData, generation);
    if (identity.changed) {
      ownerState = { status: 'verification_error', reason: 'identity_changed' };
    } else if (ownerState.status === 'verified') {
      const userId = ownerState.owner.userId;
      if (identity.userId === null) setIdentity({ userId, changed: false });
      else if (identity.userId !== userId) {
        // Adjust this keyed component before commit; never publish a different
        // owner in one credential generation. Recovery requires a fresh login.
        setIdentity({ userId: identity.userId, changed: true });
        ownerState = { status: 'verification_error', reason: 'identity_changed' };
      }
    }
  }

  useEffect(() => {
    if (token && data && isCurrentSession(generation)) {
      dispatch(setUser(data));
    }
  }, [data, dispatch, generation, token]);

  useEffect(() => {
    if (
      token && isCurrentSession(generation) && error &&
      'status' in error &&
      (error.status === 401 || error.status === 403)
    ) {
      dispatch(logout());
      navigate('/', { replace: true });
    }
  }, [dispatch, error, navigate, generation, token]);

  return <VerifiedOwnerContext.Provider value={ownerState}>{children}</VerifiedOwnerContext.Provider>;
};

export const UserProvider: React.FC<Props> = ({ children }) => {
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, getSessionSnapshot);
  useEffect(() => {
    if (session.transitioning) completeSessionTransition(session.generation);
  }, [session]);
  // Commit an empty subtree first. Passive unmount cleanup removes previous
  // RTK hooks before this provider's effect performs the credential/cache swap.
  return session.transitioning ? null
    : <CurrentSessionUser key={session.generation} generation={session.generation}>{children}</CurrentSessionUser>;
};
