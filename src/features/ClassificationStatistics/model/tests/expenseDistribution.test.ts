import {recordedReport} from '../recordedHistory';
import {recordedCohort} from './recordedFixtures';
import type {ClassificationRead} from 'features/HistoricalClassification/model/contract';
import {FINANCIAL_LAYERS} from 'features/FinancialClassification/model/types';
const status=(d:ClassificationRead,s:ClassificationRead['status']):ClassificationRead=>({...d,status:s,storedState:s==='unreviewed'||s==='blocked'?null:s==='stale'?'approved':s,decisionRevision:s==='unreviewed'||s==='blocked'?null:1,confirmed:s==='approved'?d.confirmed:null});
it('partitions every outgoing operation once, including loans, capital, transfers and all unconfirmed statuses; incomes never enter',()=>{
 const c=recordedCohort();c.decisions=c.decisions.map((d,i)=>{
  if(d.dataset==='incomes')return d;const expense=i/2;
  if(expense<5)return {...d,confirmed:{economicRole:'ordinary_expense',layer:FINANCIAL_LAYERS[expense]}};
  if(expense===5)return {...d,confirmed:{economicRole:'loan_issuance',layer:null}};
  if(expense===6)return {...d,confirmed:{economicRole:'capital_movement',layer:null}};
  if(expense===11)return {...d,confirmed:{economicRole:'internal_transfer',layer:null}};
  return status(d,(['unreviewed','stale','blocked','explicit_unclassified'] as const)[expense-7]);
 });const before=JSON.stringify(c),report=recordedReport(c),d=report.distribution!;
 expect(report.result.ok).toBe(true);expect(d.groups).toHaveLength(6);expect(d.groups.slice(0,5).map(g=>[g.kopecks,g.count])).toEqual(FINANCIAL_LAYERS.map(()=>[1234,1]));expect(d.groups[5]).toMatchObject({group:'other',kopecks:8638,count:7});
 expect(d.groups.reduce((n,g)=>n+g.kopecks,0)).toBe(14808);expect(d.groups.reduce((n,g)=>n+g.count,0)).toBe(12);expect(d.groups.reduce((n,g)=>n+g.amountShare!,0)).toBeCloseTo(1);expect(d.groups.reduce((n,g)=>n+g.countShare!,0)).toBeCloseTo(1);expect(d.categories[0]).toMatchObject({category:'Транспорт',group:'mixed',kopecks:14808,count:12});expect(JSON.stringify(c)).toBe(before);
});
it('derives category type from facts/decisions only, with common whole-period denominators and descending totals',()=>{
 const c=recordedCohort();c.history={...c.history,operations:c.history.operations.map((op,i)=>op.dataset==='expenses'?{...op,facts:{...op.facts,category:i<4?'Смешанная':i<8?'Продукты':'Одна группа'}}:op)};
 c.decisions=c.decisions.map((d,i)=>i===2||i===4||i===6?status(d,'unreviewed'):d);
 const {distribution:d}=recordedReport(c);expect(d!.categories.map(c=>[c.category,c.group,c.kopecks,c.count])).toEqual([['Одна группа','everyday',9872,8],['Продукты','other',2468,2],['Смешанная','mixed',2468,2]]);
 expect(d!.categories.map(c=>c.amountShare)).toEqual([8/12,2/12,2/12]);expect(d!.categories.map(c=>c.countShare)).toEqual([8/12,2/12,2/12]);expect(d!.categories.reduce((n,c)=>n+c.kopecks,0)).toBe(14808);expect(d!.categories.reduce((n,c)=>n+c.count,0)).toBe(12);
});
it('uses independent amount/count denominators, preserves exact kopecks and handles empty/zero-amount histories',()=>{
 const c=recordedCohort();c.history={...c.history,operations:c.history.operations.map(op=>({...op,kopecks:0,facts:{...op.facts,amount:0}}))};const zero=recordedReport(c).distribution!;expect(zero.groups.every(g=>g.amountShare===null)).toBe(true);expect(zero.groups[0].countShare).toBe(1);
 c.history={...c.history,operations:[]};c.decisions=[];const empty=recordedReport(c).distribution!;expect(empty.groups.every(g=>g.amountShare===null&&g.countShare===null&&g.kopecks===0&&g.count===0)).toBe(true);expect(empty.categories).toEqual([]);
 const varied=recordedCohort();varied.history={...varied.history,operations:varied.history.operations.map((op,i)=>i===0?{...op,kopecks:1,facts:{...op.facts,amount:0.01}}:op)};varied.decisions=varied.decisions.map((d,i)=>i===0?status(d,'stale'):d);const d=recordedReport(varied).distribution!;expect(d.groups[5]).toMatchObject({kopecks:1,count:1,amountShare:1/13575,countShare:1/12});
});
it('does not publish a distribution when existing identity, reconciliation or safe-money validation fails',()=>{
 const c=recordedCohort();c.decisions=c.decisions.slice(1);expect(recordedReport(c).distribution).toBeNull();
 const overflow=recordedCohort();overflow.history={...overflow.history,operations:overflow.history.operations.map(op=>({...op,kopecks:Number.MAX_SAFE_INTEGER}))};expect(recordedReport(overflow).distribution).toBeNull();
});
