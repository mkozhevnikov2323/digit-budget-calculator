import React, { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  TextField,
  Typography,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [login, { isLoading: isLoginLoading }] = useLoginMutation();
  const [registerMutation, { isLoading: isRegisterLoading }] =
    useRegisterMutation();

  const isAuthLoading = isLoginLoading || isRegisterLoading;

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

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };

  const handleMouseUpPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };

  const handleClickShowConfirmPassword = () =>
    setShowConfirmPassword((show) => !show);

  const handleMouseDownConfirmPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
  };

  const handleMouseUpConfirmPassword = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
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
          required
          disabled={isAuthLoading}
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

        {/* Password */}
        <FormControl
          fullWidth
          sx={{ mt: 2, width: '100%' }}
          variant="outlined"
          required
        >
          <InputLabel
            htmlFor="outlined-adornment-password"
            sx={{
              px: '5px',
              backgroundColor: 'white',
              color: errors.password ? '#d32f2f !important' : 'primary',
            }}
          >
            Пароль
          </InputLabel>

          <OutlinedInput
            id="outlined-adornment-password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            required
            endAdornment={
              <InputAdornment position="end">
                <IconButton
                  aria-label={
                    showPassword ? 'hide the password' : 'display the password'
                  }
                  onClick={handleClickShowPassword}
                  onMouseDown={handleMouseDownPassword}
                  onMouseUp={handleMouseUpPassword}
                  edge="end"
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            }
            disabled={isAuthLoading}
            {...register('password', {
              required: 'Обязательное поле',
              minLength: { value: 8, message: 'Минимум 8 символов' },
            })}
            error={!!errors.password}
          />
          {errors.password && (
            <Typography
              sx={{ fontSize: '12.5px', pt: '3px', pl: '14px' }}
              color="error"
            >
              {errors.password?.message}
            </Typography>
          )}
        </FormControl>

        {/* Confirm Password */}
        {isRegisterMode && (
          <FormControl
            fullWidth
            sx={{ mt: 3, width: '100%' }}
            variant="outlined"
            required
          >
            <InputLabel
              htmlFor="outlined-adornment-confirmPassword"
              sx={{
                px: '5px',
                backgroundColor: 'white',
                color: errors.confirmPassword
                  ? '#d32f2f !important'
                  : 'primary',
              }}
            >
              Подтверждение пароля
            </InputLabel>

            <OutlinedInput
              id="outlined-adornment-confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              fullWidth
              required
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label={
                      showConfirmPassword
                        ? 'hide the password'
                        : 'display the password'
                    }
                    onClick={handleClickShowConfirmPassword}
                    onMouseDown={handleMouseDownConfirmPassword}
                    onMouseUp={handleMouseUpConfirmPassword}
                    edge="end"
                  >
                    {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              }
              disabled={isAuthLoading}
              {...register('confirmPassword', {
                required: 'Обязательное поле',
                validate: (value) =>
                  value === watch('password') || 'Пароли не совпадают',
              })}
              error={!!errors.confirmPassword}
            />
            {errors.confirmPassword && (
              <Typography
                sx={{ fontSize: '12.5px', pt: '3px', pl: '14px' }}
                color="error"
              >
                {errors.confirmPassword?.message}
              </Typography>
            )}
          </FormControl>
        )}

        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={isAuthLoading || Object.keys(errors).length > 0}
          sx={{ mt: 3 }}
        >
          {isAuthLoading ? (
            <CircularProgress size={20} />
          ) : isRegisterMode ? (
            'Зарегистрироваться'
          ) : (
            'Войти'
          )}
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
