import {customPeriod} from 'features/FinancialAnalytics/model/period';
import {canonicalId,closedData,validateClassificationRead} from './contract';
import {parseSourceFacts} from './coherentHistory';

export type SourceEditTarget={dataset:'expenses'|'incomes';operationId:string;ownerId:string;sessionGeneration:number;firstDate:string;lastDate:string};
/** In-memory selection only; editable facts always come from the owner-scoped API. */
export const readSourceEditTarget=(input:unknown):SourceEditTarget|null=>{
 const r=closedData(input,['dataset','operationId','ownerId','sessionGeneration','firstDate','lastDate']);
 if(!r||Object.keys(r).length!==6||(r.dataset!=='expenses'&&r.dataset!=='incomes')||!canonicalId(r.operationId)||!canonicalId(r.ownerId)
  ||typeof r.sessionGeneration!=='number'||!Number.isSafeInteger(r.sessionGeneration)||r.sessionGeneration<1||typeof r.firstDate!=='string'||typeof r.lastDate!=='string'
  ||!customPeriod(r.firstDate,r.lastDate).ok)return null;
 return {dataset:r.dataset,operationId:r.operationId,ownerId:r.ownerId,sessionGeneration:r.sessionGeneration,firstDate:r.firstDate,lastDate:r.lastDate};
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
