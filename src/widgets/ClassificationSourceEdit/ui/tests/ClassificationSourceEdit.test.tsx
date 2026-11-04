import {configureStore} from '@reduxjs/toolkit';
import {Provider} from 'react-redux';
import {MemoryRouter,Routes,Route,useLocation} from 'react-router';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import type {BaseQueryFn,FetchArgs,FetchBaseQueryError} from '@reduxjs/toolkit/query';
import {baseApi} from 'shared/api/baseApi';
import {VerifiedOwnerContext} from 'entities/User/model/useVerifiedOwner';
import {reducer as expenses,setExpenses} from 'entities/Expense/model/expenseSlice';
import {reducer as income,setIncome} from 'entities/Income/model/incomeSlice';
import {analyticsUIReducer,setValue} from 'features/AnalyticsState/model/slice';
import {AnalyticsPageContext} from 'features/AnalyticsState/model/useAnalyticsState';
import {ClassificationWorkspace} from 'features/HistoricalClassification/ui/ClassificationWorkspace';
import {selectedPeriod} from 'features/FinancialAnalytics/model/tests/fixtures';
import {ClassificationSourceEdit} from '../ClassificationSourceEdit';
import type {SourceEditTarget} from 'features/HistoricalClassification/model/sourceEdit';

const mockTransport=jest.fn<ReturnType<BaseQueryFn<string|FetchArgs,unknown,FetchBaseQueryError>>,[string|FetchArgs]>();
jest.mock('shared/api/baseApi',()=>{
 const {createApi}=jest.requireActual<typeof import('@reduxjs/toolkit/query/react')>('@reduxjs/toolkit/query/react');
 return {apiBaseUrl:'https://fictional.invalid',baseApi:createApi({reducerPath:'api',baseQuery:(arg:string|FetchArgs)=>mockTransport(arg),endpoints:()=>({}),tagTypes:['Expense','Income','Classification','Balance','ExpenseCategory','Recipients','ExpenseTitles','Source']})};
});
const owner='a'.repeat(24),id=(i:number)=>i.toString(16).padStart(24,'0'),period=selectedPeriod();
type Dataset='expenses'|'incomes';
const target=(dataset:Dataset='expenses'):SourceEditTarget=>({dataset,operationId:id(25),ownerId:owner,sessionGeneration:1,firstDate:period.firstDate,lastDate:period.lastDate});
type SyntheticRow={_id:string;owner:string;amount:number;date:string;comment:string;title?:string;category?:string;recipient?:string;source?:string};
const initialRows=(dataset:Dataset):SyntheticRow[]=>Array.from({length:30},(_,i)=>({_id:id(i),owner,amount:10+i,date:'2024-02-10T00:00:00.000Z',comment:`Comment ${i}`,...(dataset==='expenses'?{title:`Расход ${i}`,recipient:'Synthetic recipient',category:'Synthetic category'}:{source:`Доход ${i}`})}));
let rows:{expenses:ReturnType<typeof initialRows>;incomes:ReturnType<typeof initialRows>},changed:Set<string>,missing:boolean,patchError:boolean;
const method=(a:string|FetchArgs)=>typeof a==='string'?'GET':a.method??'GET';
const url=(a:string|FetchArgs)=>typeof a==='string'?a:a.url;
const mutationCalls=()=>mockTransport.mock.calls.filter(([a])=>['PATCH','DELETE','PUT'].includes(method(a)));
const reads=()=>mockTransport.mock.calls.filter(([a])=>url(a)==='/classifications/history/read');
const singleReads=()=>reads().filter(([a])=>typeof a!=='string'&&(a.body as {operations:unknown[]}).operations.length===1);
const Location=()=>{const l=useLocation();return <output aria-label="Route">{l.pathname}{l.search}</output>};
const stores:ReturnType<typeof makeStore>[]=[];
const makeStore=()=>configureStore({reducer:{expenses,income,analyticsUI:analyticsUIReducer,[baseApi.reducerPath]:baseApi.reducer},middleware:g=>g().concat(baseApi.middleware)});
const show=(dataset:Dataset='expenses',state?:unknown,userId=owner)=>{
 const store=makeStore();stores.push(store);
 // Current table contains a DIFFERENT operation and month, not the selected row.
 store.dispatch(setExpenses({expenses:[{_id:id(99),date:'2026-11-01',amount:1,title:'Wrong',category:'Wrong',recipient:'Wrong'}],page:1,total:1,limit:20}));
 store.dispatch(setIncome({incomes:[{_id:id(99),date:'2026-11-01',amount:1,source:'Wrong'}],page:1,total:1,limit:20}));
 store.dispatch(setValue({scope:`${owner}/1`,page:'classification',field:'selection',value:{kind:'month',year:'2024',month:2,start:'',end:''}}));
 const entry={pathname:'/analytics/classification',search:`?dataset=${dataset}&filter=approved&page=2`};
 const tree=(uid:string,generation=1)=><Provider store={store}><VerifiedOwnerContext.Provider value={{status:'verified',owner:{userId:uid,sessionGeneration:generation}}}><MemoryRouter initialEntries={[entry]}><Location/>{state!==undefined?<ClassificationSourceEdit target={state as SourceEditTarget} onClose={jest.fn()}/>:<Routes>
  <Route path="/analytics/classification" element={<AnalyticsPageContext.Provider value="classification"><ClassificationWorkspace period={period}/></AnalyticsPageContext.Provider>}/>
 </Routes>}</MemoryRouter></VerifiedOwnerContext.Provider></Provider>;
 return {...render(tree(userId)),store,tree};
};
let network:jest.SpyInstance,scrollTo:jest.SpyInstance;
beforeEach(()=>{
 rows={expenses:initialRows('expenses'),incomes:initialRows('incomes')};changed=new Set();missing=false;patchError=false;Object.defineProperty(window,'scrollY',{configurable:true,value:600});scrollTo=jest.spyOn(window,'scrollTo').mockImplementation((_x,_y)=>{Object.defineProperty(window,'scrollY',{configurable:true,value:_y});});mockTransport.mockReset();network=jest.spyOn(globalThis,'fetch').mockImplementation(()=>{throw Error('Real network forbidden');});
 mockTransport.mockImplementation(async a=>{
  const path=url(a),m=method(a);
  if(m==='PATCH'){
   if(patchError)return {error:{status:503,data:{message:'Synthetic unavailable'}}};
   const [dataset,operationId]=path.slice(1).split('/') as [Dataset,string];const i=rows[dataset].findIndex(r=>r._id===operationId);if(i<0)return {error:{status:404,data:{}}};
   rows[dataset][i]={...rows[dataset][i],...(typeof a==='string'?{}:a.body)};rows[dataset][i].date=new Date(rows[dataset][i].date).toISOString();rows[dataset][i].amount=Number(rows[dataset][i].amount);changed.add(`${dataset}/${operationId}`);return {data:{}};
  }
  if(path==='/classifications/history/read'&&typeof a!=='string'){
   const body=a.body as {startInclusive:number;endExclusive:number;operations:{dataset:Dataset;operationId:string}[]};
   if(missing&&body.operations.length===1)return {error:{status:404,data:{}}};
   return {data:{version:'classification-history-read-v1',window:{startInclusive:body.startInclusive,endExclusive:body.endExclusive},coverage:'requested_identities_only',consistency:'observed_only_non_atomic',returnedCount:body.operations.length,operations:body.operations.map(op=>{
    const r=rows[op.dataset].find(row=>row._id===op.operationId)!;const stale=changed.has(`${op.dataset}/${op.operationId}`);
    return {...op,facts:{amount:{format:'binary64-roundtrip-decimal',value:String(r.amount)},date:r.date,dateEpochMs:Date.parse(r.date),comment:{kind:'value',value:r.comment},...(op.dataset==='expenses'?{title:r.title,category:r.category,recipient:r.recipient}:{source:r.source})},classification:{version:'classification-read-v1',...op,status:stale?'stale':'approved',storedState:'approved',decisionRevision:1,confirmed:stale?null:{economicRole:op.dataset==='expenses'?'ordinary_expense':'ordinary_income',layer:op.dataset==='expenses'?'everyday':null},consistency:'observed_only_non_atomic'}};
   })}};
  }
  for(const dataset of ['expenses','incomes'] as const)if(path.startsWith(`/${dataset}?`)){const selected=rows[dataset].filter(r=>Date.parse(r.date)>=period.startInclusive&&Date.parse(r.date)<period.endExclusive);return {data:{[dataset]:selected,total:selected.length,page:1,limit:100}};}
  return {data:[]};
 });
});
afterEach(()=>{cleanup();stores.splice(0).forEach(s=>s.dispatch(baseApi.util.resetApiState()));network.mockRestore();scrollTo.mockRestore();});
it.each(['expenses','incomes'] as const)('opens the exact %s operation over classification, cancel preserves URL, page, period, scroll and sends no mutation or history refresh',async dataset=>{
 const view=show(dataset),before=JSON.stringify(rows),selection=view.store.getState().analyticsUI.pages.classification?.selection;
 fireEvent.click(await screen.findByRole('button',{name:dataset==='expenses'?'Расход 25':'Доход 25'}));
 fireEvent.click(screen.getByRole('button',{name:'Редактировать операцию'}));
 await screen.findByLabelText(/Сумма/);expect(screen.getByLabelText(/Сумма/)).toHaveValue(dataset==='expenses'?35:'35');expect(screen.getByLabelText('Дата')).toHaveValue('2024-02-10');expect(screen.getByLabelText('Комментарий')).toHaveValue('Comment 25');
 expect(screen.getByLabelText('Route')).toHaveTextContent(`/analytics/classification?dataset=${dataset}&filter=approved&page=2`);
 expect(singleReads()).toHaveLength(1);const a=singleReads()[0][0] as FetchArgs;expect(a.body).toMatchObject({operations:[{dataset,operationId:id(25)}]});
 expect(view.store.getState().expenses.list?.[0]._id).toBe(id(99));expect(view.store.getState().income.list?.[0]._id).toBe(id(99));
 const readCount=reads().length;fireEvent.change(screen.getByLabelText('Комментарий'),{target:{value:'Unsaved synthetic draft'}});fireEvent.click(screen.getByRole('button',{name:'close'}));await screen.findByRole('button',{name:dataset==='expenses'?'Расход 25':'Доход 25'});
 expect(screen.getByLabelText('Route')).toHaveTextContent(`dataset=${dataset}&filter=approved&page=2`);expect(view.store.getState().analyticsUI.pages.classification?.selection).toEqual(selection);expect(mutationCalls()).toHaveLength(0);expect(JSON.stringify(rows)).toBe(before);expect(reads()).toHaveLength(readCount);expect(window.scrollY).toBe(600);expect(scrollTo).not.toHaveBeenCalled();
});
it.each(['expenses','incomes'] as const)('saving %s uses the existing PATCH once, then rereads and excludes stale decisions from approved',async dataset=>{
 show(dataset);fireEvent.click(await screen.findByRole('button',{name:dataset==='expenses'?'Расход 25':'Доход 25'}));fireEvent.click(screen.getByRole('button',{name:'Редактировать операцию'}));await screen.findByLabelText(/Сумма/);
 const readCount=reads().length;expect(screen.getByLabelText('Route')).toHaveTextContent(`/analytics/classification?dataset=${dataset}&filter=approved&page=2`);
 fireEvent.change(screen.getByLabelText(/Сумма/),{target:{value:'42.25'}});fireEvent.click(screen.getByRole('button',{name:'Сохранить изменения'}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(screen.getByLabelText('Route')).toHaveTextContent(`/analytics/classification?dataset=${dataset}&filter=approved&page=2`);
 await screen.findByRole('button',{name:'Классифицировано (29)'});expect(reads()).toHaveLength(readCount+1);expect(window.scrollY).toBe(600);expect(screen.queryByRole('button',{name:dataset==='expenses'?'Расход 25':'Доход 25'})).not.toBeInTheDocument();expect(mutationCalls()).toHaveLength(1);expect(method(mutationCalls()[0][0])).toBe('PATCH');expect(url(mutationCalls()[0][0])).toBe(`/${dataset}/${id(25)}`);
 fireEvent.click(screen.getByRole('button',{name:'Все (30)'}));fireEvent.click(screen.getByRole('button',{name:'Перейти на страницу 2'}));const row=screen.getByRole('button',{name:dataset==='expenses'?'Расход 25':'Доход 25'});expect(within(row).getByText('Требует обновления')).toBeVisible();expect(within(row).queryByText('Классифицировано')).not.toBeInTheDocument();
});
it('missing or foreign source shows an error, never opens a stale Redux form',async()=>{
 missing=true;show('expenses',target());expect(await screen.findByText(/Не удалось получить выбранную операцию/)).toBeVisible();expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();expect(mutationCalls()).toHaveLength(0);expect(screen.getByRole('button',{name:'Закрыть'})).toBeVisible();
});
it.each([{ownerId:'b'.repeat(24)},{sessionGeneration:2}])('rejects another owner/session before loading, including stale selection %j',patch=>{
 const t=target();show('expenses',{...t,...patch});expect(screen.getByText(/Редактирование недоступно/)).toBeVisible();expect(mockTransport).not.toHaveBeenCalled();expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();
});
it('closes the old financial form on owner transition and does not publish a late read',async()=>{
 let resolve!:(v:{data:unknown})=>void;mockTransport.mockImplementationOnce(()=>new Promise(done=>{resolve=done;}));const view=show('expenses',target());expect(screen.getByText(/Загрузка выбранной операции/)).toBeVisible();view.rerender(view.tree('b'.repeat(24)));await act(async()=>resolve({data:{}}));expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();expect(screen.getByText(/Редактирование недоступно/)).toBeVisible();expect(mutationCalls()).toHaveLength(0);
});

it.each(['expenses','incomes'] as const)('a failed %s PATCH retains the form and draft across automatic query invalidation',async dataset=>{
 patchError=true;show(dataset);fireEvent.click(await screen.findByRole('button',{name:dataset==='expenses'?'Расход 25':'Доход 25'}));fireEvent.click(screen.getByRole('button',{name:'Редактировать операцию'}));await screen.findByLabelText(/Сумма/);
 fireEvent.change(screen.getByLabelText('Комментарий'),{target:{value:'Preserved synthetic draft'}});fireEvent.click(screen.getByRole('button',{name:'Сохранить изменения'}));
 await waitFor(()=>expect(mutationCalls()).toHaveLength(1));await waitFor(()=>expect(reads().length).toBeGreaterThan(2));
 expect(screen.getByLabelText('Комментарий')).toHaveValue('Preserved synthetic draft');expect(screen.getByRole('dialog')).toBeVisible();expect(changed.size).toBe(0);expect(screen.getByLabelText('Route')).toHaveTextContent(`/analytics/classification?dataset=${dataset}&filter=approved&page=2`);
});
it('a saved operation moved outside the period disappears after the coherent refresh, without navigation or classification PUT',async()=>{
 show();fireEvent.click(await screen.findByRole('button',{name:'Расход 25'}));fireEvent.click(screen.getByRole('button',{name:'Редактировать операцию'}));await screen.findByLabelText('Дата');fireEvent.change(screen.getByLabelText('Дата'),{target:{value:'2024-03-10'}});fireEvent.click(screen.getByRole('button',{name:'Сохранить изменения'}));
 await screen.findByRole('button',{name:'Все (29)'});expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Расход 25'})).not.toBeInTheDocument();expect(mutationCalls()).toHaveLength(1);expect(method(mutationCalls()[0][0])).toBe('PATCH');expect(screen.getByLabelText('Route')).toHaveTextContent('/analytics/classification?dataset=expenses&filter=approved&page=2');
});
it.each(['owner','session'] as const)('a %s transition retires the workspace selection and never reopens its draft',async change=>{
 const view=show();fireEvent.click(await screen.findByRole('button',{name:'Расход 25'}));fireEvent.click(screen.getByRole('button',{name:'Редактировать операцию'}));await screen.findByLabelText(/Сумма/);
 view.rerender(view.tree(change==='owner'?'b'.repeat(24):owner,change==='session'?2:1));expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();view.rerender(view.tree(owner));await screen.findByRole('button',{name:'Расход 25'});expect(screen.queryByLabelText(/Сумма/)).not.toBeInTheDocument();expect(mutationCalls()).toHaveLength(0);
});
it('restores captured scroll after the modal closes without touching URL or fetching history',async()=>{
 show();fireEvent.click(await screen.findByRole('button',{name:'Расход 25'}));fireEvent.click(screen.getByRole('button',{name:'Редактировать операцию'}));await screen.findByLabelText(/Сумма/);const count=reads().length;
 Object.defineProperty(window,'scrollY',{configurable:true,value:0});fireEvent.click(screen.getByRole('button',{name:'close'}));expect(scrollTo).toHaveBeenCalledWith(0,600);expect(reads()).toHaveLength(count);expect(screen.getByLabelText('Route')).toHaveTextContent('/analytics/classification?dataset=expenses&filter=approved&page=2');
});
