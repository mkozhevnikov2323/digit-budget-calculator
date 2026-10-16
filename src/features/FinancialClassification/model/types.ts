import type { AnalyticsDataset, ValidatedTransaction } from '../../FinancialAnalytics/model/types';

/** Experimental codes, not persistence or public API contracts. */
export const FINANCIAL_LAYERS = Object.freeze([
  'everyday', 'irregular', 'emergency', 'major_goals', 'long_term_capital',
] as const);
export type FinancialLayer = typeof FINANCIAL_LAYERS[number];

export const ECONOMIC_ROLES = Object.freeze([
  'unknown', 'ordinary_expense', 'ordinary_income', 'loan_issuance',
  'loan_repayment', 'refund', 'internal_transfer', 'capital_movement',
] as const);
export type EconomicRole = typeof ECONOMIC_ROLES[number];
export const PROVISIONAL_TAXONOMY_VERSION = 'financial-layers-v1-provisional' as const;
export type TaxonomyVersion = typeof PROVISIONAL_TAXONOMY_VERSION;

export type OperationIdentity = {
  readonly ownerScope: string;
  readonly dataset: AnalyticsDataset;
  readonly transactionId: string;
};

/** Neither variant asserts a dictionary foreign key. Ambiguity is explicit
 * caller-supplied evidence, never inferred by this module from a label. */
export type SourceCategory =
  | { readonly kind: 'absent' }
  | { readonly kind: 'label'; readonly value: string;
      readonly dictionaryStatus: 'unresolved' | 'ambiguous' };

type CheckedFacts = Readonly<Pick<ValidatedTransaction, 'timestamp' | 'kopecks'>>;
/** Money/date validation belongs to Phase 1. Caller must change revision when
 * any other review-relevant fact (e.g. title/comment) changes. No hashing here. */
export type CheckedOperationSnapshot = OperationIdentity & { readonly revision: string } & (
  | { readonly dataset: 'expenses'; readonly facts: CheckedFacts & { readonly category: SourceCategory } }
  | { readonly dataset: 'incomes'; readonly facts: CheckedFacts & { readonly sourceLabel: string } }
);

/** Spending layers are only allowed with an explicitly supplied ordinary
 * expense role. Refund means an incoming purchase refund in this small model.
 * Capital principal/transfer/loans/income are deliberately outside spending. */
export type ClassificationAssignment =
  | { readonly economicRole: 'ordinary_expense'; readonly layer: FinancialLayer }
  | { readonly economicRole: Exclude<EconomicRole, 'unknown' | 'ordinary_expense'>; readonly layer: null };

export type CategorySuggestion = {
  readonly id: string;
  readonly ownerScope: string;
  readonly taxonomyVersion: string;
  readonly ruleRevision: string;
  /** Exact source string, no trim, case folding or Unicode normalization. */
  readonly sourceLabel: string;
  readonly assignment: ClassificationAssignment;
};

export type DecisionProvenance =
  | { readonly kind: 'manual' }
  | { readonly kind: 'category_rule'; readonly ruleId: string;
      readonly ruleRevision: string; readonly sourceLabel: string };

export type ReviewedDecision = {
  readonly id: string;
  readonly revision: string;
  readonly taxonomyVersion: string;
  readonly reviewerScope: string;
  readonly operation: CheckedOperationSnapshot;
} & (
  | { readonly state: 'approved'; readonly assignment: ClassificationAssignment;
      readonly provenance: DecisionProvenance }
  | { readonly state: 'explicit_unclassified'; readonly assignment?: never;
      readonly provenance: { readonly kind: 'manual' } }
);

type ResolutionBase = {
  readonly operation: CheckedOperationSnapshot;
  readonly taxonomyVersion: TaxonomyVersion;
};
export type ResolvedClassification = ResolutionBase & (
  | { readonly state: 'unclassified'; readonly confirmed: null; readonly economicRole: 'unknown' }
  | { readonly state: 'proposed'; readonly confirmed: null; readonly economicRole: 'unknown';
      readonly proposal: { readonly assignment: ClassificationAssignment;
        readonly suggestions: readonly CategorySuggestion[] } }
  | { readonly state: 'approved'; readonly confirmed: ClassificationAssignment;
      readonly decisions: readonly ReviewedDecision[] }
  | { readonly state: 'explicit_unclassified'; readonly confirmed: null; readonly economicRole: 'unknown';
      readonly decisions: readonly ReviewedDecision[] }
);

export type ClassificationErrorCode =
  | 'invalid_operation' | 'invalid_suggestion' | 'invalid_decision'
  | 'unsupported_taxonomy' | 'taxonomy_mismatch' | 'owner_mismatch'
  | 'stale_decision' | 'conflicting_decisions' | 'conflicting_suggestions';
export type ClassificationResult =
  | { readonly ok: true; readonly value: ResolvedClassification }
  | { readonly ok: false; readonly error: { readonly code: ClassificationErrorCode } };

export type ResolveClassificationInput = {
  readonly operation: CheckedOperationSnapshot;
  readonly taxonomyVersion: string;
  readonly suggestions: readonly CategorySuggestion[];
  /** Active candidates only; selecting/superseding historical versions is not
   * this resolver's job. Other operations in the same scope may be present. */
  readonly decisions: readonly ReviewedDecision[];
};
