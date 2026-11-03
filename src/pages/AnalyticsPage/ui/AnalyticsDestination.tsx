import { Container } from '@mui/material';
import AnalyticsPage from './AnalyticsPage';
import { RecurrenceSection } from 'features/RecurrenceAnalytics/ui/RecurrenceSection';
import { AnalyticsPageContext } from 'features/AnalyticsState/model/useAnalyticsState';
import type { AnalyticsPageKey } from 'features/AnalyticsState/model/slice';
import { AnalyticsFeaturePage } from './AnalyticsFeaturePage';

export const AnalyticsDestination = ({ page }: { page: AnalyticsPageKey }) => (
  <AnalyticsPageContext.Provider key={page} value={page}>
    {page === 'overview' || page === 'categories' ? (
      <AnalyticsPage view={page} />
    ) : page === 'recurrence' ||
      page === 'similar' ||
      page === 'income-sources' ? (
      <Container
        maxWidth="lg"
        sx={{ py: 2, minWidth: 0 }}
      >
        <RecurrenceSection view={page} />
      </Container>
    ) : (
      <AnalyticsFeaturePage mode={page} />
    )}
  </AnalyticsPageContext.Provider>
);
