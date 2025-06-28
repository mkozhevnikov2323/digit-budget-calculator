import {
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useAddExpenseMutation } from 'entities/Expense';
import {
  useGetDefaultCategoriesQuery,
  useGetUserCategoriesQuery,
  useAddUserCategoryMutation,
} from 'entities/ExpenseCategory';
import { ExpenseCategoryField } from 'features/AddExpenseCategory';
import {
  useGetRecipientsQuery,
  useAddRecipientMutation,
} from 'entities/Recipient';
import { useState } from 'react';
import {
  useGetExpenseTitlesQuery,
  useAddExpenseTitleMutation,
} from 'entities/ExpenseTitle';
import { ExpenseTitleField } from 'features/AddExpenseTitle';
import { RecipientField } from 'features/AddRecipients';
import type { ErrorResponse } from 'shared/types/errorSchema';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';

type FormData = {
  amount: number;
  date: string;
  title: string;
  category: string;
  recipient: string;
  comment?: string;
};

export const AddExpenseForm = () => {
  const defaultValues = {
    date: new Date().toISOString().slice(0, 10),
    amount: 0,
    title: '',
    category: '',
    recipient: '',
    comment: '',
  };

  const {
    control,
    handleSubmit,
    reset,
    clearErrors,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({
    defaultValues: {
      ...defaultValues,
    },
  });

  const [successOpen, setSuccessOpen] = useState(false);

  const { data: defaultSources = [] } = useGetDefaultCategoriesQuery();
  const { data: userSources = [] } = useGetUserCategoriesQuery();
  const { data: recipients = [] } = useGetRecipientsQuery();
  const { data: expenseTitles = [] } = useGetExpenseTitlesQuery();

  const [addExpense, { error: serverError }] = useAddExpenseMutation();
  const [addUserCategory] = useAddUserCategoryMutation();
  const [addRecipient] = useAddRecipientMutation();
  const [addExpenseTitle] = useAddExpenseTitleMutation();

  const allSources = [
    ...defaultSources.map((s) => s.name),
    ...userSources.map((s) => s.name),
  ];
  const userTitles = [...expenseTitles.map((s) => s.name)];
  const userRecipients = [...recipients.map((s) => s.name)];

  const onSubmit = async (data: FormData) => {
    if (data.category && !allSources.includes(data.category)) {
      await addUserCategory({ name: data.category }).unwrap();
    }

    if (data.title && !userTitles.includes(data.title)) {
      await addExpenseTitle({ name: data.title }).unwrap();
    }

    if (data.recipient && !userRecipients.includes(data.recipient)) {
      await addRecipient({ name: data.recipient }).unwrap();
    }

    await addExpense(data);
    setSuccessOpen(true);
    clearErrors();
    reset({ ...defaultValues, date: data.date });
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ mb: 4 }}
    >
      <Controller
        name="date"
        control={control}
        render={({ field }) => (
          <TextField
            type="date"
            label="Дата"
            fullWidth
            margin="normal"
            error={!!errors.date}
            helperText={errors.date?.message}
            {...field}
          />
        )}
      />
      <Controller
        name="amount"
        control={control}
        rules={{
          required: 'Обязательное поле',
          min: 0.01,
          validate: (value) =>
            Number(value) > 0 || 'Сумма должна быть больше 0',
        }}
        render={({ field }) => (
          <TextField
            type="text"
            label="Сумма"
            required
            fullWidth
            margin="normal"
            error={!!errors.amount}
            helperText={errors.amount?.message}
            inputProps={{
              inputMode: 'decimal',
              pattern: '[0-9]*[.,]?[0-9]*',
            }}
            InputProps={{
              endAdornment: <InputAdornment position="start">₽</InputAdornment>,
            }}
            {...field}
            value={field.value === 0 ? '' : field.value}
            onChange={(e) => {
              let val = e.target.value.replace(',', '.');

              if (/^0[0-9]+$/.test(val)) {
                val = val.replace(/^0+/, '');
              }

              val = val.replace(/[^0-9.]/g, '');

              const parts = val.split('.');
              if (parts.length > 2) {
                val = parts[0] + '.' + parts.slice(1).join('');
              }
              field.onChange(val);
            }}
          />
        )}
      />

      <ExpenseTitleField
        name="title"
        control={control}
      />

      <RecipientField
        name="recipient"
        control={control}
      />

      <ExpenseCategoryField
        name="category"
        control={control}
      />
      <Controller
        name="comment"
        control={control}
        render={({ field }) => (
          <TextField
            label="Комментарий"
            fullWidth
            margin="normal"
            {...field}
          />
        )}
      />
      <Button
        type="submit"
        variant="contained"
        color="primary"
        disabled={isSubmitting}
        endIcon={isSubmitting ? <CircularProgress size={20} /> : null}
        sx={{ mt: 2 }}
      >
        Добавить расход
      </Button>

      {serverError && (
        <Box sx={{ mb: 2 }}>
          <Typography color="error">
            {((serverError as FetchBaseQueryError)?.data as ErrorResponse)
              ?.message ?? 'Что-то пошло не так'}
          </Typography>
        </Box>
      )}
      <Box position="relative">
        <Snackbar
          open={successOpen}
          autoHideDuration={1000}
          onClose={() => setSuccessOpen(false)}
          message="Расход добавлен!"
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ position: 'absolute' }}
        />
      </Box>
    </Box>
  );
};
