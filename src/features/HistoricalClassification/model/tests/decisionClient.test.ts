import { expectedSourceFacts,putDecision } from '../../api/decisionClient';
import type { HistoryOperation } from '../history';
jest.mock('shared/api/sessionBoundary',()=>({isCurrentSession:()=>true}));jest.mock('shared/api/credentialObservation',()=>({checkCredentialChange:()=>false}));
const operation:HistoryOperation={dataset:'expenses',operationId:'1'.repeat(24),timestamp:1736942400001,kopecks:100,facts:{amount:1,date:'2025-01-15T12:00:00.001Z',category:'Транспорт',title:'Synthetic',recipient:'Synthetic'}};
const intent={requestId:'12345678-1234-4234-8234-123456789abc',expectedRevision:3,state:'approved' as const,assignment:{economicRole:'ordinary_expense' as const,layer:'everyday' as const}};
const decision={version:'classification-read-v1',dataset:'expenses',operationId:operation.operationId,status:'approved',storedState:'approved',decisionRevision:4,confirmed:intent.assignment,consistency:'observed_only_non_atomic'};
const envelope={version:'classification-decision-v1',outcome:'updated',decision};
beforeEach(()=>localStorage.setItem('token','fictional-token'));
const call=(raw:unknown=envelope,status=200)=>{const transport=jest.fn().mockResolvedValue({status,ok:status>=200&&status<300,json:async()=>raw});return {transport,promise:putDecision({baseUrl:'https://fictional.invalid',generation:1,current:()=>true,signal:new AbortController().signal,operation,intent,transport})};};
it('one PUT with exact facts and full returned revision/role, no preliminary or subsequent requests',async()=>{
 const {transport,promise}=call();expect(await promise).toEqual({ok:true,decision});expect(transport).toHaveBeenCalledTimes(1);const [url,request]=transport.mock.calls[0];expect(url).toMatch(/\/decision$/);expect(request.method).toBe('PUT');expect(JSON.parse(request.body)).toEqual({version:'classification-decision-v1',...intent,expectedFacts:expectedSourceFacts(operation)});
});
it('preserves negative zero, fractional precision, milliseconds and comment representations',()=>{
 expect(expectedSourceFacts({...operation,facts:{...operation.facts,amount:-0}}).amount.value).toBe('-0');expect(expectedSourceFacts({...operation,facts:{...operation.facts,amount:12.340000000000002}}).amount.value).toBe('12.340000000000002');expect(expectedSourceFacts(operation).dateEpochMs).toBe(1736942400001);
 expect(expectedSourceFacts(operation).comment).toEqual({kind:'missing'});expect(expectedSourceFacts({...operation,facts:{...operation.facts,comment:null}}).comment).toEqual({kind:'null'});expect(expectedSourceFacts({...operation,facts:{...operation.facts,comment:''}}).comment).toEqual({kind:'value',value:''});
});
it.each([{...envelope,version:'bad'},{...envelope,extra:1},{...envelope,decision:{...decision,operationId:'2'.repeat(24)}},{...envelope,decision:{...decision,decisionRevision:5}},{...envelope,decision:{...decision,confirmed:{...intent.assignment,layer:'irregular'}}},{...envelope,decision:{...decision,status:'unreviewed',storedState:null,confirmed:null,decisionRevision:null}}])('treats mismatched or incomplete responses as unknown without retry',async(raw)=>{const c=call(raw);expect(await c.promise).toEqual({ok:false,code:'unknown'});expect(c.transport).toHaveBeenCalledTimes(1);});
it('accepts a valid stale response without inventing an approved classification',async()=>{const d={...decision,status:'stale',confirmed:null};expect(await call({...envelope,decision:d}).promise).toEqual({ok:true,decision:d});});
it.each([[409,'not_applied','conflict'],[503,'unknown','unknown'],[503,'not_applied','unavailable']] as const)('handles HTTP %s persistence %s without retry',async(status,persistence,code)=>{const c=call({version:'classification-decision-v1',error:{code:'synthetic'},persistence},status);expect(await c.promise).toEqual({ok:false,code});expect(c.transport).toHaveBeenCalledTimes(1);});
it('network failure after dispatch is unknown; a retired session cannot publish a late result',async()=>{
 const transport=jest.fn().mockRejectedValue(new Error('Synthetic outage'));expect(await putDecision({baseUrl:'https://fictional.invalid',generation:1,current:()=>true,signal:new AbortController().signal,operation,intent,transport})).toEqual({ok:false,code:'unknown'});expect(transport).toHaveBeenCalledTimes(1);
 let live=true;const late=jest.fn().mockImplementation(async()=>{live=false;return {ok:true,json:async()=>envelope}});expect(await putDecision({baseUrl:'https://fictional.invalid',generation:1,current:()=>live,signal:new AbortController().signal,operation,intent,transport:late})).toEqual({ok:false,code:'session_changed'});
});
