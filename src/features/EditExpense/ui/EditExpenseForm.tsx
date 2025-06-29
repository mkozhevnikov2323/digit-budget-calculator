import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  InputAdornment,
} from '@mui/material';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import { useSelector } from 'react-redux';
import {
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  ExpenseSchema,
} from 'entities/Expense';
import { selectExpenseById } from 'entities/Expense';
import { ExpenseCategoryField } from 'features/AddExpenseCategory';
import { ExpenseTitleField } from 'features/AddExpenseTitle';
import { RecipientField } from 'features/AddRecipients';

type EditExpenseFormProps = {
  expenseId: string | number;
  onClose: () => void;
};

type ExpenseFormData = Omit<ExpenseSchema, 'id' | '_id'>;

export const EditExpenseForm: React.FC<EditExpenseFormProps> = ({
  expenseId,
  onClose,
}) => {
  const expense = useSelector(selectExpenseById(expenseId));

  const [updateExpense] = useUpdateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();

  const { control, handleSubmit } = useForm<ExpenseFormData>({
    defaultValues: {
      date: expense?.date?.slice(0, 10) || '',
      amount: expense?.amount || 0,
      title: expense?.title || '',
      category: expense?.category || '',
      recipient: expense?.recipient || '',
      comment: expense?.comment || '',
    },
  });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const onSubmit: SubmitHandler<ExpenseFormData> = async (data) => {
    console.log('data', data);
    if (!expense) return;
    await updateExpense({
      ...data,
      id: String(expense._id),
    } as ExpenseSchema);
    onClose();
  };

  const handleDelete = async () => {
    if (!expense) return;
    await deleteExpense({ id: String(expense._id) });
    setDeleteDialogOpen(false);
    onClose();
  };

  if (!expense) return null;

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
            type="number"
            label="Сумма"
            fullWidth
            margin="normal"
            required
            inputProps={{
              inputMode: 'decimal',
              step: '0.01',
              min: 0.01,
            }}
            InputProps={{
              endAdornment: <InputAdornment position="start">₽</InputAdornment>,
            }}
            {...field}
            value={field.value === 0 ? '' : field.value}
            onChange={(e) => {
              const val = e.target.value.replace(',', '.');
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
        Удалить расход
      </Button>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Удалить расход?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите удалить этот расход? Это действие нельзя
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
