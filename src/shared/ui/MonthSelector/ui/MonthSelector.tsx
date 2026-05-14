import { Select, MenuItem, SelectChangeEvent, SxProps } from '@mui/material';
import { useState, useEffect } from 'react';

const RUSSIAN_MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

interface MonthSelectorProps {
  currentMonth?: number;
  onChangeMonth?: (month: number) => void;
  disabled?: boolean;
  sx?: SxProps;
}

export const MonthSelector = ({
  currentMonth,
  onChangeMonth,
  disabled = false,
  sx,
}: MonthSelectorProps) => {
  const [selectedMonth, setSelectedMonth] = useState<number>(
    currentMonth || new Date().getMonth() + 1,
  );

  useEffect(() => {
    if (currentMonth !== undefined) {
      setSelectedMonth(currentMonth);
    }
  }, [currentMonth]);

  const handleChange = (event: SelectChangeEvent<number>) => {
    const month = Number(event.target.value);
    setSelectedMonth(month);
    onChangeMonth?.(month);
  };

  return (
    <Select<number>
      value={selectedMonth}
      onChange={handleChange}
      size="small"
      disabled={disabled}
      sx={sx}
    >
      {RUSSIAN_MONTHS.map((monthName, index) => (
        <MenuItem
          key={index + 1}
          value={index + 1}
        >
          {monthName}
        </MenuItem>
      ))}
    </Select>
  );
};
