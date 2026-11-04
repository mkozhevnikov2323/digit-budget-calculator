import {categoryCandidates,runCategoryBatch,type CategoryCandidate} from '../categoryBatch';
import {TEMPORARY_CATEGORY_RULES} from '../temporaryCategoryRules';
import type {HistoryOperation} from '../history';
import type {ClassificationRead} from '../contract';
import type {DecisionResult} from '../../api/decisionClient';
const op=(i:number,category='Продукты'):HistoryOperation=>({dataset:'expenses',operationId:i.toString(16).padStart(24,'0'),kopecks:100,timestamp:1736942400000,facts:{amount:1,date:'2025-01-15T12:00:00Z',category,title:'Synthetic',recipient:'Synthetic'}});
const decision=(operation:HistoryOperation):ClassificationRead=>({version:'classification-read-v1',dataset:operation.dataset,operationId:operation.operationId,status:'unreviewed',storedState:null,decisionRevision:null,confirmed:null,consistency:'observed_only_non_atomic'});
const candidates=(n=8)=>categoryCandidates(Array.from({length:n},(_,i)=>op(i)),decision,()=>false);
const approved=(item:CategoryCandidate):DecisionResult=>({ok:true,decision:{...item.decision,status:'approved',storedState:'approved',decisionRevision:1,confirmed:item.assignment}});
it('matches all eight temporary personal categories exactly and never title/amount/recipient',()=>{
 const expected=[['Продукты','everyday'],['Аптеки','irregular'],['Фастфуд','irregular'],['Чаевые','irregular'],['Подарки','irregular'],['Бар','irregular'],['Подписки','everyday'],['Такси','everyday']];
 expect(TEMPORARY_CATEGORY_RULES).toHaveLength(8);expected.forEach(([category,layer],i)=>expect(categoryCandidates([op(i,category)],decision,()=>false)[0].assignment).toEqual({economicRole:'ordinary_expense',layer}));
 for(const category of ['Транспорт','продукты','Продукты ',' Продукты','Продукты питания',''])expect(categoryCandidates([{...op(0,category),facts:{...op(0,category).facts,title:'Продукты',recipient:'Аптеки'}}],decision,()=>false)).toEqual([]);
});
it('selects the full period, only unreviewed expenses and excludes shared write risk and duplicate identities',()=>{
 const records=Array.from({length:80},(_,i)=>op(i));const selected=categoryCandidates([...records,{...op(90),dataset:'incomes'},op(0)],o=>({...decision(o),status:o.operationId===op(5).operationId?'approved':'unreviewed'}),o=>o.operationId===op(6).operationId);
 expect(selected).toHaveLength(78);expect(selected.some(c=>c.operation.operationId===op(79).operationId)).toBe(true);
 for(const status of ['approved','explicit_unclassified','cleared','stale','blocked'] as const)expect(categoryCandidates([op(0)],o=>({...decision(o),status}),()=>false)).toEqual([]);
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
