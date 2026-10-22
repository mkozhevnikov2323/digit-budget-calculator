import { cleanup, render, screen, within } from '@testing-library/react';
import { buildAnalytics } from 'features/FinancialAnalytics/model/calculations';
import { expense, income, expenseResponse, incomeResponse, selectedPeriod } from 'features/FinancialAnalytics/model/tests/fixtures';
import { AnalyticsResults } from '../AnalyticsResults';

// Actual MUI X Charts rendering at narrow and wide container widths. JSDOM has
// no layout engine, so supply dimensions instead of mocking chart components.
describe('AnalyticsResults with real MUI charts', () => {
  let computedStyle: jest.SpyInstance;
  let consoleError: jest.SpyInstance;
  beforeEach(() => { consoleError = jest.spyOn(console, 'error'); });
  afterEach(() => {
    cleanup();
    computedStyle?.mockRestore();
    try { expect(consoleError).not.toHaveBeenCalled(); } finally { consoleError.mockRestore(); }
  });

  it.each([320, 1200])('renders charts, accessible headings and the complete category table at %ipx', (width) => {
    const original = window.getComputedStyle;
    computedStyle = jest.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudo) => {
      const style = original.call(window, element, pseudo);
      if (element.tagName.toLowerCase() === 'svg') style.width = `${width}px`;
      return style;
    });
    const result = buildAnalytics(expenseResponse([expense('e', 0.3, 'Очень длинная категория расходов для узкого экрана')]),
      incomeResponse([income('i', 1)]), selectedPeriod());
    if (!result.ok) throw new Error('Invalid synthetic analytics');
    const { container } = render(<AnalyticsResults data={result.value} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Месячная динамика расходов' })).toBeInTheDocument();
    expect(screen.getByLabelText('График категорий расходов')).toBeInTheDocument();
    expect(screen.getByLabelText('Месячная динамика расходов')).toBeInTheDocument();
    expect(screen.getByLabelText('График категорий расходов')).toHaveAttribute('viewBox', `0 0 ${width} 220`);
    expect(screen.getByLabelText('Месячная динамика расходов')).toHaveAttribute('viewBox', `0 0 ${width} 300`);
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(2);
    const table = within(screen.getByRole('table', { name: 'Расходные операции по категориям' }));
    expect(table.getByRole('rowheader', { name: 'Очень длинная категория расходов для узкого экрана' })).toBeInTheDocument();
    expect(table.getByText('0,30 ₽')).toBeInTheDocument();
    expect(screen.getByText(/включая месяцы без расходов/)).toBeInTheDocument();
  });

  it('explicitly reports a formatting failure instead of displaying an invalid summary as zero', () => {
    const result = buildAnalytics(expenseResponse(), incomeResponse(), selectedPeriod());
    if (!result.ok) throw new Error('Invalid synthetic analytics');
    render(<AnalyticsResults data={{ ...result.value, incomeKopecks: NaN }} />);
    const card = within(screen.getByText('Записанные поступления').parentElement!);
    expect(card.getByText('Некорректная сумма')).toBeInTheDocument();
    expect(card.queryByText('0,00 ₽')).not.toBeInTheDocument();
  });

  it('marks current/future annual months instead of presenting twelve completed months', () => {
    const result = buildAnalytics(expenseResponse(), incomeResponse(), selectedPeriod('2026-01-01', '2026-12-31'));
    if (!result.ok) throw new Error('Invalid synthetic analytics');
    render(<AnalyticsResults data={result.value} observedAt={Date.parse('2026-10-21T00:00:00Z')} />);
    const table = within(screen.getByRole('table', { name: 'Помесячный денежный поток' }));
    expect(table.getAllByRole('row')).toHaveLength(13);
    expect(table.getAllByText('Период завершён')).toHaveLength(9);
    expect(table.getByText('Месяц не завершён')).toBeInTheDocument();
    expect(table.getAllByText('Будущий месяц')).toHaveLength(2);
    expect(screen.getByText(/Ноль записей не доказывает/)).toBeInTheDocument();
  });
});
