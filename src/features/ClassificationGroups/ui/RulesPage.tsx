import { useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'react-router';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { useVerifiedOwner } from 'entities/User/model/useVerifiedOwner';
import type { VerifiedOwner } from 'entities/User/model/verifiedOwner';
import {
  useGetDefaultCategoriesQuery,
  useGetUserCategoriesQuery,
} from 'entities/ExpenseCategory/api/expenseCategoryApi';
import { useGetExpenseTitlesQuery } from 'entities/ExpenseTitle/api/expenseTitleApi';
import {
  useGetDefaultSourcesQuery,
  useGetUserSourcesQuery,
} from 'entities/IncomeSource/api/sourceApi';
import { useGroupCatalogQuery, useGroupRulesQuery } from '../api/groupsApi';
import type { Dataset, Group, GroupRule } from '../model/contract';
import { GroupSelect, diagnosticLabel } from './GroupSelect';
import { MetadataFeedback, useMetadata } from './Metadata';
type Values = {
  category: string;
  title: string;
  source: string;
  groupId: string;
};
const RuleForm = ({
  dataset,
  rule,
  groups,
  busy,
  feedback,
  save,
  close,
}: {
  dataset: Dataset;
  rule?: GroupRule;
  groups: Group[];
  busy: boolean;
  feedback: ReactNode;
  save: (body: Record<string, unknown>) => Promise<void>;
  close: () => void;
}) => {
  const form = useForm<Values>({
    defaultValues: {
      category: rule?.category ?? '',
      title: rule?.title ?? '',
      source: rule?.source ?? '',
      groupId: rule?.groupId ?? '',
    },
  });
  const opts = {
    skip: dataset !== 'expenses',
    refetchOnMountOrArgChange: true,
  };
  const categories = useGetDefaultCategoriesQuery(undefined, opts),
    userCategories = useGetUserCategoriesQuery(undefined, opts),
    titles = useGetExpenseTitlesQuery(undefined, opts);
  const sources = useGetDefaultSourcesQuery(undefined, {
      skip: dataset !== 'incomes',
      refetchOnMountOrArgChange: true,
    }),
    userSources = useGetUserSourcesQuery(undefined, {
      skip: dataset !== 'incomes',
      refetchOnMountOrArgChange: true,
    });
  const names = (
    ...queries: {
      currentData?: { name: string }[];
      isFetching: boolean;
      isError: boolean;
    }[]
  ) => [
    ...new Set(
      queries.flatMap((q) =>
        !q.isFetching && !q.isError && Array.isArray(q.currentData)
          ? q.currentData.flatMap((r) =>
              typeof r?.name === 'string' ? [r.name] : [],
            )
          : [],
      ),
    ),
  ];
  const field = (
    name: 'category' | 'title' | 'source',
    label: string,
    options: string[],
    required: boolean,
  ) => (
    <Controller
      control={form.control}
      name={name}
      rules={{
        validate: (v) =>
          !required || v.trim().length > 0 || 'Обязательное поле',
      }}
      render={({ field, fieldState }) => (
        <Autocomplete
          freeSolo
          options={options}
          inputValue={field.value}
          disabled={busy}
          onInputChange={(_e, v) => field.onChange(v)}
          renderInput={(p) => (
            <TextField
              {...p}
              label={label}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              required={required}
            />
          )}
        />
      )}
    />
  );
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={() => {
        if (!busy) close();
      }}
      aria-labelledby="group-rule-title"
    >
      <form
        onSubmit={form.handleSubmit(async (v) => {
          if (busy) return;
          await save({
            ...(rule ? {} : { dataset }),
            enabled: rule?.enabled ?? true,
            ...(dataset === 'expenses'
              ? {
                  category: v.category.trim(),
                  ...(v.title.trim()
                    ? { title: v.title.trim() }
                    : rule
                      ? { title: null }
                      : {}),
                }
              : { source: v.source.trim() }),
            groupId: v.groupId,
          });
        })}
      >
        <DialogTitle id="group-rule-title">
          {rule ? 'Редактировать правило' : 'Добавить правило'}
        </DialogTitle>
        <DialogContent>
          <Stack
            spacing={2}
            sx={{ pt: 1 }}
          >
            {feedback}
            {rule && (
              <Typography>
                Сохранённая группа: {rule.group?.name ?? 'Недоступна'} ·{' '}
                {diagnosticLabel(rule.diagnostic)}
              </Typography>
            )}
            {dataset === 'expenses' ? (
              <>
                {field(
                  'category',
                  'Категория',
                  names(categories, userCategories),
                  true,
                )}
                {field('title', 'Наименование', names(titles), false)}
              </>
            ) : (
              field(
                'source',
                'Источник дохода',
                names(sources, userSources),
                true,
              )
            )}
            <Controller
              name="groupId"
              control={form.control}
              rules={{
                validate: (id) =>
                  groups.some(
                    (g) =>
                      g.groupId === id &&
                      g.dataset === dataset &&
                      g.status === 'active',
                  ) || 'Выберите активную группу',
              }}
              render={({ field, fieldState }) => (
                <>
                  <GroupSelect
                    groups={groups}
                    dataset={dataset}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={busy}
                  />
                  {fieldState.error && (
                    <Alert severity="error">{fieldState.error.message}</Alert>
                  )}
                </>
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={close}
          >
            Отмена
          </Button>
          <Button
            disabled={busy}
            type="submit"
          >
            Сохранить правило
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
const Rules = ({ owner }: { owner: VerifiedOwner }) => {
  const catalog = useGroupCatalogQuery(owner, {
      refetchOnMountOrArgChange: true,
    }),
    rules = useGroupRulesQuery(owner, { refetchOnMountOrArgChange: true }),
    meta = useMetadata(owner);
  const [dataset, setDataset] = useState<Dataset>('expenses'),
    [editor, setEditor] = useState<{ rule?: GroupRule } | null>(null),
    [deleting, setDeleting] = useState<GroupRule | null>(null);
  const ready =
      !!rules.currentData &&
      !!catalog.currentData &&
      !rules.isFetching &&
      !rules.isError &&
      !catalog.isFetching &&
      !catalog.isError,
    blocked = !ready || meta.blocked;
  const refresh = () =>
    Promise.all([catalog.refetch().unwrap(), rules.refetch().unwrap()]);
  const feedback = (
    <MetadataFeedback
      meta={meta}
      refresh={refresh}
    />
  );
  const patch = async (r: GroupRule, enabled: boolean) => {
    if (!blocked)
      await meta.run({
        kind: 'rule',
        method: 'PATCH',
        id: r.id,
        body: { expectedEtag: r.etag, enabled },
      });
  };
  const save = async (body: Record<string, unknown>) => {
    if (blocked || !editor) return;
    const r = editor.rule;
    if (
      await meta.run({
        kind: 'rule',
        method: r ? 'PATCH' : 'POST',
        ...(r ? { id: r.id } : {}),
        body: { ...body, ...(r ? { expectedEtag: r.etag } : {}) },
      })
    )
      setEditor(null);
  };
  const label = (r: GroupRule) =>
    r.dataset === 'expenses'
      ? `${r.category}${r.title ? ' · ' + r.title : ''}`
      : r.source;
  return (
    <Stack spacing={2}>
      {!editor && !deleting && feedback}
      <Tabs
        value={dataset}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Правила классификации"
        onChange={(_e, v: Dataset) => {
          if (!meta.busy) setDataset(v);
        }}
      >
        <Tab
          value="expenses"
          label="Расходы"
        />
        <Tab
          value="incomes"
          label="Доходы"
        />
      </Tabs>
      <Typography>
        Совпадение категории и наименования приоритетнее общего правила
        категории. Создание правила не записывает классификации.
      </Typography>
      {rules.isError || catalog.isError ? (
        <Stack>
          <Alert severity="error">
            Правила v3 недоступны. Проверьте готовность сервера.
          </Alert>
          <Button onClick={() => void refresh().catch(() => undefined)}>
            Повторить загрузку
          </Button>
        </Stack>
      ) : !ready ? (
        <Typography role="status">Загрузка правил и всех групп…</Typography>
      ) : (
        <>
          {!catalog.currentData!.initialized && (
            <Alert severity="info">
              Сначала явно инициализируйте каталог на странице управления
              группами.
            </Alert>
          )}
          <Button
            component={Link}
            to="/profile/classification-groups"
          >
            Управление группами доходов и расходов
          </Button>
          <Button
            disabled={blocked || !catalog.currentData!.initialized}
            onClick={() => setEditor({})}
          >
            Добавить правило
          </Button>
          {rules
            .currentData!.filter((r) => r.dataset === dataset)
            .map((r) => (
              <Box
                key={r.id}
                component="section"
                aria-label={`Правило ${label(r)}`}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  p: 1.5,
                  borderRadius: 1,
                }}
              >
                <Stack spacing={1}>
                  <Typography sx={{ overflowWrap: 'anywhere' }}>
                    {label(r)}
                  </Typography>
                  <Typography>
                    Группа: {r.group?.name ?? 'Недоступна'}
                  </Typography>
                  <Chip
                    size="small"
                    sx={{
                      alignSelf: 'flex-start',
                      maxWidth: '100%',
                      height: 'auto',
                      '& .MuiChip-label': { whiteSpace: 'normal' },
                    }}
                    label={diagnosticLabel(r.diagnostic)}
                  />
                  {r.revision === 0 && (
                    <Typography variant="body2">
                      Совместимое прежнее правило. Конверсия — только при явном
                      изменении.
                    </Typography>
                  )}
                  <Stack
                    direction="row"
                    gap={1}
                    flexWrap="wrap"
                  >
                    <Button
                      disabled={blocked}
                      onClick={() => setEditor({ rule: r })}
                    >
                      Редактировать
                    </Button>
                    <Button
                      disabled={
                        blocked || (!r.enabled && r.group?.status !== 'active')
                      }
                      onClick={() => void patch(r, !r.enabled)}
                    >
                      {r.enabled ? 'Отключить' : 'Включить'}
                    </Button>
                    <Button
                      disabled={blocked}
                      onClick={() => setDeleting(r)}
                    >
                      Удалить
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            ))}
          {!rules.currentData!.some((r) => r.dataset === dataset) && (
            <Typography>Нет сохранённых правил.</Typography>
          )}
        </>
      )}
      {editor && catalog.currentData && (
        <RuleForm
          key={editor.rule?.id ?? dataset}
          dataset={editor.rule?.dataset ?? dataset}
          rule={editor.rule}
          groups={catalog.currentData.groups}
          busy={blocked}
          feedback={feedback}
          save={save}
          close={() => {
            if (!meta.busy) setEditor(null);
          }}
        />
      )}
      <Dialog
        open={!!deleting}
        fullWidth
        maxWidth="sm"
        aria-labelledby="delete-group-rule"
        onClose={() => {
          if (!meta.busy) setDeleting(null);
        }}
      >
        <DialogTitle id="delete-group-rule">Удалить правило?</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Typography>{deleting && label(deleting)}</Typography>
            {feedback}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={meta.busy}
            onClick={() => setDeleting(null)}
          >
            Отмена
          </Button>
          <Button
            disabled={blocked}
            onClick={async () => {
              if (
                deleting &&
                (await meta.run({
                  kind: 'rule',
                  method: 'DELETE',
                  id: deleting.id,
                  body: { expectedEtag: deleting.etag },
                }))
              )
                setDeleting(null);
            }}
          >
            Удалить правило
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
export default function GroupRulesPage() {
  const owner = useVerifiedOwner();
  return (
    <Box p={{ xs: 1, sm: 3 }}>
      <Stack spacing={2}>
        <Typography
          component="h1"
          variant="h5"
        >
          Настройки автоматической классификации
        </Typography>
        <Button
          component={Link}
          to="/profile"
        >
          Вернуться в профиль
        </Button>
        {owner.status !== 'verified' ? (
          <Alert severity="info">Нужна текущая проверка владельца.</Alert>
        ) : (
          <Rules
            key={`${owner.owner.userId}/${owner.owner.sessionGeneration}`}
            owner={owner.owner}
          />
        )}
      </Stack>
    </Box>
  );
}
