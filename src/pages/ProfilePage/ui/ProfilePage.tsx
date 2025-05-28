import { Box, List, ListItem, ListItemText, Typography } from '@mui/material';
import React from 'react';

const ProfilePage = (): React.ReactNode => {
  return (
    <Box p={3}>
      <Typography variant="h5">Профиль пользователя</Typography>
      <Typography
        variant="subtitle1"
        mt={2}
      >
        {`(Раздел находится в разработке)`}
      </Typography>
      <Typography
        variant="subtitle1"
        mt={4}
      >
        В следующих релизах:
      </Typography>
      <List>
        <ListItem>
          <ListItemText primary="Смена пароля" />
        </ListItem>
        <ListItem>
          <ListItemText primary="Переключение темы" />
        </ListItem>
        <ListItem>
          <ListItemText primary="Редактирование профиля" />
        </ListItem>
        <ListItem>
          <ListItemText primary="Редактирование и удаление категорий доходов и расходов" />
        </ListItem>
        <ListItem>
          <ListItemText primary="Редактирование и удаление наименований и получателей" />
        </ListItem>
      </List>
    </Box>
  );
};

export default ProfilePage;
