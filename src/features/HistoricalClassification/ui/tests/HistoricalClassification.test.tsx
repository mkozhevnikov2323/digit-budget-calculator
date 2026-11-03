import { fireEvent, render, screen, within } from '@testing-library/react';
import { skipToken } from '@reduxjs/toolkit/query';
import { HistoricalClassification } from '../HistoricalClassification';
import { selectedPeriod } from 'features/FinancialAnalytics/model/tests/fixtures';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import { useGetOwnedHistoryQuery, useReadOperationClassificationQuery } from '../../api/historyApi';
jest.mock('entities/User/model/useVerifiedOwner');
jest.mock('shared/api/baseApi', () => ({ baseApi: {}, apiBaseUrl: 'https://fictional.invalid' }));
jest.mock('../../api/historyApi', () => ({ useGetOwnedHistoryQuery: jest.fn(), useReadOperationClassificationQuery: jest.fn() }));
jest.mock('../OperationEditor',()=>({OperationEditor:({onSaved}:{onSaved:()=>void})=><><button onClick={onSaved}>Успех apply</button><button>Ошибка apply</button></>}));
const history = jest.mocked(useGetOwnedHistoryQuery), decision = jest.mocked(useReadOperationClassificationQuery), owner = jest.mocked(useVerifiedOwner);
const expense = { dataset: 'expenses', operationId: '1'.repeat(24), kopecks: 100, timestamp: Date.parse('2024-02-10T23:59:59Z'), facts: { amount: 1, date: '2024-02-10T23:59:59Z', title: 'Топливо', category: 'Транспорт', recipient: 'Станция' } };
const income = { dataset: 'incomes', operationId: '2'.repeat(24), kopecks: 200, timestamp: Date.parse('2024-02-11T00:00:00Z'), facts: { amount: 2, date: '2024-02-11T00:00:00Z', source: 'Зарплата' } };
beforeEach(() => {
 jest.clearAllMocks();owner.mockReturnValue({status:'verified',owner:{userId:'a'.repeat(24),sessionGeneration:1}});
 history.mockReturnValue({currentData:{operations:[expense,income]},isFetching:false,isError:false,requestId:'one',refetch:jest.fn()} as ReturnType<typeof useGetOwnedHistoryQuery>);
 decision.mockReturnValue({isError:true,isFetching:false,refetch:jest.fn()} as ReturnType<typeof useReadOperationClassificationQuery>);
});
it('defaults to incomes, preserves tab order, separates datasets and hides technical identities',()=>{
 render(<HistoricalClassification period={selectedPeriod()}/>);
 expect(screen.getAllByRole('tab').map(t=>t.textContent)).toEqual(['Доходы','Расходы']);expect(screen.getByRole('tab',{name:'Доходы'})).toHaveAttribute('aria-selected','true');
 expect(screen.getByText('Зарплата')).toBeVisible();expect(screen.queryByText('Топливо')).not.toBeInTheDocument();expect(screen.queryByText(income.operationId)).not.toBeInTheDocument();
 fireEvent.click(screen.getByRole('tab',{name:'Расходы'}));fireEvent.click(screen.getByRole('button',{name:'Топливо'}));
 expect(screen.queryByText('Зарплата')).not.toBeInTheDocument();expect(screen.getByText(/Не удалось загрузить классификацию\./)).toBeVisible();expect(screen.queryByRole('button',{name:'Сохранить'})).not.toBeInTheDocument();
});
it('groups UTC dates descending and keeps every same-date row with stable order',()=>{
 history.mockReturnValue({currentData:{operations:[income,{...income,operationId:'3'.repeat(24),facts:{...income.facts,source:'Премия'}},{...income,timestamp:Date.parse('2024-02-12T00:00:00Z'),operationId:'4'.repeat(24),facts:{...income.facts,source:'Возврат'}}]},requestId:'one',refetch:jest.fn()} as ReturnType<typeof useGetOwnedHistoryQuery>);
 render(<HistoricalClassification period={selectedPeriod()} readOnly/>);
 expect(screen.getAllByRole('heading',{level:2}).map(h=>h.textContent)).toEqual(['11.02.2024','12.02.2024']);fireEvent.click(screen.getByRole('button',{name:'Сначала новые'}));expect(screen.getAllByRole('heading',{level:2}).map(h=>h.textContent)).toEqual(['12.02.2024','11.02.2024']);
 const group=screen.getByRole('heading',{name:'11.02.2024'}).parentElement!;expect(within(group).getAllByRole('button').map(b=>b.getAttribute('aria-label'))).toEqual(['Зарплата','Премия']);
});
it('never shows cached history while loading or after owner verification is lost',()=>{
 const view=render(<HistoricalClassification period={selectedPeriod()}/>);owner.mockReturnValue({status:'verifying'});view.rerender(<HistoricalClassification period={selectedPeriod()}/>);expect(screen.queryByText('Зарплата')).not.toBeInTheDocument();
 owner.mockReturnValue({status:'verified',owner:{userId:'a'.repeat(24),sessionGeneration:1}});history.mockReturnValue({refetch:jest.fn(),isFetching:true,currentData:{operations:[income]}} as ReturnType<typeof useGetOwnedHistoryQuery>);view.rerender(<HistoricalClassification period={selectedPeriod()}/>);expect(screen.queryByText('Зарплата')).not.toBeInTheDocument();
});
it('read-only accordion shows facts and never enables decision queries or mutations',()=>{
 render(<HistoricalClassification period={selectedPeriod()} readOnly/>);fireEvent.click(screen.getByRole('button',{name:'Зарплата'}));expect(screen.getByLabelText('Факты выбранной операции')).toHaveTextContent('Источник: Зарплата');
 expect(decision.mock.calls.every(c=>c[0]===skipToken)).toBe(true);expect(screen.queryByRole('button',{name:'Сохранить'})).not.toBeInTheDocument();expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
it('renders persisted status and role without opening an editor',()=>{
 decision.mockReturnValue({refetch:jest.fn(),currentData:{status:'approved',confirmed:{economicRole:'ordinary_income',layer:null}}} as ReturnType<typeof useReadOperationClassificationQuery>);
 render(<HistoricalClassification period={selectedPeriod()}/>);expect(screen.getByText('Классифицировано')).toBeVisible();expect(screen.queryByLabelText('Решение')).not.toBeInTheDocument();
});
it('limits subscriptions to a page and paginates each dataset independently',()=>{
 history.mockReturnValue({currentData:{operations:Array.from({length:30},(_,i)=>({...income,operationId:i.toString(16).padStart(24,'0'),facts:{...income.facts,source:`Доход ${i}`}})).concat([expense] as unknown as typeof income[])},requestId:'one',refetch:jest.fn()} as ReturnType<typeof useGetOwnedHistoryQuery>);
 render(<HistoricalClassification period={selectedPeriod()}/>);expect(screen.getAllByText(/Не удалось загрузить классификацию/)).toHaveLength(25);fireEvent.click(screen.getByRole('button',{name:'Следующие операции'}));expect(screen.getAllByText(/Не удалось загрузить классификацию/)).toHaveLength(5);
 fireEvent.click(screen.getByRole('tab',{name:'Расходы'}));expect(screen.getByRole('button',{name:'Предыдущие операции'})).toBeDisabled();fireEvent.click(screen.getByRole('tab',{name:'Доходы'}));expect(screen.getAllByText(/Не удалось загрузить классификацию/)).toHaveLength(5);
});

it('closes only after success and updates only the saved row without a read or loading other rows',()=>{
 const refetch=jest.fn();decision.mockReturnValue({currentData:{status:'approved',confirmed:{economicRole:'ordinary_income',layer:null}},refetch} as ReturnType<typeof useReadOperationClassificationQuery>);
 history.mockReturnValue({currentData:{operations:[income,{...income,operationId:'3'.repeat(24),facts:{...income.facts,source:'Премия'}}]},refetch:jest.fn(),requestId:'one'} as ReturnType<typeof useGetOwnedHistoryQuery>);
 render(<HistoricalClassification period={selectedPeriod()}/>);fireEvent.click(screen.getByRole('button',{name:'Зарплата'}));
 fireEvent.click(screen.getByRole('button',{name:'Ошибка apply'}));expect(screen.getByRole('button',{name:'Зарплата'})).toHaveAttribute('aria-expanded','true');
 fireEvent.click(screen.getByRole('button',{name:'Успех apply'}));expect(screen.getByRole('button',{name:'Зарплата'})).toHaveAttribute('aria-expanded','false');
 expect(screen.getAllByText('Классифицировано')).toHaveLength(1);expect(screen.getByText('Сохранено. Актуальность требует проверки')).toBeVisible();expect(screen.queryByText('Загрузка классификации…')).not.toBeInTheDocument();expect(refetch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Зарплата'}));expect(refetch).toHaveBeenCalledTimes(1);
});
