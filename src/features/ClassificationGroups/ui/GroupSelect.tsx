import { Autocomplete, createFilterOptions, TextField } from '@mui/material';
import type { Dataset, Group } from '../model/contract';
export const GroupSelect = ({
  groups,
  dataset,
  value,
  onChange,
  disabled = false,
  label,
}: {
  groups: readonly Group[];
  dataset: Dataset;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  label?: string;
}) => {
  const options = groups.filter(
    (g) => g.dataset === dataset && g.status === 'active',
  );
  return (
    <Autocomplete
      options={options}
      filterOptions={createFilterOptions<Group>({ limit: 100 })}
      value={options.find((g) => g.groupId === value) ?? null}
      disabled={disabled}
      getOptionLabel={(g) => g.name}
      isOptionEqualToValue={(a, b) => a.groupId === b.groupId}
      onChange={(_e, g) => onChange(g?.groupId ?? '')}
      renderInput={(params) => (
        <TextField
          {...params}
          label={
            label ??
            (dataset === 'expenses' ? 'Группа расходов' : 'Группа доходов')
          }
          helperText={
            options.length > 100
              ? 'Показаны первые 100 совпадений. Уточните поиск по названию.'
              : undefined
          }
          required
        />
      )}
    />
  );
};
export const groupStatus = (s: Group['status']) =>
  ({ active: 'Включена', disabled: 'Отключена', archived: 'В архиве' })[s];
export const diagnosticLabel = (s: string) =>
  ({
    ready: 'Готово к применению',
    disabled: 'Правило отключено',
    group_missing: 'Группа отсутствует или каталог не инициализирован',
    group_inactive: 'Группа отключена или архивная',
  })[s] ?? 'Недоступно';
