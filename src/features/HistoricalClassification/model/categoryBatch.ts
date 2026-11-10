import type { ClassificationRead, StableAssignment } from './contract';
import type { HistoryOperation } from './history';

import type { ClassificationRule } from 'features/ClassificationRules/model/contract';
export type CategoryCandidate={operation:HistoryOperation;decision:ClassificationRead;assignment:StableAssignment};
const normalizeMatch=(value:string)=>value.trim().toLowerCase();
export const categoryCandidates=(operations:readonly HistoryOperation[],decision:(op:HistoryOperation)=>ClassificationRead,hasRisk:(op:HistoryOperation)=>boolean,
 rules:readonly ClassificationRule[]):CategoryCandidate[]=>{
 const general=new Map<string,StableAssignment>(),specific=new Map<string,StableAssignment>();
 for(const rule of rules){
  if(!rule.enabled||rule.dataset!=='expenses')continue;
  const category=normalizeMatch(rule.category),assignment:StableAssignment={economicRole:'ordinary_expense',layer:rule.layer};
  if(rule.title===undefined)general.set(category,assignment);
  else specific.set(JSON.stringify([category,normalizeMatch(rule.title)]),assignment);
 }
 const seen=new Set<string>();
 return operations.flatMap(operation=>{
  if(operation.dataset!=='expenses')return [];
  const category=normalizeMatch(operation.facts.category??''),title=normalizeMatch(operation.facts.title??'');
  const key=operation.operationId,stored=decision(operation),assignment=specific.get(JSON.stringify([category,title]))??general.get(category);
  if(seen.has(key)||stored.status!=='unreviewed'||!assignment||hasRisk(operation))return [];
  seen.add(key);return [{operation,decision:stored,assignment:{...assignment}}];
 });
};
/** Income selection shares the same candidates and bounded writer as expenses. */
export const incomeCandidates=(operations:readonly HistoryOperation[],decision:(op:HistoryOperation)=>ClassificationRead,hasRisk:(op:HistoryOperation)=>boolean,
 rules:readonly ClassificationRule[]):CategoryCandidate[]=>{
 const bySource=new Map<string,StableAssignment>();
 for(const rule of rules){
  if(rule.enabled&&rule.dataset==='incomes')bySource.set(normalizeMatch(rule.source),{economicRole:rule.economicRole,layer:null});
 }
 const seen=new Set<string>();
 return operations.flatMap(operation=>{
  if(operation.dataset!=='incomes')return [];
  const stored=decision(operation),assignment=bySource.get(normalizeMatch(operation.facts.source??''));
  if(seen.has(operation.operationId)||stored.status!=='unreviewed'||!assignment||hasRisk(operation))return [];
  seen.add(operation.operationId);return [{operation,decision:stored,assignment:{...assignment}}];
 });
};
export type BatchProgress={success:number;failed:number;unknown:number;started:number;total:number;skipped:number};
/** Three bounded workers. Cancellation/current-session checks happen before EVERY
 * admission. No retry, mutation effect, preparation or alternative transport. */
export const runCategoryBatch=async<C extends {operation:HistoryOperation}, D extends {status:string}>(candidates:readonly C[],options:{
 current:()=>boolean;acquire:(op:HistoryOperation)=>boolean;clear:(op:HistoryOperation)=>void;
 write:(candidate:C)=>Promise<{ok:true;decision:D}|{ok:false;code:'conflict'|'unknown'|'unavailable'|'session_changed'}>;accepted:(decision:D)=>void;progress:(value:BatchProgress)=>void;
}):Promise<BatchProgress>=>{
 const result:BatchProgress={success:0,failed:0,unknown:0,started:0,total:candidates.length,skipped:0};let next=0,sessionChanged=false;const seen=new Set<string>();
 const publish=()=>options.progress({...result});
 await Promise.all(Array.from({length:Math.min(3,candidates.length)},async()=>{
  while(!sessionChanged&&options.current()&&next<candidates.length){
   const item=candidates[next++],key=`${item.operation.dataset}/${item.operation.operationId}`;
   if(seen.has(key)||!options.acquire(item.operation)){result.failed++;result.skipped++;publish();continue;}
   seen.add(key);result.started++;publish();
   let response:{ok:true;decision:D}|{ok:false;code:'conflict'|'unknown'|'unavailable'|'session_changed'};
   try{response=await options.write(item);}catch{response={ok:false,code:'unknown'};}
   if(!options.current()){result.unknown++;publish();continue;}
   if(response.ok){options.clear(item.operation);options.accepted(response.decision);if(response.decision.status==='approved')result.success++;else result.failed++;}
   else if(response.code==='unknown'||response.code==='session_changed'){result.unknown++;if(response.code==='session_changed')sessionChanged=true;}
   else {options.clear(item.operation);result.failed++;}
   publish();
  }
 }));return {...result};
};
