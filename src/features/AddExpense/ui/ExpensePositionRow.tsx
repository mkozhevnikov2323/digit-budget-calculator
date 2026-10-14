import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import { useState } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { ExpenseCategoryField } from 'features/AddExpenseCategory';
import { ExpenseTitleField } from 'features/AddExpenseTitle';
import { AmountField } from 'shared/ui/AmountField';
import { type BulkExpenseValues, type ExpensePosition, formatKopecks, isValidQuantity } from '../model/bulkExpense';

type Props = {
  control: Control<BulkExpenseValues>;
  index: number;
  position: ExpensePosition;
  subtotal: number;
  narrow: boolean;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  canRemove: boolean;
};

export const ExpensePositionRow = ({
  control, index, position, subtotal, narrow, expanded, onToggle, onRemove, canRemove,
}: Props) => {
  const [commentOpen, setCommentOpen] = useState(false);
  const number = index + 1;
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', py: 1 }}>
      {narrow && (
        <Button type="button" fullWidth onClick={onToggle}
          aria-label={`${expanded ? 'Свернуть' : 'Раскрыть'} позицию ${number}`}
          aria-expanded={expanded} endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          sx={{ justifyContent: 'space-between', textAlign: 'left' }}>
          <Box>
            <Typography variant="subtitle2">Позиция {number}: {position.title || 'Новая позиция'}</Typography>
            <Typography variant="caption" color="text.secondary">
              Количество: {position.quantity || '—'} · Сумма: {formatKopecks(subtotal)}
              {position.comment ? ' · Есть комментарий' : ''}
            </Typography>
          </Box>
        </Button>
      )}
      {/* Keep one registered editor mounted across collapse and layout changes. */}
      <Box sx={{ display: narrow && !expanded ? 'none' : 'block' }}>
        <Box sx={{
          display: 'grid', gap: 1, alignItems: 'start',
          gridTemplateColumns: narrow ? '1fr' : 'minmax(160px, 2fr) minmax(160px, 1.6fr) 140px 180px 95px 72px',
          '& .MuiTextField-root': { mt: 0, mb: 0 },
          '& .MuiInputBase-root': { fontSize: '0.875rem' },
          '& .MuiInputBase-input': { py: 1.25 },
          '& .MuiAutocomplete-root .MuiInputBase-root': { py: 0.5 },
        }}>
          <ExpenseTitleField name={`positions.${index}.title`} control={control} />
          <ExpenseCategoryField name={`positions.${index}.category`} control={control} />
          <AmountField name={`positions.${index}.unitPrice`} control={control} label="Цена за штуку" />
          <Controller name={`positions.${index}.quantity`} control={control}
            rules={{ validate: (value) => isValidQuantity(value) || 'Количество должно быть целым числом не меньше 1.' }}
            render={({ field, fieldState }) => (
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <IconButton type="button" size="small" aria-label={`Уменьшить количество позиции ${number}`}
                  disabled={!isValidQuantity(field.value) || field.value <= 1}
                  onClick={() => field.onChange(Math.max(1, field.value - 1))}>−</IconButton>
                <TextField {...field} label="Количество" type="number" size="small"
                  value={Number.isNaN(field.value) ? '' : field.value}
                  onChange={(event) => field.onChange(event.target.value === '' ? NaN : Number(event.target.value))}
                  inputProps={{ min: 1, step: 1 }} error={!!fieldState.error} helperText={fieldState.error?.message} />
                <IconButton type="button" size="small" aria-label={`Увеличить количество позиции ${number}`}
                  onClick={() => field.onChange(isValidQuantity(field.value) ? field.value + 1 : 1)}>+</IconButton>
              </Stack>
            )} />
          <Typography variant="body2" sx={{ py: 1 }} aria-label={`Сумма позиции ${number}`}>
            Сумма позиции: {formatKopecks(subtotal)}
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <IconButton type="button" size="small" onClick={() => setCommentOpen(!commentOpen)}
              color={position.comment ? 'primary' : 'default'} aria-expanded={commentOpen}
              aria-label={`${commentOpen ? 'Свернуть' : 'Раскрыть'} комментарий позиции ${number}`}>
              <ChatBubbleOutlineIcon fontSize="small" />
            </IconButton>
            <IconButton type="button" size="small" aria-label={`Удалить позицию ${number}`}
              disabled={!canRemove} onClick={onRemove}><DeleteOutlineIcon fontSize="small" /></IconButton>
          </Stack>
        </Box>
        {!commentOpen && position.comment && <Typography variant="caption" color="text.secondary">Есть комментарий</Typography>}
        <Box sx={{ display: commentOpen ? 'block' : 'none', mt: 1 }}>
          <Controller name={`positions.${index}.comment`} control={control} render={({ field }) => (
            <TextField {...field} label="Комментарий" fullWidth size="small" />
          )} />
        </Box>
      </Box>
    </Box>
  );
};
