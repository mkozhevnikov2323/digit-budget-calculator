import {
  Autocomplete,
  Box,
  Button,
  InputAdornment,
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

type FormData = {
  amount: number;
  date: string;
  title: string;
  category: string;
  recipient: string;
  comment?: string;
};

export const AddExpenseForm = () => {
  const { control, handleSubmit, setValue, reset } = useForm<FormData>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      title: '',
      category: '',
      recipient: '',
      comment: '',
    },
  });
  const { data: defaultSources = [] } = useGetDefaultCategoriesQuery();
  const { data: userSources = [] } = useGetUserCategoriesQuery();
  const { data: recipients = [] } = useGetRecipientsQuery();

  const [addExpense] = useAddExpenseMutation();
  const [addUserCategory] = useAddUserCategoryMutation();
  const [addRecipient] = useAddRecipientMutation();

  const allSources = [
    ...defaultSources.map((s) => s.name),
    ...userSources.map((s) => s.name),
  ];

  const onSubmit = async (data: FormData) => {
    if (data.category && !allSources.includes(data.category)) {
      await addUserCategory({ name: data.category }).unwrap();
    }

    if (!recipients.includes(data.recipient)) {
      await addRecipient(data.recipient);
    }

    await addExpense(data);
    reset();
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
            {...field}
          />
        )}
      />
      <Controller
        name="amount"
        control={control}
        rules={{
          required: true,
          min: 0.01,
          validate: (value) =>
            Number(value) > 0 || 'Сумма должна быть больше 0',
        }}
        render={({ field }) => (
          <TextField
            type="text"
            label="Сумма"
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
        name="recipient"
        control={control}
        rules={{ required: true }}
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
      <Controller
        name="title"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <TextField
            {...field}
            label="Название"
            fullWidth
            required
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
        sx={{ mt: 2 }}
      >
        Добавить расход
      </Button>
    </Box>
  );
};
