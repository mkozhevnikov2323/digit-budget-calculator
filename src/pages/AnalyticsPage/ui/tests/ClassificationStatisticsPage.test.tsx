import {render,screen} from '@testing-library/react';
import {AnalyticsFeaturePage} from '../AnalyticsFeaturePage';
jest.mock('features/HistoricalClassification/ui/HistoricalClassification',()=>({HistoricalClassification:()=>null}));
jest.mock('features/ClassificationStatistics/ui/RealClassificationStatistics',()=>({RealClassificationStatistics:({mode}:{mode:string})=><div aria-label="Statistics mode">{mode}</div>}));
it('keeps one page title and the existing calendar without technical top-level text for statistics',()=>{
 render(<AnalyticsFeaturePage mode="classification-stats"/>);expect(screen.getByRole('heading',{level:1,name:'Статистика классификации'})).toBeVisible();expect(screen.getAllByRole('heading')).toHaveLength(1);expect(screen.getByLabelText('Период')).toBeVisible();expect(screen.getByLabelText('Statistics mode')).toHaveTextContent('statistics');expect(screen.queryByText(/UTC|Полнота записи|Полнота классификации/)).not.toBeInTheDocument();
});
it('preserves the planning page content, calendar and explicit planning mode',()=>{
 render(<AnalyticsFeaturePage mode="planning"/>);expect(screen.getByRole('heading',{level:1,name:'Планирование бюджета'})).toBeVisible();expect(screen.getByLabelText('Период')).toBeVisible();expect(screen.getByLabelText('Statistics mode')).toHaveTextContent('planning');expect(screen.getByText(/Границы периода — UTC/)).toBeVisible();
});
