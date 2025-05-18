import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setAuthenticated } from 'features/Authorization';

export const InitAuth = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      dispatch(setAuthenticated(true));
    }
  }, [dispatch]);

  return null;
};
