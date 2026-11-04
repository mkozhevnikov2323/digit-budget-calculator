import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { apiBaseUrl } from 'shared/api/baseApi';
import { useClassificationWriteRisk } from '../model/useClassificationWriteRisk';
import { putDecision } from '../api/decisionClient';
import type { DecisionQuery } from '../api/historyApi';
import type { ClassificationRead, DecisionState, StableAssignment } from '../model/contract';
import type { HistoryOperation } from '../model/history';
/** Only a click can enter the mutation. Session-scoped risk survives form unmount. */
export const PersistentReview = ({operation,scope,decision,state,assignment,onSaved,onRefresh,dirty=true,valid=true,onCancel,onBusy}:{
 operation:HistoryOperation;scope:Omit<DecisionQuery,'dataset'|'operationId'>;decision:ClassificationRead;state:DecisionState;assignment?:StableAssignment;
 onSaved:(decision:ClassificationRead)=>void;onRefresh?:()=>void;dirty?:boolean;valid?:boolean;onCancel?:()=>void;onBusy?:(busy:boolean)=>void;
})=>{
 const writeRisk=useClassificationWriteRisk(),risk=writeRisk.has(operation);
 const [busy,setBusy]=useState(false),[blocked,setBlocked]=useState(false),[message,setMessage]=useState('');
 const active=useRef(false),live=useRef(true),controller=useRef(new AbortController());
 useEffect(()=>{live.current=true;controller.current=new AbortController();
  const retire=(event:PageTransitionEvent)=>{if(event.type==='pageshow'&&!event.persisted)return;live.current=false;controller.current.abort();setBlocked(true);setMessage('После возврата обновите состояние. Результат записи мог остаться неизвестным.');};
  window.addEventListener('pagehide',retire);window.addEventListener('pageshow',retire);
  return()=>{live.current=false;controller.current.abort();window.removeEventListener('pagehide',retire);window.removeEventListener('pageshow',retire);};
 },[]);
 const run=async(explicit=false)=>{
  if(active.current||!live.current||risk||blocked||decision.status==='blocked'||(!explicit&&(!dirty||!valid||state!=='approved'))||(explicit&&decision.status==='explicit_unclassified'))return;
  if(!writeRisk.acquire(operation))return;
  active.current=true;setBusy(true);onBusy?.(true);setMessage('');
  const result=await putDecision({baseUrl:apiBaseUrl,generation:scope.sessionGeneration,current:()=>live.current,signal:controller.current.signal,operation,
   intent:{requestId:crypto.randomUUID(),expectedRevision:decision.decisionRevision,state:explicit?'explicit_unclassified':'approved',...(!explicit&&assignment?{assignment}:{})}});
  if(!live.current)return;
  if(result.ok){writeRisk.clear(operation);onSaved(result.decision);}
  else {setBlocked(true);if(result.code==='conflict'||result.code==='unavailable')writeRisk.clear(operation);
   setMessage(result.code==='conflict'?'Конфликт решения или изменённые факты. Обновите историю; выбор сохранён.':result.code==='unavailable'?'Сохранение недоступно. Обновите состояние перед новой попыткой.':'Результат записи неизвестен. Запись могла сохраниться. Доступно только чтение состояния.');}
  active.current=false;setBusy(false);onBusy?.(false);
 };
 return <Stack spacing={1} component="section" aria-label="Сохранение ручной классификации">
  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
  <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}><Button disabled={!dirty||busy||risk||blocked} onClick={onCancel}>Отмена</Button>
  <Button disabled={!dirty||!valid||busy||risk||blocked||!live.current} onClick={()=>void run()}>{decision.status==='approved'?'Сохранить изменения':'Классифицировать'}</Button></Stack>
  <Button variant="outlined" color="inherit" sx={{ ml: 'auto', maxWidth: '100%' }} disabled={busy||risk||blocked||!live.current||decision.status==='explicit_unclassified'||decision.status==='blocked'} onClick={()=>void run(true)}>Оставить без классификации</Button>
  </Stack>
  {busy&&<Typography role="status">Сохранение…</Typography>}
  {(risk&&!busy||blocked)&&<Button onClick={()=>{writeRisk.clear(operation);onRefresh?.();}}>Обновить состояние без повторной записи</Button>}
  {risk&&!busy&&!message&&<Alert severity="warning">Предыдущая запись могла сохраниться. Проверьте состояние без повторной записи.</Alert>}
  {message&&<Alert severity="warning">{message}</Alert>}
 </Stack>;
};
