import { render, screen, waitFor } from '@testing-library/react';
import { useGetBalanceQuery } from '../../../../entities/Balance/api/balanceApi';
import BalancePage from '../BalancePage';

jest.mock('../../../../entities/Balance/api/balanceApi', () => ({ useGetBalanceQuery: jest.fn() }));
jest.mock('entities/Balance', () => ({
  useGetBalanceQuery: jest.requireMock('../../../../entities/Balance/api/balanceApi').useGetBalanceQuery,
  BalanceCard: jest.requireActual('../../../../entities/Balance/ui/BalanceCard').BalanceCard,
}), { virtual: true });

const mockQuery = useGetBalanceQuery as jest.Mock;

describe('BalancePage with the installed MUI X Charts implementation', () => {
  beforeEach(() => {
    // JSDOM has no layout. Supply container geometry, not a chart replacement.
    const getComputedStyle = window.getComputedStyle;
    jest.spyOn(window, 'getComputedStyle').mockImplementation((element, pseudoElement) => {
      const style = getComputedStyle(element, pseudoElement);
      if (element instanceof SVGElement) {
        Object.defineProperties(style, { width: { value: '800px' }, height: { value: '400px' } });
      }
      return style;
    });
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 800, bottom: 400, width: 800, height: 400, toJSON: () => ({}),
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each([600, -200, 0])('renders real SVG bars and unchanged synthetic totals (balance %i)', async (balance) => {
    mockQuery.mockReturnValue({ data: { income: 1000, expense: 1000 - balance, balance }, isLoading: false, refetch: jest.fn() });
    const { container } = render(<BalancePage />);
    expect(screen.getByText('Диаграмма баланса')).toBeInTheDocument();
    expect(screen.getAllByText('1000 ₽').length).toBeGreaterThan(0);
    expect(screen.getByText(`${balance} ₽`)).toBeInTheDocument();
    expect(screen.getAllByText(`${1000 - balance} ₽`).length).toBeGreaterThan(0);
    await waitFor(() => expect(container.querySelector('svg[class*="MuiChartsSurface-root"]')).toBeInTheDocument());
    const chart = container.querySelector('svg[class*="MuiChartsSurface-root"]')!;
    expect(chart).toHaveAttribute('viewBox', '0 0 800 400');
    expect(container.textContent).toContain('Доходы');
    expect(container.textContent).toContain('Расходы');
    expect(container.textContent).toContain('Баланс');
    const bars = container.querySelectorAll('.MuiBarElement-root');
    expect(bars).toHaveLength(3);
    expect(Array.from(bars, (bar) => bar.getAttribute('color'))).toEqual(['#388e3c', '#d32f2f', '#1976d2']);
  });

  it('shows loading without mounting the chart', () => {
    mockQuery.mockReturnValue({ isLoading: true, refetch: jest.fn() });
    const { container } = render(<BalancePage />);
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
    expect(container.querySelector('svg[class*="MuiChartsSurface-root"]')).not.toBeInTheDocument();
  });

  it('shows the API error without mounting the chart', () => {
    mockQuery.mockReturnValue({ isLoading: false, error: { status: 503 }, refetch: jest.fn() });
    const { container } = render(<BalancePage />);
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getAllByText('Ошибка при загрузке баланса')).toHaveLength(2);
    expect(container.querySelector('svg[class*="MuiChartsSurface-root"]')).not.toBeInTheDocument();
  });
});
