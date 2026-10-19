import type { AppDispatch } from 'app/providers/store/store';
import { baseApi } from 'shared/api/baseApi';
import { isCurrentSession, transitionSession } from 'shared/api/sessionBoundary';
import { setAuthenticated } from './authorizationSlice';

const resetSessionState = (dispatch: AppDispatch) => {
  dispatch(baseApi.util.getRunningQueriesThunk()).forEach((request) => request.abort());
  dispatch({ type: 'LOGOUT' });
  dispatch(baseApi.util.resetApiState());
};

export const logout = () => (dispatch: AppDispatch) => {
  // Existing root LOGOUT resets Redux slices; resetApiState also clears RTK's
  // middleware subscriptions. Both occur after the previous tree is removed.
  return transitionSession(() => {
    localStorage.removeItem('token');
    resetSessionState(dispatch);
  });
};

export const completeLogin = (token: string, expectedGeneration: number) => (dispatch: AppDispatch) => {
  if (!isCurrentSession(expectedGeneration)) return Promise.resolve(null);
  return transitionSession(() => {
    resetSessionState(dispatch);
    localStorage.setItem('token', token);
    dispatch(setAuthenticated(true));
  });
};
