import { createManualClient, type ReviewRequest } from '../../api/manualClient';
import { getSessionSnapshot } from 'shared/api/sessionBoundary';
const dataset = 'expenses', id = '1'.repeat(24);
const request: ReviewRequest = { version: 'classification-review-request-v1', browserReviewContext: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  requestId: '12345678-1234-4234-8234-123456789abc', expectedRevision: null, state: 'approved', assignment: { economicRole: 'ordinary_expense', layer: 'everyday' } };
const reviewed = () => ({ version: 'classification-review-v1', dataset, operationId: id, taxonomyVersion: 'financial-classification-v1',
  browserReviewContext: request.browserReviewContext, currentDecision: { storedState: null, decisionRevision: null },
  intent: { requestId: request.requestId, expectedRevision: null, state: 'approved', assignment: request.assignment },
  facts: { amount: { format: 'binary64-roundtrip-decimal', value: '12.340000000000002' }, dateEpochMs: 1736942400001,
    category: 'Транспорт', title: '<script>fictional</script>', recipient: 'Fictional', comment: { kind: 'missing' } },
  reviewProof: 'crp1.synthetic.AAAA.BBBB.CCCC', expiresAt: 4102444800, consistency: 'observed_only_non_atomic' });
const ack = () => ({ version: 'classification-write-ack-v1', dataset, operationId: id, requestId: request.requestId,
  outcome: 'created', storedState: 'approved', decisionRevision: 1, sourceStatus: 'matching_observed', confirmed: null, consistency: 'observed_only_non_atomic' });
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
    expect(storage).not.toHaveBeenCalled(); expect(t.transport.mock.calls[0][0]).not.toContain('crp1');
  } finally { storage.mockRestore(); }
});
for (const [label, change] of [
  ['wrong identity', (r: ReturnType<typeof reviewed>) => ({ ...r, operationId: '2'.repeat(24) })],
  ['different intent', (r: ReturnType<typeof reviewed>) => ({ ...r, intent: { ...r.intent, expectedRevision: 1 } })],
  ['different browser context', (r: ReturnType<typeof reviewed>) => ({ ...r, browserReviewContext: 'other' })],
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
  expect(Object.keys(body).sort()).toEqual(['version', 'browserReviewContext', 'requestId', 'expectedRevision', 'state', 'assignment', 'reviewProof'].sort());
  expect(body.reviewProof === p.value.reviewProof).toBe(true); expect(body.requestId === request.requestId).toBe(true);
});
for (const failure of ['lost acknowledgement', 'invalid acknowledgement', 'server error']) it('keeps '+failure+' indeterminate without automatic retry', async () => {
  const t = setup(); t.transport.mockResolvedValueOnce(response(reviewed())); const p = await t.client.prepare(dataset, id, request); if (!p.ok) throw Error('Fixture');
  if (failure === 'lost acknowledgement') t.transport.mockRejectedValueOnce(new Error('Fictional transport failure'));
  else t.transport.mockResolvedValueOnce(response(failure === 'server error' ? {} : { ...ack(), requestId: 'other' }, failure === 'server error' ? 503 : 200));
  const r = await t.client.apply(dataset, id, p.value); expect(r.ok).toBe(false); if (!r.ok) expect(r.code).toBe('unknown_outcome'); expect(t.transport).toHaveBeenCalledTimes(2);
});
it('uses only read-only reconciliation for an expired uncertain proof', async () => {
  const t = setup(); t.transport.mockResolvedValueOnce(response(reviewed())); const p = await t.client.prepare(dataset, id, request); if (!p.ok) throw Error('Fixture');
  p.value.expiresAt = 1;
  t.transport.mockResolvedValueOnce(response({ version: 'classification-reconcile-v1', dataset, operationId: id, requestId: request.requestId,
    result: 'latest_applied', receipt: { storedState: 'approved', decisionRevision: 1, sourceStatus: 'stale' }, confirmed: null, consistency: 'observed_only_non_atomic' }));
  const r = await t.client.reconcile(dataset, id, p.value); expect(r.ok).toBe(true); expect(t.transport.mock.calls[1][0]).toContain('/commands/reconcile');
});
it('suppresses old-session responses and prevents subsequent requests', async () => {
  const t = setup(); t.transport.mockImplementation(async () => { t.end(); return response(reviewed()); });
  const r = await t.client.prepare(dataset, id, request); expect(r.ok).toBe(false); if (!r.ok) expect(r.code).toBe('session_changed');
  await t.client.prepare(dataset, id, request); expect(t.transport).toHaveBeenCalledTimes(1);
});
