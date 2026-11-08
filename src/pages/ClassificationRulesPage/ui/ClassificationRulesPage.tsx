import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import { ruleScopeKey, useGetClassificationRulesQuery, useWriteClassificationRuleMutation, type RuleWriteAction } from 'features/ClassificationRules/api/rulesApi';
import { RuleEditor } from 'features/ClassificationRules/ui/RuleEditor';
import { ruleWriteFailure, type ClassificationRule, type RuleInput } from 'features/ClassificationRules/model/contract';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import { checkCredentialChange } from 'shared/api/credentialObservation';
import { layerLabel, roleLabel } from 'shared/lib/analytics/presentation';

const Rules = ({ owner }: { owner: VerifiedOwner }) => {
  const [dataset, setDataset] = useState<'expenses' | 'incomes'>('expenses');
  const query = useGetClassificationRulesQuery(owner, { refetchOnMountOrArgChange: true });
  const [write, mutation] = useWriteClassificationRuleMutation({ fixedCacheKey: `rule-write/${ruleScopeKey(owner)}` });
  const [editor, setEditor] = useState<{ dataset: 'expenses' | 'incomes'; rule?: ClassificationRule } | null>(null);
  const [deleting, setDeleting] = useState<ClassificationRule | null>(null), [notice, setNotice] = useState('');
  const inFlight = useRef(false), live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const current = () => live.current && isCurrentSession(owner.sessionGeneration) && !checkCredentialChange();
  const failure = ruleWriteFailure(mutation.error), busy = mutation.isLoading;
  const blocked = busy || !!failure?.unknown || query.isFetching || query.isError || !query.currentData;
  const close = () => { if (inFlight.current || busy) return; setEditor(null); setDeleting(null); if (!failure?.unknown) mutation.reset(); };
  const openEditor = (rule?: ClassificationRule) => { if (blocked) return; mutation.reset(); setNotice(''); setEditor({ dataset: rule?.dataset ?? dataset, rule }); };
  const run = async (action: RuleWriteAction) => {
    if (inFlight.current || blocked || !current()) return;
    inFlight.current = true; setNotice('');
    try { await write({ ...owner, ...action }).unwrap(); if (current()) { setEditor(null); setDeleting(null); } }
    catch { /* The session-keyed mutation result owns the safe error/unknown state. */ }
    finally { inFlight.current = false; }
  };
  const save = async (body: RuleInput) => {
    if (!editor?.rule) return run({ method: 'POST', body });
    return run({ method: 'PATCH', id: editor.rule._id, body: body.dataset === 'expenses'
      ? { category: body.category, title: body.title ?? null, economicRole: body.economicRole, layer: body.layer }
      : { source: body.source, economicRole: body.economicRole, layer: null } });
  };
  const refresh = async () => {
    try { await query.refetch().unwrap(); if (current()) { mutation.reset(); setNotice('Список обновлён. Проверьте результат предыдущей записи перед повторным сохранением.'); } }
    catch { if (current()) setNotice('Не удалось обновить список. Блокировка записи сохранена.'); }
  };
  const feedback = <>
    {failure && <Alert severity={failure.unknown ? 'warning' : 'error'}>{failure.message}</Alert>}
    {failure?.unknown && <Button disabled={busy || query.isFetching} onClick={() => void refresh()}>Обновить список без повторной записи</Button>}
    {notice && <Alert severity="info">{notice}</Alert>}
  </>;
  const label = (rule: ClassificationRule) => rule.dataset === 'expenses' ? `${rule.category}${rule.title ? ` · ${rule.title}` : ''}` : rule.source;
  const rows = query.currentData?.filter(rule => rule.dataset === dataset);
  return <Stack spacing={2}>
    <Button variant="contained" disabled={blocked} sx={{ alignSelf: 'flex-start' }} onClick={() => openEditor()}>Добавить правило</Button>
    {!editor && !deleting && feedback}
    {busy && <Typography role="status">Сохранение…</Typography>}
    <Tabs value={dataset} onChange={(_event, value: 'expenses' | 'incomes') => setDataset(value)} aria-label="Правила классификации">
      <Tab disabled={busy || !!editor || !!deleting} label="Расходы" value="expenses" id="rules-expenses" aria-controls="rules-panel" />
      <Tab disabled={busy || !!editor || !!deleting} label="Доходы" value="incomes" id="rules-incomes" aria-controls="rules-panel" />
    </Tabs>
    <Box role="tabpanel" id="rules-panel" aria-labelledby={`rules-${dataset}`}>
      {query.isLoading || query.isFetching || query.isUninitialized ? <Typography role="status">Загрузка правил…</Typography>
        : query.isError ? <Stack spacing={1}><Alert severity="error">Не удалось загрузить правила классификации.</Alert><Button onClick={() => void query.refetch()}>Повторить загрузку</Button></Stack>
        : !rows ? <Alert severity="error">Правила классификации недоступны.</Alert>
        : rows.length === 0 ? <Typography>Нет сохранённых правил {dataset === 'expenses' ? 'расходов' : 'доходов'}.</Typography>
        : <TableContainer><Table size="small" aria-label={dataset === 'expenses' ? 'Правила расходов' : 'Правила доходов'}>
          <TableHead><TableRow>{(dataset === 'expenses' ? ['Категория', 'Наименование', 'Группа расходов', 'Активность', 'Действия'] : ['Источник дохода', 'Экономический тип', 'Активность', 'Действия']).map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
          <TableBody>{rows.map(rule => <TableRow key={rule._id}>
            {rule.dataset === 'expenses' ? <><TableCell>{rule.category}</TableCell><TableCell>{rule.title ?? 'Все наименования'}</TableCell><TableCell>{layerLabel(rule.layer)}</TableCell></>
              : <><TableCell>{rule.source}</TableCell><TableCell>{roleLabel(rule.economicRole)}</TableCell></>}
            <TableCell><Chip size="small" color={rule.enabled ? 'success' : 'default'} label={rule.enabled ? 'Включено' : 'Выключено'} /></TableCell>
            <TableCell><Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
              <Button disabled={blocked} aria-label={`Редактировать правило ${label(rule)}`} onClick={() => openEditor(rule)}>Редактировать</Button>
              <Button disabled={blocked} aria-label={`${rule.enabled ? 'Отключить' : 'Включить'} правило ${label(rule)}`} onClick={() => void run({ method: 'PATCH', id: rule._id, body: { enabled: !rule.enabled } })}>{rule.enabled ? 'Отключить' : 'Включить'}</Button>
              <Button disabled={blocked} color="error" aria-label={`Удалить правило ${label(rule)}`} onClick={() => { mutation.reset(); setNotice(''); setDeleting(rule); }}>Удалить</Button>
            </Stack></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>}
    </Box>
    {editor && <RuleEditor key={editor.rule?._id ?? editor.dataset} dataset={editor.dataset} rule={editor.rule} busy={busy} blocked={!!failure?.unknown} feedback={feedback} onClose={close} onSave={save} />}
    <Dialog open={!!deleting} onClose={close} aria-labelledby="delete-rule-title" fullWidth maxWidth="sm">
      <DialogTitle id="delete-rule-title">Удалить правило?</DialogTitle>
      <DialogContent><Stack spacing={2}><Typography>{deleting && label(deleting)}</Typography><Typography>Правило будет удалено после подтверждения.</Typography>{feedback}</Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={close}>Отмена</Button><Button color="error" disabled={blocked} onClick={() => { if (deleting) void run({ method: 'DELETE', id: deleting._id }); }}>Удалить правило</Button></DialogActions>
    </Dialog>
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
