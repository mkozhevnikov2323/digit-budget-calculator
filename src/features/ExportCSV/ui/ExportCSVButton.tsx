import { Button } from '@mui/material';
import { IncomeSchema } from 'entities/Income';

export interface ExportCSVButtonProps {
  data?: IncomeSchema[];
  filename?: string;
}

export const ExportCSVButton = ({
  data = [],
  filename = 'export.csv',
}: ExportCSVButtonProps) => {
  const handleExport = () => {
    if (!data.length) return;

    const headers = Object.keys(data[0]);

    const csvRows = [
      headers.join(','),
      ...data.map((row) =>
        headers.map((field) => JSON.stringify(row[field] ?? '')).join(','),
      ),
    ];
    const csvContent = csvRows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outlined"
      size="small"
      onClick={handleExport}
    >
      Экспорт в CSV
    </Button>
  );
};
