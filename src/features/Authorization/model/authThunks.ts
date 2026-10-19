import type { AppDispatch } from 'app/providers/store/store';
import { baseApi } from 'shared/api/baseApi';
import { isCurrentSession, transitionSession } from 'shared/api/sessionBoundary';
import { acknowledgeCredential, checkCredentialChange } from 'shared/api/credentialObservation';
import { setAuthenticated } from './authorizationSlice';

const resetSessionState = (dispatch: AppDispatch) => {
  dispatch(baseApi.util.getRunningQueriesThunk()).forEach((request) => request.abort());
  dispatch({ type: 'LOGOUT' });
  dispatch(baseApi.util.resetApiState());
};

const adoptCurrentCredential = (dispatch: AppDispatch) => {
  resetSessionState(dispatch);
  acknowledgeCredential();
  if (localStorage.getItem('token')) dispatch(setAuthenticated(true));
};

/** External observation never writes shared storage. Completion re-reads the
 * final credential after the existing passive-unmount barrier. */
export const adoptExternalSession = () => (dispatch: AppDispatch) =>
  transitionSession(() => adoptCurrentCredential(dispatch));

export const logout = () => (dispatch: AppDispatch) => {
  if (checkCredentialChange()) return Promise.resolve(null);
  const expectedCredential = localStorage.getItem('token');
  // Existing root LOGOUT resets Redux slices; resetApiState also clears RTK's
  // middleware subscriptions. Both occur after the previous tree is removed.
  return transitionSession(() => {
    // A different tab may write while this handoff waits for React cleanup,
    // even before its storage notification is delivered. Do not delete it.
    if (localStorage.getItem('token') !== expectedCredential) {
      adoptCurrentCredential(dispatch);
      return;
    }
    if (expectedCredential !== null) localStorage.removeItem('token');
    acknowledgeCredential();
    resetSessionState(dispatch);
  });
};

export const completeLogin = (token: string, expectedGeneration: number) => (dispatch: AppDispatch) => {
  if (checkCredentialChange() || !isCurrentSession(expectedGeneration)) return Promise.resolve(null);
  const expectedCredential = localStorage.getItem('token');
  let applied = false;
  return transitionSession(() => {
    if (localStorage.getItem('token') !== expectedCredential) {
      adoptCurrentCredential(dispatch);
      return;
    }
    resetSessionState(dispatch);
    localStorage.setItem('token', token);
    acknowledgeCredential();
    dispatch(setAuthenticated(true));
    applied = true;
  }).then((generation) => applied ? generation : null);
};
