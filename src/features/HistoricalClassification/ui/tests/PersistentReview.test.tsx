import { fireEvent,render,screen,waitFor } from '@testing-library/react';
import { PersistentReview } from '../PersistentReview';
import { putDecision } from '../../api/decisionClient';
import type { ClassificationRead } from '../../model/contract';
jest.mock('../../api/decisionClient',()=>({putDecision:jest.fn()}));
jest.mock('shared/api/baseApi',()=>({apiBaseUrl:'https://fictional.invalid'}));
const put=jest.mocked(putDecision),saved=jest.fn(),refresh=jest.fn();
const decision:ClassificationRead={version:'classification-read-v1',dataset:'expenses',operationId:'1'.repeat(24),status:'unreviewed',storedState:null,decisionRevision:null,confirmed:null,consistency:'observed_only_non_atomic'};
const confirmed:ClassificationRead={...decision,status:'approved',storedState:'approved',decisionRevision:1,confirmed:{economicRole:'ordinary_expense',layer:'everyday'}};
const show=()=>render(<PersistentReview operation={{dataset:'expenses',operationId:decision.operationId,kopecks:100,timestamp:1736942400001,facts:{amount:1,date:'2025-01-15T12:00:00.001Z',title:'Fuel',category:'Transport',recipient:'Synthetic'}}} scope={{userId:'a'.repeat(24),sessionGeneration:1,requestScope:'one'}} decision={decision} state="approved" assignment={{economicRole:'ordinary_expense',layer:'everyday'}} onSaved={saved} onRefresh={refresh}/>);
beforeEach(()=>{jest.clearAllMocks();if(!crypto.randomUUID)Object.defineProperty(crypto,'randomUUID',{configurable:true,value:()=> '12345678-1234-4234-8234-123456789abc'});});
it('never sends on mount; one explicit click sends once and notifies only after confirmed success',async()=>{
 let resolve!:(x:Awaited<ReturnType<typeof putDecision>>)=>void;put.mockReturnValue(new Promise(done=>{resolve=done}));show();expect(put).not.toHaveBeenCalled();
 const save=screen.getByRole('button',{name:'Классифицировать'});fireEvent.click(save);fireEvent.click(save);expect(put).toHaveBeenCalledTimes(1);expect(saved).not.toHaveBeenCalled();resolve({ok:true,decision:confirmed});await waitFor(()=>expect(saved).toHaveBeenCalledWith(confirmed));
});
it.each(['conflict','unknown','session_changed','unavailable'] as const)('does not claim success or automatically retry %s',async(code)=>{
 put.mockResolvedValue({ok:false,code});show();fireEvent.click(screen.getByRole('button',{name:'Классифицировать'}));await screen.findByRole('alert');expect(saved).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Классифицировать'})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Обновить состояние без повторной записи'}));expect(refresh).toHaveBeenCalledTimes(1);expect(put).toHaveBeenCalledTimes(1);
});
it('single explicit unclassified action replaces the role draft with exactly that intent',async()=>{
 put.mockResolvedValue({ok:true,decision:{...confirmed,status:'explicit_unclassified',storedState:'explicit_unclassified',confirmed:null}});show();fireEvent.click(screen.getByRole('button',{name:'Оставить без классификации'}));await waitFor(()=>expect(saved).toHaveBeenCalledTimes(1));expect(put.mock.calls[0][0].intent.state).toBe('explicit_unclassified');expect(put.mock.calls[0][0].intent.assignment).toBeUndefined();expect(put).toHaveBeenCalledTimes(1);
});
it('retires late acknowledgement after unmount or back-forward restoration',async()=>{
 let resolve!:(x:Awaited<ReturnType<typeof putDecision>>)=>void;put.mockReturnValue(new Promise(done=>{resolve=done}));const view=show();fireEvent.click(screen.getByRole('button',{name:'Классифицировать'}));view.unmount();resolve({ok:true,decision:confirmed});await Promise.resolve();expect(saved).not.toHaveBeenCalled();
});
it('retires page restoration without automatically resending',()=>{show();fireEvent(window,new PageTransitionEvent('pageshow',{persisted:true}));expect(screen.getByRole('button',{name:'Классифицировать'})).toBeDisabled();expect(put).not.toHaveBeenCalled();});
