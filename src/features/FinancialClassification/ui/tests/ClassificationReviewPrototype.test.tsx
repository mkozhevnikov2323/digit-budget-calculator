import { Profiler, StrictMode } from 'react';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import type { CheckedOperationSnapshot, ReviewedDecision } from '../../model/types';
import { PROVISIONAL_TAXONOMY_VERSION } from '../../model/types';
import { ClassificationReviewPrototype, ClassificationReviewPrototypeDemo, type ClassificationReviewPrototypeProps } from '../ClassificationReviewPrototype';
import { createSyntheticReviewExamples } from '../syntheticReviewExamples';

type Expense = Extract<CheckedOperationSnapshot, { dataset: 'expenses' }>;
const sharedId = 'synthetic-shared-id';
const theme = createTheme({ components: { MuiButtonBase: { defaultProps: { disableRipple: true } } } });
const tree = (props: ClassificationReviewPrototypeProps) => <ThemeProvider theme={theme}><ClassificationReviewPrototype {...props} /></ThemeProvider>;
const card = (kind = 'Расход', id = sharedId) => within(screen.getByRole('article', { name: `${kind} · ${id}` }));
const click = async (name: string, kind = 'Расход', id = sharedId) => {
  const user = userEvent.setup();
  await user.click(card(kind, id).getByRole('button', { name }));
};
const choose = async (selection = 'irregular', kind = 'Расход') => {
  const user = userEvent.setup();
  await click('Выбрать вручную', kind);
  await user.selectOptions(card(kind).getByRole('combobox', { name: 'Классификация вручную' }), selection);
  await click('Применить только в демонстрации', kind);
};
const withExpense = (props: ClassificationReviewPrototypeProps, change: (operation: Expense) => Expense): ClassificationReviewPrototypeProps => ({
  ...props, snapshots: { ...props.snapshots, expenses: props.snapshots.expenses.map((operation) =>
    operation.transactionId === sharedId ? change(operation) : operation) },
});
const review = (data: ClassificationReviewPrototypeProps, id: string, layer: 'everyday' | 'irregular'): ReviewedDecision => ({
  id, revision: 'synthetic-diagnostic-review', taxonomyVersion: PROVISIONAL_TAXONOMY_VERSION,
  reviewerScope: data.ownerScope, operation: data.snapshots.expenses[0], state: 'approved',
  assignment: { economicRole: 'ordinary_expense', layer }, provenance: { kind: 'manual' },
});
const frozen = <T,>(data: T): T => {
  if (data && typeof data === 'object') { Object.values(data).forEach(frozen); Object.freeze(data); }
  return data;
};

