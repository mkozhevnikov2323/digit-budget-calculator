import type { GroupRead, GroupRule, Proposal } from './contract';
import type { HistoryOperation } from 'features/HistoricalClassification/model/history';
export type GroupCandidate = {
  operation: HistoryOperation;
  decision: GroupRead;
  proposal: Proposal;
};
/** Bound each proposal to the currently loaded rule, exact read and target. */
export const groupCandidates = (
  proposals: readonly Proposal[],
  rows: readonly { operation: HistoryOperation; decision: GroupRead }[],
  rules: readonly GroupRule[],
  risk: (op: HistoryOperation) => boolean,
): GroupCandidate[] => {
  const byId = new Map(
    rows.map((r) => [`${r.operation.dataset}/${r.operation.operationId}`, r]),
  );
  return proposals.flatMap((p) => {
    const row = byId.get(`${p.dataset}/${p.operationId}`),
      rule = rules.find((r) => r.id === p.match?.ruleId);
    if (
      !row ||
      !p.eligible ||
      p.sourceStatus !== 'unreviewed' ||
      row.decision.status !== 'unreviewed' ||
      p.expectedRevision !== row.decision.decisionRevision ||
      JSON.stringify(p.expectedFacts) !== JSON.stringify(row.decision.facts) ||
      risk(row.operation) ||
      !rule ||
      rule.etag !== p.match?.ruleEtag ||
      rule.groupId !== p.match?.groupId ||
      rule.diagnostic !== 'ready'
    )
      return [];
    return [{ ...row, proposal: p }];
  });
};
