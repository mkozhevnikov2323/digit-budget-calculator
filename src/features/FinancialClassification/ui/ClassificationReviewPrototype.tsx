import { useId, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { formatKopecks } from '../../FinancialAnalytics/model/money';
import { resolveClassification } from '../model/classification';
import type { ClassificationSnapshots } from '../model/snapshotAdapter';
import {
  FINANCIAL_LAYERS, PROVISIONAL_TAXONOMY_VERSION,
  type CategorySuggestion, type CheckedOperationSnapshot, type ClassificationAssignment,
  type ClassificationErrorCode, type EconomicRole, type FinancialLayer, type ReviewedDecision,
} from '../model/types';
import { createSyntheticReviewExamples } from './syntheticReviewExamples';

const layers: Record<FinancialLayer, string> = {
  everyday: 'Повседневные расходы', irregular: 'Нерегулярные обязательства', emergency: 'Чрезвычайный резерв',
  major_goals: 'Крупные цели', long_term_capital: 'Долгосрочный капитал',
};
const roles: Record<EconomicRole, string> = {
  unknown: 'Не определена', ordinary_expense: 'Обычный расход', ordinary_income: 'Обычное поступление',
  loan_issuance: 'Выдача займа', loan_repayment: 'Возврат займа', refund: 'Возврат покупки',
  internal_transfer: 'Внутренний перевод', capital_movement: 'Движение капитала',
};
const errors: Record<ClassificationErrorCode, string> = {
  invalid_operation: 'Некорректный снимок операции.', invalid_suggestion: 'Некорректная подсказка.',
  invalid_decision: 'Некорректное проверенное решение.',
  unsupported_taxonomy: 'Запрошенная версия таксономии не поддерживается.',
  taxonomy_mismatch: 'Версии таксономии не совпадают.',
  owner_mismatch: 'Область владельца не совпадает. Решения не показаны.',
  stale_decision: 'Решение устарело: снимок операции менялся. Сбросьте временное решение и проверьте данные заново.',
  conflicting_suggestions: 'Подсказки противоречат друг другу. Требуется исправить синтетические входы.',
  conflicting_decisions: 'Проверенные решения противоречат друг другу. Требуется новая проверка.',
};
const ResolutionError = ({ code }: { code: ClassificationErrorCode }) =>
  <Alert severity="error">Ошибка классификации: {errors[code]}</Alert>;
const Assignment = ({ value, proposed = false }: { value: ClassificationAssignment; proposed?: boolean }) => (
  <Stack spacing={1}>
    <Typography>{proposed ? 'Предлагаемая роль' : 'Проверенная роль'}: {roles[value.economicRole]}</Typography>
    {value.economicRole === 'ordinary_expense'
      ? <Typography>{proposed ? 'Предлагаемый слой' : 'Проверенный слой'} (предварительный): {layers[value.layer]}</Typography>
      : <Typography>Слой обычных расходов не назначается. Это отдельная экономическая роль.</Typography>}
  </Stack>
);

type Choice = { readonly key: string; readonly assignment: ClassificationAssignment; readonly label: string };
const manualChoices = (dataset: CheckedOperationSnapshot['dataset']): readonly Choice[] => {
  const nonSpending: Exclude<ClassificationAssignment['economicRole'], 'ordinary_expense'>[] = dataset === 'expenses'
    ? ['loan_issuance', 'internal_transfer', 'capital_movement']
    : ['ordinary_income', 'loan_repayment', 'refund', 'internal_transfer', 'capital_movement'];
  return [
    ...(dataset === 'expenses' ? FINANCIAL_LAYERS.map((layer): Choice => ({ key: layer,
      assignment: { economicRole: 'ordinary_expense', layer }, label: `Обычный расход — ${layers[layer]}` })) : []),
    ...nonSpending.map((economicRole): Choice => ({ key: economicRole,
      assignment: { economicRole, layer: null }, label: roles[economicRole] })),
  ];
};

const ManualChoice = ({ dataset, apply, cancel }: {
  dataset: CheckedOperationSnapshot['dataset']; apply: (assignment: ClassificationAssignment) => void; cancel: () => void;
}) => {
  const [selection, setSelection] = useState('');
  const id = useId();
  const choices = manualChoices(dataset);
  const chosen = choices.find((choice) => choice.key === selection);
  return (
    <Stack component="form" spacing={2} aria-label="Ручной выбор классификации" onSubmit={(event) => {
      event.preventDefault();
      if (chosen) apply(chosen.assignment);
    }}>
      <TextField id={id} label="Классификация вручную" select value={selection}
        slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
        onChange={(event) => setSelection(event.target.value)}>
        <option value="">Выберите явное назначение</option>
        {choices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
      </TextField>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button type="submit" variant="contained" disabled={!chosen}>Применить только в демонстрации</Button>
        <Button type="button" onClick={cancel}>Отменить выбор</Button>
      </Stack>
    </Stack>
  );
};

export type ClassificationReviewPrototypeProps = {
  readonly sessionId: string;
  readonly ownerScope: string;
  /** Fictional checked adapter output only; never live financial/session data. */
  readonly snapshots: ClassificationSnapshots;
  readonly suggestions?: readonly CategorySuggestion[];
  /** Optional synthetic resolver evidence for diagnostics. Never local drafts. */
  readonly diagnosticDecisions?: readonly ReviewedDecision[];
  readonly taxonomyVersion?: string;
};
type ReviewCardProps = Required<Pick<ClassificationReviewPrototypeProps,
  'ownerScope' | 'suggestions' | 'diagnosticDecisions' | 'taxonomyVersion'>> & { operation: CheckedOperationSnapshot };
type Draft = { readonly decision: ReviewedDecision | null; readonly invalidated: boolean };

const ReviewCard = ({ operation, ownerScope, suggestions, diagnosticDecisions, taxonomyVersion }: ReviewCardProps) => {
  const headingId = useId();
  const [draft, setDraft] = useState<Draft>({ decision: null, invalidated: false });
  const [manual, setManual] = useState(false);
  const [notice, setNotice] = useState('');
  const result = resolveClassification({ operation, suggestions, taxonomyVersion,
    decisions: draft.decision && Array.isArray(diagnosticDecisions)
      ? [...diagnosticDecisions, draft.decision] : diagnosticDecisions });
  // A resolver-detected stale draft stays invalid even if facts later revert.
  // Guarded render adjustment prevents a stale approval from being committed.
  if (draft.decision && !draft.invalidated && !result.ok &&
      (result.error.code === 'stale_decision' || result.error.code === 'invalid_operation')) {
    setDraft({ ...draft, invalidated: true });
  }
  if (!result.ok && result.error.code === 'invalid_operation') return <ResolutionError code={result.error.code} />;
  if (operation.ownerScope !== ownerScope) return <ResolutionError code="owner_mismatch" />;
  const amount = formatKopecks(operation.facts.kopecks);
  const ready = result.ok && !draft.invalidated && amount.ok;
  const local = (decision: ReviewedDecision) => {
    setDraft({ decision, invalidated: false });
    setManual(false);
    setNotice('Решение применено только в демонстрации');
  };
  const common = () => ({ id: 'synthetic-interactive-review', revision: 'caller-local-review',
    taxonomyVersion, reviewerScope: ownerScope,
    // The resolver projects/copies the exact checked snapshot, never raw props.
    operation: result.ok ? result.value.operation : operation });
  const approve = (assignment: ClassificationAssignment, provenance: ReviewedDecision['provenance']) => {
    if (ready) local({ ...common(), state: 'approved', assignment, provenance });
  };
  const reset = () => {
    setDraft({ decision: null, invalidated: false }); setManual(false); setNotice('Временное решение сброшено');
  };
  const title = `${operation.dataset === 'expenses' ? 'Расход' : 'Поступление'} · ${operation.transactionId}`;
  return (
    <Paper component="article" variant="outlined" aria-labelledby={headingId} sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
      <Stack spacing={2}>
        <Typography component="h3" variant="h6" id={headingId}>{title}</Typography>
        <Typography>Синтетическая записанная операция: {operation.dataset === 'expenses' ? 'расход' : 'поступление'}</Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap' }}>{operation.dataset === 'expenses'
          ? operation.facts.category.kind === 'absent' ? 'Исходная категория отсутствует'
            : `Исходная категория: «${operation.facts.category.value}» (${operation.facts.category.dictionaryStatus === 'ambiguous' ? 'неоднозначна' : 'связь со словарём не установлена'})`
          : `Исходный источник: «${operation.facts.sourceLabel}»`}</Typography>
        {amount.ok ? <Typography>Сумма записи: {amount.value}</Typography>
          : <Alert severity="error">Сумму невозможно отобразить: некорректные копейки. Проверка недоступна.</Alert>}
        {draft.invalidated ? <ResolutionError code="stale_decision" />
          : !result.ok ? <ResolutionError code={result.error.code} />
            : amount.ok && <>
              {result.value.state === 'unclassified' && <Alert severity="info">Не классифицировано. Экономическая роль не определена.</Alert>}
              {result.value.state === 'proposed' && <Alert severity="warning">
                <Typography fontWeight="bold">Предложение — ожидает явной проверки</Typography>
                <Assignment value={result.value.proposal.assignment} proposed />
                <Typography>Подсказка по точной строке категории. Подтверждённой классификации нет.</Typography>
              </Alert>}
              {result.value.state === 'approved' && <Alert severity="success">
                <Typography fontWeight="bold">{draft.decision ? 'Локально проверено (только демонстрация)' : 'Переданное синтетическое решение'}</Typography>
                <Assignment value={result.value.confirmed} />
              </Alert>}
              {result.value.state === 'explicit_unclassified' && <Alert severity="info">Явно оставлено без классификации. Подсказки заблокированы до сброса решения.</Alert>}
            </>}
        {ready && <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {result.ok && result.value.state === 'proposed' && <Button variant="contained" onClick={() => {
              if (result.value.state !== 'proposed') return;
              const rule = result.value.proposal.suggestions[0];
              approve(result.value.proposal.assignment, { kind: 'category_rule', ruleId: rule.id,
                ruleRevision: rule.ruleRevision, sourceLabel: rule.sourceLabel });
            }}>Принять предложение</Button>}
            <Button onClick={() => setManual(true)}>Выбрать вручную</Button>
            <Button onClick={() => {
              if (ready) local({ ...common(), state: 'explicit_unclassified', provenance: { kind: 'manual' } });
            }}>Оставить без классификации</Button>
          </Stack>
          {manual && <ManualChoice key={JSON.stringify(operation)} dataset={operation.dataset}
            apply={(assignment) => approve(assignment, { kind: 'manual' })} cancel={() => setManual(false)} />}
        </>}
        {draft.decision && <Button onClick={reset}>Сбросить временное решение</Button>}
        {notice && ready && <Typography role="status">{notice}</Typography>}
      </Stack>
    </Paper>
  );
};

const SessionReview = ({ snapshots, ownerScope, suggestions = [], diagnosticDecisions = [],
  taxonomyVersion = PROVISIONAL_TAXONOMY_VERSION }: ClassificationReviewPrototypeProps) => {
  if (!snapshots || snapshots.revisionAuthority !== 'caller_local' ||
      !Array.isArray(snapshots.expenses) || !Array.isArray(snapshots.incomes)) {
    return <ResolutionError code="invalid_operation" />;
  }
  const operations: readonly CheckedOperationSnapshot[] = [...snapshots.expenses, ...snapshots.incomes];
  const identities = operations.map((operation) => JSON.stringify([operation?.dataset, operation?.transactionId]));
  if (new Set(identities).size !== identities.length) return <ResolutionError code="invalid_operation" />;
  // Reject the entire foreign snapshot batch, unmounting any existing cards.
  if (operations.some((operation) => operation?.ownerScope !== undefined && operation.ownerScope !== ownerScope)) {
    return <ResolutionError code="owner_mismatch" />;
  }
  if (!operations.length) return <Typography>Синтетических операций нет.</Typography>;
  return <Stack spacing={2}>{operations.map((operation, index) => <ReviewCard key={identities[index]}
    operation={operation} ownerScope={ownerScope} suggestions={suggestions}
    diagnosticDecisions={diagnosticDecisions} taxonomyVersion={taxonomyVersion} />)}</Stack>;
};

/** Owner/session key is a synchronous unmount boundary, not an effect cleanup.
 * Returning to a former identity creates a fresh draft tree, never a cache. */
export const ClassificationReviewPrototype = (props: ClassificationReviewPrototypeProps) => {
  const headingId = useId();
  const validContext = typeof props.sessionId === 'string' && !!props.sessionId && !/\s/.test(props.sessionId) &&
    typeof props.ownerScope === 'string' && !!props.ownerScope && !/\s/.test(props.ownerScope);
  return (
    <Box component="section" aria-labelledby={headingId} sx={{ width: '100%', minWidth: 0, overflowWrap: 'anywhere' }}>
      <Stack spacing={2}>
        <Typography component="h2" variant="h5" id={headingId}>Экспериментальный review классификации</Typography>
        <Alert severity="info">Все записи синтетические. Решения существуют только в памяти. Ничего не сохраняется на сервере.
          Реальные доходы и расходы не изменяются. Классификация не резервирует и не переводит деньги.
          Пять финансовых слоёв предварительные.</Alert>
        <Typography>Ревизии caller_local не доказывают актуальность данных на сервере. Синтетическая сессия не является авторизацией.</Typography>
        {validContext ? <SessionReview key={JSON.stringify([props.sessionId, props.ownerScope])} {...props} />
          : <Alert severity="error">Некорректная синтетическая сессия или область владельца. Проверка недоступна.</Alert>}
      </Stack>
    </Box>
  );
};

export const ClassificationReviewPrototypeDemo = () => <ClassificationReviewPrototype {...createSyntheticReviewExamples()} />;
