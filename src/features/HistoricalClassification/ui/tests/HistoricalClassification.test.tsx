import {fireEvent,render,screen,within} from '@testing-library/react';
import {HistoricalClassification} from '../HistoricalClassification';
import {selectedPeriod} from 'features/FinancialAnalytics/model/tests/fixtures';
import {useVerifiedOwner} from 'entities/User/model/useVerifiedOwner';
import {useGetOwnedHistoryQuery} from '../../api/historyApi';
jest.mock('features/ClassificationRules/api/rulesApi',()=>({useGetClassificationRulesQuery:()=>{throw Error('No rule query on read-only history');}}));
jest.mock('entities/User/model/useVerifiedOwner');
jest.mock('shared/api/baseApi',()=>({baseApi:{},apiBaseUrl:'https://fictional.invalid'}));
jest.mock('../../api/historyApi',()=>({useGetOwnedHistoryQuery:jest.fn(),useGetCoherentHistoryQuery:jest.fn(()=>{throw Error('No batches on read-only history');})}));
const owner=jest.mocked(useVerifiedOwner),history=jest.mocked(useGetOwnedHistoryQuery);
const income={dataset:'incomes',operationId:'2'.repeat(24),kopecks:100,timestamp:Date.parse('2024-02-10T00:00:00Z'),facts:{amount:1,date:'2024-02-10T00:00:00Z',source:'Зарплата'}};
beforeEach(()=>{owner.mockReturnValue({status:'verified',owner:{userId:'a'.repeat(24),sessionGeneration:1}});history.mockReturnValue({currentData:{operations:[income,{...income,operationId:'3'.repeat(24),facts:{...income.facts,source:'Премия'}}]},requestId:'one',refetch:jest.fn()} as ReturnType<typeof useGetOwnedHistoryQuery>);});
it('keeps read-only tabs, UTC groups, stable order and facts without editing or decision requests',()=>{
 render(<HistoricalClassification period={selectedPeriod()} readOnly/>);expect(screen.getAllByRole('tab').map(t=>t.textContent)).toEqual(['Доходы','Расходы']);
 const group=screen.getByRole('heading',{name:'10.02.2024'}).parentElement!;expect(within(group).getAllByRole('button').map(b=>b.getAttribute('aria-label'))).toEqual(['Зарплата','Премия']);fireEvent.click(screen.getByRole('button',{name:'Зарплата'}));expect(screen.getByLabelText('Факты выбранной операции')).toHaveTextContent('Источник: Зарплата');expect(screen.queryByRole('button',{name:'Классифицировать'})).not.toBeInTheDocument();expect(screen.queryByLabelText('Тип операции')).not.toBeInTheDocument();
});
it('hides old facts when owner verification is lost',()=>{const v=render(<HistoricalClassification period={selectedPeriod()} readOnly/>);owner.mockReturnValue({status:'verifying'});v.rerender(<HistoricalClassification period={selectedPeriod()} readOnly/>);expect(screen.queryByText('Зарплата')).not.toBeInTheDocument();});
it('never publishes cached read-only history while fetching',()=>{history.mockReturnValue({isFetching:true,currentData:{operations:[income]},refetch:jest.fn()} as ReturnType<typeof useGetOwnedHistoryQuery>);render(<HistoricalClassification period={selectedPeriod()} readOnly/>);expect(screen.queryByText('Зарплата')).not.toBeInTheDocument();});
