import {baseApi} from 'shared/api/baseApi';
import {isCurrentSession} from 'shared/api/sessionBoundary';
import {readSourceEditTarget,sourceEditRequest,validateSourceEditRead,type SourceEditTarget} from '../model/sourceEdit';
export const sourceEditApi=baseApi.injectEndpoints({endpoints:builder=>({
 readSourceForEdit:builder.query<NonNullable<ReturnType<typeof validateSourceEditRead>>,SourceEditTarget>({
  async queryFn(target,api,_options,query){
   const current=()=>!api.signal.aborted&&isCurrentSession(target.sessionGeneration);
   const failure=()=>({error:{status:'CUSTOM_ERROR' as const,error:'SOURCE_UNAVAILABLE'}});
   try{
    if(!readSourceEditTarget(target)||!current())return failure();
    const r=await query(sourceEditRequest(target));if(r.error||!current())return failure();
    const data=validateSourceEditRead(r.data,target);return data?{data}:failure();
   }catch{return failure();}
  },keepUnusedDataFor:0,
  // No mutation invalidation while a form owns a draft. Return remounts Analytics,
  // whose existing coherent query explicitly rereads source and classification.
 })
})});
export const {useReadSourceForEditQuery}=sourceEditApi;
