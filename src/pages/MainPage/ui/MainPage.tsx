import React from 'react';
import { Box, Button, Typography, useTheme } from '@mui/material';
import CalculateOutlinedIcon from '@mui/icons-material/CalculateOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import { useAppDispatch } from 'app/providers/store/hooks';
import { openAuthModal, selectIsAuthenticated } from 'features/Authorization';
import { useSelector } from 'react-redux';

const features = [
  {
    icon: (
      <CalculateOutlinedIcon
        fontSize="large"
        color="primary"
      />
    ),
    title: 'Ведение доходов и расходов',
    description: 'Добавляйте и анализируйте ваши доходы и траты по категориям.',
  },
  {
    icon: (
      <TimelineOutlinedIcon
        fontSize="large"
        color="primary"
      />
    ),
    title: 'Аналитика и графики',
    description: 'Удобные графики для визуального отслеживания бюджета.',
  },
  {
    icon: (
      <ShowChartOutlinedIcon
        fontSize="large"
        color="primary"
      />
    ),
    title: 'История операций',
    description: 'Вся история операций всегда под рукой.',
  },
  {
    icon: (
      <DownloadOutlinedIcon
        fontSize="large"
        color="primary"
      />
    ),
    title: 'Экспорт в CSV',
    description: 'Выгружайте отчёты по своим финансам за любой период.',
  },
  {
    icon: (
      <AccountCircleOutlinedIcon
        fontSize="large"
        color="primary"
      />
    ),
    title: 'Профиль пользователя',
    description: 'Настройки учётной записи и персональные рекомендации.',
  },
];

export const MainPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const handleOpenAuthModal = () => dispatch(openAuthModal());
  const theme = useTheme();
  const isAuth = useSelector(selectIsAuthenticated);

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 64px)',
        minWidth: '100vw',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        background: `linear-gradient(${theme.palette.primary.light}, ${theme.palette.secondary.light}), 
                    url("/your-background.jpg") center/cover no-repeat`,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.7)',
          zIndex: 1,
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          maxWidth: 900,
          width: '100%',
          p: { xs: 2, md: 4 },
          backdropFilter: 'blur(2px)',
        }}
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent="center"
          flexDirection="column"
          gap="30px"
        >
          <Box textAlign="center">
            <Typography
              variant="h2"
              component="h1"
              color="primary"
              fontWeight={800}
              gutterBottom
            >
              Калькулятор бюджета
            </Typography>
            <Typography
              variant="h5"
              color="text.secondary"
              mb={4}
            >
              Управляйте своими финансами легко, прозрачно и эффективно
            </Typography>
          </Box>

          <Box>
            <Box
              display="flex"
              flexDirection="column"
              gap="20px"
              justifyContent="center"
            >
              {features.map((f) => (
                <Box
                  key={f.title}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  {f.icon}
                  <Typography
                    variant="h6"
                    mt={1}
                    fontWeight={700}
                  >
                    {f.title}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    textAlign="center"
                  >
                    {f.description}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {!isAuth && (
            <Box
              textAlign="center"
              mt={4}
            >
              <Button
                variant="contained"
                size="large"
                color="primary"
                onClick={handleOpenAuthModal}
                sx={{ px: 5, py: 2, fontSize: 20, fontWeight: 600 }}
                aria-label="Начать пользоваться калькулятором бюджета"
              >
                Начать пользоваться
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default MainPage;
