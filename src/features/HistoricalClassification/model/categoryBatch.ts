import type { ClassificationRead, StableAssignment } from './contract';
import type { HistoryOperation } from './history';
import type { DecisionResult } from '../api/decisionClient';
import { TEMPORARY_CATEGORY_RULES } from './temporaryCategoryRules';
export type CategoryCandidate={operation:HistoryOperation;decision:ClassificationRead;assignment:StableAssignment};
export const categoryCandidates=(operations:readonly HistoryOperation[],decision:(op:HistoryOperation)=>ClassificationRead,hasRisk:(op:HistoryOperation)=>boolean,
 rules:readonly {category:string;assignment:StableAssignment}[]=TEMPORARY_CATEGORY_RULES):CategoryCandidate[]=>{
 const byCategory=new Map(rules.map(r=>[r.category,r.assignment]));const seen=new Set<string>();
 return operations.flatMap(operation=>{
  if(operation.dataset!=='expenses')return [];
  const key=operation.operationId,stored=decision(operation),assignment=byCategory.get(operation.facts.category??'');
  if(seen.has(key)||stored.status!=='unreviewed'||!assignment||hasRisk(operation))return [];
  seen.add(key);return [{operation,decision:stored,assignment:{...assignment}}];
 });
};
export type BatchProgress={success:number;failed:number;unknown:number;started:number;total:number;skipped:number};
/** Three bounded workers. Cancellation/current-session checks happen before EVERY
 * admission. No retry, mutation effect, preparation or alternative transport. */
export const runCategoryBatch=async(candidates:readonly CategoryCandidate[],options:{
 current:()=>boolean;acquire:(op:HistoryOperation)=>boolean;clear:(op:HistoryOperation)=>void;
 write:(candidate:CategoryCandidate)=>Promise<DecisionResult>;accepted:(decision:ClassificationRead)=>void;progress:(value:BatchProgress)=>void;
}):Promise<BatchProgress>=>{
 const result:BatchProgress={success:0,failed:0,unknown:0,started:0,total:candidates.length,skipped:0};let next=0,sessionChanged=false;const seen=new Set<string>();
 const publish=()=>options.progress({...result});
 await Promise.all(Array.from({length:Math.min(3,candidates.length)},async()=>{
  while(!sessionChanged&&options.current()&&next<candidates.length){
   const item=candidates[next++],key=`${item.operation.dataset}/${item.operation.operationId}`;
   if(seen.has(key)||!options.acquire(item.operation)){result.failed++;result.skipped++;publish();continue;}
   seen.add(key);result.started++;publish();
   let response:DecisionResult;
   try{response=await options.write(item);}catch{response={ok:false,code:'unknown'};}
   if(!options.current()){result.unknown++;publish();continue;}
   if(response.ok){options.clear(item.operation);options.accepted(response.decision);if(response.decision.status==='approved')result.success++;else result.failed++;}
   else if(response.code==='unknown'||response.code==='session_changed'){result.unknown++;if(response.code==='session_changed')sessionChanged=true;}
   else {options.clear(item.operation);result.failed++;}
   publish();
  }
 }));return {...result};
};
