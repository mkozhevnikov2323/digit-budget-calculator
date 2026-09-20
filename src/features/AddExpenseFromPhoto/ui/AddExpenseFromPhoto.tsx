import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import { useRef, useState, type ChangeEvent } from 'react';
import { AddExpenseForm, type ExpenseDraft } from 'features/AddExpense';
import { recognizeExpenseFromImage } from '../model/recognizeExpenseFromImage';
import type { ExpenseRecognizer } from '../model/types';

type RecognitionStatus = 'idle' | 'recognizing' | 'success' | 'error';

type AddExpenseFromPhotoProps = {
  onCancel: () => void;
  recognize?: ExpenseRecognizer;
};

export const AddExpenseFromPhoto = ({
  onCancel,
  recognize = recognizeExpenseFromImage,
}: AddExpenseFromPhotoProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<ExpenseDraft>();
  const [status, setStatus] = useState<RecognitionStatus>('idle');
  const recognitionRequestId = useRef(0);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const requestId = ++recognitionRequestId.current;
    setDraft(undefined);

    if (!file.type.startsWith('image/')) {
      setSelectedFile(null);
      setStatus('error');
      return;
    }

    setSelectedFile(file);
    setStatus('recognizing');

    try {
      const recognizedDraft = await recognize(file);
      if (recognitionRequestId.current !== requestId) return;

      setDraft(recognizedDraft);
      setStatus('success');
    } catch {
      if (recognitionRequestId.current !== requestId) return;

      setDraft(undefined);
      setStatus('error');
    }
  };

  const handleCancel = () => {
    recognitionRequestId.current += 1;
    setSelectedFile(null);
    setDraft(undefined);
    setStatus('idle');
    onCancel();
  };

  return (
    <Box>
      <Typography variant="h6">Добавить расход по фото</Typography>

      <Button
        component="label"
        variant="outlined"
        disabled={status === 'recognizing'}
        sx={{ mt: 2 }}
      >
        Выбрать изображение
        <input
          data-testid="expense-photo-input"
          hidden
          type="file"
          accept="image/*"
          disabled={status === 'recognizing'}
          onChange={handleFileChange}
        />
      </Button>

      {selectedFile && (
        <Typography sx={{ mt: 1 }}>{selectedFile.name}</Typography>
      )}

      {status === 'recognizing' && (
        <Box
          display="flex"
          alignItems="center"
          gap={1}
          sx={{ mt: 2 }}
        >
          <CircularProgress size={20} />
          <Typography>Распознаём изображение…</Typography>
        </Box>
      )}

      {status === 'error' && (
        <Alert
          severity="error"
          sx={{ mt: 2 }}
        >
          Не удалось распознать изображение. Выберите другой файл.
        </Alert>
      )}

      {status === 'success' && draft && (
        <Box sx={{ mt: 2 }}>
          <Typography>Проверьте распознанные данные перед сохранением.</Typography>
          <AddExpenseForm initialDraft={draft} />
        </Box>
      )}

      <Button
        color="inherit"
        onClick={handleCancel}
        sx={{ mt: 2 }}
      >
        Отмена
      </Button>
    </Box>
  );
};
