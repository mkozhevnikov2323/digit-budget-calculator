import {useLocation,useNavigate} from 'react-router';
import {isCurrentSession} from 'shared/api/sessionBoundary';
import {classificationReturnSearch} from '../model/sourceEdit';
import { useEffect, useId, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { Alert, Button, Pagination, Stack, Tab, Tabs, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { CalendarPeriod } from 'features/FinancialAnalytics/model/period';
import { dateLabel } from 'shared/lib/analytics/presentation';
import { useGetCoherentHistoryQuery, type DecisionQuery } from '../api/historyApi';
import type { CoherentHistory } from '../model/coherentHistory';
import type { ClassificationRead } from '../model/contract';
import type { HistoryOperation } from '../model/history';
import { OperationRow } from './OperationRow';
import { CategoryBatchDialog } from './CategoryBatchDialog';
import { useClassificationNavigation, type Filter } from './classificationNavigation';

export const ClassificationWorkspace=({period}:{period:CalendarPeriod})=>{
 const owner=useVerifiedOwner(),id=useId();
 const userId=owner.status==='verified'?owner.owner.userId:undefined,generation=owner.status==='verified'?owner.owner.sessionGeneration:undefined;
 const key=JSON.stringify([userId,generation,period.startInclusive,period.endExclusive]);
 const [entry,setEntry]=useState({key,sequence:0});if(entry.key!==key)setEntry({key,sequence:entry.sequence+1});
 const scope=`${id}/${entry.sequence}`;
 const args=useMemo(()=>userId&&generation?{userId,sessionGeneration:generation,requestScope:scope,period}:skipToken,[userId,generation,scope,period]);
 const query=useGetCoherentHistoryQuery(args,{refetchOnMountOrArgChange:true});
 if(owner.status!=='verified')return <Alert severity="info">Для просмотра нужна текущая проверка владельца.</Alert>;
 if(query.isError)return <Stack><Alert severity="error">Полная классификация периода недоступна. Счётчики не рассчитаны.</Alert><Button onClick={()=>void query.refetch()}>Повторить загрузку</Button></Stack>;
 if(entry.key!==key||query.isFetching||!query.currentData)return <Typography role="status">Проверка операций и классификаций периода…</Typography>;
 return <WorkspaceResults key={`${scope}/${query.requestId}`} cohort={query.currentData} scope={{userId:owner.owner.userId,sessionGeneration:owner.owner.sessionGeneration,requestScope:scope}} onRefresh={()=>void query.refetch()}/>;
};
const WorkspaceResults=({cohort,scope,onRefresh}:{cohort:CoherentHistory;scope:Omit<DecisionQuery,'dataset'|'operationId'>;onRefresh:()=>void})=>{
 const navigate=useNavigate(),location=useLocation();
 const edit=(op:HistoryOperation)=>{if(!isCurrentSession(scope.sessionGeneration))return;navigate(op.dataset==='expenses'?'/expenses':'/income',{state:{kind:'classification-source-edit-v1',dataset:op.dataset,operationId:op.operationId,ownerId:scope.userId,sessionGeneration:scope.sessionGeneration,firstDate:cohort.history.period.firstDate,lastDate:cohort.history.period.lastDate,returnSearch:classificationReturnSearch(location.search)}});};
 const periodKey=`${cohort.history.period.startInclusive}/${cohort.history.period.endExclusive}`;
 const nav=useClassificationNavigation(periodKey);
 const [selected,setSelected]=useState<string|null>(null);
 const [updates,setUpdates]=useState<Record<string,ClassificationRead>>({});
 const decisions=useMemo(()=>new Map(cohort.decisions.map(d=>[`${d.dataset}/${d.operationId}`,d])),[cohort.decisions]);
 const decision=(op:HistoryOperation)=>updates[`${op.dataset}/${op.operationId}`]??decisions.get(`${op.dataset}/${op.operationId}`)!;
 const datasetOperations=cohort.history.operations.filter(op=>op.dataset===nav.dataset);
 const counts={all:datasetOperations.length,pending:datasetOperations.filter(op=>decision(op).status==='unreviewed').length,approved:datasetOperations.filter(op=>decision(op).status==='approved').length};
 const filtered=datasetOperations.filter(op=>nav.filter==='all'||decision(op).status===(nav.filter==='pending'?'unreviewed':'approved')).sort((a,b)=>a.timestamp-b.timestamp||a.operationId.localeCompare(b.operationId));
 const pages=Math.max(1,Math.ceil(filtered.length/25)),page=Math.min(nav.page,pages);
 useEffect(()=>{if(nav.page!==page)nav.update(nav.dataset,nav.filter,page,undefined,undefined,true);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[page,nav.page]);
 useEffect(()=>setSelected(null),[nav.dataset,nav.filter,page]);
 const groups=new Map<string,HistoryOperation[]>();filtered.slice((page-1)*25,page*25).forEach(op=>{const day=dateLabel(op.timestamp);groups.set(day,[...(groups.get(day)??[]),op]);});
 const changeFilter=(filter:Filter)=>{setSelected(null);nav.update(nav.dataset,filter,1,1,1);};
 return <Stack spacing={1}>
  <Tabs value={nav.dataset} aria-label="Тип операций" onChange={(_e,dataset)=>{setSelected(null);nav.update(dataset,nav.filter,dataset==='incomes'?nav.incomePage:nav.expensePage);}}><Tab value="incomes" label="Доходы"/><Tab value="expenses" label="Расходы"/></Tabs>
  <ToggleButtonGroup exclusive size="small" value={nav.filter} aria-label="Статус классификации" onChange={(_e,value)=>{if(value)changeFilter(value);}} sx={{flexWrap:'wrap'}}>
   <ToggleButton value="all">Все ({counts.all})</ToggleButton><ToggleButton value="pending">Не классифицировано ({counts.pending})</ToggleButton><ToggleButton value="approved">Классифицировано ({counts.approved})</ToggleButton>
  </ToggleButtonGroup>
  {nav.dataset==='expenses'&&<CategoryBatchDialog operations={cohort.history.operations} decision={decision} period={cohort.history.period} scope={scope} onDecision={next=>setUpdates(old=>({...old,[`${next.dataset}/${next.operationId}`]:next}))} onRefresh={onRefresh}/>}
  <Typography variant="body2">Операций: {filtered.length}. Страница {page} из {pages}.</Typography>
  {!filtered.length&&<Typography>{nav.filter==='pending'?`Неклассифицированных ${nav.dataset==='expenses'?'расходов':'доходов'} за выбранный период нет`:nav.filter==='approved'?'Классифицированных операций за выбранный период нет':'За выбранный период операций нет'}</Typography>}
  {[...groups].map(([day,rows])=><Stack key={day} spacing={0.5}><Typography component="h2" variant="h6">{day}</Typography>{rows.map(op=><OperationRow key={op.operationId} operation={op} scope={scope} readOnly={false} onEdit={()=>edit(op)} decision={decision(op)} expanded={selected===op.operationId} onToggle={()=>setSelected(selected===op.operationId?null:op.operationId)} onClose={()=>setSelected(null)} onRefresh={onRefresh} onDecision={next=>setUpdates(old=>({...old,[`${op.dataset}/${op.operationId}`]:next}))}/>)}</Stack>)}
  <Pagination getItemAriaLabel={(type,number,current)=>type==='page'?(current?`Страница ${number}`:`Перейти на страницу ${number}`):type==='first'?'Первая страница':type==='last'?'Последняя страница':type==='next'?'Следующая страница':type==='previous'?'Предыдущая страница':'Другие страницы'} count={pages} page={page} onChange={(_e,value)=>{setSelected(null);nav.update(nav.dataset,nav.filter,value);}} aria-label="Страницы операций" size="small" sx={{'& ul':{flexWrap:'wrap'}}}/>
 </Stack>;
};
