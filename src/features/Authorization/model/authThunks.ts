import { AppDispatch } from 'app/providers/store/store';
import { resetUser } from 'entities/User';
import { setAuthenticated } from 'features/Authorization';

export const logout = () => (dispatch: AppDispatch) => {
  localStorage.removeItem('token');

  dispatch(resetUser());
  dispatch(setAuthenticated(false));
};
