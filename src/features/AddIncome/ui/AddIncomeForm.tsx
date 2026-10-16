// import { Box, Button, InputAdornment, TextField } from '@mui/material';
// import { useForm, Controller } from 'react-hook-form';
// import { useAddIncomeMutation } from 'entities/Income';
// import {
//   useAddUserSourceMutation,
//   useGetDefaultSourcesQuery,
//   useGetUserSourcesQuery,
// } from 'entities/IncomeSource';
// import { IncomeSourceField } from 'features/AddIncomeSource';

// type FormData = {
//   date: string;
//   amount: number;
//   source: string;
//   comment?: string;
// };

// export const AddIncomeForm = () => {
//   const { control, handleSubmit, reset } = useForm<FormData>({
//     defaultValues: {
//       date: new Date().toISOString().slice(0, 10),
//       amount: 0,
//       source: '',
//       comment: '',
//     },
//   });
//   const { data: defaultSources = [] } = useGetDefaultSourcesQuery();
//   const { data: userSources = [] } = useGetUserSourcesQuery();
//   const [addIncome] = useAddIncomeMutation();
//   const [addUserSource] = useAddUserSourceMutation();

//   const allSources = [
//     ...defaultSources.map((s) => s.name),
//     ...userSources.map((s) => s.name),
//   ];

//   const onSubmit = async (data: FormData) => {
//     if (data.source && !allSources.includes(data.source)) {
//       await addUserSource({ name: data.source }).unwrap();
//     }
//     await addIncome(data);
//     reset();
//   };

//   return (
//     <Box
//       component="form"
//       onSubmit={handleSubmit(onSubmit)}
//       sx={{ mb: 4 }}
//     >
//       <Controller
//         name="date"
//         control={control}
//         render={({ field }) => (
//           <TextField
//             type="date"
//             label="Дата"
//             fullWidth
//             margin="normal"
//             {...field}
//           />
//         )}
//       />
//       <Controller
//         name="amount"
//         control={control}
//         rules={{
//           required: true,
//           min: 0.01,
//           validate: (value) =>
//             Number(value) > 0 || 'Сумма должна быть больше 0',
//         }}
//         render={({ field }) => (
//           <TextField
//             type="text"
//             label="Сумма"
//             fullWidth
//             margin="normal"
//             required
//             inputProps={{
//               inputMode: 'decimal',
//               pattern: '[0-9]*[.,]?[0-9]*',
//             }}
//             InputProps={{
//               endAdornment: <InputAdornment position="start">₽</InputAdornment>,
//             }}
//             {...field}
//             value={field.value === 0 ? '' : field.value}
//             onChange={(e) => {
//               let val = e.target.value.replace(',', '.');

//               if (/^0[0-9]+$/.test(val)) {
//                 val = val.replace(/^0+/, '');
//               }

//               val = val.replace(/[^0-9.]/g, '');

//               const parts = val.split('.');
//               if (parts.length > 2) {
//                 val = parts[0] + '.' + parts.slice(1).join('');
//               }
//               field.onChange(val);
//             }}
//           />
//         )}
//       />
//       <IncomeSourceField
//         name="source"
//         control={control}
//       />
//       <Controller
//         name="comment"
//         control={control}
//         render={({ field }) => (
//           <TextField
//             label="Комментарий"
//             fullWidth
//             margin="normal"
//             {...field}
//           />
//         )}
//       />
//       <Button
//         type="submit"
//         variant="contained"
//         color="primary"
//         sx={{ mt: 2 }}
//       >
//         Добавить доход
//       </Button>
//     </Box>
//   );
// };

import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useAddIncomeMutation } from 'entities/Income';
import {
  useAddUserSourceMutation,
  useGetDefaultSourcesQuery,
  useGetUserSourcesQuery,
} from 'entities/IncomeSource';
import { IncomeSourceField } from 'features/AddIncomeSource';
import { DateField } from 'shared/ui/DateField';
import { AmountField } from 'shared/ui/AmountField';
import {
  getTodayDateString,
  buildResetValuesKeepingDate,
} from 'shared/lib/utils/date';

type FormData = {
  date: string;
  amount: number;
  source: string;
  comment?: string;
};

