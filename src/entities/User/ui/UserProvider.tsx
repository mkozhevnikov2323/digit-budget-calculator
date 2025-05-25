import React, { useEffect } from 'react';
import { useGetMeQuery } from '../api/userApi';
import { useDispatch, useSelector } from 'react-redux';
import { setUser } from '../model/userSlice';
import { RootState } from 'app/providers/store/store';
import { useNavigate } from 'react-router';

interface Props {
  children: React.ReactNode;
}

export const UserProvider: React.FC<Props> = ({ children }) => {
  const token = localStorage.getItem('token');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const isAuthenticated = useSelector(
    (state: RootState) => state.authorization.isAuthenticated,
  );

  const { data, refetch } = useGetMeQuery(undefined, { skip: !token });

  useEffect(() => {
    if (token && isAuthenticated) {
      refetch();
    }
  }, [token, isAuthenticated, refetch]);

  useEffect(() => {
    if (data && isAuthenticated) {
      dispatch(setUser(data));
    } else {
      navigate('/');
    }
  }, [data, dispatch, token, isAuthenticated, navigate]);

  return <>{children}</>;
};
