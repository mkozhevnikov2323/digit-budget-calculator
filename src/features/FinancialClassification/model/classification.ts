import {
  ECONOMIC_ROLES, FINANCIAL_LAYERS, PROVISIONAL_TAXONOMY_VERSION,
  type CategorySuggestion, type CheckedOperationSnapshot, type ClassificationAssignment,
  type ClassificationErrorCode, type ClassificationResult, type DecisionProvenance,
  type ReviewedDecision, type ResolveClassificationInput, type SourceCategory,
} from './types';

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const identity = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && !/\s/.test(value);
const category = (value: unknown): value is SourceCategory => object(value) && (
  value.kind === 'absent' ? !('value' in value) && !('dictionaryStatus' in value)
    : value.kind === 'label' && typeof value.value === 'string' &&
      (value.dictionaryStatus === 'unresolved' || value.dictionaryStatus === 'ambiguous')
);

// Structural consistency only. These are checked facts, not raw API amounts or
// dates: do not coerce/parse/round or duplicate Phase 1 monetary validation.
const snapshot = (value: unknown): value is CheckedOperationSnapshot =>
  object(value) && identity(value.ownerScope) && identity(value.transactionId) && identity(value.revision) &&
  object(value.facts) && typeof value.facts.timestamp === 'number' && typeof value.facts.kopecks === 'number' && (
    value.dataset === 'expenses' ? category(value.facts.category) && !('sourceLabel' in value.facts)
      : value.dataset === 'incomes' && typeof value.facts.sourceLabel === 'string' && !('category' in value.facts)
  );
const assignment = (value: unknown): value is ClassificationAssignment => object(value) && (
  value.economicRole === 'ordinary_expense' ? FINANCIAL_LAYERS.some((layer) => layer === value.layer)
    : value.economicRole !== 'unknown' && ECONOMIC_ROLES.some((role) => role === value.economicRole) && value.layer === null
);
const compatible = (value: ClassificationAssignment, dataset: CheckedOperationSnapshot['dataset']): boolean =>
  value.economicRole === 'ordinary_expense' || value.economicRole === 'loan_issuance' ? dataset === 'expenses'
    : value.economicRole === 'ordinary_income' || value.economicRole === 'loan_repayment' || value.economicRole === 'refund'
      ? dataset === 'incomes' : true;

const suggestion = (value: unknown): value is CategorySuggestion => object(value) &&
  identity(value.id) && identity(value.ownerScope) && identity(value.taxonomyVersion) && identity(value.ruleRevision) &&
  typeof value.sourceLabel === 'string' && assignment(value.assignment) && compatible(value.assignment, 'expenses');

const provenance = (value: unknown): value is DecisionProvenance => object(value) && (
  value.kind === 'manual' ? !('ruleId' in value) && !('ruleRevision' in value) && !('sourceLabel' in value)
    : value.kind === 'category_rule' && identity(value.ruleId) && identity(value.ruleRevision) && typeof value.sourceLabel === 'string'
);
const decision = (value: unknown): value is ReviewedDecision => {
  if (!object(value) || !identity(value.id) || !identity(value.revision) || !identity(value.taxonomyVersion) ||
      !identity(value.reviewerScope) || !snapshot(value.operation) || !provenance(value.provenance)) return false;
  if (value.state === 'explicit_unclassified') return !('assignment' in value) && value.provenance.kind === 'manual';
  if (value.state !== 'approved' || !assignment(value.assignment) || !compatible(value.assignment, value.operation.dataset)) return false;
  return value.provenance.kind === 'manual' || (value.operation.dataset === 'expenses' &&
    value.operation.facts.category.kind === 'label' && value.operation.facts.category.value === value.provenance.sourceLabel);
};

const sameAssignment = (a: ClassificationAssignment, b: ClassificationAssignment) =>
  a.economicRole === b.economicRole && a.layer === b.layer;