const emptyValues: Omit<FormData, 'date'> = {
  amount: 0,
  source: '',
  comment: '',
};

export type IncomeSubmissionState = {
  isBusy: boolean;
  hasUncertainResult: boolean;
};

type AddIncomeFormProps = {
  onSubmissionStateChange?: (state: IncomeSubmissionState) => void;
};

export const AddIncomeForm = ({ onSubmissionStateChange }: AddIncomeFormProps = {}) => {
  const submissionInFlight = useRef(false);
  const uncertainResult = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [hasUncertainResult, setHasUncertainResult] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [sourceWarning, setSourceWarning] = useState(false);
  const { control, handleSubmit, reset } = useForm<FormData>({
    defaultValues: {
      ...emptyValues,
      date: getTodayDateString(),
    },
  });
  const { data: defaultSources = [] } = useGetDefaultSourcesQuery();
  const { data: userSources = [] } = useGetUserSourcesQuery();
  const [addIncome] = useAddIncomeMutation();
  const [addUserSource] = useAddUserSourceMutation();

  const allSources = [
    ...defaultSources.map((s) => s.name),
    ...userSources.map((s) => s.name),
  ];

  const onSubmit = async (data: FormData) => {
    try {
      await addIncome(data).unwrap();
    } catch {
      // A lost response does not prove that the income was not persisted.
      uncertainResult.current = true;
      setHasUncertainResult(true);
      return;
    }

    reset(buildResetValuesKeepingDate(emptyValues, data.date));
    setIsSaved(true);

    if (data.source && !allSources.includes(data.source)) {
      try {
        await addUserSource({ name: data.source }).unwrap();
      } catch {
        setSourceWarning(true);
      }
    }
  };

  const acknowledgeUncertainResult = () => {
    if (submissionInFlight.current) return;
    uncertainResult.current = false;
    setHasUncertainResult(false);
    onSubmissionStateChange?.({ isBusy: false, hasUncertainResult: false });
  };

  return (
    <Box
      component="form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (submissionInFlight.current || uncertainResult.current) return;
        // Lock before RHF validation yields, and notify close handlers immediately.
        submissionInFlight.current = true;
        setIsBusy(true);
        setIsSaved(false);
        setSourceWarning(false);
        onSubmissionStateChange?.({ isBusy: true, hasUncertainResult: false });
        try {
          await handleSubmit(onSubmit)(event);
        } finally {
          submissionInFlight.current = false;
          setIsBusy(false);
          onSubmissionStateChange?.({
            isBusy: false,
            hasUncertainResult: uncertainResult.current,
          });
        }
      }}
      sx={{ mb: 4 }}
    >
      <Box
        component="fieldset"
        disabled={isBusy || hasUncertainResult}
        sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
      >
        <DateField
          name="date"
          control={control}
        />

        <AmountField
          name="amount"
          control={control}
        />

        <IncomeSourceField
          name="source"
          control={control}
        />
        <Controller
          name="comment"
          control={control}
          render={({ field }) => (
            <TextField
              label="Комментарий"
              fullWidth
              margin="normal"
              {...field}
            />
          )}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
        >
          Добавить доход
        </Button>
      </Box>
      {isBusy && (
        <Stack direction="row" spacing={1} role="status" sx={{ mt: 2 }}>
          <CircularProgress size={20} />
          <Typography>{isSaved ? 'Обновление источника дохода...' : 'Сохранение дохода...'}</Typography>
        </Stack>
      )}
      {isSaved && <Alert severity="success" sx={{ mt: 2 }}>Доход сохранён.</Alert>}
      {sourceWarning && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Не удалось обновить подсказку источника. Доход сохранён; повторно отправлять его не нужно.
        </Alert>
      )}
      {hasUncertainResult && (
        <>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Не удалось подтвердить сохранение. Доход мог уже сохраниться.
            Проверьте историю доходов перед повторным вводом. Повторная отправка заблокирована.
          </Alert>
          <Button type="button" onClick={acknowledgeUncertainResult} sx={{ mt: 1 }}>
            История проверена, продолжить ввод
          </Button>
        </>
      )}
    </Box>
  );
};
