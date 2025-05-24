import { AppDispatch } from 'app/providers/store/store';
import { baseApi } from 'shared/api/baseApi';

export const logout = () => (dispatch: AppDispatch) => {
  localStorage.removeItem('token');
  dispatch({ type: 'LOGOUT' });
  dispatch(baseApi.util.resetApiState());
};
