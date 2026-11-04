import {useContext,useRef,useState,useSyncExternalStore} from 'react';
import {ReactReduxContext} from 'react-redux';
import {AnalyticsPageContext} from 'features/AnalyticsState/model/useAnalyticsState';
import {setValue,type AnalyticsUI} from 'features/AnalyticsState/model/slice';
import {useVerifiedOwner} from 'entities/User/model/useVerifiedOwner';
import {getSessionSnapshot} from 'shared/api/sessionBoundary';
import type {HistoryOperation} from './history';
/** Same existing unresolved/<dataset>/<id> fields for manual AND batch writes.
 * Store reads/admission are synchronous, so a stale render cannot bypass a lock. */
export const useClassificationWriteRisk=()=>{
 const redux=useContext(ReactReduxContext),page=useContext(AnalyticsPageContext)??'classification',owner=useVerifiedOwner();
 const scope=owner.status==='verified'?`${owner.owner.userId}/${owner.owner.sessionGeneration}`:`unverified/${getSessionSnapshot().generation}`;
 const snapshot=useSyncExternalStore(redux?.store.subscribe??(()=>()=>{}),()=> (redux?.store.getState() as {analyticsUI?:AnalyticsUI}|undefined)?.analyticsUI);
 // Standalone editor/demo tests retain a local lifecycle outside an app store.
 const local=useRef(new Set<string>());const [,render]=useState(0);
 const key=(op:HistoryOperation)=>`unresolved/${op.dataset}/${op.operationId}`;
 const read=()=>redux?(redux.store.getState() as {analyticsUI?:AnalyticsUI}).analyticsUI:snapshot;
 const has=(op:HistoryOperation)=>{const s=read();return s?s.scope===scope&&s.pages[page]?.[key(op)]===true:local.current.has(key(op));};
 const write=(op:HistoryOperation,value:boolean)=>{
  if(redux&&read()){redux.store.dispatch(setValue({scope,page,field:key(op),value}));}
  else {if(value)local.current.add(key(op));else local.current.delete(key(op));render(n=>n+1);}
 };
 return {has,acquire:(op:HistoryOperation)=>{const state=read();if(state?.scope&&state.scope!==scope)return false;if(has(op))return false;write(op,true);return true;},clear:(op:HistoryOperation)=>{const s=read();if(!s||s.scope===scope)write(op,false);}};
};
