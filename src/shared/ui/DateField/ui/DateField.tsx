import { TextField } from '@mui/material';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';

type Props<T extends FieldValues = FieldValues> = {
  /** Имя поля формы (react-hook-form path), например 'date'. */
  name: Path<T>;
  /** Control из useForm(), к которому подключается поле. */
  control: Control<T>;
  /** Подпись над полем. По умолчанию 'Дата'. */
  label?: string;
  /** Делает поле обязательным и подключает валидацию required. */
  required?: boolean;
};

/**
 * Переиспользуемое поле ввода даты (type="date") для форм добавления/
 * редактирования дохода и расхода.
 *
 * Сам компонент не решает, какую дату подставить по умолчанию —
 * это делает вызывающая форма через `defaultValues` в useForm()
 * (см. `getTodayDateString` и `buildResetValuesKeepingDate` из
 * `shared/lib/utils/date`).
 *
 * @example
 * const { control } = useForm<FormData>({
 *   defaultValues: { date: getTodayDateString() },
 * });
 * <DateField name="date" control={control} />
 */
export const DateField = <T extends FieldValues = FieldValues>({
  name,
  control,
  label = 'Дата',
  required = false,
}: Props<T>) => {
  return (
    <Controller
      name={name}
      control={control}
      rules={required ? { required: 'Обязательное поле' } : undefined}
      render={({ field, fieldState }) => (
        <TextField
          type="date"
          label={label}
          required={required}
          fullWidth
          margin="normal"
          error={!!fieldState.error}
          helperText={fieldState.error?.message}
          {...field}
        />
      )}
    />
  );
};
