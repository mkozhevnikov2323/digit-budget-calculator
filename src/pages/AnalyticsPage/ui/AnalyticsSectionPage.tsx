import { Alert, Container, Link, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router';

/** Stage 1 destination only: never load financial data or mount the old page. */
export const AnalyticsSectionPage = ({ title }: { title: string }) => (
  <Container maxWidth="lg" sx={{ py: 2, minWidth: 0 }}>
    <Stack spacing={2}>
      <Typography component="h1" variant="h4">{title}</Typography>
      <Alert severity="info">Отдельная страница подготовлена. Перенос содержимого ещё не выполнен: все существующие функции доступны на странице расширенной аналитики.</Alert>
      <Link component={RouterLink} to="/analytics">Открыть текущую страницу аналитики</Link>
    </Stack>
  </Container>
);
