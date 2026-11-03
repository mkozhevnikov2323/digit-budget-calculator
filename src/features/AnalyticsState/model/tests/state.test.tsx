import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { fireEvent, render, screen } from '@testing-library/react';
import { VerifiedOwnerContext } from 'entities/User/model/useVerifiedOwner';
import { getSessionSnapshot } from 'shared/api/sessionBoundary';
import { AnalyticsPageContext, useAnalyticsState } from '../useAnalyticsState';
import {
  analyticsUIReducer,
  setValue,
  displayPreferences,
  loadPreferences,
  preferencesMiddleware,
  hydratePreferences,
  clearAnalytics,
} from '../slice';
import { currentSelection } from 'pages/AnalyticsPage/ui/selection';
const scope = 'a/1';
afterEach(() => localStorage.clear());
it('isolates page filters and serializes only whitelisted valid display settings', () => {
  const store = configureStore({
    reducer: { analyticsUI: analyticsUIReducer },
    middleware: (g) => g().concat(preferencesMiddleware),
  });
  const selection = { ...currentSelection('2025-09-01'), month: 9 };
  store.dispatch(
    setValue({
      scope,
      page: 'categories',
      field: 'selection',
      value: selection,
    }),
  );
  store.dispatch(
    setValue({
      scope,
      page: 'classification',
      field: 'selection',
      value: { ...selection, month: 10 },
    }),
  );
  for (const [field, value] of Object.entries({
    draft: { amount: 'private-financial-input' },
    imported: 'private-json',
    preparationId: 'private-context',
    confirmed: true,
    selectedOperation: 'private-id',
  }))
    store.dispatch(setValue({ scope, page: 'planning', field, value }));
  const saved = JSON.stringify(loadPreferences());
  expect(saved).not.toMatch(/private|confirmed|draft|preparationId/);
  expect(loadPreferences().categories?.selection).toEqual(selection);
  expect(loadPreferences().classification?.selection).toEqual({
    ...selection,
    month: 10,
  });
  const next = configureStore({ reducer: { analyticsUI: analyticsUIReducer } });
  next.dispatch(hydratePreferences(loadPreferences()));
  expect(next.getState().analyticsUI.pages.planning?.draft).toBeUndefined();
  expect(
    displayPreferences({
      overview: { selection: { ...selection, extra: 'secret' } },
    }),
  ).toEqual({ overview: {} });
  store.dispatch(clearAnalytics());
  expect(store.getState().analyticsUI.pages).toEqual({});
});
it('new owner or session cannot retain previous financial input', () => {
  let state = analyticsUIReducer(
    undefined,
    setValue({
      scope,
      page: 'planning',
      field: 'draft',
      value: { year: '2027', amount: 'private' },
    }),
  );
  state = analyticsUIReducer(
    state,
    setValue({
      scope: 'b/2',
      page: 'planning',
      field: 'planningOpen',
      value: true,
    }),
  );
  expect(state.pages.planning?.draft).toBeUndefined();
  expect(state.scope).toBe('b/2');
});
it('keeps invalid partial financial input on tab remount in Redux, without writing it to storage', () => {
  const store = configureStore({
    reducer: { analyticsUI: analyticsUIReducer },
    middleware: (g) => g().concat(preferencesMiddleware),
  });
  const generation = getSessionSnapshot().generation;
  const Input = () => {
    const [value, set] = useAnalyticsState('draft', '');
    return (
      <input
        aria-label="Amount"
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    );
  };
  const Tree = ({ page }: { page: 'planning' | 'categories' }) => (
    <Provider store={store}>
      <VerifiedOwnerContext.Provider
        value={{
          status: 'verified',
          owner: { userId: 'a'.repeat(24), sessionGeneration: generation },
        }}
      >
        <AnalyticsPageContext.Provider value={page}>
          {page === 'planning' ? <Input /> : <div>Categories</div>}
        </AnalyticsPageContext.Provider>
      </VerifiedOwnerContext.Provider>
    </Provider>
  );
  const view = render(<Tree page="planning" />);
  fireEvent.change(screen.getByLabelText('Amount'), {
    target: { value: '123,invalid' },
  });
  view.rerender(<Tree page="categories" />);
  view.rerender(<Tree page="planning" />);
  expect(screen.getByLabelText('Amount')).toHaveValue('123,invalid');
  expect(JSON.stringify(loadPreferences())).not.toContain('123,invalid');
});
