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
import {
  useGetDefaultSourcesQuery,
  useGetUserSourcesQuery,
} from 'entities/IncomeSource';

type Props<T extends FieldValues = FieldValues> = {
  name: Path<T>;
  control: Control<T>;
};

export const IncomeSourceField = <T extends FieldValues = FieldValues>({
  name,
  control,
}: Props<T>) => {
  const { data: defaultSources = [] } = useGetDefaultSourcesQuery();
  const { data: userSources = [] } = useGetUserSourcesQuery();
  const [inputValue, setInputValue] = useState('');

  const defaultNames = defaultSources.map((s) => s.name);
  const userNames = userSources.map((s) => s.name);

  const options = [
    ...defaultNames.map((n) => ({
      group: 'Стандартные источники дохода',
      label: n,
    })),
    ...userNames.map((n) => ({
      group: 'Пользовательские источники дохода',
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
                label="Источник дохода"
                placeholder="Выберите подходящий или введите новый"
                margin="normal"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error ? 'Поле обязательно' : ''}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      <Tooltip title="Выберите подходящую категорию дохода или впишите новую">
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
