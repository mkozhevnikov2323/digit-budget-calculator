import { AnalyticsPageContext, useAnalyticsState } from 'features/AnalyticsState/model/useAnalyticsState';
import { Alert, Box, Container, Tab, Tabs } from '@mui/material';
import { Link, Outlet, useLocation } from 'react-router';
import { analyticsNavigation } from '../model/navigation';

const PlanningMemoryNotice=()=>{const [open]=useAnalyticsState('planningOpen',false);return open?<Container maxWidth="lg" sx={{pt:1}}><Alert severity="info">В памяти этой сессии есть несохранённый план бюджета. Переходы по вкладкам сохраняют ввод. Перезагрузка страницы или выход из сессии удалит его; используйте экспорт JSON на странице планирования.</Alert></Container>:null;};

export const AnalyticsLayout = () => {
  const location = useLocation();
  const pathname = location.pathname.replace(/\/+$/, '');
  const active = analyticsNavigation.find(item => item.path === pathname)?.path ?? false;
  return <Box sx={{ minWidth: 0 }}>
    <Container maxWidth="lg" component="nav" aria-label="Разделы аналитики" sx={{ pt: 2, minWidth: 0 }}>
      <Tabs value={active} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile
        aria-label="Страницы аналитики" sx={{ maxWidth: '100%', borderBottom: 1, borderColor: 'divider' }}>
        {analyticsNavigation.map(item => <Tab key={item.path} value={item.path} label={item.label}
          component={Link} to={item.path} aria-current={active === item.path ? 'page' : undefined} />)}
      </Tabs>
    </Container>
    <AnalyticsPageContext.Provider value="planning"><PlanningMemoryNotice /></AnalyticsPageContext.Provider>
    <Outlet />
  </Box>;
};
