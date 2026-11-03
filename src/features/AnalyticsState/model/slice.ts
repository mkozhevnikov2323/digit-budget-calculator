import {
  createSlice,
  type PayloadAction,
  type Middleware,
} from '@reduxjs/toolkit';
import {
  selectedPeriod,
  type PeriodSelection,
} from 'pages/AnalyticsPage/ui/selection';
export const analyticsPages = [
  'overview',
  'categories',
  'recurrence',
  'similar',
  'income-sources',
  'history',
  'classification',
  'classification-stats',
  'planning',
] as const;
export type AnalyticsPageKey = (typeof analyticsPages)[number];
type Values = Record<string, unknown>;
export type AnalyticsUI = {
  scope: string;
  pages: Partial<Record<AnalyticsPageKey, Values>>;
};
const initialState: AnalyticsUI = { scope: '', pages: {} };
const slice = createSlice({
  name: 'analyticsUI',
  initialState,
  reducers: {
    setValue(
      state,
      action: PayloadAction<{
        scope: string;
        page: AnalyticsPageKey;
        field: string;
        value: unknown;
      }>,
    ) {
      const { scope, page, field, value } = action.payload;
      if (state.scope !== scope) {
        state.scope = scope;
        state.pages = displayPreferences(state.pages);
      }
      (state.pages[page] ??= {})[field] = value;
    },
    hydratePreferences(state, action: PayloadAction<AnalyticsUI['pages']>) {
      state.pages = action.payload;
    },
    resetPageInput(state, action: PayloadAction<AnalyticsPageKey>) {
      state.pages[action.payload] =
        displayPreferences(state.pages)[action.payload] ?? {};
    },
    clearAnalytics: () => initialState,
  },
});
export const { setValue, hydratePreferences, clearAnalytics, resetPageInput } =
  slice.actions;
export const analyticsUIReducer = slice.reducer;
const KEY = 'budget-analytics-display-v1';
const validSelection = (value: unknown): value is PeriodSelection => {
  if (!value || typeof value !== 'object') return false;
  const r = value as PeriodSelection;
  return (
    Object.keys(r).sort().join(',') === 'end,kind,month,start,year' &&
    ['month', 'quarter', 'year', 'custom'].includes(r.kind) &&
    typeof r.year === 'string' &&
    /^\d{1,4}$/.test(r.year) &&
    Number.isInteger(r.month) &&
    r.month >= 1 &&
    r.month <= 12 &&
    typeof r.start === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.start) &&
    typeof r.end === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(r.end) &&
    selectedPeriod(r).ok
  );
};
/** Only validated, non-secret dates/modes/counts. Never serialize the Redux tree. */
export const displayPreferences = (
  input: AnalyticsUI['pages'],
): AnalyticsUI['pages'] => {
  const out: AnalyticsUI['pages'] = {};
  for (const page of analyticsPages) {
    const src = input[page];
    if (!src || typeof src !== 'object') continue;
    const p: Values = {};
    if (validSelection(src.selection)) p.selection = src.selection;
    if ([3, 6, 12].includes(src.months as number)) p.months = src.months;
    if (
      Number.isSafeInteger(src.page) &&
      Number(src.page) >= 0 &&
      Number(src.page) <= 2000
    )
      p.page = src.page;
    if (
      Number.isSafeInteger(src.visible) &&
      Number(src.visible) >= 20 &&
      Number(src.visible) <= 1000
    )
      p.visible = src.visible;
    out[page] = p;
  }
  return out;
};
export const loadPreferences = (): AnalyticsUI['pages'] => {
  try {
    const text = localStorage.getItem(KEY);
    if (!text || text.length > 12000) return {};
    const r = JSON.parse(text);
    return r?.version === 1 ? displayPreferences(r.pages ?? {}) : {};
  } catch {
    return {};
  }
};
export const preferencesMiddleware: Middleware =
  (api) => (next) => (action) => {
    const result = next(action);
    if (
      setValue.match(action) &&
      ['selection', 'months', 'page', 'visible'].includes(action.payload.field)
    ) {
      try {
        const state = api.getState() as { analyticsUI: AnalyticsUI };
        localStorage.setItem(
          KEY,
          JSON.stringify({
            version: 1,
            pages: displayPreferences(state.analyticsUI.pages),
          }),
        );
      } catch {
        /* Optional preferences never block editing. */
      }
    }
    return result;
  };
