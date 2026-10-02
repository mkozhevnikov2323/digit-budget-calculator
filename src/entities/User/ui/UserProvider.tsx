import React, { useEffect } from 'react';
import { useGetMeQuery } from '../api/userApi';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from 'app/providers/store/store';
import { setUser } from '../model/userSlice';
import { useNavigate } from 'react-router';
import { logout } from 'features/Authorization/model/authThunks';

interface Props {
  children: React.ReactNode;
}

export const UserProvider: React.FC<Props> = ({ children }) => {
  const token = localStorage.getItem('token');
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();

  const { data, error } = useGetMeQuery(undefined, { skip: !token });

  useEffect(() => {
    if (data) {
      dispatch(setUser(data));
    }
  }, [data, dispatch]);

  useEffect(() => {
    if (
      error &&
      'status' in error &&
      (error.status === 401 || error.status === 403)
    ) {
      dispatch(logout());
      navigate('/', { replace: true });
    }
  }, [dispatch, error, navigate]);

  return <>{children}</>;
};
