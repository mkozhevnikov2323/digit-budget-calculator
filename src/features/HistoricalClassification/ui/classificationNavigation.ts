import { useEffect } from 'react';
import { useSearchParams } from 'react-router';
import { useAnalyticsState } from 'features/AnalyticsState/model/useAnalyticsState';
export type Dataset='expenses'|'incomes';
export type Filter='all'|'pending'|'approved';
const one=(q:URLSearchParams,key:string)=>q.getAll(key).length===1?q.get(key):null;
const pageNumber=(text:string|null)=>text&&/^[1-9]\d{0,8}$/.test(text)?Math.min(2000,Number(text)):1;
export const parseNavigation=(q:URLSearchParams)=>{
 const dataset:Dataset=one(q,'dataset')==='expenses'?'expenses':'incomes';
 const f=one(q,'filter');const filter:Filter=f==='pending'||f==='approved'?f:'all';
 const page=pageNumber(one(q,'page'));
 return {dataset,filter,page,incomePage:dataset==='incomes'?page:pageNumber(one(q,'incomesPage')),expensePage:dataset==='expenses'?page:pageNumber(one(q,'expensesPage'))};
};
export const useClassificationNavigation=(periodKey:string)=>{
 const [q,setQ]=useSearchParams(),nav=parseNavigation(q);
 const [lastPeriod,setLastPeriod]=useAnalyticsState('classificationPagingPeriod',periodKey);
 const periodChanged=lastPeriod!==periodKey;
 const update=(dataset:Dataset,filter:Filter,page:number,incomePage=nav.incomePage,expensePage=nav.expensePage,replace=false)=>{
  const next=new URLSearchParams(q);next.set('dataset',dataset);next.set('filter',filter);next.set('page',String(page));next.set('incomesPage',String(dataset==='incomes'?page:incomePage));next.set('expensesPage',String(dataset==='expenses'?page:expensePage));setQ(next,{replace});
 };
 useEffect(()=>{
  setLastPeriod(periodKey);
  if(periodChanged)update(nav.dataset,nav.filter,1,1,1,true);
  // URL navigation never drives or changes the calendar period.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[periodKey]);
 return {...nav,page:periodChanged?1:nav.page,update};
};
