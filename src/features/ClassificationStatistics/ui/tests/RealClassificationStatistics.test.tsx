import { fireEvent, render, screen, within } from '@testing-library/react';
import {skipToken} from '@reduxjs/toolkit/query';
import { RealClassificationStatistics,RecordedStatisticsReport } from '../RealClassificationStatistics';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { useGetCoherentHistoryQuery } from 'features/HistoricalClassification/api/historyApi';
import { recordedCohort } from '../../model/tests/recordedFixtures';
import {STATUSES} from '../../model/statistics';
jest.mock('@mui/x-charts/PieChart',()=>({PieChart:()=> <div data-testid="pie-chart"/>}));
jest.mock('@mui/x-charts/BarChart',()=>({BarChart:()=> <div data-testid="bar-chart"/>}));
jest.mock('entities/User/model/useVerifiedOwner');
jest.mock('features/HistoricalClassification/api/historyApi', () => ({ useGetCoherentHistoryQuery: jest.fn() }));
const owner = jest.mocked(useVerifiedOwner), query = jest.mocked(useGetCoherentHistoryQuery), cohort = recordedCohort();
const result = (extra = {}) => ({ currentData: cohort, isFetching: false, isError: false, requestId: 'cohort1', refetch: jest.fn(), ...extra }) as ReturnType<typeof useGetCoherentHistoryQuery>;
beforeEach(() => { jest.clearAllMocks();owner.mockReturnValue({ status: 'verified', owner: { userId: cohort.history.owner, sessionGeneration: 1 } }); query.mockReturnValue(result()); });
const openPlanning=()=>fireEvent.click(screen.getByRole('button',{name:'Загрузить реальную статистику классификации'}));
it('automatically loads the selected period and shows compact summaries without manual loading or technical UI',()=>{
 render(<RealClassificationStatistics period={cohort.history.period}/>);
 expect(query.mock.calls[query.mock.calls.length-1]?.[0]).toMatchObject({userId:cohort.history.owner,sessionGeneration:1,period:cohort.history.period});
 const expenses=within(screen.getByRole('region',{name:'Расходы'})),incomes=within(screen.getByRole('region',{name:'Доходы'}));
 expect(expenses.getByText(/Общая сумма расходов:/)).toHaveTextContent('148,08');expect(incomes.getByText(/Общая сумма доходов:/)).toHaveTextContent('681,36');
 for(const card of [expenses,incomes]){expect(card.getByText('Количество операций: 12')).toBeVisible();expect(card.getByText('Классифицировано по количеству: 100,0%')).toBeVisible();expect(card.getByText('Классифицировано по сумме: 100,0%')).toBeVisible();}
 expect(screen.getAllByRole('table')).toHaveLength(2);expect(screen.queryByRole('table',{name:/Статусы и роли/})).not.toBeInTheDocument();
 expect(screen.queryByText(/неатомарные|Категория не назначает|Статусы и роли|нет знаменателя|Классификация записанной|ДЕМО/)).not.toBeInTheDocument();
 for(const name of ['Загрузить реальную статистику классификации','Закрыть реальную статистику','Заново проверить состав и факты периода'])expect(screen.queryByRole('button',{name})).not.toBeInTheDocument();
 expect(screen.queryByRole('table',{name:'Реальная месячная классификация'})).not.toBeInTheDocument();expect(screen.getAllByTestId('pie-chart')).toHaveLength(2);expect(screen.getAllByTestId('bar-chart')).toHaveLength(2);
});
it('uses approved coverage, retains five ordinary expense groups and partitions remaining statuses into the sixth group',()=>{
 const c=recordedCohort();c.decisions=c.decisions.map((d,i)=>{const status=STATUSES[Math.floor(i/2)%6];return {...d,status,storedState:status==='unreviewed'||status==='blocked'?null:status==='stale'?'approved':status,decisionRevision:status==='unreviewed'||status==='blocked'?null:1,confirmed:status==='approved'?d.confirmed:null};});
 render(<RecordedStatisticsReport cohort={c}/>);
 for(const name of ['Расходы','Доходы']){const card=within(screen.getByRole('region',{name}));expect(card.getByText('Классифицировано по количеству: 16,7%')).toBeVisible();expect(card.getByText('Классифицировано по сумме: 16,7%')).toBeVisible();}
 const rows=within(screen.getByRole('table',{name:'Группы расходов'})).getAllByRole('row');expect(rows).toHaveLength(7);expect(rows[1]).toHaveTextContent('Повседневные расходы');expect(rows[1]).toHaveTextContent('24,68');expect(within(rows[1]).getAllByRole('cell')[3]).toHaveTextContent(/^2$/);
 for(const row of rows.slice(2,6)){expect(within(row).getAllByRole('cell')[1]).toHaveTextContent('0,00');expect(within(row).getAllByRole('cell')[3]).toHaveTextContent(/^0$/);}
 expect(rows[6]).toHaveTextContent('Прочие расходы / без группы');expect(rows[6]).toHaveTextContent('123,40');expect(within(rows[6]).getAllByRole('cell')[3]).toHaveTextContent(/^10$/);
 expect(rows.map(r=>r.textContent).join(' ')).toMatch(/Нерегулярные расходы.*Непредвиденные расходы.*Крупные цели.*Долгосрочный капитал/);
});
it('displays distinct count and amount coverage from existing aggregates without rounding financial amounts',()=>{
 const c=recordedCohort();c.history={...c.history,operations:c.history.operations.map((op,i)=>i===0?{...op,kopecks:2468,facts:{...op.facts,amount:24.68}}:op)};c.decisions=c.decisions.map((d,i)=>i===0?{...d,status:'stale',confirmed:null}:d);
 render(<RecordedStatisticsReport cohort={c}/>);const card=within(screen.getByRole('region',{name:'Расходы'}));expect(card.getByText(/Общая сумма расходов/)).toHaveTextContent('160,42');expect(card.getByText('Классифицировано по количеству: 91,7%')).toBeVisible();expect(card.getByText('Классифицировано по сумме: 84,6%')).toBeVisible();
});
it('renders missing denominators as a dash and never invents complete coverage for an empty report',()=>{
 const c=recordedCohort();c.history={...c.history,operations:[]};c.decisions=[];render(<RecordedStatisticsReport cohort={c}/>);
 expect(screen.getAllByText('Количество операций: 0')).toHaveLength(2);expect(screen.getAllByText('Классифицировано по количеству: —')).toHaveLength(2);expect(screen.getAllByText('Классифицировано по сумме: —')).toHaveLength(2);expect(screen.queryByText(/100/)).not.toBeInTheDocument();
});
it('sorts categories by descending recorded amount then Russian name, independent of approved assignments',()=>{
 const c=recordedCohort();c.history={...c.history,operations:c.history.operations.map((op,i)=>op.dataset==='expenses'?{...op,facts:{...op.facts,category:i<4?'Яблоки':i<8?'Аптеки':'Транспорт'}}:op)};
 render(<RecordedStatisticsReport cohort={c}/>);const rows=within(screen.getByRole('table',{name:'Расходы по категориям'})).getAllByRole('row');expect(rows.slice(1).map(r=>within(r).getAllByRole('cell')[0].textContent)).toEqual(['Транспорт','Аптеки','Яблоки']);expect(rows[1]).toHaveTextContent('98,72');expect(within(rows[1]).getAllByRole('cell')[4]).toHaveTextContent(/^8$/);
});
it('changes query period automatically and never displays old-period data while loading or failing',()=>{
 const view=render(<RealClassificationStatistics period={cohort.history.period}/>),next=recordedCohort(2024);
 for(const extra of [{isFetching:true},{isError:true},{}]){query.mockReturnValue(result(extra));view.rerender(<RealClassificationStatistics period={next.history.period}/>);expect(query.mock.calls[query.mock.calls.length-1]?.[0]).toMatchObject({period:next.history.period});expect(screen.queryByRole('table')).not.toBeInTheDocument();expect(screen.queryByText(/148,08/)).not.toBeInTheDocument();}
 query.mockReturnValue(result({currentData:next}));view.rerender(<RealClassificationStatistics period={next.history.period}/>);expect(screen.getByRole('table',{name:'Группы расходов'})).toBeVisible();
});
it('hides cached totals during refresh and owner/session verification, including foreign currentData',()=>{
 const view=render(<RealClassificationStatistics period={cohort.history.period}/>);
 for(const extra of [{isFetching:true},{isError:true}]){query.mockReturnValue(result(extra));view.rerender(<RealClassificationStatistics period={cohort.history.period}/>);expect(screen.queryByRole('table')).not.toBeInTheDocument();}
 query.mockReturnValue(result());owner.mockReturnValue({status:'verifying'});view.rerender(<RealClassificationStatistics period={cohort.history.period}/>);expect(query.mock.calls[query.mock.calls.length-1]?.[0]).toBe(skipToken);expect(screen.queryByRole('table')).not.toBeInTheDocument();
 owner.mockReturnValue({status:'verified',owner:{userId:'b'.repeat(24),sessionGeneration:2}});view.rerender(<RealClassificationStatistics period={cohort.history.period}/>);expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('shows a simple error and explicit retry, while reconciliation failures still suppress every total',()=>{
 const r=result({isError:true});query.mockReturnValue(r);const view=render(<RealClassificationStatistics period={cohort.history.period}/>);expect(screen.getByText('Не удалось загрузить статистику')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Повторить'}));expect(r.refetch).toHaveBeenCalledTimes(1);
 const bad=recordedCohort();bad.decisions=bad.decisions.slice(1);query.mockReturnValue(result({currentData:bad}));view.rerender(<RealClassificationStatistics period={cohort.history.period}/>);expect(screen.queryByRole('table')).not.toBeInTheDocument();expect(screen.queryByText(/148,08/)).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Повторить'})).toBeVisible();
});
it('keeps planning opt-in with its existing close and recheck controls, never opens statistics cards',()=>{
 const view=render(<RealClassificationStatistics mode="planning" period={cohort.history.period}/>);expect(query.mock.calls[query.mock.calls.length-1]?.[0]).toBe(skipToken);expect(screen.queryByRole('region',{name:'Расходы'})).not.toBeInTheDocument();openPlanning();expect(query.mock.calls[query.mock.calls.length-1]?.[0]).toMatchObject({period:cohort.history.period});expect(screen.getByRole('region',{name:'Прогноз по записанной истории'})).toBeVisible();const r=query.mock.results[query.mock.results.length-1]!.value;fireEvent.click(screen.getByRole('button',{name:'Заново проверить состав и факты периода'}));expect(r.refetch).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Закрыть реальную статистику'}));expect(query.mock.calls[query.mock.calls.length-1]?.[0]).toBe(skipToken);view.rerender(<RealClassificationStatistics mode="planning" period={null}/>);expect(screen.getByRole('button',{name:'Загрузить реальную статистику классификации'})).toBeDisabled();
});
it('preserves the local plan even while the selected history period is temporarily invalid',async()=>{
 const view=render(<RealClassificationStatistics mode="planning" period={cohort.history.period}/>);fireEvent.click(screen.getByRole('button',{name:'Открыть локальный план'}));await screen.findByText(/У этого года ещё нет завершённых месяцев/);fireEvent.change(screen.getByLabelText('Повседневные расходы месяц 1'),{target:{value:'123.45'}});view.rerender(<RealClassificationStatistics mode="planning" period={null}/>);expect(screen.getByLabelText('Повседневные расходы месяц 1')).toHaveValue('123.45');expect(screen.queryByRole('table',{name:'Группы расходов'})).not.toBeInTheDocument();
});
