import React from 'react';
import { Navigate, useLocation } from 'react-router';

interface ProtectedProps {
  children: React.ReactNode;
}

export const Protected = ({ children }: ProtectedProps) => {
  const token = localStorage.getItem('token');
  const location = useLocation();

  if (!token) {
    return (
      <Navigate
        to="/"
        replace
        state={{ from: location }}
      />
    );
  }

  return <>{children}</>;
};
