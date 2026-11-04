import {customPeriod} from 'features/FinancialAnalytics/model/period';
import {canonicalId,closedData,validateClassificationRead} from './contract';
import {parseSourceFacts} from './coherentHistory';
import {parseNavigation} from '../ui/classificationNavigation';

export type SourceEditTarget={kind:'classification-source-edit-v1';dataset:'expenses'|'incomes';operationId:string;ownerId:string;sessionGeneration:number;firstDate:string;lastDate:string;returnSearch:string};
/** Router state contains identity/navigation only, never an editable financial snapshot. */
export const readSourceEditTarget=(input:unknown):SourceEditTarget|null=>{
 const r=closedData(input,['kind','dataset','operationId','ownerId','sessionGeneration','firstDate','lastDate','returnSearch']);
 if(!r||Object.keys(r).length!==8||r.kind!=='classification-source-edit-v1'||(r.dataset!=='expenses'&&r.dataset!=='incomes')||!canonicalId(r.operationId)||!canonicalId(r.ownerId)
  ||typeof r.sessionGeneration!=='number'||!Number.isSafeInteger(r.sessionGeneration)||r.sessionGeneration<1||typeof r.firstDate!=='string'||typeof r.lastDate!=='string'
  ||!customPeriod(r.firstDate,r.lastDate).ok||typeof r.returnSearch!=='string'||r.returnSearch.length>512)return null;
 return {kind:r.kind,dataset:r.dataset,operationId:r.operationId,ownerId:r.ownerId,sessionGeneration:r.sessionGeneration,firstDate:r.firstDate,lastDate:r.lastDate,returnSearch:classificationReturnSearch(r.returnSearch)};
};
export const classificationReturnSearch=(search:string)=>{
 const n=parseNavigation(new URLSearchParams(search));
 return '?'+new URLSearchParams({dataset:n.dataset,filter:n.filter,page:String(n.page),incomesPage:String(n.incomePage),expensesPage:String(n.expensePage)});
};
/** A one-identity request uses the existing bounded, owner-scoped history API. */
export const sourceEditRequest=(target:SourceEditTarget)=>{
 const p=customPeriod(target.firstDate,target.lastDate);if(!p.ok)throw Error('SOURCE_UNAVAILABLE');
 return {url:'/classifications/history/read',method:'POST',cache:'no-store' as const,body:{version:'classification-history-read-request-v1',startInclusive:p.value.startInclusive,endExclusive:p.value.endExclusive,operations:[{dataset:target.dataset,operationId:target.operationId}]}};
};
export const validateSourceEditRead=(input:unknown,target:SourceEditTarget)=>{
 const p=customPeriod(target.firstDate,target.lastDate);if(!p.ok)return null;
 const r=closedData(input,['version','window','coverage','consistency','returnedCount','operations']),w=r&&closedData(r.window,['startInclusive','endExclusive']);
 if(!r||Object.keys(r).length!==6||!w||Object.keys(w).length!==2||w.startInclusive!==p.value.startInclusive||w.endExclusive!==p.value.endExclusive
  ||r.version!=='classification-history-read-v1'||r.coverage!=='requested_identities_only'||r.consistency!=='observed_only_non_atomic'||r.returnedCount!==1||!Array.isArray(r.operations)||r.operations.length!==1)return null;
 const op=closedData(r.operations[0],['dataset','operationId','facts','classification']);
 if(!op||Object.keys(op).length!==4||op.dataset!==target.dataset||op.operationId!==target.operationId||!validateClassificationRead(op.classification,target.dataset,target.operationId))return null;
 const facts=parseSourceFacts(op.facts,target.dataset);
 if(!facts||Date.parse(facts.date)<p.value.startInclusive||Date.parse(facts.date)>=p.value.endExclusive)return null;
 return {operationId:target.operationId,dataset:target.dataset,facts};
};