describe('synthetic in-memory classification review with real adapter/resolver', () => {
  let guards: jest.SpyInstance[];
  let indexedDBDescriptor: PropertyDescriptor | undefined;
  let indexedOpen: jest.Mock;
  let indexedDelete: jest.Mock;
  beforeEach(() => {
    const forbidden = () => { throw new Error('Network and storage are forbidden in synthetic review'); };
    guards = [jest.spyOn(globalThis, 'fetch').mockImplementation(forbidden),
      jest.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(forbidden),
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(forbidden),
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(forbidden),
      jest.spyOn(Storage.prototype, 'removeItem').mockImplementation(forbidden),
      jest.spyOn(Storage.prototype, 'clear').mockImplementation(forbidden),
      jest.spyOn(Storage.prototype, 'key').mockImplementation(forbidden),
      jest.spyOn(console, 'error'), jest.spyOn(console, 'log')];
    indexedDBDescriptor = Object.getOwnPropertyDescriptor(window, 'indexedDB');
    indexedOpen = jest.fn(forbidden); indexedDelete = jest.fn(forbidden);
    Object.defineProperty(window, 'indexedDB', { configurable: true,
      value: { open: indexedOpen, deleteDatabase: indexedDelete } });
  });
  afterEach(() => {
    cleanup();
    try {
      guards.forEach((guard) => expect(guard).not.toHaveBeenCalled());
      expect(indexedOpen).not.toHaveBeenCalled(); expect(indexedDelete).not.toHaveBeenCalled();
    } finally {
      jest.restoreAllMocks();
      if (indexedDBDescriptor) Object.defineProperty(window, 'indexedDB', indexedDBDescriptor);
      else Reflect.deleteProperty(window, 'indexedDB');
    }
  });

  it('renders adapter-checked fictional records without Redux, router or auth providers', () => {
    render(<ClassificationReviewPrototypeDemo />);
    expect(screen.getByRole('region', { name: 'Экспериментальный review классификации' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
    expect(card().getByText('Сумма записи: 123,45 ₽')).toBeInTheDocument();
    expect(card('Поступление').getByText(/Исходный источник: «Вымышленный источник Бета»/)).toBeInTheDocument();
    expect(card().getByText(/Исходная категория: «Вымышленная категория Альфа»/)).toBeInTheDocument();
    expect(screen.getByText(/Все записи синтетические.*Решения существуют только в памяти/)).toHaveTextContent('Ничего не сохраняется на сервере');
    expect(screen.getByText(/Все записи синтетические/)).toHaveTextContent('Классификация не резервирует и не переводит деньги');
    expect(screen.queryByText(/сохранено успешно|saved/i)).not.toBeInTheDocument();
    expect(card('Расход', 'synthetic-unclassified').getByText(/Не классифицировано/)).toBeInTheDocument();
    expect(card('Расход', 'synthetic-unclassified').queryByText(/Проверенная роль/)).not.toBeInTheDocument();
  });

  it('does not accept a proposal on render, rerender or StrictMode arrival; explicit click creates the decision', async () => {
    const data = createSyntheticReviewExamples();
    const view = render(<StrictMode>{tree(data)}</StrictMode>);
    view.rerender(<StrictMode>{tree({ ...data })}</StrictMode>);
    expect(card().getByText('Предложение — ожидает явной проверки')).toBeInTheDocument();
    expect(card().queryByText(/Локально проверено/)).not.toBeInTheDocument();
    await click('Принять предложение');
    expect(card().getByText('Локально проверено (только демонстрация)')).toBeInTheDocument();
    expect(card().getByText('Проверенный слой (предварительный): Повседневные расходы')).toBeInTheDocument();
    expect(card().getByRole('status')).toHaveTextContent('Решение применено только в демонстрации');
    expect(card().queryByRole('button', { name: 'Принять предложение' })).not.toBeInTheDocument();
  });

  it('allows an explicit manual alternative, cancellation and replacement of an earlier local decision', async () => {
    render(tree(createSyntheticReviewExamples()));
    await click('Выбрать вручную');
    expect(card().getByRole('button', { name: 'Применить только в демонстрации' })).toBeDisabled();
    await userEvent.setup().selectOptions(card().getByRole('combobox'), 'irregular');
    await click('Отменить выбор');
    expect(card().getByText(/Предложение —/)).toBeInTheDocument();
    expect(card().queryByText(/Локально проверено/)).not.toBeInTheDocument();
    await choose('irregular');
    expect(card().getByText('Проверенный слой (предварительный): Нерегулярные обязательства')).toBeInTheDocument();
    await click('Выбрать вручную');
    await userEvent.setup().selectOptions(card().getByRole('combobox'), 'emergency');
    await click('Отменить выбор');
    expect(card().getByText(/Проверенный слой.*Нерегулярные обязательства/)).toBeInTheDocument();
    await choose('major_goals');
    expect(card().getByText(/Проверенный слой.*Крупные цели/)).toBeInTheDocument();
  });

  it('explicit unclassified blocks later suggestions until reset', async () => {
    const data = createSyntheticReviewExamples();
    const view = render(tree(data));
    await click('Оставить без классификации');
    const changed = { ...data, suggestions: data.suggestions.map((rule) => ({ ...rule,
      assignment: { economicRole: 'ordinary_expense' as const, layer: 'emergency' as const } })) };
    view.rerender(tree(changed));
    expect(card().getByText(/Явно оставлено без классификации/)).toBeInTheDocument();
    expect(card().queryByText(/Предлагаемый слой/)).not.toBeInTheDocument();
    await click('Сбросить временное решение');
    expect(card().getByText(/Предлагаемый слой.*Чрезвычайный резерв/)).toBeInTheDocument();
  });

  it('reset restores proposed or unclassified state instead of restoring an earlier approval', async () => {
    render(tree(createSyntheticReviewExamples()));
    await click('Принять предложение'); await click('Сбросить временное решение');
    expect(card().getByText(/Предложение —/)).toBeInTheDocument();
    await click('Оставить без классификации', 'Расход', 'synthetic-unclassified');
    await click('Сбросить временное решение', 'Расход', 'synthetic-unclassified');
    expect(card('Расход', 'synthetic-unclassified').getByText(/Не классифицировано/)).toBeInTheDocument();
  });

  it.each(['everyday', 'irregular', 'emergency', 'major_goals', 'long_term_capital'])('supports explicit ordinary expense layer %s', async (layer) => {
    render(tree(createSyntheticReviewExamples()));
    await choose(layer);
    expect(card().getByText('Проверенная роль: Обычный расход')).toBeInTheDocument();
    expect(card().getByText(/Проверенный слой/)).toHaveTextContent(/Повседневные|Нерегулярные|Чрезвычайный|Крупные|Долгосрочный/);
  });

  it.each([
    ['Расход', 'loan_issuance', 'Выдача займа'], ['Расход', 'internal_transfer', 'Внутренний перевод'],
    ['Расход', 'capital_movement', 'Движение капитала'], ['Поступление', 'ordinary_income', 'Обычное поступление'],
    ['Поступление', 'loan_repayment', 'Возврат займа'], ['Поступление', 'refund', 'Возврат покупки'],
  ])('keeps reviewed %s/%s outside spending layers', async (kind, role, label) => {
    render(tree(createSyntheticReviewExamples()));
    await choose(role, kind);
    expect(card(kind).getByText(`Проверенная роль: ${label}`)).toBeInTheDocument();
    expect(card(kind).getByText(/Слой обычных расходов не назначается/)).toBeInTheDocument();
    expect(card(kind).queryByText(/Проверенный слой/)).not.toBeInTheDocument();
  });

  it('does not infer a loan from a category label and limits manual options to the dataset', async () => {
    render(tree(createSyntheticReviewExamples()));
    expect(card('Расход', 'synthetic-unclassified').getByText(/Исходная категория: «Выдача займа»/)).toBeInTheDocument();
    expect(card('Расход', 'synthetic-unclassified').getByText(/Экономическая роль не определена/)).toBeInTheDocument();
    await click('Выбрать вручную', 'Поступление');
    expect(card('Поступление').queryByRole('option', { name: /Обычный расход/ })).not.toBeInTheDocument();
    expect(card('Поступление').queryByRole('option', { name: 'Выдача займа' })).not.toBeInTheDocument();
  });

  it('separates income/expense with identical IDs, including removal and dataset changes', async () => {
    const data = createSyntheticReviewExamples();
    const view = render(tree(data));
    await click('Принять предложение');
    expect(card('Поступление').getByText(/Не классифицировано/)).toBeInTheDocument();
    view.rerender(tree({ ...data, snapshots: { ...data.snapshots, expenses: [] } }));
    expect(card('Поступление').queryByText(/Локально проверено/)).not.toBeInTheDocument();
    view.rerender(tree(data));
    expect(card().getByText(/Предложение —/)).toBeInTheDocument();
  });

  it.each(['owner', 'session'])('clears decisions in every committed frame on %s change and never restores them', async (change) => {
    const data = createSyntheticReviewExamples();
    const commits: string[] = [];
    const observed = (props: ClassificationReviewPrototypeProps) => <Profiler id="session-boundary"
      onRender={() => commits.push(document.body.textContent ?? '')}>{tree(props)}</Profiler>;
    const view = render(observed(data));
    await choose('irregular');
    commits.length = 0;
    const next = createSyntheticReviewExamples(change === 'owner' ? 'synthetic-owner-b' : data.ownerScope,
      change === 'session' ? 'synthetic-session-b' : data.sessionId);
    view.rerender(observed(next));
    expect(commits.length).toBeGreaterThan(0);
    for (const text of commits) expect(text).not.toMatch(/Локально проверено|Проверенный слой|Решение применено только/);
    expect(card().getByText(/Предложение —/)).toBeInTheDocument();
    view.rerender(observed(data));
    expect(card().getByText(/Предложение —/)).toBeInTheDocument();
    expect(card().queryByRole('button', { name: 'Сбросить временное решение' })).not.toBeInTheDocument();
  });

  it('clears state through invalid session input and does not expose decisions for an unmatched owner', async () => {
    const data = createSyntheticReviewExamples();
    const view = render(tree(data)); await choose();
    view.rerender(tree({ ...data, ownerScope: 'synthetic-other-owner' }));
    expect(screen.queryByText(/Локально проверено|Проверенный слой/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Область владельца не совпадает/).length).toBeGreaterThan(0);
    view.rerender(tree({ ...data, sessionId: '' }));
    expect(screen.getByText(/Некорректная синтетическая сессия/)).toBeInTheDocument();
    view.rerender(tree(data)); expect(card().getByText(/Предложение —/)).toBeInTheDocument();
  });

  it.each<[string, (operation: Expense) => Expense]>([
    ['revision', (operation) => ({ ...operation, revision: 'synthetic-facts-v2' })],
    ['amount', (operation) => ({ ...operation, facts: { ...operation.facts, kopecks: 12346 } })],
    ['date', (operation) => ({ ...operation, facts: { ...operation.facts, timestamp: 1833883200000 } })],
    ['category', (operation) => ({ ...operation, facts: { ...operation.facts,
      category: { kind: 'label', value: 'Вымышленная новая категория', dictionaryStatus: 'unresolved' } } })],
  ])('blocks a stale approval after changed %s and requires reset even if facts revert', async (_name, change) => {
    const data = createSyntheticReviewExamples();
    const view = render(tree(data)); await click('Принять предложение');
    view.rerender(tree(withExpense(data, change)));
    expect(card().getByText(/Решение устарело/)).toBeInTheDocument();
    expect(card().queryByText(/Локально проверено|Проверенный слой/)).not.toBeInTheDocument();
    expect(card().queryByRole('button', { name: 'Выбрать вручную' })).not.toBeInTheDocument();
    view.rerender(tree(data)); expect(card().getByText(/Решение устарело/)).toBeInTheDocument();
    await click('Сбросить временное решение');
    expect(card().getByText(/Предложение —/)).toBeInTheDocument();
    await click('Принять предложение'); expect(card().getByText(/Локально проверено/)).toBeInTheDocument();
  });

  it('discards a pending manual selection when the checked snapshot changes', async () => {
    const data = createSyntheticReviewExamples();
    const view = render(tree(data)); await click('Выбрать вручную');
    await userEvent.setup().selectOptions(card().getByRole('combobox'), 'irregular');
    view.rerender(tree(withExpense(data, (operation) => ({ ...operation, revision: 'synthetic-facts-v2' }))));
    expect(card().getByRole('button', { name: 'Применить только в демонстрации' })).toBeDisabled();
  });

  it('shows conflicts instead of choosing a rule or reviewed decision by ordering', async () => {
    const data = createSyntheticReviewExamples();
    const conflicting = { ...data, suggestions: [...data.suggestions, { ...data.suggestions[0], id: 'synthetic-rule-b',
      assignment: { economicRole: 'ordinary_expense' as const, layer: 'irregular' as const } }] };
    const view = render(tree(conflicting));
    expect(card().getByText(/Подсказки противоречат/)).toBeInTheDocument();
    expect(card().queryByRole('button', { name: 'Принять предложение' })).not.toBeInTheDocument();
    view.rerender(tree(data)); await click('Принять предложение');
    view.rerender(tree({ ...data, diagnosticDecisions: [review(data, 'synthetic-other-review', 'irregular')] }));
    expect(card().getByText(/Проверенные решения противоречат/)).toBeInTheDocument();
    expect(card().queryByText(/Локально проверено|Проверенный слой/)).not.toBeInTheDocument();
  });

  it('shows externally supplied conflicting diagnostic decisions without creating a local draft', () => {
    const data = createSyntheticReviewExamples();
    render(tree({ ...data, diagnosticDecisions: [review(data, 'synthetic-review-a', 'everyday'), review(data, 'synthetic-review-b', 'irregular')] }));
    expect(card().getByText(/Проверенные решения противоречат/)).toBeInTheDocument();
    expect(card().queryByRole('button', { name: 'Сбросить временное решение' })).not.toBeInTheDocument();
  });

  it('fails closed for foreign diagnostic evidence and unsupported taxonomy without record dumps', () => {
    const data = createSyntheticReviewExamples();
    const view = render(tree({ ...data, diagnosticDecisions: [{ ...review(data, 'synthetic-private-review', 'irregular'), reviewerScope: 'synthetic-foreign-owner' }] }));
    expect(card().getByText(/Область владельца не совпадает/)).toBeInTheDocument();
    expect(screen.queryByText(/synthetic-private-review|synthetic-foreign-owner/)).not.toBeInTheDocument();
    view.rerender(tree({ ...data, taxonomyVersion: 'synthetic-unsupported' }));
    expect(card().getByText(/версия таксономии не поддерживается/)).toBeInTheDocument();
    expect(card().queryByRole('button', { name: 'Выбрать вручную' })).not.toBeInTheDocument();
  });

  it('handles empty, malformed and duplicate synthetic inputs safely', () => {
    const data = createSyntheticReviewExamples();
    const view = render(tree({ ...data, snapshots: { ...data.snapshots, expenses: [], incomes: [] } }));
    expect(screen.getByText('Синтетических операций нет.')).toBeInTheDocument();
    view.rerender(tree(withExpense(data, (operation) => ({ ...operation, revision: '' }))));
    expect(screen.getByText(/Некорректный снимок операции/)).toBeInTheDocument();
    view.rerender(tree({ ...data, snapshots: { ...data.snapshots, expenses: [data.snapshots.expenses[0], data.snapshots.expenses[0]] } }));
    expect(screen.getByText(/Некорректный снимок операции/)).toBeInTheDocument();
  });

  it('blocks malformed evidence after a click and drops drafts through a foreign source batch', async () => {
    const data = createSyntheticReviewExamples();
    const view = render(tree(data)); await click('Принять предложение');
    // Deliberate runtime corruption; no unsafe financial record is constructed.
    const malformed = { ...data, diagnosticDecisions: null } as unknown as ClassificationReviewPrototypeProps;
    view.rerender(tree(malformed));
    expect(card().getByText(/Некорректное проверенное решение/)).toBeInTheDocument();
    expect(card().queryByText(/Локально проверено/)).not.toBeInTheDocument();
    const other = createSyntheticReviewExamples('synthetic-foreign-source', data.sessionId);
    view.rerender(tree({ ...data, snapshots: other.snapshots }));
    expect(screen.getByText(/Область владельца не совпадает/)).toBeInTheDocument();
    view.rerender(tree(data)); expect(card().getByText(/Предложение —/)).toBeInTheDocument();
  });

  it('never renders invalid formatting as zero or as an approved classification', () => {
    const data = createSyntheticReviewExamples();
    render(tree(withExpense(data, (operation) => ({ ...operation, facts: { ...operation.facts, kopecks: NaN } }))));
    expect(card().getByText(/Сумму невозможно отобразить/)).toBeInTheDocument();
    expect(card().queryByText(/0,00 ₽|NaN|Локально проверено|Предложение —/)).not.toBeInTheDocument();
    expect(card().queryByRole('button')).not.toBeInTheDocument();
  });

  it('supports keyboard activation and labelled native manual selection', async () => {
    render(tree(createSyntheticReviewExamples()));
    const user = userEvent.setup();
    await user.tab();
    expect(card().getByRole('button', { name: 'Принять предложение' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(card().getByText(/Локально проверено/)).toBeInTheDocument();
    await user.tab();
    expect(card().getByRole('button', { name: 'Выбрать вручную' })).toHaveFocus();
    await user.keyboard('{Enter}');
    const select = card().getByRole('combobox', { name: 'Классификация вручную' });
    act(() => select.focus()); await user.selectOptions(select, 'irregular');
    await user.tab();
    expect(card().getByRole('button', { name: 'Применить только в демонстрации' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(card().getByText(/Проверенный слой.*Нерегулярные обязательства/)).toBeInTheDocument();
  });

  it('leaves deeply frozen source snapshots and evidence intact through review, cancellation and reset', async () => {
    const data = frozen(createSyntheticReviewExamples());
    const before = JSON.stringify(data);
    render(tree(data));
    await click('Принять предложение'); await choose();
    await click('Оставить без классификации'); await click('Сбросить временное решение');
    expect(JSON.stringify(data)).toBe(before);
    expect(card().getByText(/Предложение —/)).toBeInTheDocument();
  });
});