const sameIdentity = (a: CheckedOperationSnapshot, b: CheckedOperationSnapshot) =>
  a.ownerScope === b.ownerScope && a.dataset === b.dataset && a.transactionId === b.transactionId;
const sameSnapshot = (a: CheckedOperationSnapshot, b: CheckedOperationSnapshot): boolean => {
  if (!sameIdentity(a, b) || a.revision !== b.revision ||
      a.facts.kopecks !== b.facts.kopecks || a.facts.timestamp !== b.facts.timestamp) return false;
  if (a.dataset === 'incomes' && b.dataset === 'incomes') return a.facts.sourceLabel === b.facts.sourceLabel;
  if (a.dataset !== 'expenses' || b.dataset !== 'expenses') return false;
  const left = a.facts.category; const right = b.facts.category;
  return left.kind === 'absent' ? right.kind === 'absent'
    : right.kind === 'label' && left.value === right.value && left.dictionaryStatus === right.dictionaryStatus;
};
const sameProvenance = (a: DecisionProvenance, b: DecisionProvenance): boolean =>
  a.kind === 'manual' ? b.kind === 'manual' : b.kind === 'category_rule' &&
    a.ruleId === b.ruleId && a.ruleRevision === b.ruleRevision && a.sourceLabel === b.sourceLabel;
const sameOutcome = (a: ReviewedDecision, b: ReviewedDecision): boolean =>
  a.state === 'explicit_unclassified' ? b.state === 'explicit_unclassified'
    : b.state === 'approved' && sameAssignment(a.assignment, b.assignment);
const sameDecision = (a: ReviewedDecision, b: ReviewedDecision) =>
  a.revision === b.revision && a.reviewerScope === b.reviewerScope && a.taxonomyVersion === b.taxonomyVersion &&
  sameSnapshot(a.operation, b.operation) && sameOutcome(a, b) && sameProvenance(a.provenance, b.provenance);
const sameSuggestion = (a: CategorySuggestion, b: CategorySuggestion) =>
  a.ownerScope === b.ownerScope && a.taxonomyVersion === b.taxonomyVersion && a.ruleRevision === b.ruleRevision &&
  a.sourceLabel === b.sourceLabel && sameAssignment(a.assignment, b.assignment);

const copyAssignment = (value: ClassificationAssignment): ClassificationAssignment => value.economicRole === 'ordinary_expense'
  ? { economicRole: value.economicRole, layer: value.layer } : { economicRole: value.economicRole, layer: null };
const copySnapshot = (value: CheckedOperationSnapshot): CheckedOperationSnapshot => {
  const common = { ownerScope: value.ownerScope, dataset: value.dataset,
    transactionId: value.transactionId, revision: value.revision };
  const facts = { timestamp: value.facts.timestamp, kopecks: value.facts.kopecks };
  if (value.dataset === 'incomes') return { ...common, dataset: 'incomes', facts: { ...facts, sourceLabel: value.facts.sourceLabel } };
  const label = value.facts.category;
  return { ...common, dataset: 'expenses', facts: { ...facts, category: label.kind === 'absent'
    ? { kind: 'absent' } : { kind: 'label', value: label.value, dictionaryStatus: label.dictionaryStatus } } };
};
const copyProvenance = (value: DecisionProvenance): DecisionProvenance => value.kind === 'manual'
  ? { kind: 'manual' } : { kind: 'category_rule', ruleId: value.ruleId, ruleRevision: value.ruleRevision, sourceLabel: value.sourceLabel };
const copyDecision = (value: ReviewedDecision): ReviewedDecision => {
  const common = { id: value.id, revision: value.revision, taxonomyVersion: value.taxonomyVersion,
    reviewerScope: value.reviewerScope, operation: copySnapshot(value.operation) };
  return value.state === 'approved'
    ? { ...common, state: 'approved', assignment: copyAssignment(value.assignment), provenance: copyProvenance(value.provenance) }
    : { ...common, state: 'explicit_unclassified', provenance: { kind: 'manual' } };
};
const copySuggestion = (value: CategorySuggestion): CategorySuggestion => ({
  id: value.id, ownerScope: value.ownerScope, taxonomyVersion: value.taxonomyVersion,
  ruleRevision: value.ruleRevision, sourceLabel: value.sourceLabel, assignment: copyAssignment(value.assignment),
});

