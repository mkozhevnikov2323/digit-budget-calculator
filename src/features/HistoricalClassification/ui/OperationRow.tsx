import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionSummary, AccordionDetails, Alert, Button, Stack, Typography, Chip } from '@mui/material';
import { roleLabel, layerLabel, factLabel, dateLabel } from 'shared/lib/analytics/presentation';
import { formatKopecks } from 'features/FinancialAnalytics/model/money';
import type { HistoryOperation } from '../model/history';
import type { DecisionQuery } from '../api/historyApi';
import type { ClassificationStatus, ClassificationRead } from '../model/contract';
import { OperationEditor } from './OperationEditor';
import { roleChip, layerChip } from './chipColors';
const classificationLabel = (status: ClassificationStatus) => ({ approved: 'Классифицировано', unreviewed: 'Не классифицировано', explicit_unclassified: 'Без классификации', cleared: 'Решение сброшено', stale: 'Требует обновления', blocked: 'Недоступно' })[status];
export const OperationRow = ({ operation, scope, readOnly, expanded, onToggle, onClose, decision, onDecision, onRefresh }: {
  operation: HistoryOperation; scope: Omit<DecisionQuery, 'dataset' | 'operationId'>; readOnly: boolean; expanded: boolean; onToggle: () => void; onClose: () => void; decision?: ClassificationRead; onDecision?: (next: ClassificationRead) => void; onRefresh?: () => void;
}) => {
  const amount = formatKopecks(operation.kopecks);
  const title = operation.dataset === 'incomes' ? operation.facts.source : operation.facts.title;
  return <Accordion sx={{ '&.Mui-expanded': { my: 0.5 } }} expanded={expanded} onChange={onToggle} disableGutters>
    <AccordionSummary sx={{ minHeight: 56, px: 1.5, '&.Mui-expanded': { minHeight: 56 }, '& .MuiAccordionSummary-content': { my: 0.75 }, '& .MuiAccordionSummary-content.Mui-expanded': { my: 0.75 } }} expandIcon={<ExpandMoreIcon />} aria-label={title || (operation.dataset === 'incomes' ? 'Поступление без названия' : 'Расход без названия')}>
      <Stack sx={{ width: '100%', minWidth: 0, overflowWrap: 'anywhere' }} spacing={0.5}>
        <Stack direction="row" justifyContent="space-between" gap={1}><Typography>{title || 'Операция без названия'}{operation.dataset === 'expenses' && operation.facts.category ? ` · ${operation.facts.category}` : ''}</Typography><Typography sx={{ whiteSpace: 'nowrap' }}>{operation.dataset === 'expenses' ? '−' : '+'}{amount.ok ? amount.value : 'Сумма недоступна'}</Typography></Stack>
        {!readOnly && <Stack direction="row" gap={0.5} flexWrap="wrap">
          <Chip size="small" color={decision?.status === 'stale' || decision?.status === 'blocked' ? 'warning' : decision?.status === 'approved' ? 'success' : 'default'} variant={decision?.status === 'explicit_unclassified' ? 'outlined' : 'filled'} label={!decision ? 'Загрузка классификации…' : classificationLabel(decision.status)} />
          {decision?.confirmed && <><Chip size="small" variant="outlined" sx={roleChip(decision.confirmed.economicRole)} label={roleLabel(decision.confirmed.economicRole)} />{decision.confirmed.layer && <Chip size="small" sx={layerChip(decision.confirmed.layer)} label={layerLabel(decision.confirmed.layer)} />}</>}
        </Stack>}
      </Stack>
    </AccordionSummary>
    <AccordionDetails>
      {expanded && <Stack spacing={1} component="section" aria-label="Проверка операции">
        <Stack aria-label="Факты выбранной операции">{Object.entries(operation.facts).map(([key,value]) => <Typography key={key} sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{factLabel(key)}: {key === 'date' && typeof value === 'string' ? dateLabel(value) : String(value ?? 'не задано')}</Typography>)}</Stack>
        {!readOnly && (decision && <>
          {decision.status === 'stale' && <Alert severity="warning">Требует обновления. Обновите состояние перед новым решением. <Button onClick={onRefresh}>Обновить состояние</Button></Alert>}
          {decision.status === 'blocked' ? <Alert severity="warning">Редактирование недоступно</Alert> : <OperationEditor key={`${decision.decisionRevision}/${decision.status}`} operation={operation} scope={scope} decision={decision} onSaved={next => {onDecision?.(next);if(next.status!=='stale')onClose();}} onRefresh={onRefresh} />}
        </>)}
      </Stack>}
    </AccordionDetails>
  </Accordion>;
};

