import { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClassificationPreviewPage from '../ClassificationPreviewPage';
import { ClassificationReviewView, type ReviewPresentationState } from 'features/FinancialClassification/ui/ClassificationReviewView';
import { createSyntheticMonthReview } from '../../model/syntheticMonthReview';
import { monthPeriod } from 'features/FinancialAnalytics/model/period';

const expenseCard = () => within(screen.getByRole('article', { name: 'Расход 1' }));
const incomeCard = () => within(screen.getByRole('article', { name: 'Поступление 3' }));
const count = (name: string) => within(screen.getByRole('region', { name: 'Обзор классификации' })).getByText(name).nextElementSibling?.textContent;
const approve = async (choice = 'everyday', card = expenseCard()) => {
  const user = userEvent.setup(); await user.click(card.getByRole('button', { name: 'Выбрать классификацию' }));
  await user.selectOptions(card.getByRole('combobox', { name: 'Ручная классификация' }), choice);
  await user.click(card.getByRole('button', { name: 'Применить' }));
};
const selectMonth = async (month: string) => {
  const user = userEvent.setup(); await user.selectOptions(screen.getByRole('combobox', { name: 'Месяц' }), month);
  await user.click(screen.getByRole('button', { name: 'Показать месяц' }));
};
const stateExample = async (value: string) => {
  const user = userEvent.setup(); const details = screen.getByText('Примеры состояний интерфейса');
  if (!details.parentElement?.hasAttribute('open')) await user.click(details);
  await user.selectOptions(screen.getByRole('combobox', { name: 'Состояние демонстрации' }), value);
};

describe('fictional visual review using real transitions and resolver', () => {
  let guards: jest.SpyInstance[];
  let descriptor: PropertyDescriptor | undefined;
  let indexedOpen: jest.Mock;
  let indexedDelete: jest.Mock;
  let originalFormData: typeof FormData;
  beforeEach(() => {
    // jest-fixed-jsdom replaces browser FormData with Node's implementation,
    // which rejects HTMLFormElement. React 19 constructs FormData(form) for
    // transition submissions. Keep the actual DOM implementation in this suite.
    originalFormData = globalThis.FormData;
    const realm = document.createElement('iframe'); document.body.appendChild(realm);
    if (!realm.contentWindow) throw new Error('Missing DOM test realm');
    globalThis.FormData = (realm.contentWindow as Window & typeof globalThis).FormData;
    realm.remove();
    const forbidden = () => { throw new Error('Network/credentials/persistence forbidden in fictional review'); };
    guards = [jest.spyOn(globalThis, 'fetch').mockImplementation(forbidden),
      jest.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(forbidden),
      ...(['getItem','setItem','removeItem','clear','key'] as const).map((name) => jest.spyOn(Storage.prototype, name).mockImplementation(forbidden)),
      jest.spyOn(document, 'cookie', 'set').mockImplementation(forbidden), jest.spyOn(console, 'error'), jest.spyOn(console, 'log')];
    indexedOpen = jest.fn(forbidden); indexedDelete = jest.fn(forbidden);
    descriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB');
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open: indexedOpen, deleteDatabase: indexedDelete } });
  });
  afterEach(() => {
    cleanup();
    try { guards.forEach((guard) => expect(guard).not.toHaveBeenCalled()); expect(indexedOpen).not.toHaveBeenCalled(); expect(indexedDelete).not.toHaveBeenCalled(); }
    finally {
      jest.restoreAllMocks();
      globalThis.FormData = originalFormData;
      if (descriptor) Object.defineProperty(window, 'indexedDB', descriptor); else Reflect.deleteProperty(window, 'indexedDB');
    }
  });
  it('renders three fictional records, UTC dates, existing money formatting and clear temporary restrictions', () => {
    render(<ClassificationPreviewPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Классификация операций' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3); expect(screen.getAllByText('Не проверено')).toHaveLength(3);
    expect(screen.getByText('123,45 ₽')).toBeInTheDocument(); expect(screen.getByText('0,01 ₽')).toBeInTheDocument();
    expect(screen.getByText('678,90 ₽')).toBeInTheDocument(); expect(screen.getByText('Вымышленная категория Альфа')).toBeInTheDocument();
    expect(screen.getByText('Вымышленный источник Бета')).toBeInTheDocument(); expect(screen.getByText(/Обновление страницы, смена месяца/)).toBeInTheDocument();
    expect(screen.getByText('2028-02-01 — 2028-02-29 · UTC')).toBeInTheDocument();
    expect(count('Всего операций')).toBe('3'); expect(count('Ожидают классификации')).toBe('3'); expect(count('Подтверждены вручную')).toBe('0');
    expect(screen.queryByRole('button', { name: /сохранить/i })).not.toBeInTheDocument();
  });
  it('selection alone never applies; cancel preserves unclassified state', async () => {
    render(<ClassificationPreviewPage />); const card = expenseCard(); const user = userEvent.setup();
    await user.click(card.getByRole('button', { name: 'Выбрать классификацию' }));
    expect(card.getByRole('button', { name: 'Применить' })).toBeDisabled();
    await user.selectOptions(card.getByRole('combobox', { name: 'Ручная классификация' }), 'emergency');
    expect(card.getByText('Не проверено')).toBeInTheDocument(); expect(count('Подтверждены вручную')).toBe('0');
    await user.click(card.getByRole('button', { name: 'Отмена' }));
    expect(card.queryByRole('combobox')).not.toBeInTheDocument(); expect(card.getByText('Не проверено')).toBeInTheDocument();
  });
  it.each(['everyday','irregular','emergency','major_goals','long_term_capital'])('explicit Apply accepts supported spending layer %s', async (choice) => {
    render(<ClassificationPreviewPage />); await approve(choice);
    expect(expenseCard().getByText('Подтверждено вручную')).toBeInTheDocument(); expect(count('Подтверждены вручную')).toBe('1');
    expect(count('Ожидают классификации')).toBe('2'); expect(screen.getByRole('status')).toHaveTextContent('Решение применено временно');
  });
  it.each(['loan_issuance','internal_transfer','capital_movement'])('non-spending expense role %s has no spending layer', async (choice) => {
    render(<ClassificationPreviewPage />); await approve(choice);
    expect(expenseCard().getByText('Слой расходов не назначается')).toBeInTheDocument();
    expect(expenseCard().queryByText(/Предварительный слой:/)).not.toBeInTheDocument();
  });
  it('income offers compatible roles only, without spending layers or loan issuance', async () => {
    render(<ClassificationPreviewPage />); const card = incomeCard(); const user = userEvent.setup();
    await user.click(card.getByRole('button', { name: 'Выбрать классификацию' }));
    const options = card.getAllByRole('option').map((option) => option.getAttribute('value'));
    expect(options).toEqual(['','ordinary_income','loan_repayment','refund','internal_transfer','capital_movement']);
    await user.selectOptions(card.getByRole('combobox'), 'loan_repayment'); await user.click(card.getByRole('button', { name: 'Применить' }));
    expect(card.getByText('Роль: Возврат займа')).toBeInTheDocument(); expect(card.getByText('Слой расходов не назначается')).toBeInTheDocument();
    expect(expenseCard().getByText('Не проверено')).toBeInTheDocument();
  });
  it('expense offers no ordinary income, refund or repayment; category text creates no inference', async () => {
    render(<ClassificationPreviewPage />); const card = expenseCard(); const user = userEvent.setup();
    expect(within(screen.getByRole('article', { name: 'Расход 2' })).getByText('Не проверено')).toBeInTheDocument();
    await user.click(card.getByRole('button', { name: 'Выбрать классификацию' }));
    const values = card.getAllByRole('option').map((option) => option.getAttribute('value'));
    expect(values).not.toContain('ordinary_income'); expect(values).not.toContain('refund'); expect(values).not.toContain('loan_repayment');
  });
  it('explicit-unclassified is distinct; reset changes only its target and updates counts', async () => {
    render(<ClassificationPreviewPage />); await approve(); const user = userEvent.setup(); const card = incomeCard();
    await user.click(card.getByRole('button', { name: 'Оставить без классификации' }));
    expect(card.getByText('Оставлено без классификации')).toBeInTheDocument(); expect(count('Явно без классификации')).toBe('1');
    expect(count('Ожидают классификации')).toBe('1');
    await user.click(card.getByRole('button', { name: 'Сбросить решение' }));
    expect(card.getByText('Не проверено')).toBeInTheDocument(); expect(count('Явно без классификации')).toBe('0');
    expect(expenseCard().getByText('Подтверждено вручную')).toBeInTheDocument(); expect(count('Подтверждены вручную')).toBe('1');
  });
  it('month switch confirms draft loss; cancelling preserves current decisions and month', async () => {
    render(<ClassificationPreviewPage />); await approve(); await selectMonth('3'); const user = userEvent.setup();
    expect(screen.getByRole('dialog', { name: 'Сменить месяц?' })).toHaveTextContent('Временные решения текущего месяца будут удалены');
    await user.click(screen.getByRole('button', { name: 'Остаться в текущем месяце' }));
    expect(screen.getByText('2028-02-01 — 2028-02-29 · UTC')).toBeInTheDocument(); await waitFor(() => expect(count('Подтверждены вручную')).toBe('1'));
    expect(screen.getByRole('combobox', { name:'Месяц' })).toHaveValue('2');
    await selectMonth('3');
    await user.click(screen.getByRole('button', { name: 'Сменить и сбросить' }));
    expect(screen.getByText('2028-03-01 — 2028-03-31 · UTC')).toBeInTheDocument(); expect(count('Подтверждены вручную')).toBe('0');
    await selectMonth('2'); expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(count('Ожидают классификации')).toBe('3');
  });
  it('reset preview and unmount/remount create clean sessions without automatic approvals', async () => {
    const view = render(<StrictMode><ClassificationPreviewPage /></StrictMode>); await approve();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Сбросить все решения' }));
    expect(count('Ожидают классификации')).toBe('3'); await approve(); view.unmount();
    const again = render(<StrictMode><ClassificationPreviewPage /></StrictMode>); again.rerender(<StrictMode><ClassificationPreviewPage /></StrictMode>);
    expect(screen.getAllByText('Не проверено')).toHaveLength(3); expect(count('Подтверждены вручную')).toBe('0');
  });
  it('invalid year hides records and returning to a valid month creates no decisions', async () => {
    render(<ClassificationPreviewPage />); const user = userEvent.setup();
    await user.clear(screen.getByRole('spinbutton', { name: 'Год' })); await user.type(screen.getByRole('spinbutton', { name: 'Год' }), '0');
    await user.click(screen.getByRole('button', { name: 'Показать месяц' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Укажите корректные месяц и год'); expect(screen.queryByRole('article')).not.toBeInTheDocument();
  });
  it.each(['loading','fetching','empty','invalid_period','verification_required','error'] as const)('controlled %s state hides all old cards; returning is clean', async (state) => {
    render(<ClassificationPreviewPage />); await approve(); await stateExample(state);
    expect(screen.queryByRole('article')).not.toBeInTheDocument(); expect(screen.queryByRole('region', { name: 'Обзор классификации' })).not.toBeInTheDocument();
    await stateExample('ready'); expect(count('Ожидают классификации')).toBe('3');
  });
  it('presentation states fail closed even if a future caller supplies stale ready entries', () => {
    const period = monthPeriod(2028,2); if (!period.ok) throw new Error('Fixture');
    const state = createSyntheticMonthReview(period.value); if (!state.ok) throw new Error('Fixture');
    const view = render(<ClassificationReviewView status="ready" entries={state.state.entries} onAction={() => {}} />);
    for (const status of ['loading','fetching','empty','invalid_period','verification_required','error'] satisfies ReviewPresentationState[]) {
      view.rerender(<ClassificationReviewView status={status} entries={state.state.entries} onAction={() => {}} />);
      expect(screen.queryByRole('article')).not.toBeInTheDocument();
    }
  });
  it('invalid money is explicit and disables actions; never substitutes a formatted zero', () => {
    const period = monthPeriod(2028,2); if (!period.ok) throw new Error('Fixture');
    const state = createSyntheticMonthReview(period.value); if (!state.ok) throw new Error('Fixture');
    const first = state.state.entries[0]; const operation = first.operation;
    if (operation.dataset !== 'expenses') throw new Error('Fixture');
    const invalid = { ...first, operation: { ...operation, facts: { ...operation.facts, kopecks: NaN } } };
    render(<ClassificationReviewView status="ready" entries={[invalid]} onAction={() => {}} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Сумма недоступна'); expect(screen.queryByText('0,00 ₽')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Выбрать классификацию' })).toBeDisabled();
  });
  it('keyboard can open, select, explicitly apply and cancel; pending controls are disabled', async () => {
    render(<ClassificationPreviewPage />); const user = userEvent.setup(); const button = expenseCard().getByRole('button', { name: 'Выбрать классификацию' });
    act(() => button.focus()); await user.keyboard('{Enter}');
    const select = expenseCard().getByRole('combobox', { name: 'Ручная классификация' });
    act(() => select.focus()); expect(select).toHaveFocus(); await user.selectOptions(select,'everyday');
    await user.tab(); expect(expenseCard().getByRole('button', { name: 'Применить' })).toHaveFocus();
    await user.keyboard('{Enter}'); expect(expenseCard().getByText('Подтверждено вручную')).toBeInTheDocument();
  });
  it('pending presentation disables every review button and form selector', async () => {
    const period = monthPeriod(2028,2); if (!period.ok) throw new Error('Fixture');
    const state = createSyntheticMonthReview(period.value); if (!state.ok) throw new Error('Fixture');
    const view = render(<ClassificationReviewView status="ready" entries={state.state.entries} onAction={() => {}} />);
    await userEvent.setup().click(expenseCard().getByRole('button', { name: 'Выбрать классификацию' }));
    view.rerender(<ClassificationReviewView status="ready" entries={state.state.entries} pending onAction={() => {}} />);
    screen.getAllByRole('button').forEach((button) => expect(button).toBeDisabled()); expect(expenseCard().getByRole('combobox')).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Применение временного решения');
  });
});
