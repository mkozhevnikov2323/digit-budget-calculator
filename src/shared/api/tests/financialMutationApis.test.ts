type RequestConfiguration = {
  url: string;
  method: string;
  body?: Record<string, unknown>;
};

type EndpointConfiguration = {
  query: (argument: Record<string, unknown>) => RequestConfiguration;
  invalidatesTags?: string[];
};

const mockEndpointConfigurations: Record<string, EndpointConfiguration> = {};

jest.mock('shared/api/baseApi', () => ({
  baseApi: {
    injectEndpoints: ({
      endpoints,
    }: {
      endpoints: (builder: {
        query: (configuration: unknown) => unknown;
        mutation: (configuration: unknown) => unknown;
      }) => Record<string, EndpointConfiguration>;
    }) => {
      const builder = {
        query: (configuration: unknown) => configuration,
        mutation: (configuration: unknown) => configuration,
      };
      Object.assign(mockEndpointConfigurations, endpoints(builder));
      return {};
    },
  },
}));

describe('financial mutation API configuration', () => {
  beforeAll(async () => {
    await import('../../../entities/Expense/api/expenseApi');
    await import('../../../entities/Income/api/incomeApi');
  });

  it('uses the expense Mongo _id in the PATCH URL and omits it from the body', () => {
    const request = mockEndpointConfigurations.updateExpense.query({
      _id: 'mongo-expense-id',
      amount: 125,
      date: '2026-09-20',
      title: 'Products',
      recipient: 'Store',
      category: 'Food',
      comment: 'Receipt',
    });

    expect(request).toEqual({
      url: '/expenses/mongo-expense-id',
      method: 'PATCH',
      body: {
        amount: 125,
        date: '2026-09-20',
        title: 'Products',
        recipient: 'Store',
        category: 'Food',
        comment: 'Receipt',
      },
    });
    expect(request.url).not.toContain('undefined');
    expect(request.body).not.toHaveProperty('_id');
  });

  it.each([
    ['addExpense', ['Expense', 'Balance']],
    ['updateExpense', ['Expense', 'Balance']],
    ['deleteExpense', ['Expense', 'Balance']],
    ['addIncome', ['Income', 'Balance']],
    ['updateIncome', ['Income', 'Balance']],
    ['deleteIncome', ['Income', 'Balance']],
  ])('%s invalidates its domain and Balance caches', (endpoint, tags) => {
    expect(mockEndpointConfigurations[endpoint].invalidatesTags).toEqual(tags);
  });
});
