import { useRef, useState, type ReactNode } from 'react';
import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useGetDefaultCategoriesQuery, useGetUserCategoriesQuery } from 'entities/ExpenseCategory/api/expenseCategoryApi';
import { useGetExpenseTitlesQuery } from 'entities/ExpenseTitle/api/expenseTitleApi';
import { useGetDefaultSourcesQuery, useGetUserSourcesQuery } from 'entities/IncomeSource/api/sourceApi';
import { FINANCIAL_LAYERS, type FinancialLayer } from 'features/FinancialClassification/model/types';
import { layerLabel, roleLabel } from 'shared/lib/analytics/presentation';
import { INCOME_RULE_ROLES, type ClassificationRule, type IncomeRuleRole, type RuleInput } from '../model/contract';

type Values = { category: string; title: string; source: string; layer: FinancialLayer | ''; economicRole: IncomeRuleRole | '' };
const useOptions = (query: { currentData?: { name: string }[]; isFetching: boolean; isError: boolean; isSuccess: boolean; requestId?: string }) => {
  const [cachedOnMount] = useState(() => query.isSuccess && !query.isFetching ? query.requestId : undefined);
  return !query.isFetching && !query.isError && query.requestId !== cachedOnMount && Array.isArray(query.currentData)
    ? query.currentData.filter(row => row && typeof row.name === 'string').map(row => row.name) : [];
};
export const RuleEditor = ({ dataset, rule, busy, blocked, feedback, onClose, onSave }: {
  dataset: 'expenses' | 'incomes'; rule?: ClassificationRule; busy: boolean; blocked: boolean; feedback: ReactNode;
  onClose: () => void; onSave: (body: RuleInput) => Promise<void>;
}) => {
  const submitting = useRef(false);
  const form = useForm<Values>({ defaultValues: { category: rule?.dataset === 'expenses' ? rule.category : '', title: rule?.dataset === 'expenses' ? rule.title ?? '' : '',
    source: rule?.dataset === 'incomes' ? rule.source : '', layer: rule?.dataset === 'expenses' ? rule.layer : '', economicRole: rule?.dataset === 'incomes' ? rule.economicRole : '' }, mode: 'onChange' });
  const categories = useGetDefaultCategoriesQuery(undefined, { skip: dataset !== 'expenses', refetchOnMountOrArgChange: true });
  const userCategories = useGetUserCategoriesQuery(undefined, { skip: dataset !== 'expenses', refetchOnMountOrArgChange: true });
  const titles = useGetExpenseTitlesQuery(undefined, { skip: dataset !== 'expenses', refetchOnMountOrArgChange: true });
  const sources = useGetDefaultSourcesQuery(undefined, { skip: dataset !== 'incomes', refetchOnMountOrArgChange: true });
  const userSources = useGetUserSourcesQuery(undefined, { skip: dataset !== 'incomes', refetchOnMountOrArgChange: true });
  const categoryOptions = [...useOptions(categories), ...useOptions(userCategories)], titleOptions = useOptions(titles);
  const sourceOptions = [...useOptions(sources), ...useOptions(userSources)];
  const matchField = (name: 'category' | 'title' | 'source', label: string, names: string[], required: boolean) => <Controller name={name} control={form.control}
    rules={{ validate: value => !required || value.trim().length > 0 || 'Обязательное поле' }} render={({ field, fieldState }) =>
      <Autocomplete freeSolo options={[...new Set(names)]} inputValue={field.value} disabled={busy || blocked}
        onInputChange={(_event, value) => field.onChange(value)} onBlur={field.onBlur}
        renderInput={params => <TextField {...params} inputRef={field.ref} label={label} required={required} error={!!fieldState.error} helperText={fieldState.error?.message} />} />} />;
  const submit = form.handleSubmit(async values => {
    if (dataset === 'expenses' && values.category.trim() && FINANCIAL_LAYERS.some(layer => layer === values.layer) && values.layer)
      await onSave({ dataset, category: values.category.trim(), ...(values.title.trim() ? { title: values.title.trim() } : {}), economicRole: 'ordinary_expense', layer: values.layer, enabled: rule?.enabled ?? true });
    else if (dataset === 'incomes' && values.source.trim() && INCOME_RULE_ROLES.some(role => role === values.economicRole) && values.economicRole)
      await onSave({ dataset, source: values.source.trim(), economicRole: values.economicRole, layer: null, enabled: rule?.enabled ?? true });
  });
  return <Dialog open onClose={() => { if (!busy) onClose(); }} fullWidth maxWidth="sm" aria-labelledby="rule-editor-title">
    <form onSubmit={event => {
      if (submitting.current || busy || blocked) { event.preventDefault(); return; }
      submitting.current = true;
      void submit(event).finally(() => { submitting.current = false; });
    }}>
      <DialogTitle id="rule-editor-title">{rule ? 'Редактировать правило' : 'Добавить правило'}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {feedback}
        {dataset === 'expenses' ? <>
          {matchField('category', 'Категория', categoryOptions, true)}
          {matchField('title', 'Наименование', titleOptions, false)}
          <TextField select label="Группа расходов" required disabled={busy || blocked} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            {...form.register('layer', { validate: value => FINANCIAL_LAYERS.some(layer => layer === value) })}>
            <option value="">Не выбрано</option>{FINANCIAL_LAYERS.map(layer => <option key={layer} value={layer}>{layerLabel(layer)}</option>)}
          </TextField>
        </> : <>
          {matchField('source', 'Источник дохода', sourceOptions, true)}
          <TextField select label="Экономический тип" required disabled={busy || blocked} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
            {...form.register('economicRole', { validate: value => INCOME_RULE_ROLES.some(role => role === value) })}>
            <option value="">Не выбрано</option>{INCOME_RULE_ROLES.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
          </TextField>
        </>}
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={onClose}>Отмена</Button><Button type="submit" disabled={busy || blocked || form.formState.isSubmitting || !form.formState.isValid}>{busy ? 'Сохранение…' : 'Сохранить правило'}</Button></DialogActions>
    </form>
  </Dialog>;
};
