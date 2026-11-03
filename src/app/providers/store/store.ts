import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootReducer';
import { baseApi } from 'shared/api/baseApi';

import { hydratePreferences, loadPreferences, preferencesMiddleware, clearAnalytics } from 'features/AnalyticsState/model/slice';

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(baseApi.middleware, preferencesMiddleware),
});

import { subscribeSession, getSessionSnapshot } from 'shared/api/sessionBoundary';
subscribeSession(() => { if (getSessionSnapshot().transitioning) store.dispatch(clearAnalytics()); });

store.dispatch(hydratePreferences(loadPreferences()));

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
