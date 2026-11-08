import { baseApi } from 'shared/api/baseApi';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import { readClassificationRules, type ClassificationRule, type RuleInput, type RuleChange } from '../model/contract';

export const ruleScopeKey = (scope: VerifiedOwner) => `${scope.userId}:${scope.sessionGeneration}`;
export type RuleWriteAction = ({ method: 'POST'; body: RuleInput } | { method: 'PATCH'; id: string; body: RuleChange } | { method: 'DELETE'; id: string });
type WriteRule = VerifiedOwner & RuleWriteAction;
const invalid = () => ({ error: { status: 'CUSTOM_ERROR' as const, error: 'RULES_UNAVAILABLE' } });
export const classificationRulesApi = baseApi.injectEndpoints({ endpoints: builder => ({
  getClassificationRules: builder.query<ClassificationRule[], VerifiedOwner>({
    async queryFn(scope, api, _options, query) {
      const current = () => !api.signal.aborted && isCurrentSession(scope.sessionGeneration);
      if (!current()) return invalid();
      const result = await query({ url: '/classification-rules', method: 'GET', cache: 'no-store' });
      if (!current()) return invalid();
      if (result.error) return { error: result.error };
      const rules = readClassificationRules(result.data, scope.userId);
      return rules ? { data: rules } : invalid();
    },
    providesTags: (_data, _error, scope) => [{ type: 'ClassificationRule', id: ruleScopeKey(scope) }],
    keepUnusedDataFor: 0,
  }),
  writeClassificationRule: builder.mutation<{ confirmed: true }, WriteRule>({
    async queryFn(args, api, _options, query) {
      const current = () => !api.signal.aborted && isCurrentSession(args.sessionGeneration);
      if (!current()) return invalid();
      const result = await query({ url: args.method === 'POST' ? '/classification-rules' : `/classification-rules/${encodeURIComponent(args.id)}`,
        method: args.method, ...(args.method === 'DELETE' ? {} : { body: args.body }), cache: 'no-store' });
      if (!current()) return invalid();
      if (result.error) return { error: result.error };
      if (args.method === 'DELETE') return result.meta?.response?.status === 204 ? { data: { confirmed: true } } : invalid();
      const rule = readClassificationRules({ rules: [result.data] }, args.userId)?.[0];
      if (!rule || args.method === 'PATCH' && rule._id !== args.id) return invalid();
      // The returned record must confirm the requested intent, including normalized text.
      for (const [field, value] of Object.entries(args.body)) {
        const actual: unknown = Object.getOwnPropertyDescriptor(rule, field)?.value;
        const expected = ['category', 'title', 'source'].includes(field) && typeof value === 'string' ? value.trim().toLowerCase() : value;
        if (field === 'title' && expected === null ? actual !== undefined : actual !== expected) return invalid();
      }
      if (args.method === 'POST' && args.body.dataset === 'expenses' && !args.body.title && rule.dataset === 'expenses' && rule.title !== undefined) return invalid();
      return { data: { confirmed: true } };
    },
    invalidatesTags: (result, _error, scope) => result ? [{ type: 'ClassificationRule', id: ruleScopeKey(scope) }] : [],
  }),
}) });
export const { useGetClassificationRulesQuery, useWriteClassificationRuleMutation } = classificationRulesApi;
