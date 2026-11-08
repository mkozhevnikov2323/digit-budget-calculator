import {categoryCandidates,incomeCandidates,runCategoryBatch,type CategoryCandidate} from '../categoryBatch';
import type {ClassificationRule} from 'features/ClassificationRules/model/contract';
const rule=(extra:Partial<Extract<ClassificationRule,{dataset:'expenses'}>>={}):ClassificationRule=>({_id:'1'.repeat(24),owner:'a'.repeat(24),dataset:'expenses',enabled:true,category:'Продукты',economicRole:'ordinary_expense',layer:'everyday',createdAt:'2026-01-01',updatedAt:'2026-01-01',...extra});
const rules=[rule()];
import type {HistoryOperation} from '../history';
import type {ClassificationRead} from '../contract';
import type {DecisionResult} from '../../api/decisionClient';
const op=(i:number,category='Продукты'):HistoryOperation=>({dataset:'expenses',operationId:i.toString(16).padStart(24,'0'),kopecks:100,timestamp:1736942400000,facts:{amount:1,date:'2025-01-15T12:00:00Z',category,title:'Synthetic',recipient:'Synthetic'}});
const decision=(operation:HistoryOperation):ClassificationRead=>({version:'classification-read-v1',dataset:operation.dataset,operationId:operation.operationId,status:'unreviewed',storedState:null,decisionRevision:null,confirmed:null,consistency:'observed_only_non_atomic'});
const candidates=(n=8)=>categoryCandidates(Array.from({length:n},(_,i)=>op(i)),decision,()=>false,rules);
const approved=(item:CategoryCandidate):DecisionResult=>({ok:true,decision:{...item.decision,status:'approved',storedState:'approved',decisionRevision:1,confirmed:item.assignment}});
it('prioritizes normalized category/title over a general rule regardless of order',()=>{
 const titled=rule({title:' Synthetic ',category:' ПРОДУКТЫ ',layer:'emergency'}),general=rule({layer:'irregular'});
 for(const source of [[titled,general],[general,titled]]){
  const specific=categoryCandidates([op(0,' продукты ')],decision,()=>false,source);
  expect(specific[0].assignment).toEqual({economicRole:'ordinary_expense',layer:'emergency'});
  const other={...op(1,'ПрОдУкТы'),facts:{...op(1).facts,category:'ПрОдУкТы',title:'Другой расход'}};
  expect(categoryCandidates([other],decision,()=>false,source)[0].assignment.layer).toBe('irregular');
 }
});
it('skips disabled/income rules and unmatched operations without temporary fallback',()=>{
 const income:ClassificationRule={_id:'2'.repeat(24),owner:'a'.repeat(24),dataset:'incomes',enabled:true,source:'Продукты',economicRole:'ordinary_income',layer:null,createdAt:'2026-01-01',updatedAt:'2026-01-01'};
 expect(categoryCandidates([op(0)],decision,()=>false,[])).toEqual([]);
 expect(categoryCandidates([op(0)],decision,()=>false,[rule({enabled:false}),income])).toEqual([]);
 expect(categoryCandidates([op(0,'Аптеки')],decision,()=>false,rules)).toEqual([]);
 expect(categoryCandidates([op(0)],decision,()=>false,[rule({title:'Other'})])).toEqual([]);
 expect(categoryCandidates([op(0)],decision,()=>false,[rule(),rule({title:'Synthetic',layer:'emergency',enabled:false})])[0].assignment.layer).toBe('everyday');
});
it('selects the full period, only unreviewed expenses and excludes shared write risk and duplicate identities',()=>{
 const records=Array.from({length:80},(_,i)=>op(i));const selected=categoryCandidates([...records,{...op(90),dataset:'incomes'},op(0)],o=>({...decision(o),status:o.operationId===op(5).operationId?'approved':'unreviewed'}),o=>o.operationId===op(6).operationId,rules);
 expect(selected).toHaveLength(78);expect(selected.some(c=>c.operation.operationId===op(79).operationId)).toBe(true);
 for(const status of ['approved','explicit_unclassified','cleared','stale','blocked'] as const)expect(categoryCandidates([op(0)],o=>({...decision(o),status}),()=>false,rules)).toEqual([]);
});
it('uses at most three workers and never repeats or retries an item',async()=>{
 const items=candidates(7);const resolve:Array<()=>void>=[];let active=0,max=0;const write=jest.fn((item:CategoryCandidate)=>new Promise<DecisionResult>(done=>{active++;max=Math.max(max,active);resolve.push(()=>{active--;done(approved(item));});}));
 const accepted=jest.fn();const promise=runCategoryBatch(items,{current:()=>true,acquire:()=>true,clear:jest.fn(),write,accepted,progress:jest.fn()});
 expect(write).toHaveBeenCalledTimes(3);for(let i=0;i<7;i++){resolve[i]();await Promise.resolve();await Promise.resolve();}
 const result=await promise;expect(result.success).toBe(7);expect(max).toBe(3);expect(new Set(write.mock.calls.map(c=>c[0].operation.operationId)).size).toBe(7);expect(accepted).toHaveBeenCalledTimes(7);
});
it('reports partial known failures and unknown outcomes without optimistically accepting them or clearing unknown risk',async()=>{
 const items=candidates(4),clear=jest.fn(),accepted=jest.fn();const write=jest.fn().mockImplementationOnce(async()=>approved(items[0])).mockResolvedValueOnce({ok:false,code:'conflict'}).mockResolvedValueOnce({ok:false,code:'unknown'}).mockRejectedValueOnce(new Error('Synthetic outage'));
 const result=await runCategoryBatch(items,{current:()=>true,acquire:()=>true,clear,write,accepted,progress:jest.fn()});expect(result).toMatchObject({success:1,failed:1,unknown:2,started:4});expect(accepted).toHaveBeenCalledTimes(1);expect(clear).toHaveBeenCalledTimes(2);expect(write).toHaveBeenCalledTimes(4);
});
it.each(['period','session','cancel'])('stops admitting work on %s retirement and retains risk for in-flight operations',async()=>{
 let current=true;const resolve:Array<(r:DecisionResult)=>void>=[];const clear=jest.fn(),accepted=jest.fn();const write=jest.fn(()=>new Promise<DecisionResult>(done=>resolve.push(done)));
 const promise=runCategoryBatch(candidates(10),{current:()=>current,acquire:()=>true,clear,accepted,write,progress:jest.fn()});expect(write).toHaveBeenCalledTimes(3);current=false;resolve.forEach(done=>done({ok:false,code:'session_changed'}));const result=await promise;expect(write).toHaveBeenCalledTimes(3);expect(result).toMatchObject({started:3,unknown:3});expect(clear).not.toHaveBeenCalled();expect(accepted).not.toHaveBeenCalled();
});
it('rechecks shared risk before admission and does not execute duplicated snapshots',async()=>{
 const item=candidates(1)[0],write=jest.fn(async()=>approved(item));const result=await runCategoryBatch([item,item],{current:()=>true,acquire:()=>false,clear:jest.fn(),accepted:jest.fn(),write,progress:jest.fn()});expect(write).not.toHaveBeenCalled();expect(result.failed).toBe(2);
});
it('a session_changed response stops further admissions even before the session observer rerenders',async()=>{
 const write=jest.fn().mockResolvedValue({ok:false,code:'session_changed'}),clear=jest.fn(),accepted=jest.fn();
 const result=await runCategoryBatch(candidates(12),{current:()=>true,acquire:()=>true,clear,accepted,write,progress:jest.fn()});
 expect(write).toHaveBeenCalledTimes(3);expect(result).toMatchObject({started:3,unknown:3});expect(clear).not.toHaveBeenCalled();expect(accepted).not.toHaveBeenCalled();
});

