import { Alert, Box, Button, CircularProgress, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { type FieldErrors, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useEffect, useRef, useState } from 'react';
import { useAddExpenseMutation } from 'entities/Expense';
import {
  useAddUserCategoryMutation, useGetDefaultCategoriesQuery, useGetUserCategoriesQuery,
} from 'entities/ExpenseCategory';
import { useAddExpenseTitleMutation, useGetExpenseTitlesQuery } from 'entities/ExpenseTitle';
import { useAddRecipientMutation, useGetRecipientsQuery } from 'entities/Recipient';
import { RecipientField } from 'features/AddRecipients';
import { DateField } from 'shared/ui/DateField';
import { ExpensePositionRow } from './ExpensePositionRow';
import { getTodayDateString } from 'shared/lib/utils/date';
import {
  type BulkExpenseValues, createEmptyPosition, formatKopecks,
  isValidQuantity, MAX_BATCH_SIZE, priceToKopecks,
} from '../model/bulkExpense';

export type ExpenseSubmissionState = {
  isBusy: boolean;
  hasUncertainResult: boolean;
};

type AddExpenseFormProps = {
  onSubmissionStateChange?: (state: ExpenseSubmissionState) => void;
};

export const AddExpenseForm = ({ onSubmissionStateChange }: AddExpenseFormProps = {}) => {
  const { control, handleSubmit, reset, getValues, setError, clearErrors } = useForm<BulkExpenseValues>({
    defaultValues: { date: getTodayDateString(), recipient: '', positions: [createEmptyPosition()] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'positions' });
  const positions = useWatch({ control, name: 'positions' });
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const [expandedId, setExpandedId] = useState<string | null>(fields[0]?.id ?? null);
  const previousIds = useRef(new Set(fields.map((field) => field.id)));
  useEffect(() => {
    const added = fields.filter((field) => !previousIds.current.has(field.id));
    setExpandedId((current) => added.length
      ? added[added.length - 1].id
      : fields.some((field) => field.id === current) ? current : fields[0]?.id ?? null);
    previousIds.current = new Set(fields.map((field) => field.id));
  }, [fields]);
  const revealInvalidPosition = (errors: FieldErrors<BulkExpenseValues>) => {
    const index = fields.findIndex((_, i) => errors.positions?.[i]);
    if (index >= 0) setExpandedId(fields[index].id);
  };
  const [phase, setPhase] = useState<'idle' | 'saving' | 'failed'>('idle');
  const [savedCount, setSavedCount] = useState(0);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [validationMessage, setValidationMessage] = useState('');
  const [dictionaryWarning, setDictionaryWarning] = useState(false);
  // Guard synchronously, including the asynchronous RHF validation window.
  const submissionInFlight = useRef(false);
  const failedBatch = useRef(false);
  const synchronized = useRef({ categories: new Set<string>(), titles: new Set<string>(), recipients: new Set<string>() });

  const { data: defaultCategories = [] } = useGetDefaultCategoriesQuery();
  const { data: userCategories = [] } = useGetUserCategoriesQuery();
  const { data: recipients = [] } = useGetRecipientsQuery();
  const { data: expenseTitles = [] } = useGetExpenseTitlesQuery();
  const [addExpense] = useAddExpenseMutation();
  const [addUserCategory] = useAddUserCategoryMutation();
  const [addExpenseTitle] = useAddExpenseTitleMutation();
  const [addRecipient] = useAddRecipientMutation();

  const count = positions.reduce((sum, position) =>
    sum + (isValidQuantity(position.quantity) ? position.quantity : 0), 0);
  const subtotal = (position: BulkExpenseValues['positions'][number] | undefined) => {
    if (!position) return 0;
    const price = priceToKopecks(position.unitPrice);
    return price !== null && isValidQuantity(position.quantity) && position.quantity <= MAX_BATCH_SIZE
      ? price * position.quantity : 0;
  };
  const total = count <= MAX_BATCH_SIZE ? positions.reduce((sum, position) => sum + subtotal(position), 0) : 0;

  const syncDictionaries = async (data: BulkExpenseValues, confirmed: BulkExpenseValues['positions']) => {
    const synchronize = async (names: string[], known: string[], cached: Set<string>, write: (name: string) => Promise<unknown>) => {
      const results = await Promise.allSettled([...new Set(names)].filter((name) =>
        name && !known.includes(name) && !cached.has(name)).map(async (name) => {
        await write(name);
        cached.add(name);
      }));
      return results.some((result) => result.status === 'rejected');
    };
    const results = await Promise.all([
      synchronize(confirmed.map((p) => p.category), [...defaultCategories, ...userCategories].map((c) => c.name), synchronized.current.categories,
        (name) => addUserCategory({ name }).unwrap()),
      synchronize(confirmed.map((p) => p.title), expenseTitles.map((t) => t.name), synchronized.current.titles,
        (name) => addExpenseTitle({ name }).unwrap()),
      synchronize(confirmed.length ? [data.recipient] : [], recipients.map((r) => r.name), synchronized.current.recipients,
        (name) => addRecipient({ name }).unwrap()),
    ]);
    setDictionaryWarning(results.some(Boolean));
  };

  const onSubmit = async (data: BulkExpenseValues) => {
    const recordCount = data.positions.reduce((sum, p) => sum + p.quantity, 0);
    if (!data.positions.length || !Number.isSafeInteger(recordCount) || recordCount > MAX_BATCH_SIZE) {
      setValidationMessage(`В одном пакете допускается от 1 до ${MAX_BATCH_SIZE} расходов.`);
      return;
    }
    let invalid = false;
    data.positions.forEach((position, index) => {
      if (priceToKopecks(position.unitPrice) === null) {
        setError(`positions.${index}.unitPrice`, { message: 'Укажите положительную цену с точностью до копеек.' });
        if (!invalid) setExpandedId(fields[index].id);
        invalid = true;
      }
      if (!isValidQuantity(position.quantity)) {
        setError(`positions.${index}.quantity`, { message: 'Количество должно быть целым числом не меньше 1.' });
        if (!invalid) setExpandedId(fields[index].id);
        invalid = true;
      }
      if (!position.title.trim() || !position.category.trim()) {
        if (!invalid) setExpandedId(fields[index].id);
        invalid = true;
      }
    });
    if (invalid || !data.recipient.trim() || !data.date) {
      setValidationMessage('Заполните обязательные поля и проверьте цену и количество.');
      return;
    }
    setPhase('saving');
    setSuccessCount(null);
    setSavedCount(0);
    setDictionaryWarning(false);
    setValidationMessage('');
    const confirmed: BulkExpenseValues['positions'] = [];
    let saved = 0;
    try {
      for (const position of data.positions) {
        const amount = priceToKopecks(position.unitPrice)! / 100;
        for (let unit = 0; unit < position.quantity; unit += 1) {
          await addExpense({
            date: data.date, recipient: data.recipient, title: position.title,
            category: position.category, amount, comment: position.comment,
          }).unwrap();
          saved += 1;
          confirmed.push(position);
          setSavedCount(saved);
        }
      }
    } catch {
      failedBatch.current = true;
    }
    if (!failedBatch.current) {
      setSuccessCount(saved);
      reset({ date: data.date, recipient: '', positions: [createEmptyPosition()] });
    }
    await syncDictionaries(data, confirmed);
    setPhase(failedBatch.current ? 'failed' : 'idle');
  };

  const startNewEntry = () => {
    const { date, recipient } = getValues();
    reset({ date, recipient, positions: [createEmptyPosition()] });
    clearErrors();
    failedBatch.current = false;
    onSubmissionStateChange?.({ isBusy: false, hasUncertainResult: false });
    setPhase('idle');
    setSavedCount(0);
    setSuccessCount(null);
    setDictionaryWarning(false);
    setValidationMessage('');
  };

  return (
    <Box component="form" noValidate sx={{ mb: 4 }} onSubmit={async (event) => {
      event.preventDefault();
      if (submissionInFlight.current || failedBatch.current) return;
      submissionInFlight.current = true;
      onSubmissionStateChange?.({ isBusy: true, hasUncertainResult: false });
      try {
        await handleSubmit(onSubmit, (errors) => {
          revealInvalidPosition(errors);
          setValidationMessage('Заполните обязательные поля и проверьте цену и количество.');
        })(event);
      } finally {
        submissionInFlight.current = false;
        onSubmissionStateChange?.({ isBusy: false, hasUncertainResult: failedBatch.current });
      }
    }}>
      <Box component="fieldset" disabled={phase !== 'idle'} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: narrow ? '1fr' : '180px minmax(0, 1fr)', gap: 2 }}>
          <DateField name="date" control={control} required />
          <RecipientField name="recipient" control={control} />
        </Box>
        <Box sx={{ overflowX: narrow ? 'visible' : 'auto' }}>
          <Box sx={{ minWidth: narrow ? 0 : 900 }}>
            {fields.map((position, index) => (
              <ExpensePositionRow key={position.id} control={control} index={index}
                position={positions[index] ?? position} subtotal={subtotal(positions[index])}
                narrow={narrow} expanded={expandedId === position.id}
                onToggle={() => setExpandedId(expandedId === position.id ? null : position.id)}
                canRemove={fields.length > 1} onRemove={() => remove(index)} />
            ))}
          </Box>
        </Box>
        <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
        <Button type="button" disabled={fields.length >= MAX_BATCH_SIZE} onClick={() => append(createEmptyPosition())}>Добавить позицию</Button>
        <Typography>Количество позиций: {fields.length}</Typography>
        <Typography sx={{ mt: 2 }}>Количество расходов: {count}</Typography>
        <Typography>Итого: {count > MAX_BATCH_SIZE ? 'Превышен лимит пакета' : formatKopecks(total)}</Typography>
        {count > MAX_BATCH_SIZE && <Alert severity="error">В одном пакете допускается не более {MAX_BATCH_SIZE} расходов.</Alert>}
        {validationMessage && <Alert severity="error">{validationMessage}</Alert>}
        <Button type="submit" variant="contained" disabled={phase !== 'idle'} sx={{ mt: 2 }}>
          Сохранить {count} расходов
        </Button>
        </Box>
      </Box>
      {phase === 'saving' && <Stack direction="row" spacing={1} sx={{ mt: 2 }}><CircularProgress size={20} /><Typography>Подтверждено сохранено: {savedCount}</Typography></Stack>}
      {successCount !== null && <Alert severity="success" sx={{ mt: 2 }}>Сохранено расходов: {successCount}</Alert>}
      {phase === 'failed' && <>
        <Alert severity="error" sx={{ mt: 2 }}>Подтверждено сохранено: {savedCount}. Сохранение остановлено. Результат последнего запроса может быть неопределённым. Проверьте историю расходов. Повторная отправка этого пакета заблокирована.</Alert>
        <Button type="button" sx={{ mt: 1 }} onClick={startNewEntry}>Начать новый ввод</Button>
      </>}
      {dictionaryWarning && <Alert severity="warning" sx={{ mt: 2 }}>Не удалось обновить часть подсказок. Подтверждённые расходы сохранены; повторно отправлять их не нужно.</Alert>}
    </Box>
  );
};
