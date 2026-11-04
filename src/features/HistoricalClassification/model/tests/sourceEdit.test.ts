import {classificationReturnSearch,readSourceEditTarget,sourceEditRequest,validateSourceEditRead,type SourceEditTarget} from '../sourceEdit';
const target:SourceEditTarget={kind:'classification-source-edit-v1',dataset:'expenses',operationId:'1'.repeat(24),ownerId:'a'.repeat(24),sessionGeneration:1,firstDate:'2024-02-01',lastDate:'2024-02-29',returnSearch:'?dataset=expenses&filter=approved&page=3'};
const response=()=>({version:'classification-history-read-v1',window:{startInclusive:1706745600000,endExclusive:1709251200000},coverage:'requested_identities_only',consistency:'observed_only_non_atomic',returnedCount:1,operations:[{dataset:target.dataset,operationId:target.operationId,facts:{amount:{format:'binary64-roundtrip-decimal',value:'12.34'},date:'2024-02-10T12:00:00.000Z',dateEpochMs:1707566400000,category:'Synthetic',title:'Synthetic',recipient:'Synthetic',comment:{kind:'null'}},classification:{version:'classification-read-v1',dataset:target.dataset,operationId:target.operationId,status:'stale',storedState:'approved',decisionRevision:1,confirmed:null,consistency:'observed_only_non_atomic'}}]});
it('validates identity-only router state and reconstructs a fixed internal return destination',()=>{
 expect(readSourceEditTarget(target)).toMatchObject({...target,returnSearch:classificationReturnSearch(target.returnSearch)});expect(classificationReturnSearch('?dataset=expenses&filter=approved&page=3&token=fictional&returnTo=https://fictional.invalid')).toBe('?dataset=expenses&filter=approved&page=3&incomesPage=1&expensesPage=3');
 for(const bad of [null,{...target,ownerId:'invalid'},{...target,sessionGeneration:0},{...target,dataset:'other'},{...target,firstDate:'2024-02-31'},{...target,amount:1}])expect(readSourceEditTarget(bad)).toBeNull();
});
it('requests exactly one identity using the existing read-only endpoint and validates exact raw facts',()=>{
 expect(sourceEditRequest(target)).toMatchObject({url:'/classifications/history/read',method:'POST',body:{operations:[{dataset:'expenses',operationId:target.operationId}]}});
 expect(validateSourceEditRead(response(),target)).toMatchObject({operationId:target.operationId,facts:{amount:12.34,comment:null,category:'Synthetic'}});
});
it('rejects wrong operation/dataset, duplicate records, invalid facts, window and classification before opening any form',()=>{
 const other=response();other.operations[0].operationId='2'.repeat(24);expect(validateSourceEditRead(other,target)).toBeNull();
 const wrongDataset=response();wrongDataset.operations[0].dataset='incomes';expect(validateSourceEditRead(wrongDataset,target)).toBeNull();
 const duplicate=response();duplicate.operations.push(duplicate.operations[0]);expect(validateSourceEditRead(duplicate,target)).toBeNull();
 const amount=response();amount.operations[0].facts.amount.value='NaN';expect(validateSourceEditRead(amount,target)).toBeNull();
 const window=response();window.window.endExclusive++;expect(validateSourceEditRead(window,target)).toBeNull();
 const classification=response();classification.operations[0].classification.operationId='3'.repeat(24);expect(validateSourceEditRead(classification,target)).toBeNull();
 const outside=response();outside.operations[0].facts.date='2025-02-10T12:00:00.000Z';outside.operations[0].facts.dateEpochMs=Date.parse(outside.operations[0].facts.date);expect(validateSourceEditRead(outside,target)).toBeNull();
});
