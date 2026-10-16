import { useId } from 'react';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import { formatKopecks } from '../../FinancialAnalytics/model/money';
import { resolveClassification } from '../model/classification';
import type {
  ClassificationAssignment, ClassificationErrorCode, EconomicRole, FinancialLayer, ResolvedClassification,
} from '../model/types';
import { createSyntheticClassificationExamples, type SyntheticClassificationExample } from './syntheticExamples';

const layerLabels: Record<FinancialLayer, string> = {
  everyday: 'Повседневные расходы',
  irregular: 'Нерегулярные обязательства',
  emergency: 'Чрезвычайный резерв',
  major_goals: 'Крупные цели',
  long_term_capital: 'Долгосрочный капитал',
};
const roleLabels: Record<EconomicRole, string> = {
  unknown: 'Не определена', ordinary_expense: 'Обычный расход', ordinary_income: 'Обычное поступление',
  loan_issuance: 'Выдача займа', loan_repayment: 'Возврат займа', refund: 'Возврат покупки',
  internal_transfer: 'Внутренний перевод', capital_movement: 'Движение капитала',
};
const errorLabels: Record<ClassificationErrorCode, string> = {
  invalid_operation: 'Некорректный снимок операции.',
  invalid_suggestion: 'Некорректная подсказка.',
  invalid_decision: 'Некорректное проверенное решение.',
  unsupported_taxonomy: 'Запрошенная версия таксономии не поддерживается.',
  taxonomy_mismatch: 'Версия таксономии решения или подсказки не совпадает с запрошенной.',
  owner_mismatch: 'Область владельца не совпадает. Классификация не показана.',
  stale_decision: 'Решение устарело: факты операции изменились. Нужна повторная проверка.',
  conflicting_decisions: 'Проверенные решения противоречат друг другу. Классификация не определена.',
  conflicting_suggestions: 'Подсказки противоречат друг другу. Предложение не определено.',
};

const AssignmentDetails = ({ assignment, proposed }: {
  assignment: ClassificationAssignment; proposed: boolean;
}) => (
  <Stack spacing={1}>
    <Typography>{proposed ? 'Предлагаемая роль' : 'Подтверждённая роль'}: {roleLabels[assignment.economicRole]}</Typography>
    {assignment.economicRole === 'ordinary_expense' ? (
      <Typography>{proposed ? 'Предлагаемый слой' : 'Подтверждённый слой'} (предварительная таксономия): {layerLabels[assignment.layer]}</Typography>
    ) : (
      <Typography>Слой обычных расходов не назначается. Это отдельная экономическая роль.</Typography>
    )}
  </Stack>
);

const Outcome = ({ value }: { value: ResolvedClassification }) => {
  switch (value.state) {
    case 'unclassified': return (
      <Alert severity="info">
        <Typography fontWeight="bold">Не классифицировано</Typography>
        <Typography>Нет решения и подходящих подсказок. Экономическая роль не определена.</Typography>
      </Alert>
    );
    case 'proposed': return (
      <Alert severity="warning">
        <Stack spacing={1}>
          <Typography fontWeight="bold">Предложение — ожидает проверки</Typography>
          <AssignmentDetails assignment={value.proposal.assignment} proposed />
          <Typography>Основание: явно заданная подсказка по точной исходной строке категории, без установленной связи со словарём.</Typography>
          <Typography>Подтверждённой классификации нет. Экономическая роль ещё не определена.</Typography>
        </Stack>
      </Alert>
    );
    case 'approved': return (
      <Alert severity="success">
        <Stack spacing={1}>
          <Typography fontWeight="bold">Подтверждённая классификация (синтетическое решение)</Typography>
          <AssignmentDetails assignment={value.confirmed} proposed={false} />
          <Typography>Основание: явно переданное проверенное синтетическое решение для текущих фактов операции.</Typography>
        </Stack>
      </Alert>
    );
    case 'explicit_unclassified': return (
      <Alert severity="info">
        <Typography fontWeight="bold">Явно оставлено без классификации</Typography>
        <Typography>Проверенное синтетическое решение блокирует подсказки. Экономическая роль не определена.</Typography>
      </Alert>
    );
  }
};

const PreviewExample = ({ example }: { example: SyntheticClassificationExample }) => {
  const headingId = useId();
  const result = resolveClassification(example.input);
  const { operation } = example.input;
  const amount = formatKopecks(operation.facts.kopecks);
  return (
    <Paper component="article" variant="outlined" aria-labelledby={headingId} sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
      <Stack spacing={2}>
        <Typography component="h3" variant="h6" id={headingId}>{example.title}</Typography>
        <Typography>Синтетический пример · {operation.dataset === 'expenses' ? 'Записанный расход' : 'Записанное поступление'}</Typography>
        <Typography>ID синтетической записи: {operation.transactionId}</Typography>
        {amount.ok ? <Typography>Сумма записи: {amount.value}</Typography>
          : <Alert severity="error">Сумму записи невозможно отобразить: некорректные копейки.</Alert>}
        {result.ok ? <Outcome value={result.value} /> : (
          <Alert severity="error">
            <Typography fontWeight="bold">Ошибка классификации</Typography>
            <Typography>{errorLabels[result.error.code]}</Typography>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};

export type ClassificationPreviewProps = {
  /** Checked, fictional data only; this component is not a live-data adapter. */
  readonly examples: readonly SyntheticClassificationExample[];
};

/** Isolated read-only presentation. No store, router, session or persistence. */
export const ClassificationPreview = ({ examples }: ClassificationPreviewProps) => {
  const headingId = useId();
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ width: '100%', minWidth: 0, overflowWrap: 'anywhere' }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h5" id={headingId}>Экспериментальная демонстрация финансовой классификации</Typography>
        <Alert severity="info">
          Все примеры синтетические. Хранение на сервере отсутствует. Подтверждение здесь означает только переданное проверенное синтетическое решение.
        </Alert>
        <Typography>Классификация описывает смысл записи. Она не создаёт перевод, платёж, резерв или факт финансирования. Названия пяти слоёв предварительные.</Typography>
        {examples.map((example, index) => <PreviewExample key={index} example={example} />)}
      </Stack>
    </Box>
  );
};

/** Optional demo entry point; deliberately not mounted by the application. */
export const ClassificationPreviewDemo = () => <ClassificationPreview examples={createSyntheticClassificationExamples()} />;
