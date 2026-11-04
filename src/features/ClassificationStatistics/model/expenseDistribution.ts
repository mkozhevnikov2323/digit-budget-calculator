import type {CoherentHistory} from 'features/HistoricalClassification/model/coherentHistory';
import {FINANCIAL_LAYERS,type FinancialLayer} from 'features/FinancialClassification/model/types';
import {sumKopecks} from 'features/FinancialAnalytics/model/money';
import type {Bucket,DatasetStatistics} from './statistics';
export type ExpenseGroup=FinancialLayer|'other';
export type Shares={amountShare:number|null;countShare:number|null};
export type ExpenseDistribution={groups:(Bucket&Shares&{group:ExpenseGroup})[];categories:(Bucket&Shares&{category:string;group:ExpenseGroup|'mixed'})[]};
/** Display-only partition. Never a taxonomy member, stored decision or authority
 * inferred from a category name. Denominators include EVERY recorded expense. */
export const expenseDistribution=(cohort:CoherentHistory,stats:DatasetStatistics,categories:readonly {category:string;kopecks:number;count:number}[]):ExpenseDistribution|null=>{
 const groups=new Map<ExpenseGroup,Bucket>([...FINANCIAL_LAYERS,'other' as const].map(group=>[group,{kopecks:0,count:0}]));
 const reads=new Map(cohort.decisions.map(read=>[`${read.dataset}/${read.operationId}`,read]));
 const categoryGroups=new Map<string,Set<ExpenseGroup>>();
 for(const op of cohort.history.operations){
  if(op.dataset!=='expenses')continue;
  const read=reads.get(`expenses/${op.operationId}`),assignment=read?.confirmed;
  if(!read||typeof op.facts.category!=='string')return null;
  const group:ExpenseGroup=read.status==='approved'&&assignment?.economicRole==='ordinary_expense'&&assignment.layer!==null?assignment.layer:'other';
  const bucket=groups.get(group);if(!bucket)return null;
  const sum=sumKopecks([bucket.kopecks,op.kopecks]);if(!sum.ok)return null;
  bucket.kopecks=sum.value;bucket.count++;
  const kinds=categoryGroups.get(op.facts.category)??new Set<ExpenseGroup>();kinds.add(group);categoryGroups.set(op.facts.category,kinds);
 }
 const all=[...groups.values()],sum=sumKopecks(all.map(b=>b.kopecks));
 if(!sum.ok||sum.value!==stats.recorded.kopecks||all.reduce((n,b)=>n+b.count,0)!==stats.recorded.count)return null;
 for(const layer of FINANCIAL_LAYERS){const group=groups.get(layer)!;if(group.kopecks!==stats.layers[layer].kopecks||group.count!==stats.layers[layer].count)return null;}
 const categorySum=sumKopecks(categories.map(c=>c.kopecks));
 if(!categorySum.ok||categorySum.value!==stats.recorded.kopecks||categories.reduce((n,c)=>n+c.count,0)!==stats.recorded.count||categories.length!==categoryGroups.size)return null;
 const shares=(b:Bucket):Shares=>({amountShare:stats.recorded.kopecks===0?null:b.kopecks/stats.recorded.kopecks,countShare:stats.recorded.count===0?null:b.count/stats.recorded.count});
 const rows:ExpenseDistribution['categories']=[];
 for(const c of categories){const kinds=categoryGroups.get(c.category);if(!kinds?.size)return null;rows.push({...c,...shares(c),group:kinds.size===1?[...kinds][0]:'mixed'});}
 return {groups:[...groups].map(([group,b])=>({group,...b,...shares(b)})),categories:rows};
};
