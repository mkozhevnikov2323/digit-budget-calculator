import { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { baseApi } from 'shared/api/baseApi';
import { OperationEditor } from '../OperationEditor';
import type { ClassificationRead } from '../../model/contract';
import type { ReviewRequest } from '../../api/manualClient';
const mockPrepare=jest.fn(),mockApply=jest.fn(),mockReconcile=jest.fn();
jest.mock('../../api/manualClient',()=>({createManualClient:()=>({prepare:mockPrepare,apply:mockApply,reconcile:mockReconcile})}));
jest.mock('shared/api/baseApi',()=>{const {createApi,fakeBaseQuery}=jest.requireActual('@reduxjs/toolkit/query/react');return {apiBaseUrl:'https://fictional.invalid',baseApi:createApi({reducerPath:'editorTest',baseQuery:fakeBaseQuery(),tagTypes:['Classification'],endpoints:()=>({})})};});
const operation={dataset:'incomes' as const,operationId:'1'.repeat(24),kopecks:100,timestamp:Date.parse('2025-01-01T00:00:00.000Z'),facts:{amount:1,date:'2025-01-01T00:00:00.000Z',source:'Зарплата'}};
const decision:ClassificationRead={version:'classification-read-v1',dataset:'incomes',operationId:operation.operationId,status:'approved',storedState:'approved',decisionRevision:1,confirmed:{economicRole:'ordinary_income',layer:null},consistency:'observed_only_non_atomic'};
const prepared=(request:ReviewRequest)=>({request,preparationId:'A'.repeat(43),expiresAt:Date.now()+300000,currentDecision:{storedState:'approved',decisionRevision:1},facts:{amount:{format:'binary64-roundtrip-decimal',value:'1'},dateEpochMs:operation.timestamp,date:operation.facts.date,source:'Зарплата',comment:{kind:'missing'}}});
const saved=jest.fn();
const show=(current=decision,strict=false)=>{
 const store=configureStore({reducer:{[baseApi.reducerPath]:baseApi.reducer},middleware:g=>g().concat(baseApi.middleware)});
 const content=<Provider store={store}><OperationEditor operation={operation} decision={current} scope={{userId:'a'.repeat(24),sessionGeneration:1,requestScope:'one'}} onSaved={saved}/></Provider>;return render(strict?<StrictMode>{content}</StrictMode>:content);
};
const change=(value:string)=>fireEvent.change(screen.getByLabelText('Экономическая роль'),{target:{value}});
beforeEach(()=>{jest.clearAllMocks();if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=> '12345678-1234-4234-8234-123456789abc'});mockPrepare.mockImplementation(async(_d,_i,r)=>({ok:true,value:prepared(r)}));});
it('uses saved values, semantic dirty comparison and cancellation without applying',async()=>{
 show();expect(screen.getByLabelText('Экономическая роль')).toHaveValue('ordinary_income');expect(screen.getByRole('button',{name:'Отмена'})).toBeDisabled();expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeDisabled();expect(mockPrepare).not.toHaveBeenCalled();
 change('refund');expect(screen.getByRole('button',{name:'Отмена'})).toBeEnabled();await waitFor(()=>expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeEnabled());expect(mockApply).not.toHaveBeenCalled();
 change('ordinary_income');expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeDisabled();expect(screen.getByRole('button',{name:'Отмена'})).toBeDisabled();
 change('refund');fireEvent.click(screen.getByRole('button',{name:'Отмена'}));expect(screen.getByLabelText('Экономическая роль')).toHaveValue('ordinary_income');expect(mockApply).not.toHaveBeenCalled();
});
it('does not preselect a role for unreviewed operations',()=>{
 show({...decision,status:'unreviewed',storedState:null,decisionRevision:null,confirmed:null});expect(screen.queryByLabelText('Решение')).not.toBeInTheDocument();expect(screen.getByLabelText('Экономическая роль')).toHaveValue('');expect(screen.getByRole('button',{name:'Классифицировать'})).toBeDisabled();expect(mockPrepare).not.toHaveBeenCalled();
 expect(screen.queryByLabelText('Финансовый слой')).not.toBeInTheDocument();expect(screen.queryByRole('option',{name:'Обычный расход'})).not.toBeInTheDocument();
});
it('rejects late preparation for an abandoned selection and applies only the visible intent once',async()=>{
 let resolve!:(v:unknown)=>void;mockPrepare.mockImplementationOnce((_d,_i,r)=>new Promise(done=>{resolve=()=>done({ok:true,value:prepared(r)})}));show();change('refund');expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeDisabled();change('loan_repayment');await waitFor(()=>expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeEnabled());resolve({});await Promise.resolve();
 mockApply.mockResolvedValue({ok:true,value:'applied'});fireEvent.click(screen.getByRole('button',{name:'Сохранить изменения'}));await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(mockApply).toHaveBeenCalledTimes(1);expect(mockApply.mock.calls[0][2].request.assignment.economicRole).toBe('loan_repayment');
});
it('blocks changed source facts without a write or silent acceptance',async()=>{
 mockPrepare.mockImplementation(async(_d,_i,r)=>({ok:true,value:{...prepared(r),facts:{...prepared(r).facts,amount:{format:'binary64-roundtrip-decimal',value:'2'}}}}));show();change('refund');await screen.findByText(/Факты изменились/);expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeDisabled();expect(mockApply).not.toHaveBeenCalled();
});
it('offers a preparation retry without automatically applying after a transport failure',async()=>{
 mockPrepare.mockResolvedValueOnce({ok:false,code:'unavailable'});show();change('refund');await screen.findByText(/Подготовка недоступна/);fireEvent.click(screen.getByRole('button',{name:'Повторить подготовку'}));await waitFor(()=>expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeEnabled());expect(mockApply).not.toHaveBeenCalled();
});
it('explicit unclassified is a single click with a fresh intent, not the edited role or an effect',async()=>{
 show();change('refund');await waitFor(()=>expect(mockPrepare).toHaveBeenCalled());mockApply.mockResolvedValue({ok:true,value:'applied'});
 const button=screen.getByRole('button',{name:'Оставить без классификации'});fireEvent.click(button);fireEvent.click(button);
 await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(mockApply).toHaveBeenCalledTimes(1);expect(mockApply.mock.calls[0][2].request.state).toBe('explicit_unclassified');expect(mockApply.mock.calls[0][2].request.assignment).toBeUndefined();
});
it.each(['conflict','unavailable'])('explicit action stops on failed prepare: %s',async(code)=>{
 mockPrepare.mockResolvedValue({ok:false,code});show();fireEvent.click(screen.getByRole('button',{name:'Оставить без классификации'}));await screen.findByText(/Не удалось подготовить действие/);expect(mockApply).not.toHaveBeenCalled();
});
it('explicit action checks source facts and never applies a changed source',async()=>{
 mockPrepare.mockImplementation(async(_d,_i,r)=>({ok:true,value:{...prepared(r),facts:{...prepared(r).facts,source:'Изменено'}}}));show();fireEvent.click(screen.getByRole('button',{name:'Оставить без классификации'}));await screen.findByText(/Факты изменились или/);expect(mockApply).not.toHaveBeenCalled();
});
it('unknown explicit apply allows reconcile only and never retries',async()=>{
 mockApply.mockResolvedValue({ok:false,code:'unknown_outcome'});mockReconcile.mockResolvedValue({ok:true,value:'indeterminate'});show();fireEvent.click(screen.getByRole('button',{name:'Оставить без классификации'}));await screen.findByText(/Запись могла сохраниться/);expect(screen.getByRole('button',{name:'Оставить без классификации'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Проверить результат без записи'}));await screen.findByText(/Результат остаётся неопределённым/);expect(mockApply).toHaveBeenCalledTimes(1);
});

it('StrictMode does not prepare or apply explicit intent until a click, and writes once',async()=>{
 mockApply.mockResolvedValue({ok:true,value:'applied'});show(decision,true);expect(mockPrepare).not.toHaveBeenCalled();expect(mockApply).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Оставить без классификации'}));await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(mockPrepare).toHaveBeenCalledTimes(1);expect(mockApply).toHaveBeenCalledTimes(1);
});
