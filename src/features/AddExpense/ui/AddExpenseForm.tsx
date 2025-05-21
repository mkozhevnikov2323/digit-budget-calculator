import { Box, Button, TextField, Autocomplete, Stack } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useAddExpenseMutation } from 'entities/Expense';
import {
  useGetCategoriesQuery,
  useAddCategoryMutation,
} from 'entities/ExpenseCategory';
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

  const { data: categories = [] } = useGetCategoriesQuery();
  const { data: recipients = [] } = useGetRecipientsQuery();

  const [addExpense] = useAddExpenseMutation();
  const [addCategory] = useAddCategoryMutation();
  const [addRecipient] = useAddRecipientMutation();

  const onSubmit = async (data: FormData) => {
    if (!categories.includes(data.category)) {
      await addCategory(data.category);
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
      mb={2}
    >
      <Stack spacing={2}>
        <Controller
          name="amount"
          control={control}
          rules={{ required: true, min: 0.01 }}
          render={({ field }) => (
            <TextField
              {...field}
              type="number"
              label="Сумма"
              fullWidth
              required
            />
          )}
        />

        <Controller
          name="date"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              type="date"
              label="Дата"
              fullWidth
              InputLabelProps={{ shrink: true }}
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

        <Controller
          name="category"
          control={control}
          rules={{ required: true }}
          render={({ field }) => (
            <Autocomplete
              freeSolo
              options={categories}
              onChange={(_, value) => setValue('category', value || '')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Категория"
                  margin="normal"
                  fullWidth
                  required
                />
              )}
              inputValue={field.value}
              onInputChange={(_, value) => setValue('category', value || '')}
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
          name="comment"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label="Комментарий"
              multiline
              rows={2}
              fullWidth
            />
          )}
        />

        <Button
          type="submit"
          variant="contained"
          color="primary"
        >
          Добавить расход
        </Button>
      </Stack>
    </Box>
  );
};
