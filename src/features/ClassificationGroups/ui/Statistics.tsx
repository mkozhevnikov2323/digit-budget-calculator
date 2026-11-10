import { useId } from 'react';
import {
  Alert,
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { money } from 'features/ClassificationStatistics/ui/format';
import { useGroupReportQuery } from '../api/groupsApi';
const OwnedStatistics = ({
  owner,
  period,
}: {
  owner: VerifiedOwner;
  period: CalendarPeriod;
}) => {
  const scope = useId();
  const query = useGroupReportQuery(
    {
      ...owner,
      startInclusive: period.startInclusive,
      endExclusive: period.endExclusive,
      includeOperations: false,
      requestScope: scope,
    },
    { refetchOnMountOrArgChange: true },
  );
  if (query.isError)
    return (
      <Stack>
        <Alert severity="error">
          Статистика v3 недоступна. Проверьте готовность сервера и период до 366
          дней. Неполные суммы и нули не показаны; при превышении лимита
          сократите период.
        </Alert>
        <Button onClick={() => void query.refetch()}>
          Повторить загрузку статистики
        </Button>
      </Stack>
    );
  if (query.isFetching || !query.currentData)
    return (
      <Typography role="status">Загрузка полной статистики групп…</Typography>
    );
  const data = query.currentData;
  return (
    <Stack
      spacing={2}
      aria-label="Статистика пользовательских групп"
    >
      <Alert severity="info">
        Все записанные расходы учитываются со знаком минус, доходы — плюс,
        включая займы, переводы и инвестиции. Наблюдения не являются атомарным
        снимком БД.
      </Alert>
      {(['expenses', 'incomes'] as const).map((ds) => (
        <Paper
          component="section"
          aria-label={ds === 'expenses' ? 'Расходы' : 'Доходы'}
          key={ds}
          variant="outlined"
          sx={{ p: 2 }}
        >
          <Stack spacing={1}>
            <Typography
              component="h2"
              variant="h6"
            >
              {ds === 'expenses'
                ? 'Общая сумма расходов'
                : 'Общая сумма доходов'}
              : {money(data.totals[ds].signedKopecks)}
            </Typography>
            <Typography>
              Количество операций: {data.totals[ds].count}
            </Typography>
            <TableContainer>
              <Table
                size="small"
                aria-label={
                  ds === 'expenses' ? 'Группы расходов' : 'Группы доходов'
                }
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Группа</TableCell>
                    <TableCell>Сумма</TableCell>
                    <TableCell>Операций</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.groups
                    .filter((g) => g.dataset === ds)
                    .map((g) => (
                      <TableRow key={g.groupId ?? 'none'}>
                        <TableCell sx={{ overflowWrap: 'anywhere' }}>
                          {g.name ?? 'Без актуальной классификации'}
                          {g.status === 'archived'
                            ? ' · в архиве'
                            : g.status === 'disabled'
                              ? ' · отключена'
                              : ''}
                        </TableCell>
                        <TableCell>{money(g.signedKopecks)}</TableCell>
                        <TableCell>{g.count}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
            {!data.totals[ds].count && (
              <Typography>За выбранный период операций нет.</Typography>
            )}
          </Stack>
        </Paper>
      ))}
      <Button onClick={() => void query.refetch()}>Обновить статистику</Button>
    </Stack>
  );
};
export default function Statistics({
  period,
  mode = 'statistics',
}: {
  period: CalendarPeriod | null;
  mode?: 'statistics' | 'planning';
}) {
  const owner = useVerifiedOwner();
  if (mode === 'planning')
    return (
      <Alert severity="info">
        Планирование по пяти фиксированным слоям пока несовместимо с
        пользовательскими группами v3. Расчёты по legacy reader отключены, чтобы
        не показывать ложные итоги. Общая финансовая аналитика и баланс
        доступны.
      </Alert>
    );
  return !period ? (
    <Alert severity="info">Выберите корректный период.</Alert>
  ) : owner.status !== 'verified' ? (
    <Alert severity="info">Нужна текущая проверка владельца.</Alert>
  ) : (
    <OwnedStatistics
      key={`${owner.owner.userId}/${owner.owner.sessionGeneration}/${period.startInclusive}/${period.endExclusive}`}
      owner={owner.owner}
      period={period}
    />
  );
}
