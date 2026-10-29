import { createManualClient, type ReviewRequest } from '../../api/manualClient';
import { getSessionSnapshot } from 'shared/api/sessionBoundary';
const dataset = 'expenses', id = '1'.repeat(24);
const request: ReviewRequest = { version: 'classification-c-v1',
  requestId: '12345678-1234-4234-8234-123456789abc', expectedRevision: null, state: 'approved', assignment: { economicRole: 'ordinary_expense', layer: 'everyday' } };
const reviewed = () => ({ version: 'classification-c-v1',
  currentDecision: {version:'classification-read-v1',dataset,operationId:id,status:'unreviewed', storedState:null,decisionRevision:null,confirmed:null,consistency:'observed_only_non_atomic'},
  command:{kind:'manual_classification',dataset,operationId:id,requestId:request.requestId,expectedRevision:null,state:'approved',assignment:request.assignment},
  facts:{amount:{format:'binary64-roundtrip-decimal',value:'12.340000000000002'},dateEpochMs:1736942400001,date:'2025-01-15T12:00:00.001Z',category:'Транспорт',title:'<script>fictional</script>',recipient:'Fictional',comment:{kind:'missing'}},
  preparationId:'A'.repeat(43),expiresAt:4102444800000,consistency:'observed_only_non_atomic'});
const ack = () => ({version:'classification-c-v1',result:{ok:true,value:{version:'classification-write-result-v1',outcome:'created',storedState:'approved',decisionRevision:1,sourceStatus:'matching_observed',confirmed:null,consistency:'observed_only_non_atomic'}}});
const setup = () => {
  let current = true;
  const transport = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>(), controller = new AbortController();
  const client = createManualClient({ baseUrl: 'https://fictional.invalid', generation: getSessionSnapshot().generation,
    current: () => current, signal: controller.signal, transport, credential: () => 'fictional-test-only-bearer' });
  return { transport, client, controller, end: () => { current = false; } };
};
// Browser JSON is created in the caller's realm. Node's native Response.json in
// jsdom returns a foreign-realm object that the strict prototype policy rejects.
const response = (body: unknown, status = 200) => ({ status, ok: status >= 200 && status < 300,
  json: async () => JSON.parse(JSON.stringify(body)) }) as Response;
