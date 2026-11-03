import { StrictMode } from 'react';
import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { OperationEditor } from '../OperationEditor';
import { putDecision } from '../../api/decisionClient';
import type { ClassificationRead } from '../../model/contract';
jest.mock('../../api/decisionClient',()=>({putDecision:jest.fn()}));jest.mock('shared/api/baseApi',()=>({apiBaseUrl:'https://fictional.invalid'}));
const put=jest.mocked(putDecision),saved=jest.fn();
const decision:ClassificationRead={version:'classification-read-v1',dataset:'incomes',operationId:'1'.repeat(24),status:'approved',storedState:'approved',decisionRevision:7,confirmed:{economicRole:'ordinary_income',layer:null},consistency:'observed_only_non_atomic'};
const show=(d=decision)=>render(<StrictMode><OperationEditor operation={{dataset:d.dataset,operationId:d.operationId,kopecks:100,timestamp:1736942400001,facts:{amount:1,date:'2025-01-15T12:00:00.001Z',...(d.dataset==='expenses'?{category:'Synthetic',title:'Synthetic',recipient:'Synthetic'}:{source:'Synthetic'})}}} decision={d} scope={{userId:'a'.repeat(24),sessionGeneration:1,requestScope:'one'}} onSaved={saved}/></StrictMode>);
beforeEach(()=>{jest.clearAllMocks();if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=> '12345678-1234-4234-8234-123456789abc'});});
it('uses saved role; semantic dirty/cancel sends no requests and prepares nothing',()=>{
 show();expect(screen.getByLabelText('Тип операции')).toHaveValue('ordinary_income');expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Тип операции'),{target:{value:'refund'}});expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeEnabled();fireEvent.change(screen.getByLabelText('Тип операции'),{target:{value:'ordinary_income'}});expect(screen.getByRole('button',{name:'Отмена'})).toBeDisabled();fireEvent.change(screen.getByLabelText('Тип операции'),{target:{value:'refund'}});fireEvent.click(screen.getByRole('button',{name:'Отмена'}));expect(screen.getByLabelText('Тип операции')).toHaveValue('ordinary_income');expect(put).not.toHaveBeenCalled();
});
it('does not preselect an unreviewed role and sends the current revision/intent on one explicit click',async()=>{
 put.mockResolvedValue({ok:true,decision:{...decision,decisionRevision:8}});show();fireEvent.change(screen.getByLabelText('Тип операции'),{target:{value:'refund'}});fireEvent.click(screen.getByRole('button',{name:'Сохранить изменения'}));await waitFor(()=>expect(saved).toHaveBeenCalled());expect(put).toHaveBeenCalledTimes(1);expect(put.mock.calls[0][0].intent.expectedRevision).toBe(7);expect(put.mock.calls[0][0].intent.assignment?.economicRole).toBe('refund');
});
it('StrictMode and rerenders cannot apply the explicit action without a click or duplicate it',async()=>{
 put.mockResolvedValue({ok:true,decision:{...decision,status:'explicit_unclassified',storedState:'explicit_unclassified',confirmed:null,decisionRevision:8}});show();expect(put).not.toHaveBeenCalled();const button=screen.getByRole('button',{name:'Оставить без классификации'});fireEvent.click(button);fireEvent.click(button);await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(put).toHaveBeenCalledTimes(1);
});
it('unreviewed has no role, decision selector or layer; unchanged form cannot write',()=>{
 show({...decision,status:'unreviewed',storedState:null,confirmed:null,decisionRevision:null});expect(screen.getByLabelText('Тип операции')).toHaveValue('');expect(screen.queryByLabelText('Решение')).not.toBeInTheDocument();expect(screen.queryByLabelText('Группа расходов')).not.toBeInTheDocument();expect(screen.queryByRole('option',{name:'Обычный расход'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Классифицировать'})).toBeDisabled();expect(put).not.toHaveBeenCalled();
});

const unreviewedExpense:ClassificationRead={...decision,dataset:'expenses',status:'unreviewed',storedState:null,confirmed:null,decisionRevision:null};
it('presets only a local ordinary expense, requires an explicit group and saves on one click only',async()=>{
 put.mockResolvedValue({ok:true,decision:{...unreviewedExpense,status:'approved',storedState:'approved',decisionRevision:1,confirmed:{economicRole:'ordinary_expense',layer:'irregular'}}});
 show(unreviewedExpense);
 expect(screen.getByLabelText('Тип операции')).toHaveValue('ordinary_expense');expect(screen.getByLabelText('Группа расходов')).toHaveValue('');
 expect(screen.getByRole('button',{name:'Классифицировать'})).toBeDisabled();expect(screen.getByRole('button',{name:'Отмена'})).toBeDisabled();expect(put).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Группа расходов'),{target:{value:'irregular'}});expect(screen.getByRole('button',{name:'Классифицировать'})).toBeEnabled();expect(put).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Классифицировать'}));await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(put).toHaveBeenCalledTimes(1);expect(put.mock.calls[0][0].intent.assignment).toEqual({economicRole:'ordinary_expense',layer:'irregular'});
});
it('cancel restores the expense preset and empty group without sending a request',()=>{
 show(unreviewedExpense);fireEvent.change(screen.getByLabelText('Группа расходов'),{target:{value:'everyday'}});fireEvent.click(screen.getByRole('button',{name:'Отмена'}));
 expect(screen.getByLabelText('Тип операции')).toHaveValue('ordinary_expense');expect(screen.getByLabelText('Группа расходов')).toHaveValue('');expect(screen.getByRole('button',{name:'Классифицировать'})).toBeDisabled();expect(screen.getByRole('button',{name:'Отмена'})).toBeDisabled();expect(put).not.toHaveBeenCalled();
});
it('nonordinary roles hide the group and returning to ordinary expense requires choosing it again',async()=>{
 put.mockResolvedValue({ok:false,code:'unavailable'});show(unreviewedExpense);
 fireEvent.change(screen.getByLabelText('Группа расходов'),{target:{value:'everyday'}});fireEvent.change(screen.getByLabelText('Тип операции'),{target:{value:'internal_transfer'}});
 expect(screen.queryByLabelText('Группа расходов')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Классифицировать'})).toBeEnabled();
 fireEvent.change(screen.getByLabelText('Тип операции'),{target:{value:'ordinary_expense'}});expect(screen.getByLabelText('Группа расходов')).toHaveValue('');expect(screen.getByRole('button',{name:'Классифицировать'})).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Тип операции'),{target:{value:'internal_transfer'}});expect(put).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Классифицировать'}));await screen.findByRole('alert');expect(put.mock.calls[0][0].intent.assignment).toEqual({economicRole:'internal_transfer',layer:null});expect(put).toHaveBeenCalledTimes(1);
});
it('approved expenses keep their actual saved role and group instead of a preset',()=>{
 show({...unreviewedExpense,status:'approved',storedState:'approved',decisionRevision:3,confirmed:{economicRole:'ordinary_expense',layer:'emergency'}});
 expect(screen.getByLabelText('Тип операции')).toHaveValue('ordinary_expense');expect(screen.getByLabelText('Группа расходов')).toHaveValue('emergency');expect(screen.getByRole('button',{name:'Сохранить изменения'})).toBeDisabled();expect(put).not.toHaveBeenCalled();
});
it.each(['explicit_unclassified','stale','blocked'] as const)('does not apply the expense preset to %s',status=>{
 show({...unreviewedExpense,status,storedState:status==='blocked'?null:status==='stale'?'approved':status,decisionRevision:status==='blocked'?null:2});
 expect(screen.getByLabelText('Тип операции')).toHaveValue('');expect(screen.queryByLabelText('Группа расходов')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Классифицировать'})).toBeDisabled();expect(put).not.toHaveBeenCalled();
});
