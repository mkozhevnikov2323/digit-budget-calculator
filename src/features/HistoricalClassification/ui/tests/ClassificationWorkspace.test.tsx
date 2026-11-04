import {createTheme} from '@mui/material';
import {roleChip,layerChip} from '../chipColors';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter,useLocation,useNavigate} from 'react-router';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {analyticsUIReducer} from 'features/AnalyticsState/model/slice';
import {AnalyticsPageContext} from 'features/AnalyticsState/model/useAnalyticsState';
import {ClassificationWorkspace} from '../ClassificationWorkspace';
import {selectedPeriod} from 'features/FinancialAnalytics/model/tests/fixtures';
import {useVerifiedOwner} from 'entities/User/model/useVerifiedOwner';
import {useGetCoherentHistoryQuery} from '../../api/historyApi';
import {putDecision} from '../../api/decisionClient';
import type {CoherentHistory} from '../../model/coherentHistory';
import type {ClassificationRead,ClassificationStatus} from '../../model/contract';
import type {CalendarPeriod} from 'features/FinancialAnalytics/model/period';
import {parseNavigation} from '../classificationNavigation';
jest.mock('entities/User/model/useVerifiedOwner');jest.mock('../../api/decisionClient',()=>({putDecision:jest.fn()}));
jest.mock('shared/api/baseApi',()=>({baseApi:{},apiBaseUrl:'https://fictional.invalid'}));
jest.mock('../../api/historyApi',()=>({useGetCoherentHistoryQuery:jest.fn(),useGetOwnedHistoryQuery:()=>{throw Error('No duplicate membership loader');},useReadOperationClassificationQuery:()=>{throw Error('No per-row GET');}}));
const query=jest.mocked(useGetCoherentHistoryQuery),put=jest.mocked(putDecision),owner=jest.mocked(useVerifiedOwner),refetch=jest.fn();
const statuses:ClassificationStatus[]=['unreviewed','approved','explicit_unclassified','cleared','stale','blocked'];
const makeCohort=(n=105):CoherentHistory=>{
 const operations=Array.from({length:n+30},(_,i)=>({dataset:i<n?'expenses' as const:'incomes' as const,operationId:i.toString(16).padStart(24,'0'),kopecks:100,timestamp:Date.parse('2024-02-10T00:00:00Z')+i,
 facts:{amount:1,date:new Date(Date.parse('2024-02-10T00:00:00Z')+i).toISOString(),...(i<n?{category:'Продукты',title:`Расход ${i}`,recipient:'Synthetic'}:{source:`Доход ${i-n}`})}}));
 const decisions=operations.map((op,i):ClassificationRead=>{const status=i<n?statuses[i%6]:'unreviewed';return {version:'classification-read-v1',dataset:op.dataset,operationId:op.operationId,status,storedState:status==='unreviewed'||status==='blocked'?null:status==='stale'?'approved':status,decisionRevision:status==='unreviewed'||status==='blocked'?null:1,confirmed:status==='approved'?{economicRole:'ordinary_expense',layer:'everyday'}:null,consistency:'observed_only_non_atomic'};});
 return {history:{owner:'a'.repeat(24),period:selectedPeriod(),operations},decisions,observationId:'one',observedAt:Date.now(),consistency:'observed_only_non_atomic'};
};
let cohort:CoherentHistory;
const Probe=()=>{const l=useLocation(),n=useNavigate();return <><output aria-label="URL">{l.search}</output><button onClick={()=>n(-1)}>Назад</button><button onClick={()=>n(1)}>Вперёд</button></>};
const show=(entry='/analytics/classification?dataset=expenses',period:CalendarPeriod=selectedPeriod())=>{
 const store=configureStore({reducer:{analyticsUI:analyticsUIReducer}});
 const Tree=({p}:{p:CalendarPeriod})=><Provider store={store}><AnalyticsPageContext.Provider value="classification"><MemoryRouter initialEntries={[entry]}><Probe/><ClassificationWorkspace period={p}/></MemoryRouter></AnalyticsPageContext.Provider></Provider>;
 return {...render(<Tree p={period}/>),Tree};
};
beforeEach(()=>{jest.clearAllMocks();cohort=makeCohort();owner.mockReturnValue({status:'verified',owner:{userId:'a'.repeat(24),sessionGeneration:1}});query.mockImplementation(()=>({currentData:cohort,requestId:'one',refetch} as ReturnType<typeof useGetCoherentHistoryQuery>));if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=> '12345678-1234-4234-8234-123456789abc'});});
it('uses the complete batch for counters and exact filters, not only 25 visible rows',()=>{
 show();expect(screen.getByRole('button',{name:'Все (105)'})).toBeVisible();expect(screen.getByRole('button',{name:'Не классифицировано (18)'})).toBeVisible();expect(screen.getByRole('button',{name:'Классифицировано (18)'})).toBeVisible();
 expect(screen.queryByRole('button',{name:'Сначала новые'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Обновить историю'})).not.toBeInTheDocument();expect(screen.getByText('Расход 0 · Продукты')).toBeVisible();expect(screen.queryByText('Расход 25 · Продукты')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Не классифицировано (18)'}));expect(screen.getByText('Расход 102 · Продукты')).toBeVisible();expect(screen.queryByText('Расход 2 · Продукты')).not.toBeInTheDocument();expect(screen.queryByText('Расход 4 · Продукты')).not.toBeInTheDocument();expect(refetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Классифицировано (18)'}));expect(screen.getByText('Расход 103 · Продукты')).toBeVisible();expect(screen.queryByText('Расход 0 · Продукты')).not.toBeInTheDocument();expect(put).not.toHaveBeenCalled();
});
it('direct URL/F5-style remount, numbered pages, independent tabs and back/forward work without refetch',()=>{
 const v=show('/analytics/classification?dataset=expenses&filter=all&page=4');expect(screen.getByText('Расход 75 · Продукты')).toBeVisible();expect(screen.queryByText('Расход 74 · Продукты')).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Перейти на страницу 5'}));expect(screen.getByText('Расход 100 · Продукты')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Назад'}));expect(screen.getByText('Расход 75 · Продукты')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Вперёд'}));expect(screen.getByText('Расход 100 · Продукты')).toBeVisible();
 fireEvent.click(screen.getByRole('tab',{name:'Доходы'}));expect(screen.getByText('Доход 0')).toBeVisible();fireEvent.click(screen.getByRole('tab',{name:'Расходы'}));expect(screen.getByText('Расход 100 · Продукты')).toBeVisible();expect(refetch).not.toHaveBeenCalled();
 const url=screen.getByLabelText('URL').textContent!;v.unmount();show('/analytics/classification'+url);expect(screen.getByText('Расход 100 · Продукты')).toBeVisible();
});
it('filter/period changes reset pagination, and an obsolete page clamps to the last available page',async()=>{
 const v=show('/analytics/classification?dataset=expenses&page=999');await waitFor(()=>expect(screen.getByLabelText('URL')).toHaveTextContent('page=5'));fireEvent.click(screen.getByRole('button',{name:'Не классифицировано (18)'}));expect(screen.getByText('Расход 0 · Продукты')).toBeVisible();expect(screen.getByLabelText('URL')).toHaveTextContent('page=1');
 fireEvent.click(screen.getByRole('button',{name:'Все (105)'}));fireEvent.click(screen.getByRole('button',{name:'Перейти на страницу 4'}));cohort={...cohort,history:{...cohort.history,period:{...selectedPeriod(),startInclusive:Date.parse('2024-01-01T00:00:00.000Z'),firstDate:'2024-01-01'}}};v.rerender(<v.Tree p={cohort.history.period}/>);await waitFor(()=>expect(screen.getByLabelText('URL')).toHaveTextContent('page=1'));
});
it.each(['approved','explicit_unclassified'] as const)('confirmed %s updates counters/removes the row in pending with one PUT and no read',async(state)=>{
 const next:ClassificationRead={...cohort.decisions[0],status:state,storedState:state,decisionRevision:1,confirmed:state==='approved'?{economicRole:'ordinary_expense',layer:'everyday'}:null};put.mockResolvedValue({ok:true,decision:next});show('/analytics/classification?dataset=expenses&filter=pending');fireEvent.click(screen.getByRole('button',{name:'Расход 0'}));
 if(state==='approved'){fireEvent.change(screen.getByLabelText('Группа расходов'),{target:{value:'everyday'}});fireEvent.click(screen.getByRole('button',{name:'Классифицировать'}));}else fireEvent.click(screen.getByRole('button',{name:'Оставить без классификации'}));
 await waitFor(()=>expect(screen.queryByText('Расход 0 · Продукты')).not.toBeInTheDocument());expect(screen.getByRole('button',{name:'Не классифицировано (17)'})).toBeVisible();expect(screen.getByRole('button',{name:`Классифицировано (${state==='approved'?19:18})`})).toBeVisible();expect(put).toHaveBeenCalledTimes(1);expect(refetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Все (105)'}));expect(screen.getByText('Расход 0 · Продукты')).toBeVisible();
});
it('unknown PUT retains the operation and counters and exposes only explicit safe read refresh',async()=>{
 put.mockResolvedValue({ok:false,code:'unknown'});show('/analytics/classification?dataset=expenses&filter=pending');fireEvent.click(screen.getByRole('button',{name:'Расход 0'}));fireEvent.change(screen.getByLabelText('Группа расходов'),{target:{value:'everyday'}});fireEvent.click(screen.getByRole('button',{name:'Классифицировать'}));await screen.findByText(/Запись могла сохраниться/);expect(screen.getByText('Расход 0 · Продукты')).toBeVisible();expect(screen.getByRole('button',{name:'Не классифицировано (18)'})).toBeVisible();expect(refetch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Обновить состояние без повторной записи'}));expect(refetch).toHaveBeenCalledTimes(1);expect(put).toHaveBeenCalledTimes(1);
});
it('incomplete batches and owner transition publish no counters or old operations',()=>{
 query.mockReturnValue({isError:true,refetch} as ReturnType<typeof useGetCoherentHistoryQuery>);const v=show();expect(screen.queryByRole('button',{name:'Все (105)'})).not.toBeInTheDocument();owner.mockReturnValue({status:'verifying'});v.rerender(<v.Tree p={selectedPeriod()}/>);expect(screen.queryByText('Расход 0 · Продукты')).not.toBeInTheDocument();
});
it('validates URL navigation without accepting secrets or unexpected dataset/filter values',()=>{expect(parseNavigation(new URLSearchParams('dataset=other&filter=stale&page=-4'))).toMatchObject({dataset:'incomes',filter:'all',page:1});expect(parseNavigation(new URLSearchParams('page=4&page=5'))).toHaveProperty('page',1);});

it('empty approved filter displays a genuine empty result instead of unknown data as zero',()=>{
 cohort={...cohort,decisions:cohort.decisions.map(d=>({...d,status:'unreviewed',storedState:null,decisionRevision:null,confirmed:null}))};show('/analytics/classification?dataset=expenses&filter=approved');expect(screen.getByText('Классифицированных операций за выбранный период нет')).toBeVisible();expect(screen.getByRole('button',{name:'Не классифицировано (105)'})).toBeVisible();expect(refetch).not.toHaveBeenCalled();
});
it('role and layer colors are stable, distinct and use separate visual treatments',()=>{
 const theme=createTheme();const roles=['ordinary_expense','ordinary_income','loan_issuance','loan_repayment','refund','internal_transfer','capital_movement'];const layers=['everyday','irregular','emergency','major_goals','long_term_capital'];expect(new Set(roles.map(r=>roleChip(r)(theme).color)).size).toBe(7);expect(new Set(layers.map(l=>layerChip(l)(theme).backgroundColor)).size).toBe(5);expect(roleChip('ordinary_expense')(theme)).toEqual(roleChip('ordinary_expense')(theme));expect(roleChip('ordinary_expense')(theme)).not.toEqual(layerChip('everyday')(theme));
});
