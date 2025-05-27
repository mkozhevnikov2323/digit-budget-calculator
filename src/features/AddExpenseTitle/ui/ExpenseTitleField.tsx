import {
  Autocomplete,
  TextField,
  Tooltip,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { useState } from 'react';
import { Controller, Control, FieldValues, Path } from 'react-hook-form';
import { useGetExpenseTitlesQuery } from 'entities/ExpenseTitle';

type Props<T extends FieldValues = FieldValues> = {
  name: Path<T>;
  control: Control<T>;
};

export const ExpenseTitleField = <T extends FieldValues = FieldValues>({
  name,
  control,
}: Props<T>) => {
  const { data: userExpenseTitles = [] } = useGetExpenseTitlesQuery();
  const [inputValue, setInputValue] = useState('');

  const userTitles = userExpenseTitles.map((s) => s.name);

  const options = [
    ...userTitles.map((n) => ({
      group: 'Используемые ранее наименования',
      label: n,
    })),
  ];

  return (
    <Controller
      name={name}
      control={control}
      rules={{ required: true }}
      render={({ field: { value, onChange }, fieldState }) => {
        const allOptions =
          inputValue && !options.some((opt) => opt.label === inputValue)
            ? [...options, { group: 'Новое', label: inputValue }]
            : options;

        const currentOption =
          value && allOptions.find((opt) => opt.label === value)
            ? allOptions.find((opt) => opt.label === value)
            : value
            ? { group: 'Новое', label: value }
            : null;

        return (
          <Autocomplete
            freeSolo
            selectOnFocus
            clearOnBlur
            handleHomeEndKeys
            options={allOptions}
            groupBy={(option) => option.group}
            getOptionLabel={(option) =>
              typeof option === 'string' ? option : option.label
            }
            value={currentOption}
            inputValue={inputValue}
            onInputChange={(_, newInputValue) => {
              setInputValue(newInputValue);
              if (newInputValue !== value) {
                onChange(newInputValue);
              }
            }}
            onChange={(_, newValue) => {
              let newVal: string = '';
              if (typeof newValue === 'string') {
                newVal = newValue;
              } else if (newValue && typeof newValue.label === 'string') {
                newVal = newValue.label;
              }
              onChange(newVal);
              setInputValue(newVal);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                required
                label="Наименование"
                placeholder="Выберите подходящее или введите новое"
                margin="normal"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error ? 'Поле обязательно' : ''}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      <Tooltip title="Выберите подходящее наименование расхода или впишите новое">
                        <InfoIcon sx={{ mr: 0.5 }} />
                      </Tooltip>
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderGroup={(params) => (
              <Box key={params.key}>
                <Typography
                  color="text.secondary"
                  variant="subtitle2"
                  sx={{ pl: 1, pt: 1 }}
                >
                  {params.group}
                </Typography>
                <Divider sx={{ mb: 1 }} />
                {params.children}
              </Box>
            )}
          />
        );
      }}
    />
  );
};
