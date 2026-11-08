import { useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router';
import { Alert, Box, Button, Chip, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import { useGetClassificationRulesQuery } from 'features/ClassificationRules/api/rulesApi';
import { layerLabel, roleLabel } from 'shared/lib/analytics/presentation';

const Rules = ({ owner }: { owner: VerifiedOwner }) => {
  const [dataset, setDataset] = useState<'expenses' | 'incomes'>('expenses');
  const query = useGetClassificationRulesQuery(owner, { refetchOnMountOrArgChange: true });
  const rows = query.currentData?.filter(rule => rule.dataset === dataset);
  return <Stack spacing={2}>
    <Tabs value={dataset} onChange={(_event, value: 'expenses' | 'incomes') => setDataset(value)} aria-label="Правила классификации">
      <Tab label="Расходы" value="expenses" id="rules-expenses" aria-controls="rules-panel" />
      <Tab label="Доходы" value="incomes" id="rules-incomes" aria-controls="rules-panel" />
    </Tabs>
    <Box role="tabpanel" id="rules-panel" aria-labelledby={`rules-${dataset}`}>
      {query.isLoading || query.isFetching || query.isUninitialized ? <Typography role="status">Загрузка правил…</Typography>
        : query.isError ? <Stack spacing={1}><Alert severity="error">Не удалось загрузить правила классификации.</Alert><Button onClick={() => void query.refetch()}>Повторить загрузку</Button></Stack>
        : !rows ? <Alert severity="error">Правила классификации недоступны.</Alert>
        : rows.length === 0 ? <Typography>Нет сохранённых правил {dataset === 'expenses' ? 'расходов' : 'доходов'}.</Typography>
        : <TableContainer><Table size="small" aria-label={dataset === 'expenses' ? 'Правила расходов' : 'Правила доходов'}>
          <TableHead><TableRow>{(dataset === 'expenses' ? ['Категория', 'Наименование', 'Группа расходов', 'Активность'] : ['Источник дохода', 'Экономический тип', 'Активность']).map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{rows.map(rule => <TableRow key={rule._id}>
            {rule.dataset === 'expenses' ? <><TableCell>{rule.category}</TableCell><TableCell>{rule.title ?? 'Все наименования'}</TableCell><TableCell>{layerLabel(rule.layer)}</TableCell></>
              : <><TableCell>{rule.source}</TableCell><TableCell>{roleLabel(rule.economicRole)}</TableCell></>}
            <TableCell><Chip size="small" color={rule.enabled ? 'success' : 'default'} label={rule.enabled ? 'Включено' : 'Выключено'} /></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>}
    </Box>
  </Stack>;
};
const ClassificationRulesPage = () => {
  const owner = useVerifiedOwner();
  return <Box p={3}>
    <Stack spacing={2}>
      <Typography component="h1" variant="h5">Настройки автоматической классификации</Typography>
      <Button component={RouterLink} to="/profile" sx={{ alignSelf: 'flex-start' }}>Вернуться в профиль</Button>
      {owner.status === 'unauthenticated' ? <Navigate to="/" replace />
        : owner.status === 'verifying' ? <Typography role="status">Проверка пользователя…</Typography>
        : owner.status === 'verification_error' ? <Alert severity="error">Не удалось подтвердить пользователя. Правила недоступны.</Alert>
        : <Rules key={`${owner.owner.userId}:${owner.owner.sessionGeneration}`} owner={owner.owner} />}
    </Stack>
  </Box>;
};
export default ClassificationRulesPage;
