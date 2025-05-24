import { Box, Button, InputAdornment, TextField } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { useAddIncomeMutation } from 'entities/Income';
import {
  useAddUserSourceMutation,
  useGetDefaultSourcesQuery,
  useGetUserSourcesQuery,
} from 'entities/IncomeSource';
import { IncomeSourceField } from 'features/AddIncomeSource';

type FormData = {
  date: string;
  amount: number;
  source: string;
  comment?: string;
};

export const AddIncomeForm = () => {
  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      date: new Date().toISOString().slice(0, 10),
      amount: 0,
      source: '',
      comment: '',
    },
  });
  const { data: defaultSources = [] } = useGetDefaultSourcesQuery();
  const { data: userSources = [] } = useGetUserSourcesQuery();
  const [addIncome] = useAddIncomeMutation();
  const [addUserSource] = useAddUserSourceMutation();

  const allSources = [
    ...defaultSources.map((s) => s.name),
    ...userSources.map((s) => s.name),
  ];

  const onSubmit = async (data: FormData) => {
    if (data.source && !allSources.includes(data.source)) {
      await addUserSource({ name: data.source }).unwrap();
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
      <IncomeSourceField
        name="source"
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
        Добавить доход
      </Button>
    </Box>
  );
};