it('prepares exact server facts without rounding or moving proof into browser storage', async () => {
  const t = setup(), storage = jest.spyOn(Storage.prototype, 'setItem'); t.transport.mockResolvedValue(response(reviewed()));
  try {
    const r = await t.client.prepare(dataset, id, request); expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.value.facts.amount as { value: string }).value === '12.340000000000002').toBe(true);
    expect(t.transport.mock.calls[0][1]?.cache).toBe('no-store'); expect(t.transport.mock.calls[0][1]?.credentials).toBe('omit');
    expect(storage).not.toHaveBeenCalled(); expect(String(t.transport.mock.calls[0][0]).includes('crp1')).toBe(false);
  } finally { storage.mockRestore(); }
});
for (const [label, change] of [
  ['wrong identity', (r: ReturnType<typeof reviewed>) => ({ ...r, command: {...r.command,operationId:'2'.repeat(24)} })],
  ['different intent', (r: ReturnType<typeof reviewed>) => ({ ...r, command: { ...r.command, expectedRevision: 1 } })],
  ['invalid context ID', (r: ReturnType<typeof reviewed>) => ({ ...r, preparationId: 'other' })],
  ['private digest', (r: ReturnType<typeof reviewed>) => ({ ...r, sourceFingerprint: 'private' })],
  ['invalid facts', (r: ReturnType<typeof reviewed>) => ({ ...r, facts: { ...r.facts, amount: { format: 'binary64-roundtrip-decimal', value: '12.340' } } })],
] as const) it('rejects review '+label, async () => {
  const t = setup(); t.transport.mockResolvedValue(response(change(reviewed()))); const r = await t.client.prepare(dataset, id, request);
  expect(r.ok).toBe(false); if (!r.ok) expect(r.code).toBe('invalid_response');
});
it('submits exactly the frozen intent/proof and requires validated acknowledgement', async () => {
  const t = setup(); t.transport.mockResolvedValueOnce(response(reviewed())).mockResolvedValueOnce(response(ack()));
  const p = await t.client.prepare(dataset, id, request); expect(p.ok).toBe(true); if (!p.ok) return;
  const r = await t.client.apply(dataset, id, p.value); expect(r.ok).toBe(true);
  const body = JSON.parse(String(t.transport.mock.calls[1][1]?.body));
  expect(Object.keys(body).sort()).toEqual(['version','preparationId','confirmation'].sort());
  expect(body.preparationId === p.value.preparationId).toBe(true); expect(body.confirmation === 'confirm_prepared_intent').toBe(true);
});
for (const failure of ['lost acknowledgement', 'invalid acknowledgement', 'server error']) it('keeps '+failure+' indeterminate without automatic retry', async () => {
  const t = setup(); t.transport.mockResolvedValueOnce(response(reviewed())); const p = await t.client.prepare(dataset, id, request); if (!p.ok) throw Error('Fixture');
  if (failure === 'lost acknowledgement') t.transport.mockRejectedValueOnce(new Error('Fictional transport failure'));
  else t.transport.mockResolvedValueOnce(response(failure === 'server error' ? {} : { ...ack(), unexpected:true }, failure === 'server error' ? 503 : 200));
  const r = await t.client.apply(dataset, id, p.value); expect(r.ok).toBe(false); if (!r.ok) expect(r.code).toBe('unknown_outcome'); expect(t.transport).toHaveBeenCalledTimes(2);
});
it('uses only read-only reconciliation for an expired uncertain proof', async () => {
  const t = setup(); t.transport.mockResolvedValueOnce(response(reviewed())); const p = await t.client.prepare(dataset, id, request); if (!p.ok) throw Error('Fixture');
  p.value.expiresAt = 1;
  t.transport.mockResolvedValueOnce(response({ version:'classification-c-v1',outcome:'latest_applied',consistency:'observed_only_non_atomic' }));
  const r = await t.client.reconcile(dataset, id, p.value); expect(r.ok).toBe(true); expect(String(t.transport.mock.calls[1][0]).includes('/c-v1/reconcile')).toBe(true);
});
it('suppresses old-session responses and prevents subsequent requests', async () => {
  const t = setup(); t.transport.mockImplementation(async () => { t.end(); return response(reviewed()); });
  const r = await t.client.prepare(dataset, id, request); expect(r.ok).toBe(false); if (!r.ok) expect(r.code).toBe('session_changed');
  await t.client.prepare(dataset, id, request); expect(t.transport).toHaveBeenCalledTimes(1);
});
it('treats a server 401 as a retired manual-review lifecycle, including legacy auth error bodies', async () => {
  const t = setup(); t.transport.mockResolvedValueOnce(response({ message: 'Synthetic authorization required' }, 401));
  const r = await t.client.prepare(dataset, id, request); expect(r.ok).toBe(false); if (!r.ok) expect(r.code).toBe('session_changed');
});

it('does not retry when context is lost',async()=>{const t=setup();t.transport.mockResolvedValueOnce(response(reviewed()));const p=await t.client.prepare(dataset,id,request);if(!p.ok)throw Error('fixture');t.transport.mockResolvedValueOnce(response({},410));expect(await t.client.apply(dataset,id,p.value)).toEqual({ok:false,code:'context_lost'});expect(t.transport).toHaveBeenCalledTimes(2);});

for(const change of [
 (r:ReturnType<typeof reviewed>)=>({...r,currentDecision:{...r.currentDecision,decisionRevision:1}}),
 (r:ReturnType<typeof reviewed>)=>({...r,expiresAt:Date.now()-1}),
 (r:ReturnType<typeof reviewed>)=>({...r,command:{...r.command,assignment:{economicRole:'ordinary_income',layer:null}}}),
]) it('rejects invalid C preparation authority',async()=>{const t=setup();t.transport.mockResolvedValue(response(change(reviewed())));expect((await t.client.prepare(dataset,id,request)).ok).toBe(false);});

it('pending 409 preserves uncertainty rather than allowing a fresh write',async()=>{const t=setup();t.transport.mockResolvedValueOnce(response(reviewed()));const p=await t.client.prepare(dataset,id,request);if(!p.ok)throw Error('fixture');t.transport.mockResolvedValueOnce(response({version:'classification-c-v1',error:{code:'write_pending'},persistence:'unknown'},409));expect(await t.client.apply(dataset,id,p.value)).toEqual({ok:false,code:'unknown_outcome'});expect(t.transport).toHaveBeenCalledTimes(2);});
