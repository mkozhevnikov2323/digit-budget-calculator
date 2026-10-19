import React, { useEffect, useSyncExternalStore } from 'react';
import { useGetMeQuery } from '../api/userApi';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from 'app/providers/store/store';
import { setUser } from '../model/userSlice';
import { useNavigate } from 'react-router';
import { logout } from 'features/Authorization/model/authThunks';
import { completeSessionTransition, getSessionSnapshot, isCurrentSession, subscribeSession } from 'shared/api/sessionBoundary';

interface Props {
  children: React.ReactNode;
}

const CurrentSessionUser: React.FC<Props & { generation: number }> = ({ children, generation }) => {
  const token = localStorage.getItem('token');
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { data, error } = useGetMeQuery(undefined, { skip: !token });

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

  return <>{children}</>;
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