/** Dedupe exact same-ID candidates, retaining all equivalent distinct IDs.
 * Contradictory revisions under one ID are never selected by ordering. */
const unique = <T extends { readonly id: string }>(items: readonly T[], equal: (a: T, b: T) => boolean): T[] | null => {
  const byId = new Map<string, T>();
  for (const item of items) {
    const previous = byId.get(item.id);
    if (previous && !equal(previous, item)) return null;
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
};
const failure = (code: ClassificationErrorCode): ClassificationResult => ({ ok: false, error: { code } });

/** Pure, synchronous, single-operation resolution. Not authorization, fetching,
 * financial validation, historical-version selection or persistence. See README. */
export const resolveClassification = (input: ResolveClassificationInput): ClassificationResult => {
  if (!object(input) || !snapshot(input.operation)) return failure('invalid_operation');
  if (input.taxonomyVersion !== PROVISIONAL_TAXONOMY_VERSION) return failure('unsupported_taxonomy');
  if (!Array.isArray(input.suggestions) || ![...input.suggestions].every(suggestion)) return failure('invalid_suggestion');
  if (!Array.isArray(input.decisions) || ![...input.decisions].every(decision)) return failure('invalid_decision');
  const { operation, suggestions, decisions } = input;
  if (suggestions.some((item) => item.ownerScope !== operation.ownerScope) ||
      decisions.some((item) => item.operation.ownerScope !== operation.ownerScope || item.reviewerScope !== operation.ownerScope)) {
    return failure('owner_mismatch');
  }
  if (suggestions.some((item) => item.taxonomyVersion !== input.taxonomyVersion) ||
      decisions.some((item) => item.taxonomyVersion !== input.taxonomyVersion)) return failure('taxonomy_mismatch');

  const relevantDecisions = decisions.filter((item) => sameIdentity(item.operation, operation));
  if (relevantDecisions.some((item) => !sameSnapshot(item.operation, operation))) return failure('stale_decision');
  const current = unique(relevantDecisions, sameDecision);
  if (!current || current.some((item) => !sameOutcome(item, current[0]))) return failure('conflicting_decisions');
  const base = { operation: copySnapshot(operation), taxonomyVersion: PROVISIONAL_TAXONOMY_VERSION };
  // All candidates already satisfy scope/version/shape. Explicit review takes
  // precedence even when applicable suggestions disagree with one another.
  const reviewed = current[0];
  if (reviewed) {
    const evidence = current.map(copyDecision);
    return reviewed.state === 'approved'
      ? { ok: true, value: { ...base, state: 'approved', confirmed: copyAssignment(reviewed.assignment), decisions: evidence } }
      : { ok: true, value: { ...base, state: 'explicit_unclassified', confirmed: null, economicRole: 'unknown', decisions: evidence } };
  }

  const applicable = suggestions.filter((item) => operation.dataset === 'expenses' &&
    operation.facts.category.kind === 'label' && item.sourceLabel === operation.facts.category.value);
  const proposals = unique(applicable, sameSuggestion);
  if (!proposals || proposals.some((item) => !sameAssignment(item.assignment, proposals[0].assignment))) {
    return failure('conflicting_suggestions');
  }
  const proposed = proposals[0];
  return proposed
    ? { ok: true, value: { ...base, state: 'proposed', confirmed: null, economicRole: 'unknown', proposal: {
      assignment: copyAssignment(proposed.assignment), suggestions: proposals.map(copySuggestion),
    } } }
    : { ok: true, value: { ...base, state: 'unclassified', confirmed: null, economicRole: 'unknown' } };
};
