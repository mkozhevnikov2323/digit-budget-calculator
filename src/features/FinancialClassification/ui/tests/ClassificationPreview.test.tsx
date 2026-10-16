import { StrictMode } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import * as money from '../../../FinancialAnalytics/model/money';
import { FINANCIAL_LAYERS, type ClassificationAssignment, type ReviewedDecision } from '../../model/types';
import { ClassificationPreview, ClassificationPreviewDemo } from '../ClassificationPreview';
import { createSyntheticClassificationExamples, type SyntheticClassificationExample } from '../syntheticExamples';

const example = (title: string): SyntheticClassificationExample => {
  const found = createSyntheticClassificationExamples().find((item) => item.title === title);
  if (!found) throw new Error('Missing synthetic example');
  return found;
};
const show = (data: SyntheticClassificationExample) => {
  render(<ClassificationPreview examples={[data]} />);
  return within(screen.getByRole('article', { name: data.title }));
};
const withAssignment = (assignment: ClassificationAssignment): SyntheticClassificationExample => {
  const data = example('Проверенный нерегулярный расход');
  const decision = data.input.decisions[0];
  const operation = assignment.economicRole === 'ordinary_income' || assignment.economicRole === 'loan_repayment' || assignment.economicRole === 'refund'
    ? example('Доход с общим ID').input.operation : data.input.operation;
  const reviewed: ReviewedDecision = { ...decision, operation, state: 'approved', assignment, provenance: { kind: 'manual' } };
  return { ...data, input: { ...data.input, operation, decisions: [reviewed] } };
};
const deepFreeze = <T,>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

