import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Dialog,DialogActions,DialogContent,DialogTitle,Stack,Table,TableBody,TableCell,TableHead,TableRow,Typography} from '@mui/material';
import {apiBaseUrl} from 'shared/api/baseApi';
import {isCurrentSession} from 'shared/api/sessionBoundary';
import {dateLabel,layerLabel} from 'shared/lib/analytics/presentation';
import type {CalendarPeriod} from 'features/FinancialAnalytics/model/period';
import type {HistoryOperation} from '../model/history';
import type {ClassificationRead} from '../model/contract';
import type {DecisionQuery} from '../api/historyApi';
import {putDecision} from '../api/decisionClient';
import {categoryCandidates,runCategoryBatch,type CategoryCandidate,type BatchProgress} from '../model/categoryBatch';
import {useClassificationWriteRisk} from '../model/useClassificationWriteRisk';

export const CategoryBatchDialog=({operations,decision,period,scope,onDecision,onRefresh}:{operations:readonly HistoryOperation[];decision:(op:HistoryOperation)=>ClassificationRead;period:CalendarPeriod;scope:Omit<DecisionQuery,'dataset'|'operationId'>;onDecision:(d:ClassificationRead)=>void;onRefresh:()=>void})=>{
 const risk=useClassificationWriteRisk();
 const [plan,setPlan]=useState<readonly CategoryCandidate[]|null>(null),[progress,setProgress]=useState<BatchProgress|null>(null),[running,setRunning]=useState(false),[cancelled,setCancelled]=useState(false);
 const life=useRef(true),used=useRef(false),active=useRef<{cancelled:boolean;finished:boolean;controller:AbortController}|null>(null);
 useEffect(()=>{life.current=true;const stop=()=>{if(active.current){active.current.cancelled=true;active.current.controller.abort();}};
  const retire=(event:PageTransitionEvent)=>{if(event.type==='pageshow'&&!event.persisted)return;life.current=false;stop();};
  window.addEventListener('pagehide',retire);window.addEventListener('pageshow',retire);
  return()=>{life.current=false;stop();window.removeEventListener('pagehide',retire);window.removeEventListener('pageshow',retire);};
 },[]);
 const stop=()=>{if(active.current){active.current.cancelled=true;active.current.controller.abort();setCancelled(true);}};
 const close=()=>{if(active.current&&!active.current.finished)stop();else setPlan(null);};
 const open=()=>{if(running||active.current&&!active.current.finished||!life.current)return;used.current=false;active.current=null;setProgress(null);setCancelled(false);setPlan(categoryCandidates(operations,decision,risk.has));};
 const start=async()=>{
  if(!plan?.length||used.current||running||!life.current)return;used.current=true;
  const run={cancelled:false,finished:false,controller:new AbortController()};active.current=run;setRunning(true);
  const current=()=>life.current&&!run.cancelled&&isCurrentSession(scope.sessionGeneration);
  const result=await runCategoryBatch(plan,{current,acquire:risk.acquire,clear:risk.clear,
   write:item=>putDecision({baseUrl:apiBaseUrl,generation:scope.sessionGeneration,current,signal:run.controller.signal,operation:item.operation,intent:{requestId:crypto.randomUUID(),expectedRevision:item.decision.decisionRevision,state:'approved',assignment:item.assignment}}),
   accepted:next=>{if(life.current)onDecision(next);},progress:value=>{if(life.current)setProgress(value);}});
  run.finished=true;
  if(life.current){setProgress(result);setRunning(false);}
 };
 const categories=new Map<string,{count:number;layer:string}>();plan?.forEach(item=>{const category=item.operation.facts.category!;categories.set(category,{count:(categories.get(category)?.count??0)+1,layer:item.assignment.layer!});});
 const skipped=operations.filter(op=>op.dataset==='expenses').length-(plan?.length??0);
 const summary=progress&&<Stack spacing={0.5} role="status"><Typography>Успешно классифицировано: {progress.success}</Typography><Typography>Не удалось классифицировать: {progress.failed}</Typography><Typography>Результат неизвестен — требуется проверка состояния: {progress.unknown}</Typography><Typography>Не отправлено: {progress.total-progress.started-progress.skipped}</Typography></Stack>;
 return <>
  <Button variant="outlined" disabled={running||!life.current} onClick={open}>Автоматически классифицировать</Button>
  {!plan&&progress&&summary}
  <Dialog open={plan!==null} fullWidth maxWidth="sm" onClose={close} aria-labelledby="category-batch-title">
   <DialogTitle id="category-batch-title">Предварительная классификация расходов</DialogTitle>
   <DialogContent><Stack spacing={1}>
    <Alert severity="info">Временные персональные правила владельца проекта. Применяются только к ещё не обработанным расходам с точным совпадением категории.</Alert>
    <Typography>Выбран период: {dateLabel(period.firstDate)} — {dateLabel(period.lastDate)}</Typography>
    <Typography>Найдено подходящих операций: {plan?.length??0}</Typography><Typography>Пропущено расходов: {skipped}</Typography>
    {!plan?.length&&<Typography>Подходящих неклассифицированных расходов за выбранный период нет.</Typography>}
    <Table size="small" aria-label="Предпросмотр правил по категориям"><TableHead><TableRow><TableCell>Категория</TableCell><TableCell>Операций</TableCell><TableCell>Группа расходов</TableCell></TableRow></TableHead><TableBody>{[...categories].map(([category,value])=><TableRow key={category}><TableCell>{category}</TableCell><TableCell>{value.count}</TableCell><TableCell>{layerLabel(value.layer)}</TableCell></TableRow>)}</TableBody></Table>
    {running&&<Typography role="status">Обработка: отправлено {progress?.started??0} из {plan?.length??0}. Одновременно не более трёх запросов.</Typography>}
    {cancelled&&<Alert severity="warning">Обработка остановлена. Уже отправленные запросы могли сохраниться; неизвестные результаты нельзя отправлять повторно.</Alert>}
    {summary}
    {!!progress?.unknown&&!running&&<Button onClick={()=>{setPlan(null);onRefresh();}}>Проверить состояние без повторной записи</Button>}
   </Stack></DialogContent>
   <DialogActions>{running?<Button disabled={cancelled} onClick={stop}>Остановить обработку</Button>:<Button onClick={close}>{progress?'Закрыть':'Отмена'}</Button>}
    {!progress&&!running&&<Button disabled={!plan?.length||used.current} onClick={()=>void start()}>Применить к {plan?.length??0} операциям</Button>}
   </DialogActions>
  </Dialog>
 </>;
};
