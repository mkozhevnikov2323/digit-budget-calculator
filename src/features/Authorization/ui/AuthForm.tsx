import React, { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useForm, SubmitHandler } from 'react-hook-form';
import { errorMessageHandler } from 'shared/lib/utils/errorMessageHandler';

interface FormData {
  email: string;
  password: string;
  confirmPassword?: string;
}

export const AuthForm: React.FC = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>();

  const toggleMode = () => {
    setIsRegisterMode((prev) => !prev);
    setServerError(null);
  };

  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      setServerError(null);

      const endpoint = isRegisterMode ? '/signup' : '/signin';

      const response = await fetch(`http://localhost:3210${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          errorMessageHandler(result.message) || 'Что-то пошло не так',
        );
      }

      if (isRegisterMode) {
        console.log('✅ Пользователь зарегистрирован:', result);
      } else {
        console.log('✅ Пользователь вошёл в систему:', result);
        localStorage.setItem('token', result.token);
      }
    } catch (error) {
      console.error('Ошибка:', error);
      setServerError((error as Error).message);
    }
  };

  return (
    <Box
      maxWidth={400}
      mx="auto"
      mt={5}
      p={3}
      border="1px solid #ccc"
      borderRadius={2}
    >
      <Typography
        variant="h5"
        align="center"
        gutterBottom
      >
        {isRegisterMode ? 'Регистрация' : 'Вход'}
      </Typography>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        {/* Email */}
        <TextField
          fullWidth
          label="Электронная почта"
          margin="normal"
          {...register('email', {
            required: 'Обязательное поле',
            pattern: {
              value: /^\S+@\S+$/i,
              message: 'Некорректный формат email',
            },
          })}
          error={!!errors.email}
          helperText={errors.email?.message}
        />

        <TextField
          fullWidth
          label="Пароль"
          type="password"
          margin="normal"
          {...register('password', {
            required: 'Обязательное поле',
            minLength: { value: 8, message: 'Минимум 8 символов' },
          })}
          error={!!errors.password}
          helperText={errors.password?.message}
        />

        {isRegisterMode && (
          <TextField
            fullWidth
            label="Подтверждение пароля"
            type="password"
            margin="normal"
            {...register('confirmPassword', {
              required: 'Обязательное поле',
              validate: (value) =>
                value === watch('password') || 'Пароли не совпадают',
            })}
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
          />
        )}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          sx={{ mt: 2 }}
        >
          {isRegisterMode ? 'Зарегистрироваться' : 'Войти'}
        </Button>
      </form>

      <Button
        fullWidth
        variant="text"
        color="secondary"
        sx={{ mt: 2 }}
        onClick={toggleMode}
      >
        {isRegisterMode
          ? 'Уже есть аккаунт? Войти'
          : 'Нет аккаунта? Зарегистрироваться'}
      </Button>

      {serverError && (
        <Box sx={{ mb: 2 }}>
          <Typography color="error">{serverError}</Typography>
        </Box>
      )}
    </Box>
  );
};