// Real resolver and MUI throughout; no Redux, router or application providers.
describe('isolated synthetic ClassificationPreview', () => {
  let fetchSpy: jest.SpyInstance;
  let xhrSpy: jest.SpyInstance;
  let storageRead: jest.SpyInstance;
  let storageWrite: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  let consoleLog: jest.SpyInstance;
  beforeEach(() => {
    const forbidden = () => { throw new Error('Network/storage forbidden in synthetic preview'); };
    fetchSpy = jest.spyOn(globalThis, 'fetch').mockImplementation(forbidden);
    xhrSpy = jest.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation(forbidden);
    storageRead = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(forbidden);
    storageWrite = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(forbidden);
    consoleError = jest.spyOn(console, 'error');
    consoleLog = jest.spyOn(console, 'log');
  });
  afterEach(() => {
    cleanup();
    try {
      for (const spy of [fetchSpy, xhrSpy, storageRead, storageWrite, consoleError, consoleLog]) {
        expect(spy).not.toHaveBeenCalled();
      }
    } finally { jest.restoreAllMocks(); }
  });

  it('shows unclassified and unknown role without any assignment', () => {
    const card = show(example('Без назначения'));
    expect(card.getByText('Не классифицировано')).toBeInTheDocument();
    expect(card.getByText(/Экономическая роль не определена/)).toBeInTheDocument();
    expect(card.queryByText(/Подтверждённая классификация/)).not.toBeInTheDocument();
  });

  it('shows a category proposal awaiting review without a confirmed role or layer', () => {
    const card = show(example('Подсказка для повседневного расхода'));
    expect(card.getByText('Предложение — ожидает проверки')).toBeInTheDocument();
    expect(card.getByText(/Предлагаемый слой.*Повседневные расходы/)).toBeInTheDocument();
    expect(card.getByText(/точной исходной строке категории/)).toBeInTheDocument();
    expect(card.getByText(/Подтверждённой классификации нет/)).toBeInTheDocument();
    expect(card.queryByText(/Подтверждённая роль|Подтверждённый слой/)).not.toBeInTheDocument();
  });

  it('shows an explicit synthetic approval and its confirmed layer', () => {
    const card = show(example('Проверенный нерегулярный расход'));
    expect(card.getByText('Подтверждённая классификация (синтетическое решение)')).toBeInTheDocument();
    expect(card.getByText(/Подтверждённый слой.*Нерегулярные обязательства/)).toBeInTheDocument();
    expect(card.getByText('Подтверждённая роль: Обычный расход')).toBeInTheDocument();
    expect(card.queryByText(/Предлагаемый слой/)).not.toBeInTheDocument();
  });

  it('does not display a proposal blocked by an explicit unclassified decision', () => {
    const card = show(example('Явно оставить без классификации'));
    expect(card.getByText('Явно оставлено без классификации')).toBeInTheDocument();
    expect(card.getByText(/решение блокирует подсказки/)).toBeInTheDocument();
    expect(card.queryByText(/Повседневные расходы|Предложение —|Подтверждённая классификация/)).not.toBeInTheDocument();
  });

  it('shows approved loan issuance separately and suppresses its ordinary spending suggestion', () => {
    const card = show(example('Выдача займа'));
    expect(card.getByText('Подтверждённая роль: Выдача займа')).toBeInTheDocument();
    expect(card.getByText(/Слой обычных расходов не назначается/)).toBeInTheDocument();
    expect(card.queryByText(/Повседневные расходы|Подтверждённый слой|Предлагаемый слой|Обычный расход/)).not.toBeInTheDocument();
  });

  it.each([
    ['Конфликт подсказок', 'Подсказки противоречат друг другу. Предложение не определено.'],
    ['Конфликт проверенных решений', 'Проверенные решения противоречат друг другу. Классификация не определена.'],
    ['Решение до изменения суммы', 'Решение устарело: факты операции изменились. Нужна повторная проверка.'],
    ['Другая область владельца', 'Область владельца не совпадает. Классификация не показана.'],
    ['Несовпадение версии решения', 'Версия таксономии решения или подсказки не совпадает с запрошенной.'],
    ['Неподдерживаемая таксономия', 'Запрошенная версия таксономии не поддерживается.'],
  ])('explains %s without exposing an assignment or candidate records', (title, message) => {
    const card = show(example(title));
    expect(card.getByText('Ошибка классификации')).toBeInTheDocument();
    expect(card.getByText(message)).toBeInTheDocument();
    expect(card.queryByText(/Подтверждённая классификация|Предлагаемый слой|Нерегулярные обязательства/)).not.toBeInTheDocument();
    expect(card.queryByText(/synthetic-review|synthetic-other-owner|stack|ownerScope/)).not.toBeInTheDocument();
  });

  it('keeps the same transaction ID in expense/income collections separate', () => {
    const expense = example('Расход с общим ID');
    const income = example('Доход с общим ID');
    expect(expense.input.operation.transactionId).toBe(income.input.operation.transactionId);
    expect(expense.input.decisions).toEqual(income.input.decisions);
    render(<ClassificationPreview examples={[expense, income]} />);
    const expenseCard = within(screen.getByRole('article', { name: expense.title }));
    const incomeCard = within(screen.getByRole('article', { name: income.title }));
    expect(expenseCard.getByText(/Записанный расход/)).toBeInTheDocument();
    expect(expenseCard.getByText(/Подтверждённый слой.*Нерегулярные обязательства/)).toBeInTheDocument();
    expect(incomeCard.getByText(/Записанное поступление/)).toBeInTheDocument();
    expect(incomeCard.getByText('Не классифицировано')).toBeInTheDocument();
    expect(incomeCard.queryByText(/Подтверждённый слой/)).not.toBeInTheDocument();
  });

  it.each([
    ['everyday', 'Повседневные расходы'], ['irregular', 'Нерегулярные обязательства'],
    ['emergency', 'Чрезвычайный резерв'], ['major_goals', 'Крупные цели'],
    ['long_term_capital', 'Долгосрочный капитал'],
  ] as const)('provides a provisional Russian label for %s', (layer, label) => {
    const card = show(withAssignment({ economicRole: 'ordinary_expense', layer }));
    expect(card.getByText(`Подтверждённый слой (предварительная таксономия): ${label}`)).toBeInTheDocument();
    expect(FINANCIAL_LAYERS).toContain(layer);
  });

  it.each([
    ['ordinary_income', 'Обычное поступление'], ['loan_repayment', 'Возврат займа'],
    ['refund', 'Возврат покупки'], ['internal_transfer', 'Внутренний перевод'],
    ['capital_movement', 'Движение капитала'],
  ] as const)('does not invent a spending layer for the reviewed %s role', (economicRole, label) => {
    const card = show(withAssignment({ economicRole, layer: null }));
    expect(card.getByText(`Подтверждённая роль: ${label}`)).toBeInTheDocument();
    expect(card.getByText(/Слой обычных расходов не назначается/)).toBeInTheDocument();
    expect(card.queryByText(/Подтверждённый слой/)).not.toBeInTheDocument();
  });

  it('delegates amount display to existing formatKopecks, including the last kopeck', () => {
    const formatter = jest.spyOn(money, 'formatKopecks');
    const data = example('Без назначения');
    const card = show(data);
    expect(formatter).toHaveBeenCalledWith(data.input.operation.facts.kopecks);
    expect(card.getByText('Сумма записи: 123,45 ₽')).toBeInTheDocument();
  });

  it('reports formatting failure explicitly instead of substituting zero', () => {
    const data = example('Без назначения');
    // Deliberately corrupt the checked-facts precondition only for this guard.
    const operation = data.input.operation;
    if (operation.dataset !== 'expenses') throw new Error('Expected synthetic expense');
    const card = show({ ...data, input: { ...data.input,
      operation: { ...operation, facts: { ...operation.facts, kopecks: NaN } } } });
    expect(card.getByText(/Сумму записи невозможно отобразить/)).toBeInTheDocument();
    expect(card.queryByText(/0,00 ₽|NaN/)).not.toBeInTheDocument();
  });

  it('renders accessible demo headings and synthetic/persistence boundaries without app providers', () => {
    render(<ClassificationPreviewDemo />);
    const region = screen.getByRole('region', { name: 'Экспериментальная демонстрация финансовой классификации' });
    expect(within(region).getByRole('heading', { level: 2 })).toBeInTheDocument();
    const examples = createSyntheticClassificationExamples();
    expect(within(region).getAllByRole('heading', { level: 3 })).toHaveLength(examples.length);
    expect(within(region).getAllByRole('article')).toHaveLength(examples.length);
    expect(screen.getByText(/Все примеры синтетические.*Хранение на сервере отсутствует/)).toBeInTheDocument();
    expect(screen.getByText(/не создаёт перевод, платёж, резерв или факт финансирования/)).toBeInTheDocument();
    expect(screen.getAllByText(/Синтетический пример ·/)).toHaveLength(examples.length);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText(/сохранено|успешно сохран|saved/i)).not.toBeInTheDocument();
  });

  it('uses exclusively fictional checked examples and leaves frozen inputs intact across rerenders', () => {
    const examples = deepFreeze(createSyntheticClassificationExamples());
    for (const { input } of examples) {
      const operations = [input.operation, ...input.decisions.map((decision) => decision.operation)];
      for (const operation of operations) {
        expect(operation.ownerScope).toMatch(/^synthetic-/);
        expect(operation.transactionId).toMatch(/^synthetic-/);
        expect(Number.isSafeInteger(operation.facts.kopecks)).toBe(true);
        expect(operation.facts.kopecks).toBeGreaterThanOrEqual(0);
        expect(operation.facts.timestamp).toBe(1830297600000);
        expect(operation.dataset === 'expenses' && operation.facts.category.kind === 'label'
          ? operation.facts.category.value : operation.dataset === 'incomes' ? operation.facts.sourceLabel : '')
          .toMatch(/^Вымышленн/);
      }
      for (const candidate of [...input.suggestions, ...input.decisions]) expect(candidate.id).toMatch(/^synthetic-/);
    }
    const before = JSON.stringify(examples);
    const view = render(<StrictMode><ClassificationPreview examples={examples} /></StrictMode>);
    view.rerender(<StrictMode><ClassificationPreview examples={[...examples].reverse()} /></StrictMode>);
    expect(screen.getAllByRole('article')).toHaveLength(examples.length);
    expect(JSON.stringify(examples)).toBe(before);
    // Network, session storage and financial writes are forbidden by the guards
    // for every test, including StrictMode render/rerender/unmount.
  });
});
