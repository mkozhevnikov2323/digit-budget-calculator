import { Select, MenuItem, SelectChangeEvent, SxProps } from '@mui/material';
import { useState, useEffect } from 'react';

interface YearSelectorProps {
  currentYear?: number;
  yearRange?: number;
  onChangeYear?: (year: number) => void;
  disabled?: boolean;
  sx?: SxProps;
}

export const YearSelector = ({
  currentYear,
  yearRange = 3,
  onChangeYear,
  disabled = false,
  sx,
}: YearSelectorProps) => {
  const [selectedYear, setSelectedYear] = useState<number>(
    currentYear || new Date().getFullYear(),
  );

  useEffect(() => {
    if (currentYear !== undefined) {
      setSelectedYear(currentYear);
    }
  }, [currentYear]);

  const currentFullYear = new Date().getFullYear();
  const years = Array.from(
    { length: yearRange * 2 + 1 },
    (_, i) => currentFullYear - yearRange + i,
  );

  const handleChange = (event: SelectChangeEvent<number>) => {
    const year = Number(event.target.value);
    setSelectedYear(year);
    onChangeYear?.(year);
  };

  return (
    <Select<number>
      value={selectedYear}
      onChange={handleChange}
      size="small"
      disabled={disabled}
      sx={sx}
    >
      {years.map((year) => (
        <MenuItem
          key={year}
          value={year}
        >
          {year}
        </MenuItem>
      ))}
    </Select>
  );
};
