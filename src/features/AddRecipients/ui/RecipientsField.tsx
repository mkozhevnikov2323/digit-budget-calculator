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
import { useGetRecipientsQuery } from 'entities/Recipient';

type Props<T extends FieldValues = FieldValues> = {
  name: Path<T>;
  control: Control<T>;
};

export const RecipientField = <T extends FieldValues = FieldValues>({
  name,
  control,
}: Props<T>) => {
  const { data: userRecipients = [] } = useGetRecipientsQuery();
  const [inputValue, setInputValue] = useState('');

  const userNamesRecipients = userRecipients.map((s) => s.name);

  const options = [
    ...userNamesRecipients.map((n) => ({
      group: 'Используемые ранее получатели',
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
                label="Получатель"
                placeholder="Выберите подходящего или введите нового"
                margin="normal"
                fullWidth
                error={!!fieldState.error}
                helperText={fieldState.error ? 'Поле обязательно' : ''}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      <Tooltip title="Выберите подходящего получателя или впишите нового">
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
