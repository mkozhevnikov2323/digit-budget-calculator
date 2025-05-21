import {
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useGetBalanceQuery } from '../api/balanceApi';

export const BalanceCard = () => {
  const { data, isLoading, error } = useGetBalanceQuery();

  if (isLoading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">Ошибка при загрузке баланса</Alert>;
  }

  return (
    <Card>
      <CardContent>
        <Typography
          variant="h5"
          component="div"
          gutterBottom
        >
          Баланс
        </Typography>
        <Typography variant="body1">
          Доходы: <strong>{data?.income ?? 0} ₽</strong>
        </Typography>
        <Typography variant="body1">
          Расходы: <strong>{data?.expense ?? 0} ₽</strong>
        </Typography>
        <Typography variant="body1">
          Текущий баланс: <strong>{data?.balance ?? 0} ₽</strong>
        </Typography>
      </CardContent>
    </Card>
  );
};
