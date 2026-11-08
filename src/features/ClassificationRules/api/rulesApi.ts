import { baseApi } from 'shared/api/baseApi';
import { isCurrentSession } from 'shared/api/sessionBoundary';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import { readClassificationRules, type ClassificationRule } from '../model/contract';

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
    keepUnusedDataFor: 0,
  }),
}) });
export const { useGetClassificationRulesQuery } = classificationRulesApi;
