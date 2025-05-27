import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Snackbar,
  TextField,
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
    setValue,
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

  const [addExpense] = useAddExpenseMutation();
  const [addUserCategory] = useAddUserCategoryMutation();
  const [addRecipient] = useAddRecipientMutation();
  const [addExpenseTitle] = useAddExpenseTitleMutation();

  const allSources = [
    ...defaultSources.map((s) => s.name),
    ...userSources.map((s) => s.name),
  ];

  const onSubmit = async (data: FormData) => {
    if (data.category && !allSources.includes(data.category)) {
      await addUserCategory({ name: data.category }).unwrap();
    }

    if (!expenseTitles.includes(data.title)) {
      await addExpenseTitle(data.title);
    }

    if (!recipients.includes(data.recipient)) {
      await addRecipient(data.recipient);
    }

    await addExpense(data);
    setSuccessOpen(true);
    reset(defaultValues);
    clearErrors();
  };

  console.log('errors', errors);

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
      <Controller
        name="title"
        control={control}
        // rules={{ required: 'Обязательное поле' }}
        render={({ field }) => (
          <Autocomplete
            freeSolo
            options={expenseTitles}
            onChange={(_, value) => setValue('title', value || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Наименование"
                margin="normal"
                fullWidth
                required
              />
            )}
            inputValue={field.value}
            onInputChange={(_, value) => setValue('title', value || '')}
          />
        )}
      />
      <Controller
        name="recipient"
        control={control}
        render={({ field }) => (
          <Autocomplete
            freeSolo
            options={recipients}
            onChange={(_, value) => setValue('recipient', value || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Получатель"
                margin="normal"
                fullWidth
                required
              />
            )}
            inputValue={field.value}
            onInputChange={(_, value) => setValue('recipient', value || '')}
          />
        )}
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
      <Snackbar
        open={successOpen}
        autoHideDuration={2000}
        onClose={() => setSuccessOpen(false)}
        message="Расход добавлен!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};