const incomeRule=(extra:Partial<Extract<ClassificationRule,{dataset:'incomes'}>>={}):ClassificationRule=>({_id:'2'.repeat(24),owner:'a'.repeat(24),dataset:'incomes',source:'Зарплата',enabled:true,economicRole:'ordinary_income',layer:null,createdAt:'2026-01-01',updatedAt:'2026-01-01',...extra});
const incomeOp=(i:number,source='Зарплата'):HistoryOperation=>({...op(i),dataset:'incomes',facts:{amount:1,date:'2025-01-15T12:00:00Z',source}});
it.each(['ordinary_income','loan_repayment','refund','internal_transfer','capital_movement'] as const)('matches a normalized source and preserves income role %s/null',economicRole=>{
 const operations=[incomeOp(0,'  ЗАРПЛАТА  ')],before=JSON.stringify(operations);
 const result=incomeCandidates(operations,decision,()=>false,[incomeRule({source:' зарплата ',economicRole})]);
 expect(result).toHaveLength(1);expect(result[0].assignment).toEqual({economicRole,layer:null});expect(JSON.stringify(operations)).toBe(before);
});
it('income matching has no default and ignores disabled/expense rules, processed decisions, risk and duplicates',()=>{
 expect(incomeCandidates([incomeOp(0)],decision,()=>false,[])).toEqual([]);
 expect(incomeCandidates([incomeOp(0)],decision,()=>false,[incomeRule({enabled:false}),rule()])).toEqual([]);
 expect(incomeCandidates([incomeOp(0,'Премия')],decision,()=>false,[incomeRule()])).toEqual([]);
 for(const status of ['approved','explicit_unclassified','cleared','stale','blocked'] as const)expect(incomeCandidates([incomeOp(0)],o=>({...decision(o),status}),()=>false,[incomeRule()])).toEqual([]);
 const selected=incomeCandidates([incomeOp(0),incomeOp(0),incomeOp(1),op(2)],decision,o=>o.operationId===incomeOp(1).operationId,[incomeRule()]);
 expect(selected.map(item=>item.operation.operationId)).toEqual([incomeOp(0).operationId]);
});
it('income candidates use the same three workers, cancellation and unknown risk without retries',async()=>{
 const items=incomeCandidates(Array.from({length:10},(_,i)=>incomeOp(i)),decision,()=>false,[incomeRule()]);
 let current=true;const resolve:Array<(value:DecisionResult)=>void>=[],clear=jest.fn(),accepted=jest.fn();
 const write=jest.fn(()=>new Promise<DecisionResult>(done=>resolve.push(done)));
 const pending=runCategoryBatch(items,{current:()=>current,acquire:()=>true,clear,accepted,write,progress:jest.fn()});
 expect(write).toHaveBeenCalledTimes(3);current=false;resolve.forEach(done=>done({ok:false,code:'unknown'}));
 expect(await pending).toMatchObject({started:3,unknown:3,total:10});expect(write).toHaveBeenCalledTimes(3);expect(clear).not.toHaveBeenCalled();expect(accepted).not.toHaveBeenCalled();
});
