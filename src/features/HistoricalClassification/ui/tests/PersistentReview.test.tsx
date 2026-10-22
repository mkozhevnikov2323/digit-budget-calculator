import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { baseApi } from 'shared/api/baseApi';
import { PersistentReview } from '../PersistentReview';
import type { PreparedReview, ReviewRequest } from '../../api/manualClient';
const mockPrepare = jest.fn(), mockApply = jest.fn(), mockReconcile = jest.fn();
jest.mock('../../api/manualClient', () => ({ createManualClient: () => ({ prepare: mockPrepare, apply: mockApply, reconcile: mockReconcile }) }));
jest.mock('shared/api/baseApi', () => {
  const { createApi, fakeBaseQuery } = jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
  return { apiBaseUrl: 'https://fictional.invalid', baseApi: createApi({ reducerPath: 'persistentTest', baseQuery: fakeBaseQuery(),
    tagTypes: ['Expense', 'Income'], endpoints: () => ({}) }) };
});
const id = '1'.repeat(24);
const prepared = (request: ReviewRequest): PreparedReview => ({ request, reviewProof: 'synthetic-opaque-token', expiresAt: 4102444800,
  facts: { amount: { format: 'binary64-roundtrip-decimal', value: '12.340000000000002' }, dateEpochMs: 1736942400001,
    category: 'Транспорт', title: '<script>fictional</script>', recipient: 'Fictional recipient', comment: { kind: 'missing' } },
  currentDecision: { storedState: null, decisionRevision: null } });
const onSaved = jest.fn();
const show = () => {
  const store = configureStore({ reducer: { [baseApi.reducerPath]: baseApi.reducer }, middleware: get => get().concat(baseApi.middleware) });
  return render(<Provider store={store}><PersistentReview operation={{ dataset: 'expenses', operationId: id, kopecks: 1234,
    timestamp: 1736942400001, facts: { amount: 12.34, date: '2025-01-15T12:00:00.001Z' } }}
    scope={{ userId: 'a'.repeat(24), sessionGeneration: 1, requestScope: 'test' }}
    decision={{ version: 'classification-read-v1', dataset: 'expenses', operationId: id, status: 'unreviewed', storedState: null,
      decisionRevision: null, confirmed: null, consistency: 'observed_only_non_atomic' }} state="approved"
    assignment={{ economicRole: 'ordinary_expense', layer: 'everyday' }} onSaved={onSaved} /></Provider>);
};
beforeEach(() => {
  jest.clearAllMocks();
  if (!crypto.randomUUID) Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: () => '12345678-1234-4234-8234-123456789abc' });
  mockPrepare.mockImplementation(async (_dataset, _id, request) => ({ ok: true, value: prepared(request) }));
});
const prepare = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Подготовить серверную проверку' }));
  await screen.findByRole('heading', { name: 'Факты, проверенные сервером для этого решения' });
};
it('requires exact server facts and a separate final confirmation, escaping hostile-looking strings', async () => {
  show(); expect(mockPrepare).not.toHaveBeenCalled(); expect(mockApply.mock.calls.length).toBe(0); await prepare();
  const raw = screen.getByText(/12.340000000000002/); expect(raw).toHaveTextContent('<script>fictional</script>'); expect(raw.querySelector('script')).toBeNull();
  expect(raw).toHaveTextContent('2025-01-15T12:00:00.001Z'); expect(raw).toHaveTextContent('missing');
  expect(screen.getByRole('button', { name: 'Сохранить классификацию на сервере' })).toBeDisabled(); expect(mockApply.mock.calls.length).toBe(0);
});
it('prevents double-click while awaiting acknowledgement and invalidates only after confirmed persistence', async () => {
  let resolve!: (value: unknown) => void; mockApply.mockReturnValue(new Promise(done => { resolve = done; }));
  show(); await prepare(); fireEvent.click(screen.getByRole('checkbox')); const save = screen.getByRole('button', { name: 'Сохранить классификацию на сервере' });
  fireEvent.click(save); fireEvent.click(save); expect(mockApply).toHaveBeenCalledTimes(1); expect(onSaved).not.toHaveBeenCalled();
  resolve({ ok: true, value: 'applied' }); await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
});
it('keeps unknown writes blocked and reconciles explicitly without a new apply', async () => {
  mockApply.mockResolvedValue({ ok: false, code: 'unknown_outcome' }); mockReconcile.mockResolvedValue({ ok: true, value: 'indeterminate' });
  show(); await prepare(); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(screen.getByRole('button', { name: 'Сохранить классификацию на сервере' }));
  await screen.findByText(/Запись могла сохраниться/); expect(screen.getByRole('button', { name: 'Подготовить серверную проверку' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Проверить результат без записи' })); await screen.findByText(/Результат остаётся неопределённым/);
  expect(mockApply).toHaveBeenCalledTimes(1); expect(mockPrepare).toHaveBeenCalledTimes(1); expect(mockReconcile).toHaveBeenCalledTimes(1); expect(onSaved).not.toHaveBeenCalled();
});
it('preserves the chosen context after a conflict without claiming success', async () => {
  mockApply.mockResolvedValue({ ok: false, code: 'conflict' }); show(); await prepare(); fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить классификацию на сервере' })); await screen.findByText(/выбор сохранён/);
  expect(screen.getByText(/Новое решение: approved/)).toBeInTheDocument(); expect(onSaved).not.toHaveBeenCalled();
});
it('discards proof on page restoration and never resumes an apply automatically', async () => {
  show(); await prepare(); fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }));
  await screen.findByText(/После возврата на страницу/); expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(mockApply.mock.calls.length).toBe(0);
});
it('suppresses late responses after component unmount', async () => {
  let resolve!: (value: unknown) => void; mockPrepare.mockImplementation((_d, _i, request) => new Promise(done => { resolve = value => done({ ok: true, value: prepared(request), ...value as object }); }));
  const view = show(); fireEvent.click(screen.getByRole('button', { name: 'Подготовить серверную проверку' })); view.unmount(); resolve({});
  await Promise.resolve(); expect(mockApply.mock.calls.length).toBe(0); expect(onSaved).not.toHaveBeenCalled();
});
it('purges proof state and blocks new writes when the server retires authentication', async () => {
  mockApply.mockResolvedValue({ ok: false, code: 'session_changed' }); show(); await prepare(); fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить классификацию на сервере' }));
  await screen.findByText(/Текущая проверка закрыта; исход прежнего сохранения/);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Подготовить серверную проверку' })).toBeDisabled();
  expect(onSaved).not.toHaveBeenCalled(); expect(mockApply).toHaveBeenCalledTimes(1);
});
