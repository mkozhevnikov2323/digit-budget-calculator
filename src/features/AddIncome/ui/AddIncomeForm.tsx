import { Box, Button, TextField, Autocomplete } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import {
  useAddIncomeMutation,
  useAddSourceMutation,
  useGetSourcesQuery,
} from 'entities/Income';

type FormData = {
  date: string;
  amount: number;
  source: string;
  comment?: string;
};

export const AddIncomeForm = () => {
  const { control, handleSubmit, setValue, reset } = useForm<FormData>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      source: '',
      comment: '',
    },
  });

  const { data: sources = [] } = useGetSourcesQuery();
  const [addIncome] = useAddIncomeMutation();
  const [addSource] = useAddSourceMutation();

  const onSubmit = async (data: FormData) => {
    if (!sources.includes(data.source)) {
      await addSource(data.source);
    }
    await addIncome(data);
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
        rules={{ required: true, min: 0.01 }}
        render={({ field }) => (
          <TextField
            type="number"
            label="Сумма"
            fullWidth
            margin="normal"
            {...field}
          />
        )}
      />
      <Controller
        name="source"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Autocomplete
            freeSolo
            options={sources}
            onChange={(_, value) => setValue('source', value || '')}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Источник"
                margin="normal"
                fullWidth
                {...field}
              />
            )}
          />
        )}
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
        Добавить доход
      </Button>
    </Box>
  );
};
