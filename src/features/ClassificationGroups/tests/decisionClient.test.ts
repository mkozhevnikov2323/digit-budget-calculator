import { groupDecisionRequest, type GroupIntent } from '../api/decisionClient';
import {
  getSessionSnapshot,
  transitionSession,
  completeSessionTransition,
} from 'shared/api/sessionBoundary';
import { approved, custom, id, read, wrap } from './fixtures';
const intent = (): GroupIntent => ({
  version: 'classification-group-decision-v3',
  requestId: '10000000-0000-4000-8000-000000000001',
  expectedRevision: null,
  state: 'approved',
  groupId: custom,
  expectedFacts: read().facts,
});
const options = () => ({
  baseUrl: 'https://synthetic.invalid',
  generation: getSessionSnapshot().generation,
  current: () => true,
  signal: new AbortController().signal,
  read: read(),
  intent: intent(),
});
const response = (data: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  }) as Response;
beforeEach(() => localStorage.setItem('token', 'synthetic-test-token'));
afterEach(() => localStorage.clear());
it('sends exactly one PUT with original server facts/revision/ID, no owner, and no implicit retry', async () => {
  const transport = jest
    .fn()
    .mockResolvedValue(
      response(wrap({ outcome: 'created', decision: approved() })),
    );
  const result = await groupDecisionRequest({ ...options(), transport });
  expect(result.ok).toBe(true);
  expect(transport).toHaveBeenCalledTimes(1);
  const [url, request] = transport.mock.calls[0];
  expect(url).toBe(
    `https://synthetic.invalid/classification-groups/operations/expenses/${id}/decision`,
  );
  expect(request.method).toBe('PUT');
  const body = JSON.parse(request.body);
  expect(body).toEqual(intent());
  expect(body.owner).toBeUndefined();
});
it.each([400, 401, 404, 409, 503])(
  'preserves confirmed rejection status %s without accepting a decision',
  async (status) => {
    const transport = jest.fn().mockResolvedValue(
      response(
        {
          version: 'classification-groups-v3',
          error: { code: 'rejected' },
          persistence: 'not_applied',
        },
        status,
      ),
    );
    const r = await groupDecisionRequest({ ...options(), transport });
    expect(r.ok).toBe(false);
    expect(transport).toHaveBeenCalledTimes(1);
  },
);
it('treats malformed acknowledgement, infrastructure uncertainty, timeout and wrong group as unknown', async () => {
  for (const transport of [
    jest.fn().mockRejectedValue(Error('Synthetic network failure')),
    jest.fn().mockResolvedValue(
      response(
        {
          version: 'classification-groups-v3',
          error: { code: 'unavailable' },
          persistence: 'unknown',
        },
        503,
      ),
    ),
    jest.fn().mockResolvedValue(
      response(
        wrap({
          outcome: 'created',
          decision: approved({
            storedGroupId: 'system:expenses:everyday',
            groupId: 'system:expenses:everyday',
          }),
        }),
      ),
    ),
    jest.fn().mockResolvedValue(response({})),
  ]) {
    expect(await groupDecisionRequest({ ...options(), transport })).toEqual({
      ok: false,
      code: 'unknown',
    });
    expect(transport).toHaveBeenCalledTimes(1);
  }
});
it('read-only reconcile reuses the exact intent, and never sends PUT', async () => {
  const transport = jest.fn().mockResolvedValue(
    response(
      wrap({
        version: 'classification-group-reconcile-v3',
        outcome: 'observed_matching',
        decision: approved(),
        consistency: 'observed_only_non_atomic',
      }),
    ),
  );
  expect(
    (await groupDecisionRequest({ ...options(), reconcile: true, transport }))
      .ok,
  ).toBe(true);
  expect(transport.mock.calls[0][1].method).toBe('POST');
  expect(transport.mock.calls[0][0]).toContain('/reconcile');
  expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual(intent());
});
it('retired, aborted and credential-changed responses never become accepted writes', async () => {
  const transport = jest.fn();
  expect(
    await groupDecisionRequest({
      ...options(),
      current: () => false,
      transport,
    }),
  ).toEqual({ ok: false, code: 'session_changed' });
  expect(transport.mock.calls.length).toBe(0);
  let done!: (r: Response) => void;
  transport.mockReturnValue(
    new Promise((r) => {
      done = r;
    }),
  );
  const pending = groupDecisionRequest({ ...options(), transport });
  localStorage.setItem('token', 'different-synthetic-token');
  done(response(wrap({ outcome: 'created', decision: approved() })));
  expect(await pending).toEqual({ ok: false, code: 'session_changed' });
});
it('ignores late results across the existing session generation boundary', async () => {
  let done!: (r: Response) => void;
  const transport = jest.fn().mockReturnValue(
    new Promise((r) => {
      done = r;
    }),
  );
  const pending = groupDecisionRequest({ ...options(), transport });
  const t = transitionSession(() => {});
  completeSessionTransition(getSessionSnapshot().generation);
  await t;
  done(response(wrap({ outcome: 'created', decision: approved() })));
  expect(await pending).toEqual({ ok: false, code: 'session_changed' });
});

it('a malformed not_applied envelope remains unknown, never a confirmed rejection', async () => {
  const transport = jest
    .fn()
    .mockResolvedValue(
      response(
        { version: 'classification-groups-v3', persistence: 'not_applied' },
        503,
      ),
    );
  expect(await groupDecisionRequest({ ...options(), transport })).toEqual({
    ok: false,
    code: 'unknown',
  });
  expect(transport).toHaveBeenCalledTimes(1);
});
