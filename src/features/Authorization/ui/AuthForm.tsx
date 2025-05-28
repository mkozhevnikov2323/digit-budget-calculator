import React, { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useForm, SubmitHandler } from 'react-hook-form';
import { errorMessageHandler } from 'shared/lib/utils/errorMessageHandler';
import { useLoginMutation, useRegisterMutation } from '../api/authApi';
import { closeAuthModal, setAuthenticated } from '../model/authorizationSlice';
import { useDispatch } from 'react-redux';
import { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { ErrorResponse } from 'shared/types/errorSchema';
import { useNavigate } from 'react-router';

interface FormData {
  email: string;
  password: string;
  confirmPassword?: string;
}

export const AuthForm: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [login] = useLoginMutation();
  const [registerMutation] = useRegisterMutation();

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
      let response;
      if (isRegisterMode) {
        response = await registerMutation({
          email: data.email,
          password: data.password,
        }).unwrap();
        response = await login({
          email: data.email,
          password: data.password,
        }).unwrap();
      } else {
        response = await login({
          email: data.email,
          password: data.password,
        }).unwrap();
      }

      localStorage.setItem('token', response.token);

      dispatch(setAuthenticated(true));
      navigate('/income');
      dispatch(closeAuthModal());
    } catch (error) {
      const errMessage = errorMessageHandler(
        ((error as FetchBaseQueryError)?.data as ErrorResponse)?.message ??
          'Что-то пошло не так',
      );
      setServerError(errMessage);
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
