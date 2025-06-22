import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  TextField,
} from '@mui/material';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { useSelector } from 'react-redux';
import {
  useUpdateIncomeMutation,
  useDeleteIncomeMutation,
  IncomeSchema,
} from 'entities/Income';
import { IncomeSourceField } from 'features/AddIncomeSource';
import { selectIncomeById } from 'entities/Income';

type EditIncomeFormProps = {
  incomeId: string | number;
  onClose: () => void;
};

type IncomeFormData = Omit<IncomeSchema, 'id'>;

export const EditIncomeForm: React.FC<EditIncomeFormProps> = ({
  incomeId,
  onClose,
}) => {
  const income = useSelector(selectIncomeById(String(incomeId)));

  const [updateIncome] = useUpdateIncomeMutation();
  const [deleteIncome] = useDeleteIncomeMutation();

  const { control, handleSubmit } = useForm<IncomeFormData>({
    defaultValues: {
      date: income?.date.slice(0, 10) || '',
      amount: income?.amount || 0,
      source: income?.source || '',
      comment: income?.comment || '',
    },
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const onSubmit: SubmitHandler<IncomeFormData> = async (data) => {
    if (!income) return;

    await updateIncome({
      ...data,
      id: String(income._id),
    } as IncomeSchema);
    onClose();
  };

  const handleDelete = async () => {
    if (!income) return;
    await deleteIncome({ id: String(income._id) });
    setDeleteDialogOpen(false);
    onClose();
  };

  if (!income) return null;

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{ mb: 2, p: 1 }}
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
            required
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
        sx={{ mt: 2, mr: 2 }}
      >
        Сохранить изменения
      </Button>
      <Button
        variant="outlined"
        color="secondary"
        sx={{ mt: 2 }}
        onClick={() => setDeleteDialogOpen(true)}
      >
        Удалить доход
      </Button>
      {/* Todo rebase to new feature */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Удалить доход?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите удалить этот доход? Это действие нельзя
            отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            color="inherit"
          >
            Отмена
          </Button>
          <Button
            onClick={handleDelete}
            color="error"
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
