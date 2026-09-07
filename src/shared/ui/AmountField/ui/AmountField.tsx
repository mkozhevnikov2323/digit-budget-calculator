import { InputAdornment, TextField } from '@mui/material';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';

type Props<T extends FieldValues = FieldValues> = {
  /** Имя поля формы (react-hook-form path), например 'amount'. */
  name: Path<T>;
  /** Control из useForm(), к которому подключается поле. */
  control: Control<T>;
  /** Подпись над полем. По умолчанию 'Сумма'. */
  label?: string;
  /** Символ валюты в конце поля. По умолчанию '₽'. */
  currencySymbol?: string;
};

/**
 * Приводит "сырой" ввод пользователя к валидному числовому строковому виду.
 *
 * Правила:
 * - запятая заменяется на точку (десятичный разделитель);
 * - ведущие нули срезаются ("007" -> "7");
 * - все символы, кроме цифр и точки, удаляются;
 * - если точек больше одной, лишние склеиваются в дробную часть
 *   ("1.2.3" -> "1.23").
 *
 * @param rawValue - значение прямо из onChange нативного input
 * @returns очищенная строка, пригодная для дальнейшей валидации/парсинга
 */
const sanitizeAmountInput = (rawValue: string): string => {
  let val = rawValue.replace(',', '.');

  if (/^0[0-9]+$/.test(val)) {
    val = val.replace(/^0+/, '');
  }

  val = val.replace(/[^0-9.]/g, '');

  const parts = val.split('.');
  if (parts.length > 2) {
    val = parts[0] + '.' + parts.slice(1).join('');
  }

  return val;
};

/**
 * Переиспользуемое поле ввода денежной суммы для форм добавления/
 * редактирования дохода и расхода. Инкапсулирует санитизацию ввода
 * и правила валидации (обязательное поле, значение > 0).
 *
 * @example
 * <AmountField name="amount" control={control} />
 */
export const AmountField = <T extends FieldValues = FieldValues>({
  name,
  control,
  label = 'Сумма',
  currencySymbol = '₽',
}: Props<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={{
        required: 'Обязательное поле',
        min: 0.01,
        validate: (value) => Number(value) > 0 || 'Сумма должна быть больше 0',
      }}
      render={({ field, fieldState }) => (
        <TextField
          type="text"
          label={label}
          required
          fullWidth
          margin="normal"
          error={!!fieldState.error}
          helperText={fieldState.error?.message}
          inputProps={{
            inputMode: 'decimal',
            pattern: '[0-9]*[.,]?[0-9]*',
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="start">{currencySymbol}</InputAdornment>
            ),
          }}
          {...field}
          value={field.value === 0 ? '' : field.value}
          onChange={(e) => field.onChange(sanitizeAmountInput(e.target.value))}
        />
      )}
    />
  );
};
