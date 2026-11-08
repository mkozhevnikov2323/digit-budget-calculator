import {useEffect,useRef,useState} from 'react';
import {Alert,Button,Dialog,DialogActions,DialogContent,DialogTitle,Stack,Table,TableBody,TableCell,TableHead,TableRow,Typography} from '@mui/material';
import {useGetClassificationRulesQuery} from 'features/ClassificationRules/api/rulesApi';
import {apiBaseUrl} from 'shared/api/baseApi';
import {isCurrentSession} from 'shared/api/sessionBoundary';
import {dateLabel,layerLabel,roleLabel} from 'shared/lib/analytics/presentation';
import type {CalendarPeriod} from 'features/FinancialAnalytics/model/period';
import type {HistoryOperation} from '../model/history';
import type {ClassificationRead} from '../model/contract';
import type {DecisionQuery} from '../api/historyApi';
import {putDecision} from '../api/decisionClient';
import {categoryCandidates,incomeCandidates,runCategoryBatch,type CategoryCandidate,type BatchProgress} from '../model/categoryBatch';
import {useClassificationWriteRisk} from '../model/useClassificationWriteRisk';

export const CategoryBatchDialog=({dataset,operations,decision,period,scope,onDecision,onRefresh}:{dataset:'expenses'|'incomes';operations:readonly HistoryOperation[];decision:(op:HistoryOperation)=>ClassificationRead;period:CalendarPeriod;scope:Omit<DecisionQuery,'dataset'|'operationId'>;onDecision:(d:ClassificationRead)=>void;onRefresh:()=>void})=>{
 const kind=dataset==='expenses'?'расходов':'доходов';
 const risk=useClassificationWriteRisk();
 const rules=useGetClassificationRulesQuery({userId:scope.userId,sessionGeneration:scope.sessionGeneration},{refetchOnMountOrArgChange:true});
 const rulesReady=rules.isSuccess&&!rules.isFetching&&!rules.isError&&!!rules.currentData&&typeof rules.requestId==='string';
 const snapshot=JSON.stringify([rules.requestId,rules.currentData]);
 const [planSnapshot,setPlanSnapshot]=useState<string|null>(null);
 // A refreshed request retires the old preview, even when its values happen to match.
 const latestRules=useRef({ready:false,snapshot:''});
 latestRules.current={ready:rulesReady,snapshot};
 const planCurrent=rulesReady&&planSnapshot===snapshot;
 const [plan,setPlan]=useState<readonly CategoryCandidate[]|null>(null),[progress,setProgress]=useState<BatchProgress|null>(null),[running,setRunning]=useState(false),[cancelled,setCancelled]=useState(false);
 const life=useRef(true),used=useRef(false),active=useRef<{cancelled:boolean;finished:boolean;controller:AbortController}|null>(null);
 useEffect(()=>{life.current=true;const stop=()=>{if(active.current){active.current.cancelled=true;active.current.controller.abort();}};
  const retire=(event:PageTransitionEvent)=>{if(event.type==='pageshow'&&!event.persisted)return;life.current=false;stop();};
  window.addEventListener('pagehide',retire);window.addEventListener('pageshow',retire);
  return()=>{life.current=false;stop();window.removeEventListener('pagehide',retire);window.removeEventListener('pageshow',retire);};
 },[]);
 useEffect(()=>{if(!planCurrent&&active.current&&!active.current.finished){active.current.cancelled=true;active.current.controller.abort();setCancelled(true);}},[planCurrent]);
 const stop=()=>{if(active.current){active.current.cancelled=true;active.current.controller.abort();setCancelled(true);}};
 const close=()=>{if(active.current&&!active.current.finished)stop();else setPlan(null);};
 const open=()=>{if(running||active.current&&!active.current.finished||!life.current||!rulesReady||!isCurrentSession(scope.sessionGeneration))return;used.current=false;active.current=null;setProgress(null);setCancelled(false);setPlanSnapshot(snapshot);setPlan((dataset==='expenses'?categoryCandidates:incomeCandidates)(operations,decision,risk.has,rules.currentData!));};
 const start=async()=>{
  if(!plan?.length||!planCurrent||used.current||running||!life.current)return;used.current=true;
  const run={cancelled:false,finished:false,controller:new AbortController()};active.current=run;setRunning(true);
  const current=()=>life.current&&!run.cancelled&&isCurrentSession(scope.sessionGeneration)&&latestRules.current.ready&&latestRules.current.snapshot===planSnapshot;
  const result=await runCategoryBatch(plan,{current,acquire:risk.acquire,clear:risk.clear,
   write:item=>putDecision({baseUrl:apiBaseUrl,generation:scope.sessionGeneration,current,signal:run.controller.signal,operation:item.operation,intent:{requestId:crypto.randomUUID(),expectedRevision:item.decision.decisionRevision,state:'approved',assignment:item.assignment}}),
   accepted:next=>{if(life.current)onDecision(next);},progress:value=>{if(life.current)setProgress(value);}});
  run.finished=true;
  if(life.current){setProgress(result);setRunning(false);}
 };
 const groups=new Map<string,{match:string;title:string;count:number;classification:string}>();plan?.forEach(item=>{
  const match=(dataset==='expenses'?item.operation.facts.category:item.operation.facts.source)??'',title=dataset==='expenses'?item.operation.facts.title??'':'';
  const key=JSON.stringify([match,title,item.assignment.economicRole,item.assignment.layer]);
  groups.set(key,{match,title,count:(groups.get(key)?.count??0)+1,classification:dataset==='expenses'?layerLabel(item.assignment.layer!):roleLabel(item.assignment.economicRole)});
 });
 const skipped=operations.filter(op=>op.dataset===dataset).length-(plan?.length??0);
 const summary=progress&&<Stack spacing={0.5} role="status"><Typography>Успешно классифицировано: {progress.success}</Typography><Typography>Не удалось классифицировать: {progress.failed}</Typography><Typography>Результат неизвестен — требуется проверка состояния: {progress.unknown}</Typography><Typography>Не отправлено: {progress.total-progress.started-progress.skipped}</Typography></Stack>;
 return <>
  <Button variant="outlined" disabled={running||!life.current||!rulesReady} onClick={open}>Автоматически классифицировать</Button>
  {rules.isError&&<Stack><Alert severity="error">Не удалось загрузить правила {kind}. Классификация недоступна.</Alert><Button disabled={running} onClick={()=>void rules.refetch()}>Повторить загрузку правил</Button></Stack>}
  {(rules.isLoading||rules.isFetching||rules.isUninitialized)&&<Typography role="status">Загрузка правил {kind}…</Typography>}
  {!plan&&progress&&summary}
  <Dialog open={plan!==null} fullWidth maxWidth="sm" onClose={close} aria-labelledby="category-batch-title">
   <DialogTitle id="category-batch-title">Предварительная классификация {kind}</DialogTitle>
   <DialogContent><Stack spacing={1}>
    <Alert severity="info">Активные правила текущего пользователя. {dataset==='expenses'?'Совпадение категории и наименования имеет приоритет над общим правилом категории. Обрабатываются только ранее не обработанные расходы.':'Источник дохода сопоставляется без учёта регистра и пробелов по краям. Обрабатываются только ранее не классифицированные доходы.'}</Alert>
    {!planCurrent&&<Stack><Alert severity="warning">Правила изменены или обновляются. Сформируйте новый предпросмотр перед подтверждением.</Alert><Button disabled={!rulesReady||running} onClick={open}>Сформировать новый предпросмотр</Button></Stack>}
    <Typography>Выбран период: {dateLabel(period.firstDate)} — {dateLabel(period.lastDate)}</Typography>
    <Typography>Найдено подходящих операций: {plan?.length??0}</Typography><Typography>Пропущено {kind}: {skipped}</Typography>
    {!plan?.length&&<Typography>Подходящих неклассифицированных {kind} за выбранный период нет.</Typography>}
    <Table size="small" aria-label={dataset==='expenses'?'Предпросмотр правил по категориям':'Предпросмотр правил по источникам'}><TableHead><TableRow>
     <TableCell>{dataset==='expenses'?'Категория':'Источник дохода'}</TableCell>{dataset==='expenses'&&<TableCell>Наименование</TableCell>}<TableCell>Операций</TableCell><TableCell>{dataset==='expenses'?'Группа расходов':'Экономический тип'}</TableCell>
    </TableRow></TableHead><TableBody>{[...groups].map(([key,value])=><TableRow key={key}><TableCell>{value.match}</TableCell>{dataset==='expenses'&&<TableCell>{value.title||'Без наименования'}</TableCell>}<TableCell>{value.count}</TableCell><TableCell>{value.classification}</TableCell></TableRow>)}</TableBody></Table>
    {running&&<Typography role="status">Обработка: отправлено {progress?.started??0} из {plan?.length??0}. Одновременно не более трёх запросов.</Typography>}
    {cancelled&&<Alert severity="warning">Обработка остановлена. Уже отправленные запросы могли сохраниться; неизвестные результаты нельзя отправлять повторно.</Alert>}
    {summary}
    {!!progress?.unknown&&!running&&<Button onClick={()=>{setPlan(null);onRefresh();}}>Проверить состояние без повторной записи</Button>}
   </Stack></DialogContent>
   <DialogActions>{running?<Button disabled={cancelled} onClick={stop}>Остановить обработку</Button>:<Button onClick={close}>{progress?'Закрыть':'Отмена'}</Button>}
    {!progress&&!running&&<Button disabled={!plan?.length||used.current||!planCurrent} onClick={()=>void start()}>Применить к {plan?.length??0} операциям</Button>}
   </DialogActions>
  </Dialog>
 </>;
};
